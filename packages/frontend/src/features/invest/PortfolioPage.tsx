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
  totalUnrealizedPnL: number;
  totalUnrealizedPnLPercent: number;
  totalRealizedPnL: number;
  positionCount: number;
  allocation: {
    name: string;
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
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
  }[];
}

interface AllocationData {
  totalValue: number;
  byType: {
    name: string;
    value: number;
    percent: number;
  }[];
  byCurrency: {
    currency: string;
    value: number;
    percent: number;
  }[];
}

type ViewMode = 'list' | 'detail';

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function PortfolioPage() {
  const { currentWorkspace } = useWorkspace();
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [selectedPositionAsset, setSelectedPositionAsset] = useState<{ symbol: string; currency: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch portfolio summary
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['portfolio', 'summary', currentWorkspace?.id],
    queryFn: async () => {
      const response = await api.get<{ data: PortfolioSummary }>(
        `/workspaces/${currentWorkspace?.id}/portfolio/summary`
      );
      return response.data;
    },
    enabled: !!currentWorkspace?.id,
  });

  // Fetch allocation data
  const { data: allocation } = useQuery({
    queryKey: ['portfolio', 'allocation', currentWorkspace?.id],
    queryFn: async () => {
      const response = await api.get<{ data: AllocationData }>(
        `/workspaces/${currentWorkspace?.id}/portfolio/allocation`
      );
      return response.data;
    },
    enabled: !!currentWorkspace?.id,
  });

  // Refresh prices
  const handleRefreshPrices = async () => {
    setIsRefreshing(true);
    try {
      await api.post(`/workspaces/${currentWorkspace?.id}/portfolio/refresh-prices`);
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
    if (value > 0) return 'bg-green-50';
    if (value < 0) return 'bg-red-50';
    return 'bg-gray-50';
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
          <h1 className="text-2xl font-semibold text-gray-900">Portefeuille</h1>
          <p className="text-gray-500">Suivi de vos investissements</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshPrices}
            disabled={isRefreshing}
            className="px-3 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            Actualiser les prix
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
            <div className="bg-white border rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <Wallet className="h-4 w-4" />
                <span className="text-sm">Valeur totale</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(summary.totalValue, 'EUR')}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {summary.positionCount} position{summary.positionCount > 1 ? 's' : ''}
              </p>
            </div>

            {/* Total cost */}
            <div className="bg-white border rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">Montant investi</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(summary.totalCost, 'EUR')}
              </p>
            </div>

            {/* Unrealized P&L */}
            <div className={cn('border rounded-lg p-4', getPnLBgColor(summary.totalUnrealizedPnL))}>
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                {summary.totalUnrealizedPnL >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">P&L latent</span>
              </div>
              <p className={cn('text-2xl font-semibold', getPnLColor(summary.totalUnrealizedPnL))}>
                {summary.totalUnrealizedPnL >= 0 ? '+' : ''}
                {formatCurrency(summary.totalUnrealizedPnL, 'EUR')}
              </p>
              <p className={cn('text-xs mt-1', getPnLColor(summary.totalUnrealizedPnLPercent))}>
                {summary.totalUnrealizedPnLPercent >= 0 ? '+' : ''}
                {formatPercent(summary.totalUnrealizedPnLPercent)}
              </p>
            </div>

            {/* Realized P&L */}
            <div className={cn('border rounded-lg p-4', getPnLBgColor(summary.totalRealizedPnL))}>
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <LineChartIcon className="h-4 w-4" />
                <span className="text-sm">P&L réalisé</span>
              </div>
              <p className={cn('text-2xl font-semibold', getPnLColor(summary.totalRealizedPnL))}>
                {summary.totalRealizedPnL >= 0 ? '+' : ''}
                {formatCurrency(summary.totalRealizedPnL, 'EUR')}
              </p>
            </div>
          </div>

          {/* Charts and positions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Allocation chart */}
            <div className="bg-white border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <PieChartIcon className="h-4 w-4 text-gray-500" />
                <h2 className="text-sm font-medium text-gray-700">Répartition par type</h2>
              </div>
              {allocation && allocation.byType.length > 0 ? (
                <>
                  <AllocationChart
                    data={allocation.byType.map((item) => ({
                      name: item.name === 'stock' ? 'Actions' :
                            item.name === 'etf' ? 'ETF' :
                            item.name === 'crypto' ? 'Crypto' :
                            item.name === 'bond' ? 'Obligations' : item.name,
                      value: item.value,
                      percent: item.percent,
                    }))}
                    showLegend={false}
                  />
                  <AllocationLegend
                    data={allocation.byType.map((item) => ({
                      name: item.name === 'stock' ? 'Actions' :
                            item.name === 'etf' ? 'ETF' :
                            item.name === 'crypto' ? 'Crypto' :
                            item.name === 'bond' ? 'Obligations' : item.name,
                      value: item.value,
                      percent: item.percent,
                    }))}
                    className="mt-4"
                  />
                </>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
                  Aucune donnée
                </div>
              )}
            </div>

            {/* Position list */}
            <div className="lg:col-span-2 bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-gray-500" />
                  <h2 className="text-sm font-medium text-gray-700">Positions</h2>
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
            <div className="bg-white border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <PieChartIcon className="h-4 w-4 text-gray-500" />
                <h2 className="text-sm font-medium text-gray-700">Répartition par devise</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {allocation.byCurrency.map((item) => (
                  <div key={item.currency} className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-lg font-semibold text-gray-900">{item.currency}</p>
                    <p className="text-sm text-gray-600">{formatCurrency(item.value, 'EUR')}</p>
                    <p className="text-xs text-gray-400">{formatPercent(item.percent)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance chart placeholder */}
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <LineChartIcon className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-medium text-gray-700">Performance</h2>
            </div>
            <PerformanceChart
              data={[
                // Placeholder data - will be replaced with real historical data
                { date: '2025-01-01', value: summary.totalCost, invested: summary.totalCost },
                { date: '2025-02-08', value: summary.totalValue, invested: summary.totalCost },
              ]}
              height={250}
            />
            <p className="text-xs text-gray-400 text-center mt-2">
              L'historique de performance sera disponible prochainement
            </p>
          </div>
        </>
      ) : (
        <div className="text-center py-12 bg-white border rounded-lg">
          <Wallet className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Commencez votre portefeuille</h3>
          <p className="text-gray-500 mb-4">
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
