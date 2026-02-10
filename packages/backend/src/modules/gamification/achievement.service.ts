// ============================================================================
// ACHIEVEMENT SERVICE - Finance Hub
// Gamification achievements and XP system
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { notificationService } from '../notifications/notification.service.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface AchievementDefinition {
  code: string;
  name: string;
  description: string;
  icon: string;
  category: 'onboarding' | 'transactions' | 'budgeting' | 'savings' | 'streaks' | 'milestones';
  threshold: number;
  xpReward: number;
  isSecret?: boolean;
}

export interface UserAchievementWithDetails {
  id: string;
  achievementId: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  threshold: number;
  xpReward: number;
  progress: number;
  isUnlocked: boolean;
  unlockedAt: Date | null;
  isSecret: boolean;
}

export interface UserStatsWithLevel {
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  transactionCount: number;
  budgetsOnTrack: number;
  goalsCompleted: number;
  totalSaved: number;
  xpToNextLevel: number;
  levelProgress: number;
}

// ----------------------------------------------------------------------------
// Achievement Definitions
// ----------------------------------------------------------------------------

const ACHIEVEMENTS: AchievementDefinition[] = [
  // Onboarding
  { code: 'first_steps', name: 'Premiers Pas', description: 'Ajoutez votre premiere transaction', icon: '👣', category: 'onboarding', threshold: 1, xpReward: 50 },
  { code: 'first_budget', name: 'Budgeteur Debutant', description: 'Creez votre premier budget', icon: '📊', category: 'onboarding', threshold: 1, xpReward: 100 },
  { code: 'first_goal', name: 'Objectif Fixe', description: "Creez votre premier objectif d'epargne", icon: '🎯', category: 'onboarding', threshold: 1, xpReward: 100 },
  { code: 'account_setup', name: 'Bien Equipe', description: 'Ajoutez 3 comptes', icon: '🏦', category: 'onboarding', threshold: 3, xpReward: 75 },

  // Transactions
  { code: 'tracker_10', name: 'Suivi Regulier', description: 'Enregistrez 10 transactions', icon: '📝', category: 'transactions', threshold: 10, xpReward: 50 },
  { code: 'tracker_50', name: 'Traceur Assidu', description: 'Enregistrez 50 transactions', icon: '📋', category: 'transactions', threshold: 50, xpReward: 150 },
  { code: 'tracker_100', name: 'Maitre du Suivi', description: 'Enregistrez 100 transactions', icon: '📚', category: 'transactions', threshold: 100, xpReward: 300 },
  { code: 'tracker_500', name: 'Expert Comptable', description: 'Enregistrez 500 transactions', icon: '🏆', category: 'transactions', threshold: 500, xpReward: 500 },
  { code: 'categorizer', name: 'Organisateur', description: 'Categorisez 25 transactions', icon: '🗂️', category: 'transactions', threshold: 25, xpReward: 100 },

  // Budgeting
  { code: 'budget_keeper', name: 'Budget Respecte', description: 'Terminez un mois sous le budget', icon: '✅', category: 'budgeting', threshold: 1, xpReward: 200 },
  { code: 'budget_master_3', name: 'Discipline', description: 'Respectez vos budgets 3 mois consecutifs', icon: '🏅', category: 'budgeting', threshold: 3, xpReward: 400 },
  { code: 'budget_master_6', name: 'Maitrise Budgetaire', description: 'Respectez vos budgets 6 mois consecutifs', icon: '🥇', category: 'budgeting', threshold: 6, xpReward: 750 },
  { code: 'multi_budget', name: 'Multi-Budgets', description: 'Gerez 5 budgets simultanement', icon: '📈', category: 'budgeting', threshold: 5, xpReward: 200 },

  // Savings
  { code: 'saver_first', name: 'Premier Pas Epargne', description: 'Atteignez 10% de votre premier objectif', icon: '🌱', category: 'savings', threshold: 10, xpReward: 50 },
  { code: 'saver_half', name: 'Mi-Parcours', description: 'Atteignez 50% d\'un objectif', icon: '🌿', category: 'savings', threshold: 50, xpReward: 150 },
  { code: 'saver_complete', name: 'Objectif Atteint', description: 'Completez un objectif d\'epargne', icon: '🌳', category: 'savings', threshold: 1, xpReward: 300 },
  { code: 'saver_3_goals', name: 'Triple Succes', description: 'Completez 3 objectifs d\'epargne', icon: '🏆', category: 'savings', threshold: 3, xpReward: 500 },
  { code: 'saver_1000', name: 'Millier Epargne', description: 'Epargnez 1000 EUR au total', icon: '💰', category: 'savings', threshold: 1000, xpReward: 250 },
  { code: 'saver_10000', name: 'Dixieme de Millier', description: 'Epargnez 10000 EUR au total', icon: '💎', category: 'savings', threshold: 10000, xpReward: 1000 },

  // Streaks
  { code: 'streak_7', name: 'Semaine Active', description: '7 jours consecutifs d\'activite', icon: '🔥', category: 'streaks', threshold: 7, xpReward: 100 },
  { code: 'streak_30', name: 'Mois Complet', description: '30 jours consecutifs d\'activite', icon: '⚡', category: 'streaks', threshold: 30, xpReward: 300 },
  { code: 'streak_100', name: 'Centenaire', description: '100 jours consecutifs d\'activite', icon: '🌟', category: 'streaks', threshold: 100, xpReward: 750 },
  { code: 'streak_365', name: 'Marathonien', description: '365 jours consecutifs d\'activite', icon: '👑', category: 'streaks', threshold: 365, xpReward: 2000 },

  // Milestones (secret)
  { code: 'night_owl', name: 'Hibou Nocturne', description: 'Ajoutez une transaction apres minuit', icon: '🦉', category: 'milestones', threshold: 1, xpReward: 50, isSecret: true },
  { code: 'early_bird', name: 'Leve-Tot', description: 'Ajoutez une transaction avant 6h', icon: '🐦', category: 'milestones', threshold: 1, xpReward: 50, isSecret: true },
  { code: 'perfect_month', name: 'Mois Parfait', description: 'Categorisez toutes les transactions du mois', icon: '✨', category: 'milestones', threshold: 1, xpReward: 200, isSecret: true },
];

