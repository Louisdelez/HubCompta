// ============================================================================
// TAX EXPORT - Finance Hub
// Export tax data for filing
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileCheck2, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api/client';

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

interface TaxExportProps {
  workspaceId: string;
  year: number;
  summary: TaxSummaryData;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function TaxExport({ workspaceId, year, summary }: TaxExportProps) {
  const queryClient = useQueryClient();
  const [actualTax, setActualTax] = useState(summary.actualTax?.toString() ?? '');
  const [showConfirm, setShowConfirm] = useState(false);

  // File mutation
  const fileMutation = useMutation({
    mutationFn: () =>
      api.post(`/workspaces/${workspaceId}/tax/${year}/file`, {
        actualTax: actualTax ? parseFloat(actualTax) : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tax', workspaceId, year] });
      setShowConfirm(false);
    },
  });

  const handleExportPdf = () => {
    // Generate a simple PDF-like summary (in real app, would use a PDF library)
    const content = `
DECLARATION FISCALE ${year}
========================

Revenus bruts: ${formatCurrency(summary.totalIncome)}
Deductions: ${formatCurrency(summary.totalDeductions)}
Revenu imposable: ${formatCurrency(summary.taxableIncome)}

IMPOT ESTIME: ${formatCurrency(summary.estimatedTax)}

Taux effectif: ${summary.effectiveRate.toFixed(1)}%
Taux marginal: ${summary.marginalRate}%

---
Genere par HubCompta
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `declaration_fiscale_${year}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isFiled = summary.status === 'filed' || summary.status === 'closed';

  return (
    <div className="space-y-4">
      {/* Status Card */}
      {isFiled ? (
        <div className="card bg-ctp-green/5 border border-ctp-green/20">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-ctp-green flex-shrink-0" />
            <div>
              <h3 className="font-medium text-ctp-green">Declaration enregistree</h3>
              <p className="text-sm text-ctp-subtext0 mt-1">
                Votre declaration pour {year} a ete enregistree.
                {summary.actualTax !== null && (
                  <>
                    {' '}Impot reel : <strong>{formatCurrency(summary.actualTax)}</strong>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-ctp-yellow flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium">Declaration en cours</h3>
              <p className="text-sm text-ctp-subtext0 mt-1">
                Une fois votre declaration effectuee aupres des impots, marquez-la comme deposee
                et renseignez le montant reel de votre impot.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Export */}
        <div className="card">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Download className="w-5 h-5" />
            Exporter
          </h3>
          <p className="text-sm text-ctp-subtext0 mb-4">
            Telechargez un resume de vos revenus et deductions pour faciliter votre declaration.
          </p>
          <button onClick={handleExportPdf} className="btn-secondary w-full">
            Telecharger le resume
          </button>
        </div>

        {/* Mark as Filed */}
        {!isFiled && (
          <div className="card">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <FileCheck2 className="w-5 h-5" />
              Marquer comme declare
            </h3>
            <p className="text-sm text-ctp-subtext0 mb-4">
              Indiquez que vous avez depose votre declaration aupres de l'administration fiscale.
            </p>
            <button
              onClick={() => setShowConfirm(true)}
              className="btn-primary w-full"
            >
              J'ai declare mes impots
            </button>
          </div>
        )}

        {/* Already Filed - Show actual tax */}
        {isFiled && (
          <div className="card bg-ctp-surface0">
            <h3 className="font-medium mb-3">Comparaison estimation / reel</h3>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-sm text-ctp-subtext0">Estime</p>
                <p className="text-xl font-bold text-ctp-blue">
                  {formatCurrency(summary.estimatedTax)}
                </p>
              </div>
              <div>
                <p className="text-sm text-ctp-subtext0">Reel</p>
                <p className="text-xl font-bold text-ctp-green">
                  {formatCurrency(summary.actualTax ?? summary.estimatedTax)}
                </p>
              </div>
            </div>
            {summary.actualTax !== null && (
              <div className="mt-3 text-center">
                <span className={`text-sm font-medium ${
                  summary.actualTax < summary.estimatedTax
                    ? 'text-ctp-green'
                    : summary.actualTax > summary.estimatedTax
                      ? 'text-ctp-red'
                      : 'text-ctp-subtext0'
                }`}>
                  {summary.actualTax < summary.estimatedTax
                    ? `${formatCurrency(summary.estimatedTax - summary.actualTax)} de moins que prevu`
                    : summary.actualTax > summary.estimatedTax
                      ? `${formatCurrency(summary.actualTax - summary.estimatedTax)} de plus que prevu`
                      : 'Estimation exacte'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-ctp-base rounded-xl shadow-xl max-w-md w-full p-6 animate-scale-in">
            <h2 className="text-xl font-bold mb-4">Confirmer la declaration</h2>
            <p className="text-ctp-subtext0 mb-4">
              Vous pouvez optionnellement indiquer le montant reel de votre impot
              (une fois l'avis recu).
            </p>

            <div className="mb-4">
              <label htmlFor="actualTax" className="label">
                Impot reel (optionnel)
              </label>
              <div className="relative">
                <input
                  id="actualTax"
                  type="number"
                  step="0.01"
                  min="0"
                  value={actualTax}
                  onChange={(e) => setActualTax(e.target.value)}
                  placeholder={summary.estimatedTax.toString()}
                  className="input pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ctp-subtext0">
                  EUR
                </span>
              </div>
              <p className="text-xs text-ctp-subtext0 mt-1">
                Laissez vide pour utiliser l'estimation
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={() => fileMutation.mutate()}
                disabled={fileMutation.isPending}
                className="btn-primary flex-1"
              >
                {fileMutation.isPending ? 'Enregistrement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaxExport;
