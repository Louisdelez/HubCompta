// ============================================================================
// SAVINGS SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError } from '@/core/middleware/errorHandler.js';
import type { SavingsGoal, SavingsContribution, Prisma } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface SavingsGoalCreateInput {
  name: string;
  targetAmount: number;
  currency?: string;
  targetDate?: Date | null;
  icon?: string | null;
  color?: string | null;
  accountId?: string | null;
}

export interface SavingsGoalUpdateInput {
  name?: string;
  targetAmount?: number;
  targetDate?: Date | null;
  icon?: string | null;
  color?: string | null;
  accountId?: string | null;
}

export interface SavingsContributionInput {
  amount: number;
  date: Date;
  notes?: string | null;
  transactionId?: string | null;
}

export interface SavingsGoalWithProgress extends Omit<SavingsGoal, 'targetAmount' | 'currentAmount'> {
  targetAmount: number;
  currentAmount: number;
  account: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  contributions: Array<Omit<SavingsContribution, 'amount'> & { amount: number }>;
  contributionCount: number;
  progress: number; // 0-100
  remainingAmount: number;
  avgMonthlyContribution: number | null;
  projectedCompletionDate: Date | null;
  daysUntilTarget: number | null;
  isOnTrack: boolean | null;
}

export interface SavingsGoalFilters {
  includeDeleted?: boolean;
  includeCompleted?: boolean;
}

