// ============================================================================
// BULK CATEGORIZE - Finance Hub
// Bulk apply category suggestions to multiple transactions
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckSquare,
  Square,
  Zap,
  Check,
  X,
  Loader2,
  Filter,
  RefreshCw,
  CheckCheck,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { CategoryConfidence } from './CategoryConfidence';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string | null;
  categoryColor?: string | null;
  confidence: number;
  pattern: string;
  source: 'pattern' | 'rule' | 'similar';
}

interface TransactionSuggestion {
  transactionId: string;
  description: string;
  amount: number;
  date: string;
  suggestions: CategorySuggestion[];
}

interface SelectedTransaction {
  transactionId: string;
  categoryId: string;
  learn: boolean;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function BulkCategorize() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  const [selections, setSelections] = useState<Map<string, SelectedTransaction>>(new Map());
  const [minConfidence, setMinConfidence] = useState<number>(0.5);
  const [learnAll, setLearnAll] = useState<boolean>(true);

  // Fetch suggestions
  const { data: suggestions, isLoading, refetch } = useQuery({
    queryKey: ['bulk-suggestions', workspaceId],
    queryFn: () =>
      api.get<TransactionSuggestion[]>(`/workspaces/${workspaceId}/rules/suggestions?limit=100`),
    enabled: !!workspaceId,
  });

