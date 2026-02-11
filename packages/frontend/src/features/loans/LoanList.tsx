// ============================================================================
// LOAN LIST - Finance Hub
// List of loans grouped by type
// Uses Catppuccin colors: red for debts, green for credits
// ============================================================================

import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { LoanCard } from './LoanCard';

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

interface LoanListProps {
  loans: Loan[];
  workspaceId: string;
  activeTab: 'all' | 'debt' | 'credit';
  onEdit: (loan: Loan) => void;
  onViewDetails: (loan: Loan) => void;
  onAddPayment: (loan: Loan) => void;
  onCreateNew: () => void;
  onAnalyze?: (loan: Loan) => void;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function LoanList({
  loans,
  workspaceId,
  activeTab,
  onEdit,
  onViewDetails,
  onAddPayment,
  onCreateNew,
  onAnalyze,
}: LoanListProps) {
  // Filter loans based on active tab
  const filteredLoans = loans.filter((loan) => {
    if (activeTab === 'all') return true;
    return loan.type === activeTab;
  });

  const debts = filteredLoans.filter((l) => l.type === 'debt');
  const credits = filteredLoans.filter((l) => l.type === 'credit');

  if (filteredLoans.length === 0) {
    return (
      <div className="card text-center py-12">
        <Wallet className="w-12 h-12 mx-auto mb-4 text-ctp-overlay1" />
        <h2 className="text-xl font-bold mb-2">
          {activeTab === 'all'
            ? 'Aucun pret ou dette'
            : activeTab === 'debt'
              ? 'Aucune dette'
              : 'Aucune creance'}
        </h2>
        <p className="text-ctp-subtext0 mb-6">
          {activeTab === 'all'
            ? 'Commencez a suivre vos prets et dettes'
            : activeTab === 'debt'
              ? 'Ajoutez une dette pour commencer le suivi'
              : 'Ajoutez une creance pour commencer le suivi'}
        </p>
        <button onClick={onCreateNew} className="btn-primary">
          {activeTab === 'debt'
            ? 'Ajouter une dette'
            : activeTab === 'credit'
              ? 'Ajouter une creance'
              : 'Ajouter un pret'}
        </button>
      </div>
    );
  }

  // Show grouped view for "all" tab
  if (activeTab === 'all') {
    return (
      <div className="space-y-8">
        {/* Debts Section */}
        {debts.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-ctp-red">
              <TrendingDown className="w-5 h-5" />
              Dettes ({debts.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {debts.map((loan) => {
                const canSimulate = onAnalyze && loan.interestRate !== null && loan.interestRate > 0;
                return (
                  <LoanCard
                    key={loan.id}
                    loan={loan}
                    workspaceId={workspaceId}
                    onEdit={() => onEdit(loan)}
                    onViewDetails={() => onViewDetails(loan)}
                    onAddPayment={() => onAddPayment(loan)}
                    {...(canSimulate ? { onSimulate: () => onAnalyze(loan) } : {})}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Credits Section */}
        {credits.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-ctp-green">
              <TrendingUp className="w-5 h-5" />
              Creances ({credits.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {credits.map((loan) => {
                const canSimulate = onAnalyze && loan.interestRate !== null && loan.interestRate > 0;
                return (
                  <LoanCard
                    key={loan.id}
                    loan={loan}
                    workspaceId={workspaceId}
                    onEdit={() => onEdit(loan)}
                    onViewDetails={() => onViewDetails(loan)}
                    onAddPayment={() => onAddPayment(loan)}
                    {...(canSimulate ? { onSimulate: () => onAnalyze(loan) } : {})}
                  />
                );
              })}
            </div>
          </section>
        )}
      </div>
    );
  }

  // Flat list for filtered tabs
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredLoans.map((loan) => {
        const canSimulate = onAnalyze && loan.interestRate !== null && loan.interestRate > 0;
        return (
          <LoanCard
            key={loan.id}
            loan={loan}
            workspaceId={workspaceId}
            onEdit={() => onEdit(loan)}
            onViewDetails={() => onViewDetails(loan)}
            onAddPayment={() => onAddPayment(loan)}
            {...(canSimulate ? { onSimulate: () => onAnalyze(loan) } : {})}
          />
        );
      })}
    </div>
  );
}

export default LoanList;
