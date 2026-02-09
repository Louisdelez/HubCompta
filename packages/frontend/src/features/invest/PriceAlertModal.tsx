// ============================================================================
// PRICE ALERT MODAL - Finance Hub
// Create/edit price alerts for assets
// ============================================================================

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, TrendingUp, TrendingDown, Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { cn, formatCurrency } from '@/lib/utils';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface PriceAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: {
    id: string;
    symbol: string;
    name: string;
    lastPrice?: number;
    currency: string;
  };
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function PriceAlertModal({ isOpen, onClose, asset }: PriceAlertModalProps) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [targetPrice, setTargetPrice] = useState(
    asset.lastPrice ? asset.lastPrice.toString() : ''
  );

  const createAlertMutation = useMutation({
    mutationFn: (data: { assetId: string; targetPrice: number; direction: 'above' | 'below' }) =>
      api.post(`/workspaces/${currentWorkspace?.id}/alerts/price`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-alerts'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) return;

    createAlertMutation.mutate({
      assetId: asset.id,
      targetPrice: price,
      direction,
    });
  };

  if (!isOpen) return null;

  const percentChange = asset.lastPrice && targetPrice
    ? ((parseFloat(targetPrice) - asset.lastPrice) / asset.lastPrice) * 100
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/50 rounded-lg">
              <Bell className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Alerte de prix</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{asset.symbol} - {asset.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Price */}
        {asset.lastPrice && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Prix actuel</p>
            <p className="text-xl font-bold">{formatCurrency(asset.lastPrice, asset.currency)}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Direction */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              M'alerter quand le prix passe
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection('above')}
                className={cn(
                  'flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors',
                  direction === 'above'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                )}
              >
                <TrendingUp className="h-5 w-5" />
                <span className="font-medium">Au-dessus</span>
              </button>
              <button
                type="button"
                onClick={() => setDirection('below')}
                className={cn(
                  'flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors',
                  direction === 'below'
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                )}
              >
                <TrendingDown className="h-5 w-5" />
                <span className="font-medium">En-dessous</span>
              </button>
            </div>
          </div>

          {/* Target Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Prix cible ({asset.currency})
            </label>
            <input
              type="number"
              step="any"
              min="0.0001"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
            />
            {targetPrice && asset.lastPrice && (
              <p className={cn(
                'text-xs mt-1',
                percentChange >= 0 ? 'text-green-600' : 'text-red-600'
              )}>
                {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}% par rapport au prix actuel
              </p>
            )}
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
            <p>
              Vous recevrez une notification lorsque le prix de {asset.symbol}{' '}
              {direction === 'above' ? 'depassera' : 'passera en-dessous de'}{' '}
              {targetPrice ? formatCurrency(parseFloat(targetPrice), asset.currency) : '...'}.
            </p>
          </div>

          {/* Error */}
          {createAlertMutation.isError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                Erreur lors de la creation de l'alerte
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Annuler
            </button>
            <button
              type="submit"
              disabled={createAlertMutation.isPending || !targetPrice || parseFloat(targetPrice) <= 0}
              className="btn-primary flex-1"
            >
              {createAlertMutation.isPending ? 'Creation...' : 'Creer l\'alerte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PriceAlertModal;
