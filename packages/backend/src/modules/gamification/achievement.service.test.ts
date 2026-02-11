// ============================================================================
// ACHIEVEMENT SERVICE TESTS - Finance Hub
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Prisma } from '@prisma/client';

// Mock notification service
vi.mock('../notifications/notification.service.js', () => ({
  notificationService: {
    create: vi.fn(),
  },
}));

// Mock Prisma client
vi.mock('@/core/database/client.js', () => ({
  prisma: {
    achievement: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    userAchievement: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userStats: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/core/database/client.js';
import { achievementService } from './achievement.service.js';
import { notificationService } from '../notifications/notification.service.js';

// Helper to create mock achievement data
const createMockAchievement = (overrides = {}) => ({
  id: 'ach-123',
  code: 'first_steps',
  name: 'Premiers Pas',
  description: 'Ajoutez votre premiere transaction',
  icon: '👣',
  category: 'onboarding',
  threshold: 1,
  xpReward: 50,
  isSecret: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockUserAchievement = (overrides = {}) => ({
  id: 'ua-123',
  userId: 'user-123',
  achievementId: 'ach-123',
  progress: 0,
  unlockedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockUserStats = (overrides = {}) => ({
  userId: 'user-123',
  totalXp: 500,
  level: 3,
  currentStreak: 5,
  longestStreak: 10,
  transactionCount: 50,
  budgetsOnTrack: 3,
  goalsCompleted: 2,
  totalSaved: { toNumber: () => 1500 } as Prisma.Decimal,
  lastActivityDate: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AchievementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // INITIALIZE ACHIEVEMENTS
  // ============================================================================

  describe('initializeAchievements', () => {
    it('should upsert all achievement definitions', async () => {
      vi.mocked(prisma.achievement.upsert).mockResolvedValue(createMockAchievement() as any);

      const result = await achievementService.initializeAchievements();

      expect(result).toBeGreaterThan(0);
      expect(prisma.achievement.upsert).toHaveBeenCalled();
    });

    it('should update existing achievements with new values', async () => {
      vi.mocked(prisma.achievement.upsert).mockResolvedValue(createMockAchievement() as any);

      await achievementService.initializeAchievements();

      expect(prisma.achievement.upsert).toHaveBeenCalledWith({
        where: expect.objectContaining({ code: expect.any(String) }),
        create: expect.any(Object),
        update: expect.any(Object),
      });
    });
  });

  // ============================================================================
  // GET OR CREATE STATS
  // ============================================================================

  describe('getOrCreateStats', () => {
    it('should return existing user stats with level info', async () => {
      vi.mocked(prisma.userStats.findUnique).mockResolvedValue(createMockUserStats() as any);

      const result = await achievementService.getOrCreateStats('user-123');

      expect(result.totalXp).toBe(500);
      expect(result.level).toBe(3);
      expect(result.xpToNextLevel).toBeDefined();
      expect(result.levelProgress).toBeDefined();
    });

    it('should create new stats for new user', async () => {
      vi.mocked(prisma.userStats.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userStats.create).mockResolvedValue(
        createMockUserStats({ totalXp: 0, level: 1 }) as any
      );

      const result = await achievementService.getOrCreateStats('new-user');

      expect(prisma.userStats.create).toHaveBeenCalledWith({
        data: { userId: 'new-user' },
      });
      expect(result.totalXp).toBe(0);
    });

    it('should calculate level progress correctly', async () => {
      vi.mocked(prisma.userStats.findUnique).mockResolvedValue(
        createMockUserStats({ totalXp: 150, level: 2 }) as any
      );

      const result = await achievementService.getOrCreateStats('user-123');

      expect(result.level).toBe(2);
      expect(result.levelProgress).toBeGreaterThanOrEqual(0);
      expect(result.levelProgress).toBeLessThanOrEqual(100);
    });

    it('should convert totalSaved decimal to number', async () => {
      vi.mocked(prisma.userStats.findUnique).mockResolvedValue(
        createMockUserStats({
          totalSaved: { toNumber: () => 2500.50 } as Prisma.Decimal,
        }) as any
      );

      const result = await achievementService.getOrCreateStats('user-123');

      expect(result.totalSaved).toBe(2500.50);
    });
  });

  // ============================================================================
  // GET USER ACHIEVEMENTS
  // ============================================================================

  describe('getUserAchievements', () => {
    it('should return all achievements with user progress', async () => {
      const achievements = [
        createMockAchievement({ code: 'first_steps' }),
        createMockAchievement({ id: 'ach-2', code: 'tracker_10', threshold: 10 }),
      ];

      const userAchievements = [
        createMockUserAchievement({ progress: 1, unlockedAt: new Date() }),
      ];

      vi.mocked(prisma.achievement.findMany).mockResolvedValue(achievements as any);
      vi.mocked(prisma.userAchievement.findMany).mockResolvedValue(userAchievements as any);

      const result = await achievementService.getUserAchievements('user-123');

      expect(result).toHaveLength(2);
      expect(result[0]!.isUnlocked).toBe(true);
      expect(result[1]!.isUnlocked).toBe(false);
    });

    it('should hide secret achievement details if not unlocked', async () => {
      const achievements = [
        createMockAchievement({ code: 'night_owl', isSecret: true }),
      ];

      vi.mocked(prisma.achievement.findMany).mockResolvedValue(achievements as any);
      vi.mocked(prisma.userAchievement.findMany).mockResolvedValue([]);

      const result = await achievementService.getUserAchievements('user-123');

      expect(result[0]!.name).toBe('???');
      expect(result[0]!.description).toBe('Achievement secret');
      expect(result[0]!.icon).toBe('❓');
    });

    it('should show secret achievement details if unlocked', async () => {
      const achievements = [
        createMockAchievement({
          code: 'night_owl',
          name: 'Hibou Nocturne',
          isSecret: true,
        }),
      ];

      const userAchievements = [
        createMockUserAchievement({
          achievementId: 'ach-123',
          progress: 1,
          unlockedAt: new Date(),
        }),
      ];

      vi.mocked(prisma.achievement.findMany).mockResolvedValue(achievements as any);
      vi.mocked(prisma.userAchievement.findMany).mockResolvedValue(userAchievements as any);

      const result = await achievementService.getUserAchievements('user-123');

      expect(result[0]!.name).toBe('Hibou Nocturne');
      expect(result[0]!.isUnlocked).toBe(true);
    });

    it('should order achievements by category and threshold', async () => {
      vi.mocked(prisma.achievement.findMany).mockResolvedValue([]);
      vi.mocked(prisma.userAchievement.findMany).mockResolvedValue([]);

      await achievementService.getUserAchievements('user-123');

      expect(prisma.achievement.findMany).toHaveBeenCalledWith({
        orderBy: [{ category: 'asc' }, { threshold: 'asc' }],
      });
    });
  });

  // ============================================================================
  // UPDATE PROGRESS
  // ============================================================================

  describe('updateProgress', () => {
    it('should create user achievement if not exists', async () => {
      const achievement = createMockAchievement({ threshold: 10 });

      vi.mocked(prisma.achievement.findUnique).mockResolvedValue(achievement as any);
      vi.mocked(prisma.userAchievement.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userAchievement.create).mockResolvedValue(
        createMockUserAchievement({ progress: 5 }) as any
      );

      const result = await achievementService.updateProgress('user-123', 'first_steps', 5);

      expect(prisma.userAchievement.create).toHaveBeenCalled();
      expect(result.unlocked).toBe(false);
    });

    it('should unlock achievement when threshold is reached', async () => {
      const achievement = createMockAchievement({ threshold: 1, xpReward: 50 });

      vi.mocked(prisma.achievement.findUnique).mockResolvedValue(achievement as any);
      vi.mocked(prisma.userAchievement.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userAchievement.create).mockResolvedValue(
        createMockUserAchievement({ progress: 1, unlockedAt: new Date() }) as any
      );
      vi.mocked(prisma.userStats.upsert).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(prisma.userStats.update).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(notificationService.create).mockResolvedValue({} as any);

      const result = await achievementService.updateProgress('user-123', 'first_steps', 1);

      expect(result.unlocked).toBe(true);
      expect(result.achievement).toBeDefined();
      expect(notificationService.create).toHaveBeenCalled();
    });

    it('should increment progress when increment flag is set', async () => {
      const achievement = createMockAchievement({ threshold: 10 });
      const existingUserAchievement = createMockUserAchievement({ progress: 3 });

      vi.mocked(prisma.achievement.findUnique).mockResolvedValue(achievement as any);
      vi.mocked(prisma.userAchievement.findUnique).mockResolvedValue(existingUserAchievement as any);
      vi.mocked(prisma.userAchievement.update).mockResolvedValue(
        createMockUserAchievement({ progress: 5 }) as any
      );

      await achievementService.updateProgress('user-123', 'tracker_10', 2, true);

      expect(prisma.userAchievement.update).toHaveBeenCalledWith({
        where: { id: 'ua-123' },
        data: expect.objectContaining({
          progress: 5, // 3 + 2
        }),
      });
    });

    it('should not unlock already unlocked achievement', async () => {
      const achievement = createMockAchievement({ threshold: 1 });
      const unlockedAchievement = createMockUserAchievement({
        progress: 1,
        unlockedAt: new Date(),
      });

      vi.mocked(prisma.achievement.findUnique).mockResolvedValue(achievement as any);
      vi.mocked(prisma.userAchievement.findUnique).mockResolvedValue(unlockedAchievement as any);

      const result = await achievementService.updateProgress('user-123', 'first_steps', 1);

      expect(result.unlocked).toBe(false);
      expect(prisma.userAchievement.update).not.toHaveBeenCalled();
    });

    it('should return unlocked false for non-existent achievement', async () => {
      vi.mocked(prisma.achievement.findUnique).mockResolvedValue(null);

      const result = await achievementService.updateProgress('user-123', 'nonexistent', 1);

      expect(result.unlocked).toBe(false);
    });

    it('should cap progress at threshold', async () => {
      const achievement = createMockAchievement({ threshold: 10 });

      vi.mocked(prisma.achievement.findUnique).mockResolvedValue(achievement as any);
      vi.mocked(prisma.userAchievement.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userAchievement.create).mockResolvedValue(
        createMockUserAchievement({ progress: 10, unlockedAt: new Date() }) as any
      );
      vi.mocked(prisma.userStats.upsert).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(prisma.userStats.update).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(notificationService.create).mockResolvedValue({} as any);

      await achievementService.updateProgress('user-123', 'tracker_10', 100);

      expect(prisma.userAchievement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          progress: 10, // Capped at threshold
        }),
      });
    });
  });

  // ============================================================================
  // AWARD XP
  // ============================================================================

  describe('awardXp', () => {
    it('should add XP to user stats', async () => {
      vi.mocked(prisma.userStats.upsert).mockResolvedValue(
        createMockUserStats({ totalXp: 550, level: 3 }) as any
      );

      const result = await achievementService.awardXp('user-123', 50);

      expect(prisma.userStats.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        create: { userId: 'user-123', totalXp: 50 },
        update: { totalXp: { increment: 50 } },
      });
      expect(result.newLevel).toBe(false);
    });

    it('should detect level up and send notification', async () => {
      // User levels up from 2 to 3
      vi.mocked(prisma.userStats.upsert).mockResolvedValue(
        createMockUserStats({ totalXp: 400, level: 2 }) as any // 400 XP = level 3
      );
      vi.mocked(prisma.userStats.update).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(notificationService.create).mockResolvedValue({} as any);

      const result = await achievementService.awardXp('user-123', 100);

      expect(result.newLevel).toBe(true);
      expect(result.level).toBe(3);
      expect(notificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'goal_achieved',
          title: expect.stringContaining('Niveau'),
        })
      );
    });

    it('should not level up if XP not sufficient', async () => {
      vi.mocked(prisma.userStats.upsert).mockResolvedValue(
        createMockUserStats({ totalXp: 50, level: 1 }) as any
      );

      const result = await achievementService.awardXp('user-123', 10);

      expect(result.newLevel).toBe(false);
      expect(prisma.userStats.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // RECORD ACTIVITY
  // ============================================================================

  describe('recordActivity', () => {
    it('should start streak for new user', async () => {
      vi.mocked(prisma.userStats.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userStats.create).mockResolvedValue(
        createMockUserStats({ currentStreak: 1, longestStreak: 1 }) as any
      );

      const result = await achievementService.recordActivity('new-user');

      expect(result.streak).toBe(1);
      expect(result.xpAwarded).toBe(0);
    });

    it('should increment streak for consecutive day activity', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      vi.mocked(prisma.userStats.findUnique).mockResolvedValue(
        createMockUserStats({
          currentStreak: 5,
          lastActivityDate: yesterday,
        }) as any
      );
      vi.mocked(prisma.userStats.update).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(prisma.achievement.findUnique).mockResolvedValue(null);

      const result = await achievementService.recordActivity('user-123');

      expect(result.streak).toBe(6);
      expect(result.xpAwarded).toBeGreaterThan(0);
    });

    it('should reset streak if day is skipped', async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      twoDaysAgo.setHours(0, 0, 0, 0);

      vi.mocked(prisma.userStats.findUnique).mockResolvedValue(
        createMockUserStats({
          currentStreak: 10,
          lastActivityDate: twoDaysAgo,
        }) as any
      );
      vi.mocked(prisma.userStats.update).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(prisma.achievement.findUnique).mockResolvedValue(null);

      const result = await achievementService.recordActivity('user-123');

      expect(result.streak).toBe(1);
    });

    it('should not change streak for same day activity', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      vi.mocked(prisma.userStats.findUnique).mockResolvedValue(
        createMockUserStats({
          currentStreak: 5,
          lastActivityDate: today,
        }) as any
      );

      const result = await achievementService.recordActivity('user-123');

      expect(result.streak).toBe(5);
      expect(result.xpAwarded).toBe(0);
      expect(prisma.userStats.update).not.toHaveBeenCalled();
    });

    it('should check streak achievements on update', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      vi.mocked(prisma.userStats.findUnique).mockResolvedValue(
        createMockUserStats({
          currentStreak: 6,
          lastActivityDate: yesterday,
        }) as any
      );
      vi.mocked(prisma.userStats.update).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(prisma.achievement.findUnique).mockResolvedValue(
        createMockAchievement({ code: 'streak_7', threshold: 7, xpReward: 100 }) as any
      );
      vi.mocked(prisma.userAchievement.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userAchievement.create).mockResolvedValue(
        createMockUserAchievement({ progress: 7, unlockedAt: new Date() }) as any
      );
      vi.mocked(prisma.userStats.upsert).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(notificationService.create).mockResolvedValue({} as any);

      await achievementService.recordActivity('user-123');

      // Should have called updateProgress for streak achievements
      expect(prisma.achievement.findUnique).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // INCREMENT TRANSACTION COUNT
  // ============================================================================

  describe('incrementTransactionCount', () => {
    it('should increment transaction count', async () => {
      vi.mocked(prisma.userStats.upsert).mockResolvedValue(
        createMockUserStats({ transactionCount: 10 }) as any
      );
      vi.mocked(prisma.achievement.findUnique).mockResolvedValue(null);

      await achievementService.incrementTransactionCount('user-123');

      expect(prisma.userStats.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        create: { userId: 'user-123', transactionCount: 1 },
        update: { transactionCount: { increment: 1 } },
      });
    });

    it('should check transaction achievements', async () => {
      vi.mocked(prisma.userStats.upsert).mockResolvedValue(
        createMockUserStats({ transactionCount: 9 }) as any
      );
      vi.mocked(prisma.achievement.findUnique).mockResolvedValue(
        createMockAchievement({ code: 'tracker_10', threshold: 10 }) as any
      );
      vi.mocked(prisma.userAchievement.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userAchievement.create).mockResolvedValue(
        createMockUserAchievement({ progress: 10, unlockedAt: new Date() }) as any
      );
      vi.mocked(prisma.userStats.upsert).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(prisma.userStats.update).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(notificationService.create).mockResolvedValue({} as any);

      await achievementService.incrementTransactionCount('user-123');

      // Should check tracker_10 achievement
      expect(prisma.achievement.findUnique).toHaveBeenCalled();
    });

    it('should check night owl achievement for late night transactions', async () => {
      // Mock Date to simulate 2 AM
      const mockDate = new Date();
      mockDate.setHours(2, 0, 0, 0);
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      vi.mocked(prisma.userStats.upsert).mockResolvedValue(
        createMockUserStats({ transactionCount: 1 }) as any
      );
      vi.mocked(prisma.achievement.findUnique).mockResolvedValue(
        createMockAchievement({ code: 'night_owl', isSecret: true }) as any
      );
      vi.mocked(prisma.userAchievement.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userAchievement.create).mockResolvedValue(
        createMockUserAchievement({ progress: 1, unlockedAt: new Date() }) as any
      );
      vi.mocked(prisma.userStats.upsert).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(prisma.userStats.update).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(notificationService.create).mockResolvedValue({} as any);

      await achievementService.incrementTransactionCount('user-123');

      // Restore Date
      vi.restoreAllMocks();
    });
  });

  // ============================================================================
  // RECORD SAVINGS
  // ============================================================================

  describe('recordSavingsContribution', () => {
    it('should increment total saved amount', async () => {
      vi.mocked(prisma.userStats.upsert).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(prisma.userStats.findUnique).mockResolvedValue(
        createMockUserStats({ totalSaved: { toNumber: () => 1500 } as Prisma.Decimal }) as any
      );
      vi.mocked(prisma.achievement.findUnique).mockResolvedValue(null);

      await achievementService.recordSavingsContribution('user-123', 500);

      expect(prisma.userStats.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        create: { userId: 'user-123', totalSaved: 500 },
        update: { totalSaved: { increment: 500 } },
      });
    });

    it('should check savings milestone achievements', async () => {
      vi.mocked(prisma.userStats.upsert).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(prisma.userStats.findUnique).mockResolvedValue(
        createMockUserStats({ totalSaved: { toNumber: () => 1000 } as Prisma.Decimal }) as any
      );
      vi.mocked(prisma.achievement.findUnique).mockResolvedValue(
        createMockAchievement({ code: 'saver_1000', threshold: 1000 }) as any
      );
      vi.mocked(prisma.userAchievement.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userAchievement.create).mockResolvedValue(
        createMockUserAchievement({ progress: 1000, unlockedAt: new Date() }) as any
      );
      vi.mocked(prisma.userStats.upsert).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(prisma.userStats.update).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(notificationService.create).mockResolvedValue({} as any);

      await achievementService.recordSavingsContribution('user-123', 500);

      expect(prisma.achievement.findUnique).toHaveBeenCalled();
    });
  });

  describe('recordGoalCompleted', () => {
    it('should increment goals completed count', async () => {
      vi.mocked(prisma.userStats.upsert).mockResolvedValue(
        createMockUserStats({ goalsCompleted: 1 }) as any
      );
      vi.mocked(prisma.achievement.findUnique).mockResolvedValue(null);

      await achievementService.recordGoalCompleted('user-123');

      expect(prisma.userStats.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        create: { userId: 'user-123', goalsCompleted: 1 },
        update: { goalsCompleted: { increment: 1 } },
      });
    });

    it('should check goal completion achievements', async () => {
      vi.mocked(prisma.userStats.upsert).mockResolvedValue(
        createMockUserStats({ goalsCompleted: 3 }) as any
      );
      vi.mocked(prisma.achievement.findUnique).mockResolvedValue(
        createMockAchievement({ code: 'saver_3_goals', threshold: 3 }) as any
      );
      vi.mocked(prisma.userAchievement.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userAchievement.create).mockResolvedValue(
        createMockUserAchievement({ progress: 3, unlockedAt: new Date() }) as any
      );
      vi.mocked(prisma.userStats.upsert).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(prisma.userStats.update).mockResolvedValue(createMockUserStats() as any);
      vi.mocked(notificationService.create).mockResolvedValue({} as any);

      await achievementService.recordGoalCompleted('user-123');

      expect(prisma.achievement.findUnique).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // LEADERBOARD
  // ============================================================================

  describe('getLeaderboard', () => {
    it('should return top users by XP', async () => {
      const mockStats = [
        {
          ...createMockUserStats({ userId: 'user-1', totalXp: 1000, level: 4 }),
          user: { displayName: 'Alice' },
        },
        {
          ...createMockUserStats({ userId: 'user-2', totalXp: 800, level: 3 }),
          user: { displayName: 'Bob' },
        },
        {
          ...createMockUserStats({ userId: 'user-3', totalXp: 500, level: 3 }),
          user: { displayName: 'Charlie' },
        },
      ];

      vi.mocked(prisma.userStats.findMany).mockResolvedValue(mockStats as any);

      const result = await achievementService.getLeaderboard(3);

      expect(result).toHaveLength(3);
      expect(result[0]!.displayName).toBe('Alice');
      expect(result[0]!.totalXp).toBe(1000);
    });

    it('should order by XP descending', async () => {
      vi.mocked(prisma.userStats.findMany).mockResolvedValue([]);

      await achievementService.getLeaderboard(10);

      expect(prisma.userStats.findMany).toHaveBeenCalledWith({
        orderBy: [{ totalXp: 'desc' }],
        take: 10,
        include: {
          user: { select: { displayName: true } },
        },
      });
    });

    it('should limit results to specified count', async () => {
      vi.mocked(prisma.userStats.findMany).mockResolvedValue([]);

      await achievementService.getLeaderboard(5);

      expect(prisma.userStats.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        })
      );
    });

    it('should include streak information', async () => {
      const mockStats = [
        {
          ...createMockUserStats({ currentStreak: 15 }),
          user: { displayName: 'Alice' },
        },
      ];

      vi.mocked(prisma.userStats.findMany).mockResolvedValue(mockStats as any);

      const result = await achievementService.getLeaderboard();

      expect(result[0]!.currentStreak).toBe(15);
    });
  });
});
