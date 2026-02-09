// ============================================================================
// EXPORT MODAL - Finance Hub
// Configure export options: format, date range, entity types
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X, Download, FileText, FileJson, FileSpreadsheet, Paperclip, Loader2, type LucideIcon } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ExportModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
}

type ExportFormat = 'csv' | 'json' | 'excel';

interface Account {
  id: string;
  name: string;
  type: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ExportModal({ workspaceId, isOpen, onClose, entityType }: ExportModalProps) {
  // State
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [includeAttachments, setIncludeAttachments] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormat('csv');
      setDateFrom('');
      setDateTo('');
      setSelectedAccounts([]);
      setSelectedCategories([]);
      setIncludeArchived(false);
      setIncludeAttachments(false);
    }
  }, [isOpen, entityType]);

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts', workspaceId],
    queryFn: () => api.get<Account[]>(`/workspaces/${workspaceId}/accounts`),
    enabled: isOpen && (entityType === 'transactions' || entityType === 'accounts'),
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories', workspaceId],
    queryFn: () => api.get<Category[]>(`/workspaces/${workspaceId}/categories`),
    enabled: isOpen && (entityType === 'transactions' || entityType === 'categories'),
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

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      let url: string;
      let filename: string;

      const baseUrl = `/workspaces/${workspaceId}/export`;

      switch (entityType) {
        case 'transactions': {
          const params = new URLSearchParams({ format });
          if (dateFrom) params.set('dateFrom', dateFrom);
          if (dateTo) params.set('dateTo', dateTo);
          if (selectedAccounts.length) params.set('accountIds', selectedAccounts.join(','));
          if (selectedCategories.length) params.set('categoryIds', selectedCategories.join(','));
          if (includeArchived) params.set('includeArchived', 'true');
          url = `${baseUrl}/transactions?${params}`;
          filename = `transactions_${new Date().toISOString().split('T')[0]}.${format === 'json' ? 'json' : 'csv'}`;
          break;
        }
        case 'accounts': {
          const params = new URLSearchParams({ format });
          if (includeArchived) params.set('includeArchived', 'true');
          url = `${baseUrl}/accounts?${params}`;
          filename = `accounts_${new Date().toISOString().split('T')[0]}.${format === 'json' ? 'json' : 'csv'}`;
          break;
        }
        case 'backup':
          url = `${baseUrl}/backup`;
          filename = `backup_${new Date().toISOString().split('T')[0]}.json`;
          break;
        default:
          // For other entity types, use backup endpoint for now
          url = `${baseUrl}/backup`;
          filename = `${entityType}_${new Date().toISOString().split('T')[0]}.json`;
      }

      const response = await fetch(`/api/v1${url}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
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

  const formatOptions: { value: ExportFormat; label: string; icon: LucideIcon }[] = [
    { value: 'csv', label: 'CSV', icon: FileText },
    { value: 'json', label: 'JSON', icon: FileJson },
    { value: 'excel', label: 'Excel', icon: FileSpreadsheet },
  ];

  const showDateFilters = entityType === 'transactions';
  const showAccountFilter = entityType === 'transactions';
  const showCategoryFilter = entityType === 'transactions';
  const showFormatSelector = entityType !== 'backup';
  const showArchivedOption = entityType === 'transactions' || entityType === 'accounts';
  const showAttachmentsOption = entityType === 'backup';

  const getTitle = () => {
    switch (entityType) {
      case 'transactions':
        return 'Exporter les transactions';
      case 'accounts':
        return 'Exporter les comptes';
      case 'categories':
        return 'Exporter les categories';
      case 'tags':
        return 'Exporter les tags';
      case 'budgets':
        return 'Exporter les budgets';
      case 'rules':
        return 'Exporter les regles';
      case 'recurrences':
        return 'Exporter les recurrences';
      case 'backup':
        return 'Sauvegarde complete';
      default:
        return 'Exporter';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ctp-crust/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto border border-ctp-surface1">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ctp-surface1">
          <h2 className="text-lg font-semibold text-ctp-text">{getTitle()}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-ctp-surface1 transition-colors"
          >
            <X className="w-5 h-5 text-ctp-subtext0" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-5">
          {/* Format Selection */}
          {showFormatSelector && (
            <div>
              <label className="block text-sm font-medium text-ctp-text mb-2">
                Format d'export
              </label>
              <div className="flex gap-2">
                {formatOptions.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setFormat(opt.value)}
                      className={clsx(
                        'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all',
                        format === opt.value
                          ? 'bg-ctp-blue text-ctp-crust'
                          : 'bg-ctp-surface0 text-ctp-subtext0 hover:bg-ctp-surface1'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Date Range */}
          {showDateFilters && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ctp-text mb-2">
                  Date de debut
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ctp-text mb-2">
                  Date de fin
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="input w-full"
                />
              </div>
            </div>
          )}

          {/* Account Filter */}
          {showAccountFilter && accounts && accounts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-ctp-text mb-2">
                Filtrer par compte (optionnel)
              </label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 bg-ctp-surface0 rounded-lg">
                {accounts.map((account) => (
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
                      'px-3 py-1.5 rounded-md text-sm transition-colors',
                      selectedAccounts.includes(account.id)
                        ? 'bg-ctp-blue text-ctp-crust'
                        : 'bg-ctp-surface1 text-ctp-subtext0 hover:text-ctp-text'
                    )}
                  >
                    {account.name}
                  </button>
                ))}
              </div>
              {selectedAccounts.length > 0 && (
                <button
                  onClick={() => setSelectedAccounts([])}
                  className="text-xs text-ctp-blue mt-1 hover:underline"
                >
                  Effacer la selection
                </button>
              )}
            </div>
          )}

          {/* Category Filter */}
          {showCategoryFilter && categories && categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-ctp-text mb-2">
                Filtrer par categorie (optionnel)
              </label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 bg-ctp-surface0 rounded-lg">
                {categories.map((category) => (
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
                      'px-3 py-1.5 rounded-md text-sm transition-colors',
                      selectedCategories.includes(category.id)
                        ? 'bg-ctp-mauve text-ctp-crust'
                        : 'bg-ctp-surface1 text-ctp-subtext0 hover:text-ctp-text'
                    )}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
              {selectedCategories.length > 0 && (
                <button
                  onClick={() => setSelectedCategories([])}
                  className="text-xs text-ctp-blue mt-1 hover:underline"
                >
                  Effacer la selection
                </button>
              )}
            </div>
          )}

          {/* Options */}
          <div className="space-y-3">
            {showArchivedOption && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="w-4 h-4 rounded border-ctp-surface1 text-ctp-blue focus:ring-ctp-blue focus:ring-offset-ctp-base"
                />
                <span className="text-sm text-ctp-text">
                  Inclure les elements archives
                </span>
              </label>
            )}

            {showAttachmentsOption && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAttachments}
                  onChange={(e) => setIncludeAttachments(e.target.checked)}
                  className="w-4 h-4 rounded border-ctp-surface1 text-ctp-blue focus:ring-ctp-blue focus:ring-offset-ctp-base"
                />
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-ctp-subtext0" />
                  <span className="text-sm text-ctp-text">
                    Inclure les pieces jointes
                  </span>
                </div>
              </label>
            )}
          </div>

          {/* Backup Info */}
          {entityType === 'backup' && (
            <div className="p-4 bg-ctp-blue/10 border border-ctp-blue/30 rounded-lg">
              <p className="text-sm text-ctp-blue">
                La sauvegarde complete inclut toutes vos donnees : comptes, transactions,
                categories, budgets, regles et recurrences au format JSON.
              </p>
            </div>
          )}

          {/* Error */}
          {exportMutation.error && (
            <div className="p-3 bg-ctp-red/10 border border-ctp-red/30 rounded-lg text-ctp-red text-sm">
              Une erreur est survenue lors de l'export. Veuillez reessayer.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-ctp-surface1">
          <button onClick={onClose} className="btn-secondary flex-1">
            Annuler
          </button>
          <button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            className="btn-primary flex-1 inline-flex items-center justify-center gap-2"
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Export en cours...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Exporter
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportModal;
