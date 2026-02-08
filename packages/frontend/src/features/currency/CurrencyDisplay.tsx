// ============================================================================
// CURRENCY DISPLAY - Finance Hub
// Format and display currency amounts
// ============================================================================

import { useMemo } from 'react';
import { clsx } from 'clsx';

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

  const colorClass = useMemo(() => {
    if (!colorize) return '';
    if (amount > 0) return 'text-success-600';
    if (amount < 0) return 'text-danger-600';
    return 'text-gray-600';
  }, [amount, colorize]);

  return <span className={clsx(colorClass, className)}>{formattedAmount}</span>;
}

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------

export function formatCurrency(
  amount: number,
  currency: string,
  locale?: string
): string {
  const effectiveLocale = locale ?? CURRENCY_LOCALES[currency] ?? 'fr-FR';

  try {
    return new Intl.NumberFormat(effectiveLocale, {
      style: 'currency',
      currency: currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatCompactCurrency(
  amount: number,
  currency: string,
  locale?: string
): string {
  const effectiveLocale = locale ?? CURRENCY_LOCALES[currency] ?? 'fr-FR';

  try {
    return new Intl.NumberFormat(effectiveLocale, {
      style: 'currency',
      currency: currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    if (Math.abs(amount) >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M ${currency}`;
    }
    if (Math.abs(amount) >= 1000) {
      return `${(amount / 1000).toFixed(1)}K ${currency}`;
    }
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export default CurrencyDisplay;