  // Apply bulk mutation
  const applyMutation = useMutation({
    mutationFn: (applications: SelectedTransaction[]) =>
      api.post<{ applied: number; learned: number }>(
        `/workspaces/${workspaceId}/rules/bulk-apply`,
        { applications }
      ),
    onSuccess: (result) => {
      setSelections(new Map());
      void queryClient.invalidateQueries({ queryKey: ['bulk-suggestions', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['transactions', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['patterns', workspaceId] });
      alert(`${result.applied} transaction(s) categorisee(s), ${result.learned} pattern(s) appris`);
    },
  });

  // Filter suggestions by confidence
  const filteredSuggestions = useMemo(() => {
    if (!suggestions) return [];
    return suggestions.filter((s) => {
      const firstSuggestion = s.suggestions[0];
      return s.suggestions.length > 0 && firstSuggestion && firstSuggestion.confidence >= minConfidence;
    });
  }, [suggestions, minConfidence]);

  // Select/deselect transaction
  const toggleSelection = (txn: TransactionSuggestion) => {
    const newSelections = new Map(selections);
    if (newSelections.has(txn.transactionId)) {
      newSelections.delete(txn.transactionId);
    } else if (txn.suggestions[0]) {
      newSelections.set(txn.transactionId, {
        transactionId: txn.transactionId,
        categoryId: txn.suggestions[0].categoryId,
        learn: learnAll,
      });
    }
    setSelections(newSelections);
  };

  // Select all visible
  const selectAll = () => {
    const newSelections = new Map<string, SelectedTransaction>();
    filteredSuggestions.forEach((txn) => {
      const firstSuggestion = txn.suggestions[0];
      if (firstSuggestion) {
        newSelections.set(txn.transactionId, {
          transactionId: txn.transactionId,
          categoryId: firstSuggestion.categoryId,
          learn: learnAll,
        });
      }
    });
    setSelections(newSelections);
  };

  // Deselect all
  const deselectAll = () => {
    setSelections(new Map());
  };

  // Apply selected
  const applySelected = () => {
    const applications = Array.from(selections.values());
    if (applications.length > 0) {
      applyMutation.mutate(applications);
    }
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  };

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-ctp-subtext0">
        Selectionnez un espace de travail
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-ctp-surface1 rounded w-full" />
          <div className="h-16 bg-ctp-surface1 rounded" />
          <div className="h-16 bg-ctp-surface1 rounded" />
          <div className="h-16 bg-ctp-surface1 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-ctp-green/20">
            <CheckCheck className="w-5 h-5 text-ctp-green" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Categorisation en masse</h2>
            <p className="text-sm text-ctp-subtext0">
              {filteredSuggestions.length} transaction(s) avec suggestions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void refetch()}
            className="btn-ghost p-2"
            title="Rafraichir"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card bg-ctp-surface0">
        <div className="flex flex-wrap items-center gap-4">
          {/* Confidence filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-ctp-subtext0" />
            <label htmlFor="minConfidence" className="text-sm text-ctp-subtext0">
              Confiance min:
            </label>
            <select
              id="minConfidence"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="input py-1 w-auto"
            >
              <option value={0}>Tous</option>
              <option value={0.5}>50%+</option>
              <option value={0.7}>70%+</option>
              <option value={0.8}>80%+</option>
              <option value={0.9}>90%+</option>
            </select>
          </div>

          {/* Learn toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={learnAll}
              onChange={(e) => setLearnAll(e.target.checked)}
              className="w-4 h-4 rounded border-ctp-surface2 text-ctp-mauve focus:ring-ctp-mauve"
            />
            <span className="text-sm text-ctp-subtext0">Apprendre les patterns</span>
          </label>

          <div className="flex-1" />

          {/* Selection controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="btn-ghost text-sm flex items-center gap-1"
            >
              <CheckSquare className="w-4 h-4" />
              Tout
            </button>
            <button
              onClick={deselectAll}
              className="btn-ghost text-sm flex items-center gap-1"
            >
              <Square className="w-4 h-4" />
              Aucun
            </button>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      {selections.size > 0 && (
        <div className="sticky top-0 z-10 card bg-ctp-mauve/10 border-ctp-mauve/30">
          <div className="flex items-center justify-between">
            <span className="font-medium text-ctp-mauve">
              {selections.size} transaction(s) selectionnee(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={deselectAll}
                className="btn-ghost text-sm flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Annuler
              </button>
              <button
                onClick={applySelected}
                disabled={applyMutation.isPending}
                className="btn-primary flex items-center gap-2"
              >
                {applyMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Appliquer ({selections.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction List */}
      {filteredSuggestions.length > 0 ? (
        <div className="space-y-2">
          {filteredSuggestions.map((txn) => {
            const isSelected = selections.has(txn.transactionId);
            const topSuggestion = txn.suggestions[0];

            return (
              <div
                key={txn.transactionId}
                onClick={() => toggleSelection(txn)}
                className={clsx(
                  'card cursor-pointer transition-all',
                  isSelected
                    ? 'border-ctp-mauve bg-ctp-mauve/5'
                    : 'hover:border-ctp-surface2'
                )}
              >
                <div className="flex items-center gap-4">
                  {/* Checkbox */}
                  <div className="flex-shrink-0">
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-ctp-mauve" />
                    ) : (
                      <Square className="w-5 h-5 text-ctp-overlay1" />
                    )}
                  </div>

                  {/* Transaction Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{txn.description}</p>
                    <div className="flex items-center gap-2 text-sm text-ctp-subtext0">
                      <span>{formatDate(txn.date)}</span>
                      <span>•</span>
                      <span
                        className={clsx(
                          'font-medium',
                          txn.amount < 0 ? 'text-ctp-red' : 'text-ctp-green'
                        )}
                      >
                        {formatAmount(txn.amount)}
                      </span>
                    </div>
                  </div>

                  {/* Suggested Category */}
                  {topSuggestion && (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-medium">
                          {topSuggestion.categoryIcon} {topSuggestion.categoryName}
                        </p>
                        <p className="text-xs text-ctp-subtext0">{topSuggestion.pattern}</p>
                      </div>
                      <CategoryConfidence confidence={topSuggestion.confidence} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card text-center py-12">
          <Check className="w-12 h-12 mx-auto mb-4 text-ctp-green" />
          <p className="text-ctp-subtext0 mb-2">Aucune suggestion disponible</p>
          <p className="text-sm text-ctp-overlay1">
            Toutes les transactions sont categorisees ou
            <br />
            la confiance minimum est trop elevee
          </p>
        </div>
      )}

      {/* Summary */}
      {filteredSuggestions.length > 0 && (
        <div className="card bg-ctp-surface0 text-center">
          <p className="text-sm text-ctp-subtext0">
            <strong className="text-ctp-text">{filteredSuggestions.length}</strong> transactions
            avec suggestions
            {minConfidence > 0 && (
              <> (confiance &ge; {Math.round(minConfidence * 100)}%)</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

export default BulkCategorize;
