// ============================================================================
// CURRENCY SELECTOR - Finance Hub
// Enhanced dropdown for selecting currencies with search and favorites
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Search, Star } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
}

interface CurrencySelectorProps {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
  showSymbol?: boolean;
  placeholder?: string;
  variant?: 'default' | 'minimal' | 'compact';
  allowEmpty?: boolean;
  workspaceCurrencies?: string[];
}

// Common currencies to show at the top
const PRIORITY_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function CurrencySelector({
  value,
  onChange,
  disabled = false,
  className = '',
  showSymbol = true,
  placeholder = 'Selectionner une devise',
  variant = 'default',
  allowEmpty = false,
  workspaceCurrencies = [],
}: CurrencySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: currencies, isLoading } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => api.get<Currency[]>('/currencies'),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isOpen]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Get selected currency details
  const selectedCurrency = useMemo(
    () => currencies?.find((c) => c.code === value),
    [currencies, value]
  );

  // Filter and sort currencies
  const filteredCurrencies = useMemo(() => {
    if (!currencies) return [];

    let filtered = currencies;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = currencies.filter(
        (c) =>
          c.code.toLowerCase().includes(query) ||
          c.name.toLowerCase().includes(query) ||
          c.symbol.includes(query)
      );
    }

    // Sort: workspace currencies first, then priority, then alphabetically
    return filtered.sort((a, b) => {
      // Workspace currencies first
      const aInWorkspace = workspaceCurrencies.includes(a.code);
      const bInWorkspace = workspaceCurrencies.includes(b.code);
      if (aInWorkspace && !bInWorkspace) return -1;
      if (!aInWorkspace && bInWorkspace) return 1;

      // Then priority currencies
      const aIndex = PRIORITY_CURRENCIES.indexOf(a.code);
      const bIndex = PRIORITY_CURRENCIES.indexOf(b.code);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // Then alphabetically
      return a.code.localeCompare(b.code);
    });
  }, [currencies, searchQuery, workspaceCurrencies]);

  const handleSelect = (code: string) => {
    onChange(code);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Minimal variant - just shows the currency code
  if (variant === 'minimal') {
    return (
      <div ref={containerRef} className={clsx('relative', className)}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={clsx(
            'inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium',
            'hover:bg-ctp-surface0 transition-colors',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {selectedCurrency ? (
            <>
              {showSymbol && <span className="text-ctp-subtext0">{selectedCurrency.symbol}</span>}
              <span>{selectedCurrency.code}</span>
            </>
          ) : (
            <span className="text-ctp-subtext0">---</span>
          )}
          <ChevronDown className="w-3 h-3 text-ctp-subtext0" />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-48 bg-ctp-surface0 border border-ctp-surface1 rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b border-ctp-surface1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-ctp-subtext0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 bg-ctp-surface1 rounded text-sm focus:outline-none focus:ring-1 focus:ring-ctp-blue"
                  placeholder="Rechercher..."
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredCurrencies.map((currency) => (
                <button
                  key={currency.code}
                  type="button"
                  onClick={() => handleSelect(currency.code)}
                  className={clsx(
                    'w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-ctp-surface1',
                    currency.code === value && 'bg-ctp-blue/10 text-ctp-blue'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span>{currency.symbol}</span>
                    <span>{currency.code}</span>
                  </div>
                  {currency.code === value && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <div ref={containerRef} className={clsx('relative', className)}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={clsx(
            'inline-flex items-center justify-between gap-2 w-full px-3 py-2 rounded-lg',
            'bg-ctp-surface0 border border-ctp-surface1 text-sm',
            'hover:border-ctp-blue focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {selectedCurrency ? (
            <div className="flex items-center gap-2">
              <span className="text-lg">{selectedCurrency.symbol}</span>
              <span className="font-medium">{selectedCurrency.code}</span>
            </div>
          ) : (
            <span className="text-ctp-subtext0">{placeholder}</span>
          )}
          <ChevronDown className={clsx('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full bg-ctp-surface0 border border-ctp-surface1 rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b border-ctp-surface1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-ctp-subtext0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 bg-ctp-surface1 rounded text-sm focus:outline-none focus:ring-1 focus:ring-ctp-blue"
                  placeholder="Rechercher..."
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {/* Workspace currencies section */}
              {workspaceCurrencies.length > 0 && !searchQuery && (
                <>
                  <div className="px-3 py-1.5 text-xs text-ctp-subtext0 bg-ctp-surface1 flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    Votre espace
                  </div>
                  {filteredCurrencies
                    .filter((c) => workspaceCurrencies.includes(c.code))
                    .map((currency) => (
                      <button
                        key={currency.code}
                        type="button"
                        onClick={() => handleSelect(currency.code)}
                        className={clsx(
                          'w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-ctp-surface1',
                          currency.code === value && 'bg-ctp-blue/10 text-ctp-blue'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg w-6">{currency.symbol}</span>
                          <div>
                            <span className="font-medium">{currency.code}</span>
                            <span className="ml-2 text-ctp-subtext0">{currency.name}</span>
                          </div>
                        </div>
                        {currency.code === value && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                </>
              )}

              {/* All currencies section */}
              {!searchQuery && (
                <div className="px-3 py-1.5 text-xs text-ctp-subtext0 bg-ctp-surface1">
                  Toutes les devises
                </div>
              )}
              {filteredCurrencies
                .filter((c) => searchQuery || !workspaceCurrencies.includes(c.code))
                .map((currency) => (
                  <button
                    key={currency.code}
                    type="button"
                    onClick={() => handleSelect(currency.code)}
                    className={clsx(
                      'w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-ctp-surface1',
                      currency.code === value && 'bg-ctp-blue/10 text-ctp-blue'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg w-6">{currency.symbol}</span>
                      <div>
                        <span className="font-medium">{currency.code}</span>
                        <span className="ml-2 text-ctp-subtext0">{currency.name}</span>
                      </div>
                    </div>
                    {currency.code === value && <Check className="w-4 h-4" />}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default variant - native select for simplicity
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || isLoading}
      className={clsx('input', className)}
    >
      {allowEmpty && <option value="">{isLoading ? 'Chargement...' : placeholder}</option>}

      {/* Priority currencies */}
      {filteredCurrencies
        .filter((c) => PRIORITY_CURRENCIES.includes(c.code))
        .map((currency) => (
          <option key={currency.code} value={currency.code}>
            {showSymbol ? `${currency.symbol} ` : ''}
            {currency.code} - {currency.name}
          </option>
        ))}

      {/* Separator */}
      {filteredCurrencies.length > PRIORITY_CURRENCIES.length && (
        <option disabled>──────────</option>
      )}

      {/* Other currencies */}
      {filteredCurrencies
        .filter((c) => !PRIORITY_CURRENCIES.includes(c.code))
        .map((currency) => (
          <option key={currency.code} value={currency.code}>
            {showSymbol ? `${currency.symbol} ` : ''}
            {currency.code} - {currency.name}
          </option>
        ))}
    </select>
  );
}

export default CurrencySelector;
