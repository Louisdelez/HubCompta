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
  envelopeMode?: boolean;
  rolloverEnabled?: boolean;
}

export interface BudgetUpdateInput {
  name?: string;
  amount?: number;
  alertThreshold?: number;
  endDate?: Date | null;
  envelopeMode?: boolean;
  rolloverEnabled?: boolean;
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
  // Envelope mode fields
  availableAmount: number; // amount + rollover - spent
  rolloverFromPrevious: number;
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
      transferPairId: null,
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

    const rolloverAmount = budget.rolloverAmount?.toNumber() ?? 0;
    const availableAmount = budget.envelopeMode
      ? budgetAmount + rolloverAmount - spent
      : remaining;

    return {
      ...budget,
      spent,
      remaining,
      percentUsed,
      isOverBudget: spent > budgetAmount,
      isAlertTriggered: percentUsed >= budget.alertThreshold,
      availableAmount,
      rolloverFromPrevious: rolloverAmount,
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

      const rolloverAmount = budget.rolloverAmount?.toNumber() ?? 0;
      const availableAmount = budget.envelopeMode
        ? budgetAmount + rolloverAmount - spent
        : remaining;

      budgetsWithProgress.push({
        ...budget,
        spent,
        remaining,
        percentUsed,
        isOverBudget: spent > budgetAmount,
        isAlertTriggered: percentUsed >= budget.alertThreshold,
        availableAmount,
        rolloverFromPrevious: rolloverAmount,
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

  /**
   * Calculate rollover amount for a budget based on previous month's remaining balance
   */
  async calculateRollover(
    workspaceId: string,
    budgetId: string
  ): Promise<{ rolloverAmount: number; previousSpent: number; previousBudget: number }> {
    const budget = await prisma.budget.findFirst({
      where: { id: budgetId, workspaceId },
    });

    if (!budget) {
      throw new NotFoundError('Budget', budgetId);
    }

    if (budget.period !== 'monthly') {
      return { rolloverAmount: 0, previousSpent: 0, previousBudget: budget.amount.toNumber() };
    }

    const now = new Date();
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const previousSpent = await calculateCategorySpending(
      workspaceId,
      budget.categoryId,
      previousMonthStart,
      previousMonthEnd
    );

    const budgetAmount = budget.amount.toNumber();
    const rolloverAmount = Math.max(0, budgetAmount - previousSpent);

    return { rolloverAmount, previousSpent, previousBudget: budgetAmount };
  },

  /**
   * Process month-end rollover for all envelope budgets in workspace
   */
  async processMonthEndRollover(workspaceId: string): Promise<{ processed: number; updated: number }> {
    const budgets = await prisma.budget.findMany({
      where: {
        workspaceId,
        envelopeMode: true,
        rolloverEnabled: true,
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
    });

    let updated = 0;

    for (const budget of budgets) {
      const { rolloverAmount } = await this.calculateRollover(workspaceId, budget.id);

      if (rolloverAmount > 0) {
        await prisma.budget.update({
          where: { id: budget.id },
          data: { rolloverAmount },
        });
        updated++;
      }
    }

    return { processed: budgets.length, updated };
  },

  /**
   * Get envelope status summary for all envelope budgets
   */
  async getEnvelopeStatus(workspaceId: string): Promise<{
    totalEnvelopes: number;
    totalAvailable: number;
    totalSpent: number;
    envelopes: Array<{
      id: string;
      name: string;
      categoryName: string;
      budgetAmount: number;
      rolloverAmount: number;
      spent: number;
      available: number;
    }>;
  }> {
    const budgets = await this.list(workspaceId);
    const envelopeBudgets = budgets.filter((b) => b.envelopeMode);

    const envelopes = envelopeBudgets.map((b) => ({
      id: b.id,
      name: b.name,
      categoryName: b.category.name,
      budgetAmount: b.amount.toNumber(),
      rolloverAmount: b.rolloverFromPrevious,
      spent: b.spent,
      available: b.availableAmount,
    }));

    return {
      totalEnvelopes: envelopes.length,
      totalAvailable: envelopes.reduce((sum, e) => sum + e.available, 0),
      totalSpent: envelopes.reduce((sum, e) => sum + e.spent, 0),
      envelopes,
    };
  },

  /**
   * Reallocate funds between envelope budgets
   */
  async reallocateEnvelope(
    workspaceId: string,
    fromBudgetId: string,
    toBudgetId: string,
    amount: number
  ): Promise<{ from: BudgetWithProgress; to: BudgetWithProgress }> {
    const fromBudget = await prisma.budget.findFirst({
      where: { id: fromBudgetId, workspaceId, envelopeMode: true },
    });

    const toBudget = await prisma.budget.findFirst({
      where: { id: toBudgetId, workspaceId, envelopeMode: true },
    });

    if (!fromBudget) {
      throw new NotFoundError('Budget', fromBudgetId);
    }
    if (!toBudget) {
      throw new NotFoundError('Budget', toBudgetId);
    }

    // Update both budgets
    await prisma.$transaction([
      prisma.budget.update({
        where: { id: fromBudgetId },
        data: { rolloverAmount: { decrement: amount } },
      }),
      prisma.budget.update({
        where: { id: toBudgetId },
        data: { rolloverAmount: { increment: amount } },
      }),
    ]);

    const [from, to] = await Promise.all([
      this.getById(workspaceId, fromBudgetId),
      this.getById(workspaceId, toBudgetId),
    ]);

    return { from: from!, to: to! };
  },
};

export default budgetService;
