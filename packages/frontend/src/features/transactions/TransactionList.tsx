// ============================================================================
// TRANSACTION LIST - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, CreditCard, Check } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { useWorkspace } from '@/hooks/useWorkspace';
import { TransactionForm } from './TransactionForm';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Transaction {
  id: string;
  amount: number;
  description: string;
  date: string;
  type: 'expense' | 'income' | 'transfer';
  isReconciled: boolean;
  category?: { id: string; name: string; icon: string | null } | null;
  account: { id: string; name: string; currency: string };
  tags: { id: string; name: string; color: string | null }[];
}

interface TransactionListResponse {
  transactions: Transaction[];
  total: number;
  meta: {
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function groupByDate(transactions: Transaction[]): Record<string, Transaction[]> {
  return transactions.reduce<Record<string, Transaction[]>>((groups, txn) => {
    const date = txn.date.split('T')[0] ?? txn.date;
    if (!groups[date]) groups[date] = [];
    groups[date].push(txn);
    return groups;
  }, {});
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function TransactionList() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transactions', workspaceId, page, filters],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '50');
      if (filters.accountId) params.set('accountId', filters.accountId);
      if (filters.categoryId) params.set('categoryId', filters.categoryId);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.search) params.set('search', filters.search);

      return api.get<TransactionListResponse>(
        `/workspaces/${workspaceId}/transactions?${params}`
      );
    },
    enabled: !!workspaceId,
  });

  const transactions = data?.transactions ?? [];
  const groupedTransactions = groupByDate(transactions);
  const meta = data?.meta;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, search: searchQuery }));
    setPage(1);
  };

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-gray-500">
        Sélectionnez un espace de travail
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {data?.total ?? 0} transaction{(data?.total ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + Nouvelle transaction
        </button>
      </div>

      {/* Search & Filters */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher..."
          className="input flex-1"
        />
        <button type="submit" className="btn-secondary">
          Rechercher
        </button>
      </form>

      {/* Transaction List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
              <div className="space-y-2">
                <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-lg mb-4">Aucune transaction</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            Ajouter une transaction
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTransactions).map(([date, dayTransactions]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                {formatDate(date)}
              </h3>
              <div className="space-y-2">
                {dayTransactions.map((txn) => (
                  <div
                    key={txn.id}
                    onClick={() => {
                      setEditingTransaction(txn);
                      setShowForm(true);
                    }}
                    className="card flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    {/* Icon */}
                    <div
                      className={clsx(
                        'w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0',
                        txn.type === 'income'
                          ? 'bg-success-100 dark:bg-success-900/30'
                          : txn.type === 'transfer'
                          ? 'bg-blue-100 dark:bg-blue-900/30'
                          : 'bg-gray-100 dark:bg-gray-700'
                      )}
                    >
                      {txn.category?.icon ? (
                        txn.category.icon
                      ) : txn.type === 'transfer' ? (
                        <ArrowLeftRight className="w-5 h-5" />
                      ) : (
                        <CreditCard className="w-5 h-5" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{txn.description}</p>
                        {txn.isReconciled && (
                          <span title="Rapproché"><Check className="w-4 h-4 text-success-500" /></span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="truncate">
                          {txn.category?.name ?? 'Non catégorisé'}
                        </span>
                        <span>•</span>
                        <span className="truncate">{txn.account.name}</span>
                      </div>
                      {txn.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {txn.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag.id}
                              className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700"
                              style={tag.color ? { backgroundColor: tag.color + '20', color: tag.color } : {}}
                            >
                              {tag.name}
                            </span>
                          ))}
                          {txn.tags.length > 3 && (
                            <span className="text-xs text-gray-400">
                              +{txn.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Amount */}
                    <span
                      className={clsx(
                        'text-lg font-bold flex-shrink-0',
                        txn.amount > 0
                          ? 'text-success-600 dark:text-success-400'
                          : 'text-gray-900 dark:text-white'
                      )}
                    >
                      {txn.amount > 0 ? '+' : ''}
                      {formatCurrency(txn.amount, txn.account.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary"
          >
            Précédent
          </button>
          <span className="text-sm text-gray-500">
            Page {meta.page} sur {meta.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page === meta.totalPages}
            className="btn-secondary"
          >
            Suivant
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <TransactionForm
          workspaceId={workspaceId}
          transaction={editingTransaction !== null ? {
            id: editingTransaction.id,
            accountId: editingTransaction.account.id,
            amount: editingTransaction.amount,
            currency: editingTransaction.account.currency,
            description: editingTransaction.description,
            date: editingTransaction.date,
            type: editingTransaction.type,
            categoryId: editingTransaction.category?.id,
            notes: undefined,
            tags: editingTransaction.tags,
          } : undefined}
          onClose={() => {
            setShowForm(false);
            setEditingTransaction(null);
          }}
          onSuccess={() => {
            refetch();
            setShowForm(false);
            setEditingTransaction(null);
          }}
        />
      )}
    </div>
  );
}

export default TransactionList;
