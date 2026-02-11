// ============================================================================
// TAX SUMMARY REPORT - Finance Hub
// Summary of tax-relevant income and deductible expenses
// Adapts to FR (France) or CH (Switzerland)
// ============================================================================

import { useState } from 'react';
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
      alert("Erreur lors de l'export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  // Income breakdown chart data
  const incomeChartData = data
    ? [
        { name: 'Salaires', value: data.income.salary, color: 'var(--ctp-blue)' },
        { name: 'Independant', value: data.income.freelance, color: 'var(--ctp-green)' },
        { name: 'Investissements', value: data.income.investments, color: 'var(--ctp-yellow)' },
        { name: 'Autres', value: data.income.other, color: 'var(--ctp-mauve)' },
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
        <p className="text-ctp-subtext0">Chargement du resume fiscal...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <Receipt className="w-12 h-12 mx-auto text-ctp-overlay1 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Aucune donnee</h3>
        <p className="text-ctp-subtext0">
          Pas assez de transactions pour generer un resume fiscal
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
          <h2 className="text-lg font-semibold">Resume Fiscal {selectedYear}</h2>
          <p className="text-sm text-ctp-subtext0">
            {data.country} - A titre indicatif uniquement
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
            Exporter PDF
          </button>
        </div>
      </div>

      {/* Warning banner */}
      <div className="flex items-start gap-3 p-4 bg-ctp-yellow/10 border border-ctp-yellow/30 rounded-lg">
        <AlertCircle className="w-5 h-5 text-ctp-yellow flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-ctp-yellow">Avertissement</p>
          <p className="text-ctp-subtext0">
            Ce resume est fourni a titre indicatif uniquement et ne constitue pas un avis fiscal.
            Consultez un professionnel pour votre declaration officielle.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Gross Income */}
        <div className="card">
          <div className="flex items-center gap-2 text-ctp-green mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">Revenu brut</span>
          </div>
          <p className="text-2xl font-bold text-ctp-text">
            {formatCurrency(data.summary.grossIncome, data.country)}
          </p>
        </div>

        {/* Deductions */}
        <div className="card">
          <div className="flex items-center gap-2 text-ctp-blue mb-2">
            <FileText className="w-4 h-4" />
            <span className="text-sm">Deductions</span>
          </div>
          <p className="text-2xl font-bold text-ctp-text">
            -{formatCurrency(data.summary.totalDeductions, data.country)}
          </p>
        </div>

        {/* Taxable Income */}
        <div className="card bg-gradient-to-br from-ctp-blue/10 to-ctp-mauve/10">
          <div className="flex items-center gap-2 text-ctp-blue mb-2">
            <Calculator className="w-4 h-4" />
            <span className="text-sm">Revenu imposable</span>
          </div>
          <p className="text-2xl font-bold text-ctp-blue">
            {formatCurrency(data.summary.taxableIncome, data.country)}
          </p>
        </div>

        {/* Estimated Tax */}
        <div className="card">
          <div className="flex items-center gap-2 text-ctp-red mb-2">
            <TrendingDown className="w-4 h-4" />
            <span className="text-sm">Impot estime</span>
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
            Repartition des revenus
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
              Aucun revenu enregistre
            </div>
          )}
        </div>

        {/* Deductions Breakdown */}
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-ctp-blue" />
            Charges deductibles
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
                      name === 'deductible' ? 'Deductible' : 'Montant',
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
              Aucune charge deductible identifiee
            </div>
          )}
        </div>
      </div>

      {/* Income Details */}
      <div className="card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Landmark className="w-5 h-5 text-ctp-green" />
          Detail des revenus
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-ctp-surface0 rounded-lg">
            <div className="flex items-center gap-2 text-ctp-subtext0 mb-2">
              <Building2 className="w-4 h-4" />
              <span className="text-xs">Salaires</span>
            </div>
            <p className="text-lg font-semibold text-ctp-text">
              {formatCurrency(data.income.salary, data.country)}
            </p>
          </div>
          <div className="p-4 bg-ctp-surface0 rounded-lg">
            <div className="flex items-center gap-2 text-ctp-subtext0 mb-2">
              <Briefcase className="w-4 h-4" />
              <span className="text-xs">Independant</span>
            </div>
            <p className="text-lg font-semibold text-ctp-text">
              {formatCurrency(data.income.freelance, data.country)}
            </p>
          </div>
          <div className="p-4 bg-ctp-surface0 rounded-lg">
            <div className="flex items-center gap-2 text-ctp-subtext0 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Investissements</span>
            </div>
            <p className="text-lg font-semibold text-ctp-text">
              {formatCurrency(data.income.investments, data.country)}
            </p>
          </div>
          <div className="p-4 bg-ctp-surface0 rounded-lg">
            <div className="flex items-center gap-2 text-ctp-subtext0 mb-2">
              <Receipt className="w-4 h-4" />
              <span className="text-xs">Autres</span>
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
                    Categorie
                  </th>
                  <th className="text-right text-xs font-medium text-ctp-subtext0 py-2">
                    Montant
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
            Detail des charges deductibles
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ctp-surface1">
                  <th className="text-left text-xs font-medium text-ctp-subtext0 py-2">
                    Categorie
                  </th>
                  <th className="text-right text-xs font-medium text-ctp-subtext0 py-2">
                    Montant
                  </th>
                  <th className="text-right text-xs font-medium text-ctp-subtext0 py-2">
                    Taux
                  </th>
                  <th className="text-right text-xs font-medium text-ctp-subtext0 py-2">
                    Deductible
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
                  <td className="py-2 font-medium text-ctp-text">Total</td>
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
            Revenus de placements
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-ctp-surface0 rounded-lg">
              <p className="text-xs text-ctp-subtext0 mb-1">Dividendes</p>
              <p className="text-lg font-semibold text-ctp-green">
                {formatCurrency(data.investments.dividends, data.country)}
              </p>
            </div>
            <div className="p-4 bg-ctp-surface0 rounded-lg">
              <p className="text-xs text-ctp-subtext0 mb-1">Plus-values</p>
              <p className="text-lg font-semibold text-ctp-green">
                {formatCurrency(data.investments.realizedGains, data.country)}
              </p>
            </div>
            <div className="p-4 bg-ctp-surface0 rounded-lg">
              <p className="text-xs text-ctp-subtext0 mb-1">Moins-values</p>
              <p className="text-lg font-semibold text-ctp-red">
                -{formatCurrency(data.investments.realizedLosses, data.country)}
              </p>
            </div>
            <div className="p-4 bg-ctp-yellow/10 rounded-lg">
              <p className="text-xs text-ctp-subtext0 mb-1">Net imposable</p>
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
            Notes importantes
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
              {isSwitzerland ? 'Informations pour la Suisse' : 'Informations pour la France'}
            </h4>
            {isSwitzerland ? (
              <ul className="text-xs text-ctp-subtext0 space-y-1">
                <li>- Les taux varient selon le canton et la commune de residence</li>
                <li>- Le 3e pilier A est deductible jusqu'a CHF 7'056 (2024)</li>
                <li>- Declaraz les revenus de placements etrangers</li>
                <li>- Utilisez eTax ou Vaudtax pour votre declaration</li>
              </ul>
            ) : (
              <ul className="text-xs text-ctp-subtext0 space-y-1">
                <li>- Declaration en ligne sur impots.gouv.fr</li>
                <li>- Les revenus salaries sont pre-remplis (verifiez)</li>
                <li>- Revenus BNC/BIC: regime micro ou reel selon CA</li>
                <li>- PFU (flat tax) de 30% sur revenus financiers ou option IR</li>
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TaxSummaryReport;
