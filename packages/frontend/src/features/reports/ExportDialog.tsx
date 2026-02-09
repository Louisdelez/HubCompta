// ============================================================================
// EXPORT DIALOG COMPONENT - Finance Hub
// Dialog for exporting data
// ============================================================================

import { useState } from 'react';
import { format } from 'date-fns';
import { X, Download, FileText, FileJson, Loader2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { cn } from '@/lib/utils';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type ExportType =
  | 'transactions'
  | 'categories'
  | 'accounts'
  | 'budget_report'
  | 'cash_flow'
  | 'profit_loss'
  | 'invoices'
  | 'quotes';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  type: ExportType;
  dateRange?: { from: Date; to: Date };
  title?: string;
}

const exportLabels: Record<ExportType, string> = {
  transactions: 'Transactions',
  categories: 'Catégories',
  accounts: 'Comptes',
  budget_report: 'Rapport budgétaire',
  cash_flow: 'Flux de trésorerie',
  profit_loss: 'Compte de résultat',
  invoices: 'Factures',
  quotes: 'Devis',
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ExportDialog({
  isOpen,
  onClose,
  type,
  dateRange,
  title,
}: ExportDialogProps) {
  const { currentWorkspace } = useWorkspace();
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!currentWorkspace) return;

    setIsExporting(true);

    try {
      // Build URL
      const baseUrl = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? 'http://localhost:3000/api/v1';
      let url = `${baseUrl}/workspaces/${currentWorkspace.id}/reports/export/${type}?format=${exportFormat}`;

      // Add date range if provided
      if (dateRange) {
        url += `&from=${format(dateRange.from, 'yyyy-MM-dd')}&to=${format(dateRange.to, 'yyyy-MM-dd')}`;
      }

      // Get token from storage
      const token = localStorage.getItem('accessToken');

      // Fetch the export
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${type}_export.${exportFormat}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      onClose();
    } catch (error) {
      console.error('Export error:', error);
      alert("Erreur lors de l'export");
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title || `Exporter - ${exportLabels[type]}`}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Date range info */}
          {dateRange && (
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Période:{' '}
                <span className="font-medium text-gray-900 dark:text-white">
                  {format(dateRange.from, 'dd/MM/yyyy')} - {format(dateRange.to, 'dd/MM/yyyy')}
                </span>
              </p>
            </div>
          )}

          {/* Format selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Format</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExportFormat('csv')}
                className={cn(
                  'flex items-center justify-center gap-2 px-4 py-3 border rounded-lg',
                  exportFormat === 'csv'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <FileText className="h-5 w-5" />
                <div className="text-left">
                  <p className="font-medium">CSV</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Excel, tableurs</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('json')}
                className={cn(
                  'flex items-center justify-center gap-2 px-4 py-3 border rounded-lg',
                  exportFormat === 'json'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <FileJson className="h-5 w-5" />
                <div className="text-left">
                  <p className="font-medium">JSON</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Données brutes</p>
                </div>
              </button>
            </div>
          </div>

          {/* Info */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Le fichier sera téléchargé automatiquement après la génération.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 dark:bg-gray-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
          >
            Annuler
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className={cn(
              'px-4 py-2 text-white rounded-lg flex items-center gap-2',
              'bg-blue-600 hover:bg-blue-700',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Exporter
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportDialog;
