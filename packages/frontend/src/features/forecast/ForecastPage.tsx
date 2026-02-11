// ============================================================================
// FORECAST PAGE - Finance Hub
// Main forecast page with charts and metrics
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  TrendingUp,
  Target,
  Calendar,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ForecastChart } from './ForecastChart';
import { ForecastByCategory } from './ForecastByCategory';
import { ForecastAccuracy } from './ForecastAccuracy';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ForecastData {
  id: string;
  workspaceId: string;
  categoryId: string | null;
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  month: string;
  predictedAmount: number;
  actualAmount: number | null;
  confidence: number;
  method: 'average' | 'trend' | 'seasonal';
  createdAt: string;
}

interface HistoricalDataRaw {
  month: string;
  categoryId: string | null;
  categoryName: string | null;
  amount: number;
  transactionCount: number;
}

interface HistoricalData {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  data: { month: string; amount: number }[];
}

interface AccuracyMetrics {
  overall: {
    mape: number;
    rmse: number;
    accuracy: number;
  };
  byCategory: {
    categoryId: string;
    categoryName: string;
    mape: number;
    accuracy: number;
    sampleSize: number;
  }[];
  byMethod: {
    method: string;
    mape: number;
    accuracy: number;
    sampleSize: number;
  }[];
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ForecastPage() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'accuracy'>('overview');

  // Fetch forecasts
  const {
    data: forecasts,
    isLoading: forecastsLoading,
    error: forecastsError,
  } = useQuery({
    queryKey: ['forecast', workspaceId],
    queryFn: () => api.get<ForecastData[]>(`/workspaces/${workspaceId}/forecast`),
    enabled: !!workspaceId,
  });

  // Fetch historical data and transform to grouped format
  const { data: historicalData } = useQuery({
    queryKey: ['forecast', workspaceId, 'historical'],
    queryFn: async () => {
      const rawData = await api.get<HistoricalDataRaw[]>(`/workspaces/${workspaceId}/forecast/historical?months=12`);

      // Transform flat array to grouped by category
      const grouped: Record<string, HistoricalData> = {};

      for (const item of rawData) {
        const catId = item.categoryId ?? 'uncategorized';
        if (!grouped[catId]) {
          grouped[catId] = {
            categoryId: catId,
            categoryName: item.categoryName ?? 'Non catégorisé',
            categoryIcon: null,
            categoryColor: null,
            data: [],
          };
        }
        grouped[catId].data.push({ month: item.month, amount: item.amount });
      }

      return Object.values(grouped);
    },
    enabled: !!workspaceId,
  });

  // Fetch accuracy metrics
  const { data: accuracy, isLoading: accuracyLoading } = useQuery({
    queryKey: ['forecast', workspaceId, 'accuracy'],
    queryFn: () => api.get<AccuracyMetrics>(`/workspaces/${workspaceId}/forecast/accuracy`),
    enabled: !!workspaceId,
  });

