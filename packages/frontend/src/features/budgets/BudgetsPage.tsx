// ============================================================================
// BUDGETS PAGE - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, CalendarDays, Wallet, LayoutGrid, List, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { clsx } from 'clsx';
import { BudgetCard } from './BudgetCard';
import { BudgetForm } from './BudgetForm';
import { BudgetHistory } from './BudgetHistory';
import { EnvelopeOverview } from './EnvelopeOverview';
import { logger } from '@/lib/logger';

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
  // Envelope mode fields
  envelopeMode: boolean;
  rolloverEnabled: boolean;
  rolloverAmount: number;
  availableAmount: number;
  rolloverFromPrevious: number;
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
  const { t } = useTranslation();
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithProgress | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<BudgetWithProgress | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'envelopes'>('list');
  const [isExporting, setIsExporting] = useState(false);

  // PDF Export function
  const handleExportPDF = async () => {
    if (!workspaceId) return;

    setIsExporting(true);
    try {
      const baseUrl = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '/api/v1';
      const token = localStorage.getItem('accessToken');

      const now = new Date();
      const url = `${baseUrl}/workspaces/${workspaceId}/reports/budget/pdf?year=${now.getFullYear()}&month=${now.getMonth() + 1}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      // Get filename from response
      let filename = `budget_${format(now, 'yyyy_MM')}.pdf`;
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      logger.error('PDF export error', error);
      alert(t('budgets.pdfExportError'));
    } finally {
      setIsExporting(false);
    }
  };

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
    void queryClient.invalidateQueries({ queryKey: ['budgets', workspaceId] });
    handleClose();
  };

  const handleViewHistory = (budget: BudgetWithProgress) => {
    setSelectedBudget(budget);
  };

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-ctp-subtext0">
        {t('budgets.selectWorkspace')}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-ctp-surface1 rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-ctp-surface1 rounded-xl" />
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
          <h1 className="text-2xl font-bold">{t('budgets.title')}</h1>
          <p className="text-ctp-subtext0">
            {t('budgets.trackByCategory')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-ctp-surface0 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                'p-2 rounded-md transition-colors',
                viewMode === 'list'
                  ? 'bg-ctp-surface1 text-ctp-text'
                  : 'text-ctp-subtext0 hover:text-ctp-text'
              )}
              title={t('budgets.viewList')}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('envelopes')}
              className={clsx(
                'p-2 rounded-md transition-colors',
                viewMode === 'envelopes'
                  ? 'bg-ctp-surface1 text-ctp-text'
                  : 'text-ctp-subtext0 hover:text-ctp-text'
              )}
              title={t('budgets.viewEnvelopes')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          {/* PDF Export Button */}
          <button
            onClick={() => void handleExportPDF()}
            disabled={isExporting}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              'bg-ctp-red/10 text-ctp-red hover:bg-ctp-red/20',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export PDF
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            + {t('budgets.newBudget')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && summary.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card text-center">
            <p className="text-2xl font-bold">{summary.total}</p>
            <p className="text-sm text-ctp-subtext0">{t('budgets.activeBudgets')}</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold">{formatCurrency(summary.totalBudgeted)}</p>
            <p className="text-sm text-ctp-subtext0">{t('budgets.totalBudget')}</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-ctp-blue">
              {formatCurrency(summary.totalSpent)}
            </p>
            <p className="text-sm text-ctp-subtext0">{t('budgets.spent')}</p>
          </div>
          <div className="card text-center">
            {summary.overBudgetCount > 0 ? (
              <>
                <p className="text-2xl font-bold text-ctp-red">{summary.overBudgetCount}</p>
                <p className="text-sm text-ctp-red">{t('budgets.exceeded')}</p>
              </>
            ) : summary.alertCount > 0 ? (
              <>
                <p className="text-2xl font-bold text-ctp-yellow">{summary.alertCount}</p>
                <p className="text-sm text-ctp-yellow">{t('budgets.alert')}</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-ctp-green">0</p>
                <p className="text-sm text-ctp-green">{t('budgets.problem')}</p>
              </>
            )}
          </div>
        </div>
      )}

      {budgets && budgets.length > 0 ? (
        viewMode === 'envelopes' ? (
          <EnvelopeOverview workspaceId={workspaceId} />
        ) : (
          <div className="space-y-8">
            {/* Monthly Budgets */}
            {monthlyBudgets.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {t('budgets.monthlyBudgets')}
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
                  {t('budgets.yearlyBudgets')}
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
        )
      ) : (
        <div className="card text-center py-12">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-ctp-overlay1" />
          <h2 className="text-xl font-bold mb-2">{t('budgets.noBudgetsConfigured')}</h2>
          <p className="text-ctp-subtext0 mb-6">
            {t('budgets.createBudgetsDescription')}
          </p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            {t('budgets.createFirstBudget')}
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
