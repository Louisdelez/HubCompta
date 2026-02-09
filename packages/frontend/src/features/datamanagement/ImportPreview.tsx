// ============================================================================
// IMPORT PREVIEW - Finance Hub
// Preview imported data before executing
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertTriangle,
  Copy,
  FileText,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ImportPreviewProps {
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
  dateFormat: string; // Used for display purposes
  onBack: () => void;
  onComplete: () => void;
  onPreviewData: (data: PreviewData) => void;
}


interface PreviewData {
  totalRows: number;
  validRows: number;
  duplicates: number;
  sampleTransactions: Array<{
    date: string;
    amount: number;
    description: string;
    isDuplicate: boolean;
    suggestedCategory?: { id: string; name: string };
  }>;
  warnings?: string[];
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ImportPreview({
  workspaceId,
  jobId,
  accountId,
  columnMapping,
  dateFormat: _dateFormat,
  onBack,
  onComplete,
  onPreviewData,
}: ImportPreviewProps) {
  // dateFormat is passed for potential future use
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [applyRules, setApplyRules] = useState(true);

  // Fetch preview data
  const previewMutation = useMutation({
    mutationFn: () =>
      api.post<PreviewData>(`/workspaces/${workspaceId}/import/preview`, {
        jobId,
        accountId,
        columnMapping,
      }),
    onSuccess: (data) => {
      setPreviewData(data);
      onPreviewData(data);
    },
  });

  // Load preview on mount
  useEffect(() => {
    previewMutation.mutate();
  }, []);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  if (previewMutation.isPending || !previewData) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-ctp-blue mb-4" />
        <p className="text-ctp-subtext0">Analyse du fichier en cours...</p>
      </div>
    );
  }

  if (previewMutation.error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-ctp-red" />
        <p className="text-ctp-red mb-4">
          Erreur lors de l'analyse du fichier
        </p>
        <button onClick={onBack} className="btn-secondary">
          Retour
        </button>
      </div>
    );
  }

  const importableRows = skipDuplicates
    ? previewData.validRows - previewData.duplicates
    : previewData.validRows;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ctp-text mb-2">
          Apercu de l'import
        </h2>
        <p className="text-ctp-subtext0 text-sm">
          Verifiez les donnees avant de lancer l'import.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-ctp-surface0 rounded-lg text-center">
          <FileText className="w-6 h-6 mx-auto mb-2 text-ctp-blue" />
          <p className="text-2xl font-bold text-ctp-text">{previewData.totalRows}</p>
          <p className="text-sm text-ctp-subtext0">Lignes totales</p>
        </div>
        <div className="p-4 bg-ctp-surface0 rounded-lg text-center">
          <Check className="w-6 h-6 mx-auto mb-2 text-ctp-green" />
          <p className="text-2xl font-bold text-ctp-green">{previewData.validRows}</p>
          <p className="text-sm text-ctp-subtext0">Lignes valides</p>
        </div>
        <div className="p-4 bg-ctp-surface0 rounded-lg text-center">
          <Copy className="w-6 h-6 mx-auto mb-2 text-ctp-yellow" />
          <p className="text-2xl font-bold text-ctp-yellow">{previewData.duplicates}</p>
          <p className="text-sm text-ctp-subtext0">Doublons detectes</p>
        </div>
      </div>

      {/* Warnings */}
      {previewData.warnings && previewData.warnings.length > 0 && (
        <div className="p-4 bg-ctp-yellow/10 border border-ctp-yellow/30 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-ctp-yellow flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-ctp-yellow mb-1">Attention</p>
              <ul className="text-sm text-ctp-yellow/90 space-y-1">
                {previewData.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Sample Transactions */}
      <div>
        <h3 className="text-sm font-medium text-ctp-text mb-3">
          Apercu des transactions ({Math.min(10, previewData.sampleTransactions.length)} sur {previewData.validRows})
        </h3>
        <div className="bg-ctp-base rounded-lg border border-ctp-surface1 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ctp-surface1 bg-ctp-surface0">
                  <th className="text-left p-3 font-medium text-ctp-subtext0">Date</th>
                  <th className="text-left p-3 font-medium text-ctp-subtext0">Description</th>
                  <th className="text-right p-3 font-medium text-ctp-subtext0">Montant</th>
                  <th className="text-left p-3 font-medium text-ctp-subtext0">Categorie</th>
                  <th className="text-center p-3 font-medium text-ctp-subtext0">Statut</th>
                </tr>
              </thead>
              <tbody>
                {previewData.sampleTransactions.map((txn, index) => (
                  <tr
                    key={index}
                    className={clsx(
                      'border-b border-ctp-surface0 last:border-0',
                      txn.isDuplicate && 'bg-ctp-yellow/5'
                    )}
                  >
                    <td className="p-3 text-ctp-text whitespace-nowrap">
                      {formatDate(txn.date)}
                    </td>
                    <td className="p-3 text-ctp-text">
                      <span className="line-clamp-1">{txn.description}</span>
                    </td>
                    <td
                      className={clsx(
                        'p-3 text-right font-mono whitespace-nowrap',
                        txn.amount >= 0 ? 'text-ctp-green' : 'text-ctp-red'
                      )}
                    >
                      {formatAmount(txn.amount)}
                    </td>
                    <td className="p-3 text-ctp-subtext0">
                      {txn.suggestedCategory?.name ?? (
                        <span className="text-ctp-overlay0 italic">Non categorise</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {txn.isDuplicate ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-ctp-yellow/20 text-ctp-yellow">
                          <Copy className="w-3 h-3" />
                          Doublon
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-ctp-green/20 text-ctp-green">
                          <Check className="w-3 h-3" />
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Import Options */}
      <div className="p-4 bg-ctp-surface0 rounded-lg space-y-3">
        <h3 className="text-sm font-medium text-ctp-text mb-2">
          Options d'import
        </h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={skipDuplicates}
            onChange={(e) => setSkipDuplicates(e.target.checked)}
            className="w-4 h-4 rounded border-ctp-surface1 text-ctp-blue focus:ring-ctp-blue"
          />
          <span className="text-sm text-ctp-text">
            Ignorer les doublons detectes
          </span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={applyRules}
            onChange={(e) => setApplyRules(e.target.checked)}
            className="w-4 h-4 rounded border-ctp-surface1 text-ctp-blue focus:ring-ctp-blue"
          />
          <span className="text-sm text-ctp-text">
            Appliquer les regles de categorisation
          </span>
        </label>
      </div>

      {/* Import Summary */}
      <div className="p-4 bg-ctp-blue/10 border border-ctp-blue/30 rounded-lg">
        <p className="text-sm text-ctp-blue">
          <strong>{importableRows}</strong> transactions seront importees
          {skipDuplicates && previewData.duplicates > 0 && (
            <span> ({previewData.duplicates} doublons ignores)</span>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
        <button
          onClick={onComplete}
          disabled={importableRows === 0}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
        >
          Lancer l'import
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default ImportPreview;
