// ============================================================================
// RULE SUGGESTIONS - Finance Hub
// Shows suggested categories for uncategorized transactions
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Check, ChevronRight, Folder, Zap } from 'lucide-react';
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

interface RuleSuggestion {
  pattern: string;
  categoryId: string;
  categoryName: string;
  matchCount: number;
  exampleTransactions: string[];
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function RuleSuggestions() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);

  // Fetch suggestions for uncategorized transactions
  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['rule-suggestions', workspaceId],
    queryFn: () =>
      api.get<TransactionSuggestion[]>(`/workspaces/${workspaceId}/rules/suggestions?limit=20`),
    enabled: !!workspaceId,
  });

  // Fetch rule suggestions
  const { data: ruleSuggestions } = useQuery({
    queryKey: ['rule-pattern-suggestions', workspaceId],
    queryFn: () => api.get<RuleSuggestion[]>(`/workspaces/${workspaceId}/rules/rule-suggestions`),
    enabled: !!workspaceId,
  });

  // Apply and learn mutation
  const applyMutation = useMutation({
    mutationFn: ({
      transactionId,
      categoryId,
      learn,
    }: {
      transactionId: string;
      categoryId: string;
      learn: boolean;
    }) =>
      api.post(`/workspaces/${workspaceId}/rules/bulk-apply`, {
        applications: [{ transactionId, categoryId, learn }],
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rule-suggestions', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['transactions', workspaceId] });
    },
  });

  const handleApply = (transactionId: string, categoryId: string, learn: boolean) => {
    applyMutation.mutate({ transactionId, categoryId, learn });
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

  const getSourceLabel = (source: CategorySuggestion['source']): string => {
    switch (source) {
      case 'pattern':
        return 'Pattern appris';
      case 'rule':
        return 'Règle existante';
      case 'similar':
        return 'Transactions similaires';
      default:
        return source;
    }
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
          <div className="h-8 bg-ctp-surface1 rounded w-1/3" />
          <div className="h-24 bg-ctp-surface1 rounded" />
          <div className="h-24 bg-ctp-surface1 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-ctp-mauve/20">
          <Sparkles className="w-5 h-5 text-ctp-mauve" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Suggestions de categories</h2>
          <p className="text-sm text-ctp-subtext0">
            Basees sur vos habitudes de categorisation
          </p>
        </div>
      </div>

      {/* Transaction Suggestions */}
      {suggestions && suggestions.length > 0 ? (
        <div className="space-y-3">
          {suggestions.map((txn) => (
            <div
              key={txn.transactionId}
              className="card hover:border-ctp-mauve/30 transition-colors"
            >
              {/* Transaction Header */}
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() =>
                  setExpandedTransaction(
                    expandedTransaction === txn.transactionId ? null : txn.transactionId
                  )
                }
              >
                <ChevronRight
                  className={clsx(
                    'w-4 h-4 text-ctp-overlay1 transition-transform',
                    expandedTransaction === txn.transactionId && 'rotate-90'
                  )}
                />

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

                {/* Top suggestion preview */}
                {txn.suggestions[0] && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-ctp-subtext0">
                      {txn.suggestions[0].categoryIcon} {txn.suggestions[0].categoryName}
                    </span>
                    <CategoryConfidence confidence={txn.suggestions[0].confidence} size="sm" />
                  </div>
                )}
              </div>

              {/* Expanded Suggestions */}
              {expandedTransaction === txn.transactionId && (
                <div className="mt-4 pt-4 border-t border-ctp-surface1 space-y-3">
                  {txn.suggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-lg bg-ctp-surface0 hover:bg-ctp-surface1 transition-colors"
                    >
                      <Folder className="w-4 h-4 text-ctp-blue" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {suggestion.categoryIcon} {suggestion.categoryName}
                          </span>
                          <CategoryConfidence confidence={suggestion.confidence} size="sm" />
                        </div>
                        <p className="text-xs text-ctp-subtext0 mt-0.5">
                          {getSourceLabel(suggestion.source)}: {suggestion.pattern}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApply(txn.transactionId, suggestion.categoryId, false);
                          }}
                          disabled={applyMutation.isPending}
                          className="btn-ghost text-sm flex items-center gap-1 text-ctp-green hover:bg-ctp-green/10"
                          title="Appliquer"
                        >
                          <Check className="w-4 h-4" />
                          Appliquer
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApply(txn.transactionId, suggestion.categoryId, true);
                          }}
                          disabled={applyMutation.isPending}
                          className="btn-ghost text-sm flex items-center gap-1 text-ctp-mauve hover:bg-ctp-mauve/10"
                          title="Appliquer et apprendre"
                        >
                          <Zap className="w-4 h-4" />
                          Apprendre
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-8">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-ctp-overlay1" />
          <p className="text-ctp-subtext0">
            Aucune suggestion disponible
          </p>
          <p className="text-sm text-ctp-overlay1 mt-1">
            Categorisez quelques transactions pour que le systeme apprenne
          </p>
        </div>
      )}

      {/* Rule Suggestions Section */}
      {ruleSuggestions && ruleSuggestions.length > 0 && (
        <div className="mt-8">
          <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-ctp-yellow" />
            Regles suggerees
          </h3>

          <div className="space-y-2">
            {ruleSuggestions.map((suggestion, idx) => (
              <div key={idx} className="card bg-ctp-surface0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm bg-ctp-blue/20 text-ctp-blue px-2 py-0.5 rounded">
                        {suggestion.pattern}
                      </span>
                      <span className="text-ctp-mauve">→</span>
                      <span className="font-medium">{suggestion.categoryName}</span>
                    </div>
                    <p className="text-sm text-ctp-subtext0">
                      {suggestion.matchCount} transactions non categorisees correspondent
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {suggestion.exampleTransactions.slice(0, 3).map((ex, i) => (
                        <span
                          key={i}
                          className="text-xs bg-ctp-surface1 px-2 py-0.5 rounded truncate max-w-48"
                          title={ex}
                        >
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default RuleSuggestions;
