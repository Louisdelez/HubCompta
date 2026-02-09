// ============================================================================
// RECURRENCE CARD - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, Pause, Play, Zap, SkipForward, Calendar, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface RecurrenceTemplate {
  type: 'income' | 'expense';
  amount: number;
  description: string;
  accountId: string;
  categoryId?: string;
  tags?: string[];
  notes?: string;
  account?: {
    id: string;
    name: string;
  };
  category?: {
    id: string;
    name: string;
    icon: string | null;
  };
}

interface Recurrence {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  dayOfMonth?: number;
  dayOfWeek?: number;
  template: RecurrenceTemplate;
  startAt: string;
  endAt?: string | null;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  isActive: boolean;
  executionCount: number;
}

interface RecurrenceCardProps {
  recurrence: Recurrence;
  workspaceId: string;
  onEdit: () => void;
  onViewUpcoming: () => void;
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

function formatDate(date: string | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatRelativeDate(date: string | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  const now = new Date();
  const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff < 7) return `Dans ${diff} jours`;
  if (diff < 30) return `Dans ${Math.ceil(diff / 7)} semaine${diff >= 14 ? 's' : ''}`;
  return formatDate(date);
}

function getFrequencyLabel(
  frequency: string,
  interval: number,
  dayOfMonth?: number,
  dayOfWeek?: number
): string {
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  if (interval === 1) {
    switch (frequency) {
      case 'daily':
        return 'Tous les jours';
      case 'weekly':
        return dayOfWeek !== undefined ? `Tous les ${dayNames[dayOfWeek]}s` : 'Toutes les semaines';
      case 'monthly':
        return dayOfMonth ? `Le ${dayOfMonth} de chaque mois` : 'Tous les mois';
      case 'yearly':
        return 'Tous les ans';
      default:
        return frequency;
    }
  }

  switch (frequency) {
    case 'daily':
      return `Tous les ${interval} jours`;
    case 'weekly':
      return `Toutes les ${interval} semaines`;
    case 'monthly':
      return `Tous les ${interval} mois`;
    case 'yearly':
      return `Tous les ${interval} ans`;
    default:
      return `${interval} ${frequency}`;
  }
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function RecurrenceCard({
  recurrence,
  workspaceId,
  onEdit,
  onViewUpcoming,
}: RecurrenceCardProps) {
  const queryClient = useQueryClient();

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/workspaces/${workspaceId}/recurrences/${recurrence.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurrences', workspaceId] });
    },
  });

  // Pause mutation
  const pauseMutation = useMutation({
    mutationFn: () =>
      api.post(`/workspaces/${workspaceId}/recurrences/${recurrence.id}/pause`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurrences', workspaceId] });
    },
  });

  // Resume mutation
  const resumeMutation = useMutation({
    mutationFn: () =>
      api.post(`/workspaces/${workspaceId}/recurrences/${recurrence.id}/resume`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurrences', workspaceId] });
    },
  });

  // Skip mutation
  const skipMutation = useMutation({
    mutationFn: () =>
      api.post(`/workspaces/${workspaceId}/recurrences/${recurrence.id}/skip`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurrences', workspaceId] });
    },
  });

