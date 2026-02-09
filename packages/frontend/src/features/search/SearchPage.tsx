// ============================================================================
// SEARCH PAGE - Finance Hub
// ============================================================================

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, FileText, User, FileSpreadsheet, PenLine, Landmark, RefreshCw, ArrowUpFromLine, ArrowDownToLine } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { useWorkspace } from '@/hooks/useWorkspace';
import { AdvancedFilters, TransactionFilters } from './AdvancedFilters';
import { SavedFilters } from './SavedFilters';
import { formatCurrency } from '@/features/currency';
import type { LucideIcon } from 'lucide-react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface SearchResult {
  id: string;
  type: 'transaction' | 'document' | 'contact' | 'invoice' | 'quote' | 'account' | 'recurrence';
  title: string;
  subtitle?: string;
  amount?: number;
  currency?: string;
  date?: string;
  icon?: string;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalCount: number;
}

interface TransactionSearchResult {
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  totals: {
    income: number;
    expense: number;
    net: number;
    count: number;
  };
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  type: 'expense' | 'income' | 'transfer';
  status: string;
  account: { id: string; name: string; color?: string };
  category?: { id: string; name: string; icon?: string };
  tags: { id: string; name: string }[];
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const TYPE_CONFIG: Record<string, { icon: LucideIcon; label: string; color: string }> = {
  transaction: { icon: CreditCard, label: 'Transactions', color: 'blue' },
  document: { icon: FileText, label: 'Documents', color: 'green' },
  contact: { icon: User, label: 'Contacts', color: 'purple' },
  invoice: { icon: FileSpreadsheet, label: 'Factures', color: 'orange' },
  quote: { icon: PenLine, label: 'Devis', color: 'yellow' },
  account: { icon: Landmark, label: 'Comptes', color: 'cyan' },
  recurrence: { icon: RefreshCw, label: 'Récurrences', color: 'pink' },
};

const RESULT_TYPES = Object.keys(TYPE_CONFIG) as (keyof typeof TYPE_CONFIG)[];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  // State
  const [activeTab, setActiveTab] = useState<'global' | 'transactions'>('global');
  const [globalQuery, setGlobalQuery] = useState(searchParams.get('q') ?? '');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>({});
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Sync URL with global query
  useEffect(() => {
    if (globalQuery) {
      setSearchParams({ q: globalQuery });
    } else {
      setSearchParams({});
    }
  }, [globalQuery, setSearchParams]);

  // Global search query
  const { data: globalResults, isLoading: isGlobalLoading } = useQuery({
    queryKey: ['global-search', workspaceId, globalQuery, selectedTypes],
    queryFn: async () => {
      if (!globalQuery || globalQuery.length < 2 || !workspaceId) return null;
      const typesParam = selectedTypes.length > 0 ? `&types=${selectedTypes.join(',')}` : '';
      return api.get<SearchResponse>(
        `/workspaces/${workspaceId}/search?q=${encodeURIComponent(globalQuery)}${typesParam}&limit=50`
      );
    },
    enabled: activeTab === 'global' && globalQuery.length >= 2 && !!workspaceId,
  });

