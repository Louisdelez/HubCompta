// ============================================================================
// MANUAL RATE MODAL - Finance Hub
// Modal for setting manual exchange rates
// ============================================================================

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '@/lib/api/client';
import { CurrencySelector } from './CurrencySelector';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ManualRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultBaseCurrency?: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ManualRateModal({
  isOpen,
  onClose,
  defaultBaseCurrency = 'EUR',
}: ManualRateModalProps) {
  const queryClient = useQueryClient();
  const [baseCurrency, setBaseCurrency] = useState(defaultBaseCurrency);
  const [targetCurrency, setTargetCurrency] = useState('USD');
  const [rate, setRate] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0] ?? '';
  });

  const setRateMutation = useMutation({
    mutationFn: (data: {
      baseCurrency: string;
      targetCurrency: string;
      rate: number;
      date: string;
    }) => api.post('/currencies/rates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
      onClose();
      // Reset form
      setRate('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const rateValue = parseFloat(rate);
    if (isNaN(rateValue) || rateValue <= 0) {
      return;
    }

    if (baseCurrency === targetCurrency) {
      return;
    }

    setRateMutation.mutate({
      baseCurrency,
      targetCurrency,
      rate: rateValue,
      date,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">Definir un taux manuel</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Base Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Devise source
            </label>
            <CurrencySelector
              value={baseCurrency}
              onChange={(code) => code && setBaseCurrency(code)}
            />
          </div>

          {/* Target Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Devise cible
            </label>
            <CurrencySelector
              value={targetCurrency}
              onChange={(code) => code && setTargetCurrency(code)}
            />
            {baseCurrency === targetCurrency && (
              <p className="text-xs text-red-500 mt-1">
                Les devises doivent etre differentes
              </p>
            )}
          </div>

          {/* Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Taux (1 {baseCurrency} = ? {targetCurrency})
            </label>
            <input
              type="number"
              step="any"
              min="0.000001"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="1.0850"
              className="input w-full"
              required
            />
            {rate && parseFloat(rate) > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                1 {baseCurrency} = {parseFloat(rate).toFixed(4)} {targetCurrency}
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date du taux
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input w-full"
              required
            />
          </div>

          {/* Error */}
          {setRateMutation.isError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                Erreur lors de la definition du taux
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={
                setRateMutation.isPending ||
                !rate ||
                parseFloat(rate) <= 0 ||
                baseCurrency === targetCurrency
              }
              className="btn-primary flex-1"
            >
              {setRateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ManualRateModal;
