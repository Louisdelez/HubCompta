// ============================================================================
// PERFORMANCE CHART COMPONENT - Finance Hub
// Line chart showing portfolio value over time
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
} from 'recharts';
import { format, parseISO, subDays, subMonths, subYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface DataPoint {
  date: string;
  value: number;
  invested?: number;
}

interface PerformanceChartProps {
  data: DataPoint[];
  currency?: string;
  showInvested?: boolean;
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
  showInvested = false,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string; color: string }[];
  label?: string;
  currency?: string;
  showInvested?: boolean;
}) {
  if (!active || !payload || !payload.length) return null;

  const valueData = payload.find((p) => p.dataKey === 'value');
  const investedData = payload.find((p) => p.dataKey === 'invested');

  return (
    <div className="bg-white border rounded-lg shadow-lg p-3">
      <p className="text-sm text-gray-500 mb-2">
        {label ? format(parseISO(label), 'dd MMM yyyy', { locale: fr }) : ''}
      </p>
      {valueData && (
        <p className="text-sm">
          <span className="text-gray-600">Valeur: </span>
          <span className="font-medium text-gray-900">
            {formatCurrency(valueData.value, currency)}
          </span>
        </p>
      )}
      {showInvested && investedData && (
        <p className="text-sm">
          <span className="text-gray-600">Investi: </span>
          <span className="font-medium text-gray-500">
            {formatCurrency(investedData.value, currency)}
          </span>
        </p>
      )}
      {valueData && investedData && (
        <p className="text-sm mt-1 pt-1 border-t">
          <span className="text-gray-600">P&L: </span>
          <span
            className={cn(
              'font-medium',
              valueData.value >= investedData.value ? 'text-green-600' : 'text-red-600'
            )}
          >
            {valueData.value >= investedData.value ? '+' : ''}
            {formatCurrency(valueData.value - investedData.value, currency)}
          </span>
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function PerformanceChart({
  data,
  currency = 'EUR',
  showInvested = true,
  height = 300,
  className,
}: PerformanceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');

  // Filter data based on time range
  const filteredData = useMemo(() => {
    const startDate = getStartDate(timeRange);
    if (!startDate) return data;

    return data.filter((point) => {
      const pointDate = parseISO(point.date);
      return pointDate >= startDate;
    });
  }, [data, timeRange]);

  // Calculate performance stats
  const stats = useMemo(() => {
    if (filteredData.length === 0) {
      return { startValue: 0, endValue: 0, change: 0, changePercent: 0 };
    }

    const startValue = filteredData[0].value;
    const endValue = filteredData[filteredData.length - 1].value;
    const change = endValue - startValue;
    const changePercent = startValue > 0 ? (change / startValue) * 100 : 0;

    return { startValue, endValue, change, changePercent };
  }, [filteredData]);

  // Calculate Y axis domain
  const yDomain = useMemo(() => {
    if (filteredData.length === 0) return [0, 100];

    let min = Infinity;
    let max = -Infinity;

    for (const point of filteredData) {
      if (point.value < min) min = point.value;
      if (point.value > max) max = point.value;
      if (showInvested && point.invested !== undefined) {
        if (point.invested < min) min = point.invested;
        if (point.invested > max) max = point.invested;
      }
    }

    const padding = (max - min) * 0.1;
    return [Math.max(0, min - padding), max + padding];
  }, [filteredData, showInvested]);

  // Get chart color based on performance
  const chartColor = stats.change >= 0 ? '#10B981' : '#EF4444';

  if (data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center text-gray-500', className)} style={{ height }}>
        Aucune donnée de performance disponible
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header with stats */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-2xl font-semibold text-gray-900">
            {formatCurrency(stats.endValue, currency)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('text-sm font-medium', stats.change >= 0 ? 'text-green-600' : 'text-red-600')}>
              {stats.change >= 0 ? '+' : ''}
              {formatCurrency(stats.change, currency)}
            </span>
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                stats.change >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              )}
            >
              {stats.changePercent >= 0 ? '+' : ''}
              {stats.changePercent.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Time range selector */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {TIME_RANGES.map((range) => (
            <button
              key={range.key}
              onClick={() => setTimeRange(range.key)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                timeRange === range.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
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
          <LineChart data={filteredData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#9CA3AF' }}
              tickFormatter={(value) => format(parseISO(value), 'dd/MM', { locale: fr })}
              minTickGap={50}
            />
            <YAxis
              domain={yDomain}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#9CA3AF' }}
              tickFormatter={(value) => formatCurrency(value, currency, { compact: true })}
              width={60}
            />
            <Tooltip content={<CustomTooltip currency={currency} showInvested={showInvested} />} />

            {/* Reference line at invested amount (if available) */}
            {showInvested && filteredData.length > 0 && filteredData[0].invested && (
              <ReferenceLine
                y={filteredData[filteredData.length - 1].invested}
                stroke="#9CA3AF"
                strokeDasharray="5 5"
              />
            )}

            {/* Invested line */}
            {showInvested && (
              <Line
                type="monotone"
                dataKey="invested"
                stroke="#9CA3AF"
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
                activeDot={false}
              />
            )}

            {/* Value line */}
            <Line
              type="monotone"
              dataKey="value"
              stroke={chartColor}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: chartColor }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      {showInvested && (
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5" style={{ backgroundColor: chartColor }} />
            <span className="text-xs text-gray-600">Valeur du portefeuille</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 border-t border-dashed border-gray-400" />
            <span className="text-xs text-gray-600">Montant investi</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default PerformanceChart;
