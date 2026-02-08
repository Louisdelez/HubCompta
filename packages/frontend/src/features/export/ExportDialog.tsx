// ============================================================================
// EXPORT DIALOG - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type ExportType = 'transactions' | 'accounts' | 'backup' | 'report';
type ExportFormat = 'csv' | 'json' | 'excel';
type ReportType = 'monthly' | 'yearly' | 'category' | 'account';

interface Account {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface ExportDialogProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  initialType?: ExportType;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ExportDialog({ workspaceId, isOpen, onClose, initialType = 'transactions' }: ExportDialogProps) {
  // State
  const [exportType, setExportType] = useState<ExportType>(initialType);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);

  // Report options
  const [reportType, setReportType] = useState<ReportType>('monthly');
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportAccountId, setReportAccountId] = useState('');

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts', workspaceId],
    queryFn: () => api.get<Account[]>(`/workspaces/${workspaceId}/accounts`),
    enabled: isOpen,
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories', workspaceId],
    queryFn: () => api.get<Category[]>(`/workspaces/${workspaceId}/categories`),
    enabled: isOpen,
  });

  // Download function
  const downloadFile = (data: Blob, filename: string) => {
    const url = window.URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Export mutations
  const exportMutation = useMutation({
    mutationFn: async () => {
      let url: string;
      let filename: string;

      switch (exportType) {
        case 'transactions': {
          const params = new URLSearchParams({ format });
          if (dateFrom) params.set('dateFrom', dateFrom);
          if (dateTo) params.set('dateTo', dateTo);
          if (selectedAccounts.length) params.set('accountIds', selectedAccounts.join(','));
          if (selectedCategories.length) params.set('categoryIds', selectedCategories.join(','));
          if (includeArchived) params.set('includeArchived', 'true');
          url = `/workspaces/${workspaceId}/export/transactions?${params}`;
          filename = `transactions.${format === 'json' ? 'json' : 'csv'}`;
          break;
        }
        case 'accounts': {
          const params = new URLSearchParams({ format });
          if (includeArchived) params.set('includeArchived', 'true');
          url = `/workspaces/${workspaceId}/export/accounts?${params}`;
          filename = `accounts.${format === 'json' ? 'json' : 'csv'}`;
          break;
        }
        case 'backup':
          url = `/workspaces/${workspaceId}/export/backup`;
          filename = 'backup.json';
          break;
        case 'report': {
          const params = new URLSearchParams({
            type: reportType,
            year: reportYear.toString(),
          });
          if (reportType === 'monthly' || reportType === 'category') {
            params.set('month', reportMonth.toString());
          }
          if (reportType === 'account' && reportAccountId) {
            params.set('accountId', reportAccountId);
          }
          url = `/workspaces/${workspaceId}/export/report?${params}`;
          filename = `report_${reportType}.html`;
          break;
        }
        default:
          throw new Error('Invalid export type');
      }

      const response = await fetch(`/api/v1${url}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const actualFilename = filenameMatch?.[1] ?? filename;

      downloadFile(blob, actualFilename);
    },
    onSuccess: () => {
      onClose();
    },
  });

  if (!isOpen) return null;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Exporter les données</h2>

          {/* Export Type */}
          <div className="mb-6">
            <label className="label">Type d'export</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'transactions', label: 'Transactions', icon: '💳' },
                { value: 'accounts', label: 'Comptes', icon: '🏦' },
                { value: 'backup', label: 'Sauvegarde complète', icon: '💾' },
                { value: 'report', label: 'Rapport', icon: '📊' },
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setExportType(type.value as ExportType)}
                  className={clsx(
                    'p-3 rounded-lg border-2 text-left transition-colors',
                    exportType === type.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  )}
                >
                  <span className="text-lg mr-2">{type.icon}</span>
                  <span className="font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Format (for transactions and accounts) */}
          {(exportType === 'transactions' || exportType === 'accounts') && (
            <div className="mb-4">
              <label className="label">Format</label>
              <div className="flex gap-2">
                {[
                  { value: 'csv', label: 'CSV' },
                  { value: 'json', label: 'JSON' },
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value as ExportFormat)}
                    className={clsx(
                      'px-4 py-2 rounded-lg font-medium transition-colors',
                      format === f.value
                        ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Transaction filters */}
          {exportType === 'transactions' && (
            <>
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="label">Date de début</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Date de fin</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              {/* Account Filter */}
              <div className="mb-4">
                <label className="label">Comptes (optionnel)</label>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                  {accounts?.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => {
                        setSelectedAccounts((prev) =>
                          prev.includes(account.id)
                            ? prev.filter((id) => id !== account.id)
                            : [...prev, account.id]
                        );
                      }}
                      className={clsx(
                        'px-3 py-1 rounded-lg text-sm transition-colors',
                        selectedAccounts.includes(account.id)
                          ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      )}
                    >
                      {account.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Filter */}
              <div className="mb-4">
                <label className="label">Catégories (optionnel)</label>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                  {categories?.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => {
                        setSelectedCategories((prev) =>
                          prev.includes(category.id)
                            ? prev.filter((id) => id !== category.id)
                            : [...prev, category.id]
                        );
                      }}
                      className={clsx(
                        'px-3 py-1 rounded-lg text-sm transition-colors',
                        selectedCategories.includes(category.id)
                          ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      )}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Report options */}
          {exportType === 'report' && (
            <>
              <div className="mb-4">
                <label className="label">Type de rapport</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as ReportType)}
                  className="input"
                >
                  <option value="monthly">Rapport mensuel</option>
                  <option value="yearly">Rapport annuel</option>
                  <option value="category">Rapport par catégorie</option>
                  <option value="account">Rapport de compte</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="label">Année</label>
                  <select
                    value={reportYear}
                    onChange={(e) => setReportYear(parseInt(e.target.value, 10))}
                    className="input"
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                {(reportType === 'monthly' || reportType === 'category') && (
                  <div>
                    <label className="label">Mois</label>
                    <select
                      value={reportMonth}
                      onChange={(e) => setReportMonth(parseInt(e.target.value, 10))}
                      className="input"
                    >
                      {months.map((month, idx) => (
                        <option key={idx} value={idx + 1}>{month}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {reportType === 'account' && (
                <div className="mb-4">
                  <label className="label">Compte</label>
                  <select
                    value={reportAccountId}
                    onChange={(e) => setReportAccountId(e.target.value)}
                    className="input"
                  >
                    <option value="">Sélectionner un compte</option>
                    {accounts?.map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* Include Archived */}
          {(exportType === 'transactions' || exportType === 'accounts') && (
            <label className="flex items-center gap-2 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm">Inclure les éléments archivés</span>
            </label>
          )}

          {/* Backup info */}
          {exportType === 'backup' && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                La sauvegarde complète inclut toutes vos données: comptes, transactions,
                catégories, budgets, règles et récurrences au format JSON.
              </p>
            </div>
          )}

          {/* Error */}
          {exportMutation.error && (
            <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg text-danger-600 dark:text-danger-400 text-sm">
              Une erreur est survenue lors de l'export
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">
              Annuler
            </button>
            <button
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending || (exportType === 'report' && reportType === 'account' && !reportAccountId)}
              className="btn-primary flex-1"
            >
              {exportMutation.isPending ? 'Export en cours...' : 'Exporter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExportDialog;
