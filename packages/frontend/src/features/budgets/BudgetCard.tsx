// ============================================================================
// BUDGET CARD - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Pencil, Trash2, Folder } from 'lucide-react';
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
  alertThreshold: number;
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  };
  spent: number;
  remaining: number;
  percentUsed: number;
  isOverBudget: boolean;
  isAlertTriggered: boolean;
}

interface BudgetCardProps {
  budget: BudgetWithProgress;
  workspaceId: string;
  onEdit: () => void;
  onViewHistory: () => void;
}

// ----------------------------------------------------------------------------
// Helpers - Catppuccin Colors
// ----------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function getProgressColor(
  percentUsed: number,
  isOverBudget: boolean,
  isAlertTriggered: boolean
): string {
  if (isOverBudget) return 'bg-ctp-red';
  if (isAlertTriggered) return 'bg-ctp-yellow';
  if (percentUsed >= 50) return 'bg-ctp-blue';
  return 'bg-ctp-green';
}

function getStatusBadge(
  isOverBudget: boolean,
  isAlertTriggered: boolean
): { text: string; className: string } | null {
  if (isOverBudget) {
    return {
      text: 'Dépassé',
      className: 'bg-ctp-red/20 text-ctp-red',
    };
  }
  if (isAlertTriggered) {
    return {
      text: 'Attention',
      className: 'bg-ctp-yellow/20 text-ctp-yellow',
    };
  }
  return null;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function BudgetCard({ budget, workspaceId, onEdit, onViewHistory }: BudgetCardProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/workspaces/${workspaceId}/budgets/${budget.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['budgets', workspaceId] });
    },
  });

  const handleDelete = () => {
    if (confirm(`Supprimer le budget "${budget.name}" ?`)) {
      deleteMutation.mutate();
    }
  };

  const progressColor = getProgressColor(
    budget.percentUsed,
    budget.isOverBudget,
    budget.isAlertTriggered
  );
  const statusBadge = getStatusBadge(budget.isOverBudget, budget.isAlertTriggered);
  const progressWidth = Math.min(budget.percentUsed, 100);

  return (
    <div
      className={clsx(
        'card relative overflow-hidden',
        budget.isOverBudget && 'ring-2 ring-ctp-red',
        budget.isAlertTriggered && !budget.isOverBudget && 'ring-2 ring-ctp-yellow'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {budget.category.icon ? (
            <span className="text-2xl">{budget.category.icon}</span>
          ) : (
            <Folder className="w-6 h-6 text-ctp-overlay1" />
          )}
          <div>
            <h3 className="font-medium text-ctp-text">{budget.name}</h3>
            <p className="text-sm text-ctp-subtext0">{budget.category.name}</p>
          </div>
        </div>
        {statusBadge && (
          <span className={clsx('text-xs px-2 py-1 rounded-full font-medium', statusBadge.className)}>
            {statusBadge.text}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium text-ctp-text">{budget.percentUsed}%</span>
          <span className="text-ctp-subtext0">
            {formatCurrency(budget.spent)} / {formatCurrency(Number(budget.amount))}
          </span>
        </div>
        <div className="h-3 bg-ctp-surface1 rounded-full overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all duration-500', progressColor)}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex justify-between text-sm">
        <div>
          <p className="text-ctp-subtext0">Restant</p>
          <p
            className={clsx(
              'font-medium',
              budget.isOverBudget ? 'text-ctp-red' : 'text-ctp-green'
            )}
          >
            {budget.isOverBudget ? '-' : ''}
            {formatCurrency(budget.remaining)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-ctp-subtext0">Alerte à</p>
          <p className="font-medium text-ctp-text">{budget.alertThreshold}%</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4 pt-4 border-t border-ctp-surface1">
        <button
          onClick={onViewHistory}
          className="btn-ghost text-sm flex-1 flex items-center justify-center gap-1"
          title="Voir l'historique"
        >
          <BarChart3 className="w-4 h-4" /> Historique
        </button>
        <button onClick={onEdit} className="btn-ghost text-sm flex-1 flex items-center justify-center gap-1">
          <Pencil className="w-4 h-4" /> Modifier
        </button>
        <button
          onClick={handleDelete}
          className="btn-ghost text-ctp-red text-sm"
          title="Supprimer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Over-budget indicator */}
      {budget.isOverBudget && (
        <div className="absolute top-0 left-0 w-full h-1 bg-ctp-red" />
      )}
    </div>
  );
}

export default BudgetCard;
