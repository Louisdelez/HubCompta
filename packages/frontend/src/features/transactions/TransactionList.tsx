// ============================================================================
// TRANSACTION LIST - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// Virtualized for performance with large datasets
// ============================================================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowLeftRight, CreditCard, Check, ArrowRight, Download, Loader2, Camera } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { useWorkspace } from '@/hooks/useWorkspace';
import { TransactionForm } from './TransactionForm';
import { ScanReceiptModal } from './ScanReceiptModal';
import { CurrencyDisplay } from '@/features/currency';
import { logger } from '@/lib/logger';

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

interface DateGroup {
  date: string;
  formattedDate: string;
  transactions: Transaction[];
}

// Flattened item for virtualization
interface FlatItem {
  type: 'header' | 'transaction';
  date?: string;
  formattedDate?: string;
  transaction?: Transaction;
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

function groupByDate(transactions: Transaction[]): DateGroup[] {
  const groups: Record<string, Transaction[]> = {};

  transactions.forEach((txn) => {
    const date = txn.date.split('T')[0] ?? txn.date;
    if (!groups[date]) groups[date] = [];
    groups[date].push(txn);
  });

  return Object.entries(groups).map(([date, txns]) => ({
    date,
    formattedDate: formatDate(date),
    transactions: txns,
  }));
}

// Flatten groups into a single array for virtualization
function flattenGroups(groups: DateGroup[]): FlatItem[] {
  const items: FlatItem[] = [];

  groups.forEach((group) => {
    items.push({
      type: 'header',
      date: group.date,
      formattedDate: group.formattedDate,
    });

    group.transactions.forEach((txn) => {
      items.push({
        type: 'transaction',
        transaction: txn,
      });
    });
  });

  return items;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const HEADER_HEIGHT = 32;
const TRANSACTION_HEIGHT_BASE = 72;
const TRANSACTION_HEIGHT_WITH_TAGS = 96;

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
  const [showScanModal, setShowScanModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const { mode, displayCurrency } = useCurrencyDisplayMode();
  const parentRef = useRef<HTMLDivElement>(null);

  // PDF Export function
  const handleExportPDF = async () => {
    if (!workspaceId) return;

    setIsExporting(true);
    try {
      const baseUrl = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '/api/v1';
      const token = localStorage.getItem('accessToken');

      // Build URL with current filters
      let url = `${baseUrl}/workspaces/${workspaceId}/reports/transactions/pdf`;
      const params = new URLSearchParams();

      // Default to current month
      const now = new Date();
      params.append('from', format(startOfMonth(now), 'yyyy-MM-dd'));
      params.append('to', format(endOfMonth(now), 'yyyy-MM-dd'));

      if (filters.accountId) params.append('accountId', filters.accountId);
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.search) params.append('search', filters.search);

      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      // Get filename from response
      let filename = `transactions_${format(now, 'yyyyMMdd')}.pdf`;
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      logger.error('PDF export error', error);
      alert("Erreur lors de l'export PDF");
    } finally {
      setIsExporting(false);
    }
  };

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
  const groupedTransactions = useMemo(() => groupByDate(transactions), [transactions]);
  const flattenedItems = useMemo(() => flattenGroups(groupedTransactions), [groupedTransactions]);
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
  const convertAmount = useCallback((amount: number, currency: string): number | null => {
    if (currency === displayCurrency) return amount;
    const rate = rates?.[`${currency}/${displayCurrency}`];
    if (!rate) return null;
    return amount * rate.rate;
  }, [rates, displayCurrency]);

  // Estimate size for each item
  const estimateSize = useCallback((index: number): number => {
    const item = flattenedItems[index] as FlatItem;
    if (item.type === 'header') {
      return HEADER_HEIGHT;
    }
    // Check if transaction has tags
    const hasTags = item.transaction?.tags && item.transaction.tags.length > 0;
    return hasTags ? TRANSACTION_HEIGHT_WITH_TAGS : TRANSACTION_HEIGHT_BASE;
  }, [flattenedItems]);

  // Setup virtualizer
  const virtualizer = useVirtualizer({
    count: flattenedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 5,
    getItemKey: (index: number) => {
      const item = flattenedItems[index] as FlatItem;
      if (item.type === 'header') {
        return `header-${item.date}`;
      }
      return `txn-${item.transaction?.id}`;
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, search: searchQuery }));
    setPage(1);
  };