export interface SavingsSummary {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  totalTargetAmount: number;
  totalCurrentAmount: number;
  totalRemainingAmount: number;
  overallProgress: number;
  goalsByCurrency: Record<string, { target: number; current: number; count: number }>;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function convertDecimalsToNumber(goal: SavingsGoal) {
  return {
    ...goal,
    targetAmount: goal.targetAmount.toNumber(),
    currentAmount: goal.currentAmount.toNumber(),
  };
}

function convertContributionDecimalsToNumber(contribution: SavingsContribution) {
  return {
    ...contribution,
    amount: contribution.amount.toNumber(),
  };
}

/**
 * Calculate the projected completion date based on average contributions
 */
function calculateProjectedCompletion(
  currentAmount: number,
  targetAmount: number,
  contributions: Array<{ amount: number; date: Date }>
): { projectedDate: Date | null; avgMonthlyContribution: number | null } {
  if (contributions.length === 0 || currentAmount >= targetAmount) {
    return { projectedDate: null, avgMonthlyContribution: null };
  }

  // Calculate the time span of contributions
  const dates = contributions.map(c => new Date(c.date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const monthsSpan = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24 * 30));

  // Calculate total contributions
  const totalContributions = contributions.reduce((sum, c) => sum + c.amount, 0);
  const avgMonthlyContribution = totalContributions / monthsSpan;

  if (avgMonthlyContribution <= 0) {
    return { projectedDate: null, avgMonthlyContribution: null };
  }

  // Calculate remaining amount and months needed
  const remainingAmount = targetAmount - currentAmount;
  const monthsNeeded = remainingAmount / avgMonthlyContribution;

  // Calculate projected date
  const projectedDate = new Date();
  projectedDate.setMonth(projectedDate.getMonth() + Math.ceil(monthsNeeded));

  return { projectedDate, avgMonthlyContribution };
}

/**
 * Check if goal is on track to meet target date
 */
function checkOnTrack(
  currentAmount: number,
  targetAmount: number,
  targetDate: Date | null,
  projectedDate: Date | null
): boolean | null {
  if (!targetDate || !projectedDate) {
    return null;
  }

  return projectedDate <= targetDate;
}

// ----------------------------------------------------------------------------
// Savings Service
// ----------------------------------------------------------------------------

export const savingsService = {
  /**
   * Create a new savings goal
   */
  async create(workspaceId: string, input: SavingsGoalCreateInput): Promise<SavingsGoalWithProgress> {
    // Validate account if provided
    if (input.accountId) {
      const account = await prisma.account.findFirst({
        where: {
          id: input.accountId,
          workspaceId,
          deletedAt: null,
        },
      });

      if (!account) {
        throw new NotFoundError('Account', input.accountId);
      }
    }

    const goal = await prisma.savingsGoal.create({
      data: {
        workspaceId,
        name: input.name,
        targetAmount: input.targetAmount,
        currency: input.currency ?? 'EUR',
        targetDate: input.targetDate,
        icon: input.icon,
        color: input.color,
        accountId: input.accountId,
      },
      include: {
        account: {
          select: { id: true, name: true, icon: true, color: true },
        },
        contributions: {
          orderBy: { date: 'desc' },
        },
      },
    });

    const converted = convertDecimalsToNumber(goal);
    const contributions = goal.contributions.map(convertContributionDecimalsToNumber);

    return {
      ...converted,
      account: goal.account,
      contributions,
      contributionCount: contributions.length,
      progress: 0,
      remainingAmount: converted.targetAmount,
      avgMonthlyContribution: null,
      projectedCompletionDate: null,
      daysUntilTarget: goal.targetDate
        ? Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
      isOnTrack: null,
    };
  },

  /**
   * Get savings goal by ID with progress
   */
  async getById(workspaceId: string, goalId: string): Promise<SavingsGoalWithProgress | null> {
    const goal = await prisma.savingsGoal.findFirst({
      where: {
        id: goalId,
        workspaceId,
        deletedAt: null,
      },
      include: {
        account: {
          select: { id: true, name: true, icon: true, color: true },
        },
        contributions: {
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!goal) return null;

    const converted = convertDecimalsToNumber(goal);
    const contributions = goal.contributions.map(convertContributionDecimalsToNumber);

    const progress = converted.targetAmount > 0
      ? Math.min(100, Math.round((converted.currentAmount / converted.targetAmount) * 100))
      : 0;

    const remainingAmount = Math.max(0, converted.targetAmount - converted.currentAmount);

    const { projectedDate, avgMonthlyContribution } = calculateProjectedCompletion(
      converted.currentAmount,
      converted.targetAmount,
      contributions
    );

    const daysUntilTarget = goal.targetDate
      ? Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    const isOnTrack = checkOnTrack(
      converted.currentAmount,
      converted.targetAmount,
      goal.targetDate,
      projectedDate
    );

    return {
      ...converted,
      account: goal.account,
      contributions,
      contributionCount: contributions.length,
      progress,
      remainingAmount,
      avgMonthlyContribution,
      projectedCompletionDate: projectedDate,
      daysUntilTarget,
      isOnTrack,
    };
  },

  /**
   * List savings goals for workspace
   */
  async list(workspaceId: string, filters: SavingsGoalFilters = {}): Promise<SavingsGoalWithProgress[]> {
    const where: Prisma.SavingsGoalWhereInput = {
      workspaceId,
    };

    if (!filters.includeDeleted) {
      where.deletedAt = null;
    }

    if (!filters.includeCompleted) {
      where.isCompleted = false;
    }

    const goals = await prisma.savingsGoal.findMany({
      where,
      include: {
        account: {
          select: { id: true, name: true, icon: true, color: true },
        },
        contributions: {
          orderBy: { date: 'desc' },
        },
      },
      orderBy: [
        { isCompleted: 'asc' },
        { targetDate: 'asc' },
        { name: 'asc' },
      ],
    });

    return goals.map((goal) => {
      const converted = convertDecimalsToNumber(goal);
      const contributions = goal.contributions.map(convertContributionDecimalsToNumber);

      const progress = converted.targetAmount > 0
        ? Math.min(100, Math.round((converted.currentAmount / converted.targetAmount) * 100))
        : 0;

      const remainingAmount = Math.max(0, converted.targetAmount - converted.currentAmount);

      const { projectedDate, avgMonthlyContribution } = calculateProjectedCompletion(
        converted.currentAmount,
        converted.targetAmount,
        contributions
      );

      const daysUntilTarget = goal.targetDate
        ? Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

      const isOnTrack = checkOnTrack(
        converted.currentAmount,
        converted.targetAmount,
        goal.targetDate,
        projectedDate
      );

      return {
        ...converted,
        account: goal.account,
        contributions,
        contributionCount: contributions.length,
        progress,
        remainingAmount,
        avgMonthlyContribution,
        projectedCompletionDate: projectedDate,
        daysUntilTarget,
        isOnTrack,
      };
    });
  },

  /**
   * Update savings goal
   */
  async update(
    workspaceId: string,
    goalId: string,
    input: SavingsGoalUpdateInput
  ): Promise<SavingsGoalWithProgress> {
    const goal = await prisma.savingsGoal.findFirst({
      where: {
        id: goalId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!goal) {
      throw new NotFoundError('SavingsGoal', goalId);
    }

    // Validate account if changing
    if (input.accountId && input.accountId !== goal.accountId) {
      const account = await prisma.account.findFirst({
        where: {
          id: input.accountId,
          workspaceId,
          deletedAt: null,
        },
      });

      if (!account) {
        throw new NotFoundError('Account', input.accountId);
      }
    }

    await prisma.savingsGoal.update({
      where: { id: goalId },
      data: input,
    });

    return (await this.getById(workspaceId, goalId))!;
  },

  /**
   * Soft delete savings goal
   */
  async delete(workspaceId: string, goalId: string): Promise<void> {
    const goal = await prisma.savingsGoal.findFirst({
      where: {
        id: goalId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!goal) {
      throw new NotFoundError('SavingsGoal', goalId);
    }

    await prisma.savingsGoal.update({
      where: { id: goalId },
      data: { deletedAt: new Date() },
    });
  },

  /**
   * Add contribution to goal
   */
  async addContribution(
    workspaceId: string,
    goalId: string,
    input: SavingsContributionInput
  ): Promise<SavingsGoalWithProgress> {
    const goal = await prisma.savingsGoal.findFirst({
      where: {
        id: goalId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!goal) {
      throw new NotFoundError('SavingsGoal', goalId);
    }

    // Calculate new current amount
    const newCurrentAmount = goal.currentAmount.toNumber() + input.amount;
    const targetAmount = goal.targetAmount.toNumber();
    const isNowCompleted = newCurrentAmount >= targetAmount;

    // Create contribution and update goal in transaction
    await prisma.$transaction([
      prisma.savingsContribution.create({
        data: {
          savingsGoalId: goalId,
          amount: input.amount,
          date: input.date,
          notes: input.notes,
        },
      }),
      prisma.savingsGoal.update({
        where: { id: goalId },
        data: {
          currentAmount: newCurrentAmount,
          isCompleted: isNowCompleted,
          completedAt: isNowCompleted && !goal.isCompleted ? new Date() : goal.completedAt,
        },
      }),
    ]);

    return (await this.getById(workspaceId, goalId))!;
  },

  /**
   * Delete a contribution (and restore amount)
   */
  async deleteContribution(
    workspaceId: string,
    goalId: string,
    contributionId: string
  ): Promise<SavingsGoalWithProgress> {
    const goal = await prisma.savingsGoal.findFirst({
      where: {
        id: goalId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!goal) {
      throw new NotFoundError('SavingsGoal', goalId);
    }

    const contribution = await prisma.savingsContribution.findFirst({
      where: {
        id: contributionId,
        savingsGoalId: goalId,
      },
    });

    if (!contribution) {
      throw new NotFoundError('SavingsContribution', contributionId);
    }

    // Calculate new current amount
    const newCurrentAmount = Math.max(0, goal.currentAmount.toNumber() - contribution.amount.toNumber());
    const targetAmount = goal.targetAmount.toNumber();
    const isStillCompleted = newCurrentAmount >= targetAmount;

    // Delete contribution and update goal in transaction
    await prisma.$transaction([
      prisma.savingsContribution.delete({
        where: { id: contributionId },
      }),
      prisma.savingsGoal.update({
        where: { id: goalId },
        data: {
          currentAmount: newCurrentAmount,
          isCompleted: isStillCompleted,
          completedAt: isStillCompleted ? goal.completedAt : null,
        },
      }),
    ]);

    return (await this.getById(workspaceId, goalId))!;
  },

  /**
   * Get contribution history for a goal
   */
  async getContributionHistory(
    workspaceId: string,
    goalId: string
  ): Promise<Array<Omit<SavingsContribution, 'amount'> & { amount: number }>> {
    const goal = await prisma.savingsGoal.findFirst({
      where: {
        id: goalId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!goal) {
      throw new NotFoundError('SavingsGoal', goalId);
    }

    const contributions = await prisma.savingsContribution.findMany({
      where: { savingsGoalId: goalId },
      orderBy: { date: 'desc' },
    });

    return contributions.map(convertContributionDecimalsToNumber);
  },

  /**
   * Get summary of all savings goals
   */
  async getSummary(workspaceId: string): Promise<SavingsSummary> {
    const goals = await prisma.savingsGoal.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
    });

    let totalTargetAmount = 0;
    let totalCurrentAmount = 0;
    let activeGoals = 0;
    let completedGoals = 0;
    const goalsByCurrency: Record<string, { target: number; current: number; count: number }> = {};

    for (const goal of goals) {
      const target = goal.targetAmount.toNumber();
      const current = goal.currentAmount.toNumber();

      totalTargetAmount += target;
      totalCurrentAmount += current;

      if (goal.isCompleted) {
        completedGoals++;
      } else {
        activeGoals++;
      }

      if (!goalsByCurrency[goal.currency]) {
        goalsByCurrency[goal.currency] = { target: 0, current: 0, count: 0 };
      }
      const currencyStats = goalsByCurrency[goal.currency]!;
      currencyStats.target += target;
      currencyStats.current += current;
      currencyStats.count++;
    }

    const totalRemainingAmount = Math.max(0, totalTargetAmount - totalCurrentAmount);
    const overallProgress = totalTargetAmount > 0
      ? Math.round((totalCurrentAmount / totalTargetAmount) * 100)
      : 0;

    return {
      totalGoals: goals.length,
      activeGoals,
      completedGoals,
      totalTargetAmount,
      totalCurrentAmount,
      totalRemainingAmount,
      overallProgress,
      goalsByCurrency,
    };
  },

  /**
   * Mark goal as completed (manually)
   */
  async markCompleted(workspaceId: string, goalId: string): Promise<SavingsGoalWithProgress> {
    const goal = await prisma.savingsGoal.findFirst({
      where: {
        id: goalId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!goal) {
      throw new NotFoundError('SavingsGoal', goalId);
    }

    await prisma.savingsGoal.update({
      where: { id: goalId },
      data: {
        isCompleted: true,
        completedAt: new Date(),
      },
    });

    return (await this.getById(workspaceId, goalId))!;
  },

  /**
   * Reopen a completed goal
   */
  async reopen(workspaceId: string, goalId: string): Promise<SavingsGoalWithProgress> {
    const goal = await prisma.savingsGoal.findFirst({
      where: {
        id: goalId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!goal) {
      throw new NotFoundError('SavingsGoal', goalId);
    }

    await prisma.savingsGoal.update({
      where: { id: goalId },
      data: {
        isCompleted: false,
        completedAt: null,
      },
    });

    return (await this.getById(workspaceId, goalId))!;
  },
};

export default savingsService;
