// ============================================================================
// NET WORTH CHART COMPONENT - Finance Hub
// Line chart showing net worth over time
// Uses Catppuccin colors: green for positive, red for negative
// ============================================================================

import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { format, parseISO, subDays, subMonths, subYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { useTheme } from '@/providers/ThemeProvider';
import { CATPPUCCIN } from '@/lib/catppuccin-colors';

// Helper to convert RGB string to hex
function rgbToHex(rgb: string): string {
  const parts = rgb.split(' ').map(Number);
  return '#' + parts.map(n => n.toString(16).padStart(2, '0')).join('');
}

// Hook to get Catppuccin colors as hex for charts
function useCatppuccinChartColors() {
  const { resolvedTheme } = useTheme();
  const palette = CATPPUCCIN[resolvedTheme];

  return useMemo(() => ({
    green: rgbToHex(palette.green),
    red: rgbToHex(palette.red),
    blue: rgbToHex(palette.blue),
    overlay1: rgbToHex(palette.overlay1),
    surface1: rgbToHex(palette.surface1),
    subtext0: rgbToHex(palette.subtext0),
    mauve: rgbToHex(palette.mauve),
    teal: rgbToHex(palette.teal),
  }), [resolvedTheme, palette]);
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface DataPoint {
  date: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
}

interface NetWorthChartProps {
  data: DataPoint[];
  currency?: string;
  showBreakdown?: boolean;
  height?: number;
  className?: string;
}

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

// ----------------------------------------------------------------------------
// Time Range Config
// ----------------------------------------------------------------------------

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: '1W', label: '1S' },
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1A' },
  { key: 'ALL', label: 'Max' },
];

function getStartDate(range: TimeRange): Date | null {
  const now = new Date();
  switch (range) {
    case '1W':
      return subDays(now, 7);
    case '1M':
      return subMonths(now, 1);
    case '3M':
      return subMonths(now, 3);
    case '6M':
      return subMonths(now, 6);
    case '1Y':
      return subYears(now, 1);
    case 'ALL':
      return null;
  }
}

// ----------------------------------------------------------------------------
// Custom Tooltip
// ----------------------------------------------------------------------------

