// ============================================================================
// LOANS PAGE - Finance Hub
// Main page with debt/credit tabs
// Uses Catppuccin colors: red for debts, green for credits
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingDown,
  TrendingUp,
  ListFilter,
  Calculator,
  Target,
  BarChart3,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { clsx } from 'clsx';
import { LoanSummary } from './LoanSummary';
import { LoanList } from './LoanList';
import { LoanModal } from './LoanModal';
import { LoanPaymentModal } from './LoanPaymentModal';
import { LoanDetail } from './LoanDetail';
import { DebtFreeCalculator } from './DebtFreeCalculator';
import { LoanSimulator } from './LoanSimulator';
import { AmortizationTable } from './AmortizationTable';
import { LoanProgressChart } from './LoanProgressChart';

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
type ViewMode = 'list' | 'simulator' | 'analysis';

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function LoansPage() {
  const { currentWorkspaceId: workspaceId, currentWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showModal, setShowModal] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [defaultLoanType, setDefaultLoanType] = useState<'debt' | 'credit'>('debt');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLoan, setPaymentLoan] = useState<Loan | null>(null);
  const [detailLoan, setDetailLoan] = useState<Loan | null>(null);
  const [selectedLoanForAnalysis, setSelectedLoanForAnalysis] = useState<Loan | null>(null);

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

  const handleAnalyzeLoan = (loan: Loan) => {
    setSelectedLoanForAnalysis(loan);
    setViewMode('analysis');
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

      {/* View Mode Selector */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => setViewMode('list')}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors',
            viewMode === 'list'
              ? 'bg-ctp-blue text-ctp-base'
              : 'bg-ctp-surface0 text-ctp-subtext0 hover:bg-ctp-surface1'
          )}
        >
          <ListFilter className="w-4 h-4" />
          Liste
        </button>
        <button
          onClick={() => setViewMode('simulator')}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors',
            viewMode === 'simulator'
              ? 'bg-ctp-green text-ctp-base'
              : 'bg-ctp-surface0 text-ctp-subtext0 hover:bg-ctp-surface1'
          )}
        >
          <Target className="w-4 h-4" />
          Objectif sans dette
        </button>
        <button
          onClick={() => {
            if (loans && loans.length > 0 && loans.find(l => l.interestRate !== null && l.interestRate > 0)) {
              const firstLoanWithRate = loans.find(l => l.interestRate !== null && l.interestRate > 0);
              if (firstLoanWithRate) setSelectedLoanForAnalysis(firstLoanWithRate);
            }
            setViewMode('analysis');
          }}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors',
            viewMode === 'analysis'
              ? 'bg-ctp-mauve text-ctp-base'
              : 'bg-ctp-surface0 text-ctp-subtext0 hover:bg-ctp-surface1'
          )}
        >
          <BarChart3 className="w-4 h-4" />
          Analyse detaillee
        </button>
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <>
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
            onAnalyze={handleAnalyzeLoan}
          />
        </>
      )}

      {/* Simulator View - Debt Free Calculator */}
      {viewMode === 'simulator' && (
        <DebtFreeCalculator workspaceId={workspaceId} currency={currency} />
      )}

      {/* Analysis View - Detailed Loan Analysis */}
      {viewMode === 'analysis' && (
        <div className="space-y-6">
          {/* Loan Selector */}
          {loans && loans.filter(l => l.interestRate !== null && l.interestRate > 0).length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-ctp-mauve" />
                Selectionnez un pret a analyser
              </h3>
              <div className="flex flex-wrap gap-2">
                {loans
                  .filter((l) => l.interestRate !== null && l.interestRate > 0)
                  .map((loan) => (
                    <button
                      key={loan.id}
                      onClick={() => setSelectedLoanForAnalysis(loan)}
                      className={clsx(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                        selectedLoanForAnalysis?.id === loan.id
                          ? loan.type === 'debt'
                            ? 'bg-ctp-red text-ctp-base'
                            : 'bg-ctp-green text-ctp-base'
                          : 'bg-ctp-surface0 text-ctp-subtext0 hover:bg-ctp-surface1'
                      )}
                    >
                      {loan.name}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {selectedLoanForAnalysis && selectedLoanForAnalysis.interestRate !== null && (
            <>
              {/* Progress Chart */}
              <LoanProgressChart
                principalAmount={selectedLoanForAnalysis.principalAmount}
                currentBalance={selectedLoanForAnalysis.currentBalance}
                annualInterestRate={selectedLoanForAnalysis.interestRate}
                termMonths={
                  selectedLoanForAnalysis.endDate
                    ? Math.ceil(
                        (new Date(selectedLoanForAnalysis.endDate).getTime() -
                          new Date(selectedLoanForAnalysis.startDate).getTime()) /
                          (30 * 24 * 60 * 60 * 1000)
                      )
                    : 240
                }
                startDate={new Date(selectedLoanForAnalysis.startDate)}
                monthlyPayment={
                  (() => {
                    const p = selectedLoanForAnalysis.principalAmount;
                    const r = (selectedLoanForAnalysis.interestRate ?? 0) / 12 / 100;
                    const n = selectedLoanForAnalysis.endDate
                      ? Math.ceil(
                          (new Date(selectedLoanForAnalysis.endDate).getTime() -
                            new Date(selectedLoanForAnalysis.startDate).getTime()) /
                            (30 * 24 * 60 * 60 * 1000)
                        )
                      : 240;
                    if (r === 0) return p / n;
                    return (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                  })()
                }
                paidMonths={selectedLoanForAnalysis.paymentCount}
                currency={selectedLoanForAnalysis.currency}
              />

              {/* Loan Simulator */}
              <LoanSimulator
                principalRemaining={selectedLoanForAnalysis.currentBalance}
                monthlyPayment={
                  (() => {
                    const p = selectedLoanForAnalysis.principalAmount;
                    const r = (selectedLoanForAnalysis.interestRate ?? 0) / 12 / 100;
                    const n = selectedLoanForAnalysis.endDate
                      ? Math.ceil(
                          (new Date(selectedLoanForAnalysis.endDate).getTime() -
                            new Date(selectedLoanForAnalysis.startDate).getTime()) /
                            (30 * 24 * 60 * 60 * 1000)
                        )
                      : 240;
                    if (r === 0) return p / n;
                    return (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                  })()
                }
                interestRate={selectedLoanForAnalysis.interestRate}
                remainingMonths={
                  (() => {
                    const balance = selectedLoanForAnalysis.currentBalance;
                    const rate = (selectedLoanForAnalysis.interestRate ?? 0) / 12 / 100;
                    const p = selectedLoanForAnalysis.principalAmount;
                    const n = selectedLoanForAnalysis.endDate
                      ? Math.ceil(
                          (new Date(selectedLoanForAnalysis.endDate).getTime() -
                            new Date(selectedLoanForAnalysis.startDate).getTime()) /
                            (30 * 24 * 60 * 60 * 1000)
                        )
                      : 240;
                    const monthly = rate === 0 ? p / n : (p * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
                    if (balance <= 0) return 0;
                    if (rate === 0) return Math.ceil(balance / monthly);
                    const denom = monthly - balance * rate;
                    if (denom <= 0) return 999;
                    return Math.ceil(-Math.log(denom / monthly) / Math.log(1 + rate));
                  })()
                }
                currency={selectedLoanForAnalysis.currency}
              />

              {/* Amortization Table */}
              <AmortizationTable
                principalAmount={selectedLoanForAnalysis.principalAmount}
                annualInterestRate={selectedLoanForAnalysis.interestRate}
                termMonths={
                  selectedLoanForAnalysis.endDate
                    ? Math.ceil(
                        (new Date(selectedLoanForAnalysis.endDate).getTime() -
                          new Date(selectedLoanForAnalysis.startDate).getTime()) /
                          (30 * 24 * 60 * 60 * 1000)
                      )
                    : 240
                }
                startDate={new Date(selectedLoanForAnalysis.startDate)}
                monthlyPayment={
                  (() => {
                    const p = selectedLoanForAnalysis.principalAmount;
                    const r = (selectedLoanForAnalysis.interestRate ?? 0) / 12 / 100;
                    const n = selectedLoanForAnalysis.endDate
                      ? Math.ceil(
                          (new Date(selectedLoanForAnalysis.endDate).getTime() -
                            new Date(selectedLoanForAnalysis.startDate).getTime()) /
                            (30 * 24 * 60 * 60 * 1000)
                        )
                      : 240;
                    if (r === 0) return p / n;
                    return (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                  })()
                }
                currency={selectedLoanForAnalysis.currency}
              />
            </>
          )}

          {(!loans || loans.filter(l => l.interestRate !== null && l.interestRate > 0).length === 0) && (
            <div className="card text-center py-12">
              <BarChart3 className="w-12 h-12 mx-auto text-ctp-overlay1 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun pret avec taux d'interet</h3>
              <p className="text-ctp-subtext0 mb-4">
                L'analyse detaillee necessite des prets avec un taux d'interet defini.
              </p>
              <button
                onClick={() => handleCreateNew('debt')}
                className="btn-primary"
              >
                Ajouter un pret
              </button>
            </div>
          )}
        </div>
      )}

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
