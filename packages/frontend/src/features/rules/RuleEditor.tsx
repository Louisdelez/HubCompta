// ============================================================================
// RULE EDITOR - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
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
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon?: string;
}

interface Tag {
  id: string;
  name: string;
}

interface RuleEditorProps {
  workspaceId: string;
  rule?: Rule;
  onClose: () => void;
  onSave: () => void;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const DESCRIPTION_OPERATORS = [
  { value: 'contains', label: 'Contient' },
  { value: 'equals', label: 'Égal à' },
  { value: 'starts_with', label: 'Commence par' },
  { value: 'ends_with', label: 'Termine par' },
  { value: 'regex', label: 'Correspond à (regex)' },
];

const AMOUNT_OPERATORS = [
  { value: 'equals', label: 'Égal à' },
  { value: 'greater_than', label: 'Supérieur à' },
  { value: 'less_than', label: 'Inférieur à' },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function RuleEditor({ workspaceId, rule, onClose, onSave }: RuleEditorProps) {
  const isEditing = !!rule;

  const [name, setName] = useState(rule?.name ?? '');
  const [priority, setPriority] = useState(rule?.priority ?? 0);
  const [conditions, setConditions] = useState<RuleCondition[]>(
    rule?.conditions ?? [{ field: 'description', operator: 'contains', value: '' }]
  );
  const [actions, setActions] = useState<RuleAction[]>(
    rule?.actions ?? [{ type: 'set_category', value: '' }]
  );
  const [error, setError] = useState<string | null>(null);

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories', workspaceId],
    queryFn: () => api.get<Category[]>(`/workspaces/${workspaceId}/categories?flat=true`),
  });

  // Fetch tags
  const { data: tags } = useQuery({
    queryKey: ['tags', workspaceId],
    queryFn: () => api.get<Tag[]>(`/workspaces/${workspaceId}/tags`),
  });

