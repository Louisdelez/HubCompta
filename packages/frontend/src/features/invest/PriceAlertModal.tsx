// ============================================================================
// PRICE ALERT MODAL - Finance Hub
// Create/edit price alerts for assets
// Uses Catppuccin colors that adapt to the current theme
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
      <div className="relative bg-ctp-base rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ctp-surface1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-ctp-blue/10 rounded-lg">
              <Bell className="h-5 w-5 text-ctp-blue" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ctp-text">Alerte de prix</h2>
              <p className="text-sm text-ctp-subtext0">{asset.symbol} - {asset.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-ctp-overlay1 hover:text-ctp-subtext0 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Price */}
        {asset.lastPrice && (
          <div className="px-4 py-3 bg-ctp-surface0 border-b border-ctp-surface1">
            <p className="text-sm text-ctp-subtext0">Prix actuel</p>
            <p className="text-xl font-bold text-ctp-text">{formatCurrency(asset.lastPrice, asset.currency)}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Direction */}
          <div>
            <label className="block text-sm font-medium text-ctp-subtext1 mb-2">
              M'alerter quand le prix passe
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection('above')}
                className={cn(
                  'flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors',
                  direction === 'above'
                    ? 'border-ctp-green bg-ctp-green/10 text-ctp-green'
                    : 'border-ctp-surface1 hover:border-ctp-surface2 text-ctp-subtext0'
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
                    ? 'border-ctp-red bg-ctp-red/10 text-ctp-red'
                    : 'border-ctp-surface1 hover:border-ctp-surface2 text-ctp-subtext0'
                )}
              >
                <TrendingDown className="h-5 w-5" />
                <span className="font-medium">En-dessous</span>
              </button>
            </div>
          </div>

          {/* Target Price */}
          <div>
            <label className="block text-sm font-medium text-ctp-subtext1 mb-1">
              Prix cible ({asset.currency})
            </label>
            <input
              type="number"
              step="any"
              min="0.0001"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-ctp-surface1 rounded-lg focus:outline-none focus:ring-2 focus:ring-ctp-blue bg-ctp-mantle text-ctp-text"
              required
            />
            {targetPrice && asset.lastPrice && (
              <p className={cn(
                'text-xs mt-1',
                percentChange >= 0 ? 'text-ctp-green' : 'text-ctp-red'
              )}>
                {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}% par rapport au prix actuel
              </p>
            )}
          </div>

          {/* Info */}
          <div className="bg-ctp-blue/10 border border-ctp-blue/20 rounded-lg p-3 text-sm text-ctp-blue">
            <p>
              Vous recevrez une notification lorsque le prix de {asset.symbol}{' '}
              {direction === 'above' ? 'depassera' : 'passera en-dessous de'}{' '}
              {targetPrice ? formatCurrency(parseFloat(targetPrice), asset.currency) : '...'}.
            </p>
          </div>

          {/* Error */}
          {createAlertMutation.isError && (
            <div className="p-3 bg-ctp-red/10 border border-ctp-red/20 rounded-lg">
              <p className="text-sm text-ctp-red">
                Erreur lors de la creation de l'alerte
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-ctp-subtext1 bg-ctp-surface0 rounded-lg hover:bg-ctp-surface1 font-medium">
              Annuler
            </button>
            <button
              type="submit"
              disabled={createAlertMutation.isPending || !targetPrice || parseFloat(targetPrice) <= 0}
              className="flex-1 px-4 py-2 bg-ctp-blue text-ctp-base rounded-lg hover:bg-ctp-blue/90 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
