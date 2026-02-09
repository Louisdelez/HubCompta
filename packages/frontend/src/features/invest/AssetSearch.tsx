// ============================================================================
// ASSET SEARCH COMPONENT - Finance Hub
// Search and select assets (stocks, ETFs, crypto)
// ============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, TrendingUp, Bitcoin, Building2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: 'stock' | 'etf' | 'crypto' | 'bond' | 'commodity' | 'other';
  exchange?: string;
  currency: string;
  lastPrice?: number;
  lastPriceAt?: string;
}

interface SearchResult {
  symbol: string;
  name: string;
  type: 'stock' | 'etf' | 'crypto' | 'bond' | 'commodity' | 'other';
  exchange?: string;
  currency: string;
}

interface AssetSearchProps {
  onSelect: (asset: Asset | SearchResult) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AssetSearch({
  onSelect,
  placeholder = 'Rechercher un actif (ex: AAPL, BTC, LVMH)...',
  className,
  disabled = false,
}: AssetSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search query
  const { data: results, isLoading } = useQuery({
    queryKey: ['asset-search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const response = await api.get<SearchResult[]>(
        `/assets/search?query=${encodeURIComponent(debouncedQuery)}`
      );
      return response;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 60000,
  });

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!results || results.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % results.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
      }
    },
    [results, selectedIndex]
  );

  const handleSelect = useCallback(
    (asset: SearchResult) => {
      onSelect(asset);
      setQuery('');
      setIsOpen(false);
    },
    [onSelect]
  );

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'crypto':
        return <Bitcoin className="h-4 w-4 text-orange-500" />;
      case 'etf':
        return <Building2 className="h-4 w-4 text-purple-500" />;
      default:
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'stock':
        return 'Action';
      case 'etf':
        return 'ETF';
      case 'crypto':
        return 'Crypto';
      case 'bond':
        return 'Obligation';
      case 'commodity':
        return 'Matière première';
      default:
        return 'Autre';
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'w-full pl-10 pr-4 py-2 border rounded-lg',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'disabled:bg-gray-100 disabled:cursor-not-allowed',
            'text-sm',
            'bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400'
          )}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && query.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Recherche en cours...
            </div>
          ) : results && results.length > 0 ? (
            <ul className="py-1">
              {results.map((result, index) => (
                <li key={`${result.symbol}-${result.exchange || 'default'}`}>
                  <button
                    type="button"
                    onClick={() => handleSelect(result)}
                    className={cn(
                      'w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700',
                      index === selectedIndex && 'bg-blue-50 dark:bg-blue-900/30'
                    )}
                  >
                    {getAssetIcon(result.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">{result.symbol}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                          {getTypeLabel(result.type)}
                        </span>
                        {result.exchange && (
                          <span className="text-xs text-gray-400">{result.exchange}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{result.name}</p>
                    </div>
                    <span className="text-xs text-gray-400">{result.currency}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              Aucun résultat trouvé pour "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AssetSearch;
