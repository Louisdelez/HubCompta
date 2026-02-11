// ============================================================================
// EXPORT DIALOG COMPONENT - Finance Hub
// Dialog for exporting data
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { format } from 'date-fns';
import { X, Download, FileText, FileJson, File, Loader2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

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
  | 'quotes'
  | 'net_worth'
  | 'year_comparison'
  | 'category_trends'
  | 'tax_summary';

export type ExportFormat = 'csv' | 'json' | 'pdf';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  type: ExportType;
  dateRange?: { from: Date; to: Date };
  year?: number;
  months?: number;
  title?: string;
  supportsPDF?: boolean;
}

const exportLabels: Record<ExportType, string> = {
  transactions: 'Transactions',
  categories: 'Categories',
  accounts: 'Comptes',
  budget_report: 'Rapport budgetaire',
  cash_flow: 'Flux de tresorerie',
  profit_loss: 'Compte de resultat',
  invoices: 'Factures',
  quotes: 'Devis',
  net_worth: 'Patrimoine',
  year_comparison: 'Comparaison annuelle',
  category_trends: 'Tendances categories',
  tax_summary: 'Resume fiscal',
};

// Map export types to PDF endpoint types
const pdfTypeMap: Partial<Record<ExportType, string>> = {
  budget_report: 'budget',
  cash_flow: 'cash-flow',
  profit_loss: 'profit-loss',
  net_worth: 'net-worth',
  year_comparison: 'year-comparison',
  category_trends: 'category-trends',
  tax_summary: 'tax-summary',
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ExportDialog({
  isOpen,
  onClose,
  type,
  dateRange,
  year,
  months,
  title,
  supportsPDF = false,
}: ExportDialogProps) {
  const { currentWorkspace } = useWorkspace();

  // Determine if PDF is supported for this type
  const canExportPDF = supportsPDF || !!pdfTypeMap[type];
  const [exportFormat, setExportFormat] = useState<ExportFormat>(canExportPDF ? 'pdf' : 'csv');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!currentWorkspace) return;

    setIsExporting(true);

    try {
      const baseUrl = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? 'http://localhost:3000/api/v1';
      const token = localStorage.getItem('accessToken');
      let url: string;
      let filename: string;

      if (exportFormat === 'pdf' && pdfTypeMap[type]) {
        // Use PDF export endpoint
        const pdfType = pdfTypeMap[type];
        url = `${baseUrl}/workspaces/${currentWorkspace.id}/reports/export-pdf/${pdfType}`;

        // Add query params
        const params = new URLSearchParams();
        if (dateRange) {
          params.append('from', format(dateRange.from, 'yyyy-MM-dd'));
          params.append('to', format(dateRange.to, 'yyyy-MM-dd'));
        }
        if (year) {
          params.append('year', year.toString());
        }
        if (months) {
          params.append('months', months.toString());
        }

        if (params.toString()) {
          url += `?${params.toString()}`;
        }

        filename = `${type}_${format(new Date(), 'yyyyMMdd')}.pdf`;
      } else {
        // Use standard export endpoint
        url = `${baseUrl}/workspaces/${currentWorkspace.id}/reports/export/${type}?format=${exportFormat}`;

        // Add date range if provided
        if (dateRange) {
          url += `&from=${format(dateRange.from, 'yyyy-MM-dd')}&to=${format(dateRange.to, 'yyyy-MM-dd')}`;
        }

        filename = `${type}_export.${exportFormat}`;
      }

      // Fetch the export
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from Content-Disposition header if available
      const contentDisposition = response.headers.get('Content-Disposition');
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
      logger.error('Export error', error);
      alert("Erreur lors de l'export");
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-ctp-surface0 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ctp-surface1">
          <h2 className="text-lg font-semibold text-ctp-text">
            {title || `Exporter - ${exportLabels[type]}`}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-ctp-overlay1 hover:text-ctp-text rounded-full hover:bg-ctp-surface1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Date range info */}
          {dateRange && (
            <div className="p-3 bg-ctp-surface1 rounded-lg">
              <p className="text-sm text-ctp-subtext0">
                Période:{' '}
                <span className="font-medium text-ctp-text">
                  {format(dateRange.from, 'dd/MM/yyyy')} - {format(dateRange.to, 'dd/MM/yyyy')}
                </span>
              </p>
            </div>
          )}

          {/* Format selection */}
          <div>
            <label className="block text-sm font-medium text-ctp-subtext1 mb-2">Format</label>
            <div className={cn('grid gap-3', canExportPDF ? 'grid-cols-3' : 'grid-cols-2')}>
              {canExportPDF && (
                <button
                  type="button"
                  onClick={() => setExportFormat('pdf')}
                  className={cn(
                    'flex items-center justify-center gap-2 px-4 py-3 border rounded-lg',
                    exportFormat === 'pdf'
                      ? 'border-ctp-red bg-ctp-red/10 text-ctp-red'
                      : 'border-ctp-surface1 hover:border-ctp-surface2'
                  )}
                >
                  <File className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">PDF</p>
                    <p className="text-xs text-ctp-subtext0">Rapport complet</p>
                  </div>
                </button>
              )}
              <button
                type="button"
                onClick={() => setExportFormat('csv')}
                className={cn(
                  'flex items-center justify-center gap-2 px-4 py-3 border rounded-lg',
                  exportFormat === 'csv'
                    ? 'border-ctp-blue bg-ctp-blue/10 text-ctp-blue'
                    : 'border-ctp-surface1 hover:border-ctp-surface2'
                )}
              >
                <FileText className="h-5 w-5" />
                <div className="text-left">
                  <p className="font-medium">CSV</p>
                  <p className="text-xs text-ctp-subtext0">Excel, tableurs</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('json')}
                className={cn(
                  'flex items-center justify-center gap-2 px-4 py-3 border rounded-lg',
                  exportFormat === 'json'
                    ? 'border-ctp-blue bg-ctp-blue/10 text-ctp-blue'
                    : 'border-ctp-surface1 hover:border-ctp-surface2'
                )}
              >
                <FileJson className="h-5 w-5" />
                <div className="text-left">
                  <p className="font-medium">JSON</p>
                  <p className="text-xs text-ctp-subtext0">Donnees brutes</p>
                </div>
              </button>
            </div>
          </div>

          {/* Info */}
          <p className="text-xs text-ctp-subtext0">
            Le fichier sera téléchargé automatiquement après la génération.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-ctp-surface1 bg-ctp-surface1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-ctp-subtext1 bg-ctp-surface0 border border-ctp-surface1 rounded-lg hover:bg-ctp-surface1"
          >
            Annuler
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className={cn(
              'px-4 py-2 text-ctp-base rounded-lg flex items-center gap-2',
              'bg-ctp-blue hover:bg-ctp-blue/90',
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
