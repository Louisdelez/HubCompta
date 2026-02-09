// ============================================================================
// SAVED FILTERS - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import type { TransactionFilters } from './AdvancedFilters';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface SavedFilter {
  id: string;
  name: string;
  filters: TransactionFilters;
  isDefault: boolean;
  createdAt: string;
}

interface SavedFiltersProps {
  workspaceId: string;
  currentFilters: TransactionFilters;
  onApply: (filters: TransactionFilters) => void;
  className?: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SavedFilters({
  workspaceId,
  currentFilters,
  onApply,
  className,
}: SavedFiltersProps) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');

  // Fetch saved filters
  const { data: savedFilters, isLoading } = useQuery({
    queryKey: ['saved-filters', workspaceId],
    queryFn: () => api.get<SavedFilter[]>(`/workspaces/${workspaceId}/filters`),
  });

  // Create filter mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string; filters: TransactionFilters; isDefault?: boolean }) =>
      api.post(`/workspaces/${workspaceId}/filters`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-filters', workspaceId] });
      setIsCreating(false);
      setNewFilterName('');
    },
  });

  // Update filter mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; isDefault?: boolean }) =>
      api.patch(`/workspaces/${workspaceId}/filters/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-filters', workspaceId] });
    },
  });

  // Delete filter mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${workspaceId}/filters/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-filters', workspaceId] });
    },
  });

  // Check if current filters have any values
  const hasFilters = Object.entries(currentFilters).some(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'boolean') return true;
    return value !== undefined && value !== '';
  });

  const handleSave = () => {
    if (!newFilterName.trim()) return;
    createMutation.mutate({
      name: newFilterName.trim(),
      filters: currentFilters,
    });
  };

  const handleSetDefault = (filter: SavedFilter) => {
    updateMutation.mutate({ id: filter.id, isDefault: !filter.isDefault });
  };

  const handleDelete = (filter: SavedFilter) => {
    if (confirm(`Supprimer le filtre "${filter.name}" ?`)) {
      deleteMutation.mutate(filter.id);
    }
  };

  return (
    <div className={clsx('bg-ctp-surface0 rounded-lg border border-ctp-surface1 p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Filtres sauvegardés</h3>
        {hasFilters && !isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="text-sm text-ctp-blue hover:text-ctp-blue/80"
          >
            + Sauvegarder
          </button>
        )}
      </div>

      {/* Create new filter */}
      {isCreating && (
        <div className="mb-4 p-3 bg-ctp-surface1 rounded-lg">
          <div className="flex gap-2">
            <input
              type="text"
              value={newFilterName}
              onChange={(e) => setNewFilterName(e.target.value)}
              placeholder="Nom du filtre..."
              className="flex-1 text-sm px-3 py-2 rounded-lg bg-ctp-surface0 border border-ctp-surface1 text-ctp-text placeholder-ctp-overlay0 focus:border-ctp-blue focus:ring-2 focus:ring-ctp-blue/20 outline-none transition-colors"
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={!newFilterName.trim() || createMutation.isPending}
              className="btn-primary text-sm px-3"
            >
              {createMutation.isPending ? '...' : 'OK'}
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewFilterName('');
              }}
              className="btn-secondary text-sm px-3"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Filters list */}
      {isLoading ? (
        <div className="text-center py-4">
          <div className="animate-spin w-5 h-5 border-2 border-ctp-blue border-t-transparent rounded-full mx-auto" />
        </div>
      ) : savedFilters && savedFilters.length > 0 ? (
        <div className="space-y-2">
          {savedFilters.map((filter) => (
            <div
              key={filter.id}
              className={clsx(
                'flex items-center gap-2 p-2 rounded-lg group transition-colors',
                filter.isDefault
                  ? 'bg-ctp-blue/20 border border-ctp-blue'
                  : 'hover:bg-ctp-surface1'
              )}
            >
              <button
                onClick={() => onApply(filter.filters)}
                className="flex-1 text-left"
              >
                <span className="text-sm font-medium">{filter.name}</span>
                {filter.isDefault && (
                  <span className="ml-2 text-xs text-ctp-blue">
                    (par défaut)
                  </span>
                )}
              </button>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleSetDefault(filter)}
                  className={clsx(
                    'p-1 rounded hover:bg-ctp-surface2',
                    filter.isDefault ? 'text-ctp-blue' : 'text-ctp-overlay1'
                  )}
                  title={filter.isDefault ? 'Retirer par défaut' : 'Définir par défaut'}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(filter)}
                  className="p-1 rounded text-ctp-overlay1 hover:text-ctp-red hover:bg-ctp-surface2"
                  title="Supprimer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ctp-subtext0 text-center py-2">
          Aucun filtre sauvegardé
        </p>
      )}
    </div>
  );
}

export default SavedFilters;
