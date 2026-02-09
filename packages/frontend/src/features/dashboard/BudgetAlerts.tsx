// ============================================================================
// BUDGET ALERTS - Finance Hub Dashboard
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { Wallet, AlertCircle, AlertTriangle, Zap, CheckCircle } from 'lucide-react';
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
  icon: typeof AlertCircle;
} {
  switch (level) {
    case 'over':
      return {
        bg: 'bg-ctp-red/10',
        text: 'text-ctp-red',
        icon: AlertCircle,
      };
    case 'danger':
      return {
        bg: 'bg-ctp-red/10',
        text: 'text-ctp-red',
        icon: AlertTriangle,
      };
    case 'warning':
      return {
        bg: 'bg-ctp-peach/10',
        text: 'text-ctp-peach',
        icon: Zap,
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
    <div className="bg-ctp-surface0 rounded-xl p-5 border border-ctp-surface1">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ctp-text flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-ctp-mauve/20">
            <Wallet className="w-5 h-5 text-ctp-mauve" />
          </div>
          Budgets
        </h2>
        <Link to="/budgets" className="text-sm text-ctp-blue hover:text-ctp-sapphire hover:underline transition-colors">
          Voir tout
        </Link>
      </div>

      {/* Summary Bar */}
      <div className="mb-4 p-3 bg-ctp-mantle rounded-lg">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-ctp-subtext0">
            {formatCurrency(summary.totalSpent)} / {formatCurrency(summary.totalBudgeted)}
          </span>
          <span
            className={clsx(
              'font-semibold',
              summary.overallPercent >= 100
                ? 'text-ctp-red'
                : summary.overallPercent >= 80
                  ? 'text-ctp-peach'
                  : 'text-ctp-green'
            )}
          >
            {summary.overallPercent}%
          </span>
        </div>
        <div className="h-3 bg-ctp-surface1 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-500',
              summary.overallPercent >= 100
                ? 'bg-ctp-red'
                : summary.overallPercent >= 80
                  ? 'bg-ctp-peach'
                  : 'bg-ctp-green'
            )}
            style={{ width: `${Math.min(summary.overallPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Status Pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {summary.budgetsOnTrack > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-ctp-green/20 text-ctp-green border border-ctp-green/30">
            <CheckCircle className="w-3 h-3" />
            {summary.budgetsOnTrack} OK
          </span>
        )}
        {summary.budgetsAtRisk > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-ctp-peach/20 text-ctp-peach border border-ctp-peach/30">
            <Zap className="w-3 h-3" />
            {summary.budgetsAtRisk} attention
          </span>
        )}
        {summary.budgetsOverspent > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-ctp-red/20 text-ctp-red border border-ctp-red/30">
            <AlertCircle className="w-3 h-3" />
            {summary.budgetsOverspent} depasse{summary.budgetsOverspent > 1 ? 's' : ''}
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
                className={clsx(
                  'p-3 rounded-lg border transition-all hover:shadow-sm',
                  styles.bg,
                  alert.level === 'over' || alert.level === 'danger'
                    ? 'border-ctp-red/20'
                    : 'border-ctp-peach/20'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={clsx(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      alert.level === 'over' || alert.level === 'danger'
                        ? 'bg-ctp-red/20'
                        : 'bg-ctp-peach/20'
                    )}
                  >
                    {alert.categoryIcon ? (
                      <span className="text-base">{alert.categoryIcon}</span>
                    ) : (
                      <styles.icon className={clsx('w-4 h-4', styles.text)} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={clsx('font-medium text-sm', styles.text)}>
                      {alert.budgetName}
                    </p>
                    <p className="text-xs text-ctp-subtext0 truncate">
                      {alert.message}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={clsx('font-bold text-base', styles.text)}>
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
              className="block text-center text-sm text-ctp-blue hover:text-ctp-sapphire hover:underline py-2 transition-colors"
            >
              + {alerts.length - 3} autre{alerts.length - 3 > 1 ? 's' : ''} alerte{alerts.length - 3 > 1 ? 's' : ''}
            </Link>
          )}
        </div>
      )}

      {/* No Alerts - All Good */}
      {(!alerts || alerts.length === 0) && (
        <div className="text-center py-6 bg-ctp-green/5 rounded-lg border border-ctp-green/20">
          <div className="w-12 h-12 mx-auto bg-ctp-green/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-ctp-green" />
          </div>
          <p className="text-sm font-medium text-ctp-green mt-3">
            Tous vos budgets sont sous controle
          </p>
          <p className="text-xs text-ctp-subtext0 mt-1">
            Continuez ainsi !
          </p>
        </div>
      )}
    </div>
  );
}

export default BudgetAlerts;
