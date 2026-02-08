// ============================================================================
// ADVANCED FILTERS - Finance Hub
// ============================================================================

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface TransactionFilters {
  query?: string;
  accountIds?: string[];
  categoryIds?: string[];
  tagIds?: string[];
  types?: ('expense' | 'income' | 'transfer')[];
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  status?: 'pending' | 'cleared' | 'reconciled';
  hasDocuments?: boolean;
  isRecurring?: boolean;
}

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  color?: string;
}

interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income';
  icon?: string;
  color?: string;
}

interface Tag {
  id: string;
  name: string;
  color?: string;
}

interface AdvancedFiltersProps {
  workspaceId: string;
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  onReset: () => void;
  className?: string;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const TRANSACTION_TYPES = [
  { value: 'expense', label: 'Dépense', icon: '📤' },
  { value: 'income', label: 'Revenu', icon: '📥' },
  { value: 'transfer', label: 'Virement', icon: '🔄' },
] as const;

const STATUSES = [
  { value: 'pending', label: 'En attente' },
  { value: 'cleared', label: 'Rapproché' },
  { value: 'reconciled', label: 'Vérifié' },
] as const;

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AdvancedFilters({
  workspaceId,
  filters,
  onChange,
  onReset,
  className,
}: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts', workspaceId],
    queryFn: () => api.get<Account[]>(`/workspaces/${workspaceId}/accounts`),
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories', workspaceId],
    queryFn: () => api.get<Category[]>(`/workspaces/${workspaceId}/categories`),
  });

  // Fetch tags
  const { data: tags } = useQuery({
    queryKey: ['tags', workspaceId],
    queryFn: () => api.get<Tag[]>(`/workspaces/${workspaceId}/tags`),
  });

  // Count active filters
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'boolean') return true;
    return value !== undefined && value !== '';
  }).length;

  // Update a single filter
  const updateFilter = <K extends keyof TransactionFilters>(
    key: K,
    value: TransactionFilters[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  // Toggle array filter
  const toggleArrayFilter = <K extends keyof TransactionFilters>(
    key: K,
    value: string
  ) => {
    const current = (filters[key] as string[] | undefined) ?? [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: updated.length > 0 ? updated : undefined });
  };

  return (
    <div className={clsx('bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium"
        >
          <svg
            className={clsx(
              'w-4 h-4 transition-transform',
              isExpanded && 'rotate-90'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          Filtres avancés
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={onReset}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Filters */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Search Query */}
          <div>
            <label className="label">Recherche</label>
            <input
              type="text"
              value={filters.query ?? ''}
              onChange={(e) => updateFilter('query', e.target.value || undefined)}
              placeholder="Rechercher dans les descriptions..."
              className="input"
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date de début</label>
              <input
                type="date"
                value={filters.dateFrom ?? ''}
                onChange={(e) => updateFilter('dateFrom', e.target.value || undefined)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Date de fin</label>
              <input
                type="date"
                value={filters.dateTo ?? ''}
                onChange={(e) => updateFilter('dateTo', e.target.value || undefined)}
                className="input"
              />
            </div>
          </div>

          {/* Amount Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Montant minimum</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={filters.amountMin ?? ''}
                onChange={(e) =>
                  updateFilter('amountMin', e.target.value ? parseFloat(e.target.value) : undefined)
                }
                placeholder="0.00"
                className="input"
              />
            </div>
            <div>
              <label className="label">Montant maximum</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={filters.amountMax ?? ''}
                onChange={(e) =>
                  updateFilter('amountMax', e.target.value ? parseFloat(e.target.value) : undefined)
                }
                placeholder="0.00"
                className="input"
              />
            </div>
          </div>

          {/* Transaction Types */}
          <div>
            <label className="label">Type de transaction</label>
            <div className="flex flex-wrap gap-2">
              {TRANSACTION_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => toggleArrayFilter('types', type.value)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    filters.types?.includes(type.value)
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  )}
                >
                  {type.icon} {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Accounts */}
          <div>
            <label className="label">Comptes</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {accounts?.map((account) => (
                <button
                  key={account.id}
                  onClick={() => toggleArrayFilter('accountIds', account.id)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    filters.accountIds?.includes(account.id)
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  )}
                  style={{
                    borderLeft: account.color ? `3px solid ${account.color}` : undefined,
                  }}
                >
                  {account.name}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div>
            <label className="label">Catégories</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {categories?.map((category) => (
                <button
                  key={category.id}
                  onClick={() => toggleArrayFilter('categoryIds', category.id)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    filters.categoryIds?.includes(category.id)
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  )}
                >
                  {category.icon} {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          {tags && tags.length > 0 && (
            <div>
              <label className="label">Tags</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleArrayFilter('tagIds', tag.id)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      filters.tagIds?.includes(tag.id)
                        ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                    style={{
                      backgroundColor: tag.color ? `${tag.color}20` : undefined,
                      borderColor: tag.color,
                    }}
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="label">Statut</label>
            <select
              value={filters.status ?? ''}
              onChange={(e) =>
                updateFilter('status', e.target.value as any || undefined)
              }
              className="input"
            >
              <option value="">Tous les statuts</option>
              {STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {/* Boolean Filters */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.hasDocuments === true}
                onChange={(e) =>
                  updateFilter('hasDocuments', e.target.checked ? true : undefined)
                }
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm">Avec justificatif</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.isRecurring === true}
                onChange={(e) =>
                  updateFilter('isRecurring', e.target.checked ? true : undefined)
                }
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm">Récurrente</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdvancedFilters;
