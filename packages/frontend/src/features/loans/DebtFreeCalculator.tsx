// ============================================================================
// DEBT FREE CALCULATOR - Finance Hub
// Calculate and visualize debt-free date with extra payment scenarios
// Uses Catppuccin colors: green for positive outcomes
// ============================================================================

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Target, TrendingDown, ArrowRight, Coins } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

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

interface DebtFreeCalculatorProps {
  workspaceId: string;
  currency?: string;
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
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function monthsBetween(date1: Date, date2: Date): number {
  const years = date2.getFullYear() - date1.getFullYear();
  const months = date2.getMonth() - date1.getMonth();
  return years * 12 + months;
}

interface SimulationResult {
  newDebtFreeDate: Date;
  monthsSaved: number;
  totalInterestSaved: number;
}

function simulateExtraPayment(
  totalDebt: number,
  totalMonthlyPayment: number,
  averageRate: number,
  extraPayment: number,
  paymentType: 'monthly' | 'one_time'
): SimulationResult {
  const monthlyRate = averageRate / 12 / 100;

  // Original scenario
  let originalBalance = totalDebt;
  let originalMonths = 0;
  let originalInterest = 0;

  while (originalBalance > 0 && originalMonths < 600) {
    const interest = originalBalance * monthlyRate;
    originalInterest += interest;
    const principalPaid = Math.min(totalMonthlyPayment - interest, originalBalance);
    if (principalPaid <= 0) break;
    originalBalance -= principalPaid;
    originalMonths++;
  }

  // New scenario
  let newBalance = paymentType === 'one_time' ? totalDebt - extraPayment : totalDebt;
  const newMonthlyPayment = paymentType === 'monthly'
    ? totalMonthlyPayment + extraPayment
    : totalMonthlyPayment;
  let newMonths = 0;
  let newInterest = 0;

  while (newBalance > 0 && newMonths < 600) {
    const interest = newBalance * monthlyRate;
    newInterest += interest;
    const principalPaid = Math.min(newMonthlyPayment - interest, newBalance);
    if (principalPaid <= 0) break;
    newBalance -= principalPaid;
    newMonths++;
  }

  const newDebtFreeDate = new Date();
  newDebtFreeDate.setMonth(newDebtFreeDate.getMonth() + newMonths);

  return {
    newDebtFreeDate,
    monthsSaved: originalMonths - newMonths,
    totalInterestSaved: originalInterest - newInterest,
  };
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function DebtFreeCalculator({
  workspaceId,
  currency = 'EUR',
}: DebtFreeCalculatorProps) {
  const [extraPayment, setExtraPayment] = useState('200');
  const [paymentType, setPaymentType] = useState<'monthly' | 'one_time'>('monthly');

  const { data: debtSummary, isLoading } = useQuery({
    queryKey: ['debt-summary', workspaceId],
    queryFn: () => api.get<DebtSummary>(`/workspaces/${workspaceId}/loans/debt-summary`),
    enabled: !!workspaceId,
  });

  const simulation = useMemo(() => {
    if (!debtSummary || debtSummary.totalDebt <= 0) return null;

    const extra = parseFloat(extraPayment) || 0;
    if (extra <= 0) return null;

    // Calculate weighted average interest rate
    const totalWeight = debtSummary.debtsByType.reduce((sum, d) => sum + d.balance, 0);
    const avgRate = totalWeight > 0
      ? debtSummary.debtsByType.reduce((sum, d) => sum + (d.interestRate * d.balance), 0) / totalWeight
      : 0;

    return simulateExtraPayment(
      debtSummary.totalDebt,
      debtSummary.totalMonthlyPayment,
      avgRate,
      extra,
      paymentType
    );
  }, [debtSummary, extraPayment, paymentType]);

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 bg-ctp-surface1 rounded w-1/3 mb-4" />
        <div className="space-y-3">
          <div className="h-20 bg-ctp-surface1 rounded" />
          <div className="h-12 bg-ctp-surface1 rounded" />
        </div>
      </div>
    );
  }

