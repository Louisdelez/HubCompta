// ============================================================================
// TRANSACTION FORM - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { Sparkles, Zap, Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import { CategorySelector } from './CategorySelector';
import { TagInput } from './TagInput';
import { DocumentAttachment } from './DocumentAttachment';
import { CurrencySelector } from '@/features/currency';
import { CategoryConfidence } from '@/features/rules/CategoryConfidence';
import { useFocusTrap } from '@/lib/a11y';

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

interface CategorySuggestionItem {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string | null;
  categoryColor?: string | null;
  confidence: number;
  pattern: string;
  source: 'pattern' | 'rule' | 'similar';
}

interface AIPrediction {
  categoryId: string;
  categoryName: string;
  confidence: number;
  features: {
    merchant: string | null;
    amount: number;
    dayOfWeek: number;
    dayOfMonth: number;
    isWeekend: boolean;
    amountRange: string;
    isExpense: boolean;
    tokens: string[];
  };
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

  // State for category suggestions
  const [suggestions, setSuggestions] = useState<CategorySuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [appliedPattern, setAppliedPattern] = useState<string | null>(null);

  // State for AI prediction
  const [aiPrediction, setAiPrediction] = useState<AIPrediction | null>(null);
  const [showAiSuggestion, setShowAiSuggestion] = useState(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const descriptionValue = watch('description');
  const amountValue = watch('amount');

  // Get selected account for currency validation
  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId);

  // Fetch category suggestions when description changes
  const fetchSuggestions = useCallback(async () => {
    if (!descriptionValue || descriptionValue.length < 3 || isEditing) {
      setSuggestions([]);
      return;
    }

    try {
      const params = new URLSearchParams({ description: descriptionValue });
      if (amountValue) {
        params.append('amount', String(amountValue));
      }
      const result = await api.get<CategorySuggestionItem[]>(
        `/workspaces/${workspaceId}/rules/suggest?${params.toString()}`
      );
      setSuggestions(result);
    } catch {
      setSuggestions([]);
    }
  }, [descriptionValue, amountValue, workspaceId, isEditing]);

  // Debounce suggestion fetching
  useEffect(() => {
    const timer = setTimeout(() => void fetchSuggestions(), 300);
    return () => clearTimeout(timer);
  }, [fetchSuggestions]);

