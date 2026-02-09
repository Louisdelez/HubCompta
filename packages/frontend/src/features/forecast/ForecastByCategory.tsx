// ============================================================================
// FORECAST BY CATEGORY COMPONENT - Finance Hub
// Shows forecasts broken down by spending category
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { CHART_COLORS_CSS } from '@/lib/catppuccin-colors';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface CategoryForecast {
  categoryId: string | null;
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  month: string;
  predictedAmount: number;
  confidence: number;
  method: 'average' | 'trend' | 'seasonal';
}

interface HistoricalCategory {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  data: { month: string; amount: number }[];
}

interface ForecastByCategoryProps {
  forecasts: CategoryForecast[];
  historicalData: HistoricalCategory[];
  currency?: string;
  className?: string;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function getMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    average: 'Moyenne',
    trend: 'Tendance',
    seasonal: 'Saisonnier',
  };
  return labels[method] || method;
}

function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    average: 'text-ctp-blue',
    trend: 'text-ctp-mauve',
    seasonal: 'text-ctp-teal',
  };
  return colors[method] || 'text-ctp-subtext0';
}

function getConfidenceLevel(confidence: number): { label: string; color: string } {
  if (confidence >= 0.7) {
    return { label: 'Haute', color: 'text-ctp-green' };
  } else if (confidence >= 0.4) {
    return { label: 'Moyenne', color: 'text-ctp-yellow' };
  }
  return { label: 'Basse', color: 'text-ctp-peach' };
}

function getTrendFromHistory(data: { month: string; amount: number }[]): 'up' | 'down' | 'stable' {
  if (data.length < 2) return 'stable';

  // Compare last 3 months average to previous 3 months
  const sorted = [...data].sort((a, b) => b.month.localeCompare(a.month));
  const recent = sorted.slice(0, 3);
  const older = sorted.slice(3, 6);

  if (older.length === 0) return 'stable';

  const recentAvg = recent.reduce((sum, d) => sum + d.amount, 0) / recent.length;
  const olderAvg = older.reduce((sum, d) => sum + d.amount, 0) / older.length;

  const changePercent = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

  if (changePercent > 10) return 'up';
  if (changePercent < -10) return 'down';
  return 'stable';
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ForecastByCategory({
  forecasts,
  historicalData,
  currency = 'EUR',
  className,
}: ForecastByCategoryProps) {
  // Group forecasts by category and get next month's forecast
  const categoryForecasts = useMemo(() => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthStr = nextMonth.toISOString().split('T')[0] ?? '';
    const nextMonthPrefix = nextMonthStr.substring(0, 7);

    // Filter for next month and exclude total (null categoryId)
    const nextMonthForecasts = forecasts.filter(
      (f) => f.categoryId !== null && f.month.startsWith(nextMonthPrefix)
    );

    // Sort by predicted amount descending
    nextMonthForecasts.sort((a, b) => b.predictedAmount - a.predictedAmount);

    // Enrich with historical trend data
    return nextMonthForecasts.map((forecast, index) => {
      const history = historicalData.find((h) => h.categoryId === forecast.categoryId);
      const trend = history ? getTrendFromHistory(history.data) : 'stable';
      const lastMonth = history?.data.sort((a, b) => b.month.localeCompare(a.month))[0];

      return {
        ...forecast,
        trend,
        lastMonthAmount: lastMonth?.amount ?? 0,
        colorIndex: index % CHART_COLORS_CSS.length,
      };
    });
  }, [forecasts, historicalData]);

  if (categoryForecasts.length === 0) {
    return (
      <div className={cn('card p-6 text-center text-ctp-subtext0', className)}>
        Aucune prevision par categorie disponible
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {categoryForecasts.map((forecast) => {
        const confidenceInfo = getConfidenceLevel(forecast.confidence);
        const change = forecast.predictedAmount - forecast.lastMonthAmount;
        const changePercent =
          forecast.lastMonthAmount > 0
            ? ((change / forecast.lastMonthAmount) * 100).toFixed(1)
            : '0';

        return (
          <div
            key={forecast.categoryId}
            className="card p-4 hover:border-ctp-surface2 transition-colors"
          >
            <div className="flex items-center justify-between">
              {/* Category info */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                  style={{
                    backgroundColor: `${CHART_COLORS_CSS[forecast.colorIndex]}20`,
                    color: CHART_COLORS_CSS[forecast.colorIndex],
                  }}
                >
                  {forecast.category?.icon || '?'}
                </div>
                <div>
                  <p className="font-medium text-ctp-text">
                    {forecast.category?.name || 'Categorie inconnue'}
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={getMethodColor(forecast.method)}>
                      {getMethodLabel(forecast.method)}
                    </span>
                    <span className="text-ctp-overlay1">-</span>
                    <span className={confidenceInfo.color}>
                      Confiance {confidenceInfo.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Forecast info */}
              <div className="text-right">
                <p className="font-semibold text-lg text-ctp-text">
                  {formatCurrency(forecast.predictedAmount, currency)}
                </p>
                <div className="flex items-center justify-end gap-1 text-xs">
                  {forecast.trend === 'up' && (
                    <TrendingUp className="w-3 h-3 text-ctp-red" />
                  )}
                  {forecast.trend === 'down' && (
                    <TrendingDown className="w-3 h-3 text-ctp-green" />
                  )}
                  {forecast.trend === 'stable' && (
                    <Minus className="w-3 h-3 text-ctp-overlay1" />
                  )}
                  <span
                    className={cn(
                      change > 0 ? 'text-ctp-red' : change < 0 ? 'text-ctp-green' : 'text-ctp-overlay1'
                    )}
                  >
                    {change >= 0 ? '+' : ''}
                    {changePercent}% vs mois dernier
                  </span>
                </div>
              </div>
            </div>

            {/* Confidence bar */}
            <div className="mt-3">
              <div className="h-1 bg-ctp-surface1 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', {
                    'bg-ctp-green': forecast.confidence >= 0.7,
                    'bg-ctp-yellow': forecast.confidence >= 0.4 && forecast.confidence < 0.7,
                    'bg-ctp-peach': forecast.confidence < 0.4,
                  })}
                  style={{ width: `${forecast.confidence * 100}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ForecastByCategory;
