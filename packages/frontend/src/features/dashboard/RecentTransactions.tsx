// ============================================================================
// RECENT TRANSACTIONS - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
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
      <div className="bg-ctp-surface0 rounded-xl p-5 border border-ctp-surface1">
        <h3 className="text-lg font-semibold text-ctp-text mb-4">Transactions recentes</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <div className="w-10 h-10 bg-ctp-surface1 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-ctp-surface1 rounded w-3/4 mb-2" />
                <div className="h-3 bg-ctp-surface1 rounded w-1/2" />
              </div>
              <div className="h-4 bg-ctp-surface1 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const transactions = data?.transactions ?? [];

  return (
    <div className="bg-ctp-surface0 rounded-xl p-5 border border-ctp-surface1">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-ctp-text">Transactions recentes</h3>
        <Link
          to={`/transactions`}
          className="text-sm text-ctp-blue hover:text-ctp-sapphire hover:underline transition-colors"
        >
          Voir tout
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-8 bg-ctp-mantle rounded-lg">
          <CreditCard className="w-10 h-10 mx-auto text-ctp-overlay1 mb-2" />
          <p className="text-ctp-subtext0">Aucune transaction</p>
          <p className="text-sm text-ctp-overlay1 mt-1">Ajoutez votre premiere transaction</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((txn) => (
            <Link
              key={txn.id}
              to={`/transactions/${txn.id}`}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-ctp-mantle border border-transparent hover:border-ctp-surface1 transition-all"
            >
              {/* Icon */}
              <div
                className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center text-lg',
                  txn.type === 'income'
                    ? 'bg-ctp-green/20 text-ctp-green'
                    : txn.type === 'transfer'
                      ? 'bg-ctp-blue/20 text-ctp-blue'
                      : 'bg-ctp-red/10 text-ctp-red'
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
                <p className="font-medium text-ctp-text truncate">{txn.description}</p>
                <p className="text-sm text-ctp-subtext0 truncate">
                  {txn.category?.name ?? 'Non categorise'} • {txn.account.name}
                </p>
              </div>

              {/* Amount & Date */}
              <div className="text-right flex-shrink-0">
                <p
                  className={clsx(
                    'font-semibold',
                    txn.type === 'income'
                      ? 'text-ctp-green'
                      : txn.type === 'transfer'
                        ? 'text-ctp-blue'
                        : 'text-ctp-red'
                  )}
                >
                  {txn.type === 'income' ? '+' : txn.type === 'expense' ? '-' : ''}
                  {formatCurrency(Math.abs(txn.amount))}
                </p>
                <p className="text-xs text-ctp-subtext0">{formatDate(txn.date)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default RecentTransactions;
