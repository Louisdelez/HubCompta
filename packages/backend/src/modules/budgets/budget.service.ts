// ============================================================================
// BUDGET SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError, ConflictError } from '@/core/middleware/errorHandler.js';
import type { Budget, BudgetPeriod } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface BudgetCreateInput {
  categoryId: string;
  name: string;
  amount: number;
  period: BudgetPeriod;
  alertThreshold?: number;
  startDate: Date;
  endDate?: Date;
}

export interface BudgetUpdateInput {
  name?: string;
  amount?: number;
  alertThreshold?: number;
  endDate?: Date | null;
}

export interface BudgetWithProgress extends Budget {
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  };
  spent: number;
  remaining: number;
  percentUsed: number;
  isOverBudget: boolean;
  isAlertTriggered: boolean;
}

export interface BudgetPeriodDates {
  startDate: Date;
  endDate: Date;
}

export interface BudgetHistoryEntry {
  period: string;
  budgeted: number;
  spent: number;
  percentUsed: number;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Get current period dates based on budget period type
 */
function getCurrentPeriodDates(period: BudgetPeriod, startDate: Date): BudgetPeriodDates {
  const now = new Date();

  if (period === 'monthly') {
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Ensure we don't go before the budget's start date
    return {
      startDate: periodStart < startDate ? startDate : periodStart,
      endDate: periodEnd,
    };
  }

  // Yearly
  const periodStart = new Date(now.getFullYear(), 0, 1);
  const periodEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

  return {
    startDate: periodStart < startDate ? startDate : periodStart,
    endDate: periodEnd,
  };
}

/**
 * Calculate spending for a category in a period
 */
async function calculateCategorySpending(
  workspaceId: string,
  categoryId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  // Get all child categories too
  const categories = await prisma.category.findMany({
    where: {
      workspaceId,
      OR: [
        { id: categoryId },
        { parentId: categoryId },
      ],
    },
    select: { id: true },
  });

  const categoryIds = categories.map((c) => c.id);

  const result = await prisma.transaction.aggregate({
    where: {
      workspaceId,
      categoryId: { in: categoryIds },
      deletedAt: null,
      date: {
        gte: startDate,
        lte: endDate,
      },
      amount: { lt: 0 }, // Only expenses
      isTransfer: false,
    },
    _sum: { amount: true },
  });

  return Math.abs(result._sum.amount?.toNumber() ?? 0);
}

// ----------------------------------------------------------------------------
// Budget Service
// ----------------------------------------------------------------------------

export const budgetService = {
  /**
   * Create a new budget
   */
  async create(workspaceId: string, input: BudgetCreateInput): Promise<Budget> {
    // Verify category exists
    const category = await prisma.category.findFirst({
      where: {
        id: input.categoryId,
        workspaceId,
      },
    });

    if (!category) {
      throw new NotFoundError('Category', input.categoryId);
    }

    // Check for duplicate budget on same category and period
    const existing = await prisma.budget.findFirst({
      where: {
        workspaceId,
        categoryId: input.categoryId,
        period: input.period,
        OR: [
          { endDate: null },
          { endDate: { gte: new Date() } },
        ],
      },
    });

    if (existing) {
      throw new ConflictError('Un budget actif existe déjà pour cette catégorie et période');
    }

    return prisma.budget.create({
      data: {
        workspaceId,
        categoryId: input.categoryId,
        name: input.name,
        amount: input.amount,
        period: input.period,
        alertThreshold: input.alertThreshold ?? 80,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    });
  },

  /**
   * Get budget by ID with progress
   */
  async getById(workspaceId: string, budgetId: string): Promise<BudgetWithProgress | null> {
    const budget = await prisma.budget.findFirst({
      where: {
        id: budgetId,
        workspaceId,
      },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
      },
    });

    if (!budget) return null;

    const periodDates = getCurrentPeriodDates(budget.period, budget.startDate);
    const spent = await calculateCategorySpending(
      workspaceId,
      budget.categoryId,
      periodDates.startDate,
      periodDates.endDate
    );

    const budgetAmount = budget.amount.toNumber();
    const remaining = Math.max(0, budgetAmount - spent);
    const percentUsed = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;

    return {
      ...budget,
      spent,
      remaining,
      percentUsed,
      isOverBudget: spent > budgetAmount,
      isAlertTriggered: percentUsed >= budget.alertThreshold,
    };
  },

  /**
   * List all budgets for a workspace with progress
   */
  async list(workspaceId: string): Promise<BudgetWithProgress[]> {
    const budgets = await prisma.budget.findMany({
      where: {
        workspaceId,
        OR: [
          { endDate: null },
          { endDate: { gte: new Date() } },
        ],
      },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
      },
      orderBy: [{ period: 'asc' }, { name: 'asc' }],
    });

    const budgetsWithProgress: BudgetWithProgress[] = [];

    for (const budget of budgets) {
      const periodDates = getCurrentPeriodDates(budget.period, budget.startDate);
      const spent = await calculateCategorySpending(
        workspaceId,
        budget.categoryId,
        periodDates.startDate,
        periodDates.endDate
      );

      const budgetAmount = budget.amount.toNumber();
      const remaining = Math.max(0, budgetAmount - spent);
      const percentUsed = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;

      budgetsWithProgress.push({
        ...budget,
        spent,
        remaining,
        percentUsed,
        isOverBudget: spent > budgetAmount,
        isAlertTriggered: percentUsed >= budget.alertThreshold,
      });
    }

    return budgetsWithProgress;
  },

