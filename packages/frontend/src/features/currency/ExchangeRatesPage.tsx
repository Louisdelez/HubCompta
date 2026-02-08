// ============================================================================
// EXCHANGE RATES PAGE - Finance Hub
// View and manage exchange rates
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { CurrencySelector } from './CurrencySelector';
import { CurrencyConverter } from './CurrencyConverter';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ExchangeRate {
  targetCurrency: string;
  rate: number;
  date: string;
  source: string;
}

interface HistoricalRate {
  date: string;
  rate: number;
  source: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ExchangeRatesPage() {
  const queryClient = useQueryClient();
  const [baseCurrency, setBaseCurrency] = useState('EUR');
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch latest rates
  const { data: ratesData, isLoading: loadingRates } = useQuery({
    queryKey: ['exchange-rates', baseCurrency],
    queryFn: () =>
      api.get<{ baseCurrency: string; rates: ExchangeRate[] }>(
        `/currencies/rates/${baseCurrency}`
      ),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch historical rates when a target is selected
  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ['exchange-rates-history', baseCurrency, selectedTarget],
    queryFn: () => {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);
      return api.get<{ baseCurrency: string; targetCurrency: string; rates: HistoricalRate[] }>(
        `/currencies/rates/${baseCurrency}/${selectedTarget}/history?startDate=${startDate.toISOString()}`
      );
    },
    enabled: !!selectedTarget && showHistory,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  // Fetch ECB rates mutation
  const fetchECBMutation = useMutation({
    mutationFn: () => api.post('/currencies/rates/fetch-ecb', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
    },
  });

  // Initialize currencies mutation
  const initializeMutation = useMutation({
    mutationFn: () => api.post('/currencies/initialize', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currencies'] });
    },
  });

  const rates = ratesData?.rates ?? [];
  const history = historyData?.rates ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Taux de change</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gerez les taux de change pour la conversion multi-devises
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => initializeMutation.mutate()}
            disabled={initializeMutation.isPending}
            className="btn-secondary"
          >
            Initialiser devises
          </button>
          <button
            onClick={() => fetchECBMutation.mutate()}
            disabled={fetchECBMutation.isPending}
            className="btn-primary"
          >
            {fetchECBMutation.isPending ? 'Chargement...' : 'Actualiser (BCE)'}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Rates List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Base Currency Selector */}
          <div className="card">
            <label className="label">Devise de reference</label>
            <CurrencySelector
              value={baseCurrency}
              onChange={(code) => {
                setBaseCurrency(code);
                setSelectedTarget(null);
              }}
            />
          </div>

          {/* Rates Table */}
          <div className="card">
            <h2 className="font-semibold mb-4">
              Taux actuels pour 1 {baseCurrency}
            </h2>

            {loadingRates ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-12 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"
                  />
                ))}
              </div>
            ) : rates.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">
                        Devise
                      </th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-500">
                        Taux
                      </th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-500">
                        Date
                      </th>
                      <th className="text-center py-2 px-3 text-sm font-medium text-gray-500">
                        Source
                      </th>
                      <th className="py-2 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map((rate) => (
                      <tr
                        key={rate.targetCurrency}
                        className={clsx(
                          'border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
                          selectedTarget === rate.targetCurrency &&
                            'bg-primary-50 dark:bg-primary-900/20'
                        )}
                      >
                        <td className="py-3 px-3">
                          <span className="font-medium">{rate.targetCurrency}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          {rate.rate.toFixed(4)}
                        </td>
                        <td className="py-3 px-3 text-right text-sm text-gray-500">
                          {new Date(rate.date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={clsx(
                              'text-xs px-2 py-1 rounded-full',
                              rate.source === 'ecb'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            )}
                          >
                            {rate.source.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => {
                              setSelectedTarget(rate.targetCurrency);
                              setShowHistory(true);
                            }}
                            className="btn-ghost text-xs"
                          >
                            Historique
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Aucun taux disponible</p>
                <p className="text-sm mt-1">
                  Cliquez sur "Actualiser (BCE)" pour importer les taux de la Banque Centrale Europeenne
                </p>
              </div>
            )}

            {rates.length > 0 && (
              <p className="text-xs text-gray-400 mt-4">
                {rates.length} devises disponibles. Derniere mise a jour:{' '}
                {rates[0]
                  ? new Date(rates[0].date).toLocaleDateString('fr-FR')
                  : '-'}
              </p>
            )}
          </div>

          {/* Historical Chart */}
          {showHistory && selectedTarget && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">
                  Historique {baseCurrency}/{selectedTarget}
                </h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="btn-ghost text-sm"
                >
                  Fermer
                </button>
              </div>

              {loadingHistory ? (
                <div className="h-48 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
              ) : history.length > 0 ? (
                <div className="space-y-4">
                  {/* Simple list view - could be replaced with a chart library */}
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white dark:bg-gray-800">
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2">Date</th>
                          <th className="text-right py-2">Taux</th>
                          <th className="text-right py-2">Variation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((rate, index) => {
                          const prevRate = history[index + 1];
                          const change = prevRate
                            ? ((rate.rate - prevRate.rate) / prevRate.rate) * 100
                            : 0;
                          return (
                            <tr
                              key={rate.date}
                              className="border-b border-gray-100 dark:border-gray-700"
                            >
                              <td className="py-2">
                                {new Date(rate.date).toLocaleDateString('fr-FR')}
                              </td>
                              <td className="py-2 text-right font-mono">
                                {rate.rate.toFixed(4)}
                              </td>
                              <td
                                className={clsx(
                                  'py-2 text-right',
                                  change > 0
                                    ? 'text-success-600'
                                    : change < 0
                                      ? 'text-danger-600'
                                      : 'text-gray-500'
                                )}
                              >
                                {change !== 0 && (
                                  <>
                                    {change > 0 ? '+' : ''}
                                    {change.toFixed(2)}%
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                      <p className="text-gray-500">Min</p>
                      <p className="font-mono font-medium">
                        {Math.min(...history.map((r) => r.rate)).toFixed(4)}
                      </p>
                    </div>
                    <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                      <p className="text-gray-500">Max</p>
                      <p className="font-mono font-medium">
                        {Math.max(...history.map((r) => r.rate)).toFixed(4)}
                      </p>
                    </div>
                    <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                      <p className="text-gray-500">Moyenne</p>
                      <p className="font-mono font-medium">
                        {(
                          history.reduce((sum, r) => sum + r.rate, 0) /
                          history.length
                        ).toFixed(4)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Aucun historique disponible
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Currency Converter */}
          <CurrencyConverter defaultFrom={baseCurrency} />

          {/* Info */}
          <div className="card">
            <h3 className="font-semibold mb-3">A propos des taux</h3>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <p>
                Les taux de change sont recuperes quotidiennement depuis la Banque
                Centrale Europeenne (BCE).
              </p>
              <p>
                Les taux BCE sont publies vers 16h00 CET chaque jour ouvrable.
              </p>
              <p>
                Les conversions utilisent le taux le plus recent disponible pour
                la date de la transaction.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="card">
            <h3 className="font-semibold mb-3">Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => fetchECBMutation.mutate()}
                disabled={fetchECBMutation.isPending}
                className="btn-secondary w-full"
              >
                Mettre a jour les taux BCE
              </button>
            </div>

            {fetchECBMutation.isSuccess && (
              <p className="text-sm text-success-600 mt-2">
                Taux mis a jour avec succes
              </p>
            )}
            {fetchECBMutation.isError && (
              <p className="text-sm text-danger-600 mt-2">
                Erreur lors de la mise a jour
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExchangeRatesPage;
