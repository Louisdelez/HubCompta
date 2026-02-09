// ============================================================================
// SCHEDULED MODAL - Finance Hub
// Create/edit scheduled transaction modal
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  type: string;
}

interface ScheduledTransaction {
  id: string;
  accountId: string;
  categoryId?: string | null;
  amount: number;
  currency: string;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  scheduledDate: string;
  notes?: string | null;
  isExecuted: boolean;
}

interface ScheduledModalProps {
  workspaceId: string;
  scheduled?: ScheduledTransaction | null;
  onClose: () => void;
  onSave: () => void;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ScheduledModal({
  workspaceId,
  scheduled,
  onClose,
  onSave,
}: ScheduledModalProps) {
  const isEditing = !!scheduled;

  // Form state
  const [type, setType] = useState<'income' | 'expense'>(
    scheduled?.type === 'income' ? 'income' : 'expense'
  );
  const [accountId, setAccountId] = useState(scheduled?.accountId ?? '');
  const [categoryId, setCategoryId] = useState(scheduled?.categoryId ?? '');
  const [amount, setAmount] = useState(
    scheduled?.amount ? String(Number(scheduled.amount)) : ''
  );
  const [description, setDescription] = useState(scheduled?.description ?? '');
  const [scheduledDate, setScheduledDate] = useState(
    scheduled?.scheduledDate
      ? new Date(scheduled.scheduledDate).toISOString().split('T')[0]
      : ''
  );
  const [notes, setNotes] = useState(scheduled?.notes ?? '');
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

  // Set default date to tomorrow if creating
  useEffect(() => {
    if (!isEditing && !scheduledDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setScheduledDate(tomorrow.toISOString().split('T')[0]);
    }
  }, [isEditing, scheduledDate]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () => {
      const data = {
        type,
        accountId,
        categoryId: categoryId || undefined,
        amount: parseFloat(amount),
        description,
        scheduledDate,
        notes: notes || undefined,
      };

      if (isEditing) {
        return api.patch(`/workspaces/${workspaceId}/scheduled/${scheduled.id}`, data);
      }
      return api.post(`/workspaces/${workspaceId}/scheduled`, data);
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
    if (!scheduledDate) {
      setError('Selectionnez une date');
      return;
    }

    // Check date is in the future
    const selectedDate = new Date(scheduledDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      setError('La date doit etre dans le futur');
      return;
    }

    saveMutation.mutate();
  };

  // Get min date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        <form onSubmit={handleSubmit} className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">
              {isEditing ? 'Modifier la transaction' : 'Nouvelle transaction programmee'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-ctp-surface1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-ctp-red/10 text-ctp-red text-sm mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Type */}
            <div>
              <label className="label">Type de transaction</label>
              <div className="flex gap-3">
                <label
                  className={clsx(
                    'flex items-center gap-2 flex-1 p-3 rounded-lg border-2 cursor-pointer transition-colors',
                    type === 'expense'
                      ? 'border-ctp-red bg-ctp-red/10 text-ctp-red'
                      : 'border-ctp-surface1 hover:bg-ctp-surface0'
                  )}
                >
                  <input
                    type="radio"
                    name="type"
                    value="expense"
                    checked={type === 'expense'}
                    onChange={() => setType('expense')}
                    className="text-ctp-red accent-ctp-red"
                  />
                  <span>Depense</span>
                </label>
                <label
                  className={clsx(
                    'flex items-center gap-2 flex-1 p-3 rounded-lg border-2 cursor-pointer transition-colors',
                    type === 'income'
                      ? 'border-ctp-green bg-ctp-green/10 text-ctp-green'
                      : 'border-ctp-surface1 hover:bg-ctp-surface0'
                  )}
                >
                  <input
                    type="radio"
                    name="type"
                    value="income"
                    checked={type === 'income'}
                    onChange={() => setType('income')}
                    className="text-ctp-green accent-ctp-green"
                  />
                  <span>Revenu</span>
                </label>
              </div>
            </div>

            {/* Scheduled Date */}
            <div>
              <label htmlFor="scheduledDate" className="label">
                Date programmee <span className="text-ctp-red">*</span>
              </label>
              <input
                id="scheduledDate"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={getMinDate()}
                className="input"
                required
              />
            </div>

            {/* Account */}
            <div>
              <label htmlFor="account" className="label">
                Compte <span className="text-ctp-red">*</span>
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

            {/* Amount & Category */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="amount" className="label">
                  Montant <span className="text-ctp-red">*</span>
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
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ctp-subtext0">
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
                Description <span className="text-ctp-red">*</span>
              </label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Paiement assurance"
                className="input"
                required
              />
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
                  : 'Programmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ScheduledModal;
