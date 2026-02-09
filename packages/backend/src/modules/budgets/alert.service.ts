// ============================================================================
// BUDGET ALERT SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { budgetService } from './budget.service.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type AlertLevel = 'warning' | 'danger' | 'over';

export interface BudgetAlert {
  budgetId: string;
  budgetName: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  level: AlertLevel;
  percentUsed: number;
  spent: number;
  budgeted: number;
  remaining: number;
  message: string;
}

export interface AlertThresholds {
  warning: number; // Default 80%
  danger: number;  // Default 95%
}

// ----------------------------------------------------------------------------
// Alert Service
// ----------------------------------------------------------------------------

export const alertService = {
  /**
   * Get alert level based on percentage used
   */
  getAlertLevel(
    percentUsed: number,
    thresholds: AlertThresholds = { warning: 80, danger: 95 }
  ): AlertLevel | null {
    if (percentUsed >= 100) return 'over';
    if (percentUsed >= thresholds.danger) return 'danger';
    if (percentUsed >= thresholds.warning) return 'warning';
    return null;
  },

  /**
   * Get alert message based on level and percent
   */
  getAlertMessage(level: AlertLevel, percentUsed: number, remaining: number): string {
    const formattedRemaining = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(remaining);

    switch (level) {
      case 'over':
        return `Budget dépassé de ${percentUsed - 100}%`;
      case 'danger':
        return `Attention: ${percentUsed}% utilisé - ${formattedRemaining} restant`;
      case 'warning':
        return `${percentUsed}% du budget utilisé - ${formattedRemaining} restant`;
      default:
        return '';
    }
  },

  /**
   * Get all active alerts for a workspace
   */
  async getActiveAlerts(workspaceId: string): Promise<BudgetAlert[]> {
    const budgets = await budgetService.list(workspaceId);
    const alerts: BudgetAlert[] = [];

    for (const budget of budgets) {
      const level = this.getAlertLevel(budget.percentUsed, {
        warning: budget.alertThreshold,
        danger: 95,
      });

      if (level) {
        alerts.push({
          budgetId: budget.id,
          budgetName: budget.name,
          categoryName: budget.category.name,
          categoryIcon: budget.category.icon,
          categoryColor: budget.category.color,
          level,
          percentUsed: budget.percentUsed,
          spent: budget.spent,
          budgeted: budget.amount.toNumber(),
          remaining: budget.remaining,
          message: this.getAlertMessage(level, budget.percentUsed, budget.remaining),
        });
      }
    }

    // Sort by severity (over > danger > warning), then by percentage
    const levelOrder = { over: 0, danger: 1, warning: 2 };
    return alerts.sort((a, b) => {
      const levelDiff = levelOrder[a.level] - levelOrder[b.level];
      if (levelDiff !== 0) return levelDiff;
      return b.percentUsed - a.percentUsed;
    });
  },

  /**
   * Check if a new transaction would trigger any alerts
   */
  async checkTransactionImpact(
    workspaceId: string,
    categoryId: string | null,
    amount: number
  ): Promise<BudgetAlert | null> {
    if (!categoryId || amount >= 0) return null; // Only check expenses

    // Find budget for this category
    const budget = await prisma.budget.findFirst({
      where: {
        workspaceId,
        categoryId,
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
    });

    if (!budget) return null;

    // Get current budget with progress
    const budgetWithProgress = await budgetService.getById(workspaceId, budget.id);
    if (!budgetWithProgress) return null;

    // Calculate what the new percentage would be after this transaction
    const newSpent = budgetWithProgress.spent + Math.abs(amount);
    const budgeted = budgetWithProgress.amount.toNumber();
    const newPercentUsed = budgeted > 0 ? Math.round((newSpent / budgeted) * 100) : 0;
    const newRemaining = Math.max(0, budgeted - newSpent);

    // Check if this would trigger or worsen an alert
    const currentLevel = this.getAlertLevel(budgetWithProgress.percentUsed, {
      warning: budget.alertThreshold,
      danger: 95,
    });
    const newLevel = this.getAlertLevel(newPercentUsed, {
      warning: budget.alertThreshold,
      danger: 95,
    });

    // Only alert if the level is new or worsened
    if (newLevel && (!currentLevel || newLevel !== currentLevel)) {
      return {
        budgetId: budget.id,
        budgetName: budget.name,
        categoryName: budget.category.name,
        categoryIcon: budget.category.icon,
        categoryColor: budget.category.color,
        level: newLevel,
        percentUsed: newPercentUsed,
        spent: newSpent,
        budgeted,
        remaining: newRemaining,
        message: this.getAlertMessage(newLevel, newPercentUsed, newRemaining),
      };
    }

    return null;
  },

  /**
   * Get budget progress summary for dashboard
   */
  async getDashboardSummary(workspaceId: string): Promise<{
    budgetsOnTrack: number;
    budgetsAtRisk: number;
    budgetsOverspent: number;
    totalBudgeted: number;
    totalSpent: number;
    overallPercent: number;
  }> {
    const budgets = await budgetService.list(workspaceId);

    let budgetsOnTrack = 0;
    let budgetsAtRisk = 0;
    let budgetsOverspent = 0;
    let totalBudgeted = 0;
    let totalSpent = 0;

    for (const budget of budgets) {
      const budgetAmount = budget.amount.toNumber();
      totalBudgeted += budgetAmount;
      totalSpent += budget.spent;

      if (budget.isOverBudget) {
        budgetsOverspent++;
      } else if (budget.isAlertTriggered) {
        budgetsAtRisk++;
      } else {
        budgetsOnTrack++;
      }
    }

    return {
      budgetsOnTrack,
      budgetsAtRisk,
      budgetsOverspent,
      totalBudgeted,
      totalSpent,
      overallPercent: totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0,
    };
  },
};

export default alertService;
