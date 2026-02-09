// ============================================================================
// PATTERN LIST - Finance Hub
// Displays learned patterns with their confidence scores
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brain, Trash2, Folder, TrendingUp, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { CategoryConfidence, ConfidenceBar } from './CategoryConfidence';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: 'expense' | 'income';
}

interface Pattern {
  id: string;
  workspaceId: string;
  pattern: string;
  categoryId: string;
  confidence: number;
  matchCount: number;
  createdAt: string;
  updatedAt: string;
  category: Category;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function PatternList() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch patterns
  const { data: patterns, isLoading } = useQuery({
    queryKey: ['patterns', workspaceId],
    queryFn: () => api.get<Pattern[]>(`/workspaces/${workspaceId}/rules/patterns`),
    enabled: !!workspaceId,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (patternId: string) =>
      api.delete(`/workspaces/${workspaceId}/rules/patterns/${patternId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patterns', workspaceId] });
      setDeleteConfirm(null);
    },
  });

  const handleDelete = (patternId: string) => {
    if (deleteConfirm === patternId) {
      deleteMutation.mutate(patternId);
    } else {
      setDeleteConfirm(patternId);
      // Auto-reset after 3 seconds
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
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
          <div className="h-8 bg-ctp-surface1 rounded w-1/3" />
          <div className="h-16 bg-ctp-surface1 rounded" />
          <div className="h-16 bg-ctp-surface1 rounded" />
          <div className="h-16 bg-ctp-surface1 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-ctp-teal/20">
          <Brain className="w-5 h-5 text-ctp-teal" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Patterns appris</h2>
          <p className="text-sm text-ctp-subtext0">
            Le systeme apprend de vos categorisations
          </p>
        </div>
      </div>

      {/* Stats */}
      {patterns && patterns.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card bg-ctp-surface0 text-center py-4">
            <p className="text-2xl font-bold text-ctp-text">{patterns.length}</p>
            <p className="text-xs text-ctp-subtext0">Patterns</p>
          </div>
          <div className="card bg-ctp-surface0 text-center py-4">
            <p className="text-2xl font-bold text-ctp-green">
              {patterns.reduce((sum, p) => sum + p.matchCount, 0)}
            </p>
            <p className="text-xs text-ctp-subtext0">Correspondances</p>
          </div>
          <div className="card bg-ctp-surface0 text-center py-4">
            <p className="text-2xl font-bold text-ctp-blue">
              {Math.round(
                (patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length) * 100
              )}%
            </p>
            <p className="text-xs text-ctp-subtext0">Confiance moy.</p>
          </div>
        </div>
      )}

      {/* Pattern List */}
      {patterns && patterns.length > 0 ? (
        <div className="space-y-2">
          {patterns.map((pattern) => (
            <div
              key={pattern.id}
              className={clsx(
                'card',
                pattern.confidence >= 0.8
                  ? 'border-ctp-green/20 hover:border-ctp-green/40'
                  : pattern.confidence >= 0.5
                    ? 'border-ctp-yellow/20 hover:border-ctp-yellow/40'
                    : 'border-ctp-red/20 hover:border-ctp-red/40',
                'transition-colors'
              )}
            >
              <div className="flex items-start gap-4">
                {/* Pattern Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-sm bg-ctp-blue/20 text-ctp-blue px-2 py-1 rounded">
                      {pattern.pattern}
                    </span>
                    <span className="text-ctp-overlay1">→</span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Folder className="w-4 h-4 text-ctp-mauve" />
                      {pattern.category.icon} {pattern.category.name}
                    </span>
                  </div>

                  {/* Confidence Bar */}
                  <div className="max-w-xs mb-2">
                    <ConfidenceBar confidence={pattern.confidence} />
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-ctp-subtext0">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {pattern.matchCount} correspondances
                    </span>
                    <span>Cree le {formatDate(pattern.createdAt)}</span>
                    {pattern.updatedAt !== pattern.createdAt && (
                      <span>Mis a jour le {formatDate(pattern.updatedAt)}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <CategoryConfidence confidence={pattern.confidence} showLabel />

                  <button
                    onClick={() => handleDelete(pattern.id)}
                    disabled={deleteMutation.isPending}
                    className={clsx(
                      'btn-ghost p-2',
                      deleteConfirm === pattern.id
                        ? 'bg-ctp-red/20 text-ctp-red'
                        : 'text-ctp-overlay1 hover:text-ctp-red'
                    )}
                    title={deleteConfirm === pattern.id ? 'Cliquez pour confirmer' : 'Supprimer'}
                  >
                    {deleteConfirm === pattern.id ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <Brain className="w-12 h-12 mx-auto mb-4 text-ctp-overlay1" />
          <p className="text-ctp-subtext0 mb-2">Aucun pattern appris</p>
          <p className="text-sm text-ctp-overlay1">
            Categorisez des transactions et cliquez sur "Apprendre"
            <br />
            pour que le systeme retienne vos preferences
          </p>
        </div>
      )}

      {/* Info Box */}
      <div className="card bg-ctp-blue/10 border-ctp-blue/30">
        <div className="flex gap-3">
          <Brain className="w-5 h-5 text-ctp-blue flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-ctp-blue mb-1">Comment fonctionne l'apprentissage ?</p>
            <p className="text-ctp-blue/80">
              Quand vous categorisez une transaction avec "Apprendre", le systeme extrait
              un pattern du libelle (nom du commercant, mots-cles). La confiance augmente
              a chaque confirmation et diminue en cas de conflit. Les patterns avec une
              haute confiance sont automatiquement suggeres.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PatternList;
