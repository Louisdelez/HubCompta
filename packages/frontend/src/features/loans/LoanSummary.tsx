// ============================================================================
// LOAN SUMMARY - Finance Hub
// Shows debt vs credit summary widget
// Uses Catppuccin colors: red for debts, green for credits
// ============================================================================

import { clsx } from 'clsx';
import { TrendingDown, TrendingUp, Scale } from 'lucide-react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface LoanSummaryData {
  totalDebt: number;
  totalCredit: number;
  netPosition: number;
  debtCount: number;
  creditCount: number;
}

interface LoanSummaryProps {
  summary: LoanSummaryData;
  currency?: string;
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

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function LoanSummary({ summary, currency = 'EUR' }: LoanSummaryProps) {
  const isPositive = summary.netPosition > 0;
  const isNeutral = summary.netPosition === 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total Debt */}
      <div className="card">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-ctp-red/20">
            <TrendingDown className="w-6 h-6 text-ctp-red" />
          </div>
          <div>
            <p className="text-sm text-ctp-subtext0">Dettes</p>
            <p className="text-2xl font-bold text-ctp-red">
              {formatCurrency(summary.totalDebt, currency)}
            </p>
            <p className="text-xs text-ctp-subtext0">
              {summary.debtCount} {summary.debtCount === 1 ? 'dette' : 'dettes'}
            </p>
          </div>
        </div>
      </div>

      {/* Total Credit */}
      <div className="card">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-ctp-green/20">
            <TrendingUp className="w-6 h-6 text-ctp-green" />
          </div>
          <div>
            <p className="text-sm text-ctp-subtext0">Creances</p>
            <p className="text-2xl font-bold text-ctp-green">
              {formatCurrency(summary.totalCredit, currency)}
            </p>
            <p className="text-xs text-ctp-subtext0">
              {summary.creditCount} {summary.creditCount === 1 ? 'creance' : 'creances'}
            </p>
          </div>
        </div>
      </div>

      {/* Net Position */}
      <div className="card">
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'p-3 rounded-xl',
              isNeutral && 'bg-ctp-overlay0/20',
              isPositive && 'bg-ctp-green/20',
              !isPositive && !isNeutral && 'bg-ctp-red/20'
            )}
          >
            <Scale
              className={clsx(
                'w-6 h-6',
                isNeutral && 'text-ctp-overlay0',
                isPositive && 'text-ctp-green',
                !isPositive && !isNeutral && 'text-ctp-red'
              )}
            />
          </div>
          <div>
            <p className="text-sm text-ctp-subtext0">Position nette</p>
            <p
              className={clsx(
                'text-2xl font-bold',
                isNeutral && 'text-ctp-text',
                isPositive && 'text-ctp-green',
                !isPositive && !isNeutral && 'text-ctp-red'
              )}
            >
              {isPositive ? '+' : ''}
              {formatCurrency(summary.netPosition, currency)}
            </p>
            <p className="text-xs text-ctp-subtext0">
              {isPositive ? 'En votre faveur' : isNeutral ? 'Equilibre' : 'A rembourser'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoanSummary;
