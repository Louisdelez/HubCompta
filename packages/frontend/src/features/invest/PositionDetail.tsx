// ============================================================================
// POSITION DETAIL COMPONENT - Finance Hub
// Detailed view of a single investment position
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Bitcoin,
  Building2,
  Plus,
  Minus,
  RefreshCw,
  Loader2,
  Calendar,
  ExternalLink,
  Bell,
} from 'lucide-react';
import { PriceAlertModal } from './PriceAlertModal';
import { PriceAlertList } from './PriceAlertList';
import { PriceAlertBadge } from './PriceAlertBadge';
import { api } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { cn, formatCurrency, formatNumber, formatPercent } from '@/lib/utils';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: string;
  currency: string;
  exchange?: string;
  lastPrice?: number;
  lastPriceAt?: string;
}

interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'dividend';
  quantity: number;
  price: number;
  fees: number;
  date: string;
  notes?: string;
}

interface Position {
  id: string;
  asset: Asset;
  accountId: string;
  quantity: number;
  averageCost: number;
  currentValue: number;
  totalCost: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  realizedPnL: number;
  openedAt: string;
  transactions?: Transaction[];
}

// API response uses different property names
interface PositionApiResponse {
  id: string;
  asset: Asset;
  accountId: string;
  quantity: number;
  averageCost: number;
  currentValue: number;
  totalCost: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
  realizedGain: number;
  createdAt: string;
  transactions?: Transaction[];
}

interface PositionDetailProps {
  positionId: string;
  onBack: () => void;
  onAddTransaction?: () => void;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function PositionDetail({ positionId, onBack, onAddTransaction }: PositionDetailProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'fr' ? fr : enUS;
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  // Note: These state variables are prepared for future transaction modal implementation
  const [_showAddTransaction, _setShowAddTransaction] = useState(false);
  const [_transactionType, _setTransactionType] = useState<'buy' | 'sell'>('buy');
  const [showPriceAlertModal, setShowPriceAlertModal] = useState(false);

  // Fetch position details
  const { data: position, isLoading } = useQuery({
    queryKey: ['position', currentWorkspace?.id, positionId],
    queryFn: async () => {
      const apiData = await api.get<PositionApiResponse>(
        `/workspaces/${currentWorkspace?.id}/positions/${positionId}`
      );
      // Map API response to Position interface
      return {
        ...apiData,
        unrealizedPnL: apiData.unrealizedGain,
        unrealizedPnLPercent: apiData.unrealizedGainPercent,
        realizedPnL: apiData.realizedGain,
        openedAt: apiData.createdAt,
        transactions: apiData.transactions ?? [],
      } as Position;
    },
    enabled: !!currentWorkspace?.id && !!positionId,
  });

  // Refresh price mutation
  const refreshMutation = useMutation({
    mutationFn: () => {
      return api.post(`/workspaces/${currentWorkspace?.id}/portfolio/refresh-prices`, {});
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['position'] });
      void queryClient.invalidateQueries({ queryKey: ['positions'] });
      void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'crypto':
        return <Bitcoin className="h-6 w-6 text-ctp-peach" />;
      case 'etf':
        return <Building2 className="h-6 w-6 text-ctp-sapphire" />;
      default:
        return <TrendingUp className="h-6 w-6 text-ctp-blue" />;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'buy':
        return <Plus className="h-4 w-4 text-ctp-green" />;
      case 'sell':
        return <Minus className="h-4 w-4 text-ctp-red" />;
      case 'dividend':
        return <TrendingUp className="h-4 w-4 text-ctp-green" />;
      default:
        return null;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'buy':
        return t('invest.addTransaction.buy');
      case 'sell':
        return t('invest.addTransaction.sell');
      case 'dividend':
        return t('invest.addTransaction.dividend');
      default:
        return type;
    }
  };

