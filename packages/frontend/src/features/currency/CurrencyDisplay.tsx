// ============================================================================
// CURRENCY DISPLAY - Finance Hub
// Smart display component for currency amounts with conversion support
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useMemo } from 'react';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Minus, ArrowRightLeft } from 'lucide-react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface CurrencyDisplayProps {
  amount: number;
  currency: string;
  locale?: string;
  showSign?: boolean;
  colorize?: boolean;
  compact?: boolean;
  className?: string;
  // New props for multi-currency support
  convertedAmount?: number;
  convertedCurrency?: string;
  showBoth?: boolean;
  showConvertedOnly?: boolean;
  showTrend?: boolean;
  previousAmount?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const CURRENCY_LOCALES: Record<string, string> = {
  EUR: 'fr-FR',
  USD: 'en-US',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  CHF: 'de-CH',
  CAD: 'en-CA',
  AUD: 'en-AU',
};

const SIZE_CLASSES = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-2xl font-bold',
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function CurrencyDisplay({
  amount,
  currency,
  locale,
  showSign = false,
  colorize = false,
  compact = false,
  className = '',
  convertedAmount,
  convertedCurrency,
  showBoth = false,
  showConvertedOnly = false,
  showTrend = false,
  previousAmount,
  size = 'md',
}: CurrencyDisplayProps) {
  const formattedAmount = useMemo(() => {
    const effectiveLocale = locale ?? CURRENCY_LOCALES[currency] ?? 'fr-FR';

    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: currency,
      signDisplay: showSign ? 'always' : 'auto',
    };

    if (compact && Math.abs(amount) >= 1000) {
      options.notation = 'compact';
      options.maximumFractionDigits = 1;
    }

    try {
      return new Intl.NumberFormat(effectiveLocale, options).format(amount);
    } catch {
      // Fallback for unsupported currencies
      return `${amount.toFixed(2)} ${currency}`;
    }
  }, [amount, currency, locale, showSign, compact]);

  const formattedConverted = useMemo(() => {
    if (convertedAmount === undefined || !convertedCurrency) return null;

    const effectiveLocale = locale ?? CURRENCY_LOCALES[convertedCurrency] ?? 'fr-FR';

    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: convertedCurrency,
      signDisplay: showSign ? 'always' : 'auto',
    };

    if (compact && Math.abs(convertedAmount) >= 1000) {
      options.notation = 'compact';
      options.maximumFractionDigits = 1;
    }

    try {
      return new Intl.NumberFormat(effectiveLocale, options).format(convertedAmount);
    } catch {
      return `${convertedAmount.toFixed(2)} ${convertedCurrency}`;
    }
  }, [convertedAmount, convertedCurrency, locale, showSign, compact]);

  const colorClass = useMemo(() => {
    if (!colorize) return '';
    if (amount > 0) return 'text-ctp-green';
    if (amount < 0) return 'text-ctp-red';
    return 'text-ctp-subtext0';
  }, [amount, colorize]);

  const trend = useMemo(() => {
    if (!showTrend || previousAmount === undefined) return null;
    const change = amount - previousAmount;
    const percentChange = previousAmount !== 0 ? (change / Math.abs(previousAmount)) * 100 : 0;
    return {
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
      percent: Math.abs(percentChange),
    };
  }, [showTrend, amount, previousAmount]);

  const TrendIcon = trend
    ? trend.direction === 'up'
      ? TrendingUp
      : trend.direction === 'down'
      ? TrendingDown
      : Minus
    : null;

  // Show only converted amount
  if (showConvertedOnly && formattedConverted) {
    return (
      <span className={clsx(SIZE_CLASSES[size], colorClass, className)}>
        {formattedConverted}
      </span>
    );
  }

  // Show both original and converted
  if (showBoth && formattedConverted) {
    return (
      <span className={clsx('inline-flex items-center gap-1.5', className)}>
        <span className={clsx(SIZE_CLASSES[size], colorClass)}>
          {formattedAmount}
        </span>
        <ArrowRightLeft className="w-3 h-3 text-ctp-overlay1" />
        <span className={clsx(SIZE_CLASSES[size], 'text-ctp-subtext0')}>
          {formattedConverted}
        </span>
        {trend && TrendIcon && (
          <span
            className={clsx(
              'inline-flex items-center gap-0.5 text-xs',
              trend.direction === 'up' && 'text-ctp-green',
              trend.direction === 'down' && 'text-ctp-red',
              trend.direction === 'neutral' && 'text-ctp-subtext0'
            )}
          >
            <TrendIcon className="w-3 h-3" />
            {trend.percent.toFixed(1)}%
          </span>
        )}
      </span>
    );
  }

  // Show original with optional trend
  return (
    <span className={clsx('inline-flex items-center gap-1.5', className)}>
      <span className={clsx(SIZE_CLASSES[size], colorClass)}>
        {formattedAmount}
      </span>
      {trend && TrendIcon && (
        <span
          className={clsx(
            'inline-flex items-center gap-0.5 text-xs',
            trend.direction === 'up' && 'text-ctp-green',
            trend.direction === 'down' && 'text-ctp-red',
            trend.direction === 'neutral' && 'text-ctp-subtext0'
          )}
        >
          <TrendIcon className="w-3 h-3" />
          {trend.percent.toFixed(1)}%
        </span>
      )}
    </span>
  );
}

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------

export interface FormatCurrencyOptions {
  locale?: string;
  showSign?: boolean;
  compact?: boolean;
  showSymbol?: boolean;
}

export function formatCurrency(
  amount: number,
  currency: string,
  options: FormatCurrencyOptions = {}
): string {
  const { locale, showSign = false, compact = false, showSymbol = true } = options;
  const effectiveLocale = locale ?? CURRENCY_LOCALES[currency] ?? 'fr-FR';

  const formatOptions: Intl.NumberFormatOptions = {
    style: showSymbol ? 'currency' : 'decimal',
    currency: currency,
    signDisplay: showSign ? 'always' : 'auto',
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: 2,
  };

  if (compact && Math.abs(amount) >= 1000) {
    formatOptions.notation = 'compact';
    formatOptions.maximumFractionDigits = 1;
  }

  try {
    return new Intl.NumberFormat(effectiveLocale, formatOptions).format(amount);
  } catch {
    return showSymbol ? `${amount.toFixed(2)} ${currency}` : amount.toFixed(2);
  }
}

export function formatCompactCurrency(
  amount: number,
  currency: string,
  locale?: string
): string {
  const options: FormatCurrencyOptions = { compact: true };
  if (locale) {
    options.locale = locale;
  }
  return formatCurrency(amount, currency, options);
}

/**
 * Format amount with both original and converted values
 */
export function formatWithConversion(
  amount: number,
  currency: string,
  convertedAmount: number,
  convertedCurrency: string,
  options: FormatCurrencyOptions = {}
): { original: string; converted: string } {
  return {
    original: formatCurrency(amount, currency, options),
    converted: formatCurrency(convertedAmount, convertedCurrency, options),
  };
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: string, locale = 'fr-FR'): string {
  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(0);
    // Extract just the symbol
    return formatted.replace(/[\d.,\s]/g, '').trim();
  } catch {
    return currency;
  }
}

export default CurrencyDisplay;
