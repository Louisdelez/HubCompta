// ============================================================================
// INSIGHTS SERVICE - Finance Hub
// Generate smart insights from notifications and transaction data
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { logger } from '@/core/middleware/logger.js';

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
          actionLabel: this.getActionLabel(notificationType),
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

    const insights: Insight[] = [];

    try {
      // Check for spending trends
      const spendingTrend = await this.analyzeSpendingTrend(workspaceId);
      if (spendingTrend) {
        insights.push(spendingTrend);
      }

      // Check for saving opportunities
      const savingOpportunity = await this.findSavingOpportunity(workspaceId);
      if (savingOpportunity) {
        insights.push(savingOpportunity);
      }

      // Add tips based on user activity
      const tip = this.generateTip(workspaceId);
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
  async analyzeSpendingTrend(workspaceId: string): Promise<Insight | null> {
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

    return {
      id: `trend-${Date.now()}`,
      type: 'trend',
      title: isIncreased
        ? `Depenses en hausse de ${changePercent}%`
        : `Depenses en baisse de ${Math.abs(changePercent)}%`,
      message: isIncreased
        ? `Vos depenses quotidiennes moyennes sont plus elevees que le mois dernier.`
        : `Vous depensez moins que le mois dernier. Continuez !`,
      impact: currentTotal,
      severity: isIncreased ? 'warning' : 'success',
      createdAt: new Date().toISOString(),
      actionUrl: '/reports',
      actionLabel: 'Voir les rapports',
    };
  },

  /**
   * Find potential saving opportunities
   */
  async findSavingOpportunity(workspaceId: string): Promise<Insight | null> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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
      title: `Opportunite d'epargne: ${category.name}`,
      message: `Vous avez depense ${amount.toFixed(0)} EUR en "${category.name}" ce mois-ci. Une reduction de 10% vous ferait economiser ${potentialSavings} EUR.`,
      impact: -potentialSavings,
      category: category.name,
      severity: 'info',
      createdAt: new Date().toISOString(),
      actionUrl: '/transactions',
      actionLabel: 'Voir les transactions',
    };
  },

  /**
   * Generate a helpful tip
   */
  generateTip(_workspaceId: string): Insight {
    const tips = [
      {
        title: 'Conseil: Automatisez votre epargne',
        message: 'Configurez un virement automatique vers votre compte epargne chaque mois pour atteindre vos objectifs plus facilement.',
      },
      {
        title: 'Conseil: Suivez vos abonnements',
        message: 'Passez en revue vos abonnements regulierement. Vous pourriez economiser en annulant ceux que vous n\'utilisez plus.',
      },
      {
        title: 'Conseil: Budget par categorie',
        message: 'Definir des budgets par categorie vous aide a controler vos depenses et a identifier les postes a optimiser.',
      },
      {
        title: 'Conseil: Fonds d\'urgence',
        message: 'Visez a avoir 3 a 6 mois de depenses en reserve pour faire face aux imprevu.',
      },
    ];

    const randomTip = tips[Math.floor(Math.random() * tips.length)]!;

    return {
      id: `tip-${Date.now()}`,
      type: 'tip',
      title: randomTip.title,
      message: randomTip.message,
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
        return data?.transactionId ? `/transactions/${data.transactionId}` : '/transactions';
      case 'weekly_summary':
        return '/dashboard';
      case 'monthly_report':
        return '/reports';
      case 'low_balance_warning':
        return data?.accountId ? `/accounts/${data.accountId}` : '/accounts';
      case 'bill_upcoming':
        return '/recurrences';
      case 'budget_alert':
      case 'budget_warning':
        return data?.budgetId ? `/budgets/${data.budgetId}` : '/budgets';
      case 'savings_milestone':
      case 'savings_off_track':
        return data?.goalId ? `/savings/${data.goalId}` : '/savings';
      default:
        return undefined;
    }
  },

  /**
   * Get action label for a notification type
   */
  getActionLabel(notificationType: string): string | undefined {
    switch (notificationType) {
      case 'unusual_spending':
        return 'Voir la transaction';
      case 'weekly_summary':
        return 'Voir le tableau de bord';
      case 'monthly_report':
        return 'Voir le rapport';
      case 'low_balance_warning':
        return 'Voir le compte';
      case 'bill_upcoming':
        return 'Voir les echeances';
      case 'budget_alert':
      case 'budget_warning':
        return 'Voir le budget';
      case 'savings_milestone':
      case 'savings_off_track':
        return 'Voir l\'objectif';
      default:
        return undefined;
    }
  },
};

export default insightsService;