  const getPnLColor = (value: number) => {
    if (value > 0) return 'text-ctp-green';
    if (value < 0) return 'text-ctp-red';
    return 'text-ctp-subtext0';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-ctp-blue" />
      </div>
    );
  }

  if (!position) {
    return (
      <div className="text-center py-12">
        <p className="text-ctp-subtext0">{t('invest.positionDetail.notFound')}</p>
        <button onClick={onBack} className="mt-4 text-ctp-blue hover:text-ctp-blue/80">
          {t('invest.positionDetail.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 text-ctp-overlay1 hover:text-ctp-subtext0 bg-ctp-surface0 hover:bg-ctp-surface1 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="p-3 bg-ctp-surface0 rounded-lg">{getAssetIcon(position.asset.type)}</div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-ctp-text">{position.asset.symbol}</h1>
              <PriceAlertBadge positionId={position.id} size="md" />
            </div>
            <p className="text-sm text-ctp-subtext0">{position.asset.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="px-3 py-2 text-ctp-subtext0 bg-ctp-surface0 rounded-lg hover:bg-ctp-surface1 flex items-center gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', refreshMutation.isPending && 'animate-spin')} />
            {t('invest.portfolio.refresh')}
          </button>
          <button
            onClick={() => setShowPriceAlertModal(true)}
            className="px-3 py-2 text-ctp-subtext0 bg-ctp-surface0 rounded-lg hover:bg-ctp-surface1 flex items-center gap-2"
          >
            <Bell className="h-4 w-4" />
            {t('invest.positionDetail.setAlert')}
          </button>
          <button
            onClick={onAddTransaction}
            className="px-4 py-2 bg-ctp-blue text-ctp-base rounded-lg hover:bg-ctp-blue/90 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('invest.positionDetail.transaction')}
          </button>
        </div>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Current value */}
        <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-4">
          <p className="text-sm text-ctp-subtext0">{t('invest.positionDetail.currentValue')}</p>
          <p className="text-2xl font-semibold text-ctp-text">
            {formatCurrency(position.currentValue, 'EUR')}
          </p>
          {position.asset.lastPrice && (
            <p className="text-xs text-ctp-overlay1 mt-1">
              {t('invest.positions.currentPrice')}: {formatCurrency(position.asset.lastPrice, position.asset.currency)}
              {position.asset.lastPriceAt && (
                <span className="ml-1">
                  ({format(new Date(position.asset.lastPriceAt), 'HH:mm', { locale: dateLocale })})
                </span>
              )}
            </p>
          )}
        </div>

        {/* Quantity */}
        <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-4">
          <p className="text-sm text-ctp-subtext0">{t('invest.positions.quantity')}</p>
          <p className="text-2xl font-semibold text-ctp-text">{formatNumber(position.quantity)}</p>
          <p className="text-xs text-ctp-overlay1 mt-1">
            PRU: {formatCurrency(position.averageCost, position.asset.currency)}
          </p>
        </div>

        {/* Unrealized P&L */}
        <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-4">
          <p className="text-sm text-ctp-subtext0">{t('invest.positionDetail.latentPL')}</p>
          <p className={cn('text-2xl font-semibold', getPnLColor(position.unrealizedPnL))}>
            {position.unrealizedPnL >= 0 ? '+' : ''}
            {formatCurrency(position.unrealizedPnL, 'EUR')}
          </p>
          <div className="flex items-center gap-1 mt-1">
            {position.unrealizedPnL >= 0 ? (
              <TrendingUp className="h-3 w-3 text-ctp-green" />
            ) : (
              <TrendingDown className="h-3 w-3 text-ctp-red" />
            )}
            <span className={cn('text-xs', getPnLColor(position.unrealizedPnLPercent))}>
              {position.unrealizedPnLPercent >= 0 ? '+' : ''}
              {formatPercent(position.unrealizedPnLPercent)}
            </span>
          </div>
        </div>

        {/* Realized P&L */}
        <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-4">
          <p className="text-sm text-ctp-subtext0">{t('invest.portfolio.realizedPL')}</p>
          <p className={cn('text-2xl font-semibold', getPnLColor(position.realizedPnL))}>
            {position.realizedPnL >= 0 ? '+' : ''}
            {formatCurrency(position.realizedPnL, 'EUR')}
          </p>
          <p className="text-xs text-ctp-overlay1 mt-1">
            {t('invest.positionDetail.totalCost')}: {formatCurrency(position.totalCost, 'EUR')}
          </p>
        </div>
      </div>

      {/* Additional info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Asset info */}
        <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-4">
          <h3 className="text-sm font-medium text-ctp-subtext1 mb-3">{t('invest.positionDetail.assetInfo')}</h3>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-sm text-ctp-subtext0">{t('invest.positionDetail.type')}</dt>
              <dd className="text-sm font-medium text-ctp-text">
                {position.asset.type === 'stock' && t('invest.assetSearch.types.stock')}
                {position.asset.type === 'etf' && t('invest.assetSearch.types.etf')}
                {position.asset.type === 'crypto' && t('invest.assetSearch.types.crypto')}
                {position.asset.type === 'bond' && t('invest.assetSearch.types.bond')}
              </dd>
            </div>
            {position.asset.exchange && (
              <div className="flex justify-between">
                <dt className="text-sm text-ctp-subtext0">{t('invest.positionDetail.exchange')}</dt>
                <dd className="text-sm font-medium text-ctp-text">{position.asset.exchange}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-sm text-ctp-subtext0">{t('invest.positionDetail.currency')}</dt>
              <dd className="text-sm font-medium text-ctp-text">{position.asset.currency}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-ctp-subtext0">{t('invest.positionDetail.openedOn')}</dt>
              <dd className="text-sm font-medium text-ctp-text">
                {format(new Date(position.openedAt), 'dd/MM/yyyy', { locale: dateLocale })}
              </dd>
            </div>
          </dl>

          {/* External links */}
          <div className="mt-4 pt-4 border-t border-ctp-surface1">
            <a
              href={`https://finance.yahoo.com/quote/${position.asset.symbol}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-ctp-blue hover:text-ctp-blue/80 flex items-center gap-1"
            >
              {t('invest.positionDetail.viewOnYahoo')}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Transaction history */}
        <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-ctp-subtext1">{t('invest.positionDetail.transactions')}</h3>
            <span className="text-xs text-ctp-overlay1">{position.transactions?.length || 0} {t('transactions.title').toLowerCase()}</span>
          </div>

          {position.transactions && position.transactions.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {position.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-2 bg-ctp-surface0 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-ctp-mantle rounded">{getTransactionIcon(tx.type)}</div>
                    <div>
                      <p className="text-sm font-medium text-ctp-text">
                        {getTransactionLabel(tx.type)}
                      </p>
                      <p className="text-xs text-ctp-subtext0">
                        {format(new Date(tx.date), 'dd/MM/yyyy', { locale: dateLocale })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-ctp-text">
                      {tx.quantity} × {formatCurrency(tx.price, position.asset.currency)}
                    </p>
                    <p className="text-xs text-ctp-subtext0">
                      {formatCurrency(tx.quantity * tx.price + tx.fees, 'EUR')}
                      {tx.fees > 0 && ` (${t('invest.addPosition.fees').toLowerCase()}: ${formatCurrency(tx.fees, 'EUR')})`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-ctp-subtext0">
              <Calendar className="h-8 w-8 mx-auto text-ctp-overlay1 mb-2" />
              <p className="text-sm">{t('invest.positionDetail.noTransactions')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Price Alerts Section */}
      <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-ctp-blue" />
            <h3 className="text-sm font-medium text-ctp-subtext1">{t('invest.priceAlertList.title')}</h3>
          </div>
          <button
            onClick={() => setShowPriceAlertModal(true)}
            className="text-xs text-ctp-blue hover:text-ctp-blue/80 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            {t('invest.positionDetail.addAlert')}
          </button>
        </div>
        <PriceAlertList positionId={position.id} compact />
      </div>

      {/* Price Alert Modal */}
      {position && (
        <PriceAlertModal
          isOpen={showPriceAlertModal}
          onClose={() => setShowPriceAlertModal(false)}
          asset={{
            id: position.asset.id,
            symbol: position.asset.symbol,
            name: position.asset.name,
            lastPrice: position.asset.lastPrice || undefined,
            currency: position.asset.currency,
          }}
          positionId={position.id}
        />
      )}
    </div>
  );
}

export default PositionDetail;
