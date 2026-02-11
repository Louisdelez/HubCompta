// ============================================================================
// YEAR COMPARISON REPORT - Finance Hub
// Compare current year vs previous year
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Loader2,
  Calendar,
  Download,
} from 'lucide-react';
import {
  BarChart,
  Bar,
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

interface MonthlyComparison {
  month: number;
  currentYear: {
    income: number;
    expenses: number;
    net: number;
  };
  previousYear: {
    income: number;
    expenses: number;
    net: number;
  };
}

interface CategoryComparison {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  currentYear: number;
  previousYear: number;
  change: number;
  changePercent: number;
}

interface YearComparisonResponse {
  currentYear: number;
  previousYear: number;
  summary: {
    currentYear: { income: number; expenses: number; net: number; savingsRate: number };
    previousYear: { income: number; expenses: number; net: number; savingsRate: number };
    changes: {
      income: number;
      incomePercent: number;
      expenses: number;
      expensesPercent: number;
      net: number;
      netPercent: number;
    };
  };
  monthly: MonthlyComparison[];
  categories: CategoryComparison[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function ChangeIndicator({ value, inverse = false }: { value: number; inverse?: boolean }) {
  const isPositive = inverse ? value < 0 : value > 0;
  const isNegative = inverse ? value > 0 : value < 0;

  if (value === 0) {
    return (
      <span className="flex items-center gap-1 text-ctp-subtext0">
        <Minus className="w-4 h-4" />
        0%
      </span>
    );
  }

  return (
    <span
      className={clsx(
        'flex items-center gap-1',
        isPositive ? 'text-ctp-green' : isNegative ? 'text-ctp-red' : 'text-ctp-subtext0'
      )}
    >
      {isPositive ? (
        <ArrowUpRight className="w-4 h-4" />
      ) : (
        <ArrowDownRight className="w-4 h-4" />
      )}
      {value > 0 ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  );
}

export function YearComparisonReport() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const currentYear = new Date().getFullYear();
  const [compareYear, setCompareYear] = useState(currentYear - 1);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!workspaceId) return;
    setIsExporting(true);

    try {
      const baseUrl = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '/api/v1';
      const token = localStorage.getItem('accessToken');

      const response = await fetch(
        `${baseUrl}/workspaces/${workspaceId}/reports/export-pdf/year-comparison?year=${compareYear}`,
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
      link.download = `comparaison_${currentYear}_vs_${compareYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert("Erreur lors de l'export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['reports', workspaceId, 'year-comparison', compareYear],
    queryFn: () =>
      api.get<YearComparisonResponse>(
        `/workspaces/${workspaceId}/reports/year-comparison?year=${compareYear}`
      ),
    enabled: !!workspaceId,
  });

  const chartData = data?.monthly.map((m) => ({
    name: format(new Date(currentYear, m.month - 1), 'MMM', { locale: fr }),
    [`${currentYear}`]: m.currentYear.net,
    [`${compareYear}`]: m.previousYear.net,
  }));

  if (!workspaceId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="card p-8 text-center">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-ctp-blue mb-4" />
        <p className="text-ctp-subtext0">Chargement de la comparaison...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card p-8 text-center">
        <Calendar className="w-12 h-12 mx-auto text-ctp-overlay1 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Aucune donnee</h3>
        <p className="text-ctp-subtext0">
          Pas assez de donnees pour comparer les annees
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-lg font-semibold">
          {currentYear} vs {compareYear}
        </h2>
        <div className="flex items-center gap-3">
          <select
            value={compareYear}
            onChange={(e) => setCompareYear(parseInt(e.target.value))}
            className="input-select w-32"
          >
            {[...Array(5)].map((_, i) => {
              const year = currentYear - 1 - i;
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              );
            })}
          </select>
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
            Exporter PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Income */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-ctp-green" />
            <span className="text-sm text-ctp-subtext0">Revenus</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-ctp-subtext0">{currentYear}</p>
              <p className="text-xl font-bold text-ctp-text">
                {formatCurrency(data.summary.currentYear.income)}
              </p>
            </div>
            <div>
              <p className="text-xs text-ctp-subtext0">{compareYear}</p>
              <p className="text-xl font-bold text-ctp-subtext0">
                {formatCurrency(data.summary.previousYear.income)}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-ctp-surface1">
            <ChangeIndicator value={data.summary.changes.incomePercent} />
          </div>
        </div>

        {/* Expenses */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-5 h-5 text-ctp-red" />
            <span className="text-sm text-ctp-subtext0">Depenses</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-ctp-subtext0">{currentYear}</p>
              <p className="text-xl font-bold text-ctp-text">
                {formatCurrency(data.summary.currentYear.expenses)}
              </p>
            </div>
            <div>
              <p className="text-xs text-ctp-subtext0">{compareYear}</p>
              <p className="text-xl font-bold text-ctp-subtext0">
                {formatCurrency(data.summary.previousYear.expenses)}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-ctp-surface1">
            <ChangeIndicator value={data.summary.changes.expensesPercent} inverse />
          </div>
        </div>

        {/* Net */}
        <div className="card bg-gradient-to-br from-ctp-blue/10 to-ctp-mauve/10">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-ctp-blue" />
            <span className="text-sm text-ctp-subtext0">Epargne nette</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-ctp-subtext0">{currentYear}</p>
              <p
                className={clsx(
                  'text-xl font-bold',
                  data.summary.currentYear.net >= 0
                    ? 'text-ctp-green'
                    : 'text-ctp-red'
                )}
              >
                {data.summary.currentYear.net >= 0 ? '+' : ''}
                {formatCurrency(data.summary.currentYear.net)}
              </p>
            </div>
            <div>
              <p className="text-xs text-ctp-subtext0">{compareYear}</p>
              <p
                className={clsx(
                  'text-xl font-bold',
                  data.summary.previousYear.net >= 0
                    ? 'text-ctp-green/60'
                    : 'text-ctp-red/60'
                )}
              >
                {data.summary.previousYear.net >= 0 ? '+' : ''}
                {formatCurrency(data.summary.previousYear.net)}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-ctp-surface1">
            <ChangeIndicator value={data.summary.changes.netPercent} />
          </div>
        </div>
      </div>

      {/* Monthly Comparison Chart */}
      <div className="card">
        <h3 className="font-semibold mb-4">Comparaison mensuelle - Epargne nette</h3>
        {chartData && chartData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
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
                <Bar
                  dataKey={`${currentYear}`}
                  name={`${currentYear}`}
                  fill="var(--ctp-blue)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey={`${compareYear}`}
                  name={`${compareYear}`}
                  fill="var(--ctp-overlay1)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center text-ctp-subtext0">
            Pas assez de donnees
          </div>
        )}
      </div>

      {/* Category Comparison */}
      <div className="card">
        <h3 className="font-semibold mb-4">Comparaison par categorie</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ctp-surface1">
                <th className="text-left text-xs font-medium text-ctp-subtext0 py-2">
                  Categorie
                </th>
                <th className="text-right text-xs font-medium text-ctp-subtext0 py-2">
                  {currentYear}
                </th>
                <th className="text-right text-xs font-medium text-ctp-subtext0 py-2">
                  {compareYear}
                </th>
                <th className="text-right text-xs font-medium text-ctp-subtext0 py-2">
                  Evolution
                </th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((cat) => (
                <tr
                  key={cat.categoryId}
                  className="border-b border-ctp-surface1 last:border-0"
                >
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      {cat.categoryIcon && <span>{cat.categoryIcon}</span>}
                      <span className="text-sm text-ctp-text">{cat.categoryName}</span>
                    </div>
                  </td>
                  <td className="text-right text-sm font-medium text-ctp-text">
                    {formatCurrency(cat.currentYear)}
                  </td>
                  <td className="text-right text-sm text-ctp-subtext0">
                    {formatCurrency(cat.previousYear)}
                  </td>
                  <td className="text-right">
                    <ChangeIndicator value={cat.changePercent} inverse />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default YearComparisonReport;
