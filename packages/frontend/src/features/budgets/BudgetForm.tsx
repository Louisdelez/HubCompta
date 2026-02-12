// ============================================================================
// BUDGET FORM - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  // Envelope mode fields
  envelopeMode?: boolean;
  rolloverEnabled?: boolean;
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
  const { t } = useTranslation();
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
  const [envelopeMode, setEnvelopeMode] = useState(budget?.envelopeMode ?? false);
  const [rolloverEnabled, setRolloverEnabled] = useState(budget?.rolloverEnabled ?? true);
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
        envelopeMode,
        rolloverEnabled,
      };

      if (isEditing) {
        return api.patch(`/workspaces/${workspaceId}/budgets/${budget.id}`, {
          name: data.name,
          amount: data.amount,
          alertThreshold: data.alertThreshold,
          endDate: data.endDate || null,
          envelopeMode: data.envelopeMode,
          rolloverEnabled: data.rolloverEnabled,
        });
      }
      return api.post(`/workspaces/${workspaceId}/budgets`, data);
    },
    onSuccess: onSave,
    onError: (err) => {
      setError(err instanceof Error ? err.message : t('budgets.savingError'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    if (!categoryId && !isEditing) {
      setError(t('budgets.selectCategory'));
      return;
    }
    if (!name.trim()) {
      setError(t('budgets.enterBudgetName'));
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError(t('budgets.enterValidAmount'));
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

  const modalTitle = isEditing ? t('budgets.editBudget') : t('budgets.newBudget');

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
                  {t('transactions.category')} <span className="text-ctp-red">*</span>
                </label>
                <select
                  id="category"
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">{t('budgets.selectCategory')}</option>
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
                {t('budgets.budgetName')} <span className="text-ctp-red">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('budgets.budgetNamePlaceholder')}
                className="input"
                required
              />
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="label">
                {t('budgets.budgetAmount')} <span className="text-ctp-red">*</span>
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
                <label className="label">{t('budgets.period')}</label>
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
                    <span>{t('budgets.monthly')}</span>
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
                    <span>{t('budgets.yearly')}</span>
                  </label>
                </div>
              </div>
            )}

            {/* Alert Threshold */}
            <div>
              <label htmlFor="threshold" className="label">
                {t('budgets.alertThreshold')}
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
                {t('budgets.alertThresholdDescription')}
              </p>
            </div>

            {/* Envelope Mode Section */}
            {period === 'monthly' && (
              <div className="space-y-3 p-4 rounded-lg bg-ctp-surface0 border border-ctp-surface1">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="envelopeMode" className="font-medium text-ctp-text cursor-pointer">
                      {t('budgets.envelopeMode')}
                    </label>
                    <p className="text-xs text-ctp-subtext0 mt-0.5">
                      {t('budgets.envelopeModeDescription')}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      id="envelopeMode"
                      type="checkbox"
                      checked={envelopeMode}
                      onChange={(e) => setEnvelopeMode(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-ctp-surface2 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ctp-mauve/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ctp-mauve"></div>
                  </label>
                </div>

                {envelopeMode && (
                  <div className="flex items-center justify-between pt-2 border-t border-ctp-surface1">
                    <div>
                      <label htmlFor="rolloverEnabled" className="font-medium text-ctp-text cursor-pointer">
                        {t('budgets.automaticRollover')}
                      </label>
                      <p className="text-xs text-ctp-subtext0 mt-0.5">
                        {t('budgets.automaticRolloverDescription')}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="rolloverEnabled"
                        type="checkbox"
                        checked={rolloverEnabled}
                        onChange={(e) => setRolloverEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-ctp-surface2 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ctp-green/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ctp-green"></div>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              {!isEditing && (
                <div>
                  <label htmlFor="startDate" className="label">
                    {t('budgets.startDate')}
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
                  {t('budgets.endDate')}
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
              {t('budgets.cancel')}
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              aria-disabled={saveMutation.isPending}
              aria-busy={saveMutation.isPending}
              className="btn-primary flex-1"
            >
              {saveMutation.isPending
                ? t('budgets.saving')
                : isEditing
                  ? t('budgets.save')
                  : t('budgets.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BudgetForm;
