// ============================================================================
// INSIGHTS SERVICE - Finance Hub
// Generate smart insights from notifications and transaction data
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { logger } from '@/core/middleware/logger.js';
import {
  getNotificationMessage,
  DEFAULT_LANGUAGE,
} from '@/core/i18n/index.js';
import type { LanguageCode } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Helper to get user locale
// ----------------------------------------------------------------------------

async function getUserLocale(userId: string): Promise<LanguageCode> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { locale: true },
  });
  return (user?.locale as LanguageCode) || DEFAULT_LANGUAGE;
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type InsightType =
  | 'spending_spike'
  | 'saving_opportunity'
  | 'budget_risk'
  | 'trend'
  | 'tip'
  | 'unusual_spending'
  | 'weekly_summary'
  | 'monthly_report'
  | 'low_balance_warning'
  | 'bill_upcoming';

export type InsightSeverity = 'info' | 'warning' | 'success' | 'danger';

export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  message: string;
  impact?: number;
  category?: string;
  actionUrl?: string;
  actionLabel?: string;
  severity: InsightSeverity;
  createdAt: string;
  data?: Record<string, unknown>;
}

// Map notification types to insight types
const notificationToInsightType: Record<string, InsightType> = {
  unusual_spending: 'unusual_spending',
  weekly_summary: 'weekly_summary',
  monthly_report: 'monthly_report',
  low_balance_warning: 'low_balance_warning',
  bill_upcoming: 'bill_upcoming',
  budget_alert: 'budget_risk',
  budget_warning: 'budget_risk',
  savings_milestone: 'saving_opportunity',
  savings_off_track: 'budget_risk',
};

// Map notification types to severity
const notificationToSeverity: Record<string, InsightSeverity> = {
  unusual_spending: 'warning',
  weekly_summary: 'info',
  monthly_report: 'info',
  low_balance_warning: 'danger',
  bill_upcoming: 'warning',
  budget_alert: 'danger',
  budget_warning: 'warning',
  savings_milestone: 'success',
  savings_off_track: 'warning',
};

// ----------------------------------------------------------------------------
// Insights Service
// ----------------------------------------------------------------------------

