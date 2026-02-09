// ============================================================================
// BUDGET CARD - Finance Hub
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
// Helpers
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
  if (isOverBudget) return 'bg-danger-500';
  if (isAlertTriggered) return 'bg-warning-500';
  if (percentUsed >= 50) return 'bg-primary-500';
  return 'bg-success-500';
}

function getStatusBadge(
  isOverBudget: boolean,
  isAlertTriggered: boolean
): { text: string; className: string } | null {
  if (isOverBudget) {
    return {
      text: 'Dépassé',
      className: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
    };
  }
  if (isAlertTriggered) {
    return {
      text: 'Attention',
      className: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
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
      queryClient.invalidateQueries({ queryKey: ['budgets', workspaceId] });
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
        budget.isOverBudget && 'ring-2 ring-danger-500',
        budget.isAlertTriggered && !budget.isOverBudget && 'ring-2 ring-warning-500'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {budget.category.icon ? (
            <span className="text-2xl">{budget.category.icon}</span>
          ) : (
            <Folder className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          )}
          <div>
            <h3 className="font-medium">{budget.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{budget.category.name}</p>
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
          <span className="font-medium">{budget.percentUsed}%</span>
          <span className="text-gray-500 dark:text-gray-400">
            {formatCurrency(budget.spent)} / {formatCurrency(Number(budget.amount))}
          </span>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all duration-500', progressColor)}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex justify-between text-sm">
        <div>
          <p className="text-gray-500 dark:text-gray-400">Restant</p>
          <p
            className={clsx(
              'font-medium',
              budget.isOverBudget ? 'text-danger-600' : 'text-success-600'
            )}
          >
            {budget.isOverBudget ? '-' : ''}
            {formatCurrency(budget.remaining)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-gray-500 dark:text-gray-400">Alerte à</p>
          <p className="font-medium">{budget.alertThreshold}%</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
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
          className="btn-ghost text-danger-600 text-sm"
          title="Supprimer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Over-budget indicator */}
      {budget.isOverBudget && (
        <div className="absolute top-0 left-0 w-full h-1 bg-danger-500" />
      )}
    </div>
  );
}

export default BudgetCard;
