// ============================================================================
// TRANSACTION LIST - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, CreditCard, Check, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { useWorkspace } from '@/hooks/useWorkspace';
import { TransactionForm } from './TransactionForm';
import { CurrencyDisplay } from '@/features/currency';

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
// Hooks
// ----------------------------------------------------------------------------

// Currency display mode hook
function useCurrencyDisplayMode() {
  const [mode, setMode] = useState<'original' | 'converted'>(() => {
    return (localStorage.getItem('displayCurrencyMode') as 'original' | 'converted') ?? 'original';
  });
  const [displayCurrency, setDisplayCurrency] = useState(() => {
    return localStorage.getItem('displayCurrency') ?? 'EUR';
  });

  useEffect(() => {
    const handleModeChange = (e: CustomEvent<{ mode: string }>) => {
      setMode(e.detail.mode as 'original' | 'converted');
    };
    const handleCurrencyChange = (e: CustomEvent<{ currency: string }>) => {
      setDisplayCurrency(e.detail.currency);
    };

    window.addEventListener('currencyDisplayModeChanged', handleModeChange as EventListener);
    window.addEventListener('displayCurrencyChanged', handleCurrencyChange as EventListener);

    return () => {
      window.removeEventListener('currencyDisplayModeChanged', handleModeChange as EventListener);
      window.removeEventListener('displayCurrencyChanged', handleCurrencyChange as EventListener);
    };
  }, []);

  return { mode, displayCurrency };
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

interface ConversionRate {
  rate: number;
  source: string;
  date: string;
}

export function TransactionList() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { mode, displayCurrency } = useCurrencyDisplayMode();

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

  const transactions = useMemo(() => data?.transactions ?? [], [data?.transactions]);
  const groupedTransactions = groupByDate(transactions);
  const meta = data?.meta;

  // Get unique currencies from transactions
  const uniqueCurrencies = useMemo(() => {
    const currencies = new Set(transactions.map(t => t.account.currency));
    return Array.from(currencies);
  }, [transactions]);

  // Fetch exchange rates for conversion
  const { data: rates } = useQuery({
    queryKey: ['batch-rates', uniqueCurrencies, displayCurrency],
    queryFn: async () => {
      const pairs = uniqueCurrencies
        .filter(c => c !== displayCurrency)
        .map(c => `${c}/${displayCurrency}`)
        .join(',');
      if (!pairs) return {};
      return api.get<Record<string, ConversionRate | null>>(`/currencies/batch-rates?pairs=${pairs}`);
    },
    enabled: mode === 'converted' && uniqueCurrencies.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // Helper to convert amount
  const convertAmount = (amount: number, currency: string): number | null => {
    if (currency === displayCurrency) return amount;
    const rate = rates?.[`${currency}/${displayCurrency}`];
    if (!rate) return null;
    return amount * rate.rate;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, search: searchQuery }));
    setPage(1);
  };

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-ctp-subtext0">
        Sélectionnez un espace de travail
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-ctp-base min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ctp-text">Transactions</h1>
          <p className="text-ctp-subtext0">
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
          className="input flex-1 bg-ctp-surface0 border-ctp-surface1"
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
              <div className="h-4 bg-ctp-surface1 rounded w-24 mb-3" />
              <div className="space-y-2">
                <div className="h-16 bg-ctp-surface1 rounded-xl" />
                <div className="h-16 bg-ctp-surface1 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="card bg-ctp-mantle text-center py-12">
          <p className="text-ctp-subtext0 text-lg mb-4">Aucune transaction</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            Ajouter une transaction
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTransactions).map(([date, dayTransactions]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-ctp-subtext0 mb-2">
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
                    className={clsx(
                      'card flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow border-l-4',
                      txn.type === 'income'
                        ? 'border-l-ctp-green'
                        : txn.type === 'transfer'
                        ? 'border-l-ctp-blue'
                        : 'border-l-ctp-red'
                    )}
                  >
                    {/* Icon */}
                    <div
                      className={clsx(
                        'w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0',
                        txn.type === 'income'
                          ? 'bg-ctp-green/10 text-ctp-green'
                          : txn.type === 'transfer'
                          ? 'bg-ctp-blue/10 text-ctp-blue'
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
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-ctp-text truncate">{txn.description}</p>
                        {txn.isReconciled && (
                          <span title="Rapproché"><Check className="w-4 h-4 text-ctp-green" /></span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-ctp-subtext0">
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
                              className="text-xs px-2 py-0.5 rounded-full bg-ctp-mauve/20 text-ctp-mauve"
                              style={tag.color ? { backgroundColor: tag.color + '20', color: tag.color } : {}}
                            >
                              {tag.name}
                            </span>
                          ))}
                          {txn.tags.length > 3 && (
                            <span className="text-xs text-ctp-subtext0">
                              +{txn.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="flex-shrink-0 text-right">
                      <CurrencyDisplay
                        amount={txn.amount}
                        currency={txn.account.currency}
                        showSign
                        colorize
                        size="lg"
                      />
                      {mode === 'converted' && txn.account.currency !== displayCurrency && (
                        (() => {
                          const converted = convertAmount(txn.amount, txn.account.currency);
                          if (converted === null) return null;
                          return (
                            <div className="flex items-center gap-1 text-xs text-ctp-subtext0 justify-end mt-0.5">
                              <ArrowRight className="w-3 h-3" />
                              <CurrencyDisplay
                                amount={converted}
                                currency={displayCurrency}
                                size="sm"
                              />
                            </div>
                          );
                        })()
                      )}
                    </div>
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
          <span className="text-sm text-ctp-subtext0">
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
            void refetch();
            setShowForm(false);
            setEditingTransaction(null);
          }}
        />
      )}
    </div>
  );
}

export default TransactionList;
