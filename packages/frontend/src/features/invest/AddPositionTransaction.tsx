// ============================================================================
// ADD POSITION TRANSACTION MODAL - Finance Hub
// Modal for adding buy/sell/dividend transactions to a position
// ============================================================================

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { X, Loader2, Plus, Minus, TrendingUp, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { cn } from '@/lib/utils';

// ----------------------------------------------------------------------------
// Types for quote
// ----------------------------------------------------------------------------

interface MarketQuote {
  price: number;
  currency: string;
  change: number;
  changePercent: number;
}

interface AssetWithPrice {
  id: string;
  symbol: string;
  name: string;
  type: string;
  currency: string;
  lastPrice: number | null;
  lastPriceAt: string | null;
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface AddPositionTransactionProps {
  isOpen: boolean;
  positionId: string;
  assetSymbol: string;
  assetCurrency: string;
  onClose: () => void;
  onSuccess?: () => void;
}

type TransactionType = 'buy' | 'sell' | 'dividend';

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AddPositionTransaction({
  isOpen,
  positionId,
  assetSymbol,
  assetCurrency,
  onClose,
  onSuccess,
}: AddPositionTransactionProps) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const [type, setType] = useState<TransactionType>('buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [fees, setFees] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  // Fetch current quote for asset with auto-refresh
  const { data: quoteData, isLoading: isLoadingQuote, refetch: refetchQuote } = useQuery({
    queryKey: ['asset-quote', assetSymbol],
    queryFn: async () => {
      const response = await api.get<{ asset: AssetWithPrice | null; quote: MarketQuote | null }>(
        `/assets/${assetSymbol}/quote`
      );
      return response;
    },
    enabled: isOpen && !!assetSymbol,
    staleTime: 10000,
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Get the current price from quote
  const currentPrice = quoteData?.quote?.price ?? quoteData?.asset?.lastPrice ?? null;

  // Auto-fill price when quote is loaded and price is empty
  useEffect(() => {
    if (currentPrice && !price && isOpen) {
      setPrice(currentPrice.toString());
    }
  }, [currentPrice, isOpen]);

  const resetForm = () => {
    setType('buy');
    setQuantity('');
    setPrice('');
    setFees('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setNotes('');
  };

  const addTransactionMutation = useMutation({
    mutationFn: async () => {
      return api.post(`/workspaces/${currentWorkspace?.id}/positions/${positionId}/transactions`, {
        type,
        quantity: parseFloat(quantity),
        price: parseFloat(price),
        fees: fees ? parseFloat(fees) : 0,
        date: new Date(date).toISOString(),
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['position', currentWorkspace?.id, positionId] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      resetForm();
      onSuccess?.();
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || !price) return;
    addTransactionMutation.mutate();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getTypeIcon = (t: TransactionType) => {
    switch (t) {
      case 'buy':
        return <Plus className="h-4 w-4" />;
      case 'sell':
        return <Minus className="h-4 w-4" />;
      case 'dividend':
        return <TrendingUp className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (t: TransactionType) => {
    switch (t) {
      case 'buy':
        return 'Achat';
      case 'sell':
        return 'Vente';
      case 'dividend':
        return 'Dividende';
    }
  };

  const calculateTotal = () => {
    const q = parseFloat(quantity) || 0;
    const p = parseFloat(price) || 0;
    const f = parseFloat(fees) || 0;
    return type === 'sell' ? q * p - f : q * p + f;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nouvelle transaction</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{assetSymbol}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Transaction type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type de transaction
            </label>
            <div className="flex gap-2">
              {(['buy', 'sell', 'dividend'] as TransactionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                    type === t
                      ? t === 'buy'
                        ? 'bg-green-50 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-400'
                        : t === 'sell'
                        ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-400'
                        : 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400'
                      : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  )}
                >
                  {getTypeIcon(t)}
                  {getTypeLabel(t)}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {type === 'dividend' ? 'Montant reçu' : 'Quantité'}
            </label>
            <input
              id="quantity"
              type="number"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
              placeholder={type === 'dividend' ? 'Montant du dividende' : 'Nombre de titres'}
              required
            />
          </div>

          {/* Price */}
          {type !== 'dividend' && (
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Prix unitaire ({assetCurrency})
              </label>
              <div className="relative">
                <input
                  id="price"
                  type="number"
                  step="any"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 pr-20 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Prix par titre"
                  required
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (currentPrice) {
                        setPrice(currentPrice.toString());
                      } else {
                        refetchQuote();
                      }
                    }}
                    disabled={isLoadingQuote}
                    className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                    title="Utiliser le prix actuel"
                  >
                    <RefreshCw className={cn('h-4 w-4', isLoadingQuote && 'animate-spin')} />
                  </button>
                  <span className="text-gray-400 text-sm">{assetCurrency}</span>
                </div>
              </div>
              {currentPrice !== null && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Prix actuel : {currentPrice.toFixed(2)} {assetCurrency}
                  {quoteData?.quote && (
                    <span className={cn(
                      'ml-2',
                      quoteData.quote.changePercent >= 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {quoteData.quote.changePercent >= 0 ? '+' : ''}
                      {quoteData.quote.changePercent.toFixed(2)}%
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Fees */}
          <div>
            <label htmlFor="fees" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Frais ({assetCurrency})
            </label>
            <input
              id="fees"
              type="number"
              step="any"
              min="0"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
              placeholder="0.00"
            />
          </div>

          {/* Date */}
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes (optionnel)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
              placeholder="Notes additionnelles..."
            />
          </div>

          {/* Total */}
          {type !== 'dividend' && quantity && price && (
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Total</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {calculateTotal().toFixed(2)} {assetCurrency}
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {addTransactionMutation.isError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                Erreur lors de l'ajout de la transaction
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={addTransactionMutation.isPending || !quantity || (type !== 'dividend' && !price)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {addTransactionMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ajout...
                </>
              ) : (
                'Ajouter'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddPositionTransaction;
