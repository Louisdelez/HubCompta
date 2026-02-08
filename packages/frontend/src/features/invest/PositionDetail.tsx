// ============================================================================
// POSITION DETAIL COMPONENT - Finance Hub
// Detailed view of a single investment position
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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
} from 'lucide-react';
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
  transactions: Transaction[];
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
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  // Note: These state variables are prepared for future transaction modal implementation
  const [_showAddTransaction, _setShowAddTransaction] = useState(false);
  const [_transactionType, _setTransactionType] = useState<'buy' | 'sell'>('buy');

  // Fetch position details
  const { data: position, isLoading } = useQuery({
    queryKey: ['position', currentWorkspace?.id, positionId],
    queryFn: async () => {
      const response = await api.get<{ data: Position }>(
        `/workspaces/${currentWorkspace?.id}/positions/${positionId}`
      );
      return response.data;
    },
    enabled: !!currentWorkspace?.id && !!positionId,
  });

  // Refresh price mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      return api.post(`/workspaces/${currentWorkspace?.id}/portfolio/refresh-prices`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['position'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'crypto':
        return <Bitcoin className="h-6 w-6 text-orange-500" />;
      case 'etf':
        return <Building2 className="h-6 w-6 text-purple-500" />;
      default:
        return <TrendingUp className="h-6 w-6 text-blue-500" />;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'buy':
        return <Plus className="h-4 w-4 text-green-500" />;
      case 'sell':
        return <Minus className="h-4 w-4 text-red-500" />;
      case 'dividend':
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'buy':
        return 'Achat';
      case 'sell':
        return 'Vente';
      case 'dividend':
        return 'Dividende';
      default:
        return type;
    }
  };

  const getPnLColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!position) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Position introuvable</p>
        <button onClick={onBack} className="mt-4 text-blue-600 hover:text-blue-800">
          Retour
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
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="p-3 bg-gray-100 rounded-lg">{getAssetIcon(position.asset.type)}</div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{position.asset.symbol}</h1>
            <p className="text-sm text-gray-500">{position.asset.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="px-3 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', refreshMutation.isPending && 'animate-spin')} />
            Actualiser
          </button>
          <button
            onClick={onAddTransaction}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Transaction
          </button>
        </div>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Current value */}
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Valeur actuelle</p>
          <p className="text-2xl font-semibold text-gray-900">
            {formatCurrency(position.currentValue, 'EUR')}
          </p>
          {position.asset.lastPrice && (
            <p className="text-xs text-gray-400 mt-1">
              Prix: {formatCurrency(position.asset.lastPrice, position.asset.currency)}
              {position.asset.lastPriceAt && (
                <span className="ml-1">
                  ({format(new Date(position.asset.lastPriceAt), 'HH:mm', { locale: fr })})
                </span>
              )}
            </p>
          )}
        </div>

        {/* Quantity */}
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Quantité</p>
          <p className="text-2xl font-semibold text-gray-900">{formatNumber(position.quantity)}</p>
          <p className="text-xs text-gray-400 mt-1">
            PRU: {formatCurrency(position.averageCost, position.asset.currency)}
          </p>
        </div>

        {/* Unrealized P&L */}
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">P&L latent</p>
          <p className={cn('text-2xl font-semibold', getPnLColor(position.unrealizedPnL))}>
            {position.unrealizedPnL >= 0 ? '+' : ''}
            {formatCurrency(position.unrealizedPnL, 'EUR')}
          </p>
          <div className="flex items-center gap-1 mt-1">
            {position.unrealizedPnL >= 0 ? (
              <TrendingUp className="h-3 w-3 text-green-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            <span className={cn('text-xs', getPnLColor(position.unrealizedPnLPercent))}>
              {position.unrealizedPnLPercent >= 0 ? '+' : ''}
              {formatPercent(position.unrealizedPnLPercent)}
            </span>
          </div>
        </div>

        {/* Realized P&L */}
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">P&L réalisé</p>
          <p className={cn('text-2xl font-semibold', getPnLColor(position.realizedPnL))}>
            {position.realizedPnL >= 0 ? '+' : ''}
            {formatCurrency(position.realizedPnL, 'EUR')}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Coût total: {formatCurrency(position.totalCost, 'EUR')}
          </p>
        </div>
      </div>

      {/* Additional info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Asset info */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Informations de l'actif</h3>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Type</dt>
              <dd className="text-sm font-medium text-gray-900">
                {position.asset.type === 'stock' && 'Action'}
                {position.asset.type === 'etf' && 'ETF'}
                {position.asset.type === 'crypto' && 'Crypto-monnaie'}
                {position.asset.type === 'bond' && 'Obligation'}
              </dd>
            </div>
            {position.asset.exchange && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Bourse</dt>
                <dd className="text-sm font-medium text-gray-900">{position.asset.exchange}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Devise</dt>
              <dd className="text-sm font-medium text-gray-900">{position.asset.currency}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Position ouverte le</dt>
              <dd className="text-sm font-medium text-gray-900">
                {format(new Date(position.openedAt), 'dd/MM/yyyy', { locale: fr })}
              </dd>
            </div>
          </dl>

          {/* External links */}
          <div className="mt-4 pt-4 border-t">
            <a
              href={`https://finance.yahoo.com/quote/${position.asset.symbol}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              Voir sur Yahoo Finance
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Transaction history */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Historique des transactions</h3>
            <span className="text-xs text-gray-400">{position.transactions?.length || 0} transactions</span>
          </div>

          {position.transactions && position.transactions.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {position.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-white rounded">{getTransactionIcon(tx.type)}</div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {getTransactionLabel(tx.type)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(tx.date), 'dd/MM/yyyy', { locale: fr })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {tx.quantity} × {formatCurrency(tx.price, position.asset.currency)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatCurrency(tx.quantity * tx.price + tx.fees, 'EUR')}
                      {tx.fees > 0 && ` (frais: ${formatCurrency(tx.fees, 'EUR')})`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-8 w-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm">Aucune transaction</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PositionDetail;
