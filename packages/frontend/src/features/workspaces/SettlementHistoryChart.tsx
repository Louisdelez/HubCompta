// ============================================================================
// SETTLEMENT HISTORY CHART - Finance Hub
// Bar chart showing expense trends
// ============================================================================

import { useMemo } from 'react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface HistoryEntry {
  period: string;
  totalExpenses: number;
  settled: boolean;
}

interface SettlementHistoryChartProps {
  data: HistoryEntry[];
  currency?: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SettlementHistoryChart({ data, currency = 'EUR' }: SettlementHistoryChartProps) {
  // Reverse data to show oldest first (left to right)
  const chartData = useMemo(() => [...data].reverse(), [data]);

  // Calculate max value for scaling
  const maxValue = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.totalExpenses));
    return max > 0 ? max : 1; // Avoid division by zero
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400">
        Aucune donnee
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="h-48 flex items-end gap-2">
        {chartData.map((entry, index) => {
          const height = (entry.totalExpenses / maxValue) * 100;
          const isCurrentMonth = index === chartData.length - 1;

          return (
            <div
              key={entry.period}
              className="flex-1 flex flex-col items-center gap-2"
            >
              {/* Bar */}
              <div className="w-full flex flex-col items-center justify-end h-40">
                <div
                  className={`w-full max-w-12 rounded-t-lg transition-all duration-300 ${
                    isCurrentMonth
                      ? 'bg-primary-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  style={{ height: `${Math.max(height, 2)}%` }}
                  title={`${entry.period}: ${formatCurrency(entry.totalExpenses, currency)}`}
                />
              </div>

              {/* Label */}
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-16">
                  {entry.period.split(' ')[0]?.substring(0, 3)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded" />
          <span className="text-gray-500 dark:text-gray-400">Mois passes</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-primary-500 rounded" />
          <span className="text-gray-500 dark:text-gray-400">Mois en cours</span>
        </div>
      </div>

      {/* Average line info */}
      {chartData.length > 1 && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <span>
            Moyenne:{' '}
            <span className="font-medium">
              {formatCurrency(
                chartData.reduce((sum, d) => sum + d.totalExpenses, 0) / chartData.length,
                currency
              )}
            </span>{' '}
            / mois
          </span>
        </div>
      )}
    </div>
  );
}

export default SettlementHistoryChart;
