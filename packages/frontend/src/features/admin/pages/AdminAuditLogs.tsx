// ============================================================================
// ADMIN AUDIT LOGS - Finance Hub
// View system audit logs
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Clock,
} from 'lucide-react';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface AuditLog {
  id: string;
  userId: string | null;
  workspaceId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
  } | null;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function getActionBadgeColor(action: string): string {
  if (action.includes('delete') || action.includes('revoke')) {
    return 'bg-ctp-red/20 text-ctp-red';
  }
  if (action.includes('create') || action.includes('grant')) {
    return 'bg-ctp-green/20 text-ctp-green';
  }
  if (action.includes('update') || action.includes('set')) {
    return 'bg-ctp-blue/20 text-ctp-blue';
  }
  return 'bg-ctp-surface1 text-ctp-subtext1';
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\./g, ' - ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit-logs', page, actionFilter],
    queryFn: () =>
      api.get<AuditLogsResponse>(
        `/admin/audit-logs?page=${page}&limit=${limit}${actionFilter ? `&action=${encodeURIComponent(actionFilter)}` : ''}`
      ),
  });

  const logs = data?.logs ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Logs d'audit</h2>
        <span className="text-sm text-ctp-subtext0">
          {pagination?.total ?? 0} entrees
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ctp-overlay1" />
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Filtrer par action..."
            className="input pl-10 w-full"
          />
        </div>
      </div>

      {/* Logs Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-ctp-blue" />
        </div>
      ) : logs.length > 0 ? (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="bg-ctp-surface0 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${getActionBadgeColor(log.action)}`}
                    >
                      {formatAction(log.action)}
                    </span>
                    {log.entityType && (
                      <span className="text-xs text-ctp-subtext0">
                        {log.entityType}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ctp-subtext1">
                    {log.user ? (
                      <>
                        <span className="font-medium">
                          {log.user.displayName || log.user.email}
                        </span>
                      </>
                    ) : (
                      <span className="text-ctp-overlay1">Systeme</span>
                    )}
                  </p>
                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-ctp-subtext0 cursor-pointer hover:text-ctp-subtext1">
                        Voir les details
                      </summary>
                      <pre className="mt-2 p-2 bg-ctp-surface1 rounded text-xs overflow-x-auto text-ctp-text">
                        {JSON.stringify(log.changes, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1 text-xs text-ctp-subtext0">
                    <Clock className="h-3 w-3" />
                    {new Date(log.createdAt).toLocaleString('fr-FR')}
                  </div>
                  {log.ipAddress && (
                    <p className="text-xs text-ctp-overlay1 mt-1 font-mono">
                      {log.ipAddress}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-ctp-subtext0">
          Aucun log trouve
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-ctp-subtext0">
            Page {pagination.page} sur {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary p-2 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="btn-secondary p-2 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminAuditLogs;