  /**
   * Update budget
   */
  async update(
    workspaceId: string,
    budgetId: string,
    input: BudgetUpdateInput
  ): Promise<Budget> {
    const budget = await prisma.budget.findFirst({
      where: {
        id: budgetId,
        workspaceId,
      },
    });

    if (!budget) {
      throw new NotFoundError('Budget', budgetId);
    }

    return prisma.budget.update({
      where: { id: budgetId },
      data: input,
    });
  },

  /**
   * Delete budget
   */
  async delete(workspaceId: string, budgetId: string): Promise<void> {
    const budget = await prisma.budget.findFirst({
      where: {
        id: budgetId,
        workspaceId,
      },
    });

    if (!budget) {
      throw new NotFoundError('Budget', budgetId);
    }

    await prisma.budget.delete({
      where: { id: budgetId },
    });
  },

  /**
   * Get budget history for past periods
   */
  async getHistory(
    workspaceId: string,
    budgetId: string,
    months: number = 6
  ): Promise<BudgetHistoryEntry[]> {
    const budget = await prisma.budget.findFirst({
      where: {
        id: budgetId,
        workspaceId,
      },
    });

    if (!budget) {
      throw new NotFoundError('Budget', budgetId);
    }

    const history: BudgetHistoryEntry[] = [];
    const now = new Date();
    const budgetAmount = budget.amount.toNumber();

    for (let i = months - 1; i >= 0; i--) {
      let periodStart: Date;
      let periodEnd: Date;
      let periodLabel: string;

      if (budget.period === 'monthly') {
        periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
        periodLabel = periodStart.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      } else {
        // Yearly - go back by years
        periodStart = new Date(now.getFullYear() - i, 0, 1);
        periodEnd = new Date(now.getFullYear() - i, 11, 31, 23, 59, 59, 999);
        periodLabel = periodStart.getFullYear().toString();
      }

      // Skip periods before budget start
      if (periodEnd < budget.startDate) continue;

      const spent = await calculateCategorySpending(
        workspaceId,
        budget.categoryId,
        periodStart < budget.startDate ? budget.startDate : periodStart,
        periodEnd
      );

      history.push({
        period: periodLabel,
        budgeted: budgetAmount,
        spent,
        percentUsed: budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0,
      });
    }

    return history;
  },

  /**
   * Get summary stats for all budgets
   */
  async getSummary(workspaceId: string): Promise<{
    total: number;
    totalBudgeted: number;
    totalSpent: number;
    overBudgetCount: number;
    alertCount: number;
  }> {
    const budgets = await this.list(workspaceId);

    return {
      total: budgets.length,
      totalBudgeted: budgets.reduce((sum, b) => sum + b.amount.toNumber(), 0),
      totalSpent: budgets.reduce((sum, b) => sum + b.spent, 0),
      overBudgetCount: budgets.filter((b) => b.isOverBudget).length,
      alertCount: budgets.filter((b) => b.isAlertTriggered && !b.isOverBudget).length,
    };
  },
};

export default budgetService;
