// ============================================================================
// ALLOCATION CHART COMPONENT - Finance Hub
// Pie chart showing portfolio allocation by type/currency
// ============================================================================

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface AllocationItem {
  name: string;
  value: number;
  percent: number;
  color?: string;
}

interface AllocationChartProps {
  data: AllocationItem[];
  title?: string;
  currency?: string;
  showLegend?: boolean;
  className?: string;
}

// ----------------------------------------------------------------------------
// Colors
// ----------------------------------------------------------------------------

const CHART_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#6366F1', // indigo
  '#84CC16', // lime
  '#F97316', // orange
];

const TYPE_COLORS: Record<string, string> = {
  stock: '#3B82F6', // blue
  etf: '#8B5CF6', // violet
  crypto: '#F59E0B', // amber
  bond: '#10B981', // green
  commodity: '#EC4899', // pink
  other: '#6B7280', // gray
};

// ----------------------------------------------------------------------------
// Custom Tooltip
// ----------------------------------------------------------------------------

interface TooltipPayload {
  name: string;
  value: number;
  payload: AllocationItem;
}

function CustomTooltip({
  active,
  payload,
  currency = 'EUR',
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  currency?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const firstPayload = payload[0];
  if (!firstPayload) return null;
  const data = firstPayload.payload;

  return (
    <div className="bg-white border rounded-lg shadow-lg p-3">
      <p className="font-medium text-gray-900">{data.name}</p>
      <p className="text-sm text-gray-600">{formatCurrency(data.value, currency)}</p>
      <p className="text-sm text-gray-500">{formatPercent(data.percent)}</p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Legend Renderer
// ----------------------------------------------------------------------------

interface LegendPayload {
  value: string;
  color: string;
  payload: {
    name: string;
    value: number;
    percent: number;
  };
}

function renderLegend(props: { payload?: LegendPayload[] }) {
  const { payload } = props;
  if (!payload) return null;

  return (
    <ul className="flex flex-wrap justify-center gap-4 mt-4">
      {payload.map((entry, index) => (
        <li key={`legend-${index}`} className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-gray-600">
            {entry.value} ({formatPercent(entry.payload.percent)})
          </span>
        </li>
      ))}
    </ul>
  );
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AllocationChart({
  data,
  title,
  currency = 'EUR',
  showLegend = true,
  className,
}: AllocationChartProps) {
  // Prepare chart data with colors
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      color: item.color || TYPE_COLORS[item.name.toLowerCase()] || CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [data]);

  const total = useMemo(() => {
    return data.reduce((sum, item) => sum + item.value, 0);
  }, [data]);

  if (data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-64 text-gray-500', className)}>
        Aucune donnée disponible
      </div>
    );
  }

  return (
    <div className={className}>
      {title && <h3 className="text-sm font-medium text-gray-700 mb-4">{title}</h3>}

      <div className="relative h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip currency={currency} />} />
            {showLegend && <Legend content={(props) => renderLegend(props as unknown as { payload?: LegendPayload[] })} />}
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-lg font-semibold text-gray-900">{formatCurrency(total, currency)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Simple Legend List (alternative display)
// ----------------------------------------------------------------------------

export function AllocationLegend({
  data,
  currency = 'EUR',
  className,
}: {
  data: AllocationItem[];
  currency?: string;
  className?: string;
}) {
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      color: item.color || TYPE_COLORS[item.name.toLowerCase()] || CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [data]);

  return (
    <ul className={cn('space-y-2', className)}>
      {chartData.map((item, index) => (
        <li key={index} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-sm text-gray-700">{item.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(item.value, currency)}
            </span>
            <span className="text-sm text-gray-500 w-14 text-right">
              {formatPercent(item.percent)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default AllocationChart;
