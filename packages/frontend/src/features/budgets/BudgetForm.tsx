// ============================================================================
// BUDGET FORM - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Category {
  id: string;
  name: string;
  icon: string | null;
  type: string;
}

interface BudgetWithProgress {
  id: string;
  name: string;
  amount: number;
  period: 'monthly' | 'yearly';
  alertThreshold: number;
  startDate: string;
  endDate?: string;
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  };
}

interface BudgetFormProps {
  workspaceId: string;
  budget?: BudgetWithProgress | null;
  onClose: () => void;
  onSave: () => void;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function BudgetForm({ workspaceId, budget, onClose, onSave }: BudgetFormProps) {
  const isEditing = !!budget;

  const [categoryId, setCategoryId] = useState(budget?.category.id ?? '');
  const [name, setName] = useState(budget?.name ?? '');
  const [amount, setAmount] = useState(budget?.amount?.toString() ?? '');
  const [period, setPeriod] = useState<'monthly' | 'yearly'>(budget?.period ?? 'monthly');
  const [alertThreshold, setAlertThreshold] = useState(budget?.alertThreshold?.toString() ?? '80');
  const [startDate, setStartDate] = useState(
    budget?.startDate
      ? new Date(budget.startDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    budget?.endDate ? new Date(budget.endDate).toISOString().split('T')[0] : ''
  );
  const [error, setError] = useState<string | null>(null);

  // Fetch categories (only expense categories)
  const { data: categories } = useQuery({
    queryKey: ['categories', workspaceId, 'expense'],
    queryFn: () => api.get<Category[]>(`/workspaces/${workspaceId}/categories?flat=true&type=expense`),
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () => {
      const data = {
        categoryId,
        name,
        amount: parseFloat(amount),
        period,
        alertThreshold: parseInt(alertThreshold, 10),
        startDate,
        endDate: endDate || undefined,
      };

      if (isEditing) {
        return api.patch(`/workspaces/${workspaceId}/budgets/${budget.id}`, {
          name: data.name,
          amount: data.amount,
          alertThreshold: data.alertThreshold,
          endDate: data.endDate || null,
        });
      }
      return api.post(`/workspaces/${workspaceId}/budgets`, data);
    },
    onSuccess: onSave,
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    if (!categoryId && !isEditing) {
      setError('Sélectionnez une catégorie');
      return;
    }
    if (!name.trim()) {
      setError('Entrez un nom pour le budget');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError('Entrez un montant valide');
      return;
    }

    saveMutation.mutate();
  };

  // Auto-generate name from category if empty
  const handleCategoryChange = (newCategoryId: string) => {
    setCategoryId(newCategoryId);
    if (!name && categories) {
      const category = categories.find((c) => c.id === newCategoryId);
      if (category) {
        setName(`Budget ${category.name}`);
      }
    }
  };

  const modalTitle = isEditing ? 'Modifier le budget' : 'Nouveau budget';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-xl shadow-xl max-w-md w-full animate-scale-in">
        <form onSubmit={handleSubmit} className="p-6" aria-label="Formulaire de budget">
          <h2 id="budget-modal-title" className="text-xl font-bold mb-4">
            {modalTitle}
          </h2>

          {error && (
            <div className="p-3 rounded-lg bg-ctp-red/10 text-ctp-red text-sm mb-4" role="alert" aria-live="assertive">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Category */}
            {!isEditing && (
              <div>
                <label htmlFor="category" className="label">
                  Catégorie <span className="text-ctp-red">*</span>
                </label>
                <select
                  id="category"
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Sélectionner une catégorie</option>
                  {categories?.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Name */}
            <div>
              <label htmlFor="name" className="label">
                Nom du budget <span className="text-ctp-red">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Budget courses"
                className="input"
                required
              />
            </div>

            {/* Amount */}
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
                  placeholder="500.00"
                  className="input pr-10"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ctp-subtext0">
                  EUR
                </span>
              </div>
            </div>

            {/* Period */}
            {!isEditing && (
              <div>
                <label className="label">Période</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 flex-1 p-3 rounded-lg border border-ctp-surface1 cursor-pointer hover:bg-ctp-surface0">
                    <input
                      type="radio"
                      name="period"
                      value="monthly"
                      checked={period === 'monthly'}
                      onChange={() => setPeriod('monthly')}
                      className="text-ctp-blue"
                    />
                    <span>Mensuel</span>
                  </label>
                  <label className="flex items-center gap-2 flex-1 p-3 rounded-lg border border-ctp-surface1 cursor-pointer hover:bg-ctp-surface0">
                    <input
                      type="radio"
                      name="period"
                      value="yearly"
                      checked={period === 'yearly'}
                      onChange={() => setPeriod('yearly')}
                      className="text-ctp-blue"
                    />
                    <span>Annuel</span>
                  </label>
                </div>
              </div>
            )}

            {/* Alert Threshold */}
            <div>
              <label htmlFor="threshold" className="label">
                Seuil d'alerte
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="threshold"
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value)}
                  className="flex-1"
                />
                <span className="w-12 text-right font-medium">{alertThreshold}%</span>
              </div>
              <p className="text-xs text-ctp-subtext0 mt-1">
                Vous serez alerté lorsque ce pourcentage sera atteint
              </p>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              {!isEditing && (
                <div>
                  <label htmlFor="startDate" className="label">
                    Date de début
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input"
                  />
                </div>
              )}
              <div className={isEditing ? 'col-span-2' : ''}>
                <label htmlFor="endDate" className="label">
                  Date de fin (optionnel)
                </label>
                <input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input"
                />
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
              aria-disabled={saveMutation.isPending}
              aria-busy={saveMutation.isPending}
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

export default BudgetForm;
