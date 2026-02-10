// ============================================================================
// LOAN SIMULATOR - Finance Hub
// Simulate extra payments and their impact on loan payoff
// ============================================================================

import { useState, useMemo } from 'react';
import { Calculator, Calendar, Coins, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';

interface LoanSimulatorProps {
  principalRemaining: number;
  monthlyPayment: number;
  interestRate: number;
  remainingMonths: number;
  currency?: string;
}

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(monthsFromNow: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + monthsFromNow);
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

interface SimulationResult {
  newRemainingMonths: number;
  totalInterestSaved: number;
  newPayoffDate: string;
  originalPayoffDate: string;
  monthsSaved: number;
}

function simulateLoan(
  principal: number,
  monthlyPayment: number,
  annualRate: number,
  extraPayment: number,
  extraPaymentType: 'monthly' | 'one_time'
): SimulationResult {
  const monthlyRate = annualRate / 12 / 100;

  // Original scenario
  let originalBalance = principal;
  let originalMonths = 0;
  let originalInterest = 0;

  while (originalBalance > 0 && originalMonths < 600) {
    const interest = originalBalance * monthlyRate;
    originalInterest += interest;
    const principalPaid = Math.min(monthlyPayment - interest, originalBalance);
    originalBalance -= principalPaid;
    originalMonths++;
  }

  // New scenario with extra payment
  let newBalance = principal;
  let newMonths = 0;
  let newInterest = 0;
  const effectiveMonthlyPayment =
    extraPaymentType === 'monthly'
      ? monthlyPayment + extraPayment
      : monthlyPayment;

  if (extraPaymentType === 'one_time') {
    newBalance = Math.max(0, principal - extraPayment);
  }

  while (newBalance > 0 && newMonths < 600) {
    const interest = newBalance * monthlyRate;
    newInterest += interest;
    const principalPaid = Math.min(effectiveMonthlyPayment - interest, newBalance);
    newBalance -= principalPaid;
    newMonths++;
  }

  return {
    newRemainingMonths: newMonths,
    totalInterestSaved: originalInterest - newInterest,
    newPayoffDate: formatDate(newMonths),
    originalPayoffDate: formatDate(originalMonths),
    monthsSaved: originalMonths - newMonths,
  };
}

export function LoanSimulator({
  principalRemaining,
  monthlyPayment,
  interestRate,
  remainingMonths,
  currency = 'EUR',
}: LoanSimulatorProps) {
  const [extraPayment, setExtraPayment] = useState('100');
  const [paymentType, setPaymentType] = useState<'monthly' | 'one_time'>('monthly');

  const simulation = useMemo(() => {
    const extra = parseFloat(extraPayment) || 0;
    if (extra <= 0) return null;

    return simulateLoan(
      principalRemaining,
      monthlyPayment,
      interestRate,
      extra,
      paymentType
    );
  }, [principalRemaining, monthlyPayment, interestRate, extraPayment, paymentType]);

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-5 h-5 text-ctp-blue" />
        <h3 className="font-semibold">Simulateur de remboursement</h3>
      </div>

      {/* Input Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
              placeholder="100"
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
                  ? 'bg-ctp-blue text-ctp-base'
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
                  ? 'bg-ctp-blue text-ctp-base'
                  : 'bg-ctp-surface0 text-ctp-text hover:bg-ctp-surface1'
              )}
            >
              Unique
            </button>
          </div>
        </div>
      </div>

      {/* Quick Amounts */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[50, 100, 200, 500, 1000].map((amount) => (
          <button
            key={amount}
            onClick={() => setExtraPayment(amount.toString())}
            className={clsx(
              'px-3 py-1 rounded-full text-sm transition-colors',
              extraPayment === amount.toString()
                ? 'bg-ctp-blue text-ctp-base'
                : 'bg-ctp-surface0 text-ctp-subtext0 hover:bg-ctp-surface1'
            )}
          >
            {formatCurrency(amount, currency)}
          </button>
        ))}
      </div>

      {/* Results */}
      {simulation && (
        <div className="space-y-4">
          <div className="h-px bg-ctp-surface1" />

          {/* Comparison */}
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="text-center">
              <p className="text-xs text-ctp-subtext0 mb-1">Actuellement</p>
              <p className="text-lg font-semibold text-ctp-text">
                {simulation.originalPayoffDate}
              </p>
              <p className="text-sm text-ctp-subtext0">
                {remainingMonths} mois
              </p>
            </div>
            <div className="flex justify-center">
              <ArrowRight className="w-6 h-6 text-ctp-green" />
            </div>
            <div className="text-center">
              <p className="text-xs text-ctp-subtext0 mb-1">Avec extra</p>
              <p className="text-lg font-semibold text-ctp-green">
                {simulation.newPayoffDate}
              </p>
              <p className="text-sm text-ctp-green">
                {simulation.newRemainingMonths} mois
              </p>
            </div>
          </div>

          {/* Stats */}
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

          {/* Summary */}
          <div className="bg-ctp-surface0 rounded-lg p-4">
            <p className="text-sm text-ctp-subtext0">
              {paymentType === 'monthly' ? (
                <>
                  En ajoutant{' '}
                  <span className="font-semibold text-ctp-text">
                    {formatCurrency(parseFloat(extraPayment), currency)}
                  </span>{' '}
                  chaque mois, vous rembourserez votre pret{' '}
                  <span className="font-semibold text-ctp-green">
                    {simulation.monthsSaved} mois plus tot
                  </span>{' '}
                  et economiserez{' '}
                  <span className="font-semibold text-ctp-yellow">
                    {formatCurrency(simulation.totalInterestSaved, currency)}
                  </span>{' '}
                  en interets.
                </>
              ) : (
                <>
                  Avec un remboursement unique de{' '}
                  <span className="font-semibold text-ctp-text">
                    {formatCurrency(parseFloat(extraPayment), currency)}
                  </span>
                  , vous rembourserez votre pret{' '}
                  <span className="font-semibold text-ctp-green">
                    {simulation.monthsSaved} mois plus tot
                  </span>{' '}
                  et economiserez{' '}
                  <span className="font-semibold text-ctp-yellow">
                    {formatCurrency(simulation.totalInterestSaved, currency)}
                  </span>{' '}
                  en interets.
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoanSimulator;
