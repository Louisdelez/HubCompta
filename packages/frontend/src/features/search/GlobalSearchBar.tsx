// ============================================================================
// GLOBAL SEARCH BAR - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, FileText, User, FileSpreadsheet, PenLine, Landmark, RefreshCw } from 'lucide-react';
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
  transaction: { icon: CreditCard, label: 'Transaction', path: '/transactions' },
  document: { icon: FileText, label: 'Document', path: '/documents' },
  contact: { icon: User, label: 'Contact', path: '/contacts' },
  invoice: { icon: FileSpreadsheet, label: 'Facture', path: '/invoices' },
  quote: { icon: PenLine, label: 'Devis', path: '/quotes' },
  account: { icon: Landmark, label: 'Compte', path: '/accounts' },
  recurrence: { icon: RefreshCw, label: 'Récurrence', path: '/recurrences' },
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

  // Handle result selection
  const handleSelect = useCallback(
    (result: SearchResult) => {
      const config = TYPE_CONFIG[result.type];
      const path = workspaceId
        ? `/workspaces/${workspaceId}${config.path}/${result.id}`
        : `${config.path}?id=${result.id}`;
      navigate(path);
      setIsOpen(false);
      setQuery('');
    },
    [navigate, workspaceId]
  );

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
    [results, selectedIndex, handleSelect]
  );

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
          'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all bg-ctp-surface0',
          isOpen
            ? 'border-ctp-blue ring-2 ring-ctp-blue/20'
            : 'border-ctp-surface1'
        )}
        role="combobox"
        aria-expanded={isOpen && query.length >= 2}
        aria-haspopup="listbox"
        aria-owns="search-results-listbox"
      >
        <svg
          className="w-4 h-4 text-ctp-overlay1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
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
          className="flex-1 bg-transparent border-0 outline-none text-sm placeholder-ctp-overlay0"
          aria-label="Recherche globale"
          aria-autocomplete="list"
          aria-controls="search-results-listbox"
          aria-activedescendant={results.length > 0 ? `search-result-${results[selectedIndex]?.id}` : undefined}
        />
        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-ctp-overlay1 bg-ctp-surface1 rounded" aria-hidden="true">
          <span>⌘</span>K
        </kbd>
      </div>

      {/* Results Dropdown */}
      {isOpen && query.length >= 2 && (
        <div
          id="search-results-listbox"
          className="absolute top-full left-0 right-0 mt-2 bg-ctp-surface0 rounded-lg shadow-xl border border-ctp-surface1 overflow-hidden z-50 max-h-96 overflow-y-auto"
          role="listbox"
          aria-label="Resultats de recherche"
        >
          {isLoading ? (
            <div className="p-4 text-center text-ctp-subtext0" role="status" aria-live="polite">
              <div className="animate-spin w-5 h-5 border-2 border-ctp-blue border-t-transparent rounded-full mx-auto" aria-hidden="true" />
              <p className="mt-2 text-sm">Recherche en cours...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-ctp-subtext0" role="status" aria-live="polite">
              <p className="text-sm">Aucun resultat pour "{query}"</p>
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
                  <div className="px-3 py-1.5 text-xs font-medium text-ctp-overlay1 uppercase">
                    {TYPE_CONFIG[type as keyof typeof TYPE_CONFIG]?.label ?? type}
                  </div>
                  {typeResults.map((result) => {
                    const globalIdx = results.indexOf(result);
                    const config = TYPE_CONFIG[result.type];
                    const isSelected = globalIdx === selectedIndex;
                    return (
                      <button
                        key={result.id}
                        id={`search-result-${result.id}`}
                        onClick={() => handleSelect(result)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={clsx(
                          'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors',
                          isSelected
                            ? 'bg-ctp-yellow/20'
                            : 'hover:bg-ctp-surface1'
                        )}
                        role="option"
                        aria-selected={isSelected}
                      >
                        {result.icon ? (
                          <span className="text-lg">{result.icon}</span>
                        ) : (
                          <config.icon className="w-5 h-5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{result.title}</p>
                          {result.subtitle && (
                            <p className="text-xs text-ctp-subtext0 truncate">{result.subtitle}</p>
                          )}
                        </div>
                        {result.amount !== undefined && (
                          <span
                            className={clsx(
                              'text-sm font-medium',
                              result.amount >= 0 ? 'text-ctp-green' : 'text-ctp-red'
                            )}
                          >
                            {formatCurrency(result.amount, result.currency ?? 'EUR')}
                          </span>
                        )}
                        {result.date && (
                          <span className="text-xs text-ctp-overlay1">
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
                  className="w-full px-3 py-2 text-center text-sm text-ctp-blue hover:bg-ctp-surface1"
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
