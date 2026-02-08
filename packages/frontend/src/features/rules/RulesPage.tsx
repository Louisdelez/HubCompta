// ============================================================================
// RULES PAGE - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { RuleEditor } from './RuleEditor';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface RuleCondition {
  field: 'description' | 'amount';
  operator: string;
  value: string;
}

interface RuleAction {
  type: 'set_category' | 'add_tag' | 'set_notes';
  value: string;
}

interface Rule {
  id: string;
  name: string;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  isEnabled: boolean;
  matchCount: number;
  lastMatchedAt?: string;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const OPERATOR_LABELS: Record<string, string> = {
  contains: 'contient',
  equals: 'égal à',
  starts_with: 'commence par',
  ends_with: 'termine par',
  regex: 'correspond à (regex)',
  greater_than: 'supérieur à',
  less_than: 'inférieur à',
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function RulesPage() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  // Fetch rules
  const { data: rules, isLoading } = useQuery({
    queryKey: ['rules', workspaceId],
    queryFn: () => api.get<Rule[]>(`/workspaces/${workspaceId}/rules`),
    enabled: !!workspaceId,
  });

  // Toggle rule mutation
  const toggleMutation = useMutation({
    mutationFn: (ruleId: string) =>
      api.post(`/workspaces/${workspaceId}/rules/${ruleId}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules', workspaceId] });
    },
  });

  // Delete rule mutation
  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) =>
      api.delete(`/workspaces/${workspaceId}/rules/${ruleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules', workspaceId] });
    },
  });

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    setShowEditor(true);
  };

  const handleDelete = (rule: Rule) => {
    if (confirm(`Supprimer la règle "${rule.name}" ?`)) {
      deleteMutation.mutate(rule.id);
    }
  };

  const handleClose = () => {
    setShowEditor(false);
    setEditingRule(null);
  };

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-gray-500">
        Sélectionnez un espace de travail
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Règles de catégorisation</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Catégorisez automatiquement vos transactions
          </p>
        </div>
        <button onClick={() => setShowEditor(true)} className="btn-primary">
          + Nouvelle règle
        </button>
      </div>

      {/* Info Box */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mb-6">
        <div className="flex gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-200">
              Comment fonctionnent les règles ?
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Les règles sont appliquées automatiquement lors de l'import de transactions.
              Elles permettent de catégoriser, ajouter des tags ou des notes selon des critères
              que vous définissez.
            </p>
          </div>
        </div>
      </div>

      {/* Rules List */}
      {rules && rules.length > 0 ? (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={clsx(
                'card',
                !rule.isEnabled && 'opacity-60'
              )}
            >
              <div className="flex items-start gap-4">
                {/* Toggle */}
                <button
                  onClick={() => toggleMutation.mutate(rule.id)}
                  className={clsx(
                    'w-12 h-6 rounded-full relative transition-colors flex-shrink-0 mt-1',
                    rule.isEnabled ? 'bg-success-500' : 'bg-gray-300 dark:bg-gray-600'
                  )}
                >
                  <span
                    className={clsx(
                      'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                      rule.isEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    )}
                  />
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium">{rule.name}</h3>
                    <span className="text-xs text-gray-400">
                      Priorité: {rule.priority}
                    </span>
                  </div>

                  {/* Conditions */}
                  <div className="space-y-1 text-sm">
                    {rule.conditions.map((condition, i) => (
                      <div key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <span className="font-medium">
                          {condition.field === 'description' ? 'Description' : 'Montant'}
                        </span>
                        <span>{OPERATOR_LABELS[condition.operator] ?? condition.operator}</span>
                        <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">
                          {condition.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {rule.actions.map((action, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                      >
                        {action.type === 'set_category' && '📁 Catégorie'}
                        {action.type === 'add_tag' && '🏷️ Tag'}
                        {action.type === 'set_notes' && '📝 Note'}
                      </span>
                    ))}
                  </div>

                  {/* Stats */}
                  {rule.matchCount > 0 && (
                    <p className="text-xs text-gray-400 mt-2">
                      {rule.matchCount} correspondance{rule.matchCount > 1 ? 's' : ''}
                      {rule.lastMatchedAt && (
                        <> • Dernière: {new Date(rule.lastMatchedAt).toLocaleDateString('fr-FR')}</>
                      )}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(rule)}
                    className="btn-ghost text-sm"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(rule)}
                    className="btn-ghost text-danger-600 text-sm"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-500 mb-4">Aucune règle configurée</p>
          <button onClick={() => setShowEditor(true)} className="btn-primary">
            Créer votre première règle
          </button>
        </div>
      )}

      {/* Rule Editor Modal */}
      {showEditor && (
        <RuleEditor
          workspaceId={workspaceId}
          {...(editingRule ? { rule: editingRule } : {})}
          onClose={handleClose}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ['rules', workspaceId] });
            handleClose();
          }}
        />
      )}
    </div>
  );
}

export default RulesPage;
