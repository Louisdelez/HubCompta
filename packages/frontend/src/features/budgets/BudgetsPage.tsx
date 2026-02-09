// ============================================================================
// BUDGETS PAGE - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, CalendarDays, Wallet } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { BudgetCard } from './BudgetCard';
import { BudgetForm } from './BudgetForm';
import { BudgetHistory } from './BudgetHistory';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface BudgetWithProgress {
  id: string;
  name: string;
  amount: number;
  period: 'monthly' | 'yearly';
  alertThreshold: number;
  startDate: string;
  endDate?: string;
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

interface BudgetSummary {
  total: number;
  totalBudgeted: number;
  totalSpent: number;
  overBudgetCount: number;
  alertCount: number;
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

export function BudgetsPage() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithProgress | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<BudgetWithProgress | null>(null);

  // Fetch budgets
  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets', workspaceId],
    queryFn: () => api.get<BudgetWithProgress[]>(`/workspaces/${workspaceId}/budgets`),
    enabled: !!workspaceId,
  });

  // Fetch summary
  const { data: summary } = useQuery({
    queryKey: ['budgets', workspaceId, 'summary'],
    queryFn: () => api.get<BudgetSummary>(`/workspaces/${workspaceId}/budgets/summary`),
    enabled: !!workspaceId,
  });

  const handleEdit = (budget: BudgetWithProgress) => {
    setEditingBudget(budget);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingBudget(null);
  };

  const handleSave = () => {
    queryClient.invalidateQueries({ queryKey: ['budgets', workspaceId] });
    handleClose();
  };

  const handleViewHistory = (budget: BudgetWithProgress) => {
    setSelectedBudget(budget);
  };

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        Sélectionnez un espace de travail
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Separate monthly and yearly budgets
  const monthlyBudgets = budgets?.filter((b) => b.period === 'monthly') ?? [];
  const yearlyBudgets = budgets?.filter((b) => b.period === 'yearly') ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Suivez vos dépenses par catégorie
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + Nouveau budget
        </button>
      </div>

      {/* Summary Cards */}
      {summary && summary.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card text-center">
            <p className="text-2xl font-bold">{summary.total}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Budgets actifs</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold">{formatCurrency(summary.totalBudgeted)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Budget total</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-primary-600">
              {formatCurrency(summary.totalSpent)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Dépensé</p>
          </div>
          <div className="card text-center">
            {summary.overBudgetCount > 0 ? (
              <>
                <p className="text-2xl font-bold text-danger-600">{summary.overBudgetCount}</p>
                <p className="text-sm text-danger-600">Dépassés</p>
              </>
            ) : summary.alertCount > 0 ? (
              <>
                <p className="text-2xl font-bold text-warning-600">{summary.alertCount}</p>
                <p className="text-sm text-warning-600">En alerte</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-success-600">0</p>
                <p className="text-sm text-success-600">Problème</p>
              </>
            )}
          </div>
        </div>
      )}

      {budgets && budgets.length > 0 ? (
        <div className="space-y-8">
          {/* Monthly Budgets */}
          {monthlyBudgets.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Budgets mensuels
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {monthlyBudgets.map((budget) => (
                  <BudgetCard
                    key={budget.id}
                    budget={budget}
                    onEdit={() => handleEdit(budget)}
                    onViewHistory={() => handleViewHistory(budget)}
                    workspaceId={workspaceId}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Yearly Budgets */}
          {yearlyBudgets.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Budgets annuels
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {yearlyBudgets.map((budget) => (
                  <BudgetCard
                    key={budget.id}
                    budget={budget}
                    onEdit={() => handleEdit(budget)}
                    onViewHistory={() => handleViewHistory(budget)}
                    workspaceId={workspaceId}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="card text-center py-12">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-bold mb-2">Aucun budget configuré</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Créez des budgets pour suivre vos dépenses par catégorie
          </p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            Créer votre premier budget
          </button>
        </div>
      )}

      {/* Budget Form Modal */}
      {showForm && (
        <BudgetForm
          workspaceId={workspaceId}
          budget={editingBudget}
          onClose={handleClose}
          onSave={handleSave}
        />
      )}

      {/* Budget History Modal */}
      {selectedBudget && (
        <BudgetHistory
          workspaceId={workspaceId}
          budget={selectedBudget}
          onClose={() => setSelectedBudget(null)}
        />
      )}
    </div>
  );
}

export default BudgetsPage;
