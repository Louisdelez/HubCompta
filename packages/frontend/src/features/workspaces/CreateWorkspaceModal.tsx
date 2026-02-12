// ============================================================================
// CREATE WORKSPACE MODAL - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Users, Home, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface CreateWorkspaceData {
  name: string;
  type: 'personal' | 'family' | 'flatshare' | 'company';
  currency: string;
}

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (workspaceId: string) => void;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const WORKSPACE_TYPES = [
  {
    value: 'personal',
    labelKey: 'workspaces.types.personal',
    icon: User,
    descriptionKey: 'workspaces.typeDescriptions.personal',
  },
  {
    value: 'family',
    labelKey: 'workspaces.types.family',
    icon: Users,
    descriptionKey: 'workspaces.typeDescriptions.family',
  },
  {
    value: 'flatshare',
    labelKey: 'workspaces.types.flatshare',
    icon: Home,
    descriptionKey: 'workspaces.typeDescriptions.flatshare',
  },
  {
    value: 'company',
    labelKey: 'workspaces.types.company',
    icon: Building2,
    descriptionKey: 'workspaces.typeDescriptions.company',
  },
] as const;

const CURRENCIES = [
  { value: 'EUR', labelKey: 'workspaces.currencies.eur' },
  { value: 'USD', labelKey: 'workspaces.currencies.usd' },
  { value: 'GBP', labelKey: 'workspaces.currencies.gbp' },
  { value: 'CHF', labelKey: 'workspaces.currencies.chf' },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function CreateWorkspaceModal({
  isOpen,
  onClose,
  onCreated,
}: CreateWorkspaceModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateWorkspaceData>({
    defaultValues: {
      type: 'personal',
      currency: 'EUR',
    },
  });

  const selectedType = watch('type');

  const createMutation = useMutation({
    mutationFn: (data: CreateWorkspaceData) =>
      api.post<{ id: string }>('/workspaces', data),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      reset();
      onCreated?.(data.id);
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t('workspaces.creationError'));
    },
  });

  const onSubmit = (data: CreateWorkspaceData) => {
    setError(null);
    createMutation.mutate(data);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto animate-scale-in">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">{t('workspaces.createWorkspaceTitle')}</h2>

          {error && (
            <div className="p-3 rounded-lg bg-ctp-red/10 text-ctp-red text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(onSubmit)(e); }} className="space-y-6">
            {/* Workspace Type */}
            <div>
              <label className="label">{t('workspaces.workspaceType')}</label>
              <div className="grid grid-cols-2 gap-3">
                {WORKSPACE_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={clsx(
                      'flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-colors',
                      selectedType === type.value
                        ? type.value === 'personal'
                          ? 'border-ctp-blue bg-ctp-blue/20'
                          : 'border-ctp-mauve bg-ctp-mauve/20'
                        : 'border-ctp-surface1 hover:border-ctp-surface2'
                    )}
                  >
                    <input
                      type="radio"
                      value={type.value}
                      {...register('type')}
                      className="sr-only"
                    />
                    <type.icon className={clsx(
                      'w-6 h-6 mb-1',
                      selectedType === type.value
                        ? type.value === 'personal'
                          ? 'text-ctp-blue'
                          : 'text-ctp-mauve'
                        : 'text-ctp-subtext0'
                    )} />
                    <span className="font-medium text-sm">{t(type.labelKey)}</span>
                    <span className="text-xs text-ctp-subtext0 text-center mt-1">
                      {t(type.descriptionKey)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label htmlFor="name" className="label">
                {t('workspaces.workspaceName')}
              </label>
              <input
                id="name"
                type="text"
                className="input"
                placeholder={t('workspaces.namePlaceholder')}
                {...register('name', {
                  required: t('workspaces.nameRequired'),
                  minLength: { value: 1, message: t('workspaces.nameTooShort') },
                  maxLength: { value: 100, message: t('workspaces.nameTooLong') },
                })}
              />
              {errors.name && (
                <p className="error-text">{errors.name.message}</p>
              )}
            </div>

            {/* Currency */}
            <div>
              <label htmlFor="currency" className="label">
                {t('workspaces.currency')}
              </label>
              <select
                id="currency"
                className="input"
                {...register('currency')}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {t(c.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
              >
                {t('workspaces.cancel')}
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="btn-primary flex-1"
              >
                {createMutation.isPending ? t('workspaces.creating') : t('workspaces.create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateWorkspaceModal;
