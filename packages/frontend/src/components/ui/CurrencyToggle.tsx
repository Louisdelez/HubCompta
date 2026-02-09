// ============================================================================
// CURRENCY TOGGLE - Finance Hub
// Header component to switch display currency mode
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Coins, Check, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------


interface CurrencySummary {
  defaultCurrency: string;
  currencies: Array<{
    currency: string;
    symbol: string;
  }>;
}

interface CurrencyToggleProps {
  workspaceId: string;
  className?: string;
}

type DisplayMode = 'original' | 'converted';

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function CurrencyToggle({ workspaceId, className = '' }: CurrencyToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load preferences from localStorage
  const [displayMode, setDisplayModeState] = useState<DisplayMode>(() => {
    const stored = localStorage.getItem('displayCurrencyMode');
    return (stored as DisplayMode) ?? 'original';
  });

  const [displayCurrency, setDisplayCurrencyState] = useState<string>(() => {
    return localStorage.getItem('displayCurrency') ?? 'EUR';
  });

  // Fetch workspace currencies
  const { data: summary, refetch, isLoading } = useQuery({
    queryKey: ['currency-summary-minimal', workspaceId],
    queryFn: () => api.get<CurrencySummary>(`/currencies/workspace/${workspaceId}/summary`),
    staleTime: 1000 * 60 * 5,
  });

  // Update default currency when workspace loads
  useEffect(() => {
    if (summary?.defaultCurrency && !localStorage.getItem('displayCurrency')) {
      setDisplayCurrencyState(summary.defaultCurrency);
    }
  }, [summary?.defaultCurrency]);

  // Close on click outside
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

  const setDisplayMode = (mode: DisplayMode) => {
    setDisplayModeState(mode);
    localStorage.setItem('displayCurrencyMode', mode);
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('currencyDisplayModeChanged', { detail: { mode } }));
  };

  const setDisplayCurrency = (currency: string) => {
    setDisplayCurrencyState(currency);
    localStorage.setItem('displayCurrency', currency);
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('displayCurrencyChanged', { detail: { currency } }));
  };

  const workspaceCurrencies = summary?.currencies ?? [];
  const hasMultipleCurrencies = workspaceCurrencies.length > 1;

  // Get current currency symbol
  const currentSymbol = workspaceCurrencies.find(c => c.currency === displayCurrency)?.symbol ?? displayCurrency;

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'p-2 rounded-lg transition-colors relative',
          'hover:bg-ctp-surface0 text-ctp-subtext1 hover:text-ctp-text',
          isOpen && 'bg-ctp-surface0 text-ctp-text',
          displayMode === 'converted' && 'text-ctp-blue'
        )}
        title={`Affichage: ${displayMode === 'original' ? 'Devises originales' : `Tout en ${displayCurrency}`}`}
      >
        <Coins className="w-5 h-5" />
        {displayMode === 'converted' && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-ctp-blue rounded-full" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-ctp-surface0 border border-ctp-surface1 rounded-xl shadow-lg overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-ctp-surface1 flex items-center justify-between">
            <span className="font-medium text-sm">Affichage des devises</span>
            <button
              onClick={() => void refetch()}
              disabled={isLoading}
              className="p-1 rounded hover:bg-ctp-surface1 text-ctp-subtext0"
              title="Actualiser les taux"
            >
              <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
            </button>
          </div>

          {/* Display mode selection */}
          <div className="p-2">
            <button
              onClick={() => setDisplayMode('original')}
              className={clsx(
                'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors',
                displayMode === 'original'
                  ? 'bg-ctp-blue/10 text-ctp-blue'
                  : 'hover:bg-ctp-surface1'
              )}
            >
              <div>
                <p className="font-medium">Devises originales</p>
                <p className="text-xs text-ctp-subtext0">Chaque compte dans sa devise</p>
              </div>
              {displayMode === 'original' && <Check className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setDisplayMode('converted')}
              disabled={!hasMultipleCurrencies}
              className={clsx(
                'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors mt-1',
                displayMode === 'converted'
                  ? 'bg-ctp-blue/10 text-ctp-blue'
                  : 'hover:bg-ctp-surface1',
                !hasMultipleCurrencies && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div>
                <p className="font-medium">Tout convertir</p>
                <p className="text-xs text-ctp-subtext0">
                  Afficher tout en {currentSymbol} {displayCurrency}
                </p>
              </div>
              {displayMode === 'converted' && <Check className="w-4 h-4" />}
            </button>
          </div>

          {/* Currency selection (when in converted mode) */}
          {displayMode === 'converted' && hasMultipleCurrencies && (
            <>
              <div className="border-t border-ctp-surface1" />
              <div className="p-2">
                <p className="px-3 py-1 text-xs text-ctp-subtext0 uppercase tracking-wider">
                  Devise d'affichage
                </p>
                {workspaceCurrencies.map((curr) => (
                  <button
                    key={curr.currency}
                    onClick={() => setDisplayCurrency(curr.currency)}
                    className={clsx(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                      displayCurrency === curr.currency
                        ? 'bg-ctp-green/10 text-ctp-green'
                        : 'hover:bg-ctp-surface1'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{curr.symbol}</span>
                      <span>{curr.currency}</span>
                    </div>
                    {displayCurrency === curr.currency && <Check className="w-4 h-4" />}
                  </button>
                ))}

                {/* Common currencies not in workspace */}
                <div className="mt-2 pt-2 border-t border-ctp-surface1">
                  <p className="px-3 py-1 text-xs text-ctp-subtext0">Autres</p>
                  {['EUR', 'USD', 'GBP', 'CHF']
                    .filter((c) => !workspaceCurrencies.some((wc) => wc.currency === c))
                    .slice(0, 2)
                    .map((code) => (
                      <button
                        key={code}
                        onClick={() => setDisplayCurrency(code)}
                        className={clsx(
                          'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                          displayCurrency === code
                            ? 'bg-ctp-green/10 text-ctp-green'
                            : 'hover:bg-ctp-surface1'
                        )}
                      >
                        <span>{code}</span>
                        {displayCurrency === code && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                </div>
              </div>
            </>
          )}

          {/* Info when single currency */}
          {!hasMultipleCurrencies && (
            <div className="px-4 py-3 border-t border-ctp-surface1 text-xs text-ctp-subtext0">
              Ajoutez des comptes dans differentes devises pour activer la conversion.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CurrencyToggle;