export const insightsService = {
  /**
   * Get insights for a workspace (converts recent notifications to insights)
   */
  async getForWorkspace(
    workspaceId: string,
    userId: string,
    limit: number = 10
  ): Promise<Insight[]> {
    try {
      const locale = await getUserLocale(userId);

      // Get recent smart notifications for this workspace
      const notifications = await prisma.notification.findMany({
        where: {
          userId,
          workspaceId,
          type: {
            in: [
              'unusual_spending',
              'weekly_summary',
              'monthly_report',
              'low_balance_warning',
              'bill_upcoming',
              'budget_alert',
              'budget_warning',
              'savings_milestone',
              'savings_off_track',
            ],
          },
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      // Convert notifications to insights
      const insights: Insight[] = notifications.map((notification) => {
        const notificationType = notification.type;
        const data = notification.data as Record<string, unknown> | null;

        return {
          id: notification.id,
          type: notificationToInsightType[notificationType] ?? 'tip',
          title: notification.title,
          message: notification.message,
          impact: data?.amount as number | undefined,
          category: data?.categoryName as string | undefined,
          actionUrl: this.getActionUrl(notificationType, data),
          actionLabel: this.getActionLabel(notificationType, locale),
          severity: notificationToSeverity[notificationType] ?? 'info',
          createdAt: notification.createdAt.toISOString(),
          data: data ?? undefined,
        };
      });

      // Add generated insights from current data analysis
      const generatedInsights = await this.generateAdditionalInsights(
        workspaceId,
        userId,
        limit - insights.length
      );

      return [...insights, ...generatedInsights].slice(0, limit);
    } catch (error) {
      logger.error({ error, workspaceId, userId }, 'Failed to get insights');
      return [];
    }
  },

  /**
   * Generate additional insights from current data
   */
  async generateAdditionalInsights(
    workspaceId: string,
    userId: string,
    limit: number
  ): Promise<Insight[]> {
    if (limit <= 0) return [];

    const locale = await getUserLocale(userId);
    const insights: Insight[] = [];

    try {
      // Check for spending trends
      const spendingTrend = await this.analyzeSpendingTrend(workspaceId, locale);
      if (spendingTrend) {
        insights.push(spendingTrend);
      }

      // Check for saving opportunities
      const savingOpportunity = await this.findSavingOpportunity(workspaceId, locale);
      if (savingOpportunity) {
        insights.push(savingOpportunity);
      }

      // Add tips based on user activity
      const tip = this.generateTip(workspaceId, locale);
      if (tip) {
        insights.push(tip);
      }
    } catch (error) {
      logger.error({ error, workspaceId }, 'Failed to generate additional insights');
    }

    return insights.slice(0, limit);
  },

  /**
   * Analyze spending trend for the current month vs previous months
   */
  async analyzeSpendingTrend(workspaceId: string, locale: LanguageCode = DEFAULT_LANGUAGE): Promise<Insight | null> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Current month spending
    const currentSpending = await prisma.transaction.aggregate({
      where: {
        workspaceId,
        deletedAt: null,
        date: { gte: startOfMonth },
        amount: { lt: 0 },
      },
      _sum: { amount: true },
    });

    // Previous month spending (normalized to days elapsed)
    const prevSpending = await prisma.transaction.aggregate({
      where: {
        workspaceId,
        deletedAt: null,
        date: { gte: startOfPrevMonth, lte: endOfPrevMonth },
        amount: { lt: 0 },
      },
      _sum: { amount: true },
    });

    const currentTotal = Math.abs(currentSpending._sum.amount?.toNumber() ?? 0);
    const prevTotal = Math.abs(prevSpending._sum.amount?.toNumber() ?? 0);

    if (prevTotal === 0) return null;

    // Normalize by days in period
    const daysInCurrentMonth = now.getDate();
    const daysInPrevMonth = endOfPrevMonth.getDate();
    const dailyCurrentAvg = currentTotal / daysInCurrentMonth;
    const dailyPrevAvg = prevTotal / daysInPrevMonth;

    const changePercent = Math.round(((dailyCurrentAvg - dailyPrevAvg) / dailyPrevAvg) * 100);

    if (Math.abs(changePercent) < 10) return null;

    const isIncreased = changePercent > 0;

    const titleKey = isIncreased ? 'insights.spendingUp' : 'insights.spendingDown';
    const messageKey = isIncreased ? 'insights.spendingUpMessage' : 'insights.spendingDownMessage';

    return {
      id: `trend-${Date.now()}`,
      type: 'trend',
      title: getNotificationMessage(locale, titleKey, { changePercent: Math.abs(changePercent) }),
      message: getNotificationMessage(locale, messageKey),
      impact: currentTotal,
      severity: isIncreased ? 'warning' : 'success',
      createdAt: new Date().toISOString(),
      actionUrl: '/reports',
      actionLabel: getNotificationMessage(locale, 'actions.viewReports'),
    };
  },

  /**
   * Find potential saving opportunities
   */
  async findSavingOpportunity(workspaceId: string, locale: LanguageCode = DEFAULT_LANGUAGE): Promise<Insight | null> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const currency = 'EUR';

    // Find categories with recurring similar expenses
    const categorySpending = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        workspaceId,
        deletedAt: null,
        date: { gte: thirtyDaysAgo },
        amount: { lt: 0 },
        categoryId: { not: null },
      },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'asc' } },
      take: 1,
    });

    if (categorySpending.length === 0) return null;

    const topCategory = categorySpending[0];
    if (!topCategory?.categoryId) return null;

    const category = await prisma.category.findUnique({
      where: { id: topCategory.categoryId },
    });

    if (!category) return null;

    const amount = Math.abs(topCategory._sum.amount?.toNumber() ?? 0);

    if (amount < 100 || (topCategory._count ?? 0) < 3) return null;

    const potentialSavings = Math.round(amount * 0.1);

    return {
      id: `saving-${Date.now()}`,
      type: 'saving_opportunity',
      title: getNotificationMessage(locale, 'insights.savingOpportunity', { categoryName: category.name }),
      message: getNotificationMessage(locale, 'insights.savingOpportunityMessage', {
        amount: amount.toFixed(0),
        categoryName: category.name,
        savings: potentialSavings,
        currency,
      }),
      impact: -potentialSavings,
      category: category.name,
      severity: 'info',
      createdAt: new Date().toISOString(),
      actionUrl: '/transactions',
      actionLabel: getNotificationMessage(locale, 'actions.viewTransactions'),
    };
  },

  /**
   * Generate a helpful tip
   */
  generateTip(_workspaceId: string, locale: LanguageCode = DEFAULT_LANGUAGE): Insight {
    const tipKeys = [
      'automateSavings',
      'trackSubscriptions',
      'categoryBudgets',
      'emergencyFund',
    ];

    const randomTipKey = tipKeys[Math.floor(Math.random() * tipKeys.length)]!;

    return {
      id: `tip-${Date.now()}`,
      type: 'tip',
      title: getNotificationMessage(locale, `tips.${randomTipKey}.title`),
      message: getNotificationMessage(locale, `tips.${randomTipKey}.message`),
      severity: 'info',
      createdAt: new Date().toISOString(),
    };
  },

  /**
   * Get action URL for a notification type
   */
  getActionUrl(notificationType: string, data: Record<string, unknown> | null): string | undefined {
    switch (notificationType) {
      case 'unusual_spending':
        return data?.transactionId ? `/transactions/${String(data.transactionId)}` : '/transactions';
      case 'weekly_summary':
        return '/dashboard';
      case 'monthly_report':
        return '/reports';
      case 'low_balance_warning':
        return data?.accountId ? `/accounts/${String(data.accountId)}` : '/accounts';
      case 'bill_upcoming':
        return '/recurrences';
      case 'budget_alert':
      case 'budget_warning':
        return data?.budgetId ? `/budgets/${String(data.budgetId)}` : '/budgets';
      case 'savings_milestone':
      case 'savings_off_track':
        return data?.goalId ? `/savings/${String(data.goalId)}` : '/savings';
      default:
        return undefined;
    }
  },

  /**
   * Get action label for a notification type
   */
  getActionLabel(notificationType: string, locale: LanguageCode = DEFAULT_LANGUAGE): string | undefined {
    switch (notificationType) {
      case 'unusual_spending':
        return getNotificationMessage(locale, 'actions.viewTransaction');
      case 'weekly_summary':
        return getNotificationMessage(locale, 'actions.viewDashboard');
      case 'monthly_report':
        return getNotificationMessage(locale, 'actions.viewReport');
      case 'low_balance_warning':
        return getNotificationMessage(locale, 'actions.viewAccount');
      case 'bill_upcoming':
        return getNotificationMessage(locale, 'actions.viewSchedule');
      case 'budget_alert':
      case 'budget_warning':
        return getNotificationMessage(locale, 'actions.viewBudget');
      case 'savings_milestone':
      case 'savings_off_track':
        return getNotificationMessage(locale, 'actions.viewGoal');
      default:
        return undefined;
    }
  },
};

export default insightsService;
