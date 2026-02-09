// ============================================================================
// FORECAST CHART COMPONENT - Finance Hub
// Shows actual vs predicted spending with confidence intervals
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
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
      overlay1: rgbToHex(palette.overlay1),
      surface1: rgbToHex(palette.surface1),
      subtext0: rgbToHex(palette.subtext0),
      text: rgbToHex(palette.text),
    }),
    [resolvedTheme, palette]
  );
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface DataPoint {
  month: string;
  actual?: number;
  predicted?: number;
  confidenceLow?: number;
  confidenceHigh?: number;
  isPast: boolean;
}

interface ForecastChartProps {
  historicalData: { month: string; amount: number }[];
  forecasts: {
    month: string;
    predictedAmount: number;
    confidence: number;
  }[];
  currency?: string;
  height?: number;
  className?: string;
}

// ----------------------------------------------------------------------------
// Custom Tooltip
// ----------------------------------------------------------------------------

function CustomTooltip({
  active,
  payload,
  label,
  currency = 'EUR',
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string; color: string }[];
  label?: string;
  currency?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  const actualData = payload.find((p) => p.dataKey === 'actual');
  const predictedData = payload.find((p) => p.dataKey === 'predicted');

  return (
    <div className="bg-ctp-surface0 border border-ctp-surface1 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-ctp-text mb-2">
        {label ? format(parseISO(label), 'MMMM yyyy', { locale: fr }) : ''}
      </p>
      {actualData && actualData.value !== undefined && (
        <p className="text-sm">
          <span className="text-ctp-subtext0">Depenses reelles: </span>
          <span className="font-medium text-ctp-blue">
            {formatCurrency(actualData.value, currency)}
          </span>
        </p>
      )}
      {predictedData && predictedData.value !== undefined && (
        <p className="text-sm">
          <span className="text-ctp-subtext0">Prevision: </span>
          <span className="font-medium text-ctp-mauve">
            {formatCurrency(predictedData.value, currency)}
          </span>
        </p>
      )}
      {actualData && predictedData && actualData.value !== undefined && predictedData.value !== undefined && (
        <p className="text-sm mt-1 pt-1 border-t border-ctp-surface1">
          <span className="text-ctp-subtext0">Ecart: </span>
          <span
            className={cn(
              'font-medium',
              actualData.value <= predictedData.value ? 'text-ctp-green' : 'text-ctp-red'
            )}
          >
            {actualData.value <= predictedData.value ? '' : '+'}
            {formatCurrency(actualData.value - predictedData.value, currency)}
          </span>
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ForecastChart({
  historicalData,
  forecasts,
  currency = 'EUR',
  height = 350,
  className,
}: ForecastChartProps) {
  const colors = useCatppuccinChartColors();

  // Combine historical and forecast data
  const chartData = useMemo(() => {
    const data: DataPoint[] = [];
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0] ?? '';

    // Add historical data
    for (const point of historicalData) {
      const monthKey = point.month.split('T')[0] ?? '';
      data.push({
        month: monthKey,
        actual: point.amount,
        isPast: true,
      });
    }

    // Add forecasts
    for (const forecast of forecasts) {
      const monthKey = forecast.month.split('T')[0] ?? '';
      const existing = data.find((d) => d.month === monthKey);

      // Calculate confidence interval (using confidence as a multiplier)
      const marginOfError = forecast.predictedAmount * (1 - forecast.confidence) * 0.5;
      const confidenceLow = Math.max(0, forecast.predictedAmount - marginOfError);
      const confidenceHigh = forecast.predictedAmount + marginOfError;

      if (existing) {
        existing.predicted = forecast.predictedAmount;
        existing.confidenceLow = confidenceLow;
        existing.confidenceHigh = confidenceHigh;
      } else {
        data.push({
          month: monthKey,
          predicted: forecast.predictedAmount,
          confidenceLow,
          confidenceHigh,
          isPast: monthKey < currentMonth,
        });
      }
    }

    // Sort by month
    data.sort((a, b) => a.month.localeCompare(b.month));

    return data;
  }, [historicalData, forecasts]);

  // Calculate Y axis domain
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];

    let min = Infinity;
    let max = -Infinity;

    for (const point of chartData) {
      if (point.actual !== undefined) {
        if (point.actual < min) min = point.actual;
        if (point.actual > max) max = point.actual;
      }
      if (point.confidenceLow !== undefined && point.confidenceLow < min) {
        min = point.confidenceLow;
      }
      if (point.confidenceHigh !== undefined && point.confidenceHigh > max) {
        max = point.confidenceHigh;
      }
      if (point.predicted !== undefined) {
        if (point.predicted < min) min = point.predicted;
        if (point.predicted > max) max = point.predicted;
      }
    }

    const padding = (max - min) * 0.1;
    return [Math.max(0, min - padding), max + padding];
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center text-ctp-overlay1', className)}
        style={{ height }}
      >
        Aucune donnee disponible pour les previsions
      </div>
    );
  }

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.surface1} vertical={false} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: colors.subtext0 }}
            tickFormatter={(value) => format(parseISO(value), 'MMM yy', { locale: fr })}
            minTickGap={30}
          />
          <YAxis
            domain={yDomain}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: colors.subtext0 }}
            tickFormatter={(value) => formatCurrency(value, currency, { compact: true })}
            width={65}
          />
          <Tooltip content={<CustomTooltip currency={currency} />} />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) => {
              const labels: Record<string, string> = {
                actual: 'Depenses reelles',
                predicted: 'Previsions',
                confidenceRange: 'Intervalle de confiance',
              };
              return <span className="text-sm text-ctp-subtext0">{labels[value] || value}</span>;
            }}
          />

          {/* Confidence interval area */}
          <Area
            type="monotone"
            dataKey="confidenceHigh"
            stroke="none"
            fill={colors.mauve}
            fillOpacity={0.1}
            name="confidenceRange"
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="confidenceLow"
            stroke="none"
            fill={colors.surface1}
            fillOpacity={1}
            name="confidenceLowFill"
            legendType="none"
            connectNulls
          />

          {/* Actual spending line */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke={colors.blue}
            strokeWidth={2}
            dot={{ fill: colors.blue, r: 4 }}
            activeDot={{ r: 6, fill: colors.blue }}
            name="actual"
            connectNulls
          />

          {/* Predicted spending line (dashed) */}
          <Line
            type="monotone"
            dataKey="predicted"
            stroke={colors.mauve}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: colors.mauve, r: 4 }}
            activeDot={{ r: 6, fill: colors.mauve }}
            name="predicted"
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ForecastChart;
