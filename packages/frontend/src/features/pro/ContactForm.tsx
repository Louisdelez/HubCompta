// ============================================================================
// CONTACT FORM - Finance Hub
// Create/Edit contact modal
// ============================================================================

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { clsx } from 'clsx';
import { User, Building2 } from 'lucide-react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Contact {
  id: string;
  type: 'client' | 'supplier';
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  siret: string | null;
  vatNumber: string | null;
}

interface ContactFormProps {
  contact?: Contact | null;
  onClose: () => void;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ContactForm({ contact, onClose }: ContactFormProps) {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const isEditing = !!contact;

  const [formData, setFormData] = useState({
    type: contact?.type || 'client',
    name: contact?.name || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    address: contact?.address || '',
    siret: contact?.siret || '',
    vatNumber: contact?.vatNumber || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  type ContactPayload = {
    type: 'client' | 'supplier';
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    siret: string | null;
    vatNumber: string | null;
  };

  const createMutation = useMutation({
    mutationFn: (data: ContactPayload) =>
      api.post(`/workspaces/${workspaceId}/contacts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', workspaceId] });
      onClose();
    },
    onError: (error: Error) => {
      setErrors({ submit: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ContactPayload) =>
      api.patch(`/workspaces/${workspaceId}/contacts/${contact!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', workspaceId] });
      onClose();
    },
    onError: (error: Error) => {
      setErrors({ submit: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    if (!formData.name.trim()) {
      setErrors({ name: 'Le nom est requis' });
      return;
    }

    // Clean up empty values
    const data = {
      ...formData,
      email: formData.email || null,
      phone: formData.phone || null,
      address: formData.address || null,
      siret: formData.siret || null,
      vatNumber: formData.vatNumber || null,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-semibold">
            {isEditing ? 'Modifier le contact' : 'Nouveau contact'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-2">Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'client' })}
                className={clsx(
                  'flex-1 py-3 rounded-lg border-2 transition-colors',
                  formData.type === 'client'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                )}
              >
                <User className="w-6 h-6 mx-auto mb-1" />
                <span className="font-medium">Client</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'supplier' })}
                className={clsx(
                  'flex-1 py-3 rounded-lg border-2 transition-colors',
                  formData.type === 'supplier'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                )}
              >
                <Building2 className="w-6 h-6 mx-auto mb-1" />
                <span className="font-medium">Fournisseur</span>
              </button>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Nom <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={clsx('input w-full', errors.name && 'border-danger-500')}
              placeholder="Nom de l'entreprise ou du contact"
            />
            {errors.name && (
              <p className="text-sm text-danger-500 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input w-full"
              placeholder="contact@entreprise.fr"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium mb-1">Téléphone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input w-full"
              placeholder="01 23 45 67 89"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium mb-1">Adresse</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="input w-full h-24 resize-none"
              placeholder="Adresse complète..."
            />
          </div>

          {/* SIRET */}
          <div>
            <label className="block text-sm font-medium mb-1">SIRET</label>
            <input
              type="text"
              value={formData.siret}
              onChange={(e) => setFormData({ ...formData, siret: e.target.value.replace(/\D/g, '').slice(0, 14) })}
              className="input w-full"
              placeholder="12345678901234"
              maxLength={14}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">14 chiffres</p>
          </div>

          {/* VAT Number */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Numéro de TVA intracommunautaire
            </label>
            <input
              type="text"
              value={formData.vatNumber}
              onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value.toUpperCase() })}
              className="input w-full"
              placeholder="FR12345678901"
              maxLength={20}
            />
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="p-3 bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300 rounded-lg text-sm">
              {errors.submit}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
              disabled={isPending}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={isPending}
            >
              {isPending ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ContactForm;
