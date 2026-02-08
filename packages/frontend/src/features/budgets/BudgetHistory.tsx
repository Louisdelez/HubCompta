// ============================================================================
// BUDGET HISTORY - Finance Hub
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface BudgetWithProgress {
  id: string;
  name: string;
  amount: number;
  period: 'monthly' | 'yearly';
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  };
}

interface BudgetHistoryEntry {
  period: string;
  budgeted: number;
  spent: number;
  percentUsed: number;
}

interface BudgetHistoryProps {
  workspaceId: string;
  budget: BudgetWithProgress;
  onClose: () => void;
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

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function BudgetHistory({ workspaceId, budget, onClose }: BudgetHistoryProps) {
  const months = budget.period === 'monthly' ? 12 : 5;

  const { data: history, isLoading } = useQuery({
    queryKey: ['budget-history', budget.id, months],
    queryFn: () =>
      api.get<BudgetHistoryEntry[]>(
        `/workspaces/${workspaceId}/budgets/${budget.id}/history?months=${months}`
      ),
  });

  // Find max value for scaling
  const maxValue = history
    ? Math.max(...history.map((h) => Math.max(h.budgeted, h.spent)))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto animate-scale-in">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{budget.category.icon ?? '📁'}</span>
              <div>
                <h2 className="text-xl font-bold">{budget.name}</h2>
                <p className="text-gray-500 text-sm">
                  Historique {budget.period === 'monthly' ? 'mensuel' : 'annuel'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="btn-ghost text-xl">
              ✕
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-gray-500">Chargement...</p>
            </div>
          ) : history && history.length > 0 ? (
            <>
              {/* Chart */}
              <div className="mb-6">
                <div className="flex items-end gap-2 h-48">
                  {history.map((entry, index) => {
                    const budgetHeight = maxValue > 0 ? (entry.budgeted / maxValue) * 100 : 0;
                    const spentHeight = maxValue > 0 ? (entry.spent / maxValue) * 100 : 0;
                    const isOverBudget = entry.spent > entry.budgeted;

                    return (
                      <div
                        key={index}
                        className="flex-1 flex flex-col items-center gap-1"
                      >
                        {/* Bars */}
                        <div className="w-full flex gap-1 items-end h-40">
                          {/* Budget bar */}
                          <div
                            className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-t"
                            style={{ height: `${budgetHeight}%` }}
                            title={`Budget: ${formatCurrency(entry.budgeted)}`}
                          />
                          {/* Spent bar */}
                          <div
                            className={clsx(
                              'flex-1 rounded-t',
                              isOverBudget
                                ? 'bg-danger-500'
                                : entry.percentUsed >= 80
                                  ? 'bg-warning-500'
                                  : 'bg-primary-500'
                            )}
                            style={{ height: `${spentHeight}%` }}
                            title={`Dépensé: ${formatCurrency(entry.spent)}`}
                          />
                        </div>
                        {/* Label */}
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {entry.period}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Budget</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-primary-500 rounded" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Dépensé</span>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3">Période</th>
                      <th className="text-right py-2 px-3">Budget</th>
                      <th className="text-right py-2 px-3">Dépensé</th>
                      <th className="text-right py-2 px-3">%</th>
                      <th className="text-right py-2 px-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry, index) => {
                      const isOverBudget = entry.spent > entry.budgeted;
                      const isAtRisk = entry.percentUsed >= 80 && !isOverBudget;

                      return (
                        <tr
                          key={index}
                          className="border-b border-gray-100 dark:border-gray-800"
                        >
                          <td className="py-2 px-3 font-medium">{entry.period}</td>
                          <td className="py-2 px-3 text-right">
                            {formatCurrency(entry.budgeted)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {formatCurrency(entry.spent)}
                          </td>
                          <td className="py-2 px-3 text-right">{entry.percentUsed}%</td>
                          <td className="py-2 px-3 text-right">
                            {isOverBudget ? (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300">
                                Dépassé
                              </span>
                            ) : isAtRisk ? (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300">
                                Attention
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300">
                                OK
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-500">Moyenne dépensée</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(
                        history.reduce((sum, h) => sum + h.spent, 0) / history.length
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Mois dépassés</p>
                    <p className="text-lg font-bold text-danger-600">
                      {history.filter((h) => h.spent > h.budgeted).length}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Taux moyen</p>
                    <p className="text-lg font-bold">
                      {Math.round(
                        history.reduce((sum, h) => sum + h.percentUsed, 0) / history.length
                      )}
                      %
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📊</div>
              <p className="text-gray-500">Pas encore d'historique disponible</p>
            </div>
          )}

          {/* Close Button */}
          <button onClick={onClose} className="btn-secondary w-full mt-6">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

export default BudgetHistory;
