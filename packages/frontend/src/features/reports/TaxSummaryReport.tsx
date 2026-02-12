// ============================================================================
// TAX SUMMARY REPORT - Finance Hub
// Summary of tax-relevant income and deductible expenses
// Adapts to FR (France) or CH (Switzerland)
// ============================================================================

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Receipt,
  TrendingUp,
  TrendingDown,
  Calculator,
  FileText,
  Building2,
  Briefcase,
  Landmark,
  AlertCircle,
  Download,
  Loader2,
  Info,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface TaxSummaryResponse {
  year: number;
  country: string;
  income: {
    total: number;
    salary: number;
    freelance: number;
    investments: number;
    other: number;
    byCategory: Array<{ categoryId: string; categoryName: string; amount: number }>;
  };
  deductibleExpenses: {
    total: number;
    byCategory: Array<{
      categoryId: string;
      categoryName: string;
      amount: number;
      deductionRate: number;
      deductibleAmount: number;
      description: string;
    }>;
  };
  investments: {
    dividends: number;
    realizedGains: number;
    realizedLosses: number;
    netInvestmentIncome: number;
  };
  summary: {
    grossIncome: number;
    totalDeductions: number;
    taxableIncome: number;
    estimatedTax: number;
    notes: string[];
  };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, country: string = 'FR'): string {
  const currency = country === 'CH' || country === 'Suisse' ? 'CHF' : 'EUR';
  const locale = country === 'CH' || country === 'Suisse' ? 'de-CH' : 'fr-FR';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

const CHART_COLORS = [
  'var(--ctp-blue)',
  'var(--ctp-green)',
  'var(--ctp-yellow)',
  'var(--ctp-mauve)',
  'var(--ctp-pink)',
  'var(--ctp-teal)',
  'var(--ctp-lavender)',
  'var(--ctp-peach)',
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function TaxSummaryReport() {
  const { t } = useTranslation();
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear - 1); // Previous year by default
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', workspaceId, 'tax-summary', selectedYear],
    queryFn: () =>
      api.get<TaxSummaryResponse>(
        `/workspaces/${workspaceId}/reports/tax-summary?year=${selectedYear}`
      ),
    enabled: !!workspaceId,
  });

  const handleExportPDF = async () => {
    if (!workspaceId) return;
    setIsExporting(true);

    try {
      const baseUrl = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '/api/v1';
      const token = localStorage.getItem('accessToken');

      const response = await fetch(
        `${baseUrl}/workspaces/${workspaceId}/reports/export-pdf/tax-summary?year=${selectedYear}`,
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
      link.download = `resume_fiscal_${selectedYear}.pdf`;
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

  // Income breakdown chart data
  const incomeChartData = data
    ? [
        { name: t('reports.taxSummaryReport.salaries'), value: data.income.salary, color: 'var(--ctp-blue)' },
        { name: t('reports.taxSummaryReport.freelance'), value: data.income.freelance, color: 'var(--ctp-green)' },
        { name: t('reports.taxSummaryReport.investments'), value: data.income.investments, color: 'var(--ctp-yellow)' },
        { name: t('reports.taxSummaryReport.other'), value: data.income.other, color: 'var(--ctp-mauve)' },
      ].filter((d) => d.value > 0)
    : [];

  // Deductions chart data
  const deductionsChartData = data
    ? data.deductibleExpenses.byCategory.slice(0, 6).map((d, i) => ({
        name: d.categoryName,
        montant: d.amount,
        deductible: d.deductibleAmount,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
    : [];

  if (!workspaceId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="card p-8 text-center">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-ctp-blue mb-4" />
        <p className="text-ctp-subtext0">{t('reports.taxSummaryReport.loading')}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <Receipt className="w-12 h-12 mx-auto text-ctp-overlay1 mb-4" />
        <h3 className="text-lg font-semibold mb-2">{t('reports.taxSummaryReport.noData')}</h3>
        <p className="text-ctp-subtext0">
          {t('reports.taxSummaryReport.notEnoughTransactions')}
        </p>
      </div>
    );
  }

  const isSwitzerland = data.country === 'Suisse' || data.country === 'CH';

  return (
    <div className="space-y-6">
      {/* Header with year selector and export */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t('reports.taxSummaryReport.title')} {selectedYear}</h2>
          <p className="text-sm text-ctp-subtext0">
            {data.country} - {t('reports.taxSummaryReport.indicativeOnly')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="input-select w-28"
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
              'bg-ctp-blue text-ctp-base hover:bg-ctp-blue/90',
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
        </div>
      </div>

      {/* Warning banner */}
      <div className="flex items-start gap-3 p-4 bg-ctp-yellow/10 border border-ctp-yellow/30 rounded-lg">
        <AlertCircle className="w-5 h-5 text-ctp-yellow flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-ctp-yellow">{t('reports.taxSummaryReport.warning')}</p>
          <p className="text-ctp-subtext0">
            {t('reports.taxSummaryReport.warningText')}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Gross Income */}
        <div className="card">
          <div className="flex items-center gap-2 text-ctp-green mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">{t('reports.taxSummaryReport.grossIncome')}</span>
          </div>
          <p className="text-2xl font-bold text-ctp-text">
            {formatCurrency(data.summary.grossIncome, data.country)}
          </p>
        </div>

        {/* Deductions */}
        <div className="card">
          <div className="flex items-center gap-2 text-ctp-blue mb-2">
            <FileText className="w-4 h-4" />
            <span className="text-sm">{t('reports.taxSummaryReport.deductions')}</span>
          </div>
          <p className="text-2xl font-bold text-ctp-text">
            -{formatCurrency(data.summary.totalDeductions, data.country)}
          </p>
        </div>

        {/* Taxable Income */}
        <div className="card bg-gradient-to-br from-ctp-blue/10 to-ctp-mauve/10">
          <div className="flex items-center gap-2 text-ctp-blue mb-2">
            <Calculator className="w-4 h-4" />
            <span className="text-sm">{t('reports.taxSummaryReport.taxableIncome')}</span>
          </div>
          <p className="text-2xl font-bold text-ctp-blue">
            {formatCurrency(data.summary.taxableIncome, data.country)}
          </p>
        </div>

        {/* Estimated Tax */}
        <div className="card">
          <div className="flex items-center gap-2 text-ctp-red mb-2">
            <TrendingDown className="w-4 h-4" />
            <span className="text-sm">{t('reports.taxSummaryReport.estimatedTax')}</span>
          </div>
          <p className="text-2xl font-bold text-ctp-red">
            ~{formatCurrency(data.summary.estimatedTax, data.country)}
          </p>
        </div>
      </div>

      {/* Income and Deductions Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Breakdown */}
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-ctp-green" />
            {t('reports.taxSummaryReport.incomeBreakdown')}
          </h3>
          {incomeChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={incomeChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {incomeChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value, data.country)}
                    contentStyle={{
                      backgroundColor: 'var(--ctp-surface0)',
                      borderColor: 'var(--ctp-surface1)',
                    }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs text-ctp-subtext0">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-ctp-subtext0">
              {t('reports.taxSummaryReport.noIncomeRecorded')}
            </div>
          )}
        </div>

        {/* Deductions Breakdown */}
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-ctp-blue" />
            {t('reports.taxSummaryReport.deductibleExpenses')}
          </h3>
          {deductionsChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deductionsChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-ctp-surface1" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10 }}
                    className="fill-ctp-subtext0"
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    className="fill-ctp-subtext0"
                    width={100}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(value, data.country),
                      name === 'deductible' ? t('reports.taxSummaryReport.deductible') : t('reports.taxSummaryReport.amount'),
                    ]}
                    contentStyle={{
                      backgroundColor: 'var(--ctp-surface0)',
                      borderColor: 'var(--ctp-surface1)',
                    }}
                  />
                  <Bar dataKey="deductible" fill="var(--ctp-blue)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-ctp-subtext0">
              {t('reports.taxSummaryReport.noDeductibleExpenses')}
            </div>
          )}
        </div>
      </div>

      {/* Income Details */}
      <div className="card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Landmark className="w-5 h-5 text-ctp-green" />
          {t('reports.taxSummaryReport.incomeDetails')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-ctp-surface0 rounded-lg">
            <div className="flex items-center gap-2 text-ctp-subtext0 mb-2">
              <Building2 className="w-4 h-4" />
              <span className="text-xs">{t('reports.taxSummaryReport.salaries')}</span>
            </div>
            <p className="text-lg font-semibold text-ctp-text">
              {formatCurrency(data.income.salary, data.country)}
            </p>
          </div>
          <div className="p-4 bg-ctp-surface0 rounded-lg">
            <div className="flex items-center gap-2 text-ctp-subtext0 mb-2">
              <Briefcase className="w-4 h-4" />
              <span className="text-xs">{t('reports.taxSummaryReport.freelance')}</span>
            </div>
            <p className="text-lg font-semibold text-ctp-text">
              {formatCurrency(data.income.freelance, data.country)}
            </p>
          </div>
          <div className="p-4 bg-ctp-surface0 rounded-lg">
            <div className="flex items-center gap-2 text-ctp-subtext0 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">{t('reports.taxSummaryReport.investments')}</span>
            </div>
            <p className="text-lg font-semibold text-ctp-text">
              {formatCurrency(data.income.investments, data.country)}
            </p>
          </div>
          <div className="p-4 bg-ctp-surface0 rounded-lg">
            <div className="flex items-center gap-2 text-ctp-subtext0 mb-2">
              <Receipt className="w-4 h-4" />
              <span className="text-xs">{t('reports.taxSummaryReport.other')}</span>
            </div>
            <p className="text-lg font-semibold text-ctp-text">
              {formatCurrency(data.income.other, data.country)}
            </p>
          </div>
        </div>

        {/* Income by category table */}
        {data.income.byCategory.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ctp-surface1">
                  <th className="text-left text-xs font-medium text-ctp-subtext0 py-2">
                    {t('reports.taxSummaryReport.category')}
                  </th>
                  <th className="text-right text-xs font-medium text-ctp-subtext0 py-2">
                    {t('reports.taxSummaryReport.amount')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.income.byCategory.slice(0, 10).map((cat) => (
                  <tr key={cat.categoryId} className="border-b border-ctp-surface1 last:border-0">
                    <td className="py-2 text-sm text-ctp-text">{cat.categoryName}</td>
                    <td className="py-2 text-sm text-ctp-green text-right font-medium">
                      {formatCurrency(cat.amount, data.country)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deductible Expenses Details */}
      {data.deductibleExpenses.byCategory.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-ctp-blue" />
            {t('reports.taxSummaryReport.deductibleExpensesDetails')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ctp-surface1">
                  <th className="text-left text-xs font-medium text-ctp-subtext0 py-2">
                    {t('reports.taxSummaryReport.category')}
                  </th>
                  <th className="text-right text-xs font-medium text-ctp-subtext0 py-2">
                    {t('reports.taxSummaryReport.amount')}
                  </th>
                  <th className="text-right text-xs font-medium text-ctp-subtext0 py-2">
                    {t('reports.taxSummaryReport.rate')}
                  </th>
                  <th className="text-right text-xs font-medium text-ctp-subtext0 py-2">
                    {t('reports.taxSummaryReport.deductible')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.deductibleExpenses.byCategory.map((cat) => (
                  <tr key={cat.categoryId} className="border-b border-ctp-surface1 last:border-0">
                    <td className="py-2">
                      <div>
                        <p className="text-sm text-ctp-text">{cat.categoryName}</p>
                        <p className="text-xs text-ctp-subtext0">{cat.description}</p>
                      </div>
                    </td>
                    <td className="py-2 text-sm text-ctp-subtext0 text-right">
                      {formatCurrency(cat.amount, data.country)}
                    </td>
                    <td className="py-2 text-sm text-ctp-subtext0 text-right">
                      {(cat.deductionRate * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 text-sm text-ctp-blue text-right font-medium">
                      {formatCurrency(cat.deductibleAmount, data.country)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-ctp-surface1">
                  <td className="py-2 font-medium text-ctp-text">{t('reports.taxSummaryReport.total')}</td>
                  <td className="py-2 text-right text-ctp-subtext0">-</td>
                  <td className="py-2 text-right text-ctp-subtext0">-</td>
                  <td className="py-2 text-right font-bold text-ctp-blue">
                    {formatCurrency(data.deductibleExpenses.total, data.country)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Investment Income */}
      {(data.investments.dividends > 0 || data.investments.realizedGains > 0) && (
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-ctp-yellow" />
            {t('reports.taxSummaryReport.investmentIncome')}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-ctp-surface0 rounded-lg">
              <p className="text-xs text-ctp-subtext0 mb-1">{t('reports.taxSummaryReport.dividends')}</p>
              <p className="text-lg font-semibold text-ctp-green">
                {formatCurrency(data.investments.dividends, data.country)}
              </p>
            </div>
            <div className="p-4 bg-ctp-surface0 rounded-lg">
              <p className="text-xs text-ctp-subtext0 mb-1">{t('reports.taxSummaryReport.capitalGains')}</p>
              <p className="text-lg font-semibold text-ctp-green">
                {formatCurrency(data.investments.realizedGains, data.country)}
              </p>
            </div>
            <div className="p-4 bg-ctp-surface0 rounded-lg">
              <p className="text-xs text-ctp-subtext0 mb-1">{t('reports.taxSummaryReport.capitalLosses')}</p>
              <p className="text-lg font-semibold text-ctp-red">
                -{formatCurrency(data.investments.realizedLosses, data.country)}
              </p>
            </div>
            <div className="p-4 bg-ctp-yellow/10 rounded-lg">
              <p className="text-xs text-ctp-subtext0 mb-1">{t('reports.taxSummaryReport.netTaxable')}</p>
              <p className="text-lg font-semibold text-ctp-yellow">
                {formatCurrency(data.investments.netInvestmentIncome, data.country)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {data.summary.notes.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-ctp-subtext0" />
            {t('reports.taxSummaryReport.importantNotes')}
          </h3>
          <ul className="space-y-2">
            {data.summary.notes.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ctp-subtext0">
                <span className="text-ctp-blue">-</span>
                {note}
              </li>
            ))}
          </ul>

          {/* Country-specific info */}
          <div className="mt-4 p-4 bg-ctp-surface0 rounded-lg">
            <h4 className="text-sm font-medium text-ctp-text mb-2">
              {isSwitzerland ? t('reports.taxSummaryReport.swissInfo') : t('reports.taxSummaryReport.frenchInfo')}
            </h4>
            {isSwitzerland ? (
              <ul className="text-xs text-ctp-subtext0 space-y-1">
                <li>- {t('reports.taxSummaryReport.swissInfo1')}</li>
                <li>- {t('reports.taxSummaryReport.swissInfo2')}</li>
                <li>- {t('reports.taxSummaryReport.swissInfo3')}</li>
                <li>- {t('reports.taxSummaryReport.swissInfo4')}</li>
              </ul>
            ) : (
              <ul className="text-xs text-ctp-subtext0 space-y-1">
                <li>- {t('reports.taxSummaryReport.frenchInfo1')}</li>
                <li>- {t('reports.taxSummaryReport.frenchInfo2')}</li>
                <li>- {t('reports.taxSummaryReport.frenchInfo3')}</li>
                <li>- {t('reports.taxSummaryReport.frenchInfo4')}</li>
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TaxSummaryReport;
