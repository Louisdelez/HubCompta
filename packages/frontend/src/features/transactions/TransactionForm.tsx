// ============================================================================
// TRANSACTION FORM - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { CategorySelector } from './CategorySelector';
import { TagInput } from './TagInput';
import { DocumentAttachment } from './DocumentAttachment';
import { CurrencySelector } from '@/features/currency';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface TransactionFormData {
  accountId: string;
  type: 'expense' | 'income';
  amount: number;
  currency: string;
  description: string;
  date: string;
  categoryId?: string;
  notes?: string;
}

interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  currency: string;
  description: string;
  date: string;
  type: 'expense' | 'income' | 'transfer';
  categoryId?: string | undefined;
  notes?: string | undefined;
  tags: { id: string; name: string }[];
}

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
}

interface TransactionFormProps {
  workspaceId: string;
  transaction?: Transaction | undefined;
  onClose: () => void;
  onSuccess: () => void;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function TransactionForm({
  workspaceId,
  transaction,
  onClose,
  onSuccess,
}: TransactionFormProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    transaction?.tags.map((t) => t.id) ?? []
  );

  const isEditing = !!transaction;
  const isTransfer = transaction?.type === 'transfer';

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts', workspaceId],
    queryFn: () => api.get<Account[]>(`/workspaces/${workspaceId}/accounts`),
  });

  const getDefaultDate = (): string => {
    if (transaction?.date) {
      const parts = transaction.date.split('T');
      return parts[0] ?? new Date().toISOString().split('T')[0] ?? '';
    }
    return new Date().toISOString().split('T')[0] ?? '';
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TransactionFormData>({
    defaultValues: {
      accountId: transaction?.accountId ?? '',
      type: transaction?.type === 'income' ? 'income' : 'expense',
      amount: transaction ? Math.abs(transaction.amount) : 0,
      currency: transaction?.currency ?? 'EUR',
      description: transaction?.description ?? '',
      date: getDefaultDate(),
      categoryId: transaction?.categoryId ?? '',
      notes: transaction?.notes ?? '',
    },
  });

  const selectedType = watch('type');
  const selectedCategoryId = watch('categoryId');
  const selectedAccountId = watch('accountId');
  const selectedCurrency = watch('currency');

  // Get selected account for currency validation
  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId);

  const createMutation = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      const amount = data.type === 'expense' ? -Math.abs(data.amount) : Math.abs(data.amount);
      const result = await api.post(`/workspaces/${workspaceId}/transactions`, {
        accountId: data.accountId,
        type: data.type,
        amount,
        currency: data.currency,
        description: data.description,
        date: data.date,
        categoryId: data.categoryId,
        notes: data.notes,
        tags: selectedTags,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['accounts', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary', workspaceId] });
      onSuccess();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      const amount = data.type === 'expense' ? -Math.abs(data.amount) : Math.abs(data.amount);
      return api.patch(`/workspaces/${workspaceId}/transactions/${transaction!.id}`, {
        ...data,
        amount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['accounts', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary', workspaceId] });
      onSuccess();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      api.delete(`/workspaces/${workspaceId}/transactions/${transaction!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['accounts', workspaceId] });
      onSuccess();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    },
  });

  const onSubmit = (data: TransactionFormData) => {
    setError(null);
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (confirm('Supprimer cette transaction ?')) {
      deleteMutation.mutate();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-auto animate-slide-up sm:animate-scale-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">
              {isEditing ? 'Modifier' : 'Nouvelle transaction'}
            </h2>
            {isEditing && !isTransfer && (
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="text-danger-600 hover:text-danger-700"
              >
                Supprimer
              </button>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm mb-4">
              {error}
            </div>
          )}

          {isTransfer ? (
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Les virements ne peuvent pas être modifiés directement.
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Type Toggle */}
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setValue('type', 'expense')}
                  className={clsx(
                    'flex-1 py-3 font-medium transition-colors',
                    selectedType === 'expense'
                      ? 'bg-danger-500 text-white'
                      : 'bg-white dark:bg-gray-800'
                  )}
                >
                  Dépense
                </button>
                <button
                  type="button"
                  onClick={() => setValue('type', 'income')}
                  className={clsx(
                    'flex-1 py-3 font-medium transition-colors',
                    selectedType === 'income'
                      ? 'bg-success-500 text-white'
                      : 'bg-white dark:bg-gray-800'
                  )}
                >
                  Revenu
                </button>
              </div>

              {/* Amount and Currency */}
              <div>
                <label htmlFor="amount" className="label">Montant</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      className="input text-2xl font-bold text-center"
                      placeholder="0.00"
                      {...register('amount', {
                        required: 'Montant requis',
                        valueAsNumber: true,
                        min: { value: 0.01, message: 'Montant invalide' },
                      })}
                    />
                  </div>
                  <CurrencySelector
                    value={selectedCurrency}
                    onChange={(code) => setValue('currency', code)}
                    className="w-32"
                    showSymbol={false}
                  />
                </div>
                {errors.amount && (
                  <p className="error-text">{errors.amount.message}</p>
                )}
                {selectedAccount && selectedCurrency !== selectedAccount.currency && (
                  <p className="text-xs text-warning-600 mt-1">
                    Le compte utilise {selectedAccount.currency}, le montant sera converti
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="label">Description</label>
                <input
                  id="description"
                  type="text"
                  className="input"
                  placeholder="Ex: Courses supermarché"
                  {...register('description', { required: 'Description requise' })}
                />
                {errors.description && (
                  <p className="error-text">{errors.description.message}</p>
                )}
              </div>

              {/* Account */}
              <div>
                <label htmlFor="accountId" className="label">Compte</label>
                <select
                  id="accountId"
                  className="input"
                  {...register('accountId', { required: 'Compte requis' })}
                  onChange={(e) => {
                    const accountId = e.target.value;
                    setValue('accountId', accountId);
                    const account = accounts?.find((a) => a.id === accountId);
                    if (account) {
                      setValue('currency', account.currency);
                    }
                  }}
                >
                  <option value="">Selectionner un compte</option>
                  {accounts?.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </option>
                  ))}
                </select>
                {errors.accountId && (
                  <p className="error-text">{errors.accountId.message}</p>
                )}
              </div>

              {/* Date */}
              <div>
                <label htmlFor="date" className="label">Date</label>
                <input
                  id="date"
                  type="date"
                  className="input"
                  {...register('date', { required: 'Date requise' })}
                />
              </div>

              {/* Category */}
              <CategorySelector
                workspaceId={workspaceId}
                type={selectedType}
                value={selectedCategoryId ?? ''}
                onChange={(id) => setValue('categoryId', id ?? '')}
              />

              {/* Tags */}
              <TagInput
                workspaceId={workspaceId}
                value={selectedTags}
                onChange={setSelectedTags}
              />

              {/* Documents */}
              {isEditing && transaction && (
                <DocumentAttachment
                  workspaceId={workspaceId}
                  transactionId={transaction.id}
                />
              )}

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="label">Notes (optionnel)</label>
                <textarea
                  id="notes"
                  className="input"
                  rows={2}
                  placeholder="Notes additionnelles..."
                  {...register('notes')}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={onClose} className="btn-secondary flex-1">
                  Annuler
                </button>
                <button type="submit" disabled={isPending} className="btn-primary flex-1">
                  {isPending ? 'Enregistrement...' : isEditing ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default TransactionForm;
