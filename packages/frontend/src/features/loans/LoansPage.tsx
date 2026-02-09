// ============================================================================
// LOANS PAGE - Finance Hub
// Main page with debt/credit tabs
// Uses Catppuccin colors: red for debts, green for credits
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp, ListFilter } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { clsx } from 'clsx';
import { LoanSummary } from './LoanSummary';
import { LoanList } from './LoanList';
import { LoanModal } from './LoanModal';
import { LoanPaymentModal } from './LoanPaymentModal';
import { LoanDetail } from './LoanDetail';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface LoanPayment {
  id: string;
  amount: number;
  principal: number;
  interest: number;
  date: string;
  notes?: string | null;
  createdAt: string;
}

interface Loan {
  id: string;
  name: string;
  type: 'debt' | 'credit';
  principalAmount: number;
  currentBalance: number;
  interestRate: number | null;
  currency: string;
  startDate: string;
  endDate?: string | null;
  counterparty?: string | null;
  notes?: string | null;
  payments: LoanPayment[];
  paymentCount: number;
  totalPaid: number;
  totalInterestPaid: number;
  progress: number;
}

interface LoanSummaryData {
  totalDebt: number;
  totalCredit: number;
  netPosition: number;
  debtCount: number;
  creditCount: number;
}

type TabType = 'all' | 'debt' | 'credit';

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function LoansPage() {
  const { currentWorkspaceId: workspaceId, currentWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [defaultLoanType, setDefaultLoanType] = useState<'debt' | 'credit'>('debt');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLoan, setPaymentLoan] = useState<Loan | null>(null);
  const [detailLoan, setDetailLoan] = useState<Loan | null>(null);

  // Fetch loans
  const { data: loans, isLoading: loansLoading } = useQuery({
    queryKey: ['loans', workspaceId],
    queryFn: () => api.get<Loan[]>(`/workspaces/${workspaceId}/loans`),
    enabled: !!workspaceId,
  });

  // Fetch summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['loans', workspaceId, 'summary'],
    queryFn: () => api.get<LoanSummaryData>(`/workspaces/${workspaceId}/loans/summary`),
    enabled: !!workspaceId,
  });

  const handleCreateNew = (type?: 'debt' | 'credit') => {
    setEditingLoan(null);
    setDefaultLoanType(type ?? (activeTab === 'credit' ? 'credit' : 'debt'));
    setShowModal(true);
  };

  const handleEdit = (loan: Loan) => {
    setEditingLoan(loan);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingLoan(null);
  };

  const handleAddPayment = (loan: Loan) => {
    setPaymentLoan(loan);
    setShowPaymentModal(true);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentLoan(null);
  };

  const handleViewDetails = (loan: Loan) => {
    setDetailLoan(loan);
  };

  const handleCloseDetail = () => {
    setDetailLoan(null);
  };

  const handleAddPaymentFromDetail = () => {
    if (detailLoan) {
      setPaymentLoan(detailLoan);
      setShowPaymentModal(true);
    }
  };

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-ctp-subtext0">
        Selectionnez un espace de travail
      </div>
    );
  }

  if (loansLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-ctp-surface1 rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-ctp-surface1 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 bg-ctp-surface1 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const currency = currentWorkspace?.currency ?? 'EUR';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Prets et Dettes</h1>
          <p className="text-ctp-subtext0">
            Suivez vos emprunts et creances
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCreateNew('debt')}
            className="btn-ghost flex items-center gap-2 text-ctp-red hover:bg-ctp-red/10"
          >
            <TrendingDown className="w-4 h-4" />
            Nouvelle dette
          </button>
          <button
            onClick={() => handleCreateNew('credit')}
            className="btn-primary flex items-center gap-2 bg-ctp-green hover:bg-ctp-green/90"
          >
            <TrendingUp className="w-4 h-4" />
            Nouvelle creance
          </button>
        </div>
      </div>

      {/* Summary */}
      {!summaryLoading && summary && (summary.debtCount > 0 || summary.creditCount > 0) && (
        <div className="mb-6">
          <LoanSummary summary={summary} currency={currency} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-ctp-surface1">
        <button
          onClick={() => setActiveTab('all')}
          className={clsx(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'all'
              ? 'border-ctp-blue text-ctp-blue'
              : 'border-transparent text-ctp-subtext0 hover:text-ctp-text'
          )}
        >
          <span className="flex items-center gap-2">
            <ListFilter className="w-4 h-4" />
            Tous
            {loans && <span className="text-xs opacity-75">({loans.length})</span>}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('debt')}
          className={clsx(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'debt'
              ? 'border-ctp-red text-ctp-red'
              : 'border-transparent text-ctp-subtext0 hover:text-ctp-text'
          )}
        >
          <span className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Dettes
            {summary && <span className="text-xs opacity-75">({summary.debtCount})</span>}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('credit')}
          className={clsx(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'credit'
              ? 'border-ctp-green text-ctp-green'
              : 'border-transparent text-ctp-subtext0 hover:text-ctp-text'
          )}
        >
          <span className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Creances
            {summary && <span className="text-xs opacity-75">({summary.creditCount})</span>}
          </span>
        </button>
      </div>

      {/* Loan List */}
      <LoanList
        loans={loans ?? []}
        workspaceId={workspaceId}
        activeTab={activeTab}
        onEdit={handleEdit}
        onViewDetails={handleViewDetails}
        onAddPayment={handleAddPayment}
        onCreateNew={() => handleCreateNew()}
      />

      {/* Loan Modal */}
      {showModal && (
        <LoanModal
          workspaceId={workspaceId}
          loan={editingLoan}
          defaultType={defaultLoanType}
          onClose={handleCloseModal}
          onSave={handleCloseModal}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && paymentLoan && (
        <LoanPaymentModal
          workspaceId={workspaceId}
          loan={paymentLoan}
          onClose={handleClosePaymentModal}
          onSave={handleClosePaymentModal}
        />
      )}

      {/* Loan Detail */}
      {detailLoan && (
        <LoanDetail
          workspaceId={workspaceId}
          loan={detailLoan}
          onClose={handleCloseDetail}
          onAddPayment={handleAddPaymentFromDetail}
        />
      )}
    </div>
  );
}

export default LoansPage;
