// ============================================================================
// CATEGORY CHART - Finance Hub
// Uses full Catppuccin color palette for categories
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
// Catppuccin Colors - All 14 accent colors
// Uses CSS variables to support all 4 Catppuccin themes
// ----------------------------------------------------------------------------

const CATPPUCCIN_COLORS = [
  'bg-ctp-blue',      // Blue - primary
  'bg-ctp-green',     // Green - success
  'bg-ctp-peach',     // Peach - warm accent
  'bg-ctp-mauve',     // Mauve - purple
  'bg-ctp-teal',      // Teal - cool accent
  'bg-ctp-pink',      // Pink - soft accent
  'bg-ctp-yellow',    // Yellow - highlight
  'bg-ctp-sapphire',  // Sapphire - secondary blue
  'bg-ctp-red',       // Red - danger
  'bg-ctp-lavender',  // Lavender - soft purple
  'bg-ctp-sky',       // Sky - info
  'bg-ctp-flamingo',  // Flamingo - warm pink
  'bg-ctp-maroon',    // Maroon - deep red
  'bg-ctp-rosewater', // Rosewater - subtle
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
      <div className="bg-ctp-surface0 rounded-xl p-5 border border-ctp-surface1">
        <h3 className="text-lg font-semibold text-ctp-text mb-4">{title}</h3>
        <div className="flex flex-col items-center justify-center h-48 bg-ctp-mantle rounded-lg">
          <div className="w-12 h-12 bg-ctp-surface1 rounded-full flex items-center justify-center mb-3">
            <span className="text-2xl text-ctp-overlay1">--</span>
          </div>
          <p className="text-ctp-subtext0">Aucune donnee pour cette periode</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ctp-surface0 rounded-xl p-5 border border-ctp-surface1">
      <h3 className="text-lg font-semibold text-ctp-text mb-4">{title}</h3>

      {/* Bar visualization */}
      <div className="flex h-5 rounded-full overflow-hidden mb-6 shadow-inner bg-ctp-mantle">
        {categoriesWithPercent.map((cat, index) => (
          <div
            key={cat.categoryId ?? 'uncategorized'}
            className={clsx(
              CATPPUCCIN_COLORS[index % CATPPUCCIN_COLORS.length],
              'transition-all duration-300 hover:opacity-80'
            )}
            style={{ width: `${cat.percentage}%` }}
            title={`${cat.categoryName}: ${formatCurrency(cat.total)}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {categoriesWithPercent.map((cat, index) => (
          <div
            key={cat.categoryId ?? 'uncategorized'}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-ctp-mantle transition-colors"
          >
            <div className="flex items-center gap-2">
              <div
                className={clsx(
                  'w-3 h-3 rounded-full',
                  CATPPUCCIN_COLORS[index % CATPPUCCIN_COLORS.length]
                )}
              />
              <span className="text-sm text-ctp-text truncate max-w-[150px]">
                {cat.categoryName}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-ctp-subtext0 bg-ctp-mantle px-2 py-0.5 rounded">
                {cat.percentage?.toFixed(1)}%
              </span>
              <span className="text-sm font-semibold text-ctp-red w-24 text-right">
                {formatCurrency(cat.total)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="mt-4 pt-4 border-t border-ctp-surface1 flex justify-between items-center">
        <span className="font-medium text-ctp-text">Total</span>
        <span className="font-bold text-lg text-ctp-red">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

export default CategoryChart;
