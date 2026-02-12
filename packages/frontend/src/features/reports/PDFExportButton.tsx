// ============================================================================
// PDF EXPORT BUTTON - Finance Hub
// Reusable button component for exporting reports to PDF
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Download, Loader2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type PDFReportType =
  | 'net-worth'
  | 'year-comparison'
  | 'category-trends'
  | 'tax-summary'
  | 'cash-flow'
  | 'profit-loss'
  | 'budget'
  | 'transactions'
  | 'monthly'
  | 'annual';

interface PDFExportButtonProps {
  reportType: PDFReportType;
  params?: {
    year?: number;
    months?: number;
    from?: Date;
    to?: Date;
    country?: 'FR' | 'CH';
  };
  filename?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  showIcon?: boolean;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function PDFExportButton({
  reportType,
  params = {},
  filename,
  className,
  variant = 'secondary',
  size = 'md',
  label,
  showIcon = true,
}: PDFExportButtonProps) {
  const { t } = useTranslation();
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const [isExporting, setIsExporting] = useState(false);
  const buttonLabel = label ?? t('reports.pdfExport.exportPdf');

  const handleExport = async () => {
    if (!workspaceId) return;

    setIsExporting(true);

    try {
      const baseUrl = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '/api/v1';
      const token = localStorage.getItem('accessToken');

      // Determine URL path based on report type
      // New endpoints: transactions/pdf, budget/pdf, monthly/pdf, annual/pdf
      // Legacy endpoints: export-pdf/:type
      const newEndpoints = ['transactions', 'budget', 'monthly', 'annual'];
      const isNewEndpoint = newEndpoints.includes(reportType);

      let url = isNewEndpoint
        ? `${baseUrl}/workspaces/${workspaceId}/reports/${reportType}/pdf`
        : `${baseUrl}/workspaces/${workspaceId}/reports/export-pdf/${reportType}`;

      const queryParams = new URLSearchParams();

      if (params.year) {
        queryParams.append('year', params.year.toString());
      }
      if (params.months) {
        // For new endpoints, 'months' is actually 'month' (1-12)
        queryParams.append(isNewEndpoint ? 'month' : 'months', params.months.toString());
      }
      if (params.from) {
        queryParams.append('from', format(params.from, 'yyyy-MM-dd'));
      }
      if (params.to) {
        queryParams.append('to', format(params.to, 'yyyy-MM-dd'));
      }
      if (params.country) {
        queryParams.append('country', params.country);
      }

      const queryString = queryParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      // Get filename from response or use provided/default
      let downloadFilename = filename;
      if (!downloadFilename) {
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="(.+)"/);
          if (match && match[1]) {
            downloadFilename = match[1];
          }
        }
        if (!downloadFilename) {
          downloadFilename = `${reportType}_${format(new Date(), 'yyyyMMdd')}.pdf`;
        }
      }

      // Download the file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      logger.error('PDF export error', error);
      alert(t('reports.pdfExport.error'));
    } finally {
      setIsExporting(false);
    }
  };

  // Style variants
  const variantStyles = {
    primary: 'bg-ctp-blue text-ctp-base hover:bg-ctp-blue/90',
    secondary: 'bg-ctp-red/10 text-ctp-red hover:bg-ctp-red/20',
    ghost: 'text-ctp-blue hover:bg-ctp-blue/10',
  };

  const sizeStyles = {
    sm: 'px-2 py-1 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting || !workspaceId}
      className={cn(
        'flex items-center rounded-lg font-medium transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {isExporting ? (
        <Loader2 className={cn('animate-spin', iconSizes[size])} />
      ) : showIcon ? (
        <Download className={iconSizes[size]} />
      ) : null}
      {buttonLabel}
    </button>
  );
}

// ----------------------------------------------------------------------------
// Preset Export Buttons
// ----------------------------------------------------------------------------

export function NetWorthPDFButton({ months = 12, ...props }: Omit<PDFExportButtonProps, 'reportType'> & { months?: number }) {
  return (
    <PDFExportButton
      reportType="net-worth"
      params={{ months }}
      label="PDF"
      {...props}
    />
  );
}

export function YearComparisonPDFButton({ year, ...props }: Omit<PDFExportButtonProps, 'reportType'> & { year?: number }) {
  return (
    <PDFExportButton
      reportType="year-comparison"
      params={{ year: year ?? new Date().getFullYear() }}
      label="Exporter PDF"
      {...props}
    />
  );
}

export function CategoryTrendsPDFButton({ months = 6, ...props }: Omit<PDFExportButtonProps, 'reportType'> & { months?: number }) {
  return (
    <PDFExportButton
      reportType="category-trends"
      params={{ months }}
      label="Exporter PDF"
      {...props}
    />
  );
}

export function TaxSummaryPDFButton({ year, country = 'FR', ...props }: Omit<PDFExportButtonProps, 'reportType'> & { year?: number; country?: 'FR' | 'CH' }) {
  return (
    <PDFExportButton
      reportType="tax-summary"
      params={{ year: year ?? new Date().getFullYear() - 1, country }}
      label="Exporter PDF"
      variant="primary"
      {...props}
    />
  );
}

export function CashFlowPDFButton({ from, to, ...props }: Omit<PDFExportButtonProps, 'reportType'> & { from?: Date; to?: Date }) {
  const params: PDFExportButtonProps['params'] = {};
  if (from) params.from = from;
  if (to) params.to = to;

  return (
    <PDFExportButton
      reportType="cash-flow"
      params={params}
      label="Exporter PDF"
      {...props}
    />
  );
}

export function BudgetPDFButton({ year, month, ...props }: Omit<PDFExportButtonProps, 'reportType'> & { year?: number; month?: number }) {
  return (
    <PDFExportButton
      reportType="budget"
      params={{ year: year ?? new Date().getFullYear(), months: month ?? new Date().getMonth() + 1 }}
      label="Exporter PDF"
      {...props}
    />
  );
}

export function MonthlyReportPDFButton({ year, month, ...props }: Omit<PDFExportButtonProps, 'reportType'> & { year?: number; month?: number }) {
  return (
    <PDFExportButton
      reportType="monthly"
      params={{ year: year ?? new Date().getFullYear(), months: month ?? new Date().getMonth() + 1 }}
      label="Exporter PDF"
      {...props}
    />
  );
}

export function AnnualReportPDFButton({ year, ...props }: Omit<PDFExportButtonProps, 'reportType'> & { year?: number }) {
  return (
    <PDFExportButton
      reportType="annual"
      params={{ year: year ?? new Date().getFullYear() }}
      label="Exporter PDF"
      variant="primary"
      {...props}
    />
  );
}

export default PDFExportButton;
