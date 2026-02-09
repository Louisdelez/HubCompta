// ============================================================================
// ADMIN SYSTEM - Finance Hub
// System management (cache, info)
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Database,
  Info,
} from 'lucide-react';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ClearCacheResponse {
  cleared: number;
  pattern?: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AdminSystem() {
  const queryClient = useQueryClient();
  const [cachePattern, setCachePattern] = useState('');

  const clearCacheMutation = useMutation({
    mutationFn: (pattern?: string) =>
      api.post<ClearCacheResponse>('/admin/cache/clear', { pattern }),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Systeme</h2>

      {/* Cache Management */}
      <div className="space-y-4">
        <h3 className="font-medium flex items-center gap-2">
          <Database className="h-5 w-5 text-ctp-subtext0" />
          Gestion du cache
        </h3>

        <div className="bg-ctp-surface0 rounded-lg p-4 space-y-4">
          {/* Clear all cache */}
          <div>
            <p className="text-sm text-ctp-subtext0 mb-3">
              Vider tout le cache (cles de cache et rate limits)
            </p>
            <button
              onClick={() => clearCacheMutation.mutate(undefined)}
              disabled={clearCacheMutation.isPending}
              className="btn-secondary flex items-center gap-2"
            >
              {clearCacheMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Vider tout le cache
            </button>
          </div>

          {/* Clear by pattern */}
          <div className="pt-4 border-t border-ctp-surface1">
            <p className="text-sm text-ctp-subtext0 mb-3">
              Vider le cache par pattern (ex: cache:exchange-rates:*)
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={cachePattern}
                onChange={(e) => setCachePattern(e.target.value)}
                placeholder="cache:*"
                className="input flex-1"
              />
              <button
                onClick={() => clearCacheMutation.mutate(cachePattern)}
                disabled={clearCacheMutation.isPending || !cachePattern}
                className="btn-secondary flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Vider
              </button>
            </div>
          </div>

          {/* Result */}
          {clearCacheMutation.isSuccess && (
            <div className="flex items-center gap-2 text-ctp-green pt-2">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">
                {clearCacheMutation.data?.cleared} cle(s) supprimee(s)
              </span>
            </div>
          )}

          {clearCacheMutation.isError && (
            <div className="flex items-center gap-2 text-ctp-red pt-2">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Erreur lors de la suppression</span>
            </div>
          )}
        </div>
      </div>

      {/* System Info */}
      <div className="space-y-4">
        <h3 className="font-medium flex items-center gap-2">
          <Info className="h-5 w-5 text-ctp-subtext0" />
          Informations systeme
        </h3>

        <div className="bg-ctp-surface0 rounded-lg p-4">
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-ctp-subtext0">Application</dt>
              <dd className="font-medium text-ctp-text">HubCompta</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ctp-subtext0">Version</dt>
              <dd className="font-mono text-sm">1.0.0</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ctp-subtext0">Environnement</dt>
              <dd className="font-mono text-sm">
                {import.meta.env.MODE}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ctp-subtext0">API URL</dt>
              <dd className="font-mono text-sm truncate max-w-xs">
                {import.meta.env.VITE_API_URL || 'http://localhost:3000'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="space-y-4">
        <h3 className="font-medium text-ctp-red">Zone dangereuse</h3>

        <div className="border border-ctp-red/30 rounded-lg p-4 bg-ctp-red/10">
          <p className="text-sm text-ctp-red mb-3">
            Ces actions sont irreversibles et peuvent affecter le fonctionnement
            de l'application.
          </p>
          <div className="space-y-2">
            <button
              className="btn-secondary text-ctp-red border-ctp-red/30 hover:bg-ctp-red/20"
              onClick={() => {
                if (window.confirm('Etes-vous sur de vouloir reconstruire les index de recherche?')) {
                  // TODO: Implement rebuild search indexes
                  alert('Non implemente');
                }
              }}
            >
              Reconstruire les index de recherche
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminSystem;
