// ============================================================================
// SETTLEMENT HISTORY CHART - Finance Hub
// Bar chart showing expense trends using recharts
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
  ReferenceLine,
  Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTheme } from '@/providers/ThemeProvider';
import { CATPPUCCIN } from '@/lib/catppuccin-colors';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface MemberBreakdown {
  userId: string;
  userName: string;
  spent: number;
  owes: number;
}

interface MonthData {
  month: string;
  totalExpenses: number;
  memberBreakdown: MemberBreakdown[];
}

interface SettlementHistoryChartProps {
  data: MonthData[];
  currency?: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

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
      blue: rgbToHex(palette.blue),
      green: rgbToHex(palette.green),
      peach: rgbToHex(palette.peach),
      mauve: rgbToHex(palette.mauve),
      teal: rgbToHex(palette.teal),
      pink: rgbToHex(palette.pink),
      yellow: rgbToHex(palette.yellow),
      sapphire: rgbToHex(palette.sapphire),
      red: rgbToHex(palette.red),
      lavender: rgbToHex(palette.lavender),
      sky: rgbToHex(palette.sky),
      flamingo: rgbToHex(palette.flamingo),
      overlay1: rgbToHex(palette.overlay1),
      surface1: rgbToHex(palette.surface1),
      subtext0: rgbToHex(palette.subtext0),
      text: rgbToHex(palette.text),
    }),
    [palette]
  );
}

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMonthLabel(month: string): string {
  try {
    // month is in format "2026-01"
    const date = parseISO(`${month}-01`);
    return format(date, 'MMM', { locale: fr });
  } catch {
    return month;
  }
}

// ----------------------------------------------------------------------------
// Custom Tooltip
// ----------------------------------------------------------------------------

interface TooltipPayload {
  value: number;
  dataKey: string;
  name: string;
  color: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  currency?: string;
}

function CustomTooltip({ active, payload, label, currency = 'EUR' }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;

  // Format the month label
  let monthLabel = label || '';
  try {
    if (label) {
      const date = parseISO(`${label}-01`);
      monthLabel = format(date, 'MMMM yyyy', { locale: fr });
    }
  } catch {
    monthLabel = label || '';
  }

  // Calculate total
  const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);

  return (
    <div className="bg-ctp-surface0 border border-ctp-surface1 rounded-lg shadow-lg p-3 min-w-[180px]">
      <p className="text-sm font-medium text-ctp-text mb-2 capitalize">{monthLabel}</p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-ctp-subtext0">{entry.name}</span>
            </div>
            <span className="font-medium text-ctp-text">
              {formatCurrency(entry.value, currency)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-ctp-surface1 flex justify-between text-sm">
        <span className="text-ctp-subtext0">Total</span>
        <span className="font-semibold text-ctp-text">
          {formatCurrency(total, currency)}
        </span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SettlementHistoryChart({
  data,
  currency = 'EUR',
}: SettlementHistoryChartProps) {
  const colors = useCatppuccinChartColors();

  // Transform data for stacked bar chart - reverse to show oldest first (left to right)
  const chartData = useMemo(() => {
    // Get all unique members across all months
    const allMembers = new Map<string, string>();
    for (const monthData of data) {
      for (const member of monthData.memberBreakdown) {
        if (!allMembers.has(member.userId)) {
          allMembers.set(member.userId, member.userName);
        }
      }
    }

    // Transform data to include all members for each month
    return [...data].reverse().map((monthData) => {
      const result: Record<string, number | string> = {
        month: monthData.month,
        total: monthData.totalExpenses,
      };

      // Initialize all members to 0
      for (const [userId] of allMembers) {
        result[userId] = 0;
      }

      // Fill in actual values
      for (const member of monthData.memberBreakdown) {
        result[member.userId] = member.spent;
      }

      return result;
    });
  }, [data]);

  // Get unique members for bars
  const members = useMemo(() => {
    const memberMap = new Map<string, string>();
    for (const monthData of data) {
      for (const member of monthData.memberBreakdown) {
        if (!memberMap.has(member.userId)) {
          memberMap.set(member.userId, member.userName);
        }
      }
    }
    return Array.from(memberMap.entries()).map(([userId, userName]) => ({
      userId,
      userName,
    }));
  }, [data]);

  // Calculate average for reference line
  const average = useMemo(() => {
    if (data.length === 0) return 0;
    return data.reduce((sum, d) => sum + d.totalExpenses, 0) / data.length;
  }, [data]);

  // Bar colors - cycle through Catppuccin accent colors
  const barColors = [
    colors.blue,
    colors.green,
    colors.peach,
    colors.mauve,
    colors.teal,
    colors.pink,
    colors.yellow,
    colors.sapphire,
    colors.lavender,
    colors.sky,
    colors.flamingo,
  ];

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-ctp-overlay1">
        Aucune donnee
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={colors.surface1}
            vertical={false}
          />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: colors.subtext0 }}
            tickFormatter={formatMonthLabel}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: colors.subtext0 }}
            tickFormatter={(value) => formatCurrency(value, currency)}
            width={70}
          />
          <Tooltip
            content={<CustomTooltip currency={currency} />}
            cursor={{ fill: colors.surface1, opacity: 0.3 }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            formatter={(value) => <span className="text-ctp-subtext0">{value}</span>}
          />

          {/* Average reference line */}
          {average > 0 && (
            <ReferenceLine
              y={average}
              stroke={colors.overlay1}
              strokeDasharray="5 5"
              label={{
                value: `Moy: ${formatCurrency(average, currency)}`,
                position: 'insideTopRight',
                fill: colors.subtext0,
                fontSize: 11,
              }}
            />
          )}

          {/* Stacked bars for each member */}
          {members.map((member, index) => (
            <Bar
              key={member.userId}
              dataKey={member.userId}
              name={member.userName}
              stackId="expenses"
              fill={barColors[index % barColors.length]}
              radius={
                index === members.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]
              }
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SettlementHistoryChart;
