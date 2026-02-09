// ============================================================================
// NET WORTH WIDGET - Finance Hub Dashboard
// Displays net worth summary with trend
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import type { WidgetProps } from './index';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface NetWorthData {
  current: {
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
  };
  previousMonth?: {
    netWorth: number;
  };
  change?: {
    amount: number;
    percentage: number;
  };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

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

export function NetWorthWidget({ workspaceId }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['networth-widget', workspaceId],
    queryFn: () => api.get<NetWorthData>(`/workspaces/${workspaceId}/networth/summary`),
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return (
      <div className="h-full flex flex-col justify-center">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-ctp-surface1 rounded w-1/3" />
          <div className="h-10 bg-ctp-surface1 rounded w-2/3" />
          <div className="h-4 bg-ctp-surface1 rounded w-1/2" />
        </div>
      </div>
    );
  }

  const netWorthData = data ?? {
    current: { totalAssets: 0, totalLiabilities: 0, netWorth: 0 },
  };

  const { current, change } = netWorthData;
  const isPositive = current.netWorth >= 0;
  const hasChange = change && change.amount !== 0;
  const changeIsPositive = change && change.amount > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Main Value */}
      <div className="flex-1 flex flex-col justify-center">
        <p className="text-xs text-ctp-subtext0 uppercase tracking-wide mb-1">
          Patrimoine net
        </p>
        <p className={clsx(
          'text-2xl font-bold',
          isPositive ? 'text-ctp-green' : 'text-ctp-red'
        )}>
          {formatCurrency(current.netWorth)}
        </p>

        {/* Change Indicator */}
        {hasChange && (
          <div className={clsx(
            'flex items-center gap-1 mt-2',
            changeIsPositive ? 'text-ctp-green' : 'text-ctp-red'
          )}>
            {changeIsPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : change.amount < 0 ? (
              <TrendingDown className="w-4 h-4" />
            ) : (
              <Minus className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {formatCurrency(Math.abs(change.amount))}
            </span>
            <span className="text-xs text-ctp-subtext0">
              ({formatPercent(change.percentage)})
            </span>
          </div>
        )}
      </div>

      {/* Assets / Liabilities */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-ctp-surface1">
        <div>
          <p className="text-xs text-ctp-subtext0">Actifs</p>
          <p className="text-sm font-semibold text-ctp-green">
            {formatCurrency(current.totalAssets)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ctp-subtext0">Passifs</p>
          <p className="text-sm font-semibold text-ctp-red">
            {formatCurrency(current.totalLiabilities)}
          </p>
        </div>
      </div>

      {/* Link */}
      <Link
        to="/networth"
        className="mt-2 text-center text-xs text-ctp-blue hover:text-ctp-sapphire transition-colors"
      >
        Voir l'historique
      </Link>
    </div>
  );
}

export default NetWorthWidget;
