// ============================================================================
// ACTIVITY FILTERS COMPONENT - Finance Hub
// Filters for the activity feed (type, user, date)
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter, X, Calendar, User, Tag } from 'lucide-react';
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface ActivityFiltersValue {
  types: string[];
  userId: string | null;
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
}

interface ActivityFiltersProps {
  workspaceId: string;
  value: ActivityFiltersValue;
  onChange: (value: ActivityFiltersValue) => void;
}

interface Member {
  id: string;
  user: {
    id: string;
    displayName: string | null;
    email: string;
  };
  role: string;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const ACTION_TYPES = [
  { value: 'transaction', label: 'Transactions', icon: 'CreditCard' },
  { value: 'account', label: 'Comptes', icon: 'Wallet' },
  { value: 'budget', label: 'Budgets', icon: 'PieChart' },
  { value: 'document', label: 'Documents', icon: 'FileText' },
  { value: 'category', label: 'Categories', icon: 'FolderOpen' },
  { value: 'workspace', label: 'Workspace', icon: 'Settings' },
  { value: 'import', label: 'Imports', icon: 'Upload' },
  { value: 'export', label: 'Exports', icon: 'Download' },
  { value: 'pro', label: 'Pro Mode', icon: 'Receipt' },
  { value: 'invest', label: 'Investissements', icon: 'TrendingUp' },
];

const DATE_PRESETS = [
  { label: "Aujourd'hui", getValue: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: 'Hier', getValue: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
  { label: '7 derniers jours', getValue: () => ({ from: startOfDay(subDays(new Date(), 7)), to: endOfDay(new Date()) }) },
  { label: '30 derniers jours', getValue: () => ({ from: startOfDay(subDays(new Date(), 30)), to: endOfDay(new Date()) }) },
  { label: '3 derniers mois', getValue: () => ({ from: startOfDay(subMonths(new Date(), 3)), to: endOfDay(new Date()) }) },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ActivityFilters({ workspaceId, value, onChange }: ActivityFiltersProps) {
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  // Fetch workspace members
  const { data: members = [] } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      const response = await api.get<Member[]>(`/workspaces/${workspaceId}/members`);
      return response;
    },
  });

  const hasActiveFilters =
    value.types.length > 0 || value.userId !== null || value.dateRange.from !== null;

  const clearFilters = () => {
    onChange({
      types: [],
      userId: null,
      dateRange: { from: null, to: null },
    });
  };

  const toggleType = (type: string) => {
    const newTypes = value.types.includes(type)
      ? value.types.filter((t) => t !== type)
      : [...value.types, type];
    onChange({ ...value, types: newTypes });
  };

  const setUser = (userId: string | null) => {
    onChange({ ...value, userId });
    setShowUserDropdown(false);
  };

  const setDateRange = (from: Date | null, to: Date | null) => {
    onChange({ ...value, dateRange: { from, to } });
    setShowDateDropdown(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-4 bg-ctp-surface0 border-b border-ctp-surface1">
      {/* Filter Icon */}
      <div className="flex items-center gap-2 text-ctp-subtext0">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">Filtres:</span>
      </div>

      {/* Type Filter */}
      <div className="relative">
        <button
          onClick={() => {
            setShowTypeDropdown(!showTypeDropdown);
            setShowUserDropdown(false);
            setShowDateDropdown(false);
          }}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
            value.types.length > 0
              ? 'bg-ctp-blue/20 text-ctp-blue border border-ctp-blue/30'
              : 'bg-ctp-surface1 text-ctp-subtext0 hover:bg-ctp-surface2 border border-transparent'
          )}
        >
          <Tag className="h-3.5 w-3.5" />
          <span>
            {value.types.length > 0
              ? `${value.types.length} type${value.types.length > 1 ? 's' : ''}`
              : 'Type'}
          </span>
        </button>