  if (!debtSummary || debtSummary.totalDebt <= 0) {
    return (
      <div className="card text-center py-8">
        <Target className="w-12 h-12 mx-auto text-ctp-green mb-3" />
        <h3 className="text-xl font-bold text-ctp-green mb-2">Felicitations !</h3>
        <p className="text-ctp-subtext0">
          Vous n'avez aucune dette active. Continuez comme ca !
        </p>
      </div>
    );
  }

  const currentDebtFreeDate = debtSummary.projectedDebtFreeDate
    ? new Date(debtSummary.projectedDebtFreeDate)
    : null;
  const monthsRemaining = currentDebtFreeDate
    ? monthsBetween(new Date(), currentDebtFreeDate)
    : 0;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-6">
        <Target className="w-5 h-5 text-ctp-green" />
        <h3 className="font-semibold">Calculateur de liberte financiere</h3>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-ctp-red/10 border border-ctp-red/30 rounded-lg p-4 text-center">
          <TrendingDown className="w-6 h-6 mx-auto text-ctp-red mb-2" />
          <p className="text-sm text-ctp-subtext0">Dette totale</p>
          <p className="text-xl font-bold text-ctp-red">
            {formatCurrency(debtSummary.totalDebt, currency)}
          </p>
        </div>
        <div className="bg-ctp-blue/10 border border-ctp-blue/30 rounded-lg p-4 text-center">
          <Calendar className="w-6 h-6 mx-auto text-ctp-blue mb-2" />
          <p className="text-sm text-ctp-subtext0">Date sans dette</p>
          <p className="text-xl font-bold text-ctp-blue">
            {currentDebtFreeDate ? formatDate(currentDebtFreeDate.toISOString()) : '-'}
          </p>
          <p className="text-xs text-ctp-subtext0">{monthsRemaining} mois</p>
        </div>
        <div className="bg-ctp-yellow/10 border border-ctp-yellow/30 rounded-lg p-4 text-center">
          <Coins className="w-6 h-6 mx-auto text-ctp-yellow mb-2" />
          <p className="text-sm text-ctp-subtext0">Interets restants</p>
          <p className="text-xl font-bold text-ctp-yellow">
            {formatCurrency(debtSummary.totalInterestRemaining, currency)}
          </p>
        </div>
      </div>

      <div className="h-px bg-ctp-surface1 mb-6" />

      {/* Simulation Inputs */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-ctp-subtext0 mb-3">
          Simulez un remboursement supplementaire
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-ctp-subtext0 mb-1">
              Montant supplementaire
            </label>
            <div className="relative">
              <input
                type="number"
                value={extraPayment}
                onChange={(e) => setExtraPayment(e.target.value)}
                min={0}
                step={50}
                className="input-text w-full pr-12"
                placeholder="200"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ctp-subtext0">
                {currency}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-ctp-subtext0 mb-1">
              Type de paiement
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setPaymentType('monthly')}
                className={clsx(
                  'flex-1 px-3 py-2 rounded-lg text-sm transition-colors',
                  paymentType === 'monthly'
                    ? 'bg-ctp-green text-ctp-base'
                    : 'bg-ctp-surface0 text-ctp-text hover:bg-ctp-surface1'
                )}
              >
                Mensuel
              </button>
              <button
                onClick={() => setPaymentType('one_time')}
                className={clsx(
                  'flex-1 px-3 py-2 rounded-lg text-sm transition-colors',
                  paymentType === 'one_time'
                    ? 'bg-ctp-green text-ctp-base'
                    : 'bg-ctp-surface0 text-ctp-text hover:bg-ctp-surface1'
                )}
              >
                Unique
              </button>
            </div>
          </div>
        </div>

