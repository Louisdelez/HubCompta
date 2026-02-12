// ============================================================================
// PORTFOLIO PAGE - Finance Hub
// Main investment portfolio dashboard
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
    if (value > 0) return 'text-ctp-green';
    if (value < 0) return 'text-ctp-red';
    return 'text-ctp-subtext0';
  };

  const getPnLBgColor = (value: number) => {
    if (value > 0) return 'bg-ctp-green/10';
    if (value < 0) return 'bg-ctp-red/10';
    return 'bg-ctp-surface0';
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
          <h1 className="text-2xl font-semibold text-ctp-text">{t('invest.portfolio.title')}</h1>
          <p className="text-ctp-subtext0">{t('invest.portfolio.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshPrices}
            disabled={isRefreshing || isFetchingSummary}
            className="px-3 py-2 text-ctp-subtext0 bg-ctp-surface0 rounded-lg hover:bg-ctp-surface1 flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', (isRefreshing || isFetchingSummary) && 'animate-spin')} />
            <span className="hidden sm:inline">{t('invest.portfolio.refresh')}</span>
          </button>
          <button
            onClick={() => setShowAddPosition(true)}
            className="px-4 py-2 bg-ctp-blue text-ctp-base rounded-lg hover:bg-ctp-blue/90 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('invest.portfolio.newPosition')}
          </button>
        </div>
      </div>

      {summaryLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-ctp-blue" />
        </div>
      ) : summary ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total value */}
            <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-4">
              <div className="flex items-center gap-2 text-ctp-subtext0 mb-2">
                <Wallet className="h-4 w-4" />
                <span className="text-sm">{t('invest.portfolio.totalValue')}</span>
              </div>
              <p className="text-2xl font-semibold text-ctp-text">
                {formatCurrency(summary.totalValue, baseCurrency)}
              </p>
              <p className="text-xs text-ctp-overlay1 mt-1">
                {summary.positionCount} position{summary.positionCount > 1 ? 's' : ''}
              </p>
            </div>

            {/* Total cost */}
            <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-4">
              <div className="flex items-center gap-2 text-ctp-subtext0 mb-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">{t('invest.portfolio.investedAmount')}</span>
              </div>
              <p className="text-2xl font-semibold text-ctp-text">
                {formatCurrency(summary.totalCost, baseCurrency)}
              </p>
            </div>

            {/* Unrealized P&L */}
            <div className={cn('border border-ctp-surface1 rounded-lg p-4', getPnLBgColor(summary.totalUnrealizedGain))}>
              <div className="flex items-center gap-2 text-ctp-subtext0 mb-2">
                {summary.totalUnrealizedGain >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-ctp-green" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-ctp-red" />
                )}
                <span className="text-sm">{t('invest.portfolio.unrealizedPL')}</span>
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
            <div className={cn('border border-ctp-surface1 rounded-lg p-4', getPnLBgColor(summary.totalRealizedGain))}>
              <div className="flex items-center gap-2 text-ctp-subtext0 mb-2">
                <LineChartIcon className="h-4 w-4" />
                <span className="text-sm">{t('invest.portfolio.realizedPL')}</span>
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
            <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <PieChartIcon className="h-4 w-4 text-ctp-subtext0" />
                <h2 className="text-sm font-medium text-ctp-subtext1">{t('invest.portfolio.allocationByType')}</h2>
              </div>
              {allocation && allocation.byType.length > 0 ? (
                <>
                  <AllocationChart
                    data={allocation.byType.map((item) => ({
                      name: item.type === 'stock' ? t('invest.assetTypes.stock') :
                            item.type === 'etf' ? t('invest.assetTypes.etf') :
                            item.type === 'crypto' ? t('invest.assetTypes.crypto') :
                            item.type === 'bond' ? t('invest.assetTypes.bond') : item.type,
                      value: item.value,
                      percent: item.percent,
                    }))}
                    showLegend={false}
                  />
                  <AllocationLegend
                    data={allocation.byType.map((item) => ({
                      name: item.type === 'stock' ? t('invest.assetTypes.stock') :
                            item.type === 'etf' ? t('invest.assetTypes.etf') :
                            item.type === 'crypto' ? t('invest.assetTypes.crypto') :
                            item.type === 'bond' ? t('invest.assetTypes.bond') : item.type,
                      value: item.value,
                      percent: item.percent,
                    }))}
                    className="mt-4"
                  />
                </>
              ) : (
                <div className="flex items-center justify-center h-48 text-ctp-subtext0 text-sm">
                  {t('invest.portfolio.noData')}
                </div>
              )}
            </div>

            {/* Position list */}
            <div className="lg:col-span-2 bg-ctp-mantle border border-ctp-surface1 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-ctp-subtext0" />
                  <h2 className="text-sm font-medium text-ctp-subtext1">{t('invest.portfolio.positions')}</h2>
                </div>
                <span className="text-xs text-ctp-overlay1">
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
            <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <PieChartIcon className="h-4 w-4 text-ctp-subtext0" />
                <h2 className="text-sm font-medium text-ctp-subtext1">{t('invest.portfolio.allocationByCurrency')}</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {allocation.byCurrency.map((item) => (
                  <div key={item.currency} className="text-center p-4 bg-ctp-surface0 rounded-lg">
                    <p className="text-lg font-semibold text-ctp-text">{item.currency}</p>
                    <p className="text-sm text-ctp-subtext0">{formatCurrency(item.value, baseCurrency)}</p>
                    <p className="text-xs text-ctp-overlay1">{formatPercent(item.percent)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance chart */}
          <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <LineChartIcon className="h-4 w-4 text-ctp-subtext0" />
              <h2 className="text-sm font-medium text-ctp-subtext1">{t('invest.portfolio.performance')}</h2>
            </div>
            {performanceLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-ctp-blue" />
              </div>
            ) : performanceError ? (
              <div className="flex flex-col items-center justify-center h-64 text-ctp-subtext0">
                <LineChartIcon className="h-8 w-8 mb-2 text-ctp-red/50" />
                <p className="text-sm text-ctp-red">{t('invest.portfolio.loadingError')}</p>
                <p className="text-xs text-ctp-overlay1 mt-1">
                  {t('invest.portfolio.cannotLoadHistory')}
                </p>
              </div>
            ) : performance && performance.history.length >= 2 ? (
              <PerformanceChart
                data={performance.history}
                currency={baseCurrency}
                height={250}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-ctp-subtext0">
                <LineChartIcon className="h-8 w-8 mb-2 text-ctp-overlay1" />
                <p className="text-sm">{t('invest.portfolio.historyBuilding')}</p>
                <p className="text-xs text-ctp-overlay1 mt-1">
                  {t('invest.portfolio.dataAvailableSoon')}
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-12 bg-ctp-mantle border border-ctp-surface1 rounded-lg">
          <Wallet className="h-12 w-12 mx-auto text-ctp-overlay1 mb-4" />
          <h3 className="text-lg font-medium text-ctp-text mb-2">{t('invest.portfolio.startPortfolio')}</h3>
          <p className="text-ctp-subtext0 mb-4">
            {t('invest.portfolio.addFirstPosition')}
          </p>
          <button
            onClick={() => setShowAddPosition(true)}
            className="px-4 py-2 bg-ctp-blue text-ctp-base rounded-lg hover:bg-ctp-blue/90 inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('invest.portfolio.newPosition')}
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
