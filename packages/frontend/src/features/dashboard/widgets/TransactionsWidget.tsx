// ============================================================================
// TRANSACTIONS WIDGET - Finance Hub Dashboard
// Displays recent transactions
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, CreditCard } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import type { WidgetProps } from './index';

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

export function TransactionsWidget({ workspaceId, config }: WidgetProps) {
  const limit = (config.limit as number) || 8;

  const { data, isLoading } = useQuery({
    queryKey: ['transactions-widget', workspaceId, limit],
    queryFn: () =>
      api.get<{ transactions: Transaction[]; total: number }>(
        `/workspaces/${workspaceId}/transactions?limit=${limit}`
      ),
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="animate-pulse space-y-2 flex-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <div className="w-8 h-8 bg-ctp-surface1 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-ctp-surface1 rounded w-3/4 mb-1" />
                <div className="h-3 bg-ctp-surface1 rounded w-1/2" />
              </div>
              <div className="h-4 bg-ctp-surface1 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const transactions = data?.transactions ?? [];

  return (
    <div className="h-full flex flex-col">
      {/* Transaction List */}
      <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="w-8 h-8 mx-auto text-ctp-overlay1 mb-2" />
            <p className="text-sm text-ctp-subtext0">Aucune transaction</p>
          </div>
        ) : (
          transactions.map((txn) => (
            <Link
              key={txn.id}
              to={`/transactions/${txn.id}`}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-ctp-mantle transition-colors"
            >
              {/* Icon */}
              <div
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0',
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
                  <ArrowLeftRight className="w-4 h-4" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ctp-text truncate">
                  {txn.description}
                </p>
                <p className="text-xs text-ctp-subtext0 truncate">
                  {txn.category?.name ?? 'Non categorise'}
                </p>
              </div>

              {/* Amount & Date */}
              <div className="text-right flex-shrink-0">
                <p
                  className={clsx(
                    'text-sm font-semibold',
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
          ))
        )}
      </div>

      {/* View All Link */}
      {transactions.length > 0 && (
        <Link
          to="/transactions"
          className="mt-2 pt-2 border-t border-ctp-surface1 text-center text-sm text-ctp-blue hover:text-ctp-sapphire transition-colors"
        >
          Voir toutes les transactions
        </Link>
      )}
    </div>
  );
}

export default TransactionsWidget;