function CustomTooltip({
  active,
  payload,
  label,
  currency = 'EUR',
  showBreakdown = false,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string; color: string }[];
  label?: string;
  currency?: string;
  showBreakdown?: boolean;
}) {
  if (!active || !payload || !payload.length) return null;

  const netWorthData = payload.find((p) => p.dataKey === 'netWorth');
  const assetsData = payload.find((p) => p.dataKey === 'totalAssets');
  const liabilitiesData = payload.find((p) => p.dataKey === 'totalLiabilities');

  return (
    <div className="bg-ctp-surface0 border border-ctp-surface1 rounded-lg shadow-lg p-3">
      <p className="text-sm text-ctp-overlay1 mb-2">
        {label ? format(parseISO(label), 'dd MMM yyyy', { locale: fr }) : ''}
      </p>
      {netWorthData && (
        <p className="text-sm">
          <span className="text-ctp-subtext0">Patrimoine net: </span>
          <span className={cn(
            'font-medium',
            netWorthData.value >= 0 ? 'text-ctp-green' : 'text-ctp-red'
          )}>
            {formatCurrency(netWorthData.value, currency)}
          </span>
        </p>
      )}
      {showBreakdown && assetsData && (
        <p className="text-sm">
          <span className="text-ctp-subtext0">Actifs: </span>
          <span className="font-medium text-ctp-teal">
            {formatCurrency(assetsData.value, currency)}
          </span>
        </p>
      )}
      {showBreakdown && liabilitiesData && (
        <p className="text-sm">
          <span className="text-ctp-subtext0">Passifs: </span>
          <span className="font-medium text-ctp-mauve">
            {formatCurrency(liabilitiesData.value, currency)}
          </span>
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function NetWorthChart({
  data,
  currency = 'EUR',
  showBreakdown = false,
  height = 300,
  className,
}: NetWorthChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');
  const colors = useCatppuccinChartColors();

  // Filter data based on time range
  const filteredData = useMemo(() => {
    const startDate = getStartDate(timeRange);
    if (!startDate) return data;

    return data.filter((point) => {
      const pointDate = parseISO(point.date);
      return pointDate >= startDate;
    });
  }, [data, timeRange]);

  // Calculate stats
  const stats = useMemo(() => {
    if (filteredData.length === 0) {
      return { startValue: 0, endValue: 0, change: 0, changePercent: 0 };
    }

    const firstPoint = filteredData[0];
    const lastPoint = filteredData[filteredData.length - 1];
    if (!firstPoint || !lastPoint) {
      return { startValue: 0, endValue: 0, change: 0, changePercent: 0 };
    }
    const startValue = firstPoint.netWorth;
    const endValue = lastPoint.netWorth;
    const change = endValue - startValue;
    const changePercent = startValue !== 0 ? (change / Math.abs(startValue)) * 100 : 0;

    return { startValue, endValue, change, changePercent };
  }, [filteredData]);

  // Calculate Y axis domain
  const yDomain = useMemo(() => {
    if (filteredData.length === 0) return [0, 100];

    let min = Infinity;
    let max = -Infinity;

    for (const point of filteredData) {
      if (point.netWorth < min) min = point.netWorth;
      if (point.netWorth > max) max = point.netWorth;
      if (showBreakdown) {
        if (point.totalAssets > max) max = point.totalAssets;
        if (-point.totalLiabilities < min) min = -point.totalLiabilities;
      }
    }

    const padding = Math.abs(max - min) * 0.1;
    return [min - padding, max + padding];
  }, [filteredData, showBreakdown]);

  // Get chart color based on net worth value
  const chartColor = stats.endValue >= 0 ? colors.green : colors.red;

  if (data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center text-ctp-overlay1', className)} style={{ height }}>
        Aucune donnee de patrimoine disponible
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header with stats */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className={cn(
            'text-2xl font-semibold',
            stats.endValue >= 0 ? 'text-ctp-green' : 'text-ctp-red'
          )}>
            {formatCurrency(stats.endValue, currency)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('text-sm font-medium', stats.change >= 0 ? 'text-ctp-green' : 'text-ctp-red')}>
              {stats.change >= 0 ? '+' : ''}
              {formatCurrency(stats.change, currency)}
            </span>
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                stats.change >= 0 ? 'bg-ctp-green/20 text-ctp-green' : 'bg-ctp-red/20 text-ctp-red'
              )}
            >
              {stats.changePercent >= 0 ? '+' : ''}
              {stats.changePercent.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Time range selector */}
        <div className="flex gap-1 bg-ctp-surface0 p-1 rounded-lg">
          {TIME_RANGES.map((range) => (
            <button
              key={range.key}
              onClick={() => setTimeRange(range.key)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                timeRange === range.key
                  ? 'bg-ctp-surface1 text-ctp-text shadow-sm'
                  : 'text-ctp-subtext0 hover:text-ctp-text'
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {showBreakdown ? (
            <ComposedChart data={filteredData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.surface1} vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: colors.subtext0 }}
                tickFormatter={(value) => format(parseISO(value), 'dd/MM', { locale: fr })}
                minTickGap={50}
              />
              <YAxis
                domain={yDomain}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: colors.subtext0 }}
                tickFormatter={(value) => formatCurrency(value, currency, { compact: true })}
                width={70}
              />
              <Tooltip content={<CustomTooltip currency={currency} showBreakdown={showBreakdown} />} />
              <ReferenceLine y={0} stroke={colors.overlay1} strokeDasharray="5 5" />

              {/* Assets area */}
              <Area
                type="monotone"
                dataKey="totalAssets"
                fill={colors.teal}
                fillOpacity={0.1}
                stroke={colors.teal}
                strokeWidth={1}
                strokeDasharray="3 3"
              />

              {/* Net worth line */}
              <Line
                type="monotone"
                dataKey="netWorth"
                stroke={chartColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: chartColor }}
              />
            </ComposedChart>
          ) : (
            <LineChart data={filteredData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.surface1} vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: colors.subtext0 }}
                tickFormatter={(value) => format(parseISO(value), 'dd/MM', { locale: fr })}
                minTickGap={50}
              />
              <YAxis
                domain={yDomain}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: colors.subtext0 }}
                tickFormatter={(value) => formatCurrency(value, currency, { compact: true })}
                width={70}
              />
              <Tooltip content={<CustomTooltip currency={currency} showBreakdown={false} />} />
              <ReferenceLine y={0} stroke={colors.overlay1} strokeDasharray="5 5" />

              {/* Net worth line */}
              <Line
                type="monotone"
                dataKey="netWorth"
                stroke={chartColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: chartColor }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      {showBreakdown && (
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5" style={{ backgroundColor: chartColor }} />
            <span className="text-xs text-ctp-subtext0">Patrimoine net</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 border-t border-dashed border-ctp-teal" />
            <span className="text-xs text-ctp-subtext0">Total actifs</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default NetWorthChart;
