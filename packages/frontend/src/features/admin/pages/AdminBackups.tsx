// ============================================================================
// ADMIN BACKUPS - Finance Hub
// Backup management for administrators
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Database,
  Download,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  HardDrive,
  Building2,
} from 'lucide-react';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Backup {
  path: string;
  size: number;
  lastModified: string;
  type: 'full' | 'workspace';
}

interface BackupsResponse {
  backups: Backup[];
  total: number;
}

interface BackupJobResponse {
  message: string;
  jobId: string;
  type: string;
  workspaceId?: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-FR');
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AdminBackups() {
  const queryClient = useQueryClient();
  const [backupType, setBackupType] = useState<'full' | 'incremental'>('full');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'backups'],
    queryFn: () => api.get<BackupsResponse>('/admin/backup/list'),
  });

  const triggerBackupMutation = useMutation({
    mutationFn: (type: 'full' | 'incremental') =>
      api.post<BackupJobResponse>('/admin/backup', { type }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'backups'] });
    },
  });

  const backups = data?.backups ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sauvegardes</h2>
        <button
          onClick={() => refetch()}
          className="btn-ghost p-2"
          title="Actualiser"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Trigger Backup */}
      <div className="bg-ctp-blue/10 border border-ctp-blue/30 rounded-lg p-4">
        <h3 className="font-medium mb-3">Nouvelle sauvegarde</h3>
        <div className="flex gap-3">
          <select
            value={backupType}
            onChange={(e) => setBackupType(e.target.value as 'full' | 'incremental')}
            className="input"
          >
            <option value="full">Complete</option>
            <option value="incremental">Incrementale</option>
          </select>
          <button
            onClick={() => triggerBackupMutation.mutate(backupType)}
            disabled={triggerBackupMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {triggerBackupMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            Lancer la sauvegarde
          </button>
        </div>

        {triggerBackupMutation.isSuccess && (
          <div className="mt-3 flex items-center gap-2 text-ctp-green">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">
              Sauvegarde lancee (Job ID: {triggerBackupMutation.data?.jobId})
            </span>
          </div>
        )}

        {triggerBackupMutation.isError && (
          <div className="mt-3 flex items-center gap-2 text-ctp-red">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Erreur lors du lancement</span>
          </div>
        )}
      </div>

      {/* Backups List */}
      <div>
        <h3 className="font-medium mb-3">Sauvegardes disponibles</h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-ctp-blue" />
          </div>
        ) : backups.length > 0 ? (
          <div className="space-y-2">
            {backups.map((backup, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-ctp-surface0 rounded-lg p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-ctp-surface1 rounded-lg">
                    {backup.type === 'full' ? (
                      <HardDrive className="h-5 w-5 text-ctp-blue" />
                    ) : (
                      <Building2 className="h-5 w-5 text-ctp-mauve" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm truncate max-w-md">
                      {backup.path.split('/').pop()}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-ctp-subtext0">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(backup.lastModified)}
                      </span>
                      <span>{formatFileSize(backup.size)}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          backup.type === 'full'
                            ? 'bg-ctp-blue/20 text-ctp-blue'
                            : 'bg-ctp-mauve/20 text-ctp-mauve'
                        }`}
                      >
                        {backup.type === 'full' ? 'Complete' : 'Espace'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  className="btn-ghost p-2 text-ctp-subtext0 hover:text-ctp-text"
                  title="Telecharger"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-ctp-subtext0">
            <Database className="h-12 w-12 mx-auto text-ctp-surface2 mb-3" />
            <p>Aucune sauvegarde disponible</p>
            <p className="text-sm mt-1">
              Lancez votre premiere sauvegarde ci-dessus
            </p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-ctp-surface0 rounded-lg p-4 text-sm text-ctp-subtext0">
        <p>
          Les sauvegardes sont stockees dans le bucket S3 configure. Les sauvegardes
          completes incluent toutes les donnees, tandis que les sauvegardes
          incrementales ne contiennent que les modifications depuis la derniere
          sauvegarde complete.
        </p>
      </div>
    </div>
  );
}

export default AdminBackups;
