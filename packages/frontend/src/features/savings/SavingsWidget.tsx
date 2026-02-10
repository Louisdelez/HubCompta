// ============================================================================
// SAVINGS WIDGET - Finance Hub
// Dashboard widget for savings goals overview
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Target, ArrowRight, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { SavingsProgress } from './SavingsProgress';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface SavingsSummary {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  totalTargetAmount: number;
  totalCurrentAmount: number;
  totalRemainingAmount: number;
  overallProgress: number;
  goalsByCurrency: Record<string, { target: number; current: number; count: number }>;
}

interface SavingsGoalWithProgress {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  icon: string | null;
  color: string | null;
  progress: number;
  isCompleted: boolean;
  isOnTrack: boolean | null;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SavingsWidget() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();

  const { data: summary } = useQuery({
    queryKey: ['savings', workspaceId, 'summary'],
    queryFn: () => api.get<SavingsSummary>(`/workspaces/${workspaceId}/savings/summary`),
    enabled: !!workspaceId,
  });

  const { data: goals } = useQuery({
    queryKey: ['savings', workspaceId, 'list'],
    queryFn: () => api.get<SavingsGoalWithProgress[]>(`/workspaces/${workspaceId}/savings`),
    enabled: !!workspaceId,
  });

  if (!workspaceId) return null;

  // Show nothing if no goals
  if (!summary || summary.totalGoals === 0) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Target className="w-5 h-5" />
            Objectifs d'epargne
          </h3>
        </div>
        <div className="text-center py-6">
          <Target className="w-10 h-10 mx-auto mb-2 text-ctp-overlay1" />
          <p className="text-ctp-subtext0 mb-3">Aucun objectif</p>
          <Link to="/savings" className="btn-primary text-sm">
            Creer un objectif
          </Link>
        </div>
      </div>
    );
  }

  // Get top 3 active goals (sorted by progress desc)
  const topGoals = (goals ?? [])
    .filter(g => !g.isCompleted)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Target className="w-5 h-5" />
          Objectifs d'epargne
        </h3>
        <Link
          to="/savings"
          className="text-sm text-ctp-blue hover:text-ctp-sapphire flex items-center gap-1"
        >
          Voir tout <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="flex items-center gap-4 mb-4 p-3 bg-ctp-surface0 rounded-lg">
        <SavingsProgress
          progress={summary.overallProgress}
          size="sm"
          showLabel={true}
        />
        <div className="flex-1">
          <p className="text-sm text-ctp-subtext0">Total epargne</p>
          <p className="font-bold text-lg text-ctp-text">
            {formatCurrency(summary.totalCurrentAmount)}
          </p>
          <p className="text-xs text-ctp-subtext0">
            sur {formatCurrency(summary.totalTargetAmount)}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-ctp-green text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>{summary.completedGoals}</span>
          </div>
          <p className="text-xs text-ctp-subtext0">atteints</p>
        </div>
      </div>

      {/* Top Goals */}
      <div className="space-y-3">
        {topGoals.map((goal) => (
          <Link
            key={goal.id}
            to="/savings"
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-ctp-surface0 transition-colors"
          >
            <div className="relative w-10 h-10">
              <SavingsProgress
                progress={goal.progress}
                size="sm"
                showLabel={false}
                {...(goal.color ? { color: goal.color } : {})}
              />
              {goal.icon && (
                <span className="absolute inset-0 flex items-center justify-center text-sm">
                  {goal.icon}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-ctp-text truncate">{goal.name}</p>
              <p className="text-xs text-ctp-subtext0">
                {formatCurrency(goal.currentAmount, goal.currency)} / {formatCurrency(goal.targetAmount, goal.currency)}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`text-sm font-medium ${
                  goal.progress >= 75
                    ? 'text-ctp-green'
                    : goal.progress >= 50
                      ? 'text-ctp-blue'
                      : goal.progress >= 25
                        ? 'text-ctp-yellow'
                        : 'text-ctp-peach'
                }`}
              >
                {goal.progress}%
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* More goals indicator */}
      {summary.activeGoals > 3 && (
        <p className="text-center text-xs text-ctp-subtext0 mt-3">
          +{summary.activeGoals - 3} autres objectifs
        </p>
      )}
    </div>
  );
}

export default SavingsWidget;
