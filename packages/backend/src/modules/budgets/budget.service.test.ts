// ============================================================================
// BUDGET SERVICE TESTS - Finance Hub
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BudgetPeriod, Prisma } from '@prisma/client';

// Mock error handler first (to avoid Sentry import issue)
vi.mock('@/core/middleware/errorHandler.js', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(resource: string, id?: string) {
      super(id ? `${resource} with ID ${id} not found` : `${resource} not found`);
      this.name = 'NotFoundError';
    }
  },
  ConflictError: class ConflictError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ConflictError';
    }
  },
}));

// Mock Prisma client
vi.mock('@/core/database/client.js', () => ({
  prisma: {
    budget: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    transaction: {
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/core/database/client.js';
import { budgetService } from './budget.service.js';

// Helper to create mock budget data
const createMockBudget = (overrides = {}) => ({
  id: 'budget-123',
  workspaceId: 'workspace-123',
  categoryId: 'category-123',
  name: 'Food Budget',
  amount: { toNumber: () => 500 } as Prisma.Decimal,
  period: 'monthly' as BudgetPeriod,
  alertThreshold: 80,
  startDate: new Date('2024-01-01'),
  endDate: null,
  envelopeMode: false,
  rolloverEnabled: false,
  rolloverAmount: { toNumber: () => 0 } as Prisma.Decimal,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

const createMockCategory = (overrides = {}) => ({
  id: 'category-123',
  workspaceId: 'workspace-123',
  name: 'Food',
  icon: '🍔',
  color: '#FF5722',
  parentId: null,
  ...overrides,
});

describe('BudgetService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // CREATE
  // ============================================================================

  describe('create', () => {
    it('should create a budget successfully', async () => {
      const workspaceId = 'workspace-123';
      const input = {
        categoryId: 'category-123',
        name: 'Food Budget',
        amount: 500,
        period: 'monthly' as BudgetPeriod,
        startDate: new Date('2024-01-01'),
        alertThreshold: 80,
      };

      vi.mocked(prisma.category.findFirst).mockResolvedValue(createMockCategory() as any);
      vi.mocked(prisma.budget.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.budget.create).mockResolvedValue(createMockBudget() as any);

      const result = await budgetService.create(workspaceId, input);

      expect(result.name).toBe('Food Budget');
      expect(prisma.budget.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId,
          categoryId: input.categoryId,
          name: input.name,
          amount: input.amount,
          period: input.period,
        }),
      });
    });

    it('should throw NotFoundError if category does not exist', async () => {
      vi.mocked(prisma.category.findFirst).mockResolvedValue(null);

      await expect(
        budgetService.create('workspace-123', {
          categoryId: 'nonexistent',
          name: 'Budget',
          amount: 500,
          period: 'monthly',
          startDate: new Date(),
        })
      ).rejects.toThrow();
    });

    it('should throw ConflictError if budget already exists for category and period', async () => {
      vi.mocked(prisma.category.findFirst).mockResolvedValue(createMockCategory() as any);
      vi.mocked(prisma.budget.findFirst).mockResolvedValue(createMockBudget() as any);

      await expect(
        budgetService.create('workspace-123', {
          categoryId: 'category-123',
          name: 'Duplicate Budget',
          amount: 500,
          period: 'monthly',
          startDate: new Date(),
        })
      ).rejects.toThrow();
    });

    it('should set default alert threshold to 80', async () => {
      vi.mocked(prisma.category.findFirst).mockResolvedValue(createMockCategory() as any);
      vi.mocked(prisma.budget.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.budget.create).mockResolvedValue(createMockBudget() as any);

      await budgetService.create('workspace-123', {
        categoryId: 'category-123',
        name: 'Budget',
        amount: 500,
        period: 'monthly',
        startDate: new Date(),
      });

      expect(prisma.budget.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          alertThreshold: 80,
        }),
      });
    });

    it('should allow yearly period', async () => {
      vi.mocked(prisma.category.findFirst).mockResolvedValue(createMockCategory() as any);
      vi.mocked(prisma.budget.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.budget.create).mockResolvedValue(
        createMockBudget({ period: 'yearly' }) as any
      );

      const result = await budgetService.create('workspace-123', {
        categoryId: 'category-123',
        name: 'Annual Budget',
        amount: 6000,
        period: 'yearly',
        startDate: new Date(),
      });

      expect(result.period).toBe('yearly');
    });
  });

  // ============================================================================
  // GET BY ID WITH PROGRESS
  // ============================================================================

  describe('getById', () => {
    it('should return budget with spending progress', async () => {
      const mockBudget = {
        ...createMockBudget(),
        category: { id: 'category-123', name: 'Food', icon: '🍔', color: '#FF5722' },
      };

      vi.mocked(prisma.budget.findFirst).mockResolvedValue(mockBudget as any);
      vi.mocked(prisma.category.findMany).mockResolvedValue([createMockCategory()] as any);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => -200 } as Prisma.Decimal },
      } as any);

      const result = await budgetService.getById('workspace-123', 'budget-123');

      expect(result).not.toBeNull();
      expect(result!.spent).toBe(200);
      expect(result!.remaining).toBe(300);
      expect(result!.percentUsed).toBe(40);
      expect(result!.isOverBudget).toBe(false);
    });

    it('should return null if budget not found', async () => {
      vi.mocked(prisma.budget.findFirst).mockResolvedValue(null);

      const result = await budgetService.getById('workspace-123', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should detect over budget condition', async () => {
      const mockBudget = {
        ...createMockBudget({ amount: { toNumber: () => 100 } as Prisma.Decimal }),
        category: { id: 'category-123', name: 'Food', icon: '🍔', color: '#FF5722' },
      };

      vi.mocked(prisma.budget.findFirst).mockResolvedValue(mockBudget as any);
      vi.mocked(prisma.category.findMany).mockResolvedValue([createMockCategory()] as any);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => -150 } as Prisma.Decimal },
      } as any);

      const result = await budgetService.getById('workspace-123', 'budget-123');

      expect(result!.isOverBudget).toBe(true);
      expect(result!.percentUsed).toBe(150);
      expect(result!.remaining).toBe(0);
    });

    it('should detect alert threshold trigger', async () => {
      const mockBudget = {
        ...createMockBudget({ alertThreshold: 80 }),
        category: { id: 'category-123', name: 'Food', icon: '🍔', color: '#FF5722' },
      };

      vi.mocked(prisma.budget.findFirst).mockResolvedValue(mockBudget as any);
      vi.mocked(prisma.category.findMany).mockResolvedValue([createMockCategory()] as any);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => -420 } as Prisma.Decimal },
      } as any);

      const result = await budgetService.getById('workspace-123', 'budget-123');

      expect(result!.isAlertTriggered).toBe(true);
      expect(result!.percentUsed).toBe(84);
    });

    it('should calculate envelope mode available amount', async () => {
      const mockBudget = {
        ...createMockBudget({
          envelopeMode: true,
          rolloverAmount: { toNumber: () => 100 } as Prisma.Decimal,
        }),
        category: { id: 'category-123', name: 'Food', icon: '🍔', color: '#FF5722' },
      };

      vi.mocked(prisma.budget.findFirst).mockResolvedValue(mockBudget as any);
      vi.mocked(prisma.category.findMany).mockResolvedValue([createMockCategory()] as any);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => -200 } as Prisma.Decimal },
      } as any);

      const result = await budgetService.getById('workspace-123', 'budget-123');

      expect(result!.rolloverFromPrevious).toBe(100);
      expect(result!.availableAmount).toBe(400); // 500 + 100 - 200
    });

    it('should include child category spending in calculations', async () => {
      const mockBudget = {
        ...createMockBudget(),
        category: { id: 'category-123', name: 'Food', icon: '🍔', color: '#FF5722' },
      };

      vi.mocked(prisma.budget.findFirst).mockResolvedValue(mockBudget as any);
      vi.mocked(prisma.category.findMany).mockResolvedValue([
        createMockCategory(),
        createMockCategory({ id: 'child-cat', parentId: 'category-123' }),
      ] as any);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => -300 } as Prisma.Decimal },
      } as any);

      await budgetService.getById('workspace-123', 'budget-123');

      expect(prisma.transaction.aggregate).toHaveBeenCalledWith({
        where: expect.objectContaining({
          categoryId: { in: ['category-123', 'child-cat'] },
        }),
        _sum: { amount: true },
      });
    });
  });

  // ============================================================================
  // LIST
  // ============================================================================

  describe('list', () => {
    it('should return all active budgets with progress', async () => {
      const mockBudgets = [
        {
          ...createMockBudget({ id: 'budget-1', name: 'Food' }),
          category: { id: 'cat-1', name: 'Food', icon: '🍔', color: '#FF5722' },
        },
        {
          ...createMockBudget({ id: 'budget-2', name: 'Transport' }),
          category: { id: 'cat-2', name: 'Transport', icon: '🚗', color: '#2196F3' },
        },
      ];

      vi.mocked(prisma.budget.findMany).mockResolvedValue(mockBudgets as any);
      vi.mocked(prisma.category.findMany).mockResolvedValue([createMockCategory()] as any);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => -100 } as Prisma.Decimal },
      } as any);

      const result = await budgetService.list('workspace-123');

      expect(result).toHaveLength(2);
      expect(result[0].spent).toBeDefined();
      expect(result[0].percentUsed).toBeDefined();
    });

    it('should exclude expired budgets', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([]);

      await budgetService.list('workspace-123');

      expect(prisma.budget.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: [
            { endDate: null },
            { endDate: { gte: expect.any(Date) } },
          ],
        }),
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });

    it('should sort by period then name', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([]);

      await budgetService.list('workspace-123');

      expect(prisma.budget.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        include: expect.any(Object),
        orderBy: [{ period: 'asc' }, { name: 'asc' }],
      });
    });
  });

  // ============================================================================
  // UPDATE
  // ============================================================================

  describe('update', () => {
    it('should update budget successfully', async () => {
      const input = { name: 'Updated Budget', amount: 600 };

      vi.mocked(prisma.budget.findFirst).mockResolvedValue(createMockBudget() as any);
      vi.mocked(prisma.budget.update).mockResolvedValue({
        ...createMockBudget(),
        name: 'Updated Budget',
        amount: { toNumber: () => 600 } as Prisma.Decimal,
      } as any);

      const result = await budgetService.update('workspace-123', 'budget-123', input);

      expect(result.name).toBe('Updated Budget');
      expect(prisma.budget.update).toHaveBeenCalledWith({
        where: { id: 'budget-123' },
        data: input,
      });
    });

    it('should throw NotFoundError if budget does not exist', async () => {
      vi.mocked(prisma.budget.findFirst).mockResolvedValue(null);

      await expect(
        budgetService.update('workspace-123', 'nonexistent', { name: 'New Name' })
      ).rejects.toThrow();
    });

    it('should allow updating alert threshold', async () => {
      vi.mocked(prisma.budget.findFirst).mockResolvedValue(createMockBudget() as any);
      vi.mocked(prisma.budget.update).mockResolvedValue(createMockBudget() as any);

      await budgetService.update('workspace-123', 'budget-123', { alertThreshold: 90 });

      expect(prisma.budget.update).toHaveBeenCalledWith({
        where: { id: 'budget-123' },
        data: { alertThreshold: 90 },
      });
    });

    it('should allow enabling envelope mode', async () => {
      vi.mocked(prisma.budget.findFirst).mockResolvedValue(createMockBudget() as any);
      vi.mocked(prisma.budget.update).mockResolvedValue(
        createMockBudget({ envelopeMode: true }) as any
      );

      await budgetService.update('workspace-123', 'budget-123', { envelopeMode: true });

      expect(prisma.budget.update).toHaveBeenCalledWith({
        where: { id: 'budget-123' },
        data: { envelopeMode: true },
      });
    });
  });

  // ============================================================================
  // DELETE
  // ============================================================================

  describe('delete', () => {
    it('should delete budget', async () => {
      vi.mocked(prisma.budget.findFirst).mockResolvedValue(createMockBudget() as any);

      await budgetService.delete('workspace-123', 'budget-123');

      expect(prisma.budget.delete).toHaveBeenCalledWith({
        where: { id: 'budget-123' },
      });
    });

    it('should throw NotFoundError if budget does not exist', async () => {
      vi.mocked(prisma.budget.findFirst).mockResolvedValue(null);

      await expect(budgetService.delete('workspace-123', 'nonexistent')).rejects.toThrow();
    });
  });

  // ============================================================================
  // GET HISTORY
  // ============================================================================

  describe('getHistory', () => {
    it('should return budget history for past periods', async () => {
      vi.mocked(prisma.budget.findFirst).mockResolvedValue(createMockBudget() as any);
      vi.mocked(prisma.category.findMany).mockResolvedValue([createMockCategory()] as any);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => -300 } as Prisma.Decimal },
      } as any);

      const result = await budgetService.getHistory('workspace-123', 'budget-123', 3);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('period');
      expect(result[0]).toHaveProperty('budgeted');
      expect(result[0]).toHaveProperty('spent');
      expect(result[0]).toHaveProperty('percentUsed');
    });

    it('should throw NotFoundError if budget does not exist', async () => {
      vi.mocked(prisma.budget.findFirst).mockResolvedValue(null);

      await expect(
        budgetService.getHistory('workspace-123', 'nonexistent')
      ).rejects.toThrow();
    });

    it('should skip periods before budget start date', async () => {
      const recentBudget = createMockBudget({
        startDate: new Date(), // Today
      });

      vi.mocked(prisma.budget.findFirst).mockResolvedValue(recentBudget as any);
      vi.mocked(prisma.category.findMany).mockResolvedValue([createMockCategory()] as any);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => 0 } as Prisma.Decimal },
      } as any);

      const result = await budgetService.getHistory('workspace-123', 'budget-123', 6);

      // Should have fewer entries since budget just started
      expect(result.length).toBeLessThanOrEqual(6);
    });
  });

  // ============================================================================
  // GET SUMMARY
  // ============================================================================

  describe('getSummary', () => {
    it('should return summary stats for all budgets', async () => {
      const mockBudgets = [
        {
          ...createMockBudget({ amount: { toNumber: () => 500 } as Prisma.Decimal }),
          category: { id: 'cat-1', name: 'Food', icon: '🍔', color: '#FF5722' },
        },
        {
          ...createMockBudget({
            id: 'budget-2',
            amount: { toNumber: () => 300 } as Prisma.Decimal,
          }),
          category: { id: 'cat-2', name: 'Transport', icon: '🚗', color: '#2196F3' },
        },
      ];

      vi.mocked(prisma.budget.findMany).mockResolvedValue(mockBudgets as any);
      vi.mocked(prisma.category.findMany).mockResolvedValue([createMockCategory()] as any);
      vi.mocked(prisma.transaction.aggregate)
        .mockResolvedValueOnce({ _sum: { amount: { toNumber: () => -600 } as Prisma.Decimal } } as any) // Over budget
        .mockResolvedValueOnce({ _sum: { amount: { toNumber: () => -250 } as Prisma.Decimal } } as any); // Alert triggered

      const result = await budgetService.getSummary('workspace-123');

      expect(result.total).toBe(2);
      expect(result.totalBudgeted).toBe(800);
      expect(result.totalSpent).toBeGreaterThan(0);
      expect(result.overBudgetCount).toBeGreaterThanOrEqual(0);
    });

    it('should return zero values for empty workspace', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([]);

      const result = await budgetService.getSummary('workspace-123');

      expect(result.total).toBe(0);
      expect(result.totalBudgeted).toBe(0);
      expect(result.totalSpent).toBe(0);
    });
  });

  // ============================================================================
  // ROLLOVER CALCULATIONS
  // ============================================================================

  describe('calculateRollover', () => {
    it('should calculate rollover amount from previous month', async () => {
      vi.mocked(prisma.budget.findFirst).mockResolvedValue(
        createMockBudget({ amount: { toNumber: () => 500 } as Prisma.Decimal }) as any
      );
      vi.mocked(prisma.category.findMany).mockResolvedValue([createMockCategory()] as any);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => -300 } as Prisma.Decimal },
      } as any);

      const result = await budgetService.calculateRollover('workspace-123', 'budget-123');

      expect(result.rolloverAmount).toBe(200); // 500 - 300
      expect(result.previousSpent).toBe(300);
      expect(result.previousBudget).toBe(500);
    });

    it('should return zero rollover for yearly budgets', async () => {
      vi.mocked(prisma.budget.findFirst).mockResolvedValue(
        createMockBudget({ period: 'yearly' }) as any
      );

      const result = await budgetService.calculateRollover('workspace-123', 'budget-123');

      expect(result.rolloverAmount).toBe(0);
    });

    it('should throw NotFoundError if budget does not exist', async () => {
      vi.mocked(prisma.budget.findFirst).mockResolvedValue(null);

      await expect(
        budgetService.calculateRollover('workspace-123', 'nonexistent')
      ).rejects.toThrow();
    });

    it('should not allow negative rollover', async () => {
      vi.mocked(prisma.budget.findFirst).mockResolvedValue(
        createMockBudget({ amount: { toNumber: () => 500 } as Prisma.Decimal }) as any
      );
      vi.mocked(prisma.category.findMany).mockResolvedValue([createMockCategory()] as any);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => -700 } as Prisma.Decimal },
      } as any);

      const result = await budgetService.calculateRollover('workspace-123', 'budget-123');

      expect(result.rolloverAmount).toBe(0);
    });
  });

  // ============================================================================
  // ENVELOPE OPERATIONS
  // ============================================================================

  describe('reallocateEnvelope', () => {
    it('should reallocate funds between envelope budgets', async () => {
      const fromBudget = createMockBudget({ id: 'from-budget', envelopeMode: true });
      const toBudget = createMockBudget({ id: 'to-budget', envelopeMode: true });

      vi.mocked(prisma.budget.findFirst)
        .mockResolvedValueOnce(fromBudget as any)
        .mockResolvedValueOnce(toBudget as any);

      vi.mocked(prisma.$transaction).mockResolvedValue([null, null]);

      // Mock getById for the returned budgets
      const originalGetById = budgetService.getById;
      vi.spyOn(budgetService, 'getById').mockImplementation(async (workspaceId, budgetId) => {
        const mockResult = {
          ...createMockBudget({ id: budgetId }),
          category: { id: 'cat-1', name: 'Food', icon: '🍔', color: '#FF5722' },
          spent: 0,
          remaining: 500,
          percentUsed: 0,
          isOverBudget: false,
          isAlertTriggered: false,
          availableAmount: 500,
          rolloverFromPrevious: 0,
        };
        return mockResult as any;
      });

      const result = await budgetService.reallocateEnvelope(
        'workspace-123',
        'from-budget',
        'to-budget',
        100
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.from).toBeDefined();
      expect(result.to).toBeDefined();

      // Restore
      vi.mocked(budgetService.getById).mockRestore();
    });

    it('should throw NotFoundError if from budget is not envelope mode', async () => {
      vi.mocked(prisma.budget.findFirst).mockResolvedValue(null);

      await expect(
        budgetService.reallocateEnvelope('workspace-123', 'regular-budget', 'to-budget', 100)
      ).rejects.toThrow();
    });

    it('should throw NotFoundError if to budget is not envelope mode', async () => {
      vi.mocked(prisma.budget.findFirst)
        .mockResolvedValueOnce(createMockBudget({ envelopeMode: true }) as any)
        .mockResolvedValueOnce(null);

      await expect(
        budgetService.reallocateEnvelope('workspace-123', 'from-budget', 'regular-budget', 100)
      ).rejects.toThrow();
    });
  });

  describe('getEnvelopeStatus', () => {
    it('should return envelope status summary', async () => {
      const mockBudgets = [
        {
          ...createMockBudget({
            envelopeMode: true,
            rolloverAmount: { toNumber: () => 50 } as Prisma.Decimal,
          }),
          category: { id: 'cat-1', name: 'Food', icon: '🍔', color: '#FF5722' },
        },
      ];

      vi.mocked(prisma.budget.findMany).mockResolvedValue(mockBudgets as any);
      vi.mocked(prisma.category.findMany).mockResolvedValue([createMockCategory()] as any);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => -200 } as Prisma.Decimal },
      } as any);

      const result = await budgetService.getEnvelopeStatus('workspace-123');

      expect(result.totalEnvelopes).toBe(1);
      expect(result.envelopes).toHaveLength(1);
      expect(result.envelopes[0]).toHaveProperty('budgetAmount');
      expect(result.envelopes[0]).toHaveProperty('rolloverAmount');
      expect(result.envelopes[0]).toHaveProperty('available');
    });

    it('should return empty for workspace without envelope budgets', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([]);

      const result = await budgetService.getEnvelopeStatus('workspace-123');

      expect(result.totalEnvelopes).toBe(0);
      expect(result.envelopes).toHaveLength(0);
    });
  });
});
