// ============================================================================
// ADMIN DASHBOARD - Finance Hub
// System statistics overview
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Building2,
  Receipt,
  FileText,
  Server,
  Database,
  Clock,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface SystemStats {
  database: {
    users: number;
    workspaces: number;
    transactions: number;
    documents: number;
  };
  redis: {
    memoryUsed: string;
    connected: boolean;
  };
  system: {
    nodeVersion: string;
    uptime: number;
    memory: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
    };
  };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}j ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('fr-FR').format(num);
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AdminDashboard() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<SystemStats>('/admin/stats'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Erreur lors du chargement des statistiques</p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Tableau de bord</h2>

      {/* Database Stats */}
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Base de donnees</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-900 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(stats.database.users)}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Utilisateurs</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(stats.database.workspaces)}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Espaces</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                <Receipt className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(stats.database.transactions)}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Transactions</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(stats.database.documents)}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Documents</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Server Info */}
        <div className="bg-gray-50 dark:bg-gray-900 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <h3 className="font-medium">Serveur</h3>
          </div>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Node.js</dt>
              <dd className="font-mono text-sm">{stats.system.nodeVersion}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Uptime</dt>
              <dd className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-gray-400" />
                {formatUptime(stats.system.uptime)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Memoire Heap</dt>
              <dd className="font-mono text-sm">
                {stats.system.memory.heapUsed} / {stats.system.memory.heapTotal} MB
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Memoire RSS</dt>
              <dd className="font-mono text-sm">{stats.system.memory.rss} MB</dd>
            </div>
          </dl>
        </div>

        {/* Redis Info */}
        <div className="bg-gray-50 dark:bg-gray-900 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <h3 className="font-medium">Redis</h3>
          </div>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Statut</dt>
              <dd>
                {stats.redis.connected ? (
                  <span className="inline-flex items-center gap-1 text-green-600">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    Connecte
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-600">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                    Deconnecte
                  </span>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Memoire utilisee</dt>
              <dd className="font-mono text-sm">{stats.redis.memoryUsed}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
