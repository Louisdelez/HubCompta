// ============================================================================
// BILL MODAL - Finance Hub
// Create/edit bill modal
// ============================================================================

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, Calendar, RefreshCw, Bell } from 'lucide-react';
import { api } from '@/lib/api/client';
import type { Bill } from './BillsPage';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface BillModalProps {
  workspaceId: string;
  bill: Bill | null;
  onClose: () => void;
  onSave: () => void;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: 'expense' | 'income';
}

interface FormData {
  name: string;
  vendor: string;
  amount: string;
  currency: string;
  dueDate: string;
  frequency: 'once' | 'weekly' | 'monthly' | 'yearly';
  categoryId: string;
  reminderDays: string;
  notes: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function BillModal({ workspaceId, bill, onClose, onSave }: BillModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!bill;

  const [formData, setFormData] = useState<FormData>({
    name: '',
    vendor: '',
    amount: '',
    currency: 'EUR',
    dueDate: new Date().toISOString().split('T')[0] ?? '',
    frequency: 'monthly',
    categoryId: '',
    reminderDays: '3',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load bill data when editing
  useEffect(() => {
    if (bill) {
      setFormData({
        name: bill.name,
        vendor: bill.vendor ?? '',
        amount: bill.amount.toString(),
        currency: bill.currency,
        dueDate: bill.dueDate.split('T')[0] ?? '',
        frequency: bill.frequency,
        categoryId: bill.categoryId ?? '',
        reminderDays: bill.reminderDays.toString(),
        notes: bill.notes ?? '',
      });
    }
  }, [bill]);

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories', workspaceId],
    queryFn: () => api.get<Category[]>(`/workspaces/${workspaceId}/categories`),
    enabled: !!workspaceId,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post(`/workspaces/${workspaceId}/bills`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bills', workspaceId] });
      onSave();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.patch(`/workspaces/${workspaceId}/bills/${bill?.id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bills', workspaceId] });
      onSave();
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      newErrors.amount = 'Montant invalide';
    }

    if (!formData.dueDate) {
      newErrors.dueDate = "La date d'echeance est requise";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const data = {
      name: formData.name,
      vendor: formData.vendor || undefined,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      dueDate: formData.dueDate,
      frequency: formData.frequency,
      categoryId: formData.categoryId || undefined,
      reminderDays: parseInt(formData.reminderDays),
      notes: formData.notes || undefined,
    };

    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // Filter categories to show only expense categories
  const expenseCategories = categories?.filter((c) => c.type === 'expense') ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-ctp-base rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-ctp-base border-b border-ctp-surface1 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {isEdit ? 'Modifier la facture' : 'Nouvelle facture'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-ctp-surface1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Nom de la facture *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ex: Loyer, Electricite..."
              className={`input w-full ${errors.name ? 'border-ctp-red' : ''}`}
            />
            {errors.name && (
              <p className="text-sm text-ctp-red mt-1">{errors.name}</p>
            )}
          </div>

          {/* Vendor */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Fournisseur
            </label>
            <input
              type="text"
              name="vendor"
              value={formData.vendor}
              onChange={handleChange}
              placeholder="Ex: EDF, Propriétaire..."
              className="input w-full"
            />
          </div>

          {/* Amount and Currency */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Montant *</label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                step="0.01"
                min="0"
                placeholder="0.00"
                className={`input w-full ${errors.amount ? 'border-ctp-red' : ''}`}
              />
              {errors.amount && (
                <p className="text-sm text-ctp-red mt-1">{errors.amount}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Devise</label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="input w-full"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date d'echeance *
            </label>
            <input
              type="date"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleChange}
              className={`input w-full ${errors.dueDate ? 'border-ctp-red' : ''}`}
            />
            {errors.dueDate && (
              <p className="text-sm text-ctp-red mt-1">{errors.dueDate}</p>
            )}
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Frequence
            </label>
            <select
              name="frequency"
              value={formData.frequency}
              onChange={handleChange}
              className="input w-full"
            >
              <option value="once">Unique (une seule fois)</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="monthly">Mensuel</option>
              <option value="yearly">Annuel</option>
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-1">Categorie</label>
            <select
              name="categoryId"
              value={formData.categoryId}
              onChange={handleChange}
              className="input w-full"
            >
              <option value="">-- Aucune categorie --</option>
              {expenseCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reminder Days */}
          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Rappel (jours avant echeance)
            </label>
            <select
              name="reminderDays"
              value={formData.reminderDays}
              onChange={handleChange}
              className="input w-full"
            >
              <option value="1">1 jour avant</option>
              <option value="2">2 jours avant</option>
              <option value="3">3 jours avant</option>
              <option value="5">5 jours avant</option>
              <option value="7">7 jours avant</option>
              <option value="14">14 jours avant</option>
              <option value="30">30 jours avant</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Informations supplementaires..."
              className="input w-full resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-ctp-surface1">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isLoading}
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isEdit ? (
                'Enregistrer'
              ) : (
                'Creer'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BillModal;
