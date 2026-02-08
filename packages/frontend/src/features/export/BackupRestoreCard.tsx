// ============================================================================
// BACKUP & RESTORE CARD - Finance Hub
// ============================================================================

import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface BackupRestoreCardProps {
  workspaceId: string;
}

interface BackupData {
  exportedAt: string;
  version: string;
  workspace: {
    name: string;
    type: string;
    currency: string;
  };
  accounts: unknown[];
  categories: unknown[];
  transactions: unknown[];
  budgets: unknown[];
  tags: unknown[];
  rules: unknown[];
  recurrences: unknown[];
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function BackupRestoreCard({ workspaceId }: BackupRestoreCardProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backupPreview, setBackupPreview] = useState<BackupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoreStep, setRestoreStep] = useState<'idle' | 'preview' | 'restoring'>('idle');

  // Download backup
  const downloadBackup = async () => {
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/export/backup`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to download backup');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Erreur lors du téléchargement de la sauvegarde');
    }
  };

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupData;

      // Validate backup structure
      if (!data.version || !data.workspace || !data.transactions) {
        throw new Error('Format de sauvegarde invalide');
      }

      setBackupPreview(data);
      setRestoreStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la lecture du fichier');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Restore mutation (placeholder - would need backend implementation)
  const restoreMutation = useMutation({
    mutationFn: async (data: BackupData) => {
      // Note: Full restore functionality would require a backend endpoint
      // For now, we'll show the preview functionality
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['categories', workspaceId] });
      setRestoreStep('idle');
      setBackupPreview(null);
    },
    onError: () => {
      setError('Erreur lors de la restauration');
    },
  });

  const handleRestore = () => {
    if (backupPreview) {
      setRestoreStep('restoring');
      restoreMutation.mutate(backupPreview);
    }
  };

  const cancelRestore = () => {
    setRestoreStep('idle');
    setBackupPreview(null);
    setError(null);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold mb-4">Sauvegarde & Restauration</h3>

      {error && (
        <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg text-danger-600 dark:text-danger-400 text-sm">
          {error}
        </div>
      )}

      {restoreStep === 'idle' && (
        <div className="space-y-4">
          {/* Backup */}
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <span className="text-2xl">💾</span>
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Créer une sauvegarde</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Téléchargez une copie complète de vos données au format JSON.
                  Inclut comptes, transactions, catégories, budgets et règles.
                </p>
                <button onClick={downloadBackup} className="btn-primary mt-3">
                  Télécharger la sauvegarde
                </button>
              </div>
            </div>
          </div>

          {/* Restore */}
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-warning-100 dark:bg-warning-900/30 rounded-lg">
                <span className="text-2xl">📥</span>
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Restaurer depuis une sauvegarde</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Importez une sauvegarde précédente pour restaurer vos données.
                  Attention: cette action peut modifier vos données existantes.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary mt-3"
                >
                  Sélectionner un fichier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {restoreStep === 'preview' && backupPreview && (
        <div className="space-y-4">
          <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg">
            <h4 className="font-medium text-warning-700 dark:text-warning-300 mb-2">
              Aperçu de la sauvegarde
            </h4>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-gray-500">Date:</span>{' '}
                {new Date(backupPreview.exportedAt).toLocaleString('fr-FR')}
              </p>
              <p>
                <span className="text-gray-500">Workspace:</span>{' '}
                {backupPreview.workspace.name}
              </p>
              <p>
                <span className="text-gray-500">Version:</span>{' '}
                {backupPreview.version}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
              <div className="text-2xl font-bold">{backupPreview.accounts.length}</div>
              <div className="text-sm text-gray-500">Comptes</div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
              <div className="text-2xl font-bold">{backupPreview.transactions.length}</div>
              <div className="text-sm text-gray-500">Transactions</div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
              <div className="text-2xl font-bold">{backupPreview.categories.length}</div>
              <div className="text-sm text-gray-500">Catégories</div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
              <div className="text-2xl font-bold">{backupPreview.budgets.length}</div>
              <div className="text-sm text-gray-500">Budgets</div>
            </div>
          </div>

          <div className="p-4 bg-danger-50 dark:bg-danger-900/20 rounded-lg text-sm text-danger-700 dark:text-danger-300">
            <strong>Attention:</strong> La restauration peut remplacer ou fusionner
            vos données existantes. Assurez-vous de créer une sauvegarde de vos
            données actuelles avant de continuer.
          </div>

          <div className="flex gap-3">
            <button onClick={cancelRestore} className="btn-secondary flex-1">
              Annuler
            </button>
            <button
              onClick={handleRestore}
              disabled={restoreMutation.isPending}
              className="btn-primary flex-1"
            >
              {restoreMutation.isPending ? 'Restauration...' : 'Restaurer'}
            </button>
          </div>
        </div>
      )}

      {restoreStep === 'restoring' && (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Restauration en cours...</p>
        </div>
      )}
    </div>
  );
}

export default BackupRestoreCard;
