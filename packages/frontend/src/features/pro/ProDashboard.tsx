// ============================================================================
// PRO DASHBOARD - Finance Hub
// Overview of invoicing and contacts
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, Users, PenLine, FileText } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ContactStats {
  clientCount: number;
  supplierCount: number;
  totalContacts: number;
  pendingInvoices: Array<{
    id: string;
    number: string;
    total: number;
    dueDate: string;
    contact: { name: string };
  }>;
}

interface InvoiceStats {
  totalDraft: number;
  totalSent: number;
  totalPaid: number;
  totalOverdue: number;
  amountDraft: number;
  amountSent: number;
  amountPaid: number;
  amountOverdue: number;
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

function getDaysUntil(dateStr: string): number {
  const date = new Date(dateStr);
  const today = new Date();
  const diff = date.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ProDashboard() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();

  const { data: contactStats, isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts', 'stats', workspaceId],
    queryFn: () =>
      api.get<{ data: ContactStats }>(`/workspaces/${workspaceId}/contacts/stats`)
        .then((res) => res.data),
    enabled: !!workspaceId,
  });

  const { data: invoiceStats, isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices', 'stats', workspaceId],
    queryFn: () =>
      api.get<{ data: InvoiceStats }>(`/workspaces/${workspaceId}/invoices/stats`)
        .then((res) => res.data),
    enabled: !!workspaceId,
  });

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-gray-500">
        Sélectionnez un espace de travail
      </div>
    );
  }

  const isLoading = loadingContacts || loadingInvoices;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mode Pro</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gérez vos clients, devis et factures
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to={`/workspaces/${workspaceId}/pro/quotes/new`}
            className="btn btn-secondary"
          >
            + Nouveau devis
          </Link>
          <Link
            to={`/workspaces/${workspaceId}/pro/invoices/new`}
            className="btn btn-primary"
          >
            + Nouvelle facture
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="text-sm text-gray-500">Clients</p>
          <p className="text-3xl font-bold text-primary-600">
            {contactStats?.clientCount ?? 0}
          </p>
          <Link
            to={`/workspaces/${workspaceId}/pro/contacts?type=client`}
            className="text-sm text-primary-600 hover:underline"
          >
            Voir les clients →
          </Link>
        </div>

        <div className="card">
          <p className="text-sm text-gray-500">À encaisser</p>
          <p className="text-3xl font-bold text-warning-600">
            {formatCurrency(invoiceStats?.amountSent ?? 0)}
          </p>
          <p className="text-sm text-gray-500">
            {invoiceStats?.totalSent ?? 0} facture{(invoiceStats?.totalSent ?? 0) > 1 ? 's' : ''} en attente
          </p>
        </div>

        <div className="card">
          <p className="text-sm text-gray-500">En retard</p>
          <p className={clsx(
            'text-3xl font-bold',
            (invoiceStats?.totalOverdue ?? 0) > 0 ? 'text-danger-600' : 'text-success-600'
          )}>
            {formatCurrency(invoiceStats?.amountOverdue ?? 0)}
          </p>
          <p className="text-sm text-gray-500">
            {invoiceStats?.totalOverdue ?? 0} facture{(invoiceStats?.totalOverdue ?? 0) > 1 ? 's' : ''}
          </p>
        </div>

        <div className="card">
          <p className="text-sm text-gray-500">Encaissé ce mois</p>
          <p className="text-3xl font-bold text-success-600">
            {formatCurrency(invoiceStats?.amountPaid ?? 0)}
          </p>
          <p className="text-sm text-gray-500">
            {invoiceStats?.totalPaid ?? 0} facture{(invoiceStats?.totalPaid ?? 0) > 1 ? 's' : ''} payée{(invoiceStats?.totalPaid ?? 0) > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Pending Invoices */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Factures à suivre</h2>
            <Link
              to={`/workspaces/${workspaceId}/pro/invoices`}
              className="text-sm text-primary-600 hover:underline"
            >
              Voir tout →
            </Link>
          </div>

          {contactStats?.pendingInvoices?.length ? (
            <div className="space-y-3">
              {contactStats.pendingInvoices.map((invoice) => {
                const daysUntil = getDaysUntil(invoice.dueDate);
                const isOverdue = daysUntil < 0;

                return (
                  <Link
                    key={invoice.id}
                    to={`/workspaces/${workspaceId}/pro/invoices/${invoice.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{invoice.number}</p>
                      <p className="text-sm text-gray-500">{invoice.contact.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(invoice.total)}</p>
                      <p className={clsx(
                        'text-sm',
                        isOverdue ? 'text-danger-600 font-medium' : 'text-gray-500'
                      )}>
                        {isOverdue
                          ? `${Math.abs(daysUntil)} jour${Math.abs(daysUntil) > 1 ? 's' : ''} de retard`
                          : `Échéance ${formatDate(invoice.dueDate)}`
                        }
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Check className="w-8 h-8 mx-auto mb-2" />
              <p>Aucune facture en attente</p>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Résumé facturation</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span>Brouillons</span>
              </div>
              <div className="text-right">
                <span className="font-medium">{invoiceStats?.totalDraft ?? 0}</span>
                <span className="text-gray-500 ml-2">
                  ({formatCurrency(invoiceStats?.amountDraft ?? 0)})
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-warning-500" />
                <span>En attente</span>
              </div>
              <div className="text-right">
                <span className="font-medium">{invoiceStats?.totalSent ?? 0}</span>
                <span className="text-gray-500 ml-2">
                  ({formatCurrency(invoiceStats?.amountSent ?? 0)})
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-danger-500" />
                <span>En retard</span>
              </div>
              <div className="text-right">
                <span className="font-medium">{invoiceStats?.totalOverdue ?? 0}</span>
                <span className="text-gray-500 ml-2">
                  ({formatCurrency(invoiceStats?.amountOverdue ?? 0)})
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-success-500" />
                <span>Payées</span>
              </div>
              <div className="text-right">
                <span className="font-medium">{invoiceStats?.totalPaid ?? 0}</span>
                <span className="text-gray-500 ml-2">
                  ({formatCurrency(invoiceStats?.amountPaid ?? 0)})
                </span>
              </div>
            </div>
          </div>

          {/* Total Bar */}
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden flex">
              {(invoiceStats?.amountPaid ?? 0) > 0 && (
                <div
                  className="h-full bg-success-500"
                  style={{
                    width: `${(invoiceStats!.amountPaid / (invoiceStats!.amountPaid + invoiceStats!.amountSent + invoiceStats!.amountOverdue + invoiceStats!.amountDraft || 1)) * 100}%`,
                  }}
                />
              )}
              {(invoiceStats?.amountSent ?? 0) > 0 && (
                <div
                  className="h-full bg-warning-500"
                  style={{
                    width: `${(invoiceStats!.amountSent / (invoiceStats!.amountPaid + invoiceStats!.amountSent + invoiceStats!.amountOverdue + invoiceStats!.amountDraft || 1)) * 100}%`,
                  }}
                />
              )}
              {(invoiceStats?.amountOverdue ?? 0) > 0 && (
                <div
                  className="h-full bg-danger-500"
                  style={{
                    width: `${(invoiceStats!.amountOverdue / (invoiceStats!.amountPaid + invoiceStats!.amountSent + invoiceStats!.amountOverdue + invoiceStats!.amountDraft || 1)) * 100}%`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to={`/workspaces/${workspaceId}/pro/contacts`}
          className="card hover:border-primary-500 transition-colors"
        >
          <Users className="w-8 h-8 mb-3 text-gray-500" />
          <h3 className="font-semibold mb-1">Contacts</h3>
          <p className="text-sm text-gray-500">
            Gérez vos clients et fournisseurs
          </p>
        </Link>

        <Link
          to={`/workspaces/${workspaceId}/pro/quotes`}
          className="card hover:border-primary-500 transition-colors"
        >
          <PenLine className="w-8 h-8 mb-3 text-gray-500" />
          <h3 className="font-semibold mb-1">Devis</h3>
          <p className="text-sm text-gray-500">
            Créez et suivez vos devis
          </p>
        </Link>

        <Link
          to={`/workspaces/${workspaceId}/pro/invoices`}
          className="card hover:border-primary-500 transition-colors"
        >
          <FileText className="w-8 h-8 mb-3 text-gray-500" />
          <h3 className="font-semibold mb-1">Factures</h3>
          <p className="text-sm text-gray-500">
            Facturez et suivez les paiements
          </p>
        </Link>
      </div>
    </div>
  );
}

export default ProDashboard;
