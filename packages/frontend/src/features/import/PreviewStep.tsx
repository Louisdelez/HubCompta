// ============================================================================
// PREVIEW STEP - Finance Hub
// ============================================================================

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { XCircle } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface PreviewTransaction {
  date: string;
  amount: number;
  description: string;
  isDuplicate: boolean;
  suggestedCategory?: { id: string; name: string };
}

interface PreviewData {
  totalRows: number;
  validRows: number;
  duplicates: number;
  headers: string[];
  sampleTransactions: PreviewTransaction[];
  warnings: string[];
}

interface PreviewStepProps {
  workspaceId: string;
  jobId: string;
  accountId: string;
  columnMapping: {
    date: string;
    amount: string;
    description: string;
    credit?: string;
    debit?: string;
  };
  dateFormat: string;
  onBack: () => void;
  onComplete: () => void;
  onPreviewData: (data: PreviewData) => void;
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

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR');
  } catch {
    return dateStr;
  }
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function PreviewStep({
  workspaceId,
  jobId,
  accountId,
  columnMapping,
  dateFormat: _dateFormat,
  onBack,
  onComplete,
  onPreviewData,
}: PreviewStepProps) {
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [applyRules, setApplyRules] = useState(true);

  const { data: preview, isLoading, error } = useQuery({
    queryKey: ['import-preview', jobId, columnMapping],
    queryFn: () =>
      api.post<PreviewData>(`/workspaces/${workspaceId}/import/preview`, {
        jobId,
        accountId,
        columnMapping,
      }),
  });

  useEffect(() => {
    if (preview) {
      onPreviewData(preview);
    }
  }, [preview, onPreviewData]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Analyse des données...</p>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-10 h-10 mx-auto mb-4 text-danger-500" />
        <p className="text-danger-600 mb-4">
          {error instanceof Error ? error.message : 'Erreur lors de l\'analyse'}
        </p>
        <button onClick={onBack} className="btn-secondary">
          Retour
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Aperçu de l'import</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Vérifiez les données avant de lancer l'import.
        </p>
      </div>

      {/* Warnings */}
      {preview.warnings.length > 0 && (
        <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg">
          <p className="font-medium text-warning-700 dark:text-warning-300 mb-2">
            Avertissements
          </p>
          <ul className="list-disc list-inside text-sm text-warning-600 dark:text-warning-400">
            {preview.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
          <p className="text-2xl font-bold">{preview.totalRows}</p>
          <p className="text-sm text-gray-500">Lignes totales</p>
        </div>
        <div className="p-4 bg-success-50 dark:bg-success-900/20 rounded-lg text-center">
          <p className="text-2xl font-bold text-success-600">{preview.validRows}</p>
          <p className="text-sm text-success-700 dark:text-success-400">Valides</p>
        </div>
        <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg text-center">
          <p className="text-2xl font-bold text-warning-600">{preview.duplicates}</p>
          <p className="text-sm text-warning-700 dark:text-warning-400">Doublons</p>
        </div>
      </div>

      {/* Sample Transactions */}
      <div>
        <h3 className="font-medium mb-3">Aperçu des transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3">Date</th>
                <th className="text-left py-2 px-3">Description</th>
                <th className="text-right py-2 px-3">Montant</th>
                <th className="text-left py-2 px-3">Catégorie</th>
                <th className="text-center py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {preview.sampleTransactions.map((txn, i) => (
                <tr
                  key={i}
                  className={clsx(
                    'border-b border-gray-100 dark:border-gray-800',
                    txn.isDuplicate && 'opacity-50'
                  )}
                >
                  <td className="py-2 px-3">{formatDate(txn.date)}</td>
                  <td className="py-2 px-3 max-w-[200px] truncate">
                    {txn.description}
                  </td>
                  <td
                    className={clsx(
                      'py-2 px-3 text-right font-medium',
                      txn.amount >= 0 ? 'text-success-600' : ''
                    )}
                  >
                    {formatCurrency(txn.amount)}
                  </td>
                  <td className="py-2 px-3">
                    {txn.suggestedCategory ? (
                      <span className="text-primary-600 dark:text-primary-400">
                        {txn.suggestedCategory.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {txn.isDuplicate ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-warning-100 text-warning-700">
                        Doublon
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-success-100 text-success-700">
                        Nouveau
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {preview.validRows > 10 && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            + {preview.validRows - 10} autres transactions
          </p>
        )}
      </div>

      {/* Import Options */}
      <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h3 className="font-medium">Options d'import</h3>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={skipDuplicates}
            onChange={(e) => setSkipDuplicates(e.target.checked)}
            className="w-5 h-5 rounded border-gray-300"
          />
          <div>
            <p className="font-medium">Ignorer les doublons</p>
            <p className="text-sm text-gray-500">
              {preview.duplicates} transaction(s) déjà présente(s)
            </p>
          </div>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={applyRules}
            onChange={(e) => setApplyRules(e.target.checked)}
            className="w-5 h-5 rounded border-gray-300"
          />
          <div>
            <p className="font-medium">Appliquer les règles de catégorisation</p>
            <p className="text-sm text-gray-500">
              Catégorise automatiquement selon vos règles
            </p>
          </div>
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary flex-1">
          Retour
        </button>
        <button
          onClick={onComplete}
          disabled={preview.validRows === 0}
          className="btn-primary flex-1"
        >
          Importer {preview.validRows} transaction{preview.validRows !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}

export default PreviewStep;
