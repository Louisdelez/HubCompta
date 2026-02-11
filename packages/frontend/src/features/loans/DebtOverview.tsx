// ============================================================================
// DEBT OVERVIEW - Finance Hub
// Dashboard widget showing comprehensive debt overview
// Uses Catppuccin colors: red for debts, green for progress
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import {
  TrendingDown,
  Calendar,
  Coins,
  ChevronRight,
  Target,
  PiggyBank,
} from 'lucide-react';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface DebtSummary {
  totalDebt: number;
  totalMonthlyPayment: number;
  projectedDebtFreeDate: string | null;
  totalInterestRemaining: number;
  debtsByType: {
    loanId: string;
    name: string;
    balance: number;
    monthlyPayment: number;
    interestRate: number;
    projectedEndDate: string | null;
  }[];
}

interface LoanSummary {
  totalDebt: number;
  totalCredit: number;
  netPosition: number;
  debtCount: number;
  creditCount: number;
}

interface DebtOverviewProps {
  workspaceId: string;
  currency?: string;
  compact?: boolean;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function monthsBetween(date1: Date, date2: Date): number {
  const years = date2.getFullYear() - date1.getFullYear();
  const months = date2.getMonth() - date1.getMonth();
  return Math.max(0, years * 12 + months);
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function DebtOverview({
  workspaceId,
  currency = 'EUR',
  compact = false,
}: DebtOverviewProps) {
  const { data: debtSummary, isLoading: debtLoading } = useQuery({
    queryKey: ['debt-summary', workspaceId],
    queryFn: () => api.get<DebtSummary>(`/workspaces/${workspaceId}/loans/debt-summary`),
    enabled: !!workspaceId,
  });

  const { data: loanSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['loans', workspaceId, 'summary'],
    queryFn: () => api.get<LoanSummary>(`/workspaces/${workspaceId}/loans/summary`),
    enabled: !!workspaceId,
  });

  const isLoading = debtLoading || summaryLoading;

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 bg-ctp-surface1 rounded w-1/3 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-ctp-surface1 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // No debts - show celebration
  if (!debtSummary || debtSummary.totalDebt <= 0) {
    if (compact) {
      return (
        <a
          href="/loans"
          className="card hover:bg-ctp-surface0/50 transition-colors flex items-center gap-4"
        >
          <div className="p-3 rounded-xl bg-ctp-green/20">
            <Target className="w-6 h-6 text-ctp-green" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-ctp-green">Sans dettes !</p>
            <p className="text-sm text-ctp-subtext0">
              Felicitations, vous n'avez aucune dette
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-ctp-overlay1" />
        </a>
      );
    }

    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-ctp-green" />
            Suivi des dettes
          </h3>
          <a
            href="/loans"
            className="text-sm text-ctp-blue hover:underline flex items-center gap-1"
          >
            Voir tout <ChevronRight className="w-4 h-4" />
          </a>
        </div>

        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-ctp-green/20 flex items-center justify-center">
            <Target className="w-8 h-8 text-ctp-green" />
          </div>
          <h4 className="text-xl font-bold text-ctp-green mb-2">Felicitations !</h4>
          <p className="text-ctp-subtext0 max-w-sm mx-auto">
            Vous n'avez aucune dette active. Continuez a bien gerer vos finances !
          </p>
        </div>
      </div>
    );
  }

  const debtFreeDate = debtSummary.projectedDebtFreeDate
    ? new Date(debtSummary.projectedDebtFreeDate)
    : null;
  const monthsRemaining = debtFreeDate
    ? monthsBetween(new Date(), debtFreeDate)
    : 0;

  // Calculate progress - based on how much of the original debts have been paid
  // We estimate original debt = current debt + (monthly payment * time already elapsed)
  // For simplicity, we use the net position as an indicator
  const progressToDebtFree = debtSummary.totalDebt > 0
    ? Math.max(0, Math.min(100, ((loanSummary?.totalCredit ?? 0) / (debtSummary.totalDebt + (loanSummary?.totalCredit ?? 0))) * 100))
    : 100;