        {showTypeDropdown && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-ctp-surface0 border border-ctp-surface1 rounded-lg shadow-lg z-50">
            <div className="p-2 space-y-1 max-h-64 overflow-auto">
              {ACTION_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => toggleType(type.value)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left',
                    value.types.includes(type.value)
                      ? 'bg-ctp-blue/20 text-ctp-blue'
                      : 'text-ctp-text hover:bg-ctp-surface1'
                  )}
                >
                  <div
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center',
                      value.types.includes(type.value)
                        ? 'bg-ctp-blue border-ctp-blue'
                        : 'border-ctp-surface2'
                    )}
                  >
                    {value.types.includes(type.value) && (
                      <svg className="w-3 h-3 text-ctp-base" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User Filter */}
      <div className="relative">
        <button
          onClick={() => {
            setShowUserDropdown(!showUserDropdown);
            setShowTypeDropdown(false);
            setShowDateDropdown(false);
          }}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
            value.userId
              ? 'bg-ctp-mauve/20 text-ctp-mauve border border-ctp-mauve/30'
              : 'bg-ctp-surface1 text-ctp-subtext0 hover:bg-ctp-surface2 border border-transparent'
          )}
        >
          <User className="h-3.5 w-3.5" />
          <span>
            {value.userId
              ? members.find((m) => m.user.id === value.userId)?.user.displayName ??
                members.find((m) => m.user.id === value.userId)?.user.email ??
                'Utilisateur'
              : 'Utilisateur'}
          </span>
        </button>

        {showUserDropdown && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-ctp-surface0 border border-ctp-surface1 rounded-lg shadow-lg z-50">
            <div className="p-2 space-y-1 max-h-64 overflow-auto">
              <button
                onClick={() => setUser(null)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left',
                  value.userId === null
                    ? 'bg-ctp-mauve/20 text-ctp-mauve'
                    : 'text-ctp-text hover:bg-ctp-surface1'
                )}
              >
                Tous les utilisateurs
              </button>
              {members.map((member) => (
                <button
                  key={member.user.id}
                  onClick={() => setUser(member.user.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left',
                    value.userId === member.user.id
                      ? 'bg-ctp-mauve/20 text-ctp-mauve'
                      : 'text-ctp-text hover:bg-ctp-surface1'
                  )}
                >
                  <div className="w-6 h-6 rounded-full bg-ctp-surface2 flex items-center justify-center text-xs font-medium text-ctp-subtext0">
                    {(member.user.displayName ?? member.user.email).charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate">
                    {member.user.displayName ?? member.user.email}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Date Filter */}
      <div className="relative">
        <button
          onClick={() => {
            setShowDateDropdown(!showDateDropdown);
            setShowTypeDropdown(false);
            setShowUserDropdown(false);
          }}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
            value.dateRange.from
              ? 'bg-ctp-green/20 text-ctp-green border border-ctp-green/30'
              : 'bg-ctp-surface1 text-ctp-subtext0 hover:bg-ctp-surface2 border border-transparent'
          )}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {value.dateRange.from
              ? `${format(value.dateRange.from, 'dd MMM', { locale: fr })}${
                  value.dateRange.to &&
                  format(value.dateRange.to, 'dd MMM') !== format(value.dateRange.from, 'dd MMM')
                    ? ` - ${format(value.dateRange.to, 'dd MMM', { locale: fr })}`
                    : ''
                }`
              : 'Periode'}
          </span>
        </button>

        {showDateDropdown && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-ctp-surface0 border border-ctp-surface1 rounded-lg shadow-lg z-50">
            <div className="p-2 space-y-1">
              <button
                onClick={() => setDateRange(null, null)}
                className={cn(
                  'w-full px-3 py-2 rounded-md text-sm transition-colors text-left',
                  value.dateRange.from === null
                    ? 'bg-ctp-green/20 text-ctp-green'
                    : 'text-ctp-text hover:bg-ctp-surface1'
                )}
              >
                Toutes les periodes
              </button>
              {DATE_PRESETS.map((preset) => {
                const range = preset.getValue();
                return (
                  <button
                    key={preset.label}
                    onClick={() => setDateRange(range.from, range.to)}
                    className="w-full px-3 py-2 rounded-md text-sm transition-colors text-left text-ctp-text hover:bg-ctp-surface1"
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 px-2 py-1.5 text-sm text-ctp-red hover:text-ctp-red/80 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          <span>Effacer</span>
        </button>
      )}

      {/* Click outside handler */}
      {(showTypeDropdown || showUserDropdown || showDateDropdown) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowTypeDropdown(false);
            setShowUserDropdown(false);
            setShowDateDropdown(false);
          }}
        />
      )}
    </div>
  );
}

export default ActivityFilters;
