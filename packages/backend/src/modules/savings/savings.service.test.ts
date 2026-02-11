// ============================================================================
// SAVINGS SERVICE TESTS - Finance Hub
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Prisma } from '@prisma/client';

// Mock error handler first (to avoid Sentry import issue)
vi.mock('@/core/middleware/errorHandler.js', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(resource: string, id?: string) {
      super(id ? `${resource} with ID ${id} not found` : `${resource} not found`);
      this.name = 'NotFoundError';
    }
  },
}));

// Mock Prisma client
vi.mock('@/core/database/client.js', () => ({
  prisma: {
    account: {
      findFirst: vi.fn(),
    },
    savingsGoal: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    savingsContribution: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/core/database/client.js';
import { savingsService } from './savings.service.js';

// Helper to create mock savings goal data
const createMockSavingsGoal = (overrides = {}) => ({
  id: 'goal-123',
  workspaceId: 'workspace-123',
  name: 'Emergency Fund',
  targetAmount: { toNumber: () => 5000 } as Prisma.Decimal,
  currentAmount: { toNumber: () => 1500 } as Prisma.Decimal,
  currency: 'EUR',
  targetDate: new Date('2024-12-31'),
  icon: '💰',
  color: '#4CAF50',
  accountId: 'account-123',
  isCompleted: false,
  completedAt: null,
  deletedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

const createMockContribution = (overrides = {}) => ({
  id: 'contrib-123',
  savingsGoalId: 'goal-123',
  amount: { toNumber: () => 500 } as Prisma.Decimal,
  date: new Date('2024-01-15'),
  notes: 'Monthly contribution',
  transactionId: null,
  createdAt: new Date('2024-01-15'),
  ...overrides,
});

describe('SavingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // CREATE
  // ============================================================================

  describe('create', () => {
    it('should create a savings goal successfully', async () => {
      const workspaceId = 'workspace-123';
      const input = {
        name: 'Vacation Fund',
        targetAmount: 3000,
        currency: 'EUR',
        targetDate: new Date('2024-06-30'),
        icon: '✈️',
        color: '#2196F3',
        accountId: 'account-123',
      };

      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        id: 'account-123',
        workspaceId,
        name: 'Savings Account',
        deletedAt: null,
      } as any);

      const mockGoal = {
        ...createMockSavingsGoal({
          name: input.name,
          targetAmount: { toNumber: () => input.targetAmount } as Prisma.Decimal,
          currentAmount: { toNumber: () => 0 } as Prisma.Decimal,
        }),
        account: { id: 'account-123', name: 'Savings Account', icon: null, color: null },
        contributions: [],
      };

      vi.mocked(prisma.savingsGoal.create).mockResolvedValue(mockGoal as any);

      const result = await savingsService.create(workspaceId, input);

      expect(result.name).toBe('Vacation Fund');
      expect(result.progress).toBe(0);
      expect(result.remainingAmount).toBe(3000);
      expect(prisma.savingsGoal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId,
          name: input.name,
          targetAmount: input.targetAmount,
        }),
        include: expect.any(Object),
      });
    });

    it('should create goal without account', async () => {
      const workspaceId = 'workspace-123';
      const input = {
        name: 'Simple Goal',
        targetAmount: 1000,
      };

      const mockGoal = {
        ...createMockSavingsGoal({
          name: input.name,
          accountId: null,
          targetAmount: { toNumber: () => 1000 } as Prisma.Decimal,
          currentAmount: { toNumber: () => 0 } as Prisma.Decimal,
        }),
        account: null,
        contributions: [],
      };

      vi.mocked(prisma.savingsGoal.create).mockResolvedValue(mockGoal as any);

      const result = await savingsService.create(workspaceId, input);

      expect(result.account).toBeNull();
      expect(prisma.account.findFirst).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError if account does not exist', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null);

      await expect(
        savingsService.create('workspace-123', {
          name: 'Goal',
          targetAmount: 1000,
          accountId: 'nonexistent',
        })
      ).rejects.toThrow();
    });

    it('should set default currency to EUR', async () => {
      const mockGoal = {
        ...createMockSavingsGoal({
          currency: 'EUR',
          targetAmount: { toNumber: () => 500 } as Prisma.Decimal,
          currentAmount: { toNumber: () => 0 } as Prisma.Decimal,
        }),
        account: null,
        contributions: [],
      };

      vi.mocked(prisma.savingsGoal.create).mockResolvedValue(mockGoal as any);

      await savingsService.create('workspace-123', {
        name: 'Goal without currency',
        targetAmount: 500,
      });

      expect(prisma.savingsGoal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          currency: 'EUR',
        }),
        include: expect.any(Object),
      });
    });

    it('should calculate days until target date', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const mockGoal = {
        ...createMockSavingsGoal({
          targetDate: futureDate,
          targetAmount: { toNumber: () => 1000 } as Prisma.Decimal,
          currentAmount: { toNumber: () => 0 } as Prisma.Decimal,
        }),
        account: null,
        contributions: [],
      };

      vi.mocked(prisma.savingsGoal.create).mockResolvedValue(mockGoal as any);

      const result = await savingsService.create('workspace-123', {
        name: 'Goal with date',
        targetAmount: 1000,
        targetDate: futureDate,
      });

      expect(result.daysUntilTarget).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // GET BY ID
  // ============================================================================

  describe('getById', () => {
    it('should return savings goal with progress', async () => {
      const mockGoal = {
        ...createMockSavingsGoal(),
        account: { id: 'account-123', name: 'Savings', icon: null, color: null },
        contributions: [
          createMockContribution({ amount: { toNumber: () => 500 } as Prisma.Decimal }),
          createMockContribution({ id: 'contrib-2', amount: { toNumber: () => 1000 } as Prisma.Decimal }),
        ],
      };

      vi.mocked(prisma.savingsGoal.findFirst).mockResolvedValue(mockGoal as any);

      const result = await savingsService.getById('workspace-123', 'goal-123');

      expect(result).not.toBeNull();
      expect(result!.progress).toBe(30); // 1500 / 5000 = 30%
      expect(result!.remainingAmount).toBe(3500);
      expect(result!.contributionCount).toBe(2);
    });

    it('should return null if goal not found', async () => {
      vi.mocked(prisma.savingsGoal.findFirst).mockResolvedValue(null);

      const result = await savingsService.getById('workspace-123', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should calculate 100% progress for completed goals', async () => {
      const mockGoal = {
        ...createMockSavingsGoal({
          currentAmount: { toNumber: () => 5000 } as Prisma.Decimal,
          isCompleted: true,
        }),
        account: null,
        contributions: [],
      };

      vi.mocked(prisma.savingsGoal.findFirst).mockResolvedValue(mockGoal as any);

      const result = await savingsService.getById('workspace-123', 'goal-123');

      expect(result!.progress).toBe(100);
      expect(result!.remainingAmount).toBe(0);
    });

    it('should not return deleted goals', async () => {
      vi.mocked(prisma.savingsGoal.findFirst).mockResolvedValue(null);

      await savingsService.getById('workspace-123', 'deleted-goal');

      expect(prisma.savingsGoal.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          deletedAt: null,
        }),
        include: expect.any(Object),
      });
    });

    it('should calculate projected completion date', async () => {
      const now = new Date();
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const mockGoal = {
        ...createMockSavingsGoal({
          currentAmount: { toNumber: () => 2500 } as Prisma.Decimal,
        }),
        account: null,
        contributions: [
          createMockContribution({ amount: { toNumber: () => 2500 } as Prisma.Decimal, date: oneMonthAgo }),
        ],
      };

      vi.mocked(prisma.savingsGoal.findFirst).mockResolvedValue(mockGoal as any);

      const result = await savingsService.getById('workspace-123', 'goal-123');

      expect(result!.avgMonthlyContribution).not.toBeNull();
      expect(result!.projectedCompletionDate).not.toBeNull();
    });
  });

  // ============================================================================
  // LIST
  // ============================================================================

  describe('list', () => {
    it('should return all active goals with progress', async () => {
      vi.mocked(prisma.savingsGoal.findMany).mockResolvedValue([
        {
          ...createMockSavingsGoal({ id: 'goal-1', name: 'Goal 1' }),
          account: null,
          contributions: [],
        },
        {
          ...createMockSavingsGoal({ id: 'goal-2', name: 'Goal 2' }),
          account: null,
          contributions: [],
        },
      ] as any);

      const result = await savingsService.list('workspace-123');

      expect(result).toHaveLength(2);
      expect(result[0].progress).toBeDefined();
      expect(result[1].progress).toBeDefined();
    });

    it('should exclude completed goals by default', async () => {
      vi.mocked(prisma.savingsGoal.findMany).mockResolvedValue([]);

      await savingsService.list('workspace-123');

      expect(prisma.savingsGoal.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          isCompleted: false,
        }),
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });

    it('should include completed goals when filter is set', async () => {
      vi.mocked(prisma.savingsGoal.findMany).mockResolvedValue([]);

      await savingsService.list('workspace-123', { includeCompleted: true });

      expect(prisma.savingsGoal.findMany).toHaveBeenCalledWith({
        where: expect.not.objectContaining({
          isCompleted: false,
        }),
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });

    it('should exclude deleted goals by default', async () => {
      vi.mocked(prisma.savingsGoal.findMany).mockResolvedValue([]);

      await savingsService.list('workspace-123');

      expect(prisma.savingsGoal.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          deletedAt: null,
        }),
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });

    it('should sort by completion status, target date, then name', async () => {
      vi.mocked(prisma.savingsGoal.findMany).mockResolvedValue([]);

      await savingsService.list('workspace-123');

      expect(prisma.savingsGoal.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        include: expect.any(Object),
        orderBy: [
          { isCompleted: 'asc' },
          { targetDate: 'asc' },
          { name: 'asc' },
        ],
      });
    });
  });

  // ============================================================================
  // UPDATE
  // ============================================================================

  describe('update', () => {
    it('should update savings goal successfully', async () => {
      const input = {
        name: 'Updated Goal Name',
        targetAmount: 6000,
      };

      vi.mocked(prisma.savingsGoal.findFirst)
        .mockResolvedValueOnce(createMockSavingsGoal() as any)
        .mockResolvedValueOnce({
          ...createMockSavingsGoal({ name: 'Updated Goal Name' }),
          account: null,
          contributions: [],
        } as any);

      vi.mocked(prisma.savingsGoal.update).mockResolvedValue(createMockSavingsGoal() as any);

      const result = await savingsService.update('workspace-123', 'goal-123', input);

      expect(prisma.savingsGoal.update).toHaveBeenCalledWith({
        where: { id: 'goal-123' },
        data: input,
      });
      expect(result).not.toBeNull();
    });

    it('should throw NotFoundError if goal does not exist', async () => {
      vi.mocked(prisma.savingsGoal.findFirst).mockResolvedValue(null);

      await expect(
        savingsService.update('workspace-123', 'nonexistent', { name: 'New Name' })
      ).rejects.toThrow();
    });

    it('should validate new account when changing accountId', async () => {
      vi.mocked(prisma.savingsGoal.findFirst).mockResolvedValue(createMockSavingsGoal() as any);
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null);

      await expect(
        savingsService.update('workspace-123', 'goal-123', { accountId: 'new-account' })
      ).rejects.toThrow();
    });

    it('should allow updating target date', async () => {
      const newDate = new Date('2025-12-31');

      vi.mocked(prisma.savingsGoal.findFirst)
        .mockResolvedValueOnce(createMockSavingsGoal() as any)
        .mockResolvedValueOnce({
          ...createMockSavingsGoal({ targetDate: newDate }),
          account: null,
          contributions: [],
        } as any);

      vi.mocked(prisma.savingsGoal.update).mockResolvedValue(createMockSavingsGoal() as any);

      await savingsService.update('workspace-123', 'goal-123', { targetDate: newDate });

      expect(prisma.savingsGoal.update).toHaveBeenCalledWith({
        where: { id: 'goal-123' },
        data: { targetDate: newDate },
      });
    });
  });

  // ============================================================================
  // DELETE
  // ============================================================================

  describe('delete', () => {
    it('should soft delete savings goal', async () => {
      vi.mocked(prisma.savingsGoal.findFirst).mockResolvedValue(createMockSavingsGoal() as any);

      await savingsService.delete('workspace-123', 'goal-123');

      expect(prisma.savingsGoal.update).toHaveBeenCalledWith({
        where: { id: 'goal-123' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundError if goal does not exist', async () => {
      vi.mocked(prisma.savingsGoal.findFirst).mockResolvedValue(null);

      await expect(savingsService.delete('workspace-123', 'nonexistent')).rejects.toThrow();
    });

    it('should not delete already deleted goals', async () => {
      vi.mocked(prisma.savingsGoal.findFirst).mockResolvedValue(null);

      await expect(savingsService.delete('workspace-123', 'already-deleted')).rejects.toThrow();

      expect(prisma.savingsGoal.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          deletedAt: null,
        }),
      });
    });
  });

  // ============================================================================
  // ADD CONTRIBUTION
  // ============================================================================

  describe('addContribution', () => {
    it('should add contribution and update goal amount', async () => {
      const input = {
        amount: 500,
        date: new Date(),
        notes: 'Weekly savings',
      };

      vi.mocked(prisma.savingsGoal.findFirst)
        .mockResolvedValueOnce(createMockSavingsGoal() as any)
        .mockResolvedValueOnce({
          ...createMockSavingsGoal({
            currentAmount: { toNumber: () => 2000 } as Prisma.Decimal,
          }),
          account: null,
          contributions: [createMockContribution()],
        } as any);

      vi.mocked(prisma.$transaction).mockResolvedValue([null, null]);

      const result = await savingsService.addContribution('workspace-123', 'goal-123', input);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).not.toBeNull();
    });

    it('should mark goal as completed when target is reached', async () => {
      const goal = createMockSavingsGoal({
        currentAmount: { toNumber: () => 4500 } as Prisma.Decimal,
      });

      vi.mocked(prisma.savingsGoal.findFirst)
        .mockResolvedValueOnce(goal as any)
        .mockResolvedValueOnce({
          ...goal,
          currentAmount: { toNumber: () => 5000 } as Prisma.Decimal,
          isCompleted: true,
          account: null,
          contributions: [],
        } as any);

      vi.mocked(prisma.$transaction).mockResolvedValue([null, null]);

      const result = await savingsService.addContribution('workspace-123', 'goal-123', {
        amount: 500,
        date: new Date(),
      });

      expect(result.progress).toBe(100);
    });

    it('should throw NotFoundError if goal does not exist', async () => {
      vi.mocked(prisma.savingsGoal.findFirst).mockResolvedValue(null);

      await expect(
        savingsService.addContribution('workspace-123', 'nonexistent', {
          amount: 100,
          date: new Date(),
        })
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // DELETE CONTRIBUTION
  // ============================================================================

  describe('deleteContribution', () => {
    it('should delete contribution and restore goal amount', async () => {
      const contribution = createMockContribution({ amount: { toNumber: () => 500 } as Prisma.Decimal });

      vi.mocked(prisma.savingsGoal.findFirst)
        .mockResolvedValueOnce(createMockSavingsGoal() as any)
        .mockResolvedValueOnce({
          ...createMockSavingsGoal({
            currentAmount: { toNumber: () => 1000 } as Prisma.Decimal,
          }),
          account: null,
          contributions: [],
        } as any);

      vi.mocked(prisma.savingsContribution.findFirst).mockResolvedValue(contribution as any);
      vi.mocked(prisma.$transaction).mockResolvedValue([null, null]);

      const result = await savingsService.deleteContribution('workspace-123', 'goal-123', 'contrib-123');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).not.toBeNull();
    });

    it('should throw NotFoundError if contribution does not exist', async () => {
      vi.mocked(prisma.savingsGoal.findFirst).mockResolvedValue(createMockSavingsGoal() as any);
      vi.mocked(prisma.savingsContribution.findFirst).mockResolvedValue(null);

      await expect(
        savingsService.deleteContribution('workspace-123', 'goal-123', 'nonexistent')
      ).rejects.toThrow();
    });

    it('should reopen completed goal if amount drops below target', async () => {
      const goal = createMockSavingsGoal({
        currentAmount: { toNumber: () => 5000 } as Prisma.Decimal,
        isCompleted: true,
      });

      vi.mocked(prisma.savingsGoal.findFirst)
        .mockResolvedValueOnce(goal as any)
        .mockResolvedValueOnce({
          ...goal,
          currentAmount: { toNumber: () => 4500 } as Prisma.Decimal,
          isCompleted: false,
          account: null,
          contributions: [],
        } as any);

      vi.mocked(prisma.savingsContribution.findFirst).mockResolvedValue(
        createMockContribution({ amount: { toNumber: () => 500 } as Prisma.Decimal }) as any
      );
      vi.mocked(prisma.$transaction).mockResolvedValue([null, null]);

      const result = await savingsService.deleteContribution('workspace-123', 'goal-123', 'contrib-123');

      expect(result.progress).toBeLessThan(100);
    });
  });

  // ============================================================================
  // GET SUMMARY
  // ============================================================================

  describe('getSummary', () => {
    it('should return summary of all savings goals', async () => {
      vi.mocked(prisma.savingsGoal.findMany).mockResolvedValue([
        createMockSavingsGoal({
          targetAmount: { toNumber: () => 5000 } as Prisma.Decimal,
          currentAmount: { toNumber: () => 2500 } as Prisma.Decimal,
          isCompleted: false,
        }),
        createMockSavingsGoal({
          id: 'goal-2',
          targetAmount: { toNumber: () => 1000 } as Prisma.Decimal,
          currentAmount: { toNumber: () => 1000 } as Prisma.Decimal,
          isCompleted: true,
        }),
      ] as any);

      const result = await savingsService.getSummary('workspace-123');

      expect(result.totalGoals).toBe(2);
      expect(result.activeGoals).toBe(1);
      expect(result.completedGoals).toBe(1);
      expect(result.totalTargetAmount).toBe(6000);
      expect(result.totalCurrentAmount).toBe(3500);
      expect(result.totalRemainingAmount).toBe(2500);
      expect(result.overallProgress).toBe(58); // 3500/6000 rounded
    });

    it('should return zero values for empty workspace', async () => {
      vi.mocked(prisma.savingsGoal.findMany).mockResolvedValue([]);

      const result = await savingsService.getSummary('workspace-123');

      expect(result.totalGoals).toBe(0);
      expect(result.overallProgress).toBe(0);
    });

    it('should group goals by currency', async () => {
      vi.mocked(prisma.savingsGoal.findMany).mockResolvedValue([
        createMockSavingsGoal({
          currency: 'EUR',
          targetAmount: { toNumber: () => 1000 } as Prisma.Decimal,
          currentAmount: { toNumber: () => 500 } as Prisma.Decimal,
        }),
        createMockSavingsGoal({
          id: 'goal-2',
          currency: 'USD',
          targetAmount: { toNumber: () => 2000 } as Prisma.Decimal,
          currentAmount: { toNumber: () => 1000 } as Prisma.Decimal,
        }),
      ] as any);

      const result = await savingsService.getSummary('workspace-123');

      expect(result.goalsByCurrency['EUR']).toEqual({ target: 1000, current: 500, count: 1 });
      expect(result.goalsByCurrency['USD']).toEqual({ target: 2000, current: 1000, count: 1 });
    });
  });

  // ============================================================================
  // MARK COMPLETED / REOPEN
  // ============================================================================

  describe('markCompleted', () => {
    it('should mark goal as completed manually', async () => {
      vi.mocked(prisma.savingsGoal.findFirst)
        .mockResolvedValueOnce(createMockSavingsGoal() as any)
        .mockResolvedValueOnce({
          ...createMockSavingsGoal({ isCompleted: true }),
          account: null,
          contributions: [],
        } as any);

      vi.mocked(prisma.savingsGoal.update).mockResolvedValue(createMockSavingsGoal() as any);

      await savingsService.markCompleted('workspace-123', 'goal-123');

      expect(prisma.savingsGoal.update).toHaveBeenCalledWith({
        where: { id: 'goal-123' },
        data: {
          isCompleted: true,
          completedAt: expect.any(Date),
        },
      });
    });
  });

  describe('reopen', () => {
    it('should reopen a completed goal', async () => {
      vi.mocked(prisma.savingsGoal.findFirst)
        .mockResolvedValueOnce(createMockSavingsGoal({ isCompleted: true }) as any)
        .mockResolvedValueOnce({
          ...createMockSavingsGoal({ isCompleted: false }),
          account: null,
          contributions: [],
        } as any);

      vi.mocked(prisma.savingsGoal.update).mockResolvedValue(createMockSavingsGoal() as any);

      await savingsService.reopen('workspace-123', 'goal-123');

      expect(prisma.savingsGoal.update).toHaveBeenCalledWith({
        where: { id: 'goal-123' },
        data: {
          isCompleted: false,
          completedAt: null,
        },
      });
    });
  });
});
