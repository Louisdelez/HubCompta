// ============================================================================
// TAX SUMMARY - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { TrendingUp, TrendingDown, Percent, Receipt } from 'lucide-react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface TaxSummaryData {
  year: number;
  status: string;
  totalIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  estimatedTax: number;
  actualTax: number | null;
  effectiveRate: number;
  marginalRate: number;
  deductionsByCategory: Record<string, number>;
}

interface TaxSummaryProps {
  summary: TaxSummaryData;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

const categoryLabels: Record<string, string> = {
  professional: 'Frais professionnels',
  medical: 'Frais medicaux',
  charitable: 'Dons',
  other: 'Autres',
};

const categoryColors: Record<string, string> = {
  professional: 'bg-ctp-blue',
  medical: 'bg-ctp-green',
  charitable: 'bg-ctp-mauve',
  other: 'bg-ctp-overlay1',
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function TaxSummary({ summary }: TaxSummaryProps) {
  const savings = summary.totalIncome - summary.taxableIncome;

  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Income */}
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-ctp-subtext0">Revenus bruts</p>
              <p className="text-2xl font-bold text-ctp-green mt-1">
                {formatCurrency(summary.totalIncome)}
              </p>
            </div>
            <div className="p-2 bg-ctp-green/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-ctp-green" />
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-ctp-subtext0">Deductions</p>
              <p className="text-2xl font-bold text-ctp-blue mt-1">
                -{formatCurrency(summary.totalDeductions)}
              </p>
            </div>
            <div className="p-2 bg-ctp-blue/10 rounded-lg">
              <TrendingDown className="w-5 h-5 text-ctp-blue" />
            </div>
          </div>
        </div>

        {/* Taxable Income */}
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-ctp-subtext0">Revenu imposable</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(summary.taxableIncome)}
              </p>
            </div>
            <div className="p-2 bg-ctp-surface1 rounded-lg">
              <Receipt className="w-5 h-5 text-ctp-text" />
            </div>
          </div>
        </div>

        {/* Estimated Tax */}
        <div className="card ring-2 ring-ctp-mauve">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-ctp-subtext0">
                {summary.actualTax !== null ? 'Impot reel' : 'Impot estime'}
              </p>
              <p className="text-2xl font-bold text-ctp-mauve mt-1">
                {formatCurrency(summary.actualTax ?? summary.estimatedTax)}
              </p>
            </div>
            <div className="p-2 bg-ctp-mauve/10 rounded-lg">
              <Percent className="w-5 h-5 text-ctp-mauve" />
            </div>
          </div>
        </div>
      </div>

      {/* Tax Rates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Effective Rate */}
        <div className="card">
          <h3 className="font-medium mb-3">Taux effectif d'imposition</h3>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold text-ctp-mauve">
              {formatPercent(summary.effectiveRate)}
            </span>
            <span className="text-ctp-subtext0 pb-1">
              sur vos revenus bruts
            </span>
          </div>
          <div className="mt-3 h-3 bg-ctp-surface1 rounded-full overflow-hidden">
            <div
              className="h-full bg-ctp-mauve rounded-full transition-all duration-500"
              style={{ width: `${Math.min(summary.effectiveRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Marginal Rate */}
        <div className="card">
          <h3 className="font-medium mb-3">Taux marginal d'imposition (TMI)</h3>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold text-ctp-peach">
              {formatPercent(summary.marginalRate)}
            </span>
            <span className="text-ctp-subtext0 pb-1">
              tranche la plus haute
            </span>
          </div>
          <div className="mt-3 h-3 bg-ctp-surface1 rounded-full overflow-hidden">
            <div
              className="h-full bg-ctp-peach rounded-full transition-all duration-500"
              style={{ width: `${Math.min(summary.marginalRate * 2, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Savings & Deductions Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tax Savings */}
        <div className="card bg-ctp-green/5 border border-ctp-green/20">
          <h3 className="font-medium mb-2 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-ctp-green" />
            Economies fiscales
          </h3>
          <p className="text-3xl font-bold text-ctp-green">
            {formatCurrency(savings)}
          </p>
          <p className="text-sm text-ctp-subtext0 mt-1">
            Grace a vos deductions, vous economisez environ{' '}
            <strong className="text-ctp-green">
              {formatCurrency(savings * (summary.marginalRate / 100))}
            </strong>{' '}
            d'impots
          </p>
        </div>

        {/* Deductions Breakdown */}
        <div className="card">
          <h3 className="font-medium mb-3">Repartition des deductions</h3>
          {Object.keys(summary.deductionsByCategory).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(summary.deductionsByCategory).map(([category, amount]) => (
                <div key={category} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${categoryColors[category] ?? 'bg-ctp-overlay1'}`} />
                  <span className="flex-1 text-sm">{categoryLabels[category] ?? category}</span>
                  <span className="font-medium">{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-ctp-subtext0 text-sm">
              Aucune deduction enregistree. L'abattement forfaitaire de 10% est applique.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default TaxSummary;
