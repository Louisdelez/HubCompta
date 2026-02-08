// ============================================================================
// CREATE WORKSPACE MODAL - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
    label: 'Personnel',
    icon: '👤',
    description: 'Pour gérer vos finances personnelles',
  },
  {
    value: 'family',
    label: 'Famille',
    icon: '👨‍👩‍👧‍👦',
    description: 'Partagez avec votre famille (max 10 membres)',
  },
  {
    value: 'flatshare',
    label: 'Colocation',
    icon: '🏠',
    description: 'Gérez les dépenses communes (max 20 membres)',
  },
  {
    value: 'company',
    label: 'Entreprise',
    icon: '🏢',
    description: 'Pour les auto-entrepreneurs et TPE (max 50 membres)',
  },
] as const;

const CURRENCIES = [
  { value: 'EUR', label: '€ Euro' },
  { value: 'USD', label: '$ Dollar US' },
  { value: 'GBP', label: '£ Livre Sterling' },
  { value: 'CHF', label: 'CHF Franc Suisse' },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function CreateWorkspaceModal({
  isOpen,
  onClose,
  onCreated,
}: CreateWorkspaceModalProps) {
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
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      reset();
      onCreated?.(data.id);
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
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
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto animate-scale-in">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Créer un espace de travail</h2>

          {error && (
            <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Workspace Type */}
            <div>
              <label className="label">Type d'espace</label>
              <div className="grid grid-cols-2 gap-3">
                {WORKSPACE_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={clsx(
                      'flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-colors',
                      selectedType === type.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    <input
                      type="radio"
                      value={type.value}
                      {...register('type')}
                      className="sr-only"
                    />
                    <span className="text-2xl mb-1">{type.icon}</span>
                    <span className="font-medium text-sm">{type.label}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                      {type.description}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label htmlFor="name" className="label">
                Nom de l'espace
              </label>
              <input
                id="name"
                type="text"
                className="input"
                placeholder="Mon espace"
                {...register('name', {
                  required: 'Nom requis',
                  minLength: { value: 1, message: 'Nom trop court' },
                  maxLength: { value: 100, message: 'Nom trop long' },
                })}
              />
              {errors.name && (
                <p className="error-text">{errors.name.message}</p>
              )}
            </div>

            {/* Currency */}
            <div>
              <label htmlFor="currency" className="label">
                Devise
              </label>
              <select
                id="currency"
                className="input"
                {...register('currency')}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
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
                Annuler
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="btn-primary flex-1"
              >
                {createMutation.isPending ? 'Création...' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateWorkspaceModal;
