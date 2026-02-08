// ============================================================================
// CURRENCY CONVERTER - Finance Hub
// Quick currency conversion tool
// ============================================================================

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { CurrencySelector } from './CurrencySelector';
import { formatCurrency } from './CurrencyDisplay';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  rate: number;
  date: string;
  source: string;
}

interface CurrencyConverterProps {
  defaultFrom?: string;
  defaultTo?: string;
  defaultAmount?: number;
  compact?: boolean;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function CurrencyConverter({
  defaultFrom = 'EUR',
  defaultTo = 'USD',
  defaultAmount = 100,
  compact = false,
}: CurrencyConverterProps) {
  const [fromCurrency, setFromCurrency] = useState(defaultFrom);
  const [toCurrency, setToCurrency] = useState(defaultTo);
  const [amount, setAmount] = useState(defaultAmount.toString());

  // Debounce the amount
  const [debouncedAmount, setDebouncedAmount] = useState(defaultAmount);

  useEffect(() => {
    const timer = setTimeout(() => {
      const parsed = parseFloat(amount);
      if (!isNaN(parsed) && parsed > 0) {
        setDebouncedAmount(parsed);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [amount]);

  // Fetch conversion
  const {
    data: conversion,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['currency-convert', fromCurrency, toCurrency, debouncedAmount],
    queryFn: () =>
      api.get<ConversionResult>(
        `/currencies/convert?from=${fromCurrency}&to=${toCurrency}&amount=${debouncedAmount}`
      ),
    enabled: !!fromCurrency && !!toCurrency && debouncedAmount > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input w-24"
          min="0"
          step="0.01"
        />
        <CurrencySelector
          value={fromCurrency}
          onChange={setFromCurrency}
          className="w-28"
          showSymbol={false}
        />
        <button
          onClick={handleSwap}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          title="Inverser"
        >
          ⇄
        </button>
        <CurrencySelector
          value={toCurrency}
          onChange={setToCurrency}
          className="w-28"
          showSymbol={false}
        />
        <div className="font-medium min-w-[100px] text-right">
          {isLoading ? (
            <span className="text-gray-400">...</span>
          ) : conversion ? (
            formatCurrency(conversion.convertedAmount, toCurrency)
          ) : error ? (
            <span className="text-danger-500 text-sm">Erreur</span>
          ) : (
            '-'
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="font-semibold mb-4">Convertisseur de devises</h3>

      <div className="space-y-4">
        {/* From */}
        <div>
          <label className="label">Montant</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input flex-1"
              min="0"
              step="0.01"
              placeholder="100.00"
            />
            <CurrencySelector
              value={fromCurrency}
              onChange={setFromCurrency}
              className="w-40"
            />
          </div>
        </div>

        {/* Swap button */}
        <div className="flex justify-center">
          <button
            onClick={handleSwap}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            title="Inverser les devises"
          >
            <svg
              className="w-6 h-6 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          </button>
        </div>

        {/* To */}
        <div>
          <label className="label">Devise cible</label>
          <CurrencySelector value={toCurrency} onChange={setToCurrency} />
        </div>

        {/* Result */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          {isLoading ? (
            <div className="text-center text-gray-500">Calcul en cours...</div>
          ) : error ? (
            <div className="text-center text-danger-500">
              Taux de change non disponible
            </div>
          ) : conversion ? (
            <div className="text-center">
              <p className="text-3xl font-bold text-primary-600">
                {formatCurrency(conversion.convertedAmount, toCurrency)}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                1 {fromCurrency} = {conversion.rate.toFixed(4)} {toCurrency}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Source: {conversion.source} - {new Date(conversion.date).toLocaleDateString('fr-FR')}
              </p>
            </div>
          ) : (
            <div className="text-center text-gray-500">
              Entrez un montant pour convertir
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CurrencyConverter;
