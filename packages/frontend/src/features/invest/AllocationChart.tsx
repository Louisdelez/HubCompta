// ============================================================================
// ALLOCATION CHART COMPONENT - Finance Hub
// Pie chart showing portfolio allocation by type/currency
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import { useTheme } from '@/providers/ThemeProvider';
import { CATPPUCCIN } from '@/lib/catppuccin-colors';

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
// Catppuccin Color Helper
// Returns hex colors based on current theme
// ----------------------------------------------------------------------------

function rgbToHex(rgb: string): string {
  const parts = rgb.split(' ').map(Number);
  return '#' + parts.map(n => n.toString(16).padStart(2, '0')).join('');
}

function useCatppuccinColors() {
  const { resolvedTheme } = useTheme();
  const palette = CATPPUCCIN[resolvedTheme];

  return useMemo(() => ({
    // Chart colors - all 14 accent colors
    chartColors: [
      rgbToHex(palette.blue),
      rgbToHex(palette.green),
      rgbToHex(palette.peach),
      rgbToHex(palette.mauve),
      rgbToHex(palette.teal),
      rgbToHex(palette.pink),
      rgbToHex(palette.yellow),
      rgbToHex(palette.sapphire),
      rgbToHex(palette.red),
      rgbToHex(palette.lavender),
      rgbToHex(palette.sky),
      rgbToHex(palette.flamingo),
      rgbToHex(palette.maroon),
      rgbToHex(palette.rosewater),
    ],
    // Type-specific colors
    typeColors: {
      stock: rgbToHex(palette.blue),
      etf: rgbToHex(palette.sapphire),
      crypto: rgbToHex(palette.peach),
      bond: rgbToHex(palette.lavender),
      fund: rgbToHex(palette.mauve),
      commodity: rgbToHex(palette.yellow),
      forex: rgbToHex(palette.green),
      other: rgbToHex(palette.overlay1),
      actions: rgbToHex(palette.blue),
    } as Record<string, string>,
    // Semantic colors
    surface: rgbToHex(palette.surface0),
    text: rgbToHex(palette.text),
    subtext: rgbToHex(palette.subtext0),
  }), [resolvedTheme, palette]);
}

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
    <div className="bg-ctp-surface0 border border-ctp-surface1 rounded-lg shadow-lg p-3">
      <p className="font-medium text-ctp-text">{data.name}</p>
      <p className="text-sm text-ctp-subtext0">{formatCurrency(data.value, currency)}</p>
      <p className="text-sm text-ctp-overlay1">{formatPercent(data.percent)}</p>
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
          <span className="text-sm text-ctp-subtext0">
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
  const colors = useCatppuccinColors();

  // Prepare chart data with Catppuccin colors
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      color: item.color || colors.typeColors[item.name.toLowerCase()] || colors.chartColors[index % colors.chartColors.length],
    }));
  }, [data, colors]);

  const total = useMemo(() => {
    return data.reduce((sum, item) => sum + item.value, 0);
  }, [data]);

  if (data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-64 text-ctp-overlay1', className)}>
        Aucune donnée disponible
      </div>
    );
  }

  return (
    <div className={className}>
      {title && <h3 className="text-sm font-medium text-ctp-subtext1 mb-4">{title}</h3>}

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
            <p className="text-sm text-ctp-overlay1">Total</p>
            <p className="text-lg font-semibold text-ctp-text">{formatCurrency(total, currency)}</p>
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
  const colors = useCatppuccinColors();

  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      color: item.color || colors.typeColors[item.name.toLowerCase()] || colors.chartColors[index % colors.chartColors.length],
    }));
  }, [data, colors]);

  return (
    <ul className={cn('space-y-2', className)}>
      {chartData.map((item, index) => (
        <li key={index} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-sm text-ctp-subtext1">{item.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-ctp-text">
              {formatCurrency(item.value, currency)}
            </span>
            <span className="text-sm text-ctp-overlay1 w-14 text-right">
              {formatPercent(item.percent)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default AllocationChart;
