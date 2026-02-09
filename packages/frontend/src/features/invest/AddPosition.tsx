// ============================================================================
// ADD POSITION FORM - Finance Hub
// Form to add a new investment position
// ============================================================================

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { X, Loader2, TrendingUp, Bitcoin, Building2, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { AssetSearch } from './AssetSearch';
import { cn } from '@/lib/utils';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Asset {
  symbol: string;
  name: string;
  type: 'stock' | 'etf' | 'crypto' | 'bond' | 'commodity' | 'other';
  exchange?: string;
  currency: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface MarketQuote {
  price: number;
  currency: string;
  change: number;
  changePercent: number;
}

interface AssetWithPrice extends Asset {
  id: string;
  lastPrice: number | null;
  lastPriceAt: string | null;
}

interface AddPositionProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AddPosition({ isOpen, onClose, onSuccess }: AddPositionProps) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [formData, setFormData] = useState<{
    accountId: string;
    quantity: string;
    price: string;
    fees: string;
    date: string;
    notes: string;
  }>({
    accountId: '',
    quantity: '',
    price: '',
    fees: '0',
    date: new Date().toISOString().split('T')[0] ?? '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch investment accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts', currentWorkspace?.id, 'investment'],
    queryFn: async () => {
      const response = await api.get<Account[]>(
        `/workspaces/${currentWorkspace?.id}/accounts?type=investment`
      );
      return response;
    },
    enabled: !!currentWorkspace?.id,
  });

  // Fetch current quote for selected asset with auto-refresh
  const { data: quoteData, isLoading: isLoadingQuote, refetch: refetchQuote } = useQuery({
    queryKey: ['asset-quote', selectedAsset?.symbol],
    queryFn: async () => {
      const response = await api.get<{ asset: AssetWithPrice | null; quote: MarketQuote | null }>(
        `/assets/${selectedAsset?.symbol}/quote`
      );
      return response;
    },
    enabled: !!selectedAsset?.symbol,
    staleTime: 10000, // Cache for 10 seconds
    refetchInterval: 15000, // Refresh every 15 seconds for real-time price
    refetchOnWindowFocus: true,
  });

  // Get the current price from quote or asset's lastPrice
  const currentPrice = quoteData?.quote?.price ?? quoteData?.asset?.lastPrice ?? null;

  // Auto-fill price when quote is loaded
  useEffect(() => {
    if (currentPrice && !formData.price) {
      setFormData((prev) => ({
        ...prev,
        price: currentPrice.toString(),
      }));
    }
  }, [currentPrice]);

  // Create position mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      assetSymbol: string;
      assetType: string;
      accountId: string;
      quantity: number;
      price: number;
      fees: number;
      date: string;
      notes?: string;
    }) => {
      return api.post(`/workspaces/${currentWorkspace?.id}/positions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      resetForm();
      onSuccess?.();
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || "Erreur lors de l'ajout de la position");
    },
  });

  const resetForm = () => {
    setSelectedAsset(null);
    setFormData({
      accountId: '',
      quantity: '',
      price: '',
      fees: '0',
      date: new Date().toISOString().split('T')[0] ?? '',
      notes: '',
    });
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedAsset) {
      setError('Veuillez sélectionner un actif');
      return;
    }

    if (!formData.accountId) {
      setError('Veuillez sélectionner un compte');
      return;
    }

    const quantity = parseFloat(formData.quantity);
    const price = parseFloat(formData.price);
    const fees = parseFloat(formData.fees) || 0;

    if (isNaN(quantity) || quantity <= 0) {
      setError('La quantité doit être un nombre positif');
      return;
    }

    if (isNaN(price) || price <= 0) {
      setError('Le prix doit être un nombre positif');
      return;
    }

    const baseData = {
      assetSymbol: selectedAsset.symbol,
      assetType: selectedAsset.type,
      accountId: formData.accountId,
      quantity,
      price,
      fees,
      date: formData.date,
    };
    if (formData.notes) {
      createMutation.mutate({ ...baseData, notes: formData.notes });
    } else {
      createMutation.mutate(baseData);
    }
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'crypto':
        return <Bitcoin className="h-5 w-5 text-orange-500" />;
      case 'etf':
        return <Building2 className="h-5 w-5 text-purple-500" />;
      default:
        return <TrendingUp className="h-5 w-5 text-blue-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'stock':
        return 'Action';
      case 'etf':
        return 'ETF';
      case 'crypto':
        return 'Crypto';
      case 'bond':
        return 'Obligation';
      case 'commodity':
        return 'Matière première';
      default:
        return 'Autre';
    }
  };

  // Calculate totals
  const quantity = parseFloat(formData.quantity) || 0;
  const price = parseFloat(formData.price) || 0;
  const fees = parseFloat(formData.fees) || 0;
  const totalCost = quantity * price + fees;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Ajouter une position</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Asset search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Actif <span className="text-red-500">*</span>
            </label>
            {selectedAsset ? (
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  {getAssetIcon(selectedAsset.type)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">{selectedAsset.symbol}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                        {getTypeLabel(selectedAsset.type)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedAsset.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAsset(null)}
                  className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Changer
                </button>
              </div>
            ) : (
              <AssetSearch onSelect={(asset) => setSelectedAsset(asset as Asset)} />
            )}
          </div>

          {/* Account selection */}
          <div>
            <label htmlFor="accountId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Compte <span className="text-red-500">*</span>
            </label>
            <select
              id="accountId"
              value={formData.accountId}
              onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
            >
              <option value="">Sélectionner un compte...</option>
              {accounts?.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            {accounts?.length === 0 && (
              <p className="mt-1 text-sm text-amber-600">
                Aucun compte d'investissement. Créez-en un d'abord.
              </p>
            )}
          </div>

          {/* Quantity and Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Quantité <span className="text-red-500">*</span>
              </label>
              <input
                id="quantity"
                type="number"
                step="any"
                min="0"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="10"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Prix unitaire <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="price"
                  type="number"
                  step="any"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="150.00"
                  className="w-full px-3 py-2 pr-20 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {selectedAsset && (
                    <button
                      type="button"
                      onClick={() => {
                        if (currentPrice) {
                          setFormData({ ...formData, price: currentPrice.toString() });
                        } else {
                          refetchQuote();
                        }
                      }}
                      disabled={isLoadingQuote}
                      className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                      title="Récupérer le prix actuel"
                    >
                      <RefreshCw className={cn('h-4 w-4', isLoadingQuote && 'animate-spin')} />
                    </button>
                  )}
                  <span className="text-gray-400 dark:text-gray-500 text-sm">
                    {selectedAsset?.currency || '€'}
                  </span>
                </div>
              </div>
              {currentPrice !== null && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Prix actuel : {currentPrice.toFixed(2)} {quoteData?.asset?.currency || selectedAsset?.currency || 'USD'}
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
          </div>

          {/* Date and Fees */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date d'achat <span className="text-red-500">*</span>
              </label>
              <input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="fees" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Frais
              </label>
              <div className="relative">
                <input
                  id="fees"
                  type="number"
                  step="any"
                  min="0"
                  value={formData.fees}
                  onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 pr-8 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm">
                  €
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notes optionnelles..."
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
            />
          </div>

          {/* Total summary */}
          {quantity > 0 && price > 0 && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>
                  {quantity} × {price.toFixed(2)} {selectedAsset?.currency || '€'}
                </span>
                <span>{(quantity * price).toFixed(2)} €</span>
              </div>
              {fees > 0 && (
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <span>Frais</span>
                  <span>{fees.toFixed(2)} €</span>
                </div>
              )}
              <div className="flex justify-between font-medium text-gray-900 dark:text-white mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                <span>Coût total</span>
                <span>{totalCost.toFixed(2)} €</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !selectedAsset}
              className={cn(
                'px-4 py-2 text-white rounded-lg flex items-center gap-2',
                'bg-blue-600 hover:bg-blue-700',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Ajouter la position
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddPosition;
