// ============================================================================
// CATEGORY TRENDS REPORT - Finance Hub
// Track spending trends by category over time
// ============================================================================

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import {
  Minus,
  Loader2,
  Folder,
  ArrowUpRight,
  ArrowDownRight,
  Download,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { clsx } from 'clsx';

interface CategoryTrend {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  data: Array<{
    month: number;
    year: number;
    amount: number;
  }>;
  average: number;
  total: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

interface CategoryTrendsResponse {
  categories: CategoryTrend[];
  months: Array<{ month: number; year: number }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

const CHART_COLORS = [
  'var(--ctp-blue)',
  'var(--ctp-green)',
  'var(--ctp-yellow)',
  'var(--ctp-red)',
  'var(--ctp-mauve)',
  'var(--ctp-pink)',
  'var(--ctp-teal)',
  'var(--ctp-lavender)',
];

export function CategoryTrendsReport() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'fr' ? fr : enUS;
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const [period, setPeriod] = useState<'6m' | '12m'>('6m');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const months = period === '6m' ? 6 : 12;

  const handleExportPDF = async () => {
    if (!workspaceId) return;
    setIsExporting(true);

    try {
      const baseUrl = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '/api/v1';
      const token = localStorage.getItem('accessToken');

      const response = await fetch(
        `${baseUrl}/workspaces/${workspaceId}/reports/export-pdf/category-trends?months=${months}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tendances_categories_${months}m.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert(t('reports.pdfExport.error'));
    } finally {
      setIsExporting(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['reports', workspaceId, 'category-trends', period],
    queryFn: () =>
      api.get<CategoryTrendsResponse>(
        `/workspaces/${workspaceId}/reports/category-trends-report?months=${months}`
      ),
    enabled: !!workspaceId,
  });

  // Build chart data
  const chartData = data?.months.map((m) => {
    const point: Record<string, number | string> = {
      name: format(new Date(m.year, m.month - 1), 'MMM yy', { locale: dateLocale }),
    };
    data.categories.forEach((cat) => {
      if (selectedCategories.size === 0 || selectedCategories.has(cat.categoryId)) {
        const monthData = cat.data.find(
          (d) => d.month === m.month && d.year === m.year
        );
        point[cat.categoryName] = monthData?.amount ?? 0;
      }
    });
    return point;
  });

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const displayedCategories =
    selectedCategories.size > 0
      ? data?.categories.filter((c) => selectedCategories.has(c.categoryId))
      : data?.categories.slice(0, 5);

  if (!workspaceId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="card p-8 text-center">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-ctp-blue mb-4" />
        <p className="text-ctp-subtext0">{t('reports.categoryTrendsReport.loading')}</p>
      </div>
    );
  }

  if (!data || data.categories.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Folder className="w-12 h-12 mx-auto text-ctp-overlay1 mb-4" />
        <h3 className="text-lg font-semibold mb-2">{t('reports.categoryTrendsReport.noData')}</h3>
        <p className="text-ctp-subtext0">
          {t('reports.categoryTrendsReport.notEnoughData')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-lg font-semibold">{t('reports.categoryTrendsReport.trendsByCategory')}</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg',
              'bg-ctp-red/10 text-ctp-red hover:bg-ctp-red/20',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {t('reports.pdfExport.exportPdf')}
          </button>
          <div className="flex gap-1 bg-ctp-surface0 rounded-lg p-1">
            <button
              onClick={() => setPeriod('6m')}
              className={clsx(
                'px-3 py-1 text-sm rounded-md transition-colors',
                period === '6m'
                  ? 'bg-ctp-surface1 text-ctp-text'
                  : 'text-ctp-subtext0 hover:text-ctp-text'
              )}
            >
              {t('reports.categoryTrendsReport.period6m')}
            </button>
            <button
              onClick={() => setPeriod('12m')}
              className={clsx(
                'px-3 py-1 text-sm rounded-md transition-colors',
                period === '12m'
                  ? 'bg-ctp-surface1 text-ctp-text'
                  : 'text-ctp-subtext0 hover:text-ctp-text'
              )}
            >
              {t('reports.categoryTrendsReport.period12m')}
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {data.categories.map((cat, index) => (
          <button
            key={cat.categoryId}
            onClick={() => toggleCategory(cat.categoryId)}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors',
              selectedCategories.has(cat.categoryId) ||
                (selectedCategories.size === 0 && index < 5)
                ? 'bg-ctp-surface1 text-ctp-text'
                : 'bg-ctp-surface0 text-ctp-subtext0 hover:bg-ctp-surface1'
            )}
          >
            {cat.categoryIcon && <span>{cat.categoryIcon}</span>}
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor:
                  cat.categoryColor ?? CHART_COLORS[index % CHART_COLORS.length],
              }}
            />
            {cat.categoryName}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="card">
        <h3 className="font-semibold mb-4">{t('reports.categoryTrendsReport.spendingEvolution')}</h3>
        {chartData && chartData.length > 0 && displayedCategories ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-ctp-surface1" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  className="fill-ctp-subtext0"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="fill-ctp-subtext0"
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'var(--ctp-surface0)',
                    borderColor: 'var(--ctp-surface1)',
                  }}
                />
                <Legend />
                {displayedCategories.map((cat, index) => (
                  <Line
                    key={cat.categoryId}
                    type="monotone"
                    dataKey={cat.categoryName}
                    stroke={cat.categoryColor ?? CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center text-ctp-subtext0">
            {t('reports.categoryTrendsReport.selectCategories')}
          </div>
        )}
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.categories.map((cat, index) => (
          <div
            key={cat.categoryId}
            className={clsx(
              'card cursor-pointer transition-all',
              selectedCategories.has(cat.categoryId) && 'ring-2 ring-ctp-blue'
            )}
            onClick={() => toggleCategory(cat.categoryId)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {cat.categoryIcon && <span className="text-xl">{cat.categoryIcon}</span>}
                <span className="font-medium text-ctp-text">{cat.categoryName}</span>
              </div>
              <span
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor:
                    cat.categoryColor ?? CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-ctp-subtext0">Moyenne</p>
                <p className="text-lg font-semibold text-ctp-text">
                  {formatCurrency(cat.average)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ctp-subtext0">Total</p>
                <p className="text-lg font-semibold text-ctp-text">
                  {formatCurrency(cat.total)}
                </p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-ctp-surface1 flex items-center justify-between">
              <span className="text-sm text-ctp-subtext0">Tendance</span>
              <div
                className={clsx(
                  'flex items-center gap-1 text-sm font-medium',
                  cat.trend === 'up'
                    ? 'text-ctp-red'
                    : cat.trend === 'down'
                    ? 'text-ctp-green'
                    : 'text-ctp-subtext0'
                )}
              >
                {cat.trend === 'up' ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : cat.trend === 'down' ? (
                  <ArrowDownRight className="w-4 h-4" />
                ) : (
                  <Minus className="w-4 h-4" />
                )}
                {cat.trendPercent > 0 ? '+' : ''}
                {cat.trendPercent.toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CategoryTrendsReport;
