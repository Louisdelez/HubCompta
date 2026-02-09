// ============================================================================
// SAVINGS GOAL CARD - Finance Hub
// Individual goal card with progress ring
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Pencil,
  Trash2,
  Plus,
  History,
  CheckCircle,
  RotateCcw,
  Target,
  CalendarClock,
  TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { SavingsProgress } from './SavingsProgress';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface SavingsGoalWithProgress {
  id: string;
  workspaceId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  targetDate: string | null;
  icon: string | null;
  color: string | null;
  accountId: string | null;
  account: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  isCompleted: boolean;
  completedAt: string | null;
  progress: number;
  remainingAmount: number;
  avgMonthlyContribution: number | null;
  projectedCompletionDate: string | null;
  daysUntilTarget: number | null;
  isOnTrack: boolean | null;
}

interface SavingsGoalCardProps {
  goal: SavingsGoalWithProgress;
  workspaceId: string;
  onEdit: () => void;
  onContribute: () => void;
  onViewHistory: () => void;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount);
}

function formatDate(dateString: string | null): string | null {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getDaysText(days: number | null): string | null {
  if (days === null) return null;
  if (days < 0) return 'En retard';
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Demain';
  if (days < 30) return `${days} jours`;
  if (days < 60) return '1 mois';
  return `${Math.round(days / 30)} mois`;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SavingsGoalCard({
  goal,
  workspaceId,
  onEdit,
  onContribute,
  onViewHistory,
}: SavingsGoalCardProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/workspaces/${workspaceId}/savings/${goal.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['savings', workspaceId] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => api.post(`/workspaces/${workspaceId}/savings/${goal.id}/complete`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['savings', workspaceId] });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: () => api.post(`/workspaces/${workspaceId}/savings/${goal.id}/reopen`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['savings', workspaceId] });
    },
  });

  const handleDelete = () => {
    if (confirm(`Supprimer l'objectif "${goal.name}" ?`)) {
      deleteMutation.mutate();
    }
  };

  const daysText = getDaysText(goal.daysUntilTarget);
  const projectedText = goal.projectedCompletionDate
    ? formatDate(goal.projectedCompletionDate)
    : null;

  return (
    <div
      className={clsx(
        'card relative overflow-hidden',
        goal.isCompleted && 'ring-2 ring-ctp-green',
        !goal.isCompleted && goal.isOnTrack === false && 'ring-2 ring-ctp-yellow'
      )}
    >
      {/* Completed indicator */}
      {goal.isCompleted && (
        <div className="absolute top-0 left-0 w-full h-1 bg-ctp-green" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Icon or Progress Ring */}
          <div className="relative">
            <SavingsProgress
              progress={goal.progress}
              size="sm"
              showLabel={false}
              {...(goal.color ? { color: goal.color } : {})}
              isCompleted={goal.isCompleted}
            />
            {goal.icon && (
              <span className="absolute inset-0 flex items-center justify-center text-xl">
                {goal.icon}
              </span>
            )}
          </div>
          <div>
            <h3 className="font-medium text-ctp-text">{goal.name}</h3>
            {goal.account && (
              <p className="text-sm text-ctp-subtext0 flex items-center gap-1">
                {goal.account.icon && <span>{goal.account.icon}</span>}
                {goal.account.name}
              </p>
            )}
          </div>
        </div>
        {goal.isCompleted ? (
          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-ctp-green/20 text-ctp-green font-medium">
            <CheckCircle className="w-3 h-3" />
            Atteint
          </span>
        ) : goal.isOnTrack === false ? (
          <span className="text-xs px-2 py-1 rounded-full bg-ctp-yellow/20 text-ctp-yellow font-medium">
            En retard
          </span>
        ) : goal.isOnTrack === true ? (
          <span className="text-xs px-2 py-1 rounded-full bg-ctp-green/20 text-ctp-green font-medium">
            En bonne voie
          </span>
        ) : null}
      </div>

      {/* Progress Info */}
      <div className="mb-4">
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-2xl font-bold text-ctp-text">
              {formatCurrency(goal.currentAmount, goal.currency)}
            </p>
            <p className="text-sm text-ctp-subtext0">
              sur {formatCurrency(goal.targetAmount, goal.currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-ctp-text">{goal.progress}%</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-ctp-surface1 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-500',
              goal.isCompleted
                ? 'bg-ctp-green'
                : goal.color
                  ? ''
                  : goal.progress >= 75
                    ? 'bg-ctp-blue'
                    : goal.progress >= 50
                      ? 'bg-ctp-teal'
                      : goal.progress >= 25
                        ? 'bg-ctp-yellow'
                        : 'bg-ctp-peach'
            )}
            style={{
              width: `${Math.min(goal.progress, 100)}%`,
              backgroundColor: !goal.isCompleted && goal.color ? goal.color : undefined,
            }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        {/* Remaining */}
        {!goal.isCompleted && (
          <div className="flex items-start gap-2">
            <Target className="w-4 h-4 text-ctp-subtext0 mt-0.5" />
            <div>
              <p className="text-ctp-subtext0">Reste</p>
              <p className="font-medium text-ctp-text">
                {formatCurrency(goal.remainingAmount, goal.currency)}
              </p>
            </div>
          </div>
        )}

        {/* Target Date */}
        {goal.targetDate && (
          <div className="flex items-start gap-2">
            <CalendarClock className="w-4 h-4 text-ctp-subtext0 mt-0.5" />
            <div>
              <p className="text-ctp-subtext0">Objectif</p>
              <p className="font-medium text-ctp-text">{daysText}</p>
            </div>
          </div>
        )}

        {/* Monthly Average */}
        {goal.avgMonthlyContribution !== null && (
          <div className="flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-ctp-subtext0 mt-0.5" />
            <div>
              <p className="text-ctp-subtext0">Moyenne/mois</p>
              <p className="font-medium text-ctp-text">
                {formatCurrency(goal.avgMonthlyContribution, goal.currency)}
              </p>
            </div>
          </div>
        )}

        {/* Projected Completion */}
        {projectedText && !goal.isCompleted && (
          <div className="flex items-start gap-2">
            <CalendarClock className="w-4 h-4 text-ctp-subtext0 mt-0.5" />
            <div>
              <p className="text-ctp-subtext0">Fin estimee</p>
              <p className="font-medium text-ctp-text">{projectedText}</p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-ctp-surface1">
        {!goal.isCompleted && (
          <button
            onClick={onContribute}
            className="btn-primary text-sm flex-1 flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        )}
        <button
          onClick={onViewHistory}
          className="btn-ghost text-sm flex items-center justify-center gap-1"
          title="Historique"
        >
          <History className="w-4 h-4" />
        </button>
        <button
          onClick={onEdit}
          className="btn-ghost text-sm flex items-center justify-center gap-1"
          title="Modifier"
        >
          <Pencil className="w-4 h-4" />
        </button>
        {goal.isCompleted ? (
          <button
            onClick={() => reopenMutation.mutate()}
            className="btn-ghost text-sm flex items-center justify-center gap-1"
            title="Rouvrir"
            disabled={reopenMutation.isPending}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => completeMutation.mutate()}
            className="btn-ghost text-ctp-green text-sm"
            title="Marquer comme atteint"
            disabled={completeMutation.isPending}
          >
            <CheckCircle className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleDelete}
          className="btn-ghost text-ctp-red text-sm"
          title="Supprimer"
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default SavingsGoalCard;
