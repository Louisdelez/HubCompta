// ============================================================================
// CONTACTS PAGE - Finance Hub
// Client & Supplier management
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { clsx } from 'clsx';
import { ContactForm } from './ContactForm';

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
  createdAt: string;
  _count: {
    quotes: number;
    invoices: number;
  };
  totalInvoiced?: number;
  totalPaid?: number;
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

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-ctp-blue',
    'bg-ctp-green',
    'bg-ctp-mauve',
    'bg-ctp-peach',
    'bg-ctp-pink',
    'bg-ctp-teal',
    'bg-ctp-lavender',
    'bg-ctp-red',
  ] as const;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length] as string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ContactsPage() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<'all' | 'client' | 'supplier'>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts', workspaceId, typeFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (search) params.set('search', search);
      return api.get<{ data: Contact[] }>(
        `/workspaces/${workspaceId}/contacts?${params.toString()}`
      ).then((res) => res.data);
    },
    enabled: !!workspaceId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/workspaces/${workspaceId}/contacts/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contacts', workspaceId] });
    },
  });

  const handleDelete = async (contact: Contact) => {
    if (confirm(`Supprimer le contact "${contact.name}" ?`)) {
      await deleteMutation.mutateAsync(contact.id);
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingContact(null);
  };

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-ctp-subtext0">
        Selectionnez un espace de travail
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-ctp-subtext0">
            Gerez vos clients et fournisseurs
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary"
        >
          + Nouveau contact
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Rechercher par nom, email, SIRET..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTypeFilter('all')}
              className={clsx(
                'px-4 py-2 rounded-lg transition-colors',
                typeFilter === 'all'
                  ? 'bg-ctp-blue/20 text-ctp-blue'
                  : 'bg-ctp-surface1 hover:bg-ctp-surface2'
              )}
            >
              Tous
            </button>
            <button
              onClick={() => setTypeFilter('client')}
              className={clsx(
                'px-4 py-2 rounded-lg transition-colors',
                typeFilter === 'client'
                  ? 'bg-ctp-blue/20 text-ctp-blue'
                  : 'bg-ctp-surface1 hover:bg-ctp-surface2'
              )}
            >
              Clients
            </button>
            <button
              onClick={() => setTypeFilter('supplier')}
              className={clsx(
                'px-4 py-2 rounded-lg transition-colors',
                typeFilter === 'supplier'
                  ? 'bg-ctp-blue/20 text-ctp-blue'
                  : 'bg-ctp-surface1 hover:bg-ctp-surface2'
              )}
            >
              Fournisseurs
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-ctp-surface1 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && contacts?.length === 0 && (
        <div className="card text-center py-12">
          <Users className="w-12 h-12 mx-auto mb-4 text-ctp-overlay1" />
          <h2 className="text-xl font-bold mb-2">Aucun contact</h2>
          <p className="text-ctp-subtext0 mb-4">
            Ajoutez vos premiers clients ou fournisseurs
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            + Ajouter un contact
          </button>
        </div>
      )}

      {/* Contact List */}
      {contacts && contacts.length > 0 && (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="card flex items-center gap-4 hover:border-ctp-blue transition-colors"
            >
              {/* Avatar */}
              <div
                className={clsx(
                  'w-12 h-12 rounded-full flex items-center justify-center text-white font-medium',
                  getAvatarColor(contact.name)
                )}
              >
                {getInitials(contact.name)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{contact.name}</h3>
                  <span
                    className={clsx(
                      'px-2 py-0.5 text-xs rounded-full',
                      contact.type === 'client'
                        ? 'bg-ctp-blue/10 text-ctp-blue'
                        : 'bg-ctp-peach/10 text-ctp-peach'
                    )}
                  >
                    {contact.type === 'client' ? 'Client' : 'Fournisseur'}
                  </span>
                </div>
                <div className="text-sm text-ctp-subtext0 space-x-4">
                  {contact.email && <span>{contact.email}</span>}
                  {contact.phone && <span>{contact.phone}</span>}
                </div>
              </div>

              {/* Stats */}
              <div className="hidden md:flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="font-medium">{contact._count.invoices}</p>
                  <p className="text-ctp-subtext0">Factures</p>
                </div>
                {contact.type === 'client' && (
                  <div className="text-center">
                    <p className="font-medium">
                      {formatCurrency(contact.totalInvoiced ?? 0)}
                    </p>
                    <p className="text-ctp-subtext0">Facture</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(contact)}
                  className="p-2 text-ctp-overlay1 hover:text-ctp-text"
                  title="Modifier"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(contact)}
                  className="p-2 text-ctp-overlay1 hover:text-ctp-red"
                  title="Supprimer"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contact Form Modal */}
      {showForm && (
        <ContactForm
          contact={editingContact}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}

export default ContactsPage;
