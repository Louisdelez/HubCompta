// ============================================================================
// SMART ALERT SERVICE - Finance Hub
// Intelligent notifications for anomaly detection and insights
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { notificationService } from './notification.service.js';
import { logger } from '@/core/middleware/logger.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface AnomalyDetectionResult {
  type: 'unusual_spending' | 'large_transaction' | 'new_merchant' | 'category_spike';
  severity: 'low' | 'medium' | 'high';
  message: string;
  data: Record<string, unknown>;
}

export interface SpendingSummary {
  totalSpent: number;
  totalIncome: number;
  netChange: number;
  topCategories: Array<{ categoryId: string; name: string; amount: number }>;
  comparedToAverage: number; // percentage
  insights: string[];
}

// ----------------------------------------------------------------------------
// Smart Alert Service
// ----------------------------------------------------------------------------

export const smartAlertService = {
  /**
   * Detect anomalies in a recent transaction
   */
  async detectAnomalies(
    workspaceId: string,
    transactionId: string
  ): Promise<AnomalyDetectionResult[]> {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, workspaceId },
      include: { category: true },
    });

    if (!transaction) return [];

    const anomalies: AnomalyDetectionResult[] = [];
    const amount = Math.abs(transaction.amount.toNumber());

    // 1. Check for unusually large transaction
    const avgTransaction = await this.getAverageTransactionAmount(
      workspaceId,
      transaction.type
    );

    if (amount > avgTransaction * 3 && amount > 100) {
      anomalies.push({
        type: 'large_transaction',
        severity: amount > avgTransaction * 5 ? 'high' : 'medium',
        message: `Transaction inhabituelle: ${amount.toFixed(2)} EUR (${Math.round(amount / avgTransaction)}x la moyenne)`,
        data: { transactionId, amount, average: avgTransaction },
      });
    }

    // 2. Check for category spending spike
    if (transaction.categoryId) {
      const spike = await this.checkCategorySpike(
        workspaceId,
        transaction.categoryId,
        amount
      );

      if (spike) {
        anomalies.push({
          type: 'category_spike',
          severity: spike.percentageAbove > 100 ? 'high' : 'medium',
          message: `Depense elevee dans "${transaction.category?.name}": ${spike.percentageAbove}% au-dessus de la moyenne`,
          data: {
            categoryId: transaction.categoryId,
            categoryName: transaction.category?.name,
            ...spike,
          },
        });
      }
    }

    // 3. Check for new merchant
    const isNewMerchant = await this.isNewMerchant(
      workspaceId,
      transaction.description
    );

    if (isNewMerchant && amount > 50) {
      anomalies.push({
        type: 'new_merchant',
        severity: 'low',
        message: `Premiere transaction avec ce commercant`,
        data: { merchant: transaction.description, amount },
      });
    }

    return anomalies;
  },

  /**
   * Get average transaction amount by type
   */
  async getAverageTransactionAmount(
    workspaceId: string,
    type: string
  ): Promise<number> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const result = await prisma.transaction.aggregate({
      where: {
        workspaceId,
        type: type as 'expense' | 'income' | 'transfer',
        deletedAt: null,
        date: { gte: threeMonthsAgo },
      },
      _avg: { amount: true },
    });

    return Math.abs(result._avg.amount?.toNumber() ?? 50);
  },

  /**
   * Check if spending in category is spiking
   */
  async checkCategorySpike(
    workspaceId: string,
    categoryId: string,
    currentAmount: number
  ): Promise<{ percentageAbove: number; monthlyAverage: number } | null> {
    // Get average monthly spending in this category
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlySpending = await prisma.transaction.aggregate({
      where: {
        workspaceId,
        categoryId,
        deletedAt: null,
        date: { gte: sixMonthsAgo },
        amount: { lt: 0 },
      },
      _sum: { amount: true },
    });

    const totalSpent = Math.abs(monthlySpending._sum.amount?.toNumber() ?? 0);
    const monthlyAverage = totalSpent / 6;

    if (monthlyAverage === 0) return null;

    // Check current month spending
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const currentMonthSpending = await prisma.transaction.aggregate({
      where: {
        workspaceId,
        categoryId,
        deletedAt: null,
        date: { gte: startOfMonth },
        amount: { lt: 0 },
      },
      _sum: { amount: true },
    });

    const currentMonthTotal = Math.abs(currentMonthSpending._sum.amount?.toNumber() ?? 0);
    const percentageAbove = Math.round(((currentMonthTotal - monthlyAverage) / monthlyAverage) * 100);

    if (percentageAbove > 50) {
      return { percentageAbove, monthlyAverage };
    }

    return null;
  },

  /**
   * Check if this is a new merchant
   */
  async isNewMerchant(
    workspaceId: string,
    description: string
  ): Promise<boolean> {
    // Extract merchant identifier (first few words)
    const merchantKey = description.toLowerCase().split(' ').slice(0, 3).join(' ');

    const previousTransactions = await prisma.transaction.count({
      where: {
        workspaceId,
        deletedAt: null,
        description: { contains: merchantKey, mode: 'insensitive' },
      },
    });

    return previousTransactions <= 1;
  },

  /**
   * Send anomaly notifications
   */
  async notifyAnomalies(
    workspaceId: string,
    userId: string,
    anomalies: AnomalyDetectionResult[]
  ): Promise<void> {
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'low') continue; // Skip low severity

      await notificationService.create({
        userId,
        workspaceId,
        type: 'unusual_spending',
        title: this.getAnomalyTitle(anomaly),
        message: anomaly.message,
        data: anomaly.data,
      });
    }
  },

  /**
   * Get title for anomaly notification
   */
  getAnomalyTitle(anomaly: AnomalyDetectionResult): string {
    switch (anomaly.type) {
      case 'large_transaction':
        return '⚠️ Transaction importante detectee';
      case 'category_spike':
        return '📈 Augmentation des depenses';
      case 'unusual_spending':
        return '🔍 Depense inhabituelle';
      case 'new_merchant':
        return '🆕 Nouveau commercant';
      default:
        return '📊 Alerte financiere';
    }
  },

  /**
   * Generate weekly spending summary
   */
  async generateWeeklySummary(
    workspaceId: string,
    userId: string
  ): Promise<SpendingSummary> {
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
    }

    if (topCategories.length > 0) {
      const topCategory = topCategories[0]!;
      insights.push(`Votre plus grande categorie de depenses: ${topCategory.name} (${topCategory.amount.toFixed(2)} EUR)`);
    }

    if (totalIncome > totalSpent) {
      insights.push(`Vous etes en positif cette semaine: +${(totalIncome - totalSpent).toFixed(2)} EUR`);
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
   * Send weekly summary notification
   */
  async sendWeeklySummary(workspaceId: string, userId: string): Promise<void> {
    const summary = await this.generateWeeklySummary(workspaceId, userId);

    const title = summary.netChange >= 0
      ? `📊 Resume hebdomadaire: +${summary.netChange.toFixed(0)} EUR`
      : `📊 Resume hebdomadaire: ${summary.netChange.toFixed(0)} EUR`;

    await notificationService.create({
      userId,
      workspaceId,
      type: 'weekly_summary',
      title,
      message: summary.insights.join(' '),
      data: {
        totalSpent: summary.totalSpent,
        totalIncome: summary.totalIncome,
        netChange: summary.netChange,
        comparedToAverage: summary.comparedToAverage,
        topCategories: summary.topCategories.map((c) => c.name),
      },
    });
  },

  /**
   * Check low balance warning
   */
  async checkLowBalance(
    workspaceId: string,
    userId: string,
    threshold: number = 100
  ): Promise<void> {
    const accounts = await prisma.account.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        type: { in: ['checking', 'savings'] },
      },
    });

    for (const account of accounts) {
      const balance = account.balance.toNumber();
      if (balance < threshold && balance > 0) {
        await notificationService.create({
          userId,
          workspaceId,
          type: 'low_balance_warning',
          title: `⚠️ Solde bas: ${account.name}`,
          message: `Le solde de votre compte "${account.name}" est de ${balance.toFixed(2)} EUR`,
          data: {
            accountId: account.id,
            accountName: account.name,
            balance,
            threshold,
          },
        });
      }
    }
  },

  /**
   * Check savings goal milestones
   */
  async checkSavingsMilestones(
    workspaceId: string,
    userId: string,
    goalId: string
  ): Promise<void> {
    const goal = await prisma.savingsGoal.findFirst({
      where: { id: goalId, workspaceId },
    });

    if (!goal) return;

    const currentAmount = goal.currentAmount.toNumber();
    const targetAmount = goal.targetAmount.toNumber();
    const progress = (currentAmount / targetAmount) * 100;

    const milestones = [25, 50, 75, 100];

    for (const milestone of milestones) {
      if (progress >= milestone) {
        // Check if we already notified for this milestone
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId,
            workspaceId,
            type: 'savings_milestone',
            data: {
              path: ['goalId'],
              equals: goalId,
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        const lastMilestone = (existingNotification?.data as { milestone?: number })?.milestone ?? 0;

        if (milestone > lastMilestone) {
          const emoji = milestone === 100 ? '🎉' : milestone === 75 ? '🔥' : milestone === 50 ? '🌟' : '✨';

          await notificationService.create({
            userId,
            workspaceId,
            type: 'savings_milestone',
            title: `${emoji} ${goal.name}: ${milestone}% atteint !`,
            message: milestone === 100
              ? `Felicitations ! Vous avez atteint votre objectif d'epargne !`
              : `Vous avez atteint ${milestone}% de votre objectif "${goal.name}"`,
            data: {
              goalId,
              goalName: goal.name,
              milestone,
              currentAmount,
              targetAmount,
            },
          });
          break;
        }
      }
    }
  },

  /**
   * Check if savings goal is off track
   */
  async checkSavingsOnTrack(
    workspaceId: string,
    userId: string
  ): Promise<void> {
    const goals = await prisma.savingsGoal.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        isCompleted: false,
        targetDate: { not: null },
      },
    });

    const now = new Date();

    for (const goal of goals) {
      if (!goal.targetDate) continue;

      const targetDate = new Date(goal.targetDate);
      const daysRemaining = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysRemaining <= 0) continue;

      const currentAmount = goal.currentAmount.toNumber();
      const targetAmount = goal.targetAmount.toNumber();
      const remaining = targetAmount - currentAmount;

      // Calculate required monthly savings
      const monthsRemaining = daysRemaining / 30;
      const requiredMonthly = remaining / monthsRemaining;

      // Get average monthly contribution
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const contributions = await prisma.savingsContribution.aggregate({
        where: {
          savingsGoalId: goal.id,
          date: { gte: sixMonthsAgo },
        },
        _sum: { amount: true },
      });

      const totalContributed = contributions._sum.amount?.toNumber() ?? 0;
      const avgMonthly = totalContributed / 6;

      // Warn if significantly off track
      if (avgMonthly < requiredMonthly * 0.5 && remaining > 100) {
        await notificationService.create({
          userId,
          workspaceId,
          type: 'savings_off_track',
          title: `📈 Objectif "${goal.name}" en retard`,
          message: `Pour atteindre votre objectif a temps, vous devriez epargner ${requiredMonthly.toFixed(0)} EUR/mois (actuellement ${avgMonthly.toFixed(0)} EUR/mois)`,
          data: {
            goalId: goal.id,
            goalName: goal.name,
            required: requiredMonthly,
            current: avgMonthly,
            daysRemaining,
          },
        });
      }
    }
  },
};

export default smartAlertService;
