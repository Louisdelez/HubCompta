// ============================================================================
// CURRENCY CONTEXT - Finance Hub
// Global currency display preferences and conversion utilities
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { logger } from '@/lib/logger';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type DisplayCurrencyMode = 'original' | 'converted';

export interface ExchangeRate {
  rate: number;
  source: string;
  date: string;
}

export interface ConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  rate: number;
  date: string;
  source: string;
}

export interface CurrencySummary {
  defaultCurrency: string;
  totalInDefaultCurrency: number;
  currencies: Array<{
    currency: string;
    symbol: string;
    name: string;
    totalBalance: number;
    convertedBalance: number;
    exchangeRate: number | null;
    accountCount: number;
  }>;
}

interface CurrencyContextValue {
  // Display preferences
  displayCurrency: string;
  setDisplayCurrency: (currency: string) => void;
  displayMode: DisplayCurrencyMode;
  setDisplayMode: (mode: DisplayCurrencyMode) => void;

  // Available currencies
  availableCurrencies: string[];
  workspaceCurrencies: string[];

  // Conversion
  convert: (amount: number, from: string, to?: string) => Promise<number>;
  convertSync: (amount: number, from: string, to?: string) => number | null;
  getRate: (from: string, to: string) => number | null;

  // Cached rates
  rates: Map<string, ExchangeRate>;
  isLoadingRates: boolean;
  refreshRates: () => void;

  // Workspace summary
  currencySummary: CurrencySummary | null;
  isLoadingSummary: boolean;

  // Utilities
  formatWithConversion: (
    amount: number,
    currency: string,
    options?: FormatOptions
  ) => FormattedAmount;
}

interface FormatOptions {
  showOriginal?: boolean;
  showConverted?: boolean;
  compact?: boolean;
  locale?: string;
}

interface FormattedAmount {
  original: string;
  converted: string | null;
  originalAmount: number;
  convertedAmount: number | null;
  currency: string;
  displayCurrency: string;
  rate: number | null;
}

// ----------------------------------------------------------------------------
// Context
// ----------------------------------------------------------------------------

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

// ----------------------------------------------------------------------------
// Provider
// ----------------------------------------------------------------------------

interface CurrencyProviderProps {
  children: ReactNode;
  workspaceId?: string;
  defaultCurrency?: string;
}

