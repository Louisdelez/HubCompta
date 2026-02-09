// ============================================================================
// BUDGET HISTORY - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { X, BarChart3, Folder } from 'lucide-react';
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
      <div className="relative bg-ctp-base rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto animate-scale-in">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {budget.category.icon ? (
                <span className="text-3xl">{budget.category.icon}</span>
              ) : (
                <Folder className="w-8 h-8 text-ctp-subtext0" />
              )}
              <div>
                <h2 className="text-xl font-bold">{budget.name}</h2>
                <p className="text-ctp-subtext0 text-sm">
                  Historique {budget.period === 'monthly' ? 'mensuel' : 'annuel'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="btn-ghost">
              <X className="w-5 h-5" />
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-ctp-blue border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-ctp-subtext0">Chargement...</p>
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
                            className="flex-1 bg-ctp-surface1 rounded-t"
                            style={{ height: `${budgetHeight}%` }}
                            title={`Budget: ${formatCurrency(entry.budgeted)}`}
                          />
                          {/* Spent bar */}
                          <div
                            className={clsx(
                              'flex-1 rounded-t',
                              isOverBudget
                                ? 'bg-ctp-red'
                                : entry.percentUsed >= 80
                                  ? 'bg-ctp-yellow'
                                  : 'bg-ctp-blue'
                            )}
                            style={{ height: `${spentHeight}%` }}
                            title={`Dépensé: ${formatCurrency(entry.spent)}`}
                          />
                        </div>
                        {/* Label */}
                        <span className="text-xs text-ctp-subtext0 whitespace-nowrap">
                          {entry.period}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-ctp-surface1 rounded" />
                    <span className="text-sm text-ctp-subtext0">Budget</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-ctp-blue rounded" />
                    <span className="text-sm text-ctp-subtext0">Dépensé</span>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ctp-surface1">
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
                          className="border-b border-ctp-surface0"
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
                              <span className="px-2 py-0.5 rounded-full text-xs bg-ctp-red/20 text-ctp-red">
                                Dépassé
                              </span>
                            ) : isAtRisk ? (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-ctp-yellow/20 text-ctp-yellow">
                                Attention
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-ctp-green/20 text-ctp-green">
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
              <div className="mt-6 p-4 bg-ctp-surface0 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-ctp-subtext0">Moyenne dépensée</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(
                        history.reduce((sum, h) => sum + h.spent, 0) / history.length
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-ctp-subtext0">Mois dépassés</p>
                    <p className="text-lg font-bold text-ctp-red">
                      {history.filter((h) => h.spent > h.budgeted).length}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-ctp-subtext0">Taux moyen</p>
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
              <BarChart3 className="w-10 h-10 mx-auto mb-4 text-ctp-overlay1" />
              <p className="text-ctp-subtext0">Pas encore d'historique disponible</p>
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
