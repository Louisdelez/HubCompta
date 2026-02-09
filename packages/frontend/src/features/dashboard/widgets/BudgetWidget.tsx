// ============================================================================
// BUDGET WIDGET - Finance Hub Dashboard
// Displays budget progress bars
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { PieChart, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import type { WidgetProps } from './index';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface BudgetWithProgress {
  id: string;
  name: string;
  amount: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  isOverBudget: boolean;
  isAlertTriggered: boolean;
  category: {
    id: string;
    name: string;
    icon: string | null;
  };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getProgressColor(percentUsed: number, isOverBudget: boolean, isAlertTriggered: boolean): string {
  if (isOverBudget) return 'bg-ctp-red';
  if (isAlertTriggered) return 'bg-ctp-yellow';
  if (percentUsed >= 50) return 'bg-ctp-blue';
  return 'bg-ctp-green';
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function BudgetWidget({ workspaceId }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['budgets-widget', workspaceId],
    queryFn: () => api.get<BudgetWithProgress[]>(`/workspaces/${workspaceId}/budgets`),
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="animate-pulse space-y-3 flex-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <div className="h-4 bg-ctp-surface1 rounded w-1/3" />
                <div className="h-4 bg-ctp-surface1 rounded w-16" />
              </div>
              <div className="h-2 bg-ctp-surface1 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const budgets = data ?? [];
  const activeBudgets = budgets.slice(0, 5);
  const alertCount = budgets.filter((b) => b.isOverBudget || b.isAlertTriggered).length;

  return (
    <div className="h-full flex flex-col">
      {/* Alert Summary */}
      {alertCount > 0 && (
        <div className="mb-3 p-2 bg-ctp-yellow/10 border border-ctp-yellow/30 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-ctp-yellow flex-shrink-0" />
          <p className="text-xs text-ctp-yellow">
            {alertCount} budget{alertCount > 1 ? 's' : ''} en alerte
          </p>
        </div>
      )}

      {/* Budget List */}
      <div className="flex-1 overflow-y-auto space-y-3 -mx-1 px-1">
        {activeBudgets.length === 0 ? (
          <div className="text-center py-4">
            <PieChart className="w-8 h-8 mx-auto text-ctp-overlay1 mb-2" />
            <p className="text-sm text-ctp-subtext0">Aucun budget</p>
            <Link
              to="/budgets"
              className="text-xs text-ctp-blue hover:underline"
            >
              Creer un budget
            </Link>
          </div>
        ) : (
          activeBudgets.map((budget) => {
            const progressWidth = Math.min(budget.percentUsed, 100);
            const progressColor = getProgressColor(
              budget.percentUsed,
              budget.isOverBudget,
              budget.isAlertTriggered
            );

            return (
              <Link
                key={budget.id}
                to={`/budgets`}
                className="block p-2 rounded-lg hover:bg-ctp-mantle transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {budget.category.icon && (
                      <span className="text-sm">{budget.category.icon}</span>
                    )}
                    <span className="text-sm font-medium text-ctp-text truncate">
                      {budget.name}
                    </span>
                  </div>
                  <span className={clsx(
                    'text-xs font-semibold flex-shrink-0',
                    budget.isOverBudget ? 'text-ctp-red' : 'text-ctp-subtext0'
                  )}>
                    {budget.percentUsed}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-ctp-surface1 rounded-full overflow-hidden mb-1">
                  <div
                    className={clsx('h-full rounded-full transition-all', progressColor)}
                    style={{ width: `${progressWidth}%` }}
                  />
                </div>

                {/* Amounts */}
                <div className="flex justify-between text-xs text-ctp-subtext0">
                  <span>{formatCurrency(budget.spent)}</span>
                  <span>{formatCurrency(Number(budget.amount))}</span>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* View All Link */}
      {budgets.length > 5 && (
        <Link
          to="/budgets"
          className="mt-2 pt-2 border-t border-ctp-surface1 text-center text-sm text-ctp-blue hover:text-ctp-sapphire transition-colors"
        >
          Voir les {budgets.length} budgets
        </Link>
      )}
    </div>
  );
}

export default BudgetWidget;
