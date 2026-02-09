// ============================================================================
// INVOICES PAGE - Finance Hub
// Invoice list and management
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Pencil, Trash2, X, Copy } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

interface Invoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  vatAmount: string;
  total: string;
  paidAmount: string;
  contact: {
    id: string;
    name: string;
    email: string | null;
  };
  quote?: {
    id: string;
    number: string;
  } | null;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number | string, currency = 'EUR'): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(numAmount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'bg-ctp-surface1 text-ctp-subtext0' },
  sent: { label: 'Envoyee', color: 'bg-ctp-yellow/10 text-ctp-yellow' },
  paid: { label: 'Payee', color: 'bg-ctp-green/10 text-ctp-green' },
  overdue: { label: 'En retard', color: 'bg-ctp-red/10 text-ctp-red' },
  cancelled: { label: 'Annulee', color: 'bg-ctp-surface1 text-ctp-overlay1' },
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function InvoicesPage() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', workspaceId, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      return api.get<{ data: Invoice[] }>(
        `/workspaces/${workspaceId}/invoices?${params.toString()}`
      ).then((res) => res.data);
    },
    enabled: !!workspaceId,
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/workspaces/${workspaceId}/invoices/${id}/send`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices', workspaceId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/workspaces/${workspaceId}/invoices/${id}/cancel`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices', workspaceId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/workspaces/${workspaceId}/invoices/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices', workspaceId] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<{ data: Invoice }>(`/workspaces/${workspaceId}/invoices/${id}/duplicate`),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ['invoices', workspaceId] });
      navigate(`/workspaces/${workspaceId}/pro/invoices/${response.data.id}`);
    },
  });

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
          <h1 className="text-2xl font-bold">Factures</h1>
          <p className="text-ctp-subtext0">
            Gerez vos factures et suivez les paiements
          </p>
        </div>
        <Link
          to={`/workspaces/${workspaceId}/pro/invoices/new`}
          className="btn btn-primary"
        >
          + Nouvelle facture
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-2">
          {(['all', 'draft', 'sent', 'overdue', 'paid', 'cancelled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={clsx(
                'px-4 py-2 rounded-lg transition-colors',
                statusFilter === status
                  ? 'bg-ctp-blue/20 text-ctp-blue'
                  : 'bg-ctp-surface1 hover:bg-ctp-surface2'
              )}
            >
              {status === 'all' ? 'Toutes' : STATUS_CONFIG[status].label}
            </button>
          ))}
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
      {!isLoading && invoices?.length === 0 && (
        <div className="card text-center py-12">
          <FileText className="w-12 h-12 mx-auto mb-4 text-ctp-overlay1" />
          <h2 className="text-xl font-bold mb-2">Aucune facture</h2>
          <p className="text-ctp-subtext0 mb-4">
            Creez votre premiere facture pour commencer
          </p>
          <Link
            to={`/workspaces/${workspaceId}/pro/invoices/new`}
            className="btn btn-primary"
          >
            + Creer une facture
          </Link>
        </div>
      )}

      {/* Invoice List */}
      {invoices && invoices.length > 0 && (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="card flex flex-col sm:flex-row sm:items-center gap-4 hover:border-ctp-blue transition-colors"
            >
              {/* Main Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <Link
                    to={`/workspaces/${workspaceId}/pro/invoices/${invoice.id}`}
                    className="font-semibold text-ctp-blue hover:underline"
                  >
                    {invoice.number}
                  </Link>
                  <span className={clsx(
                    'px-2 py-0.5 text-xs rounded-full',
                    STATUS_CONFIG[invoice.status].color
                  )}>
                    {STATUS_CONFIG[invoice.status].label}
                  </span>
                </div>
                <p className="text-sm text-ctp-subtext0">
                  {invoice.contact.name}
                </p>
                <p className="text-xs text-ctp-subtext0">
                  Emise le {formatDate(invoice.issueDate)} - Echeance {formatDate(invoice.dueDate)}
                </p>
              </div>

              {/* Amount */}
              <div className="text-right">
                <p className="text-lg font-bold">{formatCurrency(invoice.total)}</p>
                {invoice.status === 'paid' && (
                  <p className="text-sm text-ctp-green">Payee</p>
                )}
                {parseFloat(invoice.paidAmount) > 0 && parseFloat(invoice.paidAmount) < parseFloat(invoice.total) && (
                  <p className="text-sm text-ctp-yellow">
                    {formatCurrency(invoice.paidAmount)} recu
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {invoice.status === 'draft' && (
                  <>
                    <button
                      onClick={() => sendMutation.mutate(invoice.id)}
                      className="btn btn-sm btn-primary"
                      disabled={sendMutation.isPending}
                    >
                      Envoyer
                    </button>
                    <Link
                      to={`/workspaces/${workspaceId}/pro/invoices/${invoice.id}/edit`}
                      className="p-2 text-ctp-overlay1 hover:text-ctp-text"
                      title="Modifier"
                    >
                      <Pencil className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => {
                        if (confirm('Supprimer ce brouillon ?')) {
                          deleteMutation.mutate(invoice.id);
                        }
                      }}
                      className="p-2 text-ctp-overlay1 hover:text-ctp-red"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                  <>
                    <Link
                      to={`/workspaces/${workspaceId}/pro/invoices/${invoice.id}/pay`}
                      className="btn btn-sm btn-success"
                    >
                      Encaisser
                    </Link>
                    <button
                      onClick={() => {
                        if (confirm('Annuler cette facture ?')) {
                          cancelMutation.mutate(invoice.id);
                        }
                      }}
                      className="p-2 text-ctp-overlay1 hover:text-ctp-red"
                      title="Annuler"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => duplicateMutation.mutate(invoice.id)}
                  className="p-2 text-ctp-overlay1 hover:text-ctp-text"
                  title="Dupliquer"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default InvoicesPage;
