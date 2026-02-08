// ============================================================================
// DATA MANAGEMENT - Finance Hub
// GDPR data export and account deletion
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [exportSuccess, setExportSuccess] = useState(false);

  // Fetch data summary
  const { data: summary, isLoading } = useQuery({
    queryKey: ['data-summary'],
    queryFn: async () => {
      const response = await api.get<{ data: DataSummary }>('/settings/data/summary');
      return response.data;
    },
  });

  // Export data mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/settings/data/export', {
        responseType: 'blob',
      });
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

  const handleDelete = () => {
    if (deleteConfirmText === 'SUPPRIMER') {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-gray-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Resume de vos donnees
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Apercu des donnees stockees dans votre compte
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {summary && (
            <>
              {/* User info */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Informations du compte
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Email</span>
                    <span className="text-gray-900 dark:text-white">{summary.user.email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Nom</span>
                    <span className="text-gray-900 dark:text-white">
                      {summary.user.displayName || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Compte cree le</span>
                    <span className="text-gray-900 dark:text-white">
                      {new Date(summary.user.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Data counts */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Workspaces', count: summary.counts.workspaces },
                  { label: 'Appareils', count: summary.counts.devices },
                  { label: 'Sessions', count: summary.counts.sessions },
                  { label: 'Methodes MFA', count: summary.counts.mfaMethods },
                  { label: 'Regles d\'alerte', count: summary.counts.alertRules },
                  { label: 'Notifications', count: summary.counts.notifications },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center"
                  >
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {item.count}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{item.label}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Export Data */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <FileJson className="h-5 w-5 text-gray-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Exporter vos donnees
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Telechargez une copie de toutes vos donnees au format JSON
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Conformement au RGPD, vous pouvez telecharger l'ensemble de vos donnees personnelles.
            L'export inclut :
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-6 list-disc list-inside">
            <li>Informations de profil</li>
            <li>Workspaces et comptes</li>
            <li>Transactions et categories</li>
            <li>Budgets et documents</li>
            <li>Contacts, devis et factures</li>
            <li>Regles d'alerte et notifications</li>
          </ul>

          {exportSuccess && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm">Export telecharge avec succes</span>
            </div>
          )}

          <button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {exportMutation.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Telecharger mes donnees
          </button>
        </div>
      </div>

      {/* Delete Account */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-red-200 dark:border-red-900">
        <div className="px-6 py-4 border-b border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 rounded-t-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <div>
              <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
                Zone de danger
              </h2>
              <p className="text-sm text-red-500 dark:text-red-400/80">
                Actions irreversibles sur votre compte
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Supprimer le compte
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            La suppression de votre compte est <strong>permanente et irreversible</strong>. Toutes
            vos donnees seront definitivement effacees, y compris :
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-6 list-disc list-inside">
            <li>Tous vos workspaces et leurs donnees</li>
            <li>Toutes les transactions et documents</li>
            <li>Tous les contacts, devis et factures</li>
            <li>Historique et preferences</li>
          </ul>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer mon compte
            </button>
          ) : (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                Pour confirmer la suppression, tapez <strong>SUPPRIMER</strong> ci-dessous :
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                placeholder="SUPPRIMER"
                className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white mb-3 focus:ring-2 focus:ring-red-500"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteConfirmText !== 'SUPPRIMER' || deleteMutation.isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleteMutation.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Supprimer definitivement
                </button>
              </div>

              {deleteMutation.isError && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                  Une erreur est survenue. Veuillez reessayer.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