  // Transaction search query
  const { data: transactionResults, isLoading: isTransactionLoading } = useQuery({
    queryKey: ['transaction-search', workspaceId, transactionFilters, page, pageSize],
    queryFn: async () => {
      if (!workspaceId) return null;
      const params = new URLSearchParams();
      if (transactionFilters.query) params.set('query', transactionFilters.query);
      if (transactionFilters.accountIds?.length)
        params.set('accountIds', transactionFilters.accountIds.join(','));
      if (transactionFilters.categoryIds?.length)
        params.set('categoryIds', transactionFilters.categoryIds.join(','));
      if (transactionFilters.tagIds?.length)
        params.set('tagIds', transactionFilters.tagIds.join(','));
      if (transactionFilters.types?.length)
        params.set('types', transactionFilters.types.join(','));
      if (transactionFilters.dateFrom) params.set('dateFrom', transactionFilters.dateFrom);
      if (transactionFilters.dateTo) params.set('dateTo', transactionFilters.dateTo);
      if (transactionFilters.amountMin !== undefined)
        params.set('amountMin', String(transactionFilters.amountMin));
      if (transactionFilters.amountMax !== undefined)
        params.set('amountMax', String(transactionFilters.amountMax));
      if (transactionFilters.status) params.set('status', transactionFilters.status);
      if (transactionFilters.hasDocuments !== undefined)
        params.set('hasDocuments', String(transactionFilters.hasDocuments));
      if (transactionFilters.isRecurring !== undefined)
        params.set('isRecurring', String(transactionFilters.isRecurring));
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('sortBy', 'date');
      params.set('sortOrder', 'desc');

      return api.get<TransactionSearchResult>(
        `/workspaces/${workspaceId}/transactions/search?${params.toString()}`
      );
    },
    enabled: activeTab === 'transactions' && !!workspaceId,
  });

  // Group global results by type
  const groupedResults = globalResults?.results.reduce<Record<string, SearchResult[]>>((acc, result) => {
    const typeResults = acc[result.type] ?? [];
    typeResults.push(result);
    acc[result.type] = typeResults;
    return acc;
  }, {}) ?? {};

  const handleResultClick = (result: SearchResult) => {
    const basePath = workspaceId ? `/workspaces/${workspaceId}` : '';
    switch (result.type) {
      case 'transaction':
        navigate(`${basePath}/transactions?id=${result.id}`);
        break;
      case 'document':
        navigate(`${basePath}/documents?id=${result.id}`);
        break;
      case 'contact':
        navigate(`${basePath}/contacts/${result.id}`);
        break;
      case 'invoice':
        navigate(`${basePath}/invoices/${result.id}`);
        break;
      case 'quote':
        navigate(`${basePath}/quotes/${result.id}`);
        break;
      case 'account':
        navigate(`${basePath}/accounts/${result.id}`);
        break;
      case 'recurrence':
        navigate(`${basePath}/recurrences/${result.id}`);
        break;
    }
  };

