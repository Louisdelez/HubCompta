// ============================================================================
// RECURRENCES PAGE - Finance Hub
// Recurring transactions management
// ============================================================================

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, Settings, Cog, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { RecurrenceCard } from './RecurrenceCard';
import { RecurrenceForm } from './RecurrenceForm';
import { UpcomingOccurrences } from './UpcomingOccurrences';
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

interface RecurrenceForecast {
  income: number;
  expense: number;
  net: number;
  items: Array<{
    recurrenceId: string;
    name: string;
    type: 'income' | 'expense';
    amount: number;
    dates: string[];
    total: number;
  }>;
}

type FilterType = 'all' | 'active' | 'paused' | 'income' | 'expense';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function RecurrencesPage() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingRecurrence, setEditingRecurrence] = useState<Recurrence | null>(null);
  const [viewingUpcoming, setViewingUpcoming] = useState<Recurrence | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [forecastMonth] = useState(new Date());

  // Fetch recurrences
  const { data: recurrencesData, isLoading } = useQuery({
    queryKey: ['recurrences', workspaceId],
    queryFn: () =>
      api.get<{ data: Recurrence[]; meta: { total: number } }>(
        `/workspaces/${workspaceId}/recurrences`
      ),
    enabled: !!workspaceId,
  });

  // Fetch monthly forecast
  const { data: forecastData } = useQuery({
    queryKey: ['recurrences', workspaceId, 'forecast', forecastMonth.toISOString()],
    queryFn: () =>
      api.get<RecurrenceForecast>(
        `/workspaces/${workspaceId}/recurrences/forecast?month=${forecastMonth.toISOString()}`
      ),
    enabled: !!workspaceId,
  });

  const recurrences = recurrencesData?.data ?? [];
  const forecast = forecastData;

  // Filter recurrences
  const filteredRecurrences = recurrences.filter((r) => {
    switch (filter) {
      case 'active':
        return r.isActive;
      case 'paused':
        return !r.isActive;
      case 'income':
        return r.template.type === 'income';
      case 'expense':
        return r.template.type === 'expense';
      default:
        return true;
    }
  });

  // Group by type
  const incomeRecurrences = filteredRecurrences.filter((r) => r.template.type === 'income');
  const expenseRecurrences = filteredRecurrences.filter((r) => r.template.type === 'expense');

  const handleEdit = (recurrence: Recurrence) => {
    setEditingRecurrence(recurrence);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingRecurrence(null);
  };

  const handleSave = () => {
    queryClient.invalidateQueries({ queryKey: ['recurrences', workspaceId] });
    handleClose();
  };

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-gray-500">Selectionnez un espace de travail</div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Transactions recurrentes</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Automatisez vos revenus et depenses regulieres
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + Nouvelle recurrence
        </button>
      </div>

      {/* Monthly Forecast */}
      {forecast && recurrences.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">
            Prevision pour {formatMonth(forecastMonth)}
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-success-50 dark:bg-success-900/20 rounded-lg">
              <p className="text-sm text-success-600 dark:text-success-400">Revenus prevus</p>
              <p className="text-2xl font-bold text-success-600">
                +{formatCurrency(forecast.income)}
              </p>
            </div>
            <div className="text-center p-4 bg-danger-50 dark:bg-danger-900/20 rounded-lg">
              <p className="text-sm text-danger-600 dark:text-danger-400">Depenses prevues</p>
              <p className="text-2xl font-bold text-danger-600">
                -{formatCurrency(forecast.expense)}
              </p>
            </div>
            <div
              className={clsx(
                'text-center p-4 rounded-lg',
                forecast.net >= 0
                  ? 'bg-success-50 dark:bg-success-900/20'
                  : 'bg-danger-50 dark:bg-danger-900/20'
              )}
            >
              <p className="text-sm text-gray-600 dark:text-gray-400">Solde net</p>
              <p
                className={clsx(
                  'text-2xl font-bold',
                  forecast.net >= 0 ? 'text-success-600' : 'text-danger-600'
                )}
              >
                {forecast.net >= 0 ? '+' : ''}
                {formatCurrency(forecast.net)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {recurrences.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { value: 'all', label: 'Toutes' },
            { value: 'active', label: 'Actives' },
            { value: 'paused', label: 'En pause' },
            { value: 'income', label: 'Revenus' },
            { value: 'expense', label: 'Depenses' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value as FilterType)}
              className={clsx(
                'px-4 py-2 rounded-full text-sm font-medium transition-colors',
                filter === f.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {recurrences.length > 0 ? (
        <div className="space-y-8">
          {/* Income Section */}
          {incomeRecurrences.length > 0 && (filter === 'all' || filter === 'income' || filter === 'active' || filter === 'paused') && (
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ArrowUpCircle className="w-6 h-6 text-success-500" />
                Revenus recurrents
                <span className="text-sm font-normal text-gray-500">
                  ({incomeRecurrences.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {incomeRecurrences.map((recurrence) => (
                  <RecurrenceCard
                    key={recurrence.id}
                    recurrence={recurrence}
                    workspaceId={workspaceId}
                    onEdit={() => handleEdit(recurrence)}
                    onViewUpcoming={() => setViewingUpcoming(recurrence)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Expense Section */}
          {expenseRecurrences.length > 0 && (filter === 'all' || filter === 'expense' || filter === 'active' || filter === 'paused') && (
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ArrowDownCircle className="w-6 h-6 text-danger-500" />
                Depenses recurrentes
                <span className="text-sm font-normal text-gray-500">
                  ({expenseRecurrences.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {expenseRecurrences.map((recurrence) => (
                  <RecurrenceCard
                    key={recurrence.id}
                    recurrence={recurrence}
                    workspaceId={workspaceId}
                    onEdit={() => handleEdit(recurrence)}
                    onViewUpcoming={() => setViewingUpcoming(recurrence)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Empty filter state */}
          {filteredRecurrences.length === 0 && (
            <div className="card text-center py-12">
              <p className="text-gray-500">Aucune recurrence ne correspond aux filtres</p>
            </div>
          )}
        </div>
      ) : (
        <div className="card text-center py-12">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-bold mb-2">Aucune transaction recurrente</h2>
          <p className="text-gray-500 mb-6">
            Creez des recurrences pour automatiser vos revenus et depenses regulieres
            <br />
            (loyer, abonnements, salaire, etc.)
          </p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            Creer votre premiere recurrence
          </button>
        </div>
      )}

      {/* How it works */}
      {recurrences.length === 0 && (
        <div className="mt-8 grid md:grid-cols-3 gap-6">
          <div className="card text-center">
            <Settings className="w-8 h-8 mx-auto mb-2 text-primary-500" />
            <h3 className="font-semibold mb-1">Configurez</h3>
            <p className="text-sm text-gray-500">
              Definissez le montant, la frequence et le compte
            </p>
          </div>
          <div className="card text-center">
            <Cog className="w-8 h-8 mx-auto mb-2 text-primary-500" />
            <h3 className="font-semibold mb-1">Automatisez</h3>
            <p className="text-sm text-gray-500">
              Les transactions sont creees automatiquement
            </p>
          </div>
          <div className="card text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-primary-500" />
            <h3 className="font-semibold mb-1">Controlez</h3>
            <p className="text-sm text-gray-500">
              Pausez, modifiez ou passez des occurrences
            </p>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <RecurrenceForm
          workspaceId={workspaceId}
          recurrence={editingRecurrence}
          onClose={handleClose}
          onSave={handleSave}
        />
      )}

      {/* Upcoming Occurrences Modal */}
      {viewingUpcoming && (
        <UpcomingOccurrences
          workspaceId={workspaceId}
          recurrence={viewingUpcoming}
          onClose={() => setViewingUpcoming(null)}
        />
      )}
    </div>
  );
}

export default RecurrencesPage;