  // Generate forecast mutation
  const generateMutation = useMutation({
    mutationFn: () =>
      api.post<ForecastData[]>(`/workspaces/${workspaceId}/forecast/generate`, { months: 6 }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forecast', workspaceId] });
    },
  });

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-ctp-subtext0">
        Selectionnez un espace de travail
      </div>
    );
  }

  if (forecastsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-ctp-surface1 rounded w-1/4" />
          <div className="h-64 bg-ctp-surface1 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-ctp-surface1 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (forecastsError) {
    return (
      <div className="p-6">
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-ctp-red" />
          <h2 className="text-xl font-bold mb-2">Erreur de chargement</h2>
          <p className="text-ctp-subtext0 mb-4">
            Impossible de charger les previsions.
          </p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['forecast', workspaceId] })}
            className="btn-primary"
          >
            Reessayer
          </button>
        </div>
      </div>
    );
  }

  // Calculate summary stats
  const totalForecasts = forecasts?.filter((f) => f.categoryId === null) ?? [];
  const categoryForecasts = forecasts?.filter((f) => f.categoryId !== null) ?? [];
  const nextMonthForecast = totalForecasts[0];

  // Prepare chart data - combine historical with forecasts
  const chartHistoricalData =
    historicalData?.reduce((acc, category) => {
      const dataPoints = Array.isArray(category?.data) ? category.data : [];
      for (const point of dataPoints) {
        if (!point?.month) continue;
        const existing = acc.find((d) => d.month === point.month);
        if (existing) {
          existing.amount += point.amount ?? 0;
        } else {
          acc.push({ month: point.month, amount: point.amount ?? 0 });
        }
      }
      return acc;
    }, [] as { month: string; amount: number }[]) ?? [];

  chartHistoricalData.sort((a, b) => a.month.localeCompare(b.month));

  const chartForecasts =
    totalForecasts.map((f) => ({
      month: f.month,
      predictedAmount: f.predictedAmount,
      confidence: f.confidence,
    })) ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-ctp-mauve" />
            Previsions budgetaires
          </h1>
          <p className="text-ctp-subtext0">
            Predictions basees sur l&apos;analyse de vos depenses
          </p>
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className={cn(
            'btn-secondary flex items-center gap-2',
            generateMutation.isPending && 'opacity-50 cursor-not-allowed'
          )}
        >
          <RefreshCw
            className={cn('w-4 h-4', generateMutation.isPending && 'animate-spin')}
          />
          Regenerer les previsions
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Next Month Prediction */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-ctp-mauve" />
            <span className="text-sm text-ctp-subtext0">Mois prochain</span>
          </div>
          {nextMonthForecast ? (
            <>
              <p className="text-2xl font-bold text-ctp-text">
                {formatCurrency(nextMonthForecast.predictedAmount, 'EUR')}
              </p>
              <p className="text-xs text-ctp-subtext0 mt-1">
                {format(new Date(nextMonthForecast.month), 'MMMM yyyy', { locale: fr })}
              </p>
            </>
          ) : (
            <p className="text-ctp-subtext0">Aucune prevision</p>
          )}
        </div>

        {/* Model Accuracy */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-ctp-green" />
            <span className="text-sm text-ctp-subtext0">Precision du modele</span>
          </div>
          {accuracy ? (
            <>
              <p className="text-2xl font-bold text-ctp-text">
                {accuracy.overall.accuracy.toFixed(1)}%
              </p>
              <p className="text-xs text-ctp-subtext0 mt-1">
                Erreur moyenne: {accuracy.overall.mape.toFixed(1)}%
              </p>
            </>
          ) : (
            <p className="text-ctp-subtext0">En cours de calcul...</p>
          )}
        </div>

        {/* Categories Tracked */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-ctp-blue" />
            <span className="text-sm text-ctp-subtext0">Categories suivies</span>
          </div>
          <p className="text-2xl font-bold text-ctp-text">
            {new Set(categoryForecasts.map((f) => f.categoryId)).size}
          </p>
          <p className="text-xs text-ctp-subtext0 mt-1">
            categories avec previsions
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-ctp-surface1">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'overview'
              ? 'border-ctp-mauve text-ctp-mauve'
              : 'border-transparent text-ctp-subtext0 hover:text-ctp-text'
          )}
        >
          Vue d&apos;ensemble
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'categories'
              ? 'border-ctp-mauve text-ctp-mauve'
              : 'border-transparent text-ctp-subtext0 hover:text-ctp-text'
          )}
        >
          Par categorie
        </button>
        <button
          onClick={() => setActiveTab('accuracy')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'accuracy'
              ? 'border-ctp-mauve text-ctp-mauve'
              : 'border-transparent text-ctp-subtext0 hover:text-ctp-text'
          )}
        >
          Precision
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Main Chart */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">
              Depenses reelles vs Previsions
            </h2>
            {chartHistoricalData.length > 0 || chartForecasts.length > 0 ? (
              <ForecastChart
                historicalData={chartHistoricalData}
                forecasts={chartForecasts}
                currency="EUR"
                height={350}
              />
            ) : (
              <div className="h-64 flex items-center justify-center text-ctp-subtext0">
                Pas assez de donnees pour generer un graphique
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="card p-4">
            <h3 className="text-sm font-medium mb-3">Comment lire ce graphique</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 bg-ctp-blue" />
                <span className="text-ctp-subtext0">Depenses reelles (historique)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 border-t-2 border-dashed border-ctp-mauve" />
                <span className="text-ctp-subtext0">Previsions (futur)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-3 bg-ctp-mauve/20 rounded" />
                <span className="text-ctp-subtext0">Intervalle de confiance</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Previsions par categorie</h2>
            {categoryForecasts.length > 0 && historicalData ? (
              <ForecastByCategory
                forecasts={categoryForecasts}
                historicalData={historicalData}
                currency="EUR"
              />
            ) : (
              <div className="text-center py-8 text-ctp-subtext0">
                Pas de previsions par categorie disponibles
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'accuracy' && (
        <div className="space-y-6">
          {accuracy ? (
            <ForecastAccuracy accuracy={accuracy} />
          ) : accuracyLoading ? (
            <div className="card p-8 text-center">
              <RefreshCw className="w-8 h-8 mx-auto mb-4 text-ctp-mauve animate-spin" />
              <p className="text-ctp-subtext0">Calcul des metriques en cours...</p>
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Target className="w-12 h-12 mx-auto mb-4 text-ctp-overlay1" />
              <h3 className="text-lg font-medium mb-2">
                Metriques de precision non disponibles
              </h3>
              <p className="text-ctp-subtext0">
                Les metriques seront disponibles apres quelques mois de suivi.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {(!forecasts || forecasts.length === 0) && !forecastsLoading && (
        <div className="card p-8 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-ctp-mauve" />
          <h2 className="text-xl font-bold mb-2">Aucune prevision disponible</h2>
          <p className="text-ctp-subtext0 mb-6 max-w-md mx-auto">
            Les previsions sont generees automatiquement a partir de vos transactions.
            Continuez a enregistrer vos depenses pour obtenir des previsions precises.
          </p>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="btn-primary"
          >
            Generer les premieres previsions
          </button>
        </div>
      )}
    </div>
  );
}

export default ForecastPage;
