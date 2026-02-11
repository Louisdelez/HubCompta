// ============================================================================
// SUMMARY SERVICE - Finance Hub
// Generate weekly and monthly financial summaries for users
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { notificationService } from './notification.service.js';
import { logger } from '@/core/middleware/logger.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface WeeklySummary {
  totalSpent: number;
  totalIncome: number;
  netChange: number;
  topCategories: Array<{ categoryId: string; name: string; amount: number }>;
  comparedToAverage: number;
  insights: string[];
}

export interface MonthlySummary {
  month: string;
  totalSpent: number;
  totalIncome: number;
  netChange: number;
  comparedToLastMonth: number;
  topCategories: Array<{ name: string; amount: number; percentOfTotal: number }>;
  savingsRate: number;
  transactionCount: number;
  averageTransaction: number;
  insights: string[];
}

// ----------------------------------------------------------------------------
// Summary Service
// ----------------------------------------------------------------------------

export const summaryService = {
  /**
   * Generate weekly spending summary for a user/workspace
   */
  async generateWeeklySummary(
    workspaceId: string,
    _userId: string
  ): Promise<WeeklySummary> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Get this week's transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        date: { gte: oneWeekAgo },
      },
      include: { category: true },
    });

    let totalSpent = 0;
    let totalIncome = 0;
    const categorySpending = new Map<string, { name: string; amount: number }>();

    for (const tx of transactions) {
      const amount = tx.amount.toNumber();
      if (amount < 0) {
        totalSpent += Math.abs(amount);
        if (tx.categoryId && tx.category) {
          const current = categorySpending.get(tx.categoryId) ?? { name: tx.category.name, amount: 0 };
          current.amount += Math.abs(amount);
          categorySpending.set(tx.categoryId, current);
        }
      } else {
        totalIncome += amount;
      }
    }

    // Get average weekly spending (last 12 weeks)
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const historicalSpending = await prisma.transaction.aggregate({
      where: {
        workspaceId,
        deletedAt: null,
        date: { gte: twelveWeeksAgo, lt: oneWeekAgo },
        amount: { lt: 0 },
      },
      _sum: { amount: true },
    });

    const historicalTotal = Math.abs(historicalSpending._sum.amount?.toNumber() ?? 0);
    const weeklyAverage = historicalTotal / 11;
    const comparedToAverage = weeklyAverage > 0
      ? Math.round(((totalSpent - weeklyAverage) / weeklyAverage) * 100)
      : 0;

    // Sort categories by amount
    const topCategories = Array.from(categorySpending.entries())
      .map(([categoryId, data]) => ({ categoryId, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Generate insights
    const insights: string[] = [];

    if (comparedToAverage > 20) {
      insights.push(`Vous avez depense ${comparedToAverage}% de plus que d'habitude cette semaine.`);
    } else if (comparedToAverage < -20) {
      insights.push(`Bravo ! Vous avez depense ${Math.abs(comparedToAverage)}% de moins que d'habitude.`);
    } else {
      insights.push('Vos depenses sont dans la moyenne cette semaine.');
    }

    if (topCategories.length > 0) {
      const topCategory = topCategories[0]!;
      insights.push(`Categorie principale: ${topCategory.name} (${topCategory.amount.toFixed(2)} EUR)`);
    }

    if (totalIncome > totalSpent) {
      insights.push(`Vous etes en positif cette semaine: +${(totalIncome - totalSpent).toFixed(2)} EUR`);
    } else if (totalSpent > totalIncome && totalIncome > 0) {
      insights.push(`Depenses superieures aux revenus: -${(totalSpent - totalIncome).toFixed(2)} EUR`);
    }

    return {
      totalSpent,
      totalIncome,
      netChange: totalIncome - totalSpent,
      topCategories,
      comparedToAverage,
      insights,
    };
  },

  /**
   * Generate monthly financial report for a user/workspace
   */
  async generateMonthlySummary(
    workspaceId: string,
    userId: string,
    month?: Date
  ): Promise<MonthlySummary> {
    // Default to last complete month
    const targetMonth = month ?? new Date();
    if (!month) {
      targetMonth.setMonth(targetMonth.getMonth() - 1);
    }

    const startOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const endOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59);

    // Get month's transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      include: { category: true },
    });

    let totalSpent = 0;
    let totalIncome = 0;
    const categorySpending = new Map<string, { name: string; amount: number }>();

    for (const tx of transactions) {
      const amount = tx.amount.toNumber();
      if (amount < 0) {
        totalSpent += Math.abs(amount);
        if (tx.categoryId && tx.category) {
          const current = categorySpending.get(tx.categoryId) ?? { name: tx.category.name, amount: 0 };
          current.amount += Math.abs(amount);
          categorySpending.set(tx.categoryId, current);
        }
      } else {
        totalIncome += amount;
      }
    }

    // Get previous month for comparison
    const prevMonthStart = new Date(startOfMonth);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    const prevMonthEnd = new Date(startOfMonth);
    prevMonthEnd.setDate(prevMonthEnd.getDate() - 1);
    prevMonthEnd.setHours(23, 59, 59);

    const prevMonthSpending = await prisma.transaction.aggregate({
      where: {
        workspaceId,
        deletedAt: null,
        date: { gte: prevMonthStart, lte: prevMonthEnd },
        amount: { lt: 0 },
      },
      _sum: { amount: true },
    });

    const prevMonthTotal = Math.abs(prevMonthSpending._sum.amount?.toNumber() ?? 0);
    const comparedToLastMonth = prevMonthTotal > 0
      ? Math.round(((totalSpent - prevMonthTotal) / prevMonthTotal) * 100)
      : 0;

    // Calculate savings rate
    const savingsRate = totalIncome > 0
      ? Math.round(((totalIncome - totalSpent) / totalIncome) * 100)
      : 0;

    // Top categories with percentage
    const topCategories = Array.from(categorySpending.entries())
      .map(([_, data]) => ({
        name: data.name,
        amount: data.amount,
        percentOfTotal: totalSpent > 0 ? Math.round((data.amount / totalSpent) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Format month name
    const monthName = startOfMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    // Calculate averages
    const transactionCount = transactions.length;
    const expenseTransactions = transactions.filter((tx) => tx.amount.toNumber() < 0);
    const averageTransaction = expenseTransactions.length > 0
      ? totalSpent / expenseTransactions.length
      : 0;

    // Generate insights
    const insights: string[] = [];

    if (savingsRate > 20) {
      insights.push(`Excellent ! Vous avez epargne ${savingsRate}% de vos revenus ce mois-ci.`);
    } else if (savingsRate > 0) {
      insights.push(`Vous avez epargne ${savingsRate}% de vos revenus ce mois-ci.`);
    } else if (savingsRate < 0) {
      insights.push(`Attention: vos depenses depassent vos revenus de ${Math.abs(savingsRate)}%.`);
    }

    if (comparedToLastMonth > 20) {
      insights.push(`Vos depenses ont augmente de ${comparedToLastMonth}% par rapport au mois dernier.`);
    } else if (comparedToLastMonth < -20) {
      insights.push(`Vos depenses ont diminue de ${Math.abs(comparedToLastMonth)}% par rapport au mois dernier.`);
    }

    if (topCategories.length > 0) {
      const topCategory = topCategories[0]!;
      insights.push(`Plus grosse depense: ${topCategory.name} (${topCategory.percentOfTotal}% du total)`);
    }

    return {
      month: monthName,
      totalSpent,
      totalIncome,
      netChange: totalIncome - totalSpent,
      comparedToLastMonth,
      topCategories,
      savingsRate,
      transactionCount,
      averageTransaction,
      insights,
    };
  },

  /**
   * Send weekly summary notification to a user
   */
  async sendWeeklySummary(
    workspaceId: string,
    userId: string
  ): Promise<{ success: true }> {
    try {
      const summary = await this.generateWeeklySummary(workspaceId, userId);

      await notificationService.notifyWeeklySummary(userId, workspaceId, {
        totalSpent: summary.totalSpent,
        totalIncome: summary.totalIncome,
        netChange: summary.netChange,
        comparedToAverage: summary.comparedToAverage,
        topCategories: summary.topCategories.map((c) => c.name),
        insights: summary.insights,
      });

      logger.info({ workspaceId, userId }, 'Weekly summary sent');
      return { success: true };
    } catch (error) {
      logger.error({ error, workspaceId, userId }, 'Failed to send weekly summary');
      throw error;
    }
  },

  /**
   * Send monthly report notification to a user
   */
  async sendMonthlyReport(
    workspaceId: string,
    userId: string,
    month?: Date
  ): Promise<{ success: true }> {
    try {
      const report = await this.generateMonthlySummary(workspaceId, userId, month);

      await notificationService.notifyMonthlyReport(userId, workspaceId, report);

      logger.info({ workspaceId, userId, month: report.month }, 'Monthly report sent');
      return { success: true };
    } catch (error) {
      logger.error({ error, workspaceId, userId }, 'Failed to send monthly report');
      throw error;
    }
  },

  /**
   * Process weekly summaries for all active users
   */
  async processAllWeeklySummaries(): Promise<{
    success: true;
    processed: number;
    failed: number;
  }> {
    let processed = 0;
    let failed = 0;

    try {
      // Get all workspace memberships with notification preferences
      const memberships = await prisma.membership.findMany({
        where: {
          workspace: {
            deletedAt: null,
          },
        },
        include: {
          user: true,
          workspace: true,
        },
        distinct: ['userId', 'workspaceId'],
      });

      for (const membership of memberships) {
        try {
          await this.sendWeeklySummary(membership.workspaceId, membership.userId);
          processed++;
        } catch (error) {
          logger.error(
            { error, workspaceId: membership.workspaceId, userId: membership.userId },
            'Failed to process weekly summary for user'
          );
          failed++;
        }
      }

      logger.info({ processed, failed }, 'Weekly summaries processing complete');
    } catch (error) {
      logger.error({ error }, 'Failed to process weekly summaries');
      throw error;
    }

    return { success: true, processed, failed };
  },

  /**
   * Process monthly reports for all active users
   */
  async processAllMonthlyReports(): Promise<{
    success: true;
    processed: number;
    failed: number;
  }> {
    let processed = 0;
    let failed = 0;

    try {
      // Get all workspace memberships
      const memberships = await prisma.membership.findMany({
        where: {
          workspace: {
            deletedAt: null,
          },
        },
        include: {
          user: true,
          workspace: true,
        },
        distinct: ['userId', 'workspaceId'],
      });

      for (const membership of memberships) {
        try {
          await this.sendMonthlyReport(membership.workspaceId, membership.userId);
          processed++;
        } catch (error) {
          logger.error(
            { error, workspaceId: membership.workspaceId, userId: membership.userId },
            'Failed to process monthly report for user'
          );
          failed++;
        }
      }

      logger.info({ processed, failed }, 'Monthly reports processing complete');
    } catch (error) {
      logger.error({ error }, 'Failed to process monthly reports');
      throw error;
    }

    return { success: true, processed, failed };
  },
};

export default summaryService;
