// ============================================================================
// REPORTS PAGE - Finance Hub
// Main reports dashboard with various analytics
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  PieChart,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Target,
  DollarSign,
  Loader2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import { DateRangePicker, type DateRange } from './DateRangePicker';
import { ExportDialog, type ExportType } from './ExportDialog';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface SpendingTrend {
  year: number;
  month: number;
  income: number;
  expenses: number;
  net: number;
}

interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  categoryColor?: string;
  total: number;
  percentage: number;
  count: number;
}

interface BudgetComparison {
  categoryId: string;
  categoryName: string;
  categoryColor?: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: 'under' | 'on_track' | 'over';
}

interface CashFlowData {
  operating: { income: number; expenses: number; net: number };
  investing: { inflows: number; outflows: number; net: number };
  netCashFlow: number;
  openingBalance: number;
  closingBalance: number;
}

interface SummaryData {
  flow: {
    income: number;
    expenses: number;
    net: number;
    savingsRate: number;
  };
  comparison: {
    incomeChange: number;
    expenseChange: number;
  };
  spendingByCategory: CategoryBreakdown[];
  totalBalance: number;
}

// ----------------------------------------------------------------------------
// Chart Colors
// ----------------------------------------------------------------------------

const CHART_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#6366F1',
  '#84CC16',
  '#F97316',
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ReportsPage() {
  const { currentWorkspace } = useWorkspace();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [exportType, setExportType] = useState<ExportType | null>(null);

  // Fetch summary data
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['reports', 'summary', currentWorkspace?.id, dateRange],
    queryFn: async () => {
      const month = dateRange.from.getMonth() + 1;
      const year = dateRange.from.getFullYear();
      const response = await api.get<{ data: SummaryData }>(
        `/workspaces/${currentWorkspace?.id}/reports/summary?year=${year}&month=${month}`
      );
      return response.data;
    },
    enabled: !!currentWorkspace?.id,
  });

  // Fetch spending trends
  const { data: trends } = useQuery({
    queryKey: ['reports', 'spending-trend', currentWorkspace?.id],
    queryFn: async () => {
      const response = await api.get<{ data: { trends: SpendingTrend[]; averages: any } }>(
        `/workspaces/${currentWorkspace?.id}/reports/spending-trend?months=6`
      );
      return response.data;
    },
    enabled: !!currentWorkspace?.id,
  });

  // Fetch budget comparison
  const { data: budgetData } = useQuery({
    queryKey: ['reports', 'budget-comparison', currentWorkspace?.id, dateRange],
    queryFn: async () => {
      const response = await api.get<{ data: { categories: BudgetComparison[]; totalBudget: number; totalActual: number } }>(
        `/workspaces/${currentWorkspace?.id}/reports/budget-comparison?from=${format(dateRange.from, 'yyyy-MM-dd')}&to=${format(dateRange.to, 'yyyy-MM-dd')}`
      );
      return response.data;
    },
    enabled: !!currentWorkspace?.id,
  });

  // Fetch cash flow
  const { data: cashFlow } = useQuery({
    queryKey: ['reports', 'cash-flow', currentWorkspace?.id, dateRange],
    queryFn: async () => {
      const response = await api.get<{ data: CashFlowData }>(
        `/workspaces/${currentWorkspace?.id}/reports/cash-flow?from=${format(dateRange.from, 'yyyy-MM-dd')}&to=${format(dateRange.to, 'yyyy-MM-dd')}`
      );
      return response.data;
    },
    enabled: !!currentWorkspace?.id,
  });

  // Format trend data for chart
  const trendChartData = trends?.trends.map((t) => ({
    name: format(new Date(t.year, t.month - 1), 'MMM', { locale: fr }),
    revenus: t.income,
    depenses: t.expenses,
    net: t.net,
  }));

  // Format category data for pie chart
  const categoryChartData = summary?.spendingByCategory.slice(0, 8).map((cat, index) => ({
    name: cat.categoryName,
    value: cat.total,
    color: cat.categoryColor || CHART_COLORS[index % CHART_COLORS.length],
  }));

  const getChangeIcon = (value: number) => {
    if (value > 0) return <ArrowUpRight className="h-4 w-4 text-green-500" />;
    if (value < 0) return <ArrowDownRight className="h-4 w-4 text-red-500" />;
    return null;
  };

  const getChangeColor = (value: number, inverse: boolean = false) => {
    const positive = inverse ? value < 0 : value > 0;
    if (positive) return 'text-green-600';
    if (!positive && value !== 0) return 'text-red-600';
    return 'text-gray-500';
  };

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Rapports</h1>
          <p className="text-gray-500">Analysez vos finances en détail</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <button
            onClick={() => setExportType('transactions')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Exporter
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Revenus */}
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Revenus</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">
              {formatCurrency(summary.flow.income, 'EUR')}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {getChangeIcon(summary.comparison.incomeChange)}
              <span className={cn('text-sm', getChangeColor(summary.comparison.incomeChange))}>
                {summary.comparison.incomeChange >= 0 ? '+' : ''}
                {formatPercent(summary.comparison.incomeChange)} vs mois préc.
              </span>
            </div>
          </div>

          {/* Dépenses */}
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <TrendingDown className="h-4 w-4" />
              <span className="text-sm">Dépenses</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">
              {formatCurrency(summary.flow.expenses, 'EUR')}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {getChangeIcon(-summary.comparison.expenseChange)}
              <span className={cn('text-sm', getChangeColor(summary.comparison.expenseChange, true))}>
                {summary.comparison.expenseChange >= 0 ? '+' : ''}
                {formatPercent(summary.comparison.expenseChange)} vs mois préc.
              </span>
            </div>
          </div>

          {/* Épargne */}
          <div className={cn('border rounded-lg p-4', summary.flow.net >= 0 ? 'bg-green-50' : 'bg-red-50')}>
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Wallet className="h-4 w-4" />
              <span className="text-sm">Épargne nette</span>
            </div>
            <p className={cn('text-2xl font-semibold', summary.flow.net >= 0 ? 'text-green-600' : 'text-red-600')}>
              {summary.flow.net >= 0 ? '+' : ''}
              {formatCurrency(summary.flow.net, 'EUR')}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Taux: {formatPercent(summary.flow.savingsRate)}
            </p>
          </div>

          {/* Solde total */}
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Solde total</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">
              {formatCurrency(summary.totalBalance, 'EUR')}
            </p>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income/Expense Trend */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-medium text-gray-700">Évolution Revenus/Dépenses</h2>
            </div>
            <button
              onClick={() => setExportType('cash_flow')}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Exporter
            </button>
          </div>
          {trendChartData && trendChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value, 'EUR')}
                    labelFormatter={(label) => `Mois: ${label}`}
                  />
                  <Legend />
                  <Bar dataKey="revenus" name="Revenus" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="depenses" name="Dépenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              Pas de données disponibles
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieChart className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-medium text-gray-700">Dépenses par catégorie</h2>
            </div>
            <button
              onClick={() => setExportType('categories')}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Exporter
            </button>
          </div>
          {categoryChartData && categoryChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value, 'EUR')} />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              Pas de données disponibles
            </div>
          )}
        </div>
      </div>

      {/* Budget vs Actual */}
      {budgetData && budgetData.categories.length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-medium text-gray-700">Budget vs Réalisé</h2>
            </div>
            <button
              onClick={() => setExportType('budget_report')}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Exporter
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left text-xs font-medium text-gray-500 py-2">Catégorie</th>
                  <th className="text-right text-xs font-medium text-gray-500 py-2">Budget</th>
                  <th className="text-right text-xs font-medium text-gray-500 py-2">Réalisé</th>
                  <th className="text-right text-xs font-medium text-gray-500 py-2">Écart</th>
                  <th className="text-center text-xs font-medium text-gray-500 py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {budgetData.categories.map((cat) => (
                  <tr key={cat.categoryId} className="border-b last:border-0">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {cat.categoryColor && (
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: cat.categoryColor }}
                          />
                        )}
                        <span className="text-sm text-gray-900">{cat.categoryName}</span>
                      </div>
                    </td>
                    <td className="text-right text-sm text-gray-600">{formatCurrency(cat.budgeted, 'EUR')}</td>
                    <td className="text-right text-sm text-gray-900 font-medium">
                      {formatCurrency(cat.actual, 'EUR')}
                    </td>
                    <td className={cn('text-right text-sm', cat.variance >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {cat.variance >= 0 ? '+' : ''}
                      {formatCurrency(cat.variance, 'EUR')}
                    </td>
                    <td className="text-center">
                      <span
                        className={cn(
                          'text-xs px-2 py-1 rounded-full',
                          cat.status === 'under' && 'bg-green-100 text-green-700',
                          cat.status === 'on_track' && 'bg-blue-100 text-blue-700',
                          cat.status === 'over' && 'bg-red-100 text-red-700'
                        )}
                      >
                        {cat.status === 'under' && 'Sous budget'}
                        {cat.status === 'on_track' && 'Dans les clous'}
                        {cat.status === 'over' && 'Dépassé'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td className="py-3 font-medium text-gray-900">Total</td>
                  <td className="text-right font-medium text-gray-900">
                    {formatCurrency(budgetData.totalBudget, 'EUR')}
                  </td>
                  <td className="text-right font-medium text-gray-900">
                    {formatCurrency(budgetData.totalActual, 'EUR')}
                  </td>
                  <td
                    className={cn(
                      'text-right font-medium',
                      budgetData.totalBudget - budgetData.totalActual >= 0 ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {budgetData.totalBudget - budgetData.totalActual >= 0 ? '+' : ''}
                    {formatCurrency(budgetData.totalBudget - budgetData.totalActual, 'EUR')}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Cash Flow Summary */}
      {cashFlow && (
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-medium text-gray-700">Flux de trésorerie</h2>
            </div>
            <button
              onClick={() => setExportType('cash_flow')}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Exporter
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Solde d'ouverture</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(cashFlow.openingBalance, 'EUR')}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Flux opérationnel</p>
              <p className={cn('text-lg font-semibold', cashFlow.operating.net >= 0 ? 'text-green-600' : 'text-red-600')}>
                {cashFlow.operating.net >= 0 ? '+' : ''}
                {formatCurrency(cashFlow.operating.net, 'EUR')}
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Flux d'investissement</p>
              <p className={cn('text-lg font-semibold', cashFlow.investing.net >= 0 ? 'text-blue-600' : 'text-blue-600')}>
                {cashFlow.investing.net >= 0 ? '+' : ''}
                {formatCurrency(cashFlow.investing.net, 'EUR')}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Solde de clôture</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(cashFlow.closingBalance, 'EUR')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Export Dialog */}
      <ExportDialog
        isOpen={exportType !== null}
        onClose={() => setExportType(null)}
        type={exportType || 'transactions'}
        dateRange={dateRange}
      />
    </div>
  );
}

export default ReportsPage;
