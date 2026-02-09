// ============================================================================
// RULES PAGE - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lightbulb, Folder, Tag, FileText, ClipboardList, Sparkles, Brain, CheckCheck, List } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { RuleEditor } from './RuleEditor';
import { RuleSuggestions } from './RuleSuggestions';
import { PatternList } from './PatternList';
import { BulkCategorize } from './BulkCategorize';
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

type TabType = 'rules' | 'suggestions' | 'patterns' | 'bulk';

export function RulesPage() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('rules');
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
      void queryClient.invalidateQueries({ queryKey: ['rules', workspaceId] });
    },
  });

  // Delete rule mutation
  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) =>
      api.delete(`/workspaces/${workspaceId}/rules/${ruleId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rules', workspaceId] });
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
      <div className="p-6 text-center text-ctp-subtext0">
        Sélectionnez un espace de travail
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-ctp-surface1 rounded w-1/4" />
          <div className="h-20 bg-ctp-surface1 rounded" />
          <div className="h-20 bg-ctp-surface1 rounded" />
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'rules' as const, label: 'Regles', icon: List },
    { id: 'suggestions' as const, label: 'Suggestions', icon: Sparkles },
    { id: 'patterns' as const, label: 'Patterns', icon: Brain },
    { id: 'bulk' as const, label: 'Categoriser', icon: CheckCheck },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Regles et auto-categorisation</h1>
          <p className="text-ctp-subtext0">
            Categorisez automatiquement vos transactions
          </p>
        </div>
        {activeTab === 'rules' && (
          <button onClick={() => setShowEditor(true)} className="btn-primary">
            + Nouvelle regle
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 mb-6 bg-ctp-surface0 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center',
              activeTab === tab.id
                ? 'bg-ctp-base text-ctp-text shadow-sm'
                : 'text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface1'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'suggestions' && <RuleSuggestions />}
      {activeTab === 'patterns' && <PatternList />}
      {activeTab === 'bulk' && <BulkCategorize />}

      {activeTab === 'rules' && (
        <>
          {/* Info Box */}
      <div className="card bg-ctp-blue/10 border-ctp-blue mb-6">
        <div className="flex gap-3">
          <Lightbulb className="w-6 h-6 text-ctp-blue flex-shrink-0" />
          <div>
            <p className="font-medium text-ctp-blue">
              Comment fonctionnent les règles ?
            </p>
            <p className="text-sm text-ctp-blue/80 mt-1">
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
                rule.isEnabled
                  ? 'bg-ctp-green/10 border-ctp-green/30'
                  : 'bg-ctp-surface0 opacity-60'
              )}
            >
              <div className="flex items-start gap-4">
                {/* Toggle */}
                <button
                  onClick={() => toggleMutation.mutate(rule.id)}
                  className={clsx(
                    'w-12 h-6 rounded-full relative transition-colors flex-shrink-0 mt-1',
                    rule.isEnabled ? 'bg-ctp-green' : 'bg-ctp-surface2'
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
                    <span className="text-xs text-ctp-overlay1">
                      Priorité: {rule.priority}
                    </span>
                  </div>

                  {/* Conditions */}
                  <div className="space-y-1 text-sm">
                    {rule.conditions.map((condition, i) => (
                      <div key={i} className="flex items-center gap-2 text-ctp-subtext0">
                        <span className="font-medium">
                          {condition.field === 'description' ? 'Description' : 'Montant'}
                        </span>
                        <span>{OPERATOR_LABELS[condition.operator] ?? condition.operator}</span>
                        <span className="font-mono bg-ctp-blue/20 text-ctp-blue px-1 rounded">
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
                        className="text-xs px-2 py-1 rounded-full bg-ctp-mauve/20 text-ctp-mauve inline-flex items-center gap-1"
                      >
                        {action.type === 'set_category' && <><Folder className="w-3 h-3" /> Catégorie</>}
                        {action.type === 'add_tag' && <><Tag className="w-3 h-3" /> Tag</>}
                        {action.type === 'set_notes' && <><FileText className="w-3 h-3" /> Note</>}
                      </span>
                    ))}
                  </div>

                  {/* Stats */}
                  {rule.matchCount > 0 && (
                    <p className="text-xs text-ctp-overlay1 mt-2">
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
                    className="btn-ghost text-ctp-red text-sm"
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
          <ClipboardList className="w-12 h-12 mx-auto mb-4 text-ctp-overlay1" />
          <p className="text-ctp-subtext0 mb-4">Aucune règle configurée</p>
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
                void queryClient.invalidateQueries({ queryKey: ['rules', workspaceId] });
                handleClose();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

export default RulesPage;
