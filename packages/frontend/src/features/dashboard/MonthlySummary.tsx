// ============================================================================
// MONTHLY SUMMARY - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { Wallet, TrendingUp, TrendingDown, CheckCircle, AlertTriangle, Target, Trophy, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface MonthlySummaryProps {
  data: {
    period: { year: number; month: number };
    flow: {
      income: number;
      expenses: number;
      net: number;
      savingsRate: number;
    };
    comparison: {
      incomeChange: number;
      expenseChange: number;
    };
    totalBalance: number;
  };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function MonthlySummary({ data }: MonthlySummaryProps) {
  const { period, flow, comparison, totalBalance } = data;

  const cards = [
    {
      label: 'Solde total',
      value: formatCurrency(totalBalance),
      change: null,
      bgColor: totalBalance >= 0 ? 'bg-ctp-blue/10' : 'bg-ctp-red/10',
      textColor: totalBalance >= 0 ? 'text-ctp-blue' : 'text-ctp-red',
      borderColor: totalBalance >= 0 ? 'border-ctp-blue/30' : 'border-ctp-red/30',
      icon: Wallet,
      iconBg: totalBalance >= 0 ? 'bg-ctp-blue/20' : 'bg-ctp-red/20',
    },
    {
      label: 'Revenus',
      value: formatCurrency(flow.income),
      change: comparison.incomeChange,
      bgColor: 'bg-ctp-green/10',
      textColor: 'text-ctp-green',
      borderColor: 'border-ctp-green/30',
      icon: TrendingUp,
      iconBg: 'bg-ctp-green/20',
    },
    {
      label: 'Dépenses',
      value: formatCurrency(flow.expenses),
      change: comparison.expenseChange,
      bgColor: 'bg-ctp-red/10',
      textColor: 'text-ctp-red',
      borderColor: 'border-ctp-red/30',
      icon: TrendingDown,
      iconBg: 'bg-ctp-red/20',
    },
  ];

  return (
    <div>
      {/* Period Title */}
      <h2 className="text-lg font-semibold text-ctp-text mb-4">
        {MONTH_NAMES[period.month - 1]} {period.year}
      </h2>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={clsx(
              'rounded-xl p-4 border transition-all hover:shadow-lg',
              card.bgColor,
              card.borderColor
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={clsx('text-sm font-medium', card.textColor, 'opacity-80')}>
                  {card.label}
                </p>
                <p className={clsx('text-2xl font-bold mt-1', card.textColor)}>
                  {card.value}
                </p>
                {card.change !== null && (
                  <p
                    className={clsx(
                      'text-sm mt-2 font-medium',
                      card.change > 0 ? 'text-ctp-green' : 'text-ctp-red'
                    )}
                  >
                    {formatPercent(card.change)} vs mois précédent
                  </p>
                )}
              </div>
              <div className={clsx('p-2 rounded-lg', card.iconBg)}>
                <card.icon className={clsx('w-6 h-6', card.textColor)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Net & Savings Rate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div
          className={clsx(
            'rounded-xl p-4 border transition-all',
            flow.net >= 0
              ? 'bg-ctp-green/5 border-ctp-green/20'
              : 'bg-ctp-red/5 border-ctp-red/20'
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ctp-subtext0 font-medium">Solde du mois</p>
              <p
                className={clsx(
                  'text-xl font-bold mt-1',
                  flow.net >= 0 ? 'text-ctp-green' : 'text-ctp-red'
                )}
              >
                {flow.net >= 0 ? '+' : ''}{formatCurrency(flow.net)}
              </p>
            </div>
            <div
              className={clsx(
                'p-2 rounded-lg',
                flow.net >= 0 ? 'bg-ctp-green/20' : 'bg-ctp-red/20'
              )}
            >
              {flow.net >= 0 ? (
                <CheckCircle className="w-6 h-6 text-ctp-green" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-ctp-red" />
              )}
            </div>
          </div>
        </div>

        <div
          className={clsx(
            'rounded-xl p-4 border transition-all',
            flow.savingsRate >= 20
              ? 'bg-ctp-green/5 border-ctp-green/20'
              : flow.savingsRate >= 0
                ? 'bg-ctp-yellow/5 border-ctp-yellow/20'
                : 'bg-ctp-red/5 border-ctp-red/20'
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ctp-subtext0 font-medium">Taux d'épargne</p>
              <p
                className={clsx(
                  'text-xl font-bold mt-1',
                  flow.savingsRate >= 20 ? 'text-ctp-green' :
                  flow.savingsRate >= 0 ? 'text-ctp-yellow' : 'text-ctp-red'
                )}
              >
                {flow.savingsRate.toFixed(1)}%
              </p>
            </div>
            <div
              className={clsx(
                'p-2 rounded-lg',
                flow.savingsRate >= 20
                  ? 'bg-ctp-green/20'
                  : flow.savingsRate >= 0
                    ? 'bg-ctp-yellow/20'
                    : 'bg-ctp-red/20'
              )}
            >
              {flow.savingsRate >= 20 ? (
                <Trophy className="w-6 h-6 text-ctp-green" />
              ) : flow.savingsRate >= 0 ? (
                <Target className="w-6 h-6 text-ctp-yellow" />
              ) : (
                <BarChart3 className="w-6 h-6 text-ctp-red" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MonthlySummary;
