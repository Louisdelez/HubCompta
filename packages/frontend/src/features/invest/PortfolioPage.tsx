// ============================================================================
// PORTFOLIO PAGE - Finance Hub
// Main investment portfolio dashboard
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  RefreshCw,
  Wallet,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  List,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import { PositionList } from './PositionList';
import { AddPosition } from './AddPosition';
import { AddPositionTransaction } from './AddPositionTransaction';
import { PositionDetail } from './PositionDetail';
import { AllocationChart, AllocationLegend } from './AllocationChart';
import { PerformanceChart } from './PerformanceChart';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalUnrealizedGain: number;
  totalReturn: number;
  totalReturnPercent: number;
  totalRealizedGain: number;
  positionCount: number;
  allocation: {
    type: string;
    value: number;
    percent: number;
  }[];
  positions: {
    id: string;
    asset: {
      id: string;
      symbol: string;
      name: string;
      type: string;
      currency: string;
    };
    currentValue: number;
    unrealizedGain: number;
    unrealizedGainPercent: number;
  }[];
}

interface AllocationData {
  totalValue: number;
  byType: {
    type: string;
    value: number;
    percent: number;
  }[];
  byCurrency: {
    currency: string;
    value: number;
    percent: number;
  }[];
}

interface PerformanceDataPoint {
  date: string;
  value: number;
  invested: number;
}

interface PerformanceData {
  current: PortfolioSummary;
  history: PerformanceDataPoint[];
}

type ViewMode = 'list' | 'detail';

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

// Refresh interval in milliseconds (30 seconds)
const REFRESH_INTERVAL = 30000;

