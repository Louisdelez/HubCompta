// ============================================================================
// SAVINGS WIDGET - Finance Hub Dashboard
// Displays savings goals progress
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { Target, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import type { WidgetProps } from './index';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  targetDate?: string;
  icon?: string;
  color?: string;
  isCompleted: boolean;
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    month: 'short',
    year: 'numeric',
  });
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SavingsWidget({ workspaceId }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['savings-widget', workspaceId],
    queryFn: () => api.get<SavingsGoal[]>(`/workspaces/${workspaceId}/savings`),
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="animate-pulse space-y-3 flex-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 p-2">
              <div className="flex justify-between">
                <div className="h-4 bg-ctp-surface1 rounded w-1/2" />
                <div className="h-4 bg-ctp-surface1 rounded w-16" />
              </div>
              <div className="h-2 bg-ctp-surface1 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const goals = data ?? [];
  const activeGoals = goals.filter((g) => !g.isCompleted).slice(0, 4);
  const completedCount = goals.filter((g) => g.isCompleted).length;

  return (
    <div className="h-full flex flex-col">
      {/* Completed Summary */}
      {completedCount > 0 && (
        <div className="mb-3 p-2 bg-ctp-green/10 border border-ctp-green/30 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-ctp-green flex-shrink-0" />
          <p className="text-xs text-ctp-green">
            {completedCount} objectif{completedCount > 1 ? 's' : ''} atteint{completedCount > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Goals List */}
      <div className="flex-1 overflow-y-auto space-y-3 -mx-1 px-1">
        {activeGoals.length === 0 ? (
          <div className="text-center py-4">
            <Target className="w-8 h-8 mx-auto text-ctp-overlay1 mb-2" />
            <p className="text-sm text-ctp-subtext0">Aucun objectif en cours</p>
            <Link
              to="/savings"
              className="text-xs text-ctp-blue hover:underline"
            >
              Creer un objectif
            </Link>
          </div>
        ) : (
          activeGoals.map((goal) => {
            const progress = (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100;
            const progressWidth = Math.min(progress, 100);

            return (
              <Link
                key={goal.id}
                to="/savings"
                className="block p-2 rounded-lg hover:bg-ctp-mantle transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {goal.icon ? (
                      <span className="text-sm">{goal.icon}</span>
                    ) : (
                      <Target className="w-4 h-4 text-ctp-blue" />
                    )}
                    <span className="text-sm font-medium text-ctp-text truncate">
                      {goal.name}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-ctp-subtext0 flex-shrink-0">
                    {progress.toFixed(0)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-ctp-surface1 rounded-full overflow-hidden mb-1">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all',
                      progress >= 100 ? 'bg-ctp-green' : progress >= 50 ? 'bg-ctp-blue' : 'bg-ctp-peach'
                    )}
                    style={{ width: `${progressWidth}%` }}
                  />
                </div>

                {/* Amounts */}
                <div className="flex justify-between text-xs text-ctp-subtext0">
                  <span>{formatCurrency(Number(goal.currentAmount))}</span>
                  <span>
                    {goal.targetDate && (
                      <span className="mr-2">{formatDate(goal.targetDate)}</span>
                    )}
                    {formatCurrency(Number(goal.targetAmount))}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* View All Link */}
      {goals.length > 4 && (
        <Link
          to="/savings"
          className="mt-2 pt-2 border-t border-ctp-surface1 text-center text-sm text-ctp-blue hover:text-ctp-sapphire transition-colors"
        >
          Voir les {goals.length} objectifs
        </Link>
      )}
    </div>
  );
}

export default SavingsWidget;
