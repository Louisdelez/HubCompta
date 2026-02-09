// ============================================================================
// LOAN PAYMENT MODAL - Finance Hub
// Add payment to a loan
// Uses Catppuccin colors
// ============================================================================

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Calculator } from 'lucide-react';
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
}

interface LoanPaymentModalProps {
  workspaceId: string;
  loan: Loan;
  onClose: () => void;
  onSave: () => void;
}

interface PaymentFormData {
  amount: string;
  principal: string;
  interest: string;
  date: string;
  notes: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount);
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function LoanPaymentModal({
  workspaceId,
  loan,
  onClose,
  onSave,
}: LoanPaymentModalProps) {
  const queryClient = useQueryClient();
  const isDebt = loan.type === 'debt';

  const [formData, setFormData] = useState<PaymentFormData>({
    amount: '',
    principal: '',
    interest: '',
    date: new Date().toISOString().split('T')[0] ?? '',
    notes: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof PaymentFormData, string>>>({});
  const [autoCalc, setAutoCalc] = useState<'principal' | 'interest'>('interest');

  const mutation = useMutation({
    mutationFn: (data: unknown) =>
      api.post(`/workspaces/${workspaceId}/loans/${loan.id}/payments`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['loans', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['loan', workspaceId, loan.id] });
      onSave();
    },
  });

  // Auto-calculate the missing value
  useEffect(() => {
    const amount = parseFloat(formData.amount) || 0;
    const principal = parseFloat(formData.principal) || 0;
    const interest = parseFloat(formData.interest) || 0;

    if (autoCalc === 'interest' && formData.amount && formData.principal) {
      const calculatedInterest = Math.max(0, amount - principal);
      setFormData((prev) => ({
        ...prev,
        interest: calculatedInterest.toFixed(2),
      }));
    } else if (autoCalc === 'principal' && formData.amount && formData.interest) {
      const calculatedPrincipal = Math.max(0, amount - interest);
      setFormData((prev) => ({
        ...prev,
        principal: calculatedPrincipal.toFixed(2),
      }));
    }
  }, [formData.amount, formData.principal, formData.interest, autoCalc]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof PaymentFormData, string>> = {};

    const amount = parseFloat(formData.amount);
    const principal = parseFloat(formData.principal);
    const interest = parseFloat(formData.interest);

    if (!formData.amount || amount <= 0) {
      newErrors.amount = 'Le montant doit etre positif';
    }

    if (formData.principal === '' || principal < 0) {
      newErrors.principal = 'Le capital doit etre positif ou nul';
    }

    if (formData.interest === '' || interest < 0) {
      newErrors.interest = 'Les interets doivent etre positifs ou nuls';
    }

    if (!isNaN(amount) && !isNaN(principal) && !isNaN(interest)) {
      if (Math.abs(principal + interest - amount) > 0.01) {
        newErrors.amount = 'Capital + Interets doit etre egal au montant total';
      }
    }

    if (principal > loan.currentBalance) {
      newErrors.principal = `Le capital ne peut pas depasser le solde restant (${formatCurrency(loan.currentBalance, loan.currency)})`;
    }

    if (!formData.date) {
      newErrors.date = 'La date est requise';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const payload = {
      amount: parseFloat(formData.amount),
      principal: parseFloat(formData.principal),
      interest: parseFloat(formData.interest),
      date: new Date(formData.date),
      notes: formData.notes.trim() || null,
    };

    mutation.mutate(payload);
  };

  const handleChange = (field: keyof PaymentFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Quick fill with full balance
  const handleFillBalance = () => {
    setFormData((prev) => ({
      ...prev,
      amount: loan.currentBalance.toFixed(2),
      principal: loan.currentBalance.toFixed(2),
      interest: '0.00',
    }));
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
      <div className="relative bg-ctp-base rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ctp-surface0">
          <div>
            <h2 className="text-xl font-bold text-ctp-text">
              Ajouter un paiement
            </h2>
            <p className="text-sm text-ctp-subtext0">{loan.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-ctp-surface0 transition-colors"
          >
            <X className="w-5 h-5 text-ctp-subtext0" />
          </button>
        </div>

        {/* Balance info */}
        <div className="p-4 bg-ctp-surface0">
          <div className="flex justify-between items-center">
            <span className="text-sm text-ctp-subtext0">Solde restant</span>
            <span className={clsx('text-lg font-bold', isDebt ? 'text-ctp-red' : 'text-ctp-green')}>
              {formatCurrency(loan.currentBalance, loan.currency)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleFillBalance}
            className="mt-2 text-xs text-ctp-blue hover:underline"
          >
            Rembourser la totalite
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-ctp-text mb-1">
              Date du paiement *
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              className={clsx(
                'input w-full',
                errors.date && 'border-ctp-red focus:ring-ctp-red'
              )}
            />
            {errors.date && (
              <p className="text-xs text-ctp-red mt-1">{errors.date}</p>
            )}
          </div>

          {/* Total Amount */}
          <div>
            <label className="block text-sm font-medium text-ctp-text mb-1">
              Montant total *
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                placeholder="500.00"
                className={clsx(
                  'input w-full pr-12',
                  errors.amount && 'border-ctp-red focus:ring-ctp-red'
                )}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ctp-subtext0">
                {loan.currency}
              </span>
            </div>
            {errors.amount && (
              <p className="text-xs text-ctp-red mt-1">{errors.amount}</p>
            )}
          </div>

          {/* Auto-calculate toggle */}
          <div className="flex items-center gap-2 p-2 bg-ctp-surface0 rounded-lg">
            <Calculator className="w-4 h-4 text-ctp-blue" />
            <span className="text-xs text-ctp-subtext0">Calculer automatiquement:</span>
            <button
              type="button"
              onClick={() => setAutoCalc('interest')}
              className={clsx(
                'text-xs px-2 py-1 rounded',
                autoCalc === 'interest'
                  ? 'bg-ctp-blue text-ctp-base'
                  : 'text-ctp-subtext0 hover:text-ctp-text'
              )}
            >
              Interets
            </button>
            <button
              type="button"
              onClick={() => setAutoCalc('principal')}
              className={clsx(
                'text-xs px-2 py-1 rounded',
                autoCalc === 'principal'
                  ? 'bg-ctp-blue text-ctp-base'
                  : 'text-ctp-subtext0 hover:text-ctp-text'
              )}
            >
              Capital
            </button>
          </div>

          {/* Principal and Interest */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ctp-text mb-1">
                Capital *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.principal}
                onChange={(e) => handleChange('principal', e.target.value)}
                disabled={autoCalc === 'principal'}
                placeholder="450.00"
                className={clsx(
                  'input w-full',
                  errors.principal && 'border-ctp-red focus:ring-ctp-red',
                  autoCalc === 'principal' && 'bg-ctp-surface0'
                )}
              />
              {errors.principal && (
                <p className="text-xs text-ctp-red mt-1">{errors.principal}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-ctp-text mb-1">
                Interets *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.interest}
                onChange={(e) => handleChange('interest', e.target.value)}
                disabled={autoCalc === 'interest'}
                placeholder="50.00"
                className={clsx(
                  'input w-full',
                  errors.interest && 'border-ctp-red focus:ring-ctp-red',
                  autoCalc === 'interest' && 'bg-ctp-surface0'
                )}
              />
              {errors.interest && (
                <p className="text-xs text-ctp-red mt-1">{errors.interest}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-ctp-text mb-1">
              Notes
            </label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Ex: Mensualite janvier..."
              className="input w-full"
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
              className={clsx(
                'btn-primary',
                isDebt
                  ? 'bg-ctp-red hover:bg-ctp-red/90'
                  : 'bg-ctp-green hover:bg-ctp-green/90'
              )}
            >
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoanPaymentModal;
