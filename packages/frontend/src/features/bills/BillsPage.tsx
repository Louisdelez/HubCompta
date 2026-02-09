// ============================================================================
// BILLS PAGE - Finance Hub
// Bill Pay Reminders main page with tabs
// Uses Catppuccin colors: red for overdue, yellow for due soon, green for paid
// ============================================================================

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt, Calendar, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { BillList } from './BillList';
import { BillModal } from './BillModal';
import { BillCalendar } from './BillCalendar';
import { OverdueBanner } from './OverdueBanner';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface Bill {
  id: string;
  name: string;
  vendor: string | null;
  amount: number;
  currency: string;
  dueDate: string;
  frequency: 'once' | 'weekly' | 'monthly' | 'yearly';
  categoryId: string | null;
  isPaid: boolean;
  paidAt: string | null;
  paidTransactionId: string | null;
  reminderDays: number;
  notes: string | null;
  category?: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  paidTransaction?: {
    id: string;
    description: string;
    date: string;
  } | null;
}

interface BillSummary {
  totalUnpaid: number;
  totalOverdue: number;
  upcomingThisMonth: number;
  overdueCount: number;
  upcomingCount: number;
  paidThisMonth: number;
}

interface StatusCounts {
  unpaid: number;
  overdue: number;
  paid: number;
  upcoming: number;
}

type Tab = 'upcoming' | 'overdue' | 'all' | 'paid' | 'calendar';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount);
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function BillsPage() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  // Fetch summary
  const { data: summary } = useQuery({
    queryKey: ['bills', workspaceId, 'summary'],
    queryFn: () => api.get<BillSummary>(`/workspaces/${workspaceId}/bills/summary`),
    enabled: !!workspaceId,
  });

  // Fetch counts
  const { data: counts } = useQuery({
    queryKey: ['bills', workspaceId, 'counts'],
    queryFn: () => api.get<StatusCounts>(`/workspaces/${workspaceId}/bills/counts`),
    enabled: !!workspaceId,
  });

  const handleEdit = (bill: Bill) => {
    setEditingBill(bill);
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setEditingBill(null);
  };

  const handleSave = () => {
    void queryClient.invalidateQueries({ queryKey: ['bills', workspaceId] });
    handleClose();
  };

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-ctp-subtext0">
        Selectionnez un espace de travail
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number | undefined; color?: string | undefined }[] = [
    { id: 'upcoming', label: 'A venir', icon: <Clock className="w-4 h-4" />, count: counts?.upcoming },
    { id: 'overdue', label: 'En retard', icon: <AlertTriangle className="w-4 h-4" />, count: counts?.overdue, color: 'text-ctp-red' },
    { id: 'all', label: 'Toutes', icon: <Receipt className="w-4 h-4" />, count: counts?.unpaid },
    { id: 'paid', label: 'Payees', icon: <CheckCircle className="w-4 h-4" />, count: counts?.paid, color: 'text-ctp-green' },
    { id: 'calendar', label: 'Calendrier', icon: <Calendar className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Overdue Banner */}
      {counts && counts.overdue > 0 && (
        <OverdueBanner
          count={counts.overdue}
          amount={summary?.totalOverdue ?? 0}
          onClick={() => setActiveTab('overdue')}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Factures a payer</h1>
          <p className="text-ctp-subtext0">
            Gerez vos echeances et recevez des rappels
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          + Nouvelle facture
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card text-center">
            <p className="text-2xl font-bold text-ctp-red">{formatCurrency(summary.totalOverdue)}</p>
            <p className="text-sm text-ctp-subtext0">En retard</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-ctp-yellow">{formatCurrency(summary.upcomingThisMonth)}</p>
            <p className="text-sm text-ctp-subtext0">Ce mois-ci</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold">{formatCurrency(summary.totalUnpaid)}</p>
            <p className="text-sm text-ctp-subtext0">Total a payer</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-ctp-green">{formatCurrency(summary.paidThisMonth)}</p>
            <p className="text-sm text-ctp-subtext0">Paye ce mois</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-ctp-surface1 mb-6">
        <div className="flex gap-1 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-ctp-blue text-ctp-blue'
                  : 'border-transparent text-ctp-subtext0 hover:text-ctp-text'
              }`}
            >
              <span className={tab.color && tab.count && tab.count > 0 ? tab.color : ''}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  tab.color?.includes('red')
                    ? 'bg-ctp-red/20 text-ctp-red'
                    : tab.color?.includes('green')
                    ? 'bg-ctp-green/20 text-ctp-green'
                    : 'bg-ctp-surface1'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'calendar' ? (
        <BillCalendar workspaceId={workspaceId} />
      ) : (
        <BillList
          workspaceId={workspaceId}
          filter={activeTab === 'all' ? 'unpaid' : activeTab}
          onEdit={handleEdit}
        />
      )}

      {/* Bill Modal */}
      {showModal && (
        <BillModal
          workspaceId={workspaceId}
          bill={editingBill}
          onClose={handleClose}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

export default BillsPage;
