// ============================================================================
// LOAN CARD - Finance Hub
// Individual loan card with progress and actions
// Uses Catppuccin colors: red for debts, green for credits
// ============================================================================

import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Pencil,
  Trash2,
  DollarSign,
  Eye,
  Building2,
  User,
  Calculator,
  Calendar,
  TrendingUp,
} from 'lucide-react';
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
  onSimulate?: () => void;
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

// ----------------------------------------------------------------------------
// Calculation Helpers
// ----------------------------------------------------------------------------

function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (annualRate === 0 || termMonths === 0) {
    return termMonths > 0 ? principal / termMonths : 0;
  }
  const monthlyRate = annualRate / 12 / 100;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
}

function calculateRemainingMonths(
  balance: number,
  monthlyPayment: number,
  annualRate: number
): number {
  if (balance <= 0) return 0;
  if (monthlyPayment <= 0) return 999;
  if (annualRate === 0) {
    return Math.ceil(balance / monthlyPayment);
  }
  const monthlyRate = annualRate / 12 / 100;
  const denominator = monthlyPayment - balance * monthlyRate;
  if (denominator <= 0) return 999;
  return Math.ceil(-Math.log(denominator / monthlyPayment) / Math.log(1 + monthlyRate));
}

function calculateTotalInterest(
  balance: number,
  monthlyPayment: number,
  annualRate: number,
  remainingMonths: number
): number {
  if (annualRate === 0) return 0;
  let totalInterest = 0;
  let currentBalance = balance;
  const monthlyRate = annualRate / 12 / 100;

  for (let i = 0; i < remainingMonths && currentBalance > 0; i++) {
    const interest = currentBalance * monthlyRate;
    totalInterest += interest;
    const principalPaid = Math.min(monthlyPayment - interest, currentBalance);
    currentBalance -= principalPaid;
  }

  return totalInterest;
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
  onSimulate,
}: LoanCardProps) {
  const queryClient = useQueryClient();
  const isDebt = loan.type === 'debt';

  // Calculate loan statistics
  const loanStats = useMemo(() => {
    const startDate = new Date(loan.startDate);
    const endDate = loan.endDate ? new Date(loan.endDate) : null;
    const interestRate = loan.interestRate ?? 0;

    // Calculate term in months
    let termMonths = 0;
    if (endDate) {
      termMonths = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
      );
    } else {
      termMonths = 240; // Default 20 years
    }

    const monthlyPayment = calculateMonthlyPayment(
      loan.principalAmount,
      interestRate,
      termMonths
    );

    const remainingMonths = calculateRemainingMonths(
      loan.currentBalance,
      monthlyPayment,
      interestRate
    );

    const totalInterestRemaining = calculateTotalInterest(
      loan.currentBalance,
      monthlyPayment,
      interestRate,
      remainingMonths
    );

    const projectedEndDate = new Date();
    projectedEndDate.setMonth(projectedEndDate.getMonth() + remainingMonths);

    return {
      monthlyPayment,
      remainingMonths,
      totalInterestRemaining,
      projectedEndDate,
      termMonths,
    };
  }, [loan]);

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

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
        <div className="bg-ctp-surface0 rounded-lg p-2 text-center">
          <p className="text-ctp-subtext0 text-xs">Paiements</p>
          <p className="font-semibold text-ctp-text">{loan.paymentCount}</p>
        </div>
        <div className="bg-ctp-surface0 rounded-lg p-2 text-center">
          <p className="text-ctp-subtext0 text-xs">Interets payes</p>
          <p className="font-semibold text-ctp-yellow">
            {formatCurrency(loan.totalInterestPaid, loan.currency)}
          </p>
        </div>
      </div>

      {/* Enhanced Stats */}
      {loan.interestRate !== null && loan.interestRate > 0 && (
        <div className="grid grid-cols-3 gap-2 text-xs mb-4">
          <div className="bg-ctp-surface0/50 rounded-lg p-2 text-center">
            <Calendar className="w-3 h-3 mx-auto text-ctp-overlay1 mb-1" />
            <p className="text-ctp-subtext0">Mois restants</p>
            <p className="font-medium text-ctp-text">
              {loanStats.remainingMonths < 999 ? loanStats.remainingMonths : '?'}
            </p>
          </div>
          <div className="bg-ctp-surface0/50 rounded-lg p-2 text-center">
            <DollarSign className="w-3 h-3 mx-auto text-ctp-overlay1 mb-1" />
            <p className="text-ctp-subtext0">Mensualite</p>
            <p className="font-medium text-ctp-text">
              {formatCurrency(loanStats.monthlyPayment, loan.currency)}
            </p>
          </div>
          <div className="bg-ctp-surface0/50 rounded-lg p-2 text-center">
            <TrendingUp className="w-3 h-3 mx-auto text-ctp-overlay1 mb-1" />
            <p className="text-ctp-subtext0">Interets a venir</p>
            <p className="font-medium text-ctp-yellow">
              {formatCurrency(loanStats.totalInterestRemaining, loan.currency)}
            </p>
          </div>
        </div>
      )}

      {/* Projected End Date */}
      {loan.interestRate !== null && loan.interestRate > 0 && loanStats.remainingMonths < 999 && (
        <div className="flex items-center justify-between text-xs text-ctp-subtext0 mb-4 px-1">
          <span>Fin prevue:</span>
          <span className="font-medium text-ctp-text">
            {new Intl.DateTimeFormat('fr-FR', {
              month: 'short',
              year: 'numeric',
            }).format(loanStats.projectedEndDate)}
          </span>
        </div>
      )}

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
        {onSimulate && loan.interestRate !== null && loan.interestRate > 0 && (
          <button
            onClick={onSimulate}
            className="btn-ghost text-sm p-2 hover:bg-ctp-blue/10 hover:text-ctp-blue"
            title="Simuler un remboursement anticipe"
          >
            <Calculator className="w-4 h-4" />
          </button>
        )}
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
