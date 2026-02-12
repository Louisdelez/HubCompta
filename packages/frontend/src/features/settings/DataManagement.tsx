// ============================================================================
// DATA MANAGEMENT - Finance Hub
// GDPR data export and account deletion
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Download,
  Trash2,
  Loader2,
  AlertTriangle,
  Database,
  FileJson,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface DataSummary {
  user: {
    email: string;
    displayName: string | null;
    locale: string;
    timezone: string;
    createdAt: string;
  };
  counts: {
    workspaces: number;
    devices: number;
    sessions: number;
    mfaMethods: number;
    alertRules: number;
    notifications: number;
  };
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function DataManagement() {
  const { t } = useTranslation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [exportSuccess, setExportSuccess] = useState(false);

  // Fetch data summary
  const { data: summary, isLoading } = useQuery({
    queryKey: ['data-summary'],
    queryFn: () => api.get<DataSummary>('/settings/data/summary'),
  });

  // Export data mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/settings/data/export');
      return response;
    },
    onSuccess: (response) => {
      // Create download link
      const blob = new Blob([JSON.stringify(response, null, 2)], {
        type: 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hubcompta-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    },
  });

  // Delete account mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete('/settings/data/account');
    },
    onSuccess: () => {
      // Redirect to login or homepage
      window.location.href = '/';
    },
  });

  // Get the confirmation word based on locale (SUPPRIMER for FR, DELETE for EN)
  const deleteConfirmWord = t('settings.data.deleteConfirmWord', { defaultValue: 'DELETE' });

  const handleDelete = () => {
    if (deleteConfirmText === deleteConfirmWord) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-ctp-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data Summary */}
      <div className="bg-ctp-mantle rounded-lg shadow">
        <div className="px-6 py-4 border-b border-ctp-surface1">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-ctp-peach" />
            <div>
              <h2 className="text-lg font-semibold text-ctp-text">
                {t('settings.data.dataSummary')}
              </h2>
              <p className="text-sm text-ctp-subtext0">
                {t('settings.data.dataStoredOverview')}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {summary && (
            <>
              {/* User info */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-ctp-subtext1 mb-2">
                  {t('settings.data.accountInfo')}
                </h3>
                <div className="bg-ctp-surface0 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-ctp-subtext0">{t('settings.data.email')}</span>
                    <span className="text-ctp-text">{summary.user.email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ctp-subtext0">{t('settings.data.name')}</span>
                    <span className="text-ctp-text">
                      {summary.user.displayName || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ctp-subtext0">{t('settings.data.accountCreatedOn')}</span>
                    <span className="text-ctp-text">
                      {new Date(summary.user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Data counts */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Workspaces', count: summary.counts.workspaces },
                  { label: t('settings.data.devices'), count: summary.counts.devices },
                  { label: t('settings.data.sessions'), count: summary.counts.sessions },
                  { label: t('settings.data.mfaMethods'), count: summary.counts.mfaMethods },
                  { label: t('settings.data.alertRules'), count: summary.counts.alertRules },
                  { label: t('settings.notifications.title'), count: summary.counts.notifications },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-ctp-surface0 rounded-lg p-4 text-center"
                  >
                    <div className="text-2xl font-bold text-ctp-text">
                      {item.count}
                    </div>
                    <div className="text-xs text-ctp-subtext0">{item.label}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Export Data */}
      <div className="bg-ctp-mantle rounded-lg shadow">
        <div className="px-6 py-4 border-b border-ctp-surface1">
          <div className="flex items-center gap-3">
            <FileJson className="h-5 w-5 text-ctp-peach" />
            <div>
              <h2 className="text-lg font-semibold text-ctp-text">
                {t('settings.data.exportData')}
              </h2>
              <p className="text-sm text-ctp-subtext0">
                {t('settings.data.downloadDataJson')}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <p className="text-sm text-ctp-subtext1 mb-4">
            {t('settings.data.gdprCompliance')}
            {' '}{t('settings.data.exportIncludes')}
          </p>
          <ul className="text-sm text-ctp-subtext1 space-y-1 mb-6 list-disc list-inside">
            <li>{t('settings.data.profileInfo')}</li>
            <li>{t('settings.data.workspacesAndAccounts')}</li>
            <li>{t('settings.data.transactionsAndCategories')}</li>
            <li>{t('settings.data.budgetsAndDocuments')}</li>
            <li>{t('settings.data.contactsQuotesInvoices')}</li>
            <li>{t('settings.data.alertRulesAndNotifications')}</li>
          </ul>

          {exportSuccess && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-ctp-green/20 text-ctp-green rounded-lg">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm">{t('settings.data.exportSuccess')}</span>
            </div>
          )}

          <button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-ctp-blue text-ctp-base text-sm font-medium rounded-lg hover:bg-ctp-sapphire disabled:opacity-50 transition-colors"
          >
            {exportMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t('settings.data.downloadMyData')}
          </button>
        </div>
      </div>

      {/* Delete Account */}
      <div className="bg-ctp-mantle rounded-lg shadow border border-ctp-red/30">
        <div className="px-6 py-4 border-b border-ctp-red/30 bg-ctp-red/10 rounded-t-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-ctp-red" />
            <div>
              <h2 className="text-lg font-semibold text-ctp-red">
                {t('settings.data.dangerZone')}
              </h2>
              <p className="text-sm text-ctp-red/80">
                {t('settings.data.irreversibleActions')}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-sm font-medium text-ctp-text mb-2">
            {t('settings.data.deleteAccount')}
          </h3>
          <p className="text-sm text-ctp-subtext1 mb-4" dangerouslySetInnerHTML={{ __html: t('settings.data.deleteAccountWarning') }} />
          <ul className="text-sm text-ctp-subtext1 space-y-1 mb-6 list-disc list-inside">
            <li>{t('settings.data.allWorkspacesData')}</li>
            <li>{t('settings.data.allTransactionsDocs')}</li>
            <li>{t('settings.data.allContactsQuotesInvoices')}</li>
            <li>{t('settings.data.historyAndPreferences')}</li>
          </ul>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-ctp-red text-ctp-base text-sm font-medium rounded-lg hover:bg-ctp-maroon transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              {t('settings.data.deleteMyAccount')}
            </button>
          ) : (
            <div className="bg-ctp-red/10 rounded-lg p-4">
              <p className="text-sm text-ctp-red mb-3" dangerouslySetInnerHTML={{ __html: t('settings.data.confirmDeleteType') }} />
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                placeholder={deleteConfirmWord}
                className="w-full px-3 py-2 border border-ctp-red/50 rounded-lg bg-ctp-base text-ctp-text mb-3 focus:ring-2 focus:ring-ctp-red"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-ctp-subtext1 bg-ctp-surface1 rounded-lg hover:bg-ctp-surface2 transition-colors"
                >
                  {t('settings.data.cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteConfirmText !== deleteConfirmWord || deleteMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-ctp-red text-ctp-base text-sm font-medium rounded-lg hover:bg-ctp-maroon disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {t('settings.data.deletePermanently')}
                </button>
              </div>

              {deleteMutation.isError && (
                <p className="mt-3 text-sm text-ctp-red">
                  {t('settings.data.errorOccurred')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
