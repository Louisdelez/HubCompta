// ============================================================================
// LOAN MODAL - Finance Hub
// Create/edit loan modal
// Uses Catppuccin colors
// ============================================================================

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Loan {
  id: string;
  name: string;
  type: 'debt' | 'credit';
  principalAmount: number;
  currentBalance: number;
  interestRate: number | null;
  currency: string;
  startDate: string;
  endDate?: string | null;
  counterparty?: string | null;
  notes?: string | null;
}

interface LoanModalProps {
  workspaceId: string;
  loan: Loan | null;
  defaultType?: 'debt' | 'credit';
  onClose: () => void;
  onSave: () => void;
}

interface LoanFormData {
  name: string;
  type: 'debt' | 'credit';
  principalAmount: string;
  interestRate: string;
  currency: string;
  startDate: string;
  endDate: string;
  counterparty: string;
  notes: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function LoanModal({
  workspaceId,
  loan,
  defaultType = 'debt',
  onClose,
  onSave,
}: LoanModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!loan;

  const getInitialStartDate = (): string => {
    if (loan?.startDate) {
      return new Date(loan.startDate).toISOString().split('T')[0] ?? '';
    }
    return new Date().toISOString().split('T')[0] ?? '';
  };

  const getInitialEndDate = (): string => {
    if (loan?.endDate) {
      return new Date(loan.endDate).toISOString().split('T')[0] ?? '';
    }
    return '';
  };

  const [formData, setFormData] = useState<LoanFormData>({
    name: loan?.name ?? '',
    type: loan?.type ?? defaultType,
    principalAmount: loan?.principalAmount?.toString() ?? '',
    interestRate: loan?.interestRate?.toString() ?? '',
    currency: loan?.currency ?? 'EUR',
    startDate: getInitialStartDate(),
    endDate: getInitialEndDate(),
    counterparty: loan?.counterparty ?? '',
    notes: loan?.notes ?? '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof LoanFormData, string>>>({});

  const createMutation = useMutation({
    mutationFn: (data: unknown) =>
      api.post(`/workspaces/${workspaceId}/loans`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['loans', workspaceId] });
      onSave();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: unknown) =>
      api.patch(`/workspaces/${workspaceId}/loans/${loan!.id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['loans', workspaceId] });
      onSave();
    },
  });

  const mutation = isEditing ? updateMutation : createMutation;

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof LoanFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }

    if (!formData.principalAmount || parseFloat(formData.principalAmount) <= 0) {
      newErrors.principalAmount = 'Le montant doit etre positif';
    }

    if (formData.interestRate) {
      const rate = parseFloat(formData.interestRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        newErrors.interestRate = 'Le taux doit etre entre 0 et 100';
      }
    }

    if (!formData.startDate) {
      newErrors.startDate = 'La date de debut est requise';
    }

    if (formData.endDate && formData.startDate && formData.endDate < formData.startDate) {
      newErrors.endDate = 'La date de fin doit etre apres la date de debut';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      principalAmount: parseFloat(formData.principalAmount),
      interestRate: formData.interestRate ? parseFloat(formData.interestRate) : null,
      currency: formData.currency,
      startDate: new Date(formData.startDate),
      endDate: formData.endDate ? new Date(formData.endDate) : null,
      counterparty: formData.counterparty.trim() || null,
      notes: formData.notes.trim() || null,
    };

    // For updates, only send allowed fields
    if (isEditing) {
      const updatePayload = {
        name: payload.name,
        interestRate: payload.interestRate,
        endDate: payload.endDate,
        counterparty: payload.counterparty,
        notes: payload.notes,
      };
      mutation.mutate(updatePayload);
    } else {
      mutation.mutate(payload);
    }
  };

  const handleChange = (field: keyof LoanFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ctp-crust/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-ctp-base rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ctp-surface0">
          <h2 className="text-xl font-bold text-ctp-text">
            {isEditing ? 'Modifier le pret' : 'Nouveau pret'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-ctp-surface0 transition-colors"
          >
            <X className="w-5 h-5 text-ctp-subtext0" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-ctp-text mb-2">
              Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => !isEditing && handleChange('type', 'debt')}
                disabled={isEditing}
                className={clsx(
                  'p-3 rounded-lg border-2 transition-all text-center',
                  formData.type === 'debt'
                    ? 'border-ctp-red bg-ctp-red/10 text-ctp-red'
                    : 'border-ctp-surface1 hover:border-ctp-surface2 text-ctp-subtext0',
                  isEditing && 'opacity-50 cursor-not-allowed'
                )}
              >
                <span className="font-medium">Dette</span>
                <p className="text-xs opacity-75">Je dois de l'argent</p>
              </button>
              <button
                type="button"
                onClick={() => !isEditing && handleChange('type', 'credit')}
                disabled={isEditing}
                className={clsx(
                  'p-3 rounded-lg border-2 transition-all text-center',
                  formData.type === 'credit'
                    ? 'border-ctp-green bg-ctp-green/10 text-ctp-green'
                    : 'border-ctp-surface1 hover:border-ctp-surface2 text-ctp-subtext0',
                  isEditing && 'opacity-50 cursor-not-allowed'
                )}
              >
                <span className="font-medium">Creance</span>
                <p className="text-xs opacity-75">On me doit de l'argent</p>
              </button>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-ctp-text mb-1">
              Nom *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Ex: Pret immobilier, Pret a Pierre..."
              className={clsx(
                'input w-full',
                errors.name && 'border-ctp-red focus:ring-ctp-red'
              )}
            />
            {errors.name && (
              <p className="text-xs text-ctp-red mt-1">{errors.name}</p>
            )}
          </div>

          {/* Principal Amount and Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-ctp-text mb-1">
                Montant initial *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.principalAmount}
                onChange={(e) => handleChange('principalAmount', e.target.value)}
                disabled={isEditing}
                placeholder="10000.00"
                className={clsx(
                  'input w-full',
                  errors.principalAmount && 'border-ctp-red focus:ring-ctp-red',
                  isEditing && 'opacity-50 cursor-not-allowed'
                )}
              />
              {errors.principalAmount && (
                <p className="text-xs text-ctp-red mt-1">{errors.principalAmount}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-ctp-text mb-1">
                Devise
              </label>
              <select
                value={formData.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                disabled={isEditing}
                className={clsx(
                  'input w-full',
                  isEditing && 'opacity-50 cursor-not-allowed'
                )}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
          </div>

          {/* Interest Rate */}
          <div>
            <label className="block text-sm font-medium text-ctp-text mb-1">
              Taux d'interet (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formData.interestRate}
              onChange={(e) => handleChange('interestRate', e.target.value)}
              placeholder="3.50"
              className={clsx(
                'input w-full',
                errors.interestRate && 'border-ctp-red focus:ring-ctp-red'
              )}
            />
            {errors.interestRate && (
              <p className="text-xs text-ctp-red mt-1">{errors.interestRate}</p>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ctp-text mb-1">
                Date de debut *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
                disabled={isEditing}
                className={clsx(
                  'input w-full',
                  errors.startDate && 'border-ctp-red focus:ring-ctp-red',
                  isEditing && 'opacity-50 cursor-not-allowed'
                )}
              />
              {errors.startDate && (
                <p className="text-xs text-ctp-red mt-1">{errors.startDate}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-ctp-text mb-1">
                Date de fin
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => handleChange('endDate', e.target.value)}
                className={clsx(
                  'input w-full',
                  errors.endDate && 'border-ctp-red focus:ring-ctp-red'
                )}
              />
              {errors.endDate && (
                <p className="text-xs text-ctp-red mt-1">{errors.endDate}</p>
              )}
            </div>
          </div>

          {/* Counterparty */}
          <div>
            <label className="block text-sm font-medium text-ctp-text mb-1">
              {formData.type === 'debt' ? 'Creancier' : 'Debiteur'}
            </label>
            <input
              type="text"
              value={formData.counterparty}
              onChange={(e) => handleChange('counterparty', e.target.value)}
              placeholder="Ex: Banque, Pierre Dupont..."
              className="input w-full"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-ctp-text mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Notes additionnelles..."
              rows={3}
              className="input w-full resize-none"
            />
          </div>

          {/* Error message */}
          {mutation.isError && (
            <div className="p-3 bg-ctp-red/20 border border-ctp-red rounded-lg text-sm text-ctp-red">
              Une erreur est survenue. Veuillez reessayer.
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-ctp-surface0">
            <button type="button" onClick={onClose} className="btn-ghost">
              Annuler
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary"
            >
              {mutation.isPending
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

export default LoanModal;
