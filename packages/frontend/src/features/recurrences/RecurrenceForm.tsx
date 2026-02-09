// ============================================================================
// RECURRENCE FORM - Finance Hub
// ============================================================================

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Account {
  id: string;
  name: string;
  type: string;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  type: string;
}

interface RecurrenceTemplate {
  type: 'income' | 'expense';
  amount: number;
  description: string;
  accountId: string;
  categoryId?: string;
  tags?: string[];
  notes?: string;
}

interface Recurrence {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  dayOfMonth?: number;
  dayOfWeek?: number;
  template: RecurrenceTemplate;
  startAt: string;
  endAt?: string | null;
  isActive: boolean;
}

interface RecurrenceFormProps {
  workspaceId: string;
  recurrence?: Recurrence | null;
  onClose: () => void;
  onSave: () => void;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const FREQUENCIES = [
  { value: 'daily', label: 'Quotidien' },
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'monthly', label: 'Mensuel' },
  { value: 'yearly', label: 'Annuel' },
] as const;

const DAY_NAMES = [
  { value: 0, label: 'Dimanche' },
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function RecurrenceForm({ workspaceId, recurrence, onClose, onSave }: RecurrenceFormProps) {
  const isEditing = !!recurrence;

  // Form state
  const [name, setName] = useState(recurrence?.name ?? '');
  const [type, setType] = useState<'income' | 'expense'>(recurrence?.template.type ?? 'expense');
  const [accountId, setAccountId] = useState(recurrence?.template.accountId ?? '');
  const [categoryId, setCategoryId] = useState(recurrence?.template.categoryId ?? '');
  const [amount, setAmount] = useState(recurrence?.template.amount?.toString() ?? '');
  const [description, setDescription] = useState(recurrence?.template.description ?? '');
  const [notes, setNotes] = useState(recurrence?.template.notes ?? '');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>(
    recurrence?.frequency ?? 'monthly'
  );
  const [interval, setInterval] = useState(recurrence?.interval?.toString() ?? '1');
  const [dayOfMonth, setDayOfMonth] = useState(recurrence?.dayOfMonth?.toString() ?? '1');
  const [dayOfWeek, setDayOfWeek] = useState(recurrence?.dayOfWeek?.toString() ?? '1');
  const [startAt, setStartAt] = useState(
    recurrence?.startAt
      ? new Date(recurrence.startAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [endAt, setEndAt] = useState(
    recurrence?.endAt ? new Date(recurrence.endAt).toISOString().split('T')[0] : ''
  );
  const [isActive, setIsActive] = useState(recurrence?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts', workspaceId],
    queryFn: () => api.get<Account[]>(`/workspaces/${workspaceId}/accounts`),
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories', workspaceId, 'flat'],
    queryFn: () => api.get<Category[]>(`/workspaces/${workspaceId}/categories?flat=true`),
  });

  // Filter categories by type
  const filteredCategories = categories?.filter((cat) => cat.type === type) ?? [];

  // Reset category when type changes
  useEffect(() => {
    if (!isEditing) {
      setCategoryId('');
    }
  }, [type, isEditing]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () => {
      const data = {
        name,
        frequency,
        interval: parseInt(interval, 10),
        dayOfMonth: frequency === 'monthly' ? parseInt(dayOfMonth, 10) : undefined,
        dayOfWeek: frequency === 'weekly' ? parseInt(dayOfWeek, 10) : undefined,
        template: {
          type,
          accountId,
          categoryId: categoryId || undefined,
          amount: parseFloat(amount),
          description,
          notes: notes || undefined,
        },
        startAt,
        endAt: endAt || undefined,
        isActive,
      };

      if (isEditing) {
        return api.patch(`/workspaces/${workspaceId}/recurrences/${recurrence.id}`, data);
      }
      return api.post(`/workspaces/${workspaceId}/recurrences`, data);
    },
    onSuccess: onSave,
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('Entrez un nom pour la recurrence');
      return;
    }
    if (!accountId) {
      setError('Selectionnez un compte');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError('Entrez un montant valide');
      return;
    }
    if (!description.trim()) {
      setError('Entrez une description');
      return;
    }

    saveMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        <form onSubmit={handleSubmit} className="p-6">
          <h2 className="text-xl font-bold mb-4">
            {isEditing ? 'Modifier la recurrence' : 'Nouvelle recurrence'}
          </h2>

          {error && (
            <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="name" className="label">
                Nom <span className="text-danger-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Loyer mensuel"
                className="input"
                required
              />
            </div>

            {/* Type */}
            <div>
              <label className="label">Type de transaction</label>
              <div className="flex gap-3">
                <label
                  className={clsx(
                    'flex items-center gap-2 flex-1 p-3 rounded-lg border cursor-pointer',
                    type === 'expense'
                      ? 'border-danger-500 bg-danger-50 dark:bg-danger-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  )}
                >
                  <input
                    type="radio"
                    name="type"
                    value="expense"
                    checked={type === 'expense'}
                    onChange={() => setType('expense')}
                    className="text-danger-600"
                  />
                  <span>Depense</span>
                </label>
                <label
                  className={clsx(
                    'flex items-center gap-2 flex-1 p-3 rounded-lg border cursor-pointer',
                    type === 'income'
                      ? 'border-success-500 bg-success-50 dark:bg-success-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  )}
                >
                  <input
                    type="radio"
                    name="type"
                    value="income"
                    checked={type === 'income'}
                    onChange={() => setType('income')}
                    className="text-success-600"
                  />
                  <span>Revenu</span>
                </label>
              </div>
            </div>

            {/* Account */}
            <div>
              <label htmlFor="account" className="label">
                Compte <span className="text-danger-500">*</span>
              </label>
              <select
                id="account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="input"
                required
              >
                <option value="">Selectionner un compte</option>
                {accounts?.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount & Description */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="amount" className="label">
                  Montant <span className="text-danger-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="100.00"
                    className="input pr-12"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                    EUR
                  </span>
                </div>
              </div>
              <div>
                <label htmlFor="category" className="label">
                  Categorie
                </label>
                <select
                  id="category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="input"
                >
                  <option value="">Sans categorie</option>
                  {filteredCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="label">
                Description <span className="text-danger-500">*</span>
              </label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Paiement du loyer"
                className="input"
                required
              />
            </div>

            {/* Frequency Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="font-medium mb-3">Frequence</h3>

              {/* Frequency */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="frequency" className="label">
                    Repetition
                  </label>
                  <select
                    id="frequency"
                    value={frequency}
                    onChange={(e) =>
                      setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly')
                    }
                    className="input"
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="interval" className="label">
                    Intervalle
                  </label>
                  <input
                    id="interval"
                    type="number"
                    min="1"
                    max="99"
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              {/* Day of Month (for monthly) */}
              {frequency === 'monthly' && (
                <div>
                  <label htmlFor="dayOfMonth" className="label">
                    Jour du mois
                  </label>
                  <select
                    id="dayOfMonth"
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(e.target.value)}
                    className="input"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                    <option value="29">29 (ou dernier jour)</option>
                    <option value="30">30 (ou dernier jour)</option>
                    <option value="31">Dernier jour du mois</option>
                  </select>
                </div>
              )}

              {/* Day of Week (for weekly) */}
              {frequency === 'weekly' && (
                <div>
                  <label htmlFor="dayOfWeek" className="label">
                    Jour de la semaine
                  </label>
                  <select
                    id="dayOfWeek"
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(e.target.value)}
                    className="input"
                  >
                    {DAY_NAMES.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startAt" className="label">
                  Date de debut
                </label>
                <input
                  id="startAt"
                  type="date"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="endAt" className="label">
                  Date de fin (optionnel)
                </label>
                <input
                  id="endAt"
                  type="date"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="label">
                Notes (optionnel)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes additionnelles..."
                className="input min-h-[80px]"
                rows={3}
              />
            </div>

            {/* Active toggle (only for editing) */}
            {isEditing && (
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <p className="font-medium">Recurrence active</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Desactivez pour mettre en pause temporairement
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={clsx(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    isActive ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                  )}
                >
                  <span
                    className={clsx(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      isActive ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
            )}
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
              {saveMutation.isPending
                ? 'Enregistrement...'
                : isEditing
                  ? 'Enregistrer'
                  : 'Creer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RecurrenceForm;