  const handleTransactionClick = (transaction: Transaction) => {
    const basePath = workspaceId ? `/workspaces/${workspaceId}` : '';
    navigate(`${basePath}/transactions?id=${transaction.id}`);
  };

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        Sélectionnez un espace de travail pour effectuer une recherche.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Recherche</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('global')}
          className={clsx(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            activeTab === 'global'
              ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
          )}
        >
          Recherche globale
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={clsx(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            activeTab === 'transactions'
              ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
          )}
        >
          Transactions avancées
        </button>
      </div>

      {/* Global Search Tab */}
      {activeTab === 'global' && (
        <div className="space-y-6">
          {/* Search Input */}
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder="Rechercher partout..."
              className="w-full pl-12 pr-4 py-3 text-lg rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Type Filters */}
          <div className="flex flex-wrap gap-2">
            {RESULT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => {
                  setSelectedTypes((prev) =>
                    prev.includes(type)
                      ? prev.filter((t) => t !== type)
                      : [...prev, type]
                  );
                }}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  selectedTypes.includes(type)
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                )}
              >
                {(() => { const config = TYPE_CONFIG[type]; if (!config) return null; const Icon = config.icon; return <Icon className="w-4 h-4 inline mr-1" />; })()} {TYPE_CONFIG[type]?.label}
              </button>
            ))}
          </div>

          {/* Results */}
          {isGlobalLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
              <p className="mt-4 text-gray-500 dark:text-gray-400">Recherche en cours...</p>
            </div>
          ) : globalQuery.length < 2 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>Entrez au moins 2 caractères pour rechercher</p>
            </div>
          ) : globalResults?.results.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p className="text-lg">Aucun résultat pour "{globalQuery}"</p>
              <p className="mt-2 text-sm">Essayez avec d'autres termes</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedResults).map(([type, results]) => (
                <div key={type} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-medium inline-flex items-center gap-1">
                      {(() => { const Icon = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG]?.icon; return Icon ? <Icon className="w-4 h-4" /> : null; })()}
                      {TYPE_CONFIG[type as keyof typeof TYPE_CONFIG]?.label}
                      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">({results.length})</span>
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {results.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => handleResultClick(result)}
                        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <span className="text-lg">
                          {result.icon ? <span>{result.icon}</span> : (() => { const Icon = TYPE_CONFIG[result.type as keyof typeof TYPE_CONFIG]?.icon; return Icon ? <Icon className="w-5 h-5" /> : null; })()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{result.title}</p>
                          {result.subtitle && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{result.subtitle}</p>
                          )}
                        </div>
                        {result.amount !== undefined && (
                          <span
                            className={clsx(
                              'font-medium',
                              result.amount >= 0 ? 'text-success-600' : 'text-danger-600'
                            )}
                          >
                            {formatCurrency(result.amount, result.currency ?? 'EUR')}
                          </span>
                        )}
                        {result.date && (
                          <span className="text-sm text-gray-400">
                            {new Date(result.date).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transaction Search Tab */}
      {activeTab === 'transactions' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <AdvancedFilters
              workspaceId={workspaceId}
              filters={transactionFilters}
              onChange={setTransactionFilters}
              onReset={() => setTransactionFilters({})}
            />
            <SavedFilters
              workspaceId={workspaceId}
              currentFilters={transactionFilters}
              onApply={setTransactionFilters}
            />
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            {/* Summary */}
            {transactionResults?.totals && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Transactions</p>
                  <p className="text-2xl font-bold">{transactionResults.totals.count}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Revenus</p>
                  <p className="text-2xl font-bold text-success-600">
                    {formatCurrency(transactionResults.totals.income, 'EUR')}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Dépenses</p>
                  <p className="text-2xl font-bold text-danger-600">
                    {formatCurrency(transactionResults.totals.expense, 'EUR')}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Solde</p>
                  <p
                    className={clsx(
                      'text-2xl font-bold',
                      transactionResults.totals.net >= 0 ? 'text-success-600' : 'text-danger-600'
                    )}
                  >
                    {formatCurrency(transactionResults.totals.net, 'EUR')}
                  </p>
                </div>
              </div>
            )}

            {/* Transaction List */}
            {isTransactionLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : transactionResults?.transactions.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <p>Aucune transaction trouvée</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {transactionResults?.transactions.map((transaction) => (
                    <button
                      key={transaction.id}
                      onClick={() => handleTransactionClick(transaction)}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                        style={{ backgroundColor: transaction.account.color ? `${transaction.account.color}20` : '#f3f4f6' }}
                      >
                        {transaction.category?.icon ? <span>{transaction.category.icon}</span> : (transaction.type === 'expense' ? <ArrowUpFromLine className="w-5 h-5 text-danger-500" /> : <ArrowDownToLine className="w-5 h-5 text-success-500" />)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{transaction.description}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <span>{transaction.account.name}</span>
                          {transaction.category && (
                            <>
                              <span>•</span>
                              <span>{transaction.category.name}</span>
                            </>
                          )}
                          {transaction.tags.length > 0 && (
                            <>
                              <span>•</span>
                              <span>{transaction.tags.map((t) => `#${t.name}`).join(' ')}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={clsx(
                            'font-medium',
                            transaction.amount >= 0 ? 'text-success-600' : 'text-danger-600'
                          )}
                        >
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </p>
                        <p className="text-sm text-gray-400">
                          {new Date(transaction.date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Pagination */}
                {transactionResults && transactionResults.total > pageSize && (
                  <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, transactionResults.total)} sur {transactionResults.total}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                      >
                        Précédent
                      </button>
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page * pageSize >= transactionResults.total}
                        className="px-3 py-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                      >
                        Suivant
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchPage;