export function CurrencyProvider({
  children,
  workspaceId,
  defaultCurrency = 'EUR',
}: CurrencyProviderProps) {
  const queryClient = useQueryClient();

  // Display preferences (persisted in localStorage)
  const [displayCurrency, setDisplayCurrencyState] = useState<string>(() => {
    const stored = localStorage.getItem('displayCurrency');
    return stored ?? defaultCurrency;
  });

  const [displayMode, setDisplayModeState] = useState<DisplayCurrencyMode>(() => {
    const stored = localStorage.getItem('displayCurrencyMode');
    return (stored as DisplayCurrencyMode) ?? 'original';
  });

  // Persist preferences
  const setDisplayCurrency = useCallback((currency: string) => {
    setDisplayCurrencyState(currency);
    localStorage.setItem('displayCurrency', currency);
  }, []);

  const setDisplayMode = useCallback((mode: DisplayCurrencyMode) => {
    setDisplayModeState(mode);
    localStorage.setItem('displayCurrencyMode', mode);
  }, []);

  // Fetch available currencies
  const { data: currencies } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => api.get<Array<{ code: string; name: string; symbol: string }>>('/currencies'),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const availableCurrencies = useMemo(
    () => currencies?.map((c) => c.code) ?? [],
    [currencies]
  );

  // Fetch workspace currency summary
  const { data: currencySummary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['currency-summary', workspaceId],
    queryFn: () =>
      api.get<CurrencySummary>(`/currencies/workspace/${workspaceId}/summary`),
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const workspaceCurrencies = useMemo(
    () => currencySummary?.currencies.map((c) => c.currency) ?? [],
    [currencySummary]
  );

  // Update display currency when workspace changes
  useEffect(() => {
    if (currencySummary?.defaultCurrency && !localStorage.getItem('displayCurrency')) {
      setDisplayCurrencyState(currencySummary.defaultCurrency);
    }
  }, [currencySummary?.defaultCurrency]);

  // Cached exchange rates
  const [rates] = useState<Map<string, ExchangeRate>>(() => new Map());
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  // Fetch rates for workspace currencies
  const fetchRates = useCallback(async () => {
    if (workspaceCurrencies.length === 0) return;

    setIsLoadingRates(true);
    try {
      // Build pairs string for batch fetch
      const pairs = workspaceCurrencies
        .filter((c) => c !== displayCurrency)
        .map((c) => `${c}/${displayCurrency}`)
        .join(',');

      if (!pairs) {
        setIsLoadingRates(false);
        return;
      }

      const response = await api.get<Record<string, ExchangeRate | null>>(
        `/currencies/batch-rates?pairs=${pairs}`
      );

      // Update rates cache
      for (const [pair, rate] of Object.entries(response)) {
        if (rate) {
          rates.set(pair, rate);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch exchange rates', error);
    } finally {
      setIsLoadingRates(false);
    }
  }, [workspaceCurrencies, displayCurrency, rates]);

  // Refresh rates when display currency or workspace currencies change
  useEffect(() => {
    void fetchRates();
  }, [fetchRates]);

  const refreshRates = useCallback(() => {
    void fetchRates();
    void queryClient.invalidateQueries({ queryKey: ['currency-summary', workspaceId] });
  }, [fetchRates, queryClient, workspaceId]);

  // Get rate from cache
  const getRate = useCallback(
    (from: string, to: string): number | null => {
      if (from === to) return 1;

      const pair = `${from}/${to}`;
      const cachedRate = rates.get(pair);
      if (cachedRate) return cachedRate.rate;

      // Try reverse rate
      const reversePair = `${to}/${from}`;
      const reverseRate = rates.get(reversePair);
      if (reverseRate) return 1 / reverseRate.rate;

      return null;
    },
    [rates]
  );

  // Synchronous conversion (uses cached rates)
  const convertSync = useCallback(
    (amount: number, from: string, to?: string): number | null => {
      const targetCurrency = to ?? displayCurrency;
      const rate = getRate(from, targetCurrency);
      if (rate === null) return null;
      return amount * rate;
    },
    [displayCurrency, getRate]
  );

  // Async conversion (fetches rate if needed)
  const convert = useCallback(
    async (amount: number, from: string, to?: string): Promise<number> => {
      const targetCurrency = to ?? displayCurrency;

      // Try cached rate first
      const cachedResult = convertSync(amount, from, targetCurrency);
      if (cachedResult !== null) return cachedResult;

      // Fetch from API
      try {
        const result = await api.get<ConversionResult>(
          `/currencies/convert?from=${from}&to=${targetCurrency}&amount=${amount}`
        );
        return result.convertedAmount;
      } catch {
        // Fallback to original amount
        return amount;
      }
    },
    [displayCurrency, convertSync]
  );

  // Format amount with optional conversion
  const formatWithConversion = useCallback(
    (amount: number, currency: string, options: FormatOptions = {}): FormattedAmount => {
      const {
        showConverted = displayMode === 'converted',
        compact = false,
        locale = 'fr-FR',
      } = options;

      const formatOptions: Intl.NumberFormatOptions = {
        style: 'currency',
        currency,
        minimumFractionDigits: compact ? 0 : 2,
        maximumFractionDigits: 2,
        notation: compact ? 'compact' : 'standard',
      };

      const original = new Intl.NumberFormat(locale, formatOptions).format(amount);

      let converted: string | null = null;
      let convertedAmount: number | null = null;
      let rate: number | null = null;

      if (showConverted && currency !== displayCurrency) {
        rate = getRate(currency, displayCurrency);
        if (rate !== null) {
          convertedAmount = amount * rate;
          converted = new Intl.NumberFormat(locale, {
            ...formatOptions,
            currency: displayCurrency,
          }).format(convertedAmount);
        }
      }

      return {
        original,
        converted,
        originalAmount: amount,
        convertedAmount,
        currency,
        displayCurrency,
        rate,
      };
    },
    [displayMode, displayCurrency, getRate]
  );

  // Memoized context value
  const value = useMemo<CurrencyContextValue>(
    () => ({
      displayCurrency,
      setDisplayCurrency,
      displayMode,
      setDisplayMode,
      availableCurrencies,
      workspaceCurrencies,
      convert,
      convertSync,
      getRate,
      rates,
      isLoadingRates,
      refreshRates,
      currencySummary: currencySummary ?? null,
      isLoadingSummary,
      formatWithConversion,
    }),
    [
      displayCurrency,
      setDisplayCurrency,
      displayMode,
      setDisplayMode,
      availableCurrencies,
      workspaceCurrencies,
      convert,
      convertSync,
      getRate,
      rates,
      isLoadingRates,
      refreshRates,
      currencySummary,
      isLoadingSummary,
      formatWithConversion,
    ]
  );

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}

// ----------------------------------------------------------------------------
// Utility Hook for Single Conversion
// ----------------------------------------------------------------------------

export function useConvertedAmount(
  amount: number,
  currency: string,
  targetCurrency?: string
): { converted: number | null; isLoading: boolean } {
  const { convertSync, displayCurrency, isLoadingRates } = useCurrency();
  const target = targetCurrency ?? displayCurrency;

  const converted = convertSync(amount, currency, target);

  return {
    converted,
    isLoading: isLoadingRates && converted === null,
  };
}

export default CurrencyContext;
