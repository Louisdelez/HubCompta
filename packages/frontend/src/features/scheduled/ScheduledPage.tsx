// ============================================================================
// SCHEDULED PAGE - Finance Hub
// Main page for scheduled transactions management
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  CalendarClock,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { ScheduledList } from './ScheduledList';
import { ScheduledModal } from './ScheduledModal';
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

interface ScheduledSummary {
  totalIncome: number;
  totalExpense: number;
  netFlow: number;
  count: number;
}

interface StatusCounts {
  upcoming: number;
  overdue: number;
  executed: number;
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

export function ScheduledPage() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingScheduled, setEditingScheduled] = useState<ScheduledTransaction | null>(null);

  // Fetch scheduled transactions
  const { data: scheduledData, isLoading } = useQuery({
    queryKey: ['scheduled', workspaceId],
    queryFn: () =>
      api.get<{ data: ScheduledTransaction[]; meta: { total: number } }>(
        `/workspaces/${workspaceId}/scheduled?filter=all&pageSize=100`
      ),
    enabled: !!workspaceId,
  });

  // Fetch summary
  const { data: summary } = useQuery({
    queryKey: ['scheduled', workspaceId, 'summary'],
    queryFn: () =>
      api.get<ScheduledSummary>(
        `/workspaces/${workspaceId}/scheduled/summary?days=30`
      ),
    enabled: !!workspaceId,
  });

  // Fetch counts
  const { data: counts = { upcoming: 0, overdue: 0, executed: 0 } } = useQuery({
    queryKey: ['scheduled', workspaceId, 'counts'],
    queryFn: () =>
      api.get<StatusCounts>(`/workspaces/${workspaceId}/scheduled/counts`),
    enabled: !!workspaceId,
  });

  const scheduled = scheduledData?.data ?? [];

  const handleEdit = (transaction: ScheduledTransaction) => {
    setEditingScheduled(transaction);
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setEditingScheduled(null);
  };

  const handleSave = () => {
    void queryClient.invalidateQueries({ queryKey: ['scheduled', workspaceId] });
    handleClose();
  };

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-ctp-subtext0">Selectionnez un espace de travail</div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-ctp-surface1 rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-ctp-surface1 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-ctp-surface1 rounded-xl" />
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarClock className="w-7 h-7 text-ctp-blue" />
            Transactions programmees
          </h1>
          <p className="text-ctp-subtext0">
            Planifiez vos transactions futures ponctuelles
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle transaction
        </button>
      </div>

      {/* Summary Cards */}
      {summary && scheduled.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Upcoming Count */}
          <div className="card flex items-center gap-4">
            <div className="p-3 bg-ctp-blue/10 rounded-lg">
              <Clock className="w-6 h-6 text-ctp-blue" />
            </div>
            <div>
              <p className="text-sm text-ctp-subtext0">A venir (30j)</p>
              <p className="text-2xl font-bold">{summary.count}</p>
            </div>
          </div>

          {/* Overdue */}
          {counts.overdue > 0 && (
            <div className="card flex items-center gap-4 border-l-4 border-l-ctp-red">
              <div className="p-3 bg-ctp-red/10 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-ctp-red" />
              </div>
              <div>
                <p className="text-sm text-ctp-subtext0">En retard</p>
                <p className="text-2xl font-bold text-ctp-red">{counts.overdue}</p>
              </div>
            </div>
          )}

          {/* Expected Income */}
          <div className="card flex items-center gap-4">
            <div className="p-3 bg-ctp-green/10 rounded-lg">
              <ArrowUpCircle className="w-6 h-6 text-ctp-green" />
            </div>
            <div>
              <p className="text-sm text-ctp-subtext0">Revenus prevus</p>
              <p className="text-xl font-bold text-ctp-green">
                +{formatCurrency(summary.totalIncome)}
              </p>
            </div>
          </div>

          {/* Expected Expense */}
          <div className="card flex items-center gap-4">
            <div className="p-3 bg-ctp-red/10 rounded-lg">
              <ArrowDownCircle className="w-6 h-6 text-ctp-red" />
            </div>
            <div>
              <p className="text-sm text-ctp-subtext0">Depenses prevues</p>
              <p className="text-xl font-bold text-ctp-red">
                -{formatCurrency(summary.totalExpense)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Net Flow Banner */}
      {summary && summary.count > 0 && (
        <div
          className={clsx(
            'card mb-6 text-center',
            summary.netFlow >= 0 ? 'bg-ctp-green/5' : 'bg-ctp-red/5'
          )}
        >
          <p className="text-sm text-ctp-subtext0 mb-1">
            Impact net sur les 30 prochains jours
          </p>
          <p
            className={clsx(
              'text-3xl font-bold',
              summary.netFlow >= 0 ? 'text-ctp-green' : 'text-ctp-red'
            )}
          >
            {summary.netFlow >= 0 ? '+' : ''}
            {formatCurrency(summary.netFlow)}
          </p>
        </div>
      )}

      {/* List */}
      {scheduled.length > 0 ? (
        <ScheduledList
          scheduled={scheduled}
          workspaceId={workspaceId}
          onEdit={handleEdit}
          counts={counts}
        />
      ) : (
        <div className="card text-center py-12">
          <CalendarClock className="w-16 h-16 mx-auto mb-4 text-ctp-overlay1" />
          <h2 className="text-xl font-bold mb-2">Aucune transaction programmee</h2>
          <p className="text-ctp-subtext0 mb-6 max-w-md mx-auto">
            Planifiez des transactions ponctuelles a executer a une date future.
            <br />
            Ideal pour les paiements uniques, factures ou revenus exceptionnels.
          </p>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Programmer une transaction
          </button>

          {/* How it works */}
          <div className="mt-8 grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 text-ctp-blue" />
              <h3 className="font-semibold mb-1">Planifiez</h3>
              <p className="text-sm text-ctp-subtext0">
                Definissez la date et le montant
              </p>
            </div>
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-ctp-yellow" />
              <h3 className="font-semibold mb-1">Rappel</h3>
              <p className="text-sm text-ctp-subtext0">
                Visualisez le compte a rebours
              </p>
            </div>
            <div className="text-center">
              <ArrowUpCircle className="w-8 h-8 mx-auto mb-2 text-ctp-green" />
              <h3 className="font-semibold mb-1">Executez</h3>
              <p className="text-sm text-ctp-subtext0">
                Creez la transaction au bon moment
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ScheduledModal
          workspaceId={workspaceId}
          scheduled={editingScheduled}
          onClose={handleClose}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

export default ScheduledPage;
