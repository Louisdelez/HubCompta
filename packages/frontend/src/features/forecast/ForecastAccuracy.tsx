// ============================================================================
// FORECAST ACCURACY COMPONENT - Finance Hub
// Shows accuracy metrics for past forecasts
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Target, TrendingUp, BarChart3, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/providers/ThemeProvider';
import { CATPPUCCIN } from '@/lib/catppuccin-colors';

// Helper to convert RGB string to hex
function rgbToHex(rgb: string): string {
  const parts = rgb.split(' ').map(Number);
  return '#' + parts.map((n) => n.toString(16).padStart(2, '0')).join('');
}

// Hook to get Catppuccin colors as hex for charts
function useCatppuccinChartColors() {
  const { resolvedTheme } = useTheme();
  const palette = CATPPUCCIN[resolvedTheme];

  return useMemo(
    () => ({
      green: rgbToHex(palette.green),
      red: rgbToHex(palette.red),
      blue: rgbToHex(palette.blue),
      mauve: rgbToHex(palette.mauve),
      yellow: rgbToHex(palette.yellow),
      peach: rgbToHex(palette.peach),
      teal: rgbToHex(palette.teal),
      overlay1: rgbToHex(palette.overlay1),
      surface1: rgbToHex(palette.surface1),
      subtext0: rgbToHex(palette.subtext0),
    }),
    [resolvedTheme, palette]
  );
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface AccuracyMetrics {
  overall: {
    mape: number; // Mean Absolute Percentage Error
    rmse: number; // Root Mean Square Error
    accuracy: number; // 1 - MAPE (as percentage)
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

interface ForecastAccuracyProps {
  accuracy: AccuracyMetrics;
  className?: string;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 85) return 'text-ctp-green';
  if (accuracy >= 70) return 'text-ctp-blue';
  if (accuracy >= 50) return 'text-ctp-yellow';
  return 'text-ctp-peach';
}

function getAccuracyBgColor(accuracy: number): string {
  if (accuracy >= 85) return 'bg-ctp-green/10';
  if (accuracy >= 70) return 'bg-ctp-blue/10';
  if (accuracy >= 50) return 'bg-ctp-yellow/10';
  return 'bg-ctp-peach/10';
}

function getMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    average: 'Moyenne',
    trend: 'Tendance',
    seasonal: 'Saisonnier',
  };
  return labels[method] || method;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ForecastAccuracy({ accuracy, className }: ForecastAccuracyProps) {
  const colors = useCatppuccinChartColors();

  const methodChartData = useMemo(() => {
    return accuracy.byMethod.map((m) => ({
      name: getMethodLabel(m.method),
      accuracy: m.accuracy,
      samples: m.sampleSize,
    }));
  }, [accuracy.byMethod]);

  const categoryChartData = useMemo(() => {
    // Sort by accuracy descending and take top 5
    return [...accuracy.byCategory]
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 5)
      .map((c) => ({
        name: c.categoryName,
        accuracy: c.accuracy,
        samples: c.sampleSize,
      }));
  }, [accuracy.byCategory]);

  const getBarColor = (acc: number): string => {
    if (acc >= 85) return colors.green;
    if (acc >= 70) return colors.blue;
    if (acc >= 50) return colors.yellow;
    return colors.peach;
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Overall Accuracy Card */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-ctp-mauve" />
          Precision globale des previsions
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Accuracy Score */}
          <div
            className={cn(
              'rounded-xl p-4 text-center',
              getAccuracyBgColor(accuracy.overall.accuracy)
            )}
          >
            <p className="text-3xl font-bold mb-1">
              <span className={getAccuracyColor(accuracy.overall.accuracy)}>
                {accuracy.overall.accuracy.toFixed(1)}%
              </span>
            </p>
            <p className="text-sm text-ctp-subtext0">Precision moyenne</p>
          </div>

          {/* MAPE */}
          <div className="bg-ctp-surface0 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold mb-1 text-ctp-text">
              {accuracy.overall.mape.toFixed(1)}%
            </p>
            <p className="text-sm text-ctp-subtext0">Erreur moyenne (MAPE)</p>
          </div>

          {/* RMSE */}
          <div className="bg-ctp-surface0 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold mb-1 text-ctp-text">
              {accuracy.overall.rmse.toFixed(2)}
            </p>
            <p className="text-sm text-ctp-subtext0">RMSE</p>
          </div>
        </div>
      </div>

      {/* Method Accuracy */}
      {methodChartData.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-ctp-blue" />
            Precision par methode
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {accuracy.byMethod.map((method) => (
              <div
                key={method.method}
                className={cn(
                  'rounded-xl p-4',
                  getAccuracyBgColor(method.accuracy)
                )}
              >
                <p className="text-sm text-ctp-subtext0 mb-1">
                  {getMethodLabel(method.method)}
                </p>
                <p className="text-2xl font-bold">
                  <span className={getAccuracyColor(method.accuracy)}>
                    {method.accuracy.toFixed(1)}%
                  </span>
                </p>
                <p className="text-xs text-ctp-overlay1 mt-1">
                  {method.sampleSize} echantillons
                </p>
              </div>
            ))}
          </div>

          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={methodChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={colors.surface1} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: colors.subtext0 }}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: colors.subtext0 }}
                  width={80}
                />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Precision']}
                  contentStyle={{
                    backgroundColor: colors.surface1,
                    border: 'none',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                  {methodChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.accuracy)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Category Accuracy */}
      {categoryChartData.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-ctp-teal" />
            Top 5 categories les plus precises
          </h3>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={colors.surface1} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: colors.subtext0 }}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: colors.subtext0 }}
                  width={100}
                />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Precision']}
                  contentStyle={{
                    backgroundColor: colors.surface1,
                    border: 'none',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.accuracy)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Empty state */}
      {accuracy.byCategory.length === 0 && accuracy.byMethod.length === 0 && (
        <div className="card p-8 text-center">
          <Award className="w-12 h-12 mx-auto mb-4 text-ctp-overlay1" />
          <h3 className="text-lg font-medium mb-2">
            Pas encore assez de donnees
          </h3>
          <p className="text-ctp-subtext0">
            Les metriques de precision seront disponibles apres quelques mois de suivi.
          </p>
        </div>
      )}
    </div>
  );
}

export default ForecastAccuracy;
