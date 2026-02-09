// ============================================================================
// RECENT TRANSACTIONS - Finance Hub
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, CreditCard } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Transaction {
  id: string;
  amount: number;
  description: string;
  date: string;
  type: 'expense' | 'income' | 'transfer';
  category?: { id: string; name: string; icon: string | null } | null;
  account: { id: string; name: string };
}

interface RecentTransactionsProps {
  workspaceId: string;
  limit?: number;
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
    day: 'numeric',
    month: 'short',
  });
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function RecentTransactions({ workspaceId, limit = 10 }: RecentTransactionsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['recent-transactions', workspaceId, limit],
    queryFn: () =>
      api.get<{ transactions: Transaction[]; total: number }>(
        `/workspaces/${workspaceId}/transactions?limit=${limit}`
      ),
  });

  if (isLoading) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Transactions récentes</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const transactions = data?.transactions ?? [];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Transactions récentes</h3>
        <Link
          to={`/transactions`}
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          Voir tout
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>Aucune transaction</p>
          <p className="text-sm mt-1">Ajoutez votre première transaction</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((txn) => (
            <Link
              key={txn.id}
              to={`/transactions/${txn.id}`}
              className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              {/* Icon */}
              <div
                className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center text-lg',
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
                <p className="font-medium truncate">{txn.description}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {txn.category?.name ?? 'Non catégorisé'} • {txn.account.name}
                </p>
              </div>

              {/* Amount & Date */}
              <div className="text-right flex-shrink-0">
                <p
                  className={clsx(
                    'font-medium',
                    txn.amount > 0
                      ? 'text-success-600 dark:text-success-400'
                      : 'text-gray-900 dark:text-white'
                  )}
                >
                  {txn.amount > 0 ? '+' : ''}
                  {formatCurrency(txn.amount)}
                </p>
                <p className="text-xs text-gray-400">{formatDate(txn.date)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default RecentTransactions;