        {/* Quick Amounts */}
        <div className="flex flex-wrap gap-2 mt-4">
          {[100, 200, 500, 1000, 2000].map((amount) => (
            <button
              key={amount}
              onClick={() => setExtraPayment(amount.toString())}
              className={clsx(
                'px-3 py-1 rounded-full text-sm transition-colors',
                extraPayment === amount.toString()
                  ? 'bg-ctp-green text-ctp-base'
                  : 'bg-ctp-surface0 text-ctp-subtext0 hover:bg-ctp-surface1'
              )}
            >
              {formatCurrency(amount, currency)}
            </button>
          ))}
        </div>
      </div>

      {/* Simulation Results */}
      {simulation && currentDebtFreeDate && (
        <div className="space-y-4">
          <div className="h-px bg-ctp-surface1" />

          {/* Timeline Comparison */}
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="text-center">
              <p className="text-xs text-ctp-subtext0 mb-1">Actuellement</p>
              <p className="text-lg font-semibold text-ctp-text">
                {formatDate(currentDebtFreeDate.toISOString())}
              </p>
              <p className="text-sm text-ctp-subtext0">
                {monthsRemaining} mois
              </p>
            </div>
            <div className="flex justify-center">
              <ArrowRight className="w-6 h-6 text-ctp-green" />
            </div>
            <div className="text-center">
              <p className="text-xs text-ctp-subtext0 mb-1">Avec extra</p>
              <p className="text-lg font-semibold text-ctp-green">
                {formatDate(simulation.newDebtFreeDate.toISOString())}
              </p>
              <p className="text-sm text-ctp-green">
                {monthsRemaining - simulation.monthsSaved} mois
              </p>
            </div>
          </div>

          {/* Savings Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-ctp-green/10 border border-ctp-green/30 rounded-lg p-4 text-center">
              <Calendar className="w-6 h-6 mx-auto text-ctp-green mb-2" />
              <p className="text-2xl font-bold text-ctp-green">
                {simulation.monthsSaved}
              </p>
              <p className="text-sm text-ctp-subtext0">mois gagnes</p>
            </div>
            <div className="bg-ctp-yellow/10 border border-ctp-yellow/30 rounded-lg p-4 text-center">
              <Coins className="w-6 h-6 mx-auto text-ctp-yellow mb-2" />
              <p className="text-2xl font-bold text-ctp-yellow">
                {formatCurrency(simulation.totalInterestSaved, currency)}
              </p>
              <p className="text-sm text-ctp-subtext0">interets economises</p>
            </div>
          </div>

          {/* Summary Text */}
          <div className="bg-ctp-surface0 rounded-lg p-4">
            <p className="text-sm text-ctp-subtext0">
              {paymentType === 'monthly' ? (
                <>
                  En ajoutant{' '}
                  <span className="font-semibold text-ctp-text">
                    {formatCurrency(parseFloat(extraPayment), currency)}
                  </span>{' '}
                  chaque mois a vos remboursements, vous serez libre de dettes{' '}
                  <span className="font-semibold text-ctp-green">
                    {simulation.monthsSaved} mois plus tot
                  </span>{' '}
                  et economiserez{' '}
                  <span className="font-semibold text-ctp-yellow">
                    {formatCurrency(simulation.totalInterestSaved, currency)}
                  </span>{' '}
                  en interets !
                </>
              ) : (
                <>
                  Avec un remboursement anticipe de{' '}
                  <span className="font-semibold text-ctp-text">
                    {formatCurrency(parseFloat(extraPayment), currency)}
                  </span>
                  , vous serez libre de dettes{' '}
                  <span className="font-semibold text-ctp-green">
                    {simulation.monthsSaved} mois plus tot
                  </span>{' '}
                  et economiserez{' '}
                  <span className="font-semibold text-ctp-yellow">
                    {formatCurrency(simulation.totalInterestSaved, currency)}
                  </span>{' '}
                  en interets !
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default DebtFreeCalculator;
