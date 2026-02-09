// ============================================================================
// EXCHANGE RATES PAGE - Finance Hub
// View and manage exchange rates
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api/client';
import { CurrencySelector } from './CurrencySelector';
import { CurrencyConverter } from './CurrencyConverter';
import { ManualRateModal } from './ManualRateModal';
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

interface ExchangeRateSource {
  id: string;
  name: string;
  baseCurrency: string;
  currencies: number;
  available: boolean;
  requiresApiKey: boolean;
}

// Source colors and display config
const SOURCE_CONFIG: Record<string, { color: string; bgColor: string; darkBgColor: string; label: string }> = {
  ecb: {
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100',
    darkBgColor: 'dark:bg-blue-900/30',
    label: 'BCE',
  },
  'fed-h10': {
    color: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-100',
    darkBgColor: 'dark:bg-emerald-900/30',
    label: 'FED',
  },
  snb: {
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100',
    darkBgColor: 'dark:bg-red-900/30',
    label: 'SNB',
  },
  fred: {
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-100',
    darkBgColor: 'dark:bg-purple-900/30',
    label: 'FRED',
  },
  manual: {
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-100',
    darkBgColor: 'dark:bg-orange-900/30',
    label: 'MANUEL',
  },
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ExchangeRatesPage() {
  const queryClient = useQueryClient();
  const [baseCurrency, setBaseCurrency] = useState('EUR');
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showManualRateModal, setShowManualRateModal] = useState(false);

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

  // Fetch available sources
  const { data: sourcesData } = useQuery({
    queryKey: ['exchange-rate-sources'],
    queryFn: () => api.get<ExchangeRateSource[]>('/currencies/sources'),
  });

  // Create mutation for each source
  const fetchECBMutation = useMutation({
    mutationFn: () => api.post('/currencies/rates/fetch-ecb', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
    },
  });

  const fetchFedMutation = useMutation({
    mutationFn: () => api.post('/currencies/rates/fetch-fed', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
    },
  });

  const fetchSNBMutation = useMutation({
    mutationFn: () => api.post('/currencies/rates/fetch-snb', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
    },
  });

  const fetchFREDMutation = useMutation({
    mutationFn: () => api.post('/currencies/rates/fetch-fred', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
    },
  });

  // Fetch all rates mutation
  const fetchAllMutation = useMutation({
    mutationFn: () => api.post('/currencies/rates/fetch-all', {}),
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

  const sources = sourcesData ?? [];

  const isAnyMutationPending = fetchECBMutation.isPending || fetchFedMutation.isPending ||
    fetchSNBMutation.isPending || fetchFREDMutation.isPending || fetchAllMutation.isPending;

  const isAnyMutationSuccess = fetchECBMutation.isSuccess || fetchFedMutation.isSuccess ||
    fetchSNBMutation.isSuccess || fetchFREDMutation.isSuccess || fetchAllMutation.isSuccess;

  const isAnyMutationError = fetchECBMutation.isError || fetchFedMutation.isError ||
    fetchSNBMutation.isError || fetchFREDMutation.isError || fetchAllMutation.isError;

  // Helper to get mutation for a source
  const getMutationForSource = (sourceId: string) => {
    switch (sourceId) {
      case 'ecb': return fetchECBMutation;
      case 'fed-h10': return fetchFedMutation;
      case 'snb': return fetchSNBMutation;
      case 'fred': return fetchFREDMutation;
      default: return null;
    }
  };

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
            onClick={() => setShowManualRateModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Definir un taux
          </button>
          <button
            onClick={() => fetchAllMutation.mutate()}
            disabled={fetchAllMutation.isPending}
            className="btn-primary"
          >
            {fetchAllMutation.isPending ? 'Chargement...' : 'Actualiser tous'}
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
                          {(() => {
                            const config = SOURCE_CONFIG[rate.source] ?? {
                              color: 'text-gray-700 dark:text-gray-300',
                              bgColor: 'bg-gray-100',
                              darkBgColor: 'dark:bg-gray-700',
                              label: rate.source.toUpperCase(),
                            };
                            return (
                              <span
                                className={clsx(
                                  'text-xs px-2 py-1 rounded-full',
                                  config.bgColor,
                                  config.darkBgColor,
                                  config.color
                                )}
                              >
                                {config.label}
                              </span>
                            );
                          })()}
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

          {/* Sources Info */}
          <div className="card">
            <h3 className="font-semibold mb-3">Sources de taux ({sources.length})</h3>
            <div className="space-y-2">
              {sources.map((source) => {
                const config = SOURCE_CONFIG[source.id] ?? {
                  color: 'text-gray-700 dark:text-gray-300',
                  bgColor: 'bg-gray-100',
                  darkBgColor: 'dark:bg-gray-700',
                  label: source.id.toUpperCase(),
                };
                const bgClass = source.available
                  ? config.bgColor.replace('100', '50') + ' ' + config.darkBgColor.replace('/30', '/20')
                  : 'bg-gray-50 dark:bg-gray-700/50 opacity-60';

                return (
                  <div
                    key={source.id}
                    className={clsx('flex items-start gap-3 p-3 rounded-lg', bgClass)}
                  >
                    <div
                      className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                        source.available
                          ? `${config.bgColor} ${config.darkBgColor} ${config.color}`
                          : 'bg-gray-200 dark:bg-gray-600 text-gray-500'
                      )}
                    >
                      {config.label.slice(0, 3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{source.name}</p>
                      <p className="text-xs text-gray-500">
                        {source.currencies} devises - Base {source.baseCurrency}
                      </p>
                      {source.requiresApiKey && !source.available && (
                        <p className="text-xs text-orange-500 mt-1">
                          Cle API requise
                        </p>
                      )}
                      {source.available && (
                        <span className="inline-flex items-center text-xs text-green-600 dark:text-green-400 mt-1">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1" />
                          Actif
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="card">
            <h3 className="font-semibold mb-3">Importer les taux</h3>
            <div className="space-y-2">
              {/* Individual source buttons */}
              <div className="grid grid-cols-2 gap-2">
                {sources.filter(s => s.available).map((source) => {
                  const mutation = getMutationForSource(source.id);
                  const config = SOURCE_CONFIG[source.id];
                  if (!mutation || !config) return null;

                  return (
                    <button
                      key={source.id}
                      onClick={() => mutation.mutate()}
                      disabled={mutation.isPending || isAnyMutationPending}
                      className={clsx(
                        'btn-secondary text-xs py-2 flex items-center justify-center gap-1',
                        mutation.isPending && 'opacity-50'
                      )}
                    >
                      <span
                        className={clsx(
                          'w-2 h-2 rounded-full',
                          config.bgColor
                        )}
                      />
                      {mutation.isPending ? '...' : config.label}
                    </button>
                  );
                })}
              </div>

              {/* Fetch all button */}
              <button
                onClick={() => fetchAllMutation.mutate()}
                disabled={isAnyMutationPending}
                className="btn-primary w-full mt-2"
              >
                {fetchAllMutation.isPending ? 'Importation...' : 'Importer toutes les sources'}
              </button>
            </div>

            {isAnyMutationSuccess && (
              <p className="text-sm text-success-600 mt-2">
                Taux mis a jour avec succes
              </p>
            )}
            {isAnyMutationError && (
              <p className="text-sm text-danger-600 mt-2">
                Erreur lors de la mise a jour
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Manual Rate Modal */}
      <ManualRateModal
        isOpen={showManualRateModal}
        onClose={() => setShowManualRateModal(false)}
        defaultBaseCurrency={baseCurrency}
      />
    </div>
  );
}

export default ExchangeRatesPage;
