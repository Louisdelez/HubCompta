// ============================================================================
// SCHEDULED CARD - Finance Hub
// Individual scheduled transaction card with countdown
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  Zap,
  Pencil,
  Trash2,
  Calendar,
  CheckCircle,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ScheduledTransaction {
  id: string;
  accountId: string;
  categoryId?: string | null;
  amount: number;
  currency: string;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  scheduledDate: string;
  notes?: string | null;
  isExecuted: boolean;
  executedAt?: string | null;
  transactionId?: string | null;
  account: {
    id: string;
    name: string;
    type: string;
    currency: string;
  };
  category?: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
}

interface ScheduledCardProps {
  scheduled: ScheduledTransaction;
  workspaceId: string;
  onEdit: () => void;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getDaysUntil(date: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getCountdownText(date: string): { text: string; color: string; urgent: boolean } {
  const days = getDaysUntil(date);

  if (days < 0) {
    return { text: `En retard de ${Math.abs(days)} jour${Math.abs(days) > 1 ? 's' : ''}`, color: 'text-ctp-red', urgent: true };
  }
  if (days === 0) {
    return { text: "Aujourd'hui", color: 'text-ctp-peach', urgent: true };
  }
  if (days === 1) {
    return { text: 'Demain', color: 'text-ctp-yellow', urgent: true };
  }
  if (days <= 7) {
    return { text: `Dans ${days} jours`, color: 'text-ctp-yellow', urgent: false };
  }
  if (days <= 30) {
    return { text: `Dans ${Math.ceil(days / 7)} semaine${days >= 14 ? 's' : ''}`, color: 'text-ctp-subtext0', urgent: false };
  }
  return { text: `Dans ${Math.ceil(days / 30)} mois`, color: 'text-ctp-subtext0', urgent: false };
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ScheduledCard({ scheduled, workspaceId, onEdit }: ScheduledCardProps) {
  const queryClient = useQueryClient();

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/workspaces/${workspaceId}/scheduled/${scheduled.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scheduled', workspaceId] });
    },
  });

  // Execute mutation
  const executeMutation = useMutation({
    mutationFn: () =>
      api.post<{ scheduled: ScheduledTransaction; transaction: { id: string } }>(
        `/workspaces/${workspaceId}/scheduled/${scheduled.id}/execute`,
        {}
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scheduled', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['transactions', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['accounts', workspaceId] });
    },
  });

  const handleDelete = () => {
    if (confirm(`Supprimer "${scheduled.description}" ?`)) {
      deleteMutation.mutate();
    }
  };

  const handleExecute = () => {
    if (confirm(`Executer maintenant et creer la transaction ?`)) {
      executeMutation.mutate();
    }
  };

  const isExpense = scheduled.type === 'expense';
  const isIncome = scheduled.type === 'income';
  const countdown = getCountdownText(scheduled.scheduledDate);
  const amount = typeof scheduled.amount === 'number' ? scheduled.amount : Number(scheduled.amount);

  if (scheduled.isExecuted) {
    return (
      <div className="card opacity-60 border-l-4 border-l-ctp-overlay0">
        <div className="flex items-center gap-3 mb-2">
          <CheckCircle className="w-5 h-5 text-ctp-green" />
          <div className="flex-1">
            <h3 className="font-medium">{scheduled.description}</h3>
            <p className="text-sm text-ctp-subtext0">
              Execute le {scheduled.executedAt ? formatDate(scheduled.executedAt) : '-'}
            </p>
          </div>
          <span
            className={clsx(
              'text-lg font-bold',
              isExpense ? 'text-ctp-red' : 'text-ctp-green'
            )}
          >
            {isExpense ? '-' : '+'}
            {formatCurrency(amount, scheduled.currency)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'card relative',
        isExpense ? 'border-l-4 border-l-ctp-red' : 'border-l-4 border-l-ctp-green',
        countdown.urgent && 'ring-2 ring-ctp-yellow/30'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            {scheduled.category?.icon ? (
              <span>{scheduled.category.icon}</span>
            ) : isExpense ? (
              <ArrowDownCircle className="w-6 h-6 text-ctp-red" />
            ) : (
              <ArrowUpCircle className="w-6 h-6 text-ctp-green" />
            )}
          </span>
          <div>
            <h3 className="font-medium">{scheduled.description}</h3>
            {scheduled.category && (
              <p className="text-sm text-ctp-subtext0">{scheduled.category.name}</p>
            )}
          </div>
        </div>
        <span
          className={clsx(
            'text-lg font-bold',
            isExpense ? 'text-ctp-red' : isIncome ? 'text-ctp-green' : 'text-ctp-blue'
          )}
        >
          {isExpense ? '-' : isIncome ? '+' : ''}
          {formatCurrency(amount, scheduled.currency)}
        </span>
      </div>

      {/* Countdown */}
      <div className="flex items-center gap-2 mb-3 p-3 bg-ctp-surface1 rounded-lg">
        <Clock className={clsx('w-5 h-5', countdown.color)} />
        <div className="flex-1">
          <p className={clsx('font-medium', countdown.color)}>{countdown.text}</p>
          <p className="text-xs text-ctp-subtext0">{formatDate(scheduled.scheduledDate)}</p>
        </div>
        {countdown.urgent && (
          <span className="px-2 py-1 text-xs font-medium bg-ctp-yellow/20 text-ctp-yellow rounded-full">
            Urgent
          </span>
        )}
      </div>

      {/* Account */}
      <div className="text-sm text-ctp-subtext0 mb-3">
        <Calendar className="w-4 h-4 inline mr-1" />
        Compte: <span className="text-ctp-subtext1">{scheduled.account.name}</span>
      </div>

      {/* Notes */}
      {scheduled.notes && (
        <p className="text-sm text-ctp-subtext0 mb-3 italic">"{scheduled.notes}"</p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-ctp-surface1">
        <button
          onClick={handleExecute}
          disabled={executeMutation.isPending}
          className="btn-ghost text-xs text-ctp-blue"
        >
          <Zap className="w-4 h-4 inline mr-1" />
          Executer
        </button>
        <button onClick={onEdit} className="btn-ghost text-xs">
          <Pencil className="w-4 h-4 inline mr-1" />
          Modifier
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

export default ScheduledCard;
