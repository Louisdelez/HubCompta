// ============================================================================
// LOAN DETAIL - Finance Hub
// Detailed view with payment history
// Uses Catppuccin colors: red for debts, green for credits
// ============================================================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, DollarSign, Trash2, Calendar, Percent, Building2, User, FileText } from 'lucide-react';
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

interface LoanDetailProps {
  workspaceId: string;
  loan: Loan;
  onClose: () => void;
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
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function formatShortDate(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr));
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function LoanDetail({
  workspaceId,
  loan,
  onClose,
  onAddPayment,
}: LoanDetailProps) {
  const queryClient = useQueryClient();
  const isDebt = loan.type === 'debt';

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: string) =>
      api.delete(`/workspaces/${workspaceId}/loans/${loan.id}/payments/${paymentId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['loans', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['loan', workspaceId, loan.id] });
    },
  });

  const handleDeletePayment = (paymentId: string) => {
    if (confirm('Supprimer ce paiement ? Le solde sera restaure.')) {
      deletePaymentMutation.mutate(paymentId);
    }
  };

  const progressColor = isDebt ? 'bg-ctp-red' : 'bg-ctp-green';
  const typeColor = isDebt ? 'text-ctp-red' : 'text-ctp-green';
  const typeBgColor = isDebt ? 'bg-ctp-red/20' : 'bg-ctp-green/20';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ctp-crust/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden mx-4 flex flex-col">
        {/* Header */}
        <div className={clsx('p-4 border-b', isDebt ? 'border-ctp-red/30' : 'border-ctp-green/30')}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-ctp-text">{loan.name}</h2>
                <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', typeBgColor, typeColor)}>
                  {isDebt ? 'Dette' : 'Creance'}
                </span>
              </div>
              {loan.counterparty && (
                <div className="flex items-center gap-1 text-sm text-ctp-subtext0 mt-1">
                  {loan.counterparty.includes(' ') ? (
                    <User className="w-3 h-3" />
                  ) : (
                    <Building2 className="w-3 h-3" />
                  )}
                  <span>{loan.counterparty}</span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-ctp-surface0 transition-colors"
            >
              <X className="w-5 h-5 text-ctp-subtext0" />
            </button>
          </div>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-ctp-surface0 rounded-lg p-3 text-center">
              <p className="text-xs text-ctp-subtext0">Montant initial</p>
              <p className="text-lg font-bold text-ctp-text">
                {formatCurrency(loan.principalAmount, loan.currency)}
              </p>
            </div>
            <div className="bg-ctp-surface0 rounded-lg p-3 text-center">
              <p className="text-xs text-ctp-subtext0">Solde restant</p>
              <p className={clsx('text-lg font-bold', typeColor)}>
                {formatCurrency(loan.currentBalance, loan.currency)}
              </p>
            </div>
            <div className="bg-ctp-surface0 rounded-lg p-3 text-center">
              <p className="text-xs text-ctp-subtext0">Total paye</p>
              <p className="text-lg font-bold text-ctp-text">
                {formatCurrency(loan.totalPaid, loan.currency)}
              </p>
            </div>
            <div className="bg-ctp-surface0 rounded-lg p-3 text-center">
              <p className="text-xs text-ctp-subtext0">Interets payes</p>
              <p className="text-lg font-bold text-ctp-yellow">
                {formatCurrency(loan.totalInterestPaid, loan.currency)}
              </p>
            </div>
          </div>

          {/* Progress */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-ctp-subtext0">Progression</span>
              <span className="font-medium text-ctp-text">{loan.progress}%</span>
            </div>
            <div className="h-3 bg-ctp-surface1 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full transition-all duration-500', progressColor)}
                style={{ width: `${loan.progress}%` }}
              />
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-ctp-overlay1" />
              <div>
                <p className="text-ctp-subtext0">Date de debut</p>
                <p className="font-medium text-ctp-text">{formatDate(loan.startDate)}</p>
              </div>
            </div>
            {loan.endDate && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-ctp-overlay1" />
                <div>
                  <p className="text-ctp-subtext0">Date de fin</p>
                  <p className="font-medium text-ctp-text">{formatDate(loan.endDate)}</p>
                </div>
              </div>
            )}
            {loan.interestRate !== null && (
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-ctp-overlay1" />
                <div>
                  <p className="text-ctp-subtext0">Taux d'interet</p>
                  <p className="font-medium text-ctp-text">{loan.interestRate.toFixed(2)}%</p>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {loan.notes && (
            <div className="flex items-start gap-2 p-3 bg-ctp-surface0 rounded-lg">
              <FileText className="w-4 h-4 text-ctp-overlay1 mt-0.5" />
              <div>
                <p className="text-xs text-ctp-subtext0 mb-1">Notes</p>
                <p className="text-sm text-ctp-text">{loan.notes}</p>
              </div>
            </div>
          )}

          {/* Payment History */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-ctp-text">
                Historique des paiements ({loan.paymentCount})
              </h3>
              <button
                onClick={onAddPayment}
                className={clsx(
                  'btn-ghost text-sm flex items-center gap-1',
                  isDebt ? 'hover:bg-ctp-red/10 hover:text-ctp-red' : 'hover:bg-ctp-green/10 hover:text-ctp-green'
                )}
              >
                <DollarSign className="w-4 h-4" />
                Ajouter
              </button>
            </div>

            {loan.payments.length === 0 ? (
              <div className="text-center py-8 text-ctp-subtext0">
                <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Aucun paiement enregistre</p>
              </div>
            ) : (
              <div className="space-y-2">
                {loan.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 bg-ctp-surface0 rounded-lg group"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-ctp-subtext0">
                          {formatShortDate(payment.date)}
                        </span>
                        <span className={clsx('font-semibold', typeColor)}>
                          {formatCurrency(payment.amount, loan.currency)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-ctp-subtext0 mt-1">
                        <span>Capital: {formatCurrency(payment.principal, loan.currency)}</span>
                        <span>Interets: {formatCurrency(payment.interest, loan.currency)}</span>
                        {payment.notes && (
                          <span className="italic truncate max-w-[150px]">{payment.notes}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeletePayment(payment.id)}
                      disabled={deletePaymentMutation.isPending}
                      className="p-2 rounded-lg text-ctp-red opacity-0 group-hover:opacity-100 hover:bg-ctp-red/10 transition-all"
                      title="Supprimer ce paiement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-ctp-surface0 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">
            Fermer
          </button>
          <button
            onClick={onAddPayment}
            className={clsx(
              'btn-primary flex items-center gap-2',
              isDebt
                ? 'bg-ctp-red hover:bg-ctp-red/90'
                : 'bg-ctp-green hover:bg-ctp-green/90'
            )}
          >
            <DollarSign className="w-4 h-4" />
            Ajouter un paiement
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoanDetail;
