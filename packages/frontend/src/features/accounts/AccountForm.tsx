// ============================================================================
// ACCOUNT FORM - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Landmark, PiggyBank, Banknote, CreditCard, FileText, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { CurrencySelector } from '@/features/currency';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface AccountFormData {
  name: string;
  type: 'checking' | 'savings' | 'cash' | 'credit_card' | 'loan' | 'investment';
  currency: string;
  initialBalance: number;
  icon?: string;
  color?: string;
}

interface Account {
  id: string;
  name: string;
  type: AccountFormData['type'];
  currency: string;
  icon?: string;
  color?: string;
}

interface AccountFormProps {
  workspaceId: string;
  account?: Account | undefined;
  onClose: () => void;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

// Account types are defined with i18n keys
const ACCOUNT_TYPE_KEYS = [
  { value: 'checking', labelKey: 'accounts.checking', icon: Landmark },
  { value: 'savings', labelKey: 'accounts.savings', icon: PiggyBank },
  { value: 'cash', labelKey: 'accounts.cash', icon: Banknote },
  { value: 'credit_card', labelKey: 'accounts.creditCard', icon: CreditCard },
  { value: 'loan', labelKey: 'accounts.loan', icon: FileText },
  { value: 'investment', labelKey: 'accounts.investment', icon: TrendingUp },
] as const;

// Catppuccin Mocha colors for account customization
const COLORS = [
  '#f38ba8', // red
  '#fab387', // peach
  '#f9e2af', // yellow
  '#a6e3a1', // green
  '#94e2d5', // teal
  '#89dceb', // sky
  '#74c7ec', // sapphire
  '#89b4fa', // blue
  '#b4befe', // lavender
  '#cba6f7', // mauve
  '#f5c2e7', // pink
  '#eba0ac', // maroon
  '#cdd6f4', // text
  '#bac2de', // subtext1
  '#a6adc8', // subtext0
  '#9399b2', // overlay2
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AccountForm({ workspaceId, account, onClose }: AccountFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!account;

  const defaultValues: AccountFormData = {
    name: account?.name ?? '',
    type: account?.type ?? 'checking',
    currency: account?.currency ?? 'EUR',
    initialBalance: 0,
  };
  // Handle optional properties explicitly to satisfy exactOptionalPropertyTypes
  if (account?.icon !== undefined) {
    defaultValues.icon = account.icon;
  }
  if (account?.color !== undefined) {
    defaultValues.color = account.color;
  } else {
    defaultValues.color = COLORS[0] as string;
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AccountFormData>({
    defaultValues,
  });

  const selectedType = watch('type');
  const selectedColor = watch('color');

  const createMutation = useMutation({
    mutationFn: (data: AccountFormData) =>
      api.post(`/workspaces/${workspaceId}/accounts`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['accounts', workspaceId] });
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t('accounts.creationError'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<AccountFormData>) =>
      api.patch(`/workspaces/${workspaceId}/accounts/${account!.id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['accounts', workspaceId] });
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t('accounts.updateError'));
    },
  });

  const onSubmit = (data: AccountFormData) => {
    setError(null);
    if (isEditing) {
      const updateData: Partial<AccountFormData> = { name: data.name };
      if (data.icon !== undefined) {
        updateData.icon = data.icon;
      }
      if (data.color !== undefined) {
        updateData.color = data.color;
      }
      updateMutation.mutate(updateData);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const modalTitle = isEditing ? t('accounts.editAccount') : t('accounts.newAccount');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-auto animate-scale-in">
        <div className="p-6">
          <h2 id="account-modal-title" className="text-xl font-bold mb-4 text-ctp-text">
            {modalTitle}
          </h2>

          {error && (
            <div
              className="p-3 rounded-lg bg-ctp-red/10 text-ctp-red text-sm mb-4"
              role="alert"
              aria-live="assertive"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-label={t('accounts.accountDetails')}>
            {/* Account Type (only for creation) */}
            {!isEditing && (
              <fieldset>
                <legend className="label">{t('accounts.accountType')}</legend>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('accounts.accountType')}>
                  {ACCOUNT_TYPE_KEYS.map((type) => (
                    <label
                      key={type.value}
                      className={clsx(
                        'flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-ctp-blue focus-within:ring-offset-2',
                        selectedType === type.value
                          ? 'border-ctp-blue bg-ctp-blue/10'
                          : 'border-ctp-surface1 hover:border-ctp-surface2'
                      )}
                    >
                      <input
                        type="radio"
                        value={type.value}
                        {...register('type')}
                        className="sr-only"
                        aria-label={t(type.labelKey)}
                      />
                      <type.icon className="w-5 h-5" aria-hidden="true" />
                      <span className="text-xs mt-1 text-center">{t(type.labelKey)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {/* Name */}
            <div>
              <label htmlFor="name" className="label">{t('accounts.name')}</label>
              <input
                id="name"
                type="text"
                className="input"
                placeholder={t('accounts.myAccount')}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
                aria-required="true"
                {...register('name', { required: t('accounts.nameRequired') })}
              />
              {errors.name && (
                <p id="name-error" className="error-text" role="alert">{errors.name.message}</p>
              )}
            </div>

            {/* Currency (only for creation) */}
            {!isEditing && (
              <div>
                <label htmlFor="currency" className="label">{t('accounts.currency')}</label>
                <CurrencySelector
                  value={watch('currency')}
                  onChange={(code) => setValue('currency', code)}
                />
              </div>
            )}

            {/* Initial Balance (only for creation) */}
            {!isEditing && (
              <div>
                <label htmlFor="initialBalance" className="label">{t('accounts.initialBalance')}</label>
                <input
                  id="initialBalance"
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder="0.00"
                  {...register('initialBalance', { valueAsNumber: true })}
                />
              </div>
            )}

            {/* Color */}
            <fieldset>
              <legend className="label">{t('accounts.color')}</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('accounts.color')}>
                {COLORS.map((color, index) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setValue('color', color)}
                    className={clsx(
                      'w-8 h-8 rounded-full transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue focus-visible:ring-offset-2',
                      selectedColor === color && 'ring-2 ring-offset-2 ring-ctp-blue scale-110'
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={t('accounts.colorNumber', { number: index + 1 })}
                    aria-pressed={selectedColor === color}
                    role="radio"
                    aria-checked={selectedColor === color}
                  />
                ))}
              </div>
            </fieldset>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                {t('accounts.cancel')}
              </button>
              <button
                type="submit"
                disabled={isPending}
                aria-disabled={isPending}
                aria-busy={isPending}
                className="btn-primary flex-1"
              >
                {isPending ? (
                  <>
                    <span aria-hidden="true">{t('accounts.saving')}</span>
                    <span className="sr-only">{t('accounts.savingInProgress')}</span>
                  </>
                ) : isEditing ? t('accounts.save') : t('accounts.create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AccountForm;
