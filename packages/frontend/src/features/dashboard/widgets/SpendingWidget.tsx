// ============================================================================
// SPENDING WIDGET - Finance Hub Dashboard
// Displays spending by category chart
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import type { WidgetProps } from './index';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface CategorySpending {
  categoryId: string | null;
  categoryName: string;
  total: number;
  percentage?: number;
}

// ----------------------------------------------------------------------------
// Catppuccin Colors
// ----------------------------------------------------------------------------

const CATPPUCCIN_COLORS = [
  'bg-ctp-blue',
  'bg-ctp-green',
  'bg-ctp-peach',
  'bg-ctp-mauve',
  'bg-ctp-teal',
  'bg-ctp-pink',
  'bg-ctp-yellow',
  'bg-ctp-sapphire',
];

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SpendingWidget({ workspaceId }: WidgetProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['spending-widget', workspaceId],
    queryFn: () =>
      api.get<{ spendingByCategory: CategorySpending[] }>(
        `/workspaces/${workspaceId}/reports/summary`
      ),
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="animate-pulse flex-1">
          <div className="h-4 bg-ctp-surface1 rounded-full mb-4" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 bg-ctp-surface1 rounded-full" />
                <div className="flex-1 h-3 bg-ctp-surface1 rounded" />
                <div className="w-16 h-3 bg-ctp-surface1 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const categories = data?.spendingByCategory ?? [];
  const total = categories.reduce((sum, cat) => sum + cat.total, 0);

  // Get top categories and group the rest as "Other"
  const topCategories = categories.slice(0, 6);
  const otherTotal = categories.slice(6).reduce((sum, cat) => sum + cat.total, 0);

  if (otherTotal > 0) {
    topCategories.push({
      categoryId: 'other',
      categoryName: t('widgets.spending.other'),
      total: otherTotal,
    });
  }

  const categoriesWithPercent = topCategories.map((cat) => ({
    ...cat,
    percentage: total > 0 ? (cat.total / total) * 100 : 0,
  }));

  return (
    <div className="h-full flex flex-col">
      {categories.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <BarChart3 className="w-10 h-10 text-ctp-overlay1 mb-2" />
          <p className="text-sm text-ctp-subtext0">{t('widgets.spending.noData')}</p>
        </div>
      ) : (
        <>
          {/* Bar Visualization */}
          <div className="flex h-4 rounded-full overflow-hidden mb-4 bg-ctp-mantle">
            {categoriesWithPercent.map((cat, index) => (
              <div
                key={cat.categoryId ?? 'uncategorized'}
                className={clsx(
                  CATPPUCCIN_COLORS[index % CATPPUCCIN_COLORS.length],
                  'transition-all hover:opacity-80'
                )}
                style={{ width: `${cat.percentage}%` }}
                title={`${cat.categoryName}: ${formatCurrency(cat.total)}`}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
            {categoriesWithPercent.map((cat, index) => (
              <div
                key={cat.categoryId ?? 'uncategorized'}
                className="flex items-center justify-between p-1.5 rounded hover:bg-ctp-mantle transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={clsx(
                      'w-2.5 h-2.5 rounded-full flex-shrink-0',
                      CATPPUCCIN_COLORS[index % CATPPUCCIN_COLORS.length]
                    )}
                  />
                  <span className="text-sm text-ctp-text truncate">
                    {cat.categoryName}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-ctp-subtext0 bg-ctp-mantle px-1.5 py-0.5 rounded">
                    {cat.percentage?.toFixed(0)}%
                  </span>
                  <span className="text-sm font-semibold text-ctp-red w-20 text-right">
                    {formatCurrency(cat.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-2 pt-2 border-t border-ctp-surface1 flex justify-between items-center">
            <span className="text-sm font-medium text-ctp-text">{t('widgets.spending.total')}</span>
            <span className="font-bold text-ctp-red">{formatCurrency(total)}</span>
          </div>
        </>
      )}

      {/* View All Link */}
      <Link
        to="/reports"
        className="mt-2 text-center text-xs text-ctp-blue hover:text-ctp-sapphire transition-colors"
      >
        {t('widgets.spending.viewReports')}
      </Link>
    </div>
  );
}

export default SpendingWidget;