  // Execute now mutation
  const executeMutation = useMutation({
    mutationFn: () =>
      api.post<{ transaction: { id: string } }>(
        `/workspaces/${workspaceId}/recurrences/${recurrence.id}/execute`,
        {}
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurrences', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', workspaceId] });
    },
  });

  const handleDelete = () => {
    if (confirm(`Supprimer la recurrence "${recurrence.name}" ?`)) {
      deleteMutation.mutate();
    }
  };

  const handleToggleActive = () => {
    if (recurrence.isActive) {
      pauseMutation.mutate();
    } else {
      resumeMutation.mutate();
    }
  };

  const handleExecuteNow = () => {
    if (confirm(`Executer maintenant et creer une transaction ?`)) {
      executeMutation.mutate();
    }
  };

  const handleSkipNext = () => {
    if (confirm(`Ignorer la prochaine occurrence ?`)) {
      skipMutation.mutate();
    }
  };

  const isExpense = recurrence.template.type === 'expense';
  const isPending = pauseMutation.isPending || resumeMutation.isPending;

  return (
    <div
      className={clsx(
        'card relative',
        !recurrence.isActive && 'opacity-60',
        isExpense ? 'border-l-4 border-l-ctp-red' : 'border-l-4 border-l-ctp-green'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            {recurrence.template.category?.icon ? <span>{recurrence.template.category.icon}</span> : (isExpense ? <ArrowDownCircle className="w-6 h-6 text-ctp-red" /> : <ArrowUpCircle className="w-6 h-6 text-ctp-green" />)}
          </span>
          <div>
            <h3 className="font-medium">{recurrence.name}</h3>
            <p className="text-sm text-ctp-subtext0">{recurrence.template.description}</p>
          </div>
        </div>
        <span
          className={clsx(
            'text-xs px-2 py-1 rounded-full font-medium',
            recurrence.isActive
              ? 'bg-ctp-green/10 text-ctp-green'
              : 'bg-ctp-yellow/10 text-ctp-yellow'
          )}
        >
          {recurrence.isActive ? 'Active' : 'En pause'}
        </span>
      </div>

      {/* Amount and Frequency */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-ctp-subtext0">Montant</p>
          <p
            className={clsx('text-lg font-bold', isExpense ? 'text-ctp-red' : 'text-ctp-green')}
          >
            {isExpense ? '-' : '+'}
            {formatCurrency(Number(recurrence.template.amount))}
          </p>
        </div>
        <div>
          <p className="text-sm text-ctp-subtext0">Frequence</p>
          <p className="font-medium">
            {getFrequencyLabel(
              recurrence.frequency,
              recurrence.interval,
              recurrence.dayOfMonth,
              recurrence.dayOfWeek
            )}
          </p>
        </div>
      </div>

      {/* Next Run & Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-ctp-surface1 rounded-lg">
        <div>
          <p className="text-xs text-ctp-subtext0">Prochaine execution</p>
          <p className="font-medium text-sm">
            {recurrence.isActive ? formatRelativeDate(recurrence.nextRunAt) : '-'}
          </p>
        </div>
        <div>
          <p className="text-xs text-ctp-subtext0">Executions</p>
          <p className="font-medium text-sm">{recurrence.executionCount} fois</p>
        </div>
      </div>

      {/* Account */}
      {recurrence.template.account && (
        <div className="text-sm text-ctp-subtext0 mb-4">
          Compte: <span className="text-ctp-subtext1">{recurrence.template.account.name}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-ctp-surface1">
        <button
          onClick={handleToggleActive}
          disabled={isPending}
          className={clsx(
            'btn-ghost text-xs',
            recurrence.isActive ? 'text-ctp-yellow' : 'text-ctp-green'
          )}
        >
          {recurrence.isActive ? <><Pause className="w-4 h-4 inline mr-1" />Pause</> : <><Play className="w-4 h-4 inline mr-1" />Reprendre</>}
        </button>
        {recurrence.isActive && (
          <>
            <button
              onClick={handleExecuteNow}
              disabled={executeMutation.isPending}
              className="btn-ghost text-xs text-ctp-blue"
            >
              <Zap className="w-4 h-4 inline mr-1" />Executer
            </button>
            <button
              onClick={handleSkipNext}
              disabled={skipMutation.isPending}
              className="btn-ghost text-xs"
            >
              <SkipForward className="w-4 h-4 inline mr-1" />Passer
            </button>
          </>
        )}
        <button onClick={onViewUpcoming} className="btn-ghost text-xs">
          <Calendar className="w-4 h-4 inline mr-1" />Prochaines
        </button>
        <button onClick={onEdit} className="btn-ghost text-xs">
          <Pencil className="w-4 h-4 inline mr-1" />Modifier
        </button>
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="btn-ghost text-xs text-ctp-red"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default RecurrenceCard;
