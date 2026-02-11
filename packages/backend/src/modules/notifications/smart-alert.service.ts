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

  // ==========================================================================
  // Smart Alert Detection Methods
  // ==========================================================================

  /**
   * Detect unusual spending in a workspace
   * Analyzes recent transactions and flags those significantly above category average
   */
  async detectUnusualSpending(
    workspaceId: string
  ): Promise<Array<{
    transactionId: string;
    amount: number;
    categoryId: string;
    categoryName: string;
    percentAboveAverage: number;
    description: string;
  }>> {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // Get recent expense transactions
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        type: 'expense',
        date: { gte: oneDayAgo },
        categoryId: { not: null },
      },
      include: { category: true },
    });

    const unusualSpending: Array<{
      transactionId: string;
      amount: number;
      categoryId: string;
      categoryName: string;
      percentAboveAverage: number;
      description: string;
    }> = [];

    for (const tx of recentTransactions) {
      if (!tx.categoryId || !tx.category) continue;

      const amount = Math.abs(tx.amount.toNumber());

      // Get average transaction amount for this category
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const avgResult = await prisma.transaction.aggregate({
        where: {
          workspaceId,
          categoryId: tx.categoryId,
          type: 'expense',
          deletedAt: null,
          date: { gte: threeMonthsAgo, lt: oneDayAgo },
        },
        _avg: { amount: true },
        _count: true,
      });

      const avgAmount = Math.abs(avgResult._avg.amount?.toNumber() ?? 0);
      const transactionCount = avgResult._count;

      // Skip if not enough historical data
      if (transactionCount < 3 || avgAmount === 0) continue;

      // Flag if transaction is significantly above average (3x or more and at least 50 EUR)
      if (amount > avgAmount * 3 && amount > 50) {
        const percentAboveAverage = Math.round(((amount - avgAmount) / avgAmount) * 100);

        unusualSpending.push({
          transactionId: tx.id,
          amount,
          categoryId: tx.categoryId,
          categoryName: tx.category.name,
          percentAboveAverage,
          description: tx.description,
        });
      }
    }

    return unusualSpending;
  },

  /**
   * Check all accounts in a workspace for low balances
   */
  async checkLowBalanceForWorkspace(
    workspaceId: string,
    defaultThreshold: number = 100
  ): Promise<Array<{
    accountId: string;
    accountName: string;
    balance: number;
    threshold: number;
  }>> {
    const accounts = await prisma.account.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        type: { in: ['checking', 'savings'] },
      },
    });

    const lowBalanceAccounts: Array<{
      accountId: string;
      accountName: string;
      balance: number;
      threshold: number;
    }> = [];

    for (const account of accounts) {
      const balance = account.balance.toNumber();
      // Use account-specific threshold if set, otherwise use default
      const threshold = defaultThreshold;

      if (balance < threshold && balance >= 0) {
        lowBalanceAccounts.push({
          accountId: account.id,
          accountName: account.name,
          balance,
          threshold,
        });
      }
    }

    return lowBalanceAccounts;
  },

  /**
   * Check for bills due in the next 7 days
   */
  async checkUpcomingBills(
    workspaceId: string
  ): Promise<Array<{
    recurrenceId: string;
    description: string;
    amount: number;
    dueDate: Date;
    daysUntilDue: number;
  }>> {
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Get recurring transactions due in next 7 days
    const recurrences = await prisma.recurrence.findMany({
      where: {
        workspaceId,
        isActive: true,
        nextRunAt: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
    });

    const upcomingBills: Array<{
      recurrenceId: string;
      description: string;
      amount: number;
      dueDate: Date;
      daysUntilDue: number;
    }> = [];

    for (const recurrence of recurrences) {
      if (!recurrence.nextRunAt) continue;

      const template = recurrence.template as Record<string, unknown> | null;
      const amount = Math.abs((template?.amount as number) ?? 0);
      const description = (template?.description as string) ?? recurrence.name ?? 'Paiement recurrent';

      // Skip if amount is 0 or very small
      if (amount < 1) continue;

      const daysUntilDue = Math.ceil(
        (recurrence.nextRunAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      upcomingBills.push({
        recurrenceId: recurrence.id,
        description,
        amount,
        dueDate: recurrence.nextRunAt,
        daysUntilDue,
      });
    }

    // Sort by due date (earliest first)
    upcomingBills.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    return upcomingBills;
  },

  /**
   * Run all anomaly detection checks for a workspace and send notifications
   */
  async runAnomalyDetection(
    workspaceId: string,
    userId: string
  ): Promise<{
    success: true;
    unusualSpending: number;
    lowBalanceAlerts: number;
    upcomingBills: number;
  }> {
    let unusualSpendingCount = 0;
    let lowBalanceCount = 0;
    let upcomingBillsCount = 0;

    try {
      // 1. Detect unusual spending
      const unusualTransactions = await this.detectUnusualSpending(workspaceId);
      for (const tx of unusualTransactions) {
        // Check if we already notified for this transaction
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId,
            workspaceId,
            type: 'unusual_spending',
            data: {
              path: ['transactionId'],
              equals: tx.transactionId,
            },
          },
        });

        if (!existingNotification) {
          await notificationService.notifyUnusualSpending(userId, workspaceId, tx);
          unusualSpendingCount++;
        }
      }

      // 2. Check low balances
      const lowBalanceAccounts = await this.checkLowBalanceForWorkspace(workspaceId);
      for (const account of lowBalanceAccounts) {
        // Only notify once per day per account
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const recentNotification = await prisma.notification.findFirst({
          where: {
            userId,
            workspaceId,
            type: 'low_balance_warning',
            createdAt: { gte: oneDayAgo },
            data: {
              path: ['accountId'],
              equals: account.accountId,
            },
          },
        });

        if (!recentNotification) {
          await notificationService.notifyLowBalance(userId, workspaceId, {
            id: account.accountId,
            name: account.accountName,
            balance: account.balance,
            threshold: account.threshold,
          });
          lowBalanceCount++;
        }
      }

      // 3. Check upcoming bills
      const upcomingBills = await this.checkUpcomingBills(workspaceId);
      for (const bill of upcomingBills) {
        // Only notify once per recurrence per due date
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId,
            workspaceId,
            type: 'bill_upcoming',
            data: {
              path: ['recurrenceId'],
              equals: bill.recurrenceId,
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        // Check if we already notified for this specific due date
        const lastNotificationData = existingNotification?.data as { dueDate?: string } | null;
        const alreadyNotified = lastNotificationData?.dueDate === bill.dueDate.toISOString();

        if (!alreadyNotified) {
          await notificationService.notifyBillUpcoming(userId, workspaceId, bill);
          upcomingBillsCount++;
        }
      }

      logger.info(
        { workspaceId, unusualSpendingCount, lowBalanceCount, upcomingBillsCount },
        'Anomaly detection completed'
      );
    } catch (error) {
      logger.error({ error, workspaceId }, 'Anomaly detection failed');
      throw error;
    }

    return {
      success: true,
      unusualSpending: unusualSpendingCount,
      lowBalanceAlerts: lowBalanceCount,
      upcomingBills: upcomingBillsCount,
    };
  },
};

export default smartAlertService;