  if (compact) {
    return (
      <a
        href="/loans"
        className="card hover:bg-ctp-surface0/50 transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-ctp-red/20">
              <TrendingDown className="w-4 h-4 text-ctp-red" />
            </div>
            <span className="font-semibold">Dettes</span>
          </div>
          <ChevronRight className="w-5 h-5 text-ctp-overlay1" />
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-ctp-red">
            {formatCurrency(debtSummary.totalDebt, currency)}
          </span>
          {debtFreeDate && (
            <span className="text-sm text-ctp-subtext0">
              {monthsRemaining} mois restants
            </span>
          )}
        </div>

        {/* Mini progress bar */}
        <div className="mt-3 h-1.5 bg-ctp-surface1 rounded-full overflow-hidden">
          <div
            className="h-full bg-ctp-green rounded-full"
            style={{ width: `${progressToDebtFree}%` }}
          />
        </div>
      </a>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-ctp-mauve" />
          Vue d'ensemble des dettes
        </h3>
        <a
          href="/loans"
          className="text-sm text-ctp-blue hover:underline flex items-center gap-1"
        >
          Gerer <ChevronRight className="w-4 h-4" />
        </a>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-ctp-red/10 rounded-lg p-3 text-center">
          <TrendingDown className="w-5 h-5 mx-auto text-ctp-red mb-1" />
          <p className="text-xs text-ctp-subtext0">Dette totale</p>
          <p className="text-lg font-bold text-ctp-red">
            {formatCurrency(debtSummary.totalDebt, currency)}
          </p>
        </div>

        <div className="bg-ctp-blue/10 rounded-lg p-3 text-center">
          <Coins className="w-5 h-5 mx-auto text-ctp-blue mb-1" />
          <p className="text-xs text-ctp-subtext0">Paiement mensuel</p>
          <p className="text-lg font-bold text-ctp-blue">
            {formatCurrency(debtSummary.totalMonthlyPayment, currency)}
          </p>
        </div>

        <div className="bg-ctp-green/10 rounded-lg p-3 text-center">
          <Calendar className="w-5 h-5 mx-auto text-ctp-green mb-1" />
          <p className="text-xs text-ctp-subtext0">Date sans dette</p>
          <p className="text-lg font-bold text-ctp-green">
            {debtFreeDate ? formatDate(debtFreeDate.toISOString()) : '-'}
          </p>
        </div>

        <div className="bg-ctp-yellow/10 rounded-lg p-3 text-center">
          <Target className="w-5 h-5 mx-auto text-ctp-yellow mb-1" />
          <p className="text-xs text-ctp-subtext0">Mois restants</p>
          <p className="text-lg font-bold text-ctp-yellow">
            {monthsRemaining}
          </p>
        </div>
      </div>

      {/* Progress to Debt Free */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-ctp-subtext0">Progression vers la liberte financiere</span>
          <span className="font-medium text-ctp-text">{progressToDebtFree.toFixed(0)}%</span>
        </div>
        <div className="h-3 bg-ctp-surface1 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-ctp-red via-ctp-yellow to-ctp-green rounded-full transition-all duration-500"
            style={{ width: `${progressToDebtFree}%` }}
          />
        </div>
      </div>

      {/* Debt List Preview */}
      {debtSummary.debtsByType.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-ctp-subtext0 font-medium mb-2">
            Vos dettes ({debtSummary.debtsByType.length})
          </p>
          {debtSummary.debtsByType.slice(0, 3).map((debt) => (
              <div
                key={debt.loanId}
                className="flex items-center gap-3 p-3 bg-ctp-surface0 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ctp-text truncate">{debt.name}</p>
                  <p className="text-sm text-ctp-subtext0">
                    {formatCurrency(debt.monthlyPayment, currency)}/mois
                    {debt.interestRate > 0 && ` - ${debt.interestRate.toFixed(1)}%`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-ctp-red">
                    {formatCurrency(debt.balance, currency)}
                  </p>
                  {debt.projectedEndDate && (
                    <p className="text-xs text-ctp-subtext0">
                      Fin: {formatDate(debt.projectedEndDate)}
                    </p>
                  )}
                </div>
              </div>
            ))}

          {debtSummary.debtsByType.length > 3 && (
            <a
              href="/loans"
              className="block text-center text-sm text-ctp-blue hover:underline py-2"
            >
              Voir les {debtSummary.debtsByType.length - 3} autres dettes
            </a>
          )}
        </div>
      )}

      {/* Interest Warning */}
      {debtSummary.totalInterestRemaining > 0 && (
        <div className="mt-4 p-3 bg-ctp-yellow/10 border border-ctp-yellow/30 rounded-lg">
          <p className="text-sm text-ctp-subtext0">
            <span className="font-semibold text-ctp-yellow">
              {formatCurrency(debtSummary.totalInterestRemaining, currency)}
            </span>{' '}
            d'interets restants a payer. Envisagez des remboursements anticipes !
          </p>
        </div>
      )}
    </div>
  );
}

export default DebtOverview;
