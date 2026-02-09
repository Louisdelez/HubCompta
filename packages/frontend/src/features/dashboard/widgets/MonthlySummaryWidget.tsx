// ============================================================================
// MONTHLY SUMMARY WIDGET - Finance Hub Dashboard
// Displays monthly income, expenses, and savings rate
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { Wallet, TrendingUp, TrendingDown, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import type { WidgetProps } from './index';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface SummaryData {
  period: {
    year: number;
    month: number;
  };
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
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const MONTH_NAMES = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function MonthlySummaryWidget({ workspaceId }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['monthly-summary-widget', workspaceId],
    queryFn: () => api.get<SummaryData>(`/workspaces/${workspaceId}/reports/summary`),
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center">
        <div className="animate-pulse flex gap-4 w-full">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1">
              <div className="h-4 bg-ctp-surface1 rounded w-1/2 mb-2" />
              <div className="h-6 bg-ctp-surface1 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const summary = data ?? {
    period: { year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
    flow: { income: 0, expenses: 0, net: 0, savingsRate: 0 },
    comparison: { incomeChange: 0, expenseChange: 0 },
    totalBalance: 0,
  };

  const { period, flow, comparison, totalBalance } = summary;

  const cards = [
    {
      label: 'Solde',
      value: formatCurrency(totalBalance),
      change: null,
      icon: Wallet,
      color: totalBalance >= 0 ? 'text-ctp-blue' : 'text-ctp-red',
      bgColor: totalBalance >= 0 ? 'bg-ctp-blue/10' : 'bg-ctp-red/10',
    },
    {
      label: 'Revenus',
      value: formatCurrency(flow.income),
      change: comparison.incomeChange,
      icon: TrendingUp,
      color: 'text-ctp-green',
      bgColor: 'bg-ctp-green/10',
    },
    {
      label: 'Depenses',
      value: formatCurrency(flow.expenses),
      change: comparison.expenseChange,
      icon: TrendingDown,
      color: 'text-ctp-red',
      bgColor: 'bg-ctp-red/10',
    },
    {
      label: 'Solde mensuel',
      value: formatCurrency(flow.net),
      subtext: `${flow.savingsRate.toFixed(0)}% epargne`,
      icon: flow.net >= 0 ? CheckCircle : AlertTriangle,
      color: flow.net >= 0 ? 'text-ctp-green' : 'text-ctp-red',
      bgColor: flow.net >= 0 ? 'bg-ctp-green/10' : 'bg-ctp-red/10',
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Period Header */}
      <div className="text-xs text-ctp-subtext0 mb-2">
        {MONTH_NAMES[period.month - 1]} {period.year}
      </div>

      {/* Stats Grid */}
      <div className="flex-1 grid grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className={clsx(
                'rounded-lg p-3 flex flex-col justify-between',
                card.bgColor
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-ctp-subtext0">{card.label}</p>
                  <p className={clsx('text-lg font-bold', card.color)}>
                    {card.value}
                  </p>
                </div>
                <div className={clsx('p-1.5 rounded-lg', card.bgColor)}>
                  <Icon className={clsx('w-4 h-4', card.color)} />
                </div>
              </div>

              {card.change !== null && card.change !== undefined && (
                <p
                  className={clsx(
                    'text-xs mt-1',
                    card.change > 0 ? 'text-ctp-green' : 'text-ctp-red'
                  )}
                >
                  {formatPercent(card.change)} vs M-1
                </p>
              )}

              {card.subtext && (
                <p className="text-xs text-ctp-subtext0 mt-1">{card.subtext}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MonthlySummaryWidget;
