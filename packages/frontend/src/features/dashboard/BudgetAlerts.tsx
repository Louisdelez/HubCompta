// ============================================================================
// BUDGET ALERTS - Finance Hub Dashboard
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface BudgetAlert {
  budgetId: string;
  budgetName: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  level: 'warning' | 'danger' | 'over';
  percentUsed: number;
  spent: number;
  budgeted: number;
  remaining: number;
  message: string;
}

interface BudgetDashboardSummary {
  budgetsOnTrack: number;
  budgetsAtRisk: number;
  budgetsOverspent: number;
  totalBudgeted: number;
  totalSpent: number;
  overallPercent: number;
}

interface BudgetAlertsProps {
  workspaceId: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function getAlertStyles(level: 'warning' | 'danger' | 'over'): {
  bg: string;
  text: string;
  icon: string;
} {
  switch (level) {
    case 'over':
      return {
        bg: 'bg-danger-50 dark:bg-danger-900/20',
        text: 'text-danger-700 dark:text-danger-300',
        icon: '🚨',
      };
    case 'danger':
      return {
        bg: 'bg-danger-50 dark:bg-danger-900/20',
        text: 'text-danger-700 dark:text-danger-300',
        icon: '⚠️',
      };
    case 'warning':
      return {
        bg: 'bg-warning-50 dark:bg-warning-900/20',
        text: 'text-warning-700 dark:text-warning-300',
        icon: '⚡',
      };
  }
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function BudgetAlerts({ workspaceId }: BudgetAlertsProps) {
  // Fetch alerts
  const { data: alerts } = useQuery({
    queryKey: ['budgets', workspaceId, 'alerts'],
    queryFn: () => api.get<BudgetAlert[]>(`/workspaces/${workspaceId}/budgets/alerts`),
    enabled: !!workspaceId,
  });

  // Fetch dashboard summary
  const { data: summary } = useQuery({
    queryKey: ['budgets', workspaceId, 'dashboard'],
    queryFn: () => api.get<BudgetDashboardSummary>(`/workspaces/${workspaceId}/budgets/dashboard`),
    enabled: !!workspaceId,
  });

  // Don't render if no budgets exist
  if (!summary || (summary.budgetsOnTrack === 0 && summary.budgetsAtRisk === 0 && summary.budgetsOverspent === 0)) {
    return null;
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>💰</span>
          Budgets
        </h2>
        <Link to="/budgets" className="text-sm text-primary-600 hover:underline">
          Voir tout →
        </Link>
      </div>

      {/* Summary Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600 dark:text-gray-400">
            {formatCurrency(summary.totalSpent)} / {formatCurrency(summary.totalBudgeted)}
          </span>
          <span className="font-medium">{summary.overallPercent}%</span>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all',
              summary.overallPercent >= 100
                ? 'bg-danger-500'
                : summary.overallPercent >= 80
                  ? 'bg-warning-500'
                  : 'bg-success-500'
            )}
            style={{ width: `${Math.min(summary.overallPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Status Pills */}
      <div className="flex gap-2 mb-4">
        {summary.budgetsOnTrack > 0 && (
          <span className="px-2 py-1 text-xs rounded-full bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300">
            {summary.budgetsOnTrack} OK
          </span>
        )}
        {summary.budgetsAtRisk > 0 && (
          <span className="px-2 py-1 text-xs rounded-full bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300">
            {summary.budgetsAtRisk} attention
          </span>
        )}
        {summary.budgetsOverspent > 0 && (
          <span className="px-2 py-1 text-xs rounded-full bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300">
            {summary.budgetsOverspent} dépassé{summary.budgetsOverspent > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Alerts List */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((alert) => {
            const styles = getAlertStyles(alert.level);

            return (
              <div
                key={alert.budgetId}
                className={clsx('p-3 rounded-lg', styles.bg)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{alert.categoryIcon ?? styles.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={clsx('font-medium text-sm', styles.text)}>
                      {alert.budgetName}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {alert.message}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={clsx('font-bold text-sm', styles.text)}>
                      {alert.percentUsed}%
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {alerts.length > 3 && (
            <Link
              to="/budgets"
              className="block text-center text-sm text-primary-600 hover:underline py-2"
            >
              + {alerts.length - 3} autre{alerts.length - 3 > 1 ? 's' : ''} alerte{alerts.length - 3 > 1 ? 's' : ''}
            </Link>
          )}
        </div>
      )}

      {/* No Alerts - All Good */}
      {(!alerts || alerts.length === 0) && (
        <div className="text-center py-4">
          <span className="text-3xl">✅</span>
          <p className="text-sm text-gray-500 mt-2">
            Tous vos budgets sont sous contrôle
          </p>
        </div>
      )}
    </div>
  );
}

export default BudgetAlerts;
