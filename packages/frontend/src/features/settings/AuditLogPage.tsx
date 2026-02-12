// ============================================================================
// AUDIT LOG PAGE - Finance Hub
// Security audit log viewer with filters and export
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Shield,
  Download,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Globe,
  Monitor,
  Search,
} from 'lucide-react';
import { api } from '@/lib/api';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface AuditLog {
  id: string;
  action: string;
  actionLabel: string;
  actionType: string;
  resource: string | null;
  resourceId: string | null;
  status: 'success' | 'failure';
  severity: 'info' | 'warning' | 'critical';
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditLogResponse {
  data: AuditLog[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

interface ActionType {
  value: string;
  label: string;
}

interface AuditFilters {
  action: string;
  status: string;
  from: string;
  to: string;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseUserAgent(userAgent: string | null, t: (key: string) => string): string {
  if (!userAgent) return t('settings.audit.unknownDevice');

  // Simple parsing for common browsers/devices
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Mobile')) return 'Mobile';

  return t('settings.audit.browser');
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-ctp-green" />;
    case 'failure':
      return <XCircle className="h-4 w-4 text-ctp-red" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-ctp-yellow" />;
  }
}

function getSeverityBadge(severity: string, t: (key: string) => string) {
  switch (severity) {
    case 'critical':
      return (
        <span className="px-2 py-0.5 text-xs font-medium bg-ctp-red/20 text-ctp-red rounded-full">
          {t('settings.audit.critical')}
        </span>
      );
    case 'warning':
      return (
        <span className="px-2 py-0.5 text-xs font-medium bg-ctp-yellow/20 text-ctp-yellow rounded-full">
          {t('settings.audit.warning')}
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 text-xs font-medium bg-ctp-blue/20 text-ctp-blue rounded-full">
          {t('settings.audit.info')}
        </span>
      );
  }
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AuditLogPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<AuditFilters>({
    action: '',
    status: '',
    from: '',
    to: '',
  });

  // Fetch action types for filter dropdown
  const { data: actionTypes = [] } = useQuery({
    queryKey: ['audit-action-types'],
    queryFn: async () => {
      const result = await api.get<ActionType[]>('/users/me/audit-logs/actions');
      return result ?? [];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('pageSize', pageSize.toString());
    if (filters.action) params.set('action', filters.action);
    if (filters.status) params.set('status', filters.status);
    if (filters.from) params.set('from', new Date(filters.from).toISOString());
    if (filters.to) params.set('to', new Date(filters.to).toISOString());
    return params.toString();
  }, [page, pageSize, filters]);

  // Fetch audit logs
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', queryParams],
    queryFn: async () => {
      return api.get<AuditLogResponse>(`/users/me/audit-logs?${queryParams}`);
    },
  });

  const logs = data?.data ?? [];
  const meta = data?.meta;

  // Handle filter changes
  const handleFilterChange = (key: keyof AuditFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({ action: '', status: '', from: '', to: '' });
    setPage(1);
  };

  // Export to CSV
  const handleExport = async () => {
    try {
      const exportParams = new URLSearchParams();
      if (filters.action) exportParams.set('action', filters.action);
      if (filters.status) exportParams.set('status', filters.status);
      if (filters.from) exportParams.set('from', new Date(filters.from).toISOString());
      if (filters.to) exportParams.set('to', new Date(filters.to).toISOString());

      const response = await fetch(`/api/v1/users/me/audit-logs/export?${exportParams}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Check if any filters are active
  const hasActiveFilters = filters.action || filters.status || filters.from || filters.to;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-ctp-red" />
          <div>
            <h2 className="text-xl font-semibold text-ctp-text">
              {t('settings.audit.title')}
            </h2>
            <p className="text-sm text-ctp-subtext0">
              {t('settings.audit.allActionsHistory')}
            </p>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-ctp-blue bg-ctp-blue/10 hover:bg-ctp-blue/20 rounded-lg transition-colors"
        >
          <Download className="h-4 w-4" />
          {t('settings.audit.exportCsv')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-ctp-mantle rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm font-medium text-ctp-text"
          >
            <Filter className="h-4 w-4" />
            {t('settings.audit.filters')}
            {hasActiveFilters && (
              <span className="ml-1 px-2 py-0.5 text-xs bg-ctp-blue/20 text-ctp-blue rounded-full">
                {t('settings.audit.active')}
              </span>
            )}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-ctp-subtext0 hover:text-ctp-text"
            >
              {t('settings.audit.clear')}
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Action Type Filter */}
            <div>
              <label className="block text-xs font-medium text-ctp-subtext0 mb-1">
                {t('settings.audit.actionType')}
              </label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-ctp-surface0 border border-ctp-surface1 rounded-lg text-ctp-text focus:outline-none focus:ring-2 focus:ring-ctp-blue"
              >
                <option value="">{t('settings.audit.allActions')}</option>
                {actionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-medium text-ctp-subtext0 mb-1">
                {t('settings.audit.status')}
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-ctp-surface0 border border-ctp-surface1 rounded-lg text-ctp-text focus:outline-none focus:ring-2 focus:ring-ctp-blue"
              >
                <option value="">{t('settings.audit.allStatuses')}</option>
                <option value="success">{t('settings.audit.success')}</option>
                <option value="failure">{t('settings.audit.failure')}</option>
              </select>
            </div>

            {/* Date From Filter */}
            <div>
              <label className="block text-xs font-medium text-ctp-subtext0 mb-1">
                <Calendar className="h-3 w-3 inline mr-1" />
                {t('settings.audit.startDate')}
              </label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => handleFilterChange('from', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-ctp-surface0 border border-ctp-surface1 rounded-lg text-ctp-text focus:outline-none focus:ring-2 focus:ring-ctp-blue"
              />
            </div>

            {/* Date To Filter */}
            <div>
              <label className="block text-xs font-medium text-ctp-subtext0 mb-1">
                <Calendar className="h-3 w-3 inline mr-1" />
                {t('settings.audit.endDate')}
              </label>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => handleFilterChange('to', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-ctp-surface0 border border-ctp-surface1 rounded-lg text-ctp-text focus:outline-none focus:ring-2 focus:ring-ctp-blue"
              />
            </div>
          </div>
        )}
      </div>

      {/* Audit Log Table */}
      <div className="bg-ctp-mantle rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-ctp-blue" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-ctp-overlay0 mx-auto mb-3" />
            <p className="text-ctp-subtext0">
              {t('settings.audit.noEventsFound')}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-2 text-sm text-ctp-blue hover:text-ctp-sapphire"
              >
                {t('settings.audit.clearFilters')}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-ctp-surface0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ctp-subtext0 uppercase tracking-wider">
                      {t('settings.audit.date')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ctp-subtext0 uppercase tracking-wider">
                      {t('settings.audit.action')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ctp-subtext0 uppercase tracking-wider">
                      {t('settings.audit.ipAddress')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ctp-subtext0 uppercase tracking-wider">
                      {t('settings.audit.device')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ctp-subtext0 uppercase tracking-wider">
                      {t('settings.audit.status')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ctp-subtext0 uppercase tracking-wider">
                      {t('settings.audit.severity')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ctp-surface1">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-ctp-surface0 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-ctp-subtext0">
                          <Clock className="h-4 w-4" />
                          {formatDate(log.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-ctp-text">
                          {log.actionLabel}
                        </div>
                        {log.resource && (
                          <div className="text-xs text-ctp-subtext0">
                            {log.resource}{log.resourceId ? ` #${log.resourceId.slice(0, 8)}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-ctp-subtext0">
                          <Globe className="h-4 w-4" />
                          {log.ipAddress ?? t('settings.audit.unknownIP')}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-ctp-subtext0">
                          <Monitor className="h-4 w-4" />
                          {parseUserAgent(log.userAgent, t)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          <span className="text-sm text-ctp-text capitalize">
                            {log.status === 'success' ? t('settings.audit.success') : t('settings.audit.failure')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getSeverityBadge(log.severity, t)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-ctp-surface1">
              {logs.map((log) => (
                <div key={log.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ctp-text">
                      {log.actionLabel}
                    </span>
                    {getSeverityBadge(log.severity, t)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-ctp-subtext0">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(log.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {log.ipAddress ?? t('settings.audit.unknownIP')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(log.status)}
                    <span className="text-xs text-ctp-text capitalize">
                      {log.status === 'success' ? t('settings.audit.success') : t('settings.audit.failure')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-ctp-surface0 border-t border-ctp-surface1">
            <div className="text-sm text-ctp-subtext0">
              {t('settings.audit.pageOf', { page: meta.page, total: meta.totalPages, count: meta.total })}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-ctp-subtext0 hover:text-ctp-text disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm text-ctp-text">
                {meta.page}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page === meta.totalPages}
                className="p-2 text-ctp-subtext0 hover:text-ctp-text disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Information Box */}
      <div className="bg-ctp-blue/10 border border-ctp-blue/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-ctp-blue flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-ctp-text">
              {t('settings.audit.aboutAuditLog')}
            </h3>
            <p className="text-sm text-ctp-subtext0 mt-1">
              {t('settings.audit.auditLogDescription')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuditLogPage;