  // Test rule mutation
  const testMutation = useMutation({
    mutationFn: () =>
      api.post<Array<{ id: string; description: string; amount: number; matches: boolean }>>(
        `/workspaces/${workspaceId}/rules/test`,
        { conditions }
      ),
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () => {
      const data = { name, priority, conditions, actions, isEnabled: true };
      if (isEditing) {
        return api.patch(`/workspaces/${workspaceId}/rules/${rule.id}`, data);
      }
      return api.post(`/workspaces/${workspaceId}/rules`, data);
    },
    onSuccess: onSave,
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    },
  });

  const addCondition = () => {
    setConditions([...conditions, { field: 'description', operator: 'contains', value: '' }]);
  };

  const removeCondition = (index: number) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index));
    }
  };

  const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
    setConditions(
      conditions.map((c, i) => (i === index ? { ...c, ...updates } : c))
    );
  };

  const addAction = () => {
    setActions([...actions, { type: 'set_category', value: '' }]);
  };

  const removeAction = (index: number) => {
    if (actions.length > 1) {
      setActions(actions.filter((_, i) => i !== index));
    }
  };

  const updateAction = (index: number, updates: Partial<RuleAction>) => {
    setActions(
      actions.map((a, i) => (i === index ? { ...a, ...updates } : a))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    if (!name.trim()) {
      setError('Nom de la règle requis');
      return;
    }
    if (conditions.some((c) => !c.value.trim())) {
      setError('Toutes les conditions doivent avoir une valeur');
      return;
    }
    if (actions.some((a) => !a.value)) {
      setError('Toutes les actions doivent avoir une valeur');
      return;
    }

    saveMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto animate-scale-in">
        <form onSubmit={handleSubmit} className="p-6">
          <h2 className="text-xl font-bold mb-4">
            {isEditing ? 'Modifier la règle' : 'Nouvelle règle'}
          </h2>

          {error && (
            <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm mb-4">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {/* Name & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="label">Nom de la règle</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Courses alimentaires"
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="priority" className="label">Priorité</label>
                <input
                  id="priority"
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Les règles avec une priorité plus élevée s'appliquent en premier
                </p>
              </div>
            </div>

            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Conditions</label>
                <button
                  type="button"
                  onClick={addCondition}
                  className="text-sm text-primary-600 hover:underline"
                >
                  + Ajouter
                </button>
              </div>

              <div className="space-y-2">
                {conditions.map((condition, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    {/* Field */}
                    <select
                      value={condition.field}
                      onChange={(e) =>
                        updateCondition(index, {
                          field: e.target.value as 'description' | 'amount',
                          operator: e.target.value === 'amount' ? 'equals' : 'contains',
                        })
                      }
                      className="input w-auto"
                    >
                      <option value="description">Description</option>
                      <option value="amount">Montant</option>
                    </select>

                    {/* Operator */}
                    <select
                      value={condition.operator}
                      onChange={(e) => updateCondition(index, { operator: e.target.value })}
                      className="input w-auto"
                    >
                      {(condition.field === 'amount' ? AMOUNT_OPERATORS : DESCRIPTION_OPERATORS).map(
                        (op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        )
                      )}
                    </select>

                    {/* Value */}
                    <input
                      type={condition.field === 'amount' ? 'number' : 'text'}
                      value={condition.value}
                      onChange={(e) => updateCondition(index, { value: e.target.value })}
                      placeholder={condition.field === 'amount' ? '0.00' : 'Texte à rechercher'}
                      className="input flex-1"
                    />

                    {/* Remove */}
                    {conditions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCondition(index)}
                        className="btn-ghost text-danger-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Toutes les conditions doivent être remplies (ET logique)
              </p>
            </div>

            {/* Test Button */}
            <button
              type="button"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || conditions.some((c) => !c.value)}
              className="btn-secondary w-full"
            >
              {testMutation.isPending ? 'Test en cours...' : 'Tester la règle'}
            </button>

            {/* Test Results */}
            {testMutation.data && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm font-medium mb-2">
                  {testMutation.data.filter((t) => t.matches).length} correspondance(s) sur{' '}
                  {testMutation.data.length} transactions récentes
                </p>
                <div className="space-y-1 max-h-32 overflow-auto">
                  {testMutation.data
                    .filter((t) => t.matches)
                    .slice(0, 5)
                    .map((t) => (
                      <p key={t.id} className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        ✓ {t.description}
                      </p>
                    ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Actions</label>
                <button
                  type="button"
                  onClick={addAction}
                  className="text-sm text-primary-600 hover:underline"
                >
                  + Ajouter
                </button>
              </div>

              <div className="space-y-2">
                {actions.map((action, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    {/* Type */}
                    <select
                      value={action.type}
                      onChange={(e) =>
                        updateAction(index, {
                          type: e.target.value as RuleAction['type'],
                          value: '',
                        })
                      }
                      className="input w-auto"
                    >
                      <option value="set_category">Définir catégorie</option>
                      <option value="add_tag">Ajouter tag</option>
                      <option value="set_notes">Définir note</option>
                    </select>

                    {/* Value */}
                    {action.type === 'set_category' ? (
                      <select
                        value={action.value}
                        onChange={(e) => updateAction(index, { value: e.target.value })}
                        className="input flex-1"
                      >
                        <option value="">Sélectionner une catégorie</option>
                        {categories?.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.icon} {cat.name}
                          </option>
                        ))}
                      </select>
                    ) : action.type === 'add_tag' ? (
                      <select
                        value={action.value}
                        onChange={(e) => updateAction(index, { value: e.target.value })}
                        className="input flex-1"
                      >
                        <option value="">Sélectionner un tag</option>
                        {tags?.map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={action.value}
                        onChange={(e) => updateAction(index, { value: e.target.value })}
                        placeholder="Note à ajouter"
                        className="input flex-1"
                      />
                    )}

                    {/* Remove */}
                    {actions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAction(index)}
                        className="btn-ghost text-danger-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Annuler
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="btn-primary flex-1"
            >
              {saveMutation.isPending ? 'Enregistrement...' : isEditing ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RuleEditor;
