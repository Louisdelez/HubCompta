// ============================================================================
// PORTFOLIO WIDGET - Finance Hub Dashboard
// Displays investment portfolio summary
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { Briefcase, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import type { WidgetProps } from './index';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
  dayChange?: number;
  dayChangePercent?: number;
  positions: {
    id: string;
    asset: {
      symbol: string;
      name: string;
      type: string;
    };
    quantity: number;
    currentValue: number;
    gainPercent: number;
  }[];
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
  return `${sign}${value.toFixed(2)}%`;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function PortfolioWidget({ workspaceId }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['portfolio-widget', workspaceId],
    queryFn: () => api.get<PortfolioSummary>(`/workspaces/${workspaceId}/portfolio/summary`),
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="animate-pulse space-y-3 flex-1">
          <div className="h-8 bg-ctp-surface1 rounded w-1/2" />
          <div className="h-4 bg-ctp-surface1 rounded w-1/3" />
          <div className="space-y-2 mt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 bg-ctp-surface1 rounded w-1/3" />
                <div className="h-4 bg-ctp-surface1 rounded w-1/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const portfolio = data ?? {
    totalValue: 0,
    totalCost: 0,
    totalGain: 0,
    totalGainPercent: 0,
    positions: [],
  };

  const isPositive = portfolio.totalGain >= 0;
  const topPositions = portfolio.positions.slice(0, 4);

  return (
    <div className="h-full flex flex-col">
      {portfolio.positions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Briefcase className="w-10 h-10 text-ctp-overlay1 mb-2" />
          <p className="text-sm text-ctp-subtext0">Aucun investissement</p>
          <Link
            to="/invest"
            className="text-xs text-ctp-blue hover:underline mt-1"
          >
            Ajouter une position
          </Link>
        </div>
      ) : (
        <>
          {/* Total Value */}
          <div className="mb-3">
            <p className="text-xs text-ctp-subtext0 uppercase tracking-wide">
              Valeur totale
            </p>
            <p className="text-xl font-bold text-ctp-text">
              {formatCurrency(portfolio.totalValue)}
            </p>
            <div className={clsx(
              'flex items-center gap-1 text-sm',
              isPositive ? 'text-ctp-green' : 'text-ctp-red'
            )}>
              {isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span className="font-medium">
                {formatCurrency(portfolio.totalGain)}
              </span>
              <span className="text-xs">
                ({formatPercent(portfolio.totalGainPercent)})
              </span>
            </div>
          </div>

          {/* Positions */}
          <div className="flex-1 overflow-y-auto space-y-2 -mx-1 px-1">
            {topPositions.map((position) => {
              const posIsPositive = position.gainPercent >= 0;

              return (
                <Link
                  key={position.id}
                  to="/invest"
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-ctp-mantle transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ctp-text">
                      {position.asset.symbol}
                    </p>
                    <p className="text-xs text-ctp-subtext0 truncate">
                      {position.asset.name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-ctp-text">
                      {formatCurrency(position.currentValue)}
                    </p>
                    <p className={clsx(
                      'text-xs font-medium',
                      posIsPositive ? 'text-ctp-green' : 'text-ctp-red'
                    )}>
                      {formatPercent(position.gainPercent)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* View All Link */}
          {portfolio.positions.length > 4 && (
            <Link
              to="/invest"
              className="mt-2 pt-2 border-t border-ctp-surface1 text-center text-sm text-ctp-blue hover:text-ctp-sapphire transition-colors"
            >
              Voir les {portfolio.positions.length} positions
            </Link>
          )}
        </>
      )}
    </div>
  );
}

export default PortfolioWidget;
