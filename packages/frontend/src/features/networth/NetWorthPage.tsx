// ============================================================================
// NET WORTH PAGE - Finance Hub
// Main dashboard for net worth tracking
// Uses Catppuccin colors: green for positive, red for negative
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Camera,
  LineChart as LineChartIcon,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { formatCurrency, cn } from '@/lib/utils';
import { NetWorthChart } from './NetWorthChart';
import { NetWorthBreakdown } from './NetWorthBreakdown';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface AccountBreakdown {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

interface InvestmentBreakdown {
  id: string;
  symbol: string;
  name: string;
  type: string;
  value: number;
  currency: string;
}

interface LoanBreakdown {
  id: string;
  name: string;
  type: 'debt' | 'credit';
  balance: number;
  currency: string;
}

interface NetWorthSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  accountsTotal: number;
  investmentsTotal: number;
  debtsTotal: number;
  creditsTotal: number;
  breakdown: {
    accounts: AccountBreakdown[];
    investments: InvestmentBreakdown[];
    loans: LoanBreakdown[];
  };
  currency: string;
}

interface NetWorthHistoryPoint {
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function NetWorthPage() {
  const { currentWorkspaceId, currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [showBreakdown, setShowBreakdown] = useState(true);
  const baseCurrency = currentWorkspace?.currency || 'EUR';

  // Fetch current net worth
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
    isFetching: isFetchingSummary,
  } = useQuery({
    queryKey: ['networth', currentWorkspaceId],
    queryFn: () => api.get<NetWorthSummary>(`/workspaces/${currentWorkspaceId}/networth`),
    enabled: !!currentWorkspaceId,
  });

  // Fetch net worth history
  const {
    data: history,
    isLoading: historyLoading,
    error: historyError,
  } = useQuery({
    queryKey: ['networth', currentWorkspaceId, 'history'],
    queryFn: () => api.get<NetWorthHistoryPoint[]>(`/workspaces/${currentWorkspaceId}/networth/history`),
    enabled: !!currentWorkspaceId,
  });

  // Create snapshot mutation
  const createSnapshotMutation = useMutation({
    mutationFn: () => api.post(`/workspaces/${currentWorkspaceId}/networth/snapshot`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networth', currentWorkspaceId] });
    },
  });

  const handleRefresh = async () => {
    await refetchSummary();
  };

  const handleCreateSnapshot = () => {
    createSnapshotMutation.mutate();
  };

  if (!currentWorkspaceId) {
    return (
      <div className="p-6 text-center text-ctp-subtext0">
        Selectionnez un espace de travail
      </div>
    );
  }

  if (summaryLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-ctp-surface1 rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-ctp-surface1 rounded-xl" />
            ))}
          </div>
          <div className="h-80 bg-ctp-surface1 rounded-xl" />
        </div>
      </div>
    );
  }

  if (summaryError) {
    return (
      <div className="p-6 text-center">
        <p className="text-ctp-red">Erreur lors du chargement du patrimoine</p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-ctp-surface1 rounded-lg hover:bg-ctp-surface2"
        >
          Reessayer
        </button>
      </div>
    );
  }

  const isPositive = (summary?.netWorth ?? 0) >= 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ctp-text">Patrimoine Net</h1>
          <p className="text-ctp-subtext0">
            Vue d'ensemble de votre patrimoine
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isFetchingSummary}
            className="px-3 py-2 text-ctp-subtext0 bg-ctp-surface0 rounded-lg hover:bg-ctp-surface1 flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', isFetchingSummary && 'animate-spin')} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
          <button
            onClick={handleCreateSnapshot}
            disabled={createSnapshotMutation.isPending}
            className="px-4 py-2 bg-ctp-blue text-ctp-base rounded-lg hover:bg-ctp-blue/90 flex items-center gap-2 disabled:opacity-50"
          >
            {createSnapshotMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            Sauvegarder
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Net Worth Card */}
          <div
            className={cn(
              'border rounded-xl p-6',
              isPositive
                ? 'bg-ctp-green/10 border-ctp-green/30'
                : 'bg-ctp-red/10 border-ctp-red/30'
            )}
          >
            <div className="flex items-center gap-2 text-ctp-subtext0 mb-2">
              {isPositive ? (
                <TrendingUp className="h-5 w-5 text-ctp-green" />
              ) : (
                <TrendingDown className="h-5 w-5 text-ctp-red" />
              )}
              <span className="text-sm font-medium">Patrimoine Net</span>
            </div>
            <p
              className={cn(
                'text-3xl font-bold',
                isPositive ? 'text-ctp-green' : 'text-ctp-red'
              )}
            >
              {formatCurrency(summary.netWorth, baseCurrency)}
            </p>
          </div>

          {/* Total Assets Card */}
          <div className="bg-ctp-mantle border border-ctp-surface1 rounded-xl p-6">
            <div className="flex items-center gap-2 text-ctp-subtext0 mb-2">
              <Wallet className="h-5 w-5 text-ctp-teal" />
              <span className="text-sm font-medium">Total Actifs</span>
            </div>
            <p className="text-3xl font-bold text-ctp-teal">
              {formatCurrency(summary.totalAssets, baseCurrency)}
            </p>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-ctp-overlay1">Comptes</span>
                <span className="text-ctp-text">
                  {formatCurrency(summary.accountsTotal, baseCurrency)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-ctp-overlay1">Investissements</span>
                <span className="text-ctp-text">
                  {formatCurrency(summary.investmentsTotal, baseCurrency)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-ctp-overlay1">Creances</span>
                <span className="text-ctp-text">
                  {formatCurrency(summary.creditsTotal, baseCurrency)}
                </span>
              </div>
            </div>
          </div>

          {/* Total Liabilities Card */}
          <div className="bg-ctp-mantle border border-ctp-surface1 rounded-xl p-6">
            <div className="flex items-center gap-2 text-ctp-subtext0 mb-2">
              <TrendingDown className="h-5 w-5 text-ctp-red" />
              <span className="text-sm font-medium">Total Passifs</span>
            </div>
            <p className="text-3xl font-bold text-ctp-red">
              {formatCurrency(summary.totalLiabilities, baseCurrency)}
            </p>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-ctp-overlay1">Dettes</span>
                <span className="text-ctp-text">
                  {formatCurrency(summary.debtsTotal, baseCurrency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-ctp-mantle border border-ctp-surface1 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <LineChartIcon className="h-5 w-5 text-ctp-subtext0" />
            <h2 className="text-lg font-medium text-ctp-text">Evolution du patrimoine</h2>
          </div>
          <label className="flex items-center gap-2 text-sm text-ctp-subtext0">
            <input
              type="checkbox"
              checked={showBreakdown}
              onChange={(e) => setShowBreakdown(e.target.checked)}
              className="rounded border-ctp-surface1 text-ctp-blue focus:ring-ctp-blue"
            />
            Afficher les actifs
          </label>
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center h-72">
            <Loader2 className="h-8 w-8 animate-spin text-ctp-blue" />
          </div>
        ) : historyError ? (
          <div className="flex items-center justify-center h-72 text-ctp-overlay1">
            Erreur lors du chargement de l'historique
          </div>
        ) : history && history.length >= 2 ? (
          <NetWorthChart
            data={history}
            currency={baseCurrency}
            showBreakdown={showBreakdown}
            height={300}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-72 text-ctp-overlay1">
            <LineChartIcon className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Historique en cours de construction</p>
            <p className="text-sm mt-1">
              Cliquez sur "Sauvegarder" pour creer votre premier snapshot
            </p>
          </div>
        )}
      </div>

      {/* Breakdown */}
      {summary && (
        <NetWorthBreakdown
          accounts={summary.breakdown.accounts}
          investments={summary.breakdown.investments}
          loans={summary.breakdown.loans}
          totalAssets={summary.totalAssets}
          totalLiabilities={summary.totalLiabilities}
          currency={baseCurrency}
        />
      )}
    </div>
  );
}

export default NetWorthPage;
