// ============================================================================
// MONTHLY SUMMARY - Finance Hub
// ============================================================================

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
      color: 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300',
      icon: '💰',
    },
    {
      label: 'Revenus',
      value: formatCurrency(flow.income),
      change: comparison.incomeChange,
      color: 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300',
      icon: '📈',
    },
    {
      label: 'Dépenses',
      value: formatCurrency(flow.expenses),
      change: comparison.expenseChange,
      color: 'bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300',
      icon: '📉',
    },
  ];

  return (
    <div>
      {/* Period Title */}
      <h2 className="text-lg font-semibold mb-4">
        {MONTH_NAMES[period.month - 1]} {period.year}
      </h2>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={clsx('card', card.color)}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm opacity-80">{card.label}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
                {card.change !== null && (
                  <p
                    className={clsx(
                      'text-sm mt-1',
                      card.change > 0 ? 'text-success-600' : 'text-danger-600'
                    )}
                  >
                    {formatPercent(card.change)} vs mois précédent
                  </p>
                )}
              </div>
              <span className="text-2xl">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Net & Savings Rate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Solde du mois</p>
              <p
                className={clsx(
                  'text-xl font-bold',
                  flow.net >= 0 ? 'text-success-600' : 'text-danger-600'
                )}
              >
                {formatCurrency(flow.net)}
              </p>
            </div>
            <span className="text-2xl">{flow.net >= 0 ? '✅' : '⚠️'}</span>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Taux d'épargne</p>
              <p
                className={clsx(
                  'text-xl font-bold',
                  flow.savingsRate >= 20 ? 'text-success-600' :
                  flow.savingsRate >= 0 ? 'text-warning-600' : 'text-danger-600'
                )}
              >
                {flow.savingsRate.toFixed(1)}%
              </p>
            </div>
            <span className="text-2xl">
              {flow.savingsRate >= 20 ? '🏆' : flow.savingsRate >= 0 ? '🎯' : '📊'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MonthlySummary;
