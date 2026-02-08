// ============================================================================
// GLOBAL SEARCH BAR - Finance Hub
// ============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency } from '@/features/currency';

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

// ----------------------------------------------------------------------------
// Type Config
// ----------------------------------------------------------------------------

const TYPE_CONFIG = {
  transaction: { icon: '💳', label: 'Transaction', path: '/transactions' },
  document: { icon: '📄', label: 'Document', path: '/documents' },
  contact: { icon: '👤', label: 'Contact', path: '/contacts' },
  invoice: { icon: '📃', label: 'Facture', path: '/invoices' },
  quote: { icon: '📝', label: 'Devis', path: '/quotes' },
  account: { icon: '🏦', label: 'Compte', path: '/accounts' },
  recurrence: { icon: '🔄', label: 'Récurrence', path: '/recurrences' },
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

interface GlobalSearchBarProps {
  workspaceId?: string;
  className?: string;
}

export function GlobalSearchBar({ workspaceId, className }: GlobalSearchBarProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Fetch search results
  const { data: searchData, isLoading } = useQuery({
    queryKey: ['global-search', workspaceId, debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return null;
      const endpoint = workspaceId
        ? `/workspaces/${workspaceId}/search`
        : '/search';
      return api.get<SearchResponse>(`${endpoint}?q=${encodeURIComponent(debouncedQuery)}&limit=10`);
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 60000,
  });

  const results = searchData?.results ?? [];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open search with Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      }
      // Close with Escape
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle result navigation
  const handleKeyNavigation = useCallback(
    (e: React.KeyboardEvent) => {
      if (!results.length) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % results.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + results.length) % results.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
      }
    },
    [results, selectedIndex]
  );

  // Handle result selection
  const handleSelect = (result: SearchResult) => {
    const config = TYPE_CONFIG[result.type];
    const path = workspaceId
      ? `/workspaces/${workspaceId}${config.path}/${result.id}`
      : `${config.path}?id=${result.id}`;
    navigate(path);
    setIsOpen(false);
    setQuery('');
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isOpen]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {/* Search Input */}
      <div
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
          isOpen
            ? 'border-primary-500 ring-2 ring-primary-500/20 bg-white dark:bg-gray-800'
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
        )}
      >
        <svg
          className="w-4 h-4 text-gray-400"
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
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyNavigation}
          placeholder="Rechercher..."
          className="flex-1 bg-transparent border-0 outline-none text-sm placeholder-gray-400"
        />
        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 rounded">
          <span>⌘</span>K
        </kbd>
      </div>

      {/* Results Dropdown */}
      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
              <p className="mt-2 text-sm">Recherche en cours...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p className="text-sm">Aucun résultat pour "{query}"</p>
            </div>
          ) : (
            <div className="py-2">
              {/* Group results by type */}
              {Object.entries(
                results.reduce<Record<string, SearchResult[]>>((acc, result) => {
                  const typeResults = acc[result.type] ?? [];
                  typeResults.push(result);
                  acc[result.type] = typeResults;
                  return acc;
                }, {})
              ).map(([type, typeResults]) => (
                <div key={type}>
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase">
                    {TYPE_CONFIG[type as keyof typeof TYPE_CONFIG]?.label ?? type}
                  </div>
                  {typeResults.map((result) => {
                    const globalIdx = results.indexOf(result);
                    const config = TYPE_CONFIG[result.type];
                    return (
                      <button
                        key={result.id}
                        onClick={() => handleSelect(result)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={clsx(
                          'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors',
                          globalIdx === selectedIndex
                            ? 'bg-primary-50 dark:bg-primary-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        )}
                      >
                        <span className="text-lg">{result.icon ?? config.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{result.title}</p>
                          {result.subtitle && (
                            <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                          )}
                        </div>
                        {result.amount !== undefined && (
                          <span
                            className={clsx(
                              'text-sm font-medium',
                              result.amount >= 0 ? 'text-success-600' : 'text-danger-600'
                            )}
                          >
                            {formatCurrency(result.amount, result.currency ?? 'EUR')}
                          </span>
                        )}
                        {result.date && (
                          <span className="text-xs text-gray-400">
                            {new Date(result.date).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}

              {/* Show all results link */}
              {searchData && searchData.totalCount > results.length && (
                <button
                  onClick={() => {
                    navigate(`/search?q=${encodeURIComponent(query)}`);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className="w-full px-3 py-2 text-center text-sm text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  Voir tous les résultats ({searchData.totalCount})
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GlobalSearchBar;