export function PortfolioPage() {
  const { currentWorkspace } = useWorkspace();
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [selectedPositionAsset, setSelectedPositionAsset] = useState<{ symbol: string; currency: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use workspace currency or default to EUR
  const baseCurrency = currentWorkspace?.currency || 'EUR';

  // Fetch portfolio summary (normalized to workspace currency) with auto-refresh
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary, isFetching: isFetchingSummary } = useQuery({
    queryKey: ['portfolio', 'summary', currentWorkspace?.id, baseCurrency],
    queryFn: async () => {
      // Refresh prices from providers first
      await api.post(`/workspaces/${currentWorkspace?.id}/portfolio/refresh-prices`, {});
      const response = await api.get<PortfolioSummary>(
        `/workspaces/${currentWorkspace?.id}/portfolio/summary?currency=${baseCurrency}`
      );
      return response;
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
  });

  // Fetch allocation data
  const { data: allocation } = useQuery({
    queryKey: ['portfolio', 'allocation', currentWorkspace?.id],
    queryFn: async () => {
      const response = await api.get<AllocationData>(
        `/workspaces/${currentWorkspace?.id}/portfolio/allocation`
      );
      return response;
    },
    enabled: !!currentWorkspace?.id,
  });

  // Fetch performance history
  const { data: performance, isLoading: performanceLoading, error: performanceError } = useQuery({
    queryKey: ['portfolio', 'performance', currentWorkspace?.id],
    queryFn: async () => {
      const response = await api.get<PerformanceData>(
        `/workspaces/${currentWorkspace?.id}/portfolio/performance`
      );
      return response;
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: REFRESH_INTERVAL * 2, // Refresh every minute (less frequent than summary)
    retry: 2,
  });

  // Refresh prices
  const handleRefreshPrices = async () => {
    setIsRefreshing(true);
    try {
      await api.post(`/workspaces/${currentWorkspace?.id}/portfolio/refresh-prices`, {});
      await refetchSummary();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePositionClick = (position: { id: string; asset?: { symbol: string; currency: string } }) => {
    setSelectedPositionId(position.id);
    if (position.asset) {
      setSelectedPositionAsset({ symbol: position.asset.symbol, currency: position.asset.currency });
    }
    setViewMode('detail');
  };

  const handleAddTransaction = (positionId: string, asset: { symbol: string; currency: string }) => {
    setSelectedPositionId(positionId);
    setSelectedPositionAsset(asset);
    setShowAddTransaction(true);
  };

  const handleBackToList = () => {
    setSelectedPositionId(null);
    setViewMode('list');
  };

  const getPnLColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  const getPnLBgColor = (value: number) => {
    if (value > 0) return 'bg-green-50 dark:bg-green-900/30';
    if (value < 0) return 'bg-red-50 dark:bg-red-900/30';
    return 'bg-gray-50 dark:bg-gray-700';
  };

  // Detail view
  if (viewMode === 'detail' && selectedPositionId) {
    return (
      <div className="p-6">
        <PositionDetail
          positionId={selectedPositionId}
          onBack={handleBackToList}
          onAddTransaction={() => {
            if (selectedPositionAsset) {
              handleAddTransaction(selectedPositionId, selectedPositionAsset);
            }
          }}
        />
        {/* Add position transaction modal */}
        {selectedPositionAsset && (
          <AddPositionTransaction
            isOpen={showAddTransaction}
            positionId={selectedPositionId}
            assetSymbol={selectedPositionAsset.symbol}
            assetCurrency={selectedPositionAsset.currency}
            onClose={() => setShowAddTransaction(false)}
            onSuccess={() => refetchSummary()}
          />
        )}
      </div>
    );
  }

  // Main dashboard view
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Portefeuille</h1>
          <p className="text-gray-500 dark:text-gray-400">Suivi de vos investissements</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshPrices}
            disabled={isRefreshing || isFetchingSummary}
            className="px-3 py-2 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', (isRefreshing || isFetchingSummary) && 'animate-spin')} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
          <button
            onClick={() => setShowAddPosition(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nouvelle position
          </button>
        </div>
      </div>

      {summaryLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : summary ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total value */}
            <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                <Wallet className="h-4 w-4" />
                <span className="text-sm">Valeur totale</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(summary.totalValue, baseCurrency)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {summary.positionCount} position{summary.positionCount > 1 ? 's' : ''}
              </p>
            </div>

            {/* Total cost */}
            <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">Montant investi</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(summary.totalCost, baseCurrency)}
              </p>
            </div>

            {/* Unrealized P&L */}
            <div className={cn('border rounded-lg p-4', getPnLBgColor(summary.totalUnrealizedGain))}>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                {summary.totalUnrealizedGain >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">P&L latent</span>
              </div>
              <p className={cn('text-2xl font-semibold', getPnLColor(summary.totalUnrealizedGain))}>
                {summary.totalUnrealizedGain >= 0 ? '+' : ''}
                {formatCurrency(summary.totalUnrealizedGain, baseCurrency)}
              </p>
              <p className={cn('text-xs mt-1', getPnLColor(summary.totalReturnPercent))}>
                {summary.totalReturnPercent >= 0 ? '+' : ''}
                {formatPercent(summary.totalReturnPercent)}
              </p>
            </div>

            {/* Realized P&L */}
            <div className={cn('border rounded-lg p-4', getPnLBgColor(summary.totalRealizedGain))}>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                <LineChartIcon className="h-4 w-4" />
                <span className="text-sm">P&L réalisé</span>
              </div>
              <p className={cn('text-2xl font-semibold', getPnLColor(summary.totalRealizedGain))}>
                {summary.totalRealizedGain >= 0 ? '+' : ''}
                {formatCurrency(summary.totalRealizedGain, baseCurrency)}
              </p>
            </div>
          </div>

          {/* Charts and positions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Allocation chart */}
            <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <PieChartIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Répartition par type</h2>
              </div>
              {allocation && allocation.byType.length > 0 ? (
                <>
                  <AllocationChart
                    data={allocation.byType.map((item) => ({
                      name: item.type === 'stock' ? 'Actions' :
                            item.type === 'etf' ? 'ETF' :
                            item.type === 'crypto' ? 'Crypto' :
                            item.type === 'bond' ? 'Obligations' : item.type,
                      value: item.value,
                      percent: item.percent,
                    }))}
                    showLegend={false}
                  />
                  <AllocationLegend
                    data={allocation.byType.map((item) => ({
                      name: item.type === 'stock' ? 'Actions' :
                            item.type === 'etf' ? 'ETF' :
                            item.type === 'crypto' ? 'Crypto' :
                            item.type === 'bond' ? 'Obligations' : item.type,
                      value: item.value,
                      percent: item.percent,
                    }))}
                    className="mt-4"
                  />
                </>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400 text-sm">
                  Aucune donnée
                </div>
              )}
            </div>

            {/* Position list */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Positions</h2>
                </div>
                <span className="text-xs text-gray-400">
                  {summary.positionCount} position{summary.positionCount > 1 ? 's' : ''}
                </span>
              </div>
              <PositionList
                onPositionClick={handlePositionClick}
                onAddTransaction={(position) => handleAddTransaction(position.id, {
                  symbol: position.asset.symbol,
                  currency: position.asset.currency,
                })}
              />
            </div>
          </div>

          {/* Currency allocation */}
          {allocation && allocation.byCurrency.length > 1 && (
            <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <PieChartIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Répartition par devise</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {allocation.byCurrency.map((item) => (
                  <div key={item.currency} className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{item.currency}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{formatCurrency(item.value, baseCurrency)}</p>
                    <p className="text-xs text-gray-400">{formatPercent(item.percent)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance chart */}
          <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <LineChartIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Performance</h2>
            </div>
            {performanceLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : performanceError ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                <LineChartIcon className="h-8 w-8 mb-2 text-red-300" />
                <p className="text-sm text-red-500">Erreur de chargement</p>
                <p className="text-xs text-gray-400 mt-1">
                  Impossible de charger l'historique de performance
                </p>
              </div>
            ) : performance && performance.history.length >= 2 ? (
              <PerformanceChart
                data={performance.history}
                currency={baseCurrency}
                height={250}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                <LineChartIcon className="h-8 w-8 mb-2 text-gray-300" />
                <p className="text-sm">Historique en cours de construction</p>
                <p className="text-xs text-gray-400 mt-1">
                  Les données seront disponibles après quelques jours de suivi
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border rounded-lg">
          <Wallet className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Commencez votre portefeuille</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Ajoutez votre première position pour suivre vos investissements.
          </p>
          <button
            onClick={() => setShowAddPosition(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nouvelle position
          </button>
        </div>
      )}

      {/* Add position modal */}
      <AddPosition
        isOpen={showAddPosition}
        onClose={() => setShowAddPosition(false)}
        onSuccess={() => refetchSummary()}
      />

      {/* Add position transaction modal */}
      {selectedPositionId && selectedPositionAsset && (
        <AddPositionTransaction
          isOpen={showAddTransaction}
          positionId={selectedPositionId}
          assetSymbol={selectedPositionAsset.symbol}
          assetCurrency={selectedPositionAsset.currency}
          onClose={() => setShowAddTransaction(false)}
          onSuccess={() => refetchSummary()}
        />
      )}
    </div>
  );
}

export default PortfolioPage;