  // Learn pattern mutation
  const learnMutation = useMutation({
    mutationFn: (categoryId: string) =>
      api.post(`/workspaces/${workspaceId}/rules/learn`, {
        transactionId: transaction?.id,
        categoryId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patterns', workspaceId] });
    },
  });

  // AI Prediction mutation
  const predictMutation = useMutation({
    mutationFn: (data: { description: string; amount: number; date?: Date }) =>
      api.post<AIPrediction | null>(
        `/workspaces/${workspaceId}/categorization/predict`,
        data
      ),
    onSuccess: (prediction) => {
      if (prediction && prediction.confidence > 0.5) {
        setAiPrediction(prediction);
        setShowAiSuggestion(true);
      } else {
        setAiPrediction(null);
      }
    },
    onError: () => {
      setAiPrediction(null);
    },
  });

  // Debounced AI prediction call
  useEffect(() => {
    // Only trigger for new transactions when:
    // - description has at least 3 characters
    // - amount is defined
    // - no category is selected yet
    if (
      isEditing ||
      !descriptionValue ||
      descriptionValue.length < 3 ||
      !amountValue ||
      selectedCategoryId
    ) {
      setAiPrediction(null);
      return;
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounced call (500ms)
    debounceTimerRef.current = setTimeout(() => {
      predictMutation.mutate({
        description: descriptionValue,
        amount: amountValue,
      });
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptionValue, amountValue, selectedCategoryId, isEditing]);

  // Handle AI suggestion accept
  const handleAcceptAiSuggestion = () => {
    if (aiPrediction) {
      setValue('categoryId', aiPrediction.categoryId);
      setShowAiSuggestion(false);
      setAiPrediction(null);
      // Note: Feedback will be sent after transaction creation if needed
    }
  };

  // Handle AI suggestion reject
  const handleRejectAiSuggestion = () => {
    setShowAiSuggestion(false);
    setAiPrediction(null);
    // Note: Feedback will be sent after transaction creation if needed
  };

  // Apply suggestion handler
  const handleApplySuggestion = (suggestion: CategorySuggestionItem, learn: boolean = false) => {
    setValue('categoryId', suggestion.categoryId);
    setAppliedPattern(suggestion.pattern);
    setShowSuggestions(false);

    // If editing and learn is requested, learn the pattern
    if (isEditing && learn && transaction) {
      learnMutation.mutate(suggestion.categoryId);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      // Always send positive amount - the API handles sign based on type
      const amount = Math.abs(data.amount);
      const result = await api.post(`/workspaces/${workspaceId}/transactions`, {
        accountId: data.accountId,
        type: data.type,
        amount,
        currency: data.currency,
        description: data.description,
        date: data.date,
        categoryId: data.categoryId || null,
        notes: data.notes || null,
        tags: selectedTags,
      });
      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transactions', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['accounts', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary', workspaceId] });
      onSuccess();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: TransactionFormData) => {
      // Always send positive amount - the API handles sign based on type
      const amount = Math.abs(data.amount);
      return api.patch(`/workspaces/${workspaceId}/transactions/${transaction!.id}`, {
        ...data,
        amount,
        categoryId: data.categoryId || null,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transactions', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['accounts', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary', workspaceId] });
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
      void queryClient.invalidateQueries({ queryKey: ['transactions', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['accounts', workspaceId] });
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

  const modalTitle = isEditing ? 'Modifier la transaction' : 'Nouvelle transaction';

  // Focus trap for the modal
  const modalRef = useFocusTrap<HTMLDivElement>({
    isActive: true,
    onEscape: onClose,
    autoFocus: true,
    restoreFocus: true,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-ctp-mantle rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-auto animate-slide-up sm:animate-scale-in"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 id="transaction-modal-title" className="text-xl font-bold text-ctp-text">
              {modalTitle}
            </h2>
            <div className="flex items-center gap-2">
              {isEditing && !isTransfer && (
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  aria-disabled={deleteMutation.isPending}
                  aria-busy={deleteMutation.isPending}
                  className="text-ctp-red hover:text-ctp-red/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ctp-red rounded px-2 py-1"
                  aria-label="Supprimer la transaction"
                >
                  Supprimer
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {error && (
            <div
              className="p-3 rounded-lg bg-ctp-red/10 text-ctp-red text-sm mb-4"
              role="alert"
              aria-live="assertive"
            >
              {error}
            </div>
          )}

          {isTransfer ? (
            <p className="text-ctp-subtext0 mb-4">
              Les virements ne peuvent pas être modifiés directement.
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-label="Formulaire de transaction">
              {/* Type Toggle */}
              <fieldset>
                <legend className="sr-only">Type de transaction</legend>
                <div
                  className="flex rounded-lg overflow-hidden border border-ctp-surface1"
                  role="radiogroup"
                  aria-label="Type de transaction"
                >
                  <button
                    type="button"
                    onClick={() => setValue('type', 'expense')}
                    className={clsx(
                      'flex-1 py-3 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ctp-blue',
                      selectedType === 'expense'
                        ? 'bg-ctp-red text-ctp-base'
                        : 'bg-ctp-surface0 text-ctp-subtext0 hover:bg-ctp-surface1'
                    )}
                    role="radio"
                    aria-checked={selectedType === 'expense'}
                  >
                    Depense
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('type', 'income')}
                    className={clsx(
                      'flex-1 py-3 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ctp-blue',
                      selectedType === 'income'
                        ? 'bg-ctp-green text-ctp-base'
                        : 'bg-ctp-surface0 text-ctp-subtext0 hover:bg-ctp-surface1'
                    )}
                    role="radio"
                    aria-checked={selectedType === 'income'}
                  >
                    Revenu
                  </button>
                </div>
              </fieldset>

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
                      aria-invalid={!!errors.amount}
                      aria-describedby={errors.amount ? 'amount-error' : undefined}
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
                  <p id="amount-error" className="error-text" role="alert">{errors.amount.message}</p>
                )}
                {selectedAccount && selectedCurrency !== selectedAccount.currency && (
                  <p className="text-xs text-ctp-yellow mt-1">
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
                  aria-invalid={!!errors.description}
                  aria-describedby={errors.description ? 'description-error' : undefined}
                  {...register('description', { required: 'Description requise' })}
                />
                {errors.description && (
                  <p id="description-error" className="error-text" role="alert">{errors.description.message}</p>
                )}

                {/* AI Category Suggestion */}
                {!isEditing && aiPrediction && showAiSuggestion && aiPrediction.confidence > 0.5 && (
                  <div className="mt-2 flex items-center gap-2 p-2 bg-ctp-surface0 rounded-lg border border-ctp-blue/30">
                    {/* AI Icon */}
                    <div className="flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-ctp-blue" />
                    </div>

                    {/* Suggestion */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ctp-text truncate">
                          {aiPrediction.categoryName}
                        </span>
                        <span className={clsx(
                          'text-xs',
                          aiPrediction.confidence >= 0.8 ? 'text-ctp-green' :
                          aiPrediction.confidence >= 0.6 ? 'text-ctp-yellow' :
                          'text-ctp-peach'
                        )}>
                          {Math.round(aiPrediction.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-xs text-ctp-subtext0">
                        Suggestion IA
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1" role="group" aria-label="Actions pour la suggestion IA">
                      {/* Accept */}
                      <button
                        type="button"
                        onClick={handleAcceptAiSuggestion}
                        className="p-1.5 rounded-md bg-ctp-green/20 text-ctp-green hover:bg-ctp-green/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ctp-green"
                        aria-label={`Accepter la suggestion: ${aiPrediction.categoryName}`}
                        title="Accepter"
                      >
                        <Check className="w-4 h-4" aria-hidden="true" />
                      </button>

                      {/* Reject */}
                      <button
                        type="button"
                        onClick={handleRejectAiSuggestion}
                        className="p-1.5 rounded-md bg-ctp-red/20 text-ctp-red hover:bg-ctp-red/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ctp-red"
                        aria-label="Rejeter la suggestion IA"
                        title="Rejeter"
                      >
                        <ChevronDown className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Loading state for AI prediction */}
                {!isEditing && predictMutation.isPending && (
                  <div
                    className="mt-2 flex items-center gap-2 p-2 bg-ctp-surface0 rounded-lg border border-ctp-surface1"
                    role="status"
                    aria-live="polite"
                  >
                    <Sparkles className="w-4 h-4 text-ctp-blue animate-pulse" aria-hidden="true" />
                    <span className="text-sm text-ctp-subtext0">Analyse IA en cours...</span>
                  </div>
                )}
              </div>

              {/* Account */}
              <div>
                <label htmlFor="accountId" className="label">Compte</label>
                <select
                  id="accountId"
                  className="input"
                  aria-invalid={!!errors.accountId}
                  aria-describedby={errors.accountId ? 'account-error' : undefined}
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
                  <p id="account-error" className="error-text" role="alert">{errors.accountId.message}</p>
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
                onChange={(id) => {
                  setValue('categoryId', id ?? '');
                  setAppliedPattern(null);
                  // Clear AI suggestion when user manually selects a category
                  if (aiPrediction && id !== aiPrediction.categoryId) {
                    setAiPrediction(null);
                    setShowAiSuggestion(false);
                  }
                }}
              />

              {/* Category Suggestions */}
              {!isEditing && suggestions.length > 0 && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowSuggestions(!showSuggestions)}
                    className="flex items-center gap-2 text-sm text-ctp-mauve hover:text-ctp-mauve/80"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''} de categorie
                    </span>
                    {showSuggestions ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  {showSuggestions && (
                    <div className="space-y-2 p-3 rounded-lg bg-ctp-surface0 border border-ctp-surface1">
                      {suggestions.map((suggestion, idx) => (
                        <div
                          key={idx}
                          className={clsx(
                            'flex items-center gap-3 p-2 rounded-lg transition-colors',
                            selectedCategoryId === suggestion.categoryId
                              ? 'bg-ctp-mauve/20 border border-ctp-mauve/30'
                              : 'hover:bg-ctp-surface1'
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {suggestion.categoryIcon} {suggestion.categoryName}
                              </span>
                              <CategoryConfidence confidence={suggestion.confidence} size="sm" />
                            </div>
                            <p className="text-xs text-ctp-subtext0 truncate">
                              {suggestion.source === 'pattern' && 'Pattern: '}
                              {suggestion.source === 'rule' && 'Regle: '}
                              {suggestion.source === 'similar' && ''}
                              {suggestion.pattern}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleApplySuggestion(suggestion, false)}
                            className="btn-ghost p-1.5 text-ctp-green hover:bg-ctp-green/10"
                            title="Appliquer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Pattern Match Indicator */}
              {appliedPattern && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-ctp-green/10 border border-ctp-green/20 text-sm">
                  <Sparkles className="w-4 h-4 text-ctp-green" />
                  <span className="text-ctp-green">
                    Categorie suggeree appliquee
                  </span>
                  <span className="text-ctp-subtext0">({appliedPattern})</span>
                </div>
              )}

              {/* Apply and Learn for Editing */}
              {isEditing && transaction && !transaction.categoryId && selectedCategoryId && (
                <button
                  type="button"
                  onClick={() => learnMutation.mutate(selectedCategoryId)}
                  disabled={learnMutation.isPending}
                  className="flex items-center gap-2 p-2 rounded-lg bg-ctp-mauve/10 border border-ctp-mauve/20 text-sm text-ctp-mauve hover:bg-ctp-mauve/20 transition-colors w-full justify-center"
                >
                  <Zap className="w-4 h-4" />
                  {learnMutation.isPending ? 'Apprentissage...' : 'Apprendre ce pattern'}
                </button>
              )}

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
