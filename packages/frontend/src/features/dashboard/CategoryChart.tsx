// ============================================================================
// CATEGORY CHART - Finance Hub
// ============================================================================

import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface CategoryData {
  categoryId: string | null;
  categoryName: string;
  total: number;
  percentage?: number;
}

interface CategoryChartProps {
  categories: CategoryData[];
  title: string;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const COLORS = [
  'bg-primary-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
];

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function CategoryChart({ categories, title }: CategoryChartProps) {
  const total = categories.reduce((sum, cat) => sum + cat.total, 0);
  const topCategories = categories.slice(0, 7);
  const otherTotal = categories.slice(7).reduce((sum, cat) => sum + cat.total, 0);

  if (otherTotal > 0) {
    topCategories.push({
      categoryId: 'other',
      categoryName: 'Autres',
      total: otherTotal,
    });
  }

  const categoriesWithPercent = topCategories.map((cat) => ({
    ...cat,
    percentage: total > 0 ? (cat.total / total) * 100 : 0,
  }));

  if (categories.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48 text-gray-400">
          <p>Aucune donnée pour cette période</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>

      {/* Bar visualization */}
      <div className="flex h-4 rounded-full overflow-hidden mb-6">
        {categoriesWithPercent.map((cat, index) => (
          <div
            key={cat.categoryId ?? 'uncategorized'}
            className={clsx(COLORS[index % COLORS.length])}
            style={{ width: `${cat.percentage}%` }}
            title={`${cat.categoryName}: ${formatCurrency(cat.total)}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="space-y-3">
        {categoriesWithPercent.map((cat, index) => (
          <div
            key={cat.categoryId ?? 'uncategorized'}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <div
                className={clsx('w-3 h-3 rounded-full', COLORS[index % COLORS.length])}
              />
              <span className="text-sm truncate max-w-[150px]">
                {cat.categoryName}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {cat.percentage?.toFixed(1)}%
              </span>
              <span className="text-sm font-medium w-24 text-right">
                {formatCurrency(cat.total)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
        <span className="font-medium">Total</span>
        <span className="font-bold">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

export default CategoryChart;