// ----------------------------------------------------------------------------
// XP Level Calculation
// ----------------------------------------------------------------------------

/**
 * Calculate level from total XP (exponential curve)
 */
function calculateLevel(totalXp: number): number {
  // Formula: level = floor(sqrt(xp / 100))
  // Level 1: 0-99, Level 2: 100-399, Level 3: 400-899, etc.
  return Math.floor(Math.sqrt(totalXp / 100)) + 1;
}

/**
 * Calculate XP needed for next level
 */
function xpForLevel(level: number): number {
  return (level - 1) * (level - 1) * 100;
}

/**
 * Calculate XP progress within current level
 */
function calculateLevelProgress(totalXp: number): { xpToNextLevel: number; levelProgress: number } {
  const currentLevel = calculateLevel(totalXp);
  const currentLevelXp = xpForLevel(currentLevel);
  const nextLevelXp = xpForLevel(currentLevel + 1);
  const xpInLevel = totalXp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;

  return {
    xpToNextLevel: nextLevelXp - totalXp,
    levelProgress: Math.round((xpInLevel / xpNeeded) * 100),
  };
}

// ----------------------------------------------------------------------------
// Achievement Service
// ----------------------------------------------------------------------------

export const achievementService = {
  /**
   * Initialize achievements in database (run on startup)
   */
  async initializeAchievements(): Promise<number> {
    let created = 0;

    for (const achievement of ACHIEVEMENTS) {
      await prisma.achievement.upsert({
        where: { code: achievement.code },
        create: {
          code: achievement.code,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          threshold: achievement.threshold,
          xpReward: achievement.xpReward,
          isSecret: achievement.isSecret ?? false,
        },
        update: {
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          threshold: achievement.threshold,
          xpReward: achievement.xpReward,
          isSecret: achievement.isSecret ?? false,
        },
      });
      created++;
    }

    return created;
  },

  /**
   * Get or create user stats
   */
  async getOrCreateStats(userId: string): Promise<UserStatsWithLevel> {
    let stats = await prisma.userStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      stats = await prisma.userStats.create({
        data: { userId },
      });
    }

    const { xpToNextLevel, levelProgress } = calculateLevelProgress(stats.totalXp);

    return {
      totalXp: stats.totalXp,
      level: stats.level,
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      transactionCount: stats.transactionCount,
      budgetsOnTrack: stats.budgetsOnTrack,
      goalsCompleted: stats.goalsCompleted,
      totalSaved: stats.totalSaved.toNumber(),
      xpToNextLevel,
      levelProgress,
    };
  },

  /**
   * Get user achievements with progress
   */
  async getUserAchievements(userId: string): Promise<UserAchievementWithDetails[]> {
    const allAchievements = await prisma.achievement.findMany({
      orderBy: [{ category: 'asc' }, { threshold: 'asc' }],
    });

    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId },
    });

    const userAchievementMap = new Map(
      userAchievements.map((ua) => [ua.achievementId, ua])
    );

    return allAchievements.map((a) => {
      const userAchievement = userAchievementMap.get(a.id);
      const isUnlocked = userAchievement?.unlockedAt != null;

      // Hide secret achievements that aren't unlocked
      if (a.isSecret && !isUnlocked) {
        return {
          id: userAchievement?.id ?? '',
          achievementId: a.id,
          code: a.code,
          name: '???',
          description: 'Achievement secret',
          icon: '❓',
          category: a.category,
          threshold: a.threshold,
          xpReward: a.xpReward,
          progress: 0,
          isUnlocked: false,
          unlockedAt: null,
          isSecret: true,
        };
      }

      return {
        id: userAchievement?.id ?? '',
        achievementId: a.id,
        code: a.code,
        name: a.name,
        description: a.description,
        icon: a.icon,
        category: a.category,
        threshold: a.threshold,
        xpReward: a.xpReward,
        progress: userAchievement?.progress ?? 0,
        isUnlocked,
        unlockedAt: userAchievement?.unlockedAt ?? null,
        isSecret: a.isSecret,
      };
    });
  },

  /**
   * Update progress for an achievement
   */
  async updateProgress(
    userId: string,
    achievementCode: string,
    progress: number,
    increment: boolean = false
  ): Promise<{ unlocked: boolean; achievement?: UserAchievementWithDetails }> {
    const achievement = await prisma.achievement.findUnique({
      where: { code: achievementCode },
    });

    if (!achievement) {
      return { unlocked: false };
    }

    // Get or create user achievement
    let userAchievement = await prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: { userId, achievementId: achievement.id },
      },
    });

    // Already unlocked
    if (userAchievement?.unlockedAt) {
      return { unlocked: false };
    }

    const newProgress = increment
      ? (userAchievement?.progress ?? 0) + progress
      : progress;

    const shouldUnlock = newProgress >= achievement.threshold;

    if (!userAchievement) {
      userAchievement = await prisma.userAchievement.create({
        data: {
          userId,
          achievementId: achievement.id,
          progress: Math.min(newProgress, achievement.threshold),
          unlockedAt: shouldUnlock ? new Date() : null,
        },
      });
    } else {
      userAchievement = await prisma.userAchievement.update({
        where: { id: userAchievement.id },
        data: {
          progress: Math.min(newProgress, achievement.threshold),
          unlockedAt: shouldUnlock ? new Date() : null,
        },
      });
    }

    if (shouldUnlock) {
      // Award XP
      await this.awardXp(userId, achievement.xpReward);

      // Send notification
      await notificationService.create({
        userId,
        type: 'goal_achieved',
        title: `${achievement.icon} Achievement Debloque !`,
        message: `Vous avez obtenu "${achievement.name}" - ${achievement.description}`,
        data: {
          achievementCode: achievement.code,
          xpReward: achievement.xpReward,
        },
      });

      return {
        unlocked: true,
        achievement: {
          id: userAchievement.id,
          achievementId: achievement.id,
          code: achievement.code,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          threshold: achievement.threshold,
          xpReward: achievement.xpReward,
          progress: achievement.threshold,
          isUnlocked: true,
          unlockedAt: userAchievement.unlockedAt,
          isSecret: achievement.isSecret,
        },
      };
    }

    return { unlocked: false };
  },

  /**
   * Award XP to user
   */
  async awardXp(userId: string, amount: number): Promise<{ newLevel: boolean; level: number }> {
    const stats = await prisma.userStats.upsert({
      where: { userId },
      create: { userId, totalXp: amount },
      update: { totalXp: { increment: amount } },
    });

    const newLevel = calculateLevel(stats.totalXp);
    const leveledUp = newLevel > stats.level;

    if (leveledUp) {
      await prisma.userStats.update({
        where: { userId },
        data: { level: newLevel },
      });

      // Send level up notification
      await notificationService.create({
        userId,
        type: 'goal_achieved',
        title: '🎉 Niveau Superieur !',
        message: `Felicitations ! Vous avez atteint le niveau ${newLevel} !`,
        data: { level: newLevel },
      });
    }

    return { newLevel: leveledUp, level: newLevel };
  },

  /**
   * Record daily activity and update streak
   */
  async recordActivity(userId: string): Promise<{ streak: number; xpAwarded: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await prisma.userStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      await prisma.userStats.create({
        data: {
          userId,
          currentStreak: 1,
          longestStreak: 1,
          lastActivityDate: today,
        },
      });
      return { streak: 1, xpAwarded: 0 };
    }

    const lastActivity = stats.lastActivityDate;
    let newStreak = stats.currentStreak;
    let xpAwarded = 0;

    if (lastActivity) {
      const lastDate = new Date(lastActivity);
      lastDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 0) {
        // Same day, no change
        return { streak: newStreak, xpAwarded: 0 };
      } else if (daysDiff === 1) {
        // Consecutive day
        newStreak++;
        xpAwarded = Math.min(50, 5 + newStreak); // Bonus XP for streak
      } else {
        // Streak broken
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    const newLongest = Math.max(newStreak, stats.longestStreak);

    await prisma.userStats.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastActivityDate: today,
        totalXp: { increment: xpAwarded },
      },
    });

    // Check streak achievements
    await this.updateProgress(userId, 'streak_7', newStreak);
    await this.updateProgress(userId, 'streak_30', newStreak);
    await this.updateProgress(userId, 'streak_100', newStreak);
    await this.updateProgress(userId, 'streak_365', newStreak);

    return { streak: newStreak, xpAwarded };
  },

  /**
   * Increment transaction count
   */
  async incrementTransactionCount(userId: string): Promise<void> {
    const stats = await prisma.userStats.upsert({
      where: { userId },
      create: { userId, transactionCount: 1 },
      update: { transactionCount: { increment: 1 } },
    });

    const count = stats.transactionCount + 1;

    // Check transaction achievements
    await this.updateProgress(userId, 'first_steps', count);
    await this.updateProgress(userId, 'tracker_10', count);
    await this.updateProgress(userId, 'tracker_50', count);
    await this.updateProgress(userId, 'tracker_100', count);
    await this.updateProgress(userId, 'tracker_500', count);

    // Check time-based secret achievements
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) {
      await this.updateProgress(userId, 'night_owl', 1);
    }
    if (hour >= 5 && hour < 6) {
      await this.updateProgress(userId, 'early_bird', 1);
    }
  },

  /**
   * Record savings contribution
   */
  async recordSavingsContribution(userId: string, amount: number): Promise<void> {
    await prisma.userStats.upsert({
      where: { userId },
      create: { userId, totalSaved: amount },
      update: { totalSaved: { increment: amount } },
    });

    const stats = await prisma.userStats.findUnique({ where: { userId } });
    const totalSaved = stats?.totalSaved.toNumber() ?? 0;

    // Check savings milestones
    await this.updateProgress(userId, 'saver_1000', totalSaved);
    await this.updateProgress(userId, 'saver_10000', totalSaved);
  },

  /**
   * Record completed savings goal
   */
  async recordGoalCompleted(userId: string): Promise<void> {
    const stats = await prisma.userStats.upsert({
      where: { userId },
      create: { userId, goalsCompleted: 1 },
      update: { goalsCompleted: { increment: 1 } },
    });

    await this.updateProgress(userId, 'saver_complete', stats.goalsCompleted);
    await this.updateProgress(userId, 'saver_3_goals', stats.goalsCompleted);
  },

  /**
   * Get leaderboard (top users by level/XP)
   */
  async getLeaderboard(limit: number = 10): Promise<Array<{
    userId: string;
    displayName: string;
    level: number;
    totalXp: number;
    currentStreak: number;
  }>> {
    const stats = await prisma.userStats.findMany({
      orderBy: [{ totalXp: 'desc' }],
      take: limit,
      include: {
        user: { select: { displayName: true } },
      },
    });

    return stats.map((s) => ({
      userId: s.userId,
      displayName: s.user.displayName,
      level: s.level,
      totalXp: s.totalXp,
      currentStreak: s.currentStreak,
    }));
  },
};

export default achievementService;
