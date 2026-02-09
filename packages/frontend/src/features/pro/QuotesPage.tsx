// ============================================================================
// QUOTES PAGE - Finance Hub
// Quote list and management
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { PenLine, Pencil, Trash2, Copy } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

interface Quote {
  id: string;
  number: string;
  status: QuoteStatus;
  issueDate: string;
  validUntil: string;
  subtotal: string;
  vatAmount: string;
  total: string;
  contact: {
    id: string;
    name: string;
    email: string | null;
  };
  _count?: {
    invoices: number;
  };
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

const STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  sent: { label: 'Envoyé', color: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300' },
  accepted: { label: 'Accepté', color: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300' },
  rejected: { label: 'Refusé', color: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300' },
  expired: { label: 'Expiré', color: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function QuotesPage() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');

  const { data: quotes, isLoading } = useQuery({
    queryKey: ['quotes', workspaceId, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      return api.get<{ data: Quote[] }>(
        `/workspaces/${workspaceId}/quotes?${params.toString()}`
      ).then((res) => res.data);
    },
    enabled: !!workspaceId,
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/workspaces/${workspaceId}/quotes/${id}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes', workspaceId] });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/workspaces/${workspaceId}/quotes/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes', workspaceId] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/workspaces/${workspaceId}/quotes/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes', workspaceId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/workspaces/${workspaceId}/quotes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes', workspaceId] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<{ data: Quote }>(`/workspaces/${workspaceId}/quotes/${id}/duplicate`),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['quotes', workspaceId] });
      navigate(`/workspaces/${workspaceId}/pro/quotes/${response.data.id}`);
    },
  });

  const convertToInvoiceMutation = useMutation({
    mutationFn: (quoteId: string) => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      return api.post<{ data: { id: string } }>(
        `/workspaces/${workspaceId}/invoices/from-quote/${quoteId}`,
        { dueDate }
      );
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['quotes', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices', workspaceId] });
      navigate(`/workspaces/${workspaceId}/pro/invoices/${response.data.id}`);
    },
  });

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        Sélectionnez un espace de travail
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Devis</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Créez et suivez vos devis
          </p>
        </div>
        <Link
          to={`/workspaces/${workspaceId}/pro/quotes/new`}
          className="btn btn-primary"
        >
          + Nouveau devis
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-2">
          {(['all', 'draft', 'sent', 'accepted', 'rejected', 'expired'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={clsx(
                'px-4 py-2 rounded-lg transition-colors',
                statusFilter === status
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              {status === 'all' ? 'Tous' : STATUS_CONFIG[status].label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && quotes?.length === 0 && (
        <div className="card text-center py-12">
          <PenLine className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-bold mb-2">Aucun devis</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Créez votre premier devis pour commencer
          </p>
          <Link
            to={`/workspaces/${workspaceId}/pro/quotes/new`}
            className="btn btn-primary"
          >
            + Créer un devis
          </Link>
        </div>
      )}

      {/* Quote List */}
      {quotes && quotes.length > 0 && (
        <div className="space-y-3">
          {quotes.map((quote) => (
            <div
              key={quote.id}
              className="card flex flex-col sm:flex-row sm:items-center gap-4 hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
            >
              {/* Main Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <Link
                    to={`/workspaces/${workspaceId}/pro/quotes/${quote.id}`}
                    className="font-semibold text-primary-600 hover:underline"
                  >
                    {quote.number}
                  </Link>
                  <span className={clsx(
                    'px-2 py-0.5 text-xs rounded-full',
                    STATUS_CONFIG[quote.status].color
                  )}>
                    {STATUS_CONFIG[quote.status].label}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {quote.contact.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Émis le {formatDate(quote.issueDate)} • Valide jusqu'au {formatDate(quote.validUntil)}
                </p>
              </div>

              {/* Amount */}
              <div className="text-right">
                <p className="text-lg font-bold">{formatCurrency(quote.total)}</p>
                {quote._count?.invoices && quote._count.invoices > 0 && (
                  <p className="text-sm text-success-600">Facturé</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {quote.status === 'draft' && (
                  <>
                    <button
                      onClick={() => sendMutation.mutate(quote.id)}
                      className="btn btn-sm btn-primary"
                      disabled={sendMutation.isPending}
                    >
                      Envoyer
                    </button>
                    <Link
                      to={`/workspaces/${workspaceId}/pro/quotes/${quote.id}/edit`}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
                      title="Modifier"
                    >
                      <Pencil className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => {
                        if (confirm('Supprimer ce brouillon ?')) {
                          deleteMutation.mutate(quote.id);
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-danger-600"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                {quote.status === 'sent' && (
                  <>
                    <button
                      onClick={() => acceptMutation.mutate(quote.id)}
                      className="btn btn-sm btn-success"
                      disabled={acceptMutation.isPending}
                    >
                      Accepter
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Marquer comme refusé ?')) {
                          rejectMutation.mutate(quote.id);
                        }
                      }}
                      className="btn btn-sm btn-secondary"
                      disabled={rejectMutation.isPending}
                    >
                      Refuser
                    </button>
                  </>
                )}
                {quote.status === 'accepted' && !quote._count?.invoices && (
                  <button
                    onClick={() => convertToInvoiceMutation.mutate(quote.id)}
                    className="btn btn-sm btn-primary"
                    disabled={convertToInvoiceMutation.isPending}
                  >
                    → Facturer
                  </button>
                )}
                <button
                  onClick={() => duplicateMutation.mutate(quote.id)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
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

export default QuotesPage;