  const handleTransactionClick = useCallback((txn: Transaction) => {
    setEditingTransaction(txn);
    setShowForm(true);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const container = parentRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    const scrollStep = 72;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        container.scrollTop = currentScrollTop + scrollStep;
        break;
      case 'ArrowUp':
        e.preventDefault();
        container.scrollTop = currentScrollTop - scrollStep;
        break;
      case 'PageDown':
        e.preventDefault();
        container.scrollTop = currentScrollTop + clientHeight;
        break;
      case 'PageUp':
        e.preventDefault();
        container.scrollTop = currentScrollTop - clientHeight;
        break;
      case 'Home':
        e.preventDefault();
        container.scrollTop = 0;
        break;
      case 'End':
        e.preventDefault();
        container.scrollTop = container.scrollHeight;
        break;
    }
  }, []);

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-ctp-subtext0">
        Selectionnez un espace de travail
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-ctp-base min-h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ctp-text">Transactions</h1>
          <p className="text-ctp-subtext0">
            {data?.total ?? 0} transaction{(data?.total ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowScanModal(true)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              'bg-ctp-mauve/10 text-ctp-mauve hover:bg-ctp-mauve/20'
            )}
            title="Scanner un ticket de caisse"
          >
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">Scanner</span>
          </button>
          <button
            onClick={() => void handleExportPDF()}
            disabled={isExporting}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              'bg-ctp-red/10 text-ctp-red hover:bg-ctp-red/20',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Export PDF</span>
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            + <span className="hidden sm:inline">Nouvelle transaction</span><span className="sm:hidden">Ajouter</span>
          </button>
        </div>
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
        <div
          ref={parentRef}
          className="flex-1 overflow-auto min-h-0"
          style={{ height: 'calc(100vh - 320px)' }}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="list"
          aria-label="Liste des transactions"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const item = flattenedItems[virtualItem.index] as FlatItem;

              if (item.type === 'header') {
                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <h3
                      className="text-sm font-medium text-ctp-subtext0 py-2 bg-ctp-base sticky top-0"
                      role="heading"
                      aria-level={3}
                    >
                      {item.formattedDate}
                    </h3>
                  </div>
                );
              }

              const txn = item.transaction as Transaction;
              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  role="listitem"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <div
                    onClick={() => handleTransactionClick(txn)}
                    className={clsx(
                      'card flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow border-l-4 mb-2',
                      txn.type === 'income'
                        ? 'border-l-ctp-green'
                        : txn.type === 'transfer'
                        ? 'border-l-ctp-blue'
                        : 'border-l-ctp-red'
                    )}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleTransactionClick(txn);
                      }
                    }}
                    aria-label={`${txn.description}, ${txn.type}, ${txn.amount} ${txn.account.currency}`}
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
                          <span title="Rapproche"><Check className="w-4 h-4 text-ctp-green" /></span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-ctp-subtext0">
                        <span className="truncate">
                          {txn.category?.name ?? 'Non categorise'}
                        </span>
                        <span>-</span>
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
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4 border-t border-ctp-surface1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary"
          >
            Precedent
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

      {/* Scan Receipt Modal */}
      {showScanModal && (
        <ScanReceiptModal
          workspaceId={workspaceId}
          onClose={() => setShowScanModal(false)}
          onSuccess={() => {
            void refetch();
            setShowScanModal(false);
          }}
        />
      )}
    </div>
  );
}

export default TransactionList;
