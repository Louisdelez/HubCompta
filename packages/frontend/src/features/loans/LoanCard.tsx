// ============================================================================
// LOAN CARD - Finance Hub
// Individual loan card with progress and actions
// Uses Catppuccin colors: red for debts, green for credits
// ============================================================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, DollarSign, Eye, Building2, User } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

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

interface LoanCardProps {
  loan: Loan;
  workspaceId: string;
  onEdit: () => void;
  onViewDetails: () => void;
  onAddPayment: () => void;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function LoanCard({
  loan,
  workspaceId,
  onEdit,
  onViewDetails,
  onAddPayment,
}: LoanCardProps) {
  const queryClient = useQueryClient();
  const isDebt = loan.type === 'debt';

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/workspaces/${workspaceId}/loans/${loan.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['loans', workspaceId] });
    },
  });

  const handleDelete = () => {
    if (confirm(`Supprimer "${loan.name}" ?`)) {
      deleteMutation.mutate();
    }
  };

  const progressColor = isDebt ? 'bg-ctp-red' : 'bg-ctp-green';
  const typeColor = isDebt ? 'text-ctp-red' : 'text-ctp-green';
  const typeBgColor = isDebt ? 'bg-ctp-red/20' : 'bg-ctp-green/20';

  return (
    <div
      className={clsx(
        'card relative overflow-hidden',
        isDebt && 'border-l-4 border-l-ctp-red',
        !isDebt && 'border-l-4 border-l-ctp-green'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-ctp-text truncate">{loan.name}</h3>
            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', typeBgColor, typeColor)}>
              {isDebt ? 'Dette' : 'Creance'}
            </span>
          </div>
          {loan.counterparty && (
            <div className="flex items-center gap-1 text-sm text-ctp-subtext0">
              {loan.counterparty.includes(' ') ? (
                <User className="w-3 h-3" />
              ) : (
                <Building2 className="w-3 h-3" />
              )}
              <span className="truncate">{loan.counterparty}</span>
            </div>
          )}
        </div>
      </div>

      {/* Amounts */}
      <div className="mb-4">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-sm text-ctp-subtext0">Solde restant</span>
          <span className={clsx('text-xl font-bold', typeColor)}>
            {formatCurrency(loan.currentBalance, loan.currency)}
          </span>
        </div>
        <div className="flex justify-between items-baseline text-sm text-ctp-subtext0">
          <span>Montant initial</span>
          <span>{formatCurrency(loan.principalAmount, loan.currency)}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-ctp-subtext0">Progression</span>
          <span className="font-medium text-ctp-text">{loan.progress}%</span>
        </div>
        <div className="h-2 bg-ctp-surface1 rounded-full overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all duration-500', progressColor)}
            style={{ width: `${loan.progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-ctp-subtext0 mt-1">
          <span>
            Rembourse: {formatCurrency(loan.totalPaid, loan.currency)}
          </span>
          {loan.interestRate && (
            <span>
              Taux: {loan.interestRate.toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
        <div className="bg-ctp-surface0 rounded-lg p-2 text-center">
          <p className="text-ctp-subtext0">Paiements</p>
          <p className="font-semibold text-ctp-text">{loan.paymentCount}</p>
        </div>
        <div className="bg-ctp-surface0 rounded-lg p-2 text-center">
          <p className="text-ctp-subtext0">Interets payes</p>
          <p className="font-semibold text-ctp-yellow">
            {formatCurrency(loan.totalInterestPaid, loan.currency)}
          </p>
        </div>
      </div>

      {/* Dates */}
      <div className="text-xs text-ctp-subtext0 mb-4">
        <span>Debut: {formatDate(loan.startDate)}</span>
        {loan.endDate && <span className="ml-4">Fin: {formatDate(loan.endDate)}</span>}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t border-ctp-surface1">
        <button
          onClick={onAddPayment}
          className={clsx(
            'btn-ghost text-sm flex-1 flex items-center justify-center gap-1',
            isDebt ? 'hover:bg-ctp-red/10 hover:text-ctp-red' : 'hover:bg-ctp-green/10 hover:text-ctp-green'
          )}
          title="Ajouter un paiement"
        >
          <DollarSign className="w-4 h-4" /> Paiement
        </button>
        <button
          onClick={onViewDetails}
          className="btn-ghost text-sm flex-1 flex items-center justify-center gap-1"
          title="Voir les details"
        >
          <Eye className="w-4 h-4" /> Details
        </button>
        <button
          onClick={onEdit}
          className="btn-ghost text-sm p-2"
          title="Modifier"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={handleDelete}
          className="btn-ghost text-ctp-red text-sm p-2"
          title="Supprimer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default LoanCard;
