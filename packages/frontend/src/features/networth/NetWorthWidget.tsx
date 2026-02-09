// ============================================================================
// NET WORTH WIDGET COMPONENT - Finance Hub
// Compact widget for dashboard showing net worth summary
// Uses Catppuccin colors: green for positive, red for negative
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Link } from 'react-router-dom';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface NetWorthSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  accountsTotal: number;
  investmentsTotal: number;
  debtsTotal: number;
  creditsTotal: number;
  currency: string;
}

interface NetWorthWidgetProps {
  className?: string;
  showDetails?: boolean;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function NetWorthWidget({ className, showDetails = true }: NetWorthWidgetProps) {
  const { currentWorkspaceId, currentWorkspace } = useWorkspace();
  const baseCurrency = currentWorkspace?.currency || 'EUR';

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['networth', currentWorkspaceId],
    queryFn: () => api.get<NetWorthSummary>(`/workspaces/${currentWorkspaceId}/networth`),
    enabled: !!currentWorkspaceId,
    staleTime: 60000, // 1 minute
  });

  if (!currentWorkspaceId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={cn('bg-ctp-mantle border border-ctp-surface1 rounded-xl p-4', className)}>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-ctp-blue" />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className={cn('bg-ctp-mantle border border-ctp-surface1 rounded-xl p-4', className)}>
        <p className="text-sm text-ctp-overlay1 text-center py-4">
          Impossible de charger le patrimoine
        </p>
      </div>
    );
  }

  const isPositive = summary.netWorth >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;

  return (
    <Link
      to={`/workspaces/${currentWorkspaceId}/networth`}
      className={cn(
        'block bg-ctp-mantle border border-ctp-surface1 rounded-xl p-4 hover:border-ctp-surface2 transition-colors',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-ctp-subtext1">Patrimoine Net</h3>
        <Icon
          className={cn(
            'h-5 w-5',
            isPositive ? 'text-ctp-green' : 'text-ctp-red'
          )}
        />
      </div>

      {/* Main Value */}
      <p className={cn(
        'text-2xl font-bold',
        isPositive ? 'text-ctp-green' : 'text-ctp-red'
      )}>
        {formatCurrency(summary.netWorth, baseCurrency)}
      </p>

      {/* Details */}
      {showDetails && (
        <div className="mt-4 space-y-2">
          {/* Assets */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-ctp-subtext0">Actifs</span>
            <span className="text-xs font-medium text-ctp-green">
              {formatCurrency(summary.totalAssets, baseCurrency)}
            </span>
          </div>

          {/* Liabilities */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-ctp-subtext0">Passifs</span>
            <span className="text-xs font-medium text-ctp-red">
              {formatCurrency(summary.totalLiabilities, baseCurrency)}
            </span>
          </div>

          {/* Separator */}
          <div className="border-t border-ctp-surface1 my-2" />

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-ctp-surface0 rounded-lg p-2">
              <p className="text-xs text-ctp-overlay1">Comptes</p>
              <p className="text-sm font-medium text-ctp-text">
                {formatCurrency(summary.accountsTotal, baseCurrency)}
              </p>
            </div>
            <div className="bg-ctp-surface0 rounded-lg p-2">
              <p className="text-xs text-ctp-overlay1">Investissements</p>
              <p className="text-sm font-medium text-ctp-text">
                {formatCurrency(summary.investmentsTotal, baseCurrency)}
              </p>
            </div>
          </div>
        </div>
      )}
    </Link>
  );
}

export default NetWorthWidget;
