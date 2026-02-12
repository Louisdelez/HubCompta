// ============================================================================
// PREVIEW STEP - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        <div className="animate-spin w-12 h-12 border-4 border-ctp-blue border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-ctp-subtext0">{t('import.preview.analyzingData')}</p>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-10 h-10 mx-auto mb-4 text-ctp-red" />
        <p className="text-ctp-red mb-4">
          {error instanceof Error ? error.message : t('import.preview.analysisError')}
        </p>
        <button onClick={onBack} className="btn-secondary">
          {t('import.preview.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">{t('import.preview.title')}</h2>
        <p className="text-ctp-subtext0 text-sm">
          {t('import.preview.description')}
        </p>
      </div>

      {/* Warnings */}
      {preview.warnings.length > 0 && (
        <div className="p-4 bg-ctp-yellow/10 border border-ctp-yellow/30 rounded-lg">
          <p className="font-medium text-ctp-yellow mb-2">
            {t('import.preview.warnings')}
          </p>
          <ul className="list-disc list-inside text-sm text-ctp-yellow">
            {preview.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-ctp-surface0 rounded-lg text-center">
          <p className="text-2xl font-bold">{preview.totalRows}</p>
          <p className="text-sm text-ctp-subtext0">{t('import.preview.totalRows')}</p>
        </div>
        <div className="p-4 bg-ctp-green/10 border border-ctp-green/30 rounded-lg text-center">
          <p className="text-2xl font-bold text-ctp-green">{preview.validRows}</p>
          <p className="text-sm text-ctp-green">{t('import.preview.valid')}</p>
        </div>
        <div className="p-4 bg-ctp-yellow/10 border border-ctp-yellow/30 rounded-lg text-center">
          <p className="text-2xl font-bold text-ctp-yellow">{preview.duplicates}</p>
          <p className="text-sm text-ctp-yellow">{t('import.preview.duplicates')}</p>
        </div>
      </div>

      {/* Sample Transactions */}
      <div>
        <h3 className="font-medium mb-3">{t('import.preview.transactionsPreview')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ctp-surface1">
                <th className="text-left py-2 px-3">{t('import.preview.date')}</th>
                <th className="text-left py-2 px-3">{t('import.preview.description')}</th>
                <th className="text-right py-2 px-3">{t('import.preview.amount')}</th>
                <th className="text-left py-2 px-3">{t('import.preview.category')}</th>
                <th className="text-center py-2 px-3">{t('import.preview.status')}</th>
              </tr>
            </thead>
            <tbody>
              {preview.sampleTransactions.map((txn, i) => (
                <tr
                  key={i}
                  className={clsx(
                    'border-b border-ctp-surface0',
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
                      txn.amount >= 0 ? 'text-ctp-green' : ''
                    )}
                  >
                    {formatCurrency(txn.amount)}
                  </td>
                  <td className="py-2 px-3">
                    {txn.suggestedCategory ? (
                      <span className="text-ctp-blue">
                        {txn.suggestedCategory.name}
                      </span>
                    ) : (
                      <span className="text-ctp-overlay1">-</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {txn.isDuplicate ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-ctp-yellow/20 text-ctp-yellow">
                        {t('import.preview.duplicate')}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-ctp-green/20 text-ctp-green">
                        {t('import.preview.new')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {preview.validRows > 10 && (
          <p className="text-xs text-ctp-subtext0 mt-2 text-center">
            {t('import.preview.moreTransactions', { count: preview.validRows - 10 })}
          </p>
        )}
      </div>

      {/* Import Options */}
      <div className="space-y-3 p-4 bg-ctp-surface0 rounded-lg">
        <h3 className="font-medium">{t('import.preview.importOptions')}</h3>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={skipDuplicates}
            onChange={(e) => setSkipDuplicates(e.target.checked)}
            className="w-5 h-5 rounded border-ctp-surface1"
          />
          <div>
            <p className="font-medium">{t('import.preview.skipDuplicates')}</p>
            <p className="text-sm text-ctp-subtext0">
              {t('import.preview.skipDuplicatesDescription', { count: preview.duplicates })}
            </p>
          </div>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={applyRules}
            onChange={(e) => setApplyRules(e.target.checked)}
            className="w-5 h-5 rounded border-ctp-surface1"
          />
          <div>
            <p className="font-medium">{t('import.preview.applyCategorization')}</p>
            <p className="text-sm text-ctp-subtext0">
              {t('import.preview.applyCategorizationDescription')}
            </p>
          </div>
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary flex-1">
          {t('import.preview.back')}
        </button>
        <button
          onClick={onComplete}
          disabled={preview.validRows === 0}
          className="btn-primary flex-1"
        >
          {t('import.preview.importCount', { count: preview.validRows })}
        </button>
      </div>
    </div>
  );
}

export default PreviewStep;
