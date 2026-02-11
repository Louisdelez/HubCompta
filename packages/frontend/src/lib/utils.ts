// ============================================================================
// UTILITY FUNCTIONS - Finance Hub
// ============================================================================

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ----------------------------------------------------------------------------
// Class Names
// ----------------------------------------------------------------------------

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ----------------------------------------------------------------------------
// Currency Formatting
// ----------------------------------------------------------------------------

/** Default locale for each currency (used when user locale not available) */
const CURRENCY_LOCALES: Record<string, string> = {
  EUR: 'fr-FR',
  USD: 'en-US',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  CHF: 'de-CH',
  CAD: 'en-CA',
  AUD: 'en-AU',
};

/** Country-specific formatting preferences */
const COUNTRY_LOCALES: Record<string, string> = {
  FR: 'fr-FR',
  CH: 'de-CH',
};

/**
 * Get the appropriate locale for formatting based on user preferences
 */
export function getFormattingLocale(
  userLocale?: string,
  userCountry?: string,
  currency?: string
): string {
  // Priority: user locale > country default > currency default > fallback
  if (userLocale) return userLocale;
  if (userCountry && COUNTRY_LOCALES[userCountry]) return COUNTRY_LOCALES[userCountry];
  if (currency && CURRENCY_LOCALES[currency]) return CURRENCY_LOCALES[currency];
  return 'fr-FR';
}

interface FormatCurrencyOptions {
  compact?: boolean;
  showSymbol?: boolean;
  showSign?: boolean;
  locale?: string;
}

/**
 * Format a number as currency
 */
export function formatCurrency(
  amount: number,
  currency: string = 'EUR',
  options: FormatCurrencyOptions = {}
): string {
  const { compact = false, showSymbol = true, showSign = false, locale } = options;
  const effectiveLocale = locale ?? CURRENCY_LOCALES[currency] ?? 'fr-FR';

  const formatter = new Intl.NumberFormat(effectiveLocale, {
    style: showSymbol ? 'currency' : 'decimal',
    currency,
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: 2,
    notation: compact ? 'compact' : 'standard',
    signDisplay: showSign ? 'always' : 'auto',
  });

  return formatter.format(amount);
}

/**
 * Format currency with both original and converted amounts
 */
export function formatCurrencyWithConversion(
  amount: number,
  currency: string,
  convertedAmount: number,
  convertedCurrency: string,
  options: FormatCurrencyOptions = {}
): { original: string; converted: string; combined: string } {
  const original = formatCurrency(amount, currency, options);
  const converted = formatCurrency(convertedAmount, convertedCurrency, options);
  return {
    original,
    converted,
    combined: `${original} (${converted})`,
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
    return formatted.replace(/[\d.,\s]/g, '').trim();
  } catch {
    return currency;
  }
}

// ----------------------------------------------------------------------------
// Number Formatting
// ----------------------------------------------------------------------------

/**
 * Format a number with locale-specific formatting
 */
export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions & { locale?: string } = {}
): string {
  const { locale = 'fr-FR', ...numberOptions } = options;
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
    ...numberOptions,
  });

  return formatter.format(value);
}

/**
 * Format a percentage
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value >= 0 ? '' : ''}${value.toFixed(decimals)}%`;
}

// ----------------------------------------------------------------------------
// Date Formatting
// ----------------------------------------------------------------------------

/**
 * Format a date string with optional locale
 */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions & { locale?: string } = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
): string {
  const { locale = 'fr-FR', ...dateOptions } = options;
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, dateOptions).format(dateObj);
}

/**
 * Format a date as relative time using Intl.RelativeTimeFormat
 */
export function formatRelativeTime(date: string | Date, locale = 'fr-FR'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffSec < 60) {
    return rtf.format(-diffSec, 'second');
  } else if (diffMin < 60) {
    return rtf.format(-diffMin, 'minute');
  } else if (diffHour < 24) {
    return rtf.format(-diffHour, 'hour');
  } else if (diffDay < 7) {
    return rtf.format(-diffDay, 'day');
  } else {
    return formatDate(dateObj, { locale });
  }
}

// ----------------------------------------------------------------------------
// String Utilities
// ----------------------------------------------------------------------------

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalize the first letter of a string
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ----------------------------------------------------------------------------
// Validation Utilities
// ----------------------------------------------------------------------------

/**
 * Check if a string is a valid email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if a string is a valid SIRET number (France)
 */
export function isValidSiret(siret: string): boolean {
  const cleaned = siret.replace(/\s/g, '');
  if (!/^\d{14}$/.test(cleaned)) return false;

  // Luhn algorithm check
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const char = cleaned[i];
    if (char === undefined) return false;
    let digit = parseInt(char, 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  return sum % 10 === 0;
}

/**
 * Check if a string is a valid Swiss UID
 * Format: CHE-XXX.XXX.XXX or CHE XXX XXX XXX
 */
export function isValidSwissUid(uid: string): boolean {
  const cleaned = uid.replace(/[\s.-]/g, '').toUpperCase();
  if (!/^CHE\d{9}$/.test(cleaned)) return false;

  const digits = cleaned.slice(3);
  const weights = [5, 4, 3, 2, 7, 6, 5, 4];
  let sum = 0;

  for (let i = 0; i < 8; i++) {
    const char = digits[i];
    if (!char) return false;
    sum += parseInt(char, 10) * (weights[i] ?? 0);
  }

  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 0 : 11 - remainder;
  if (checkDigit === 10) return false;

  const lastDigit = digits[8];
  return lastDigit !== undefined && parseInt(lastDigit, 10) === checkDigit;
}

/**
 * Validate business ID based on country
 */
export function isValidBusinessId(id: string, countryCode: 'FR' | 'CH'): boolean {
  switch (countryCode) {
    case 'FR':
      return isValidSiret(id);
    case 'CH':
      return isValidSwissUid(id);
    default:
      return true;
  }
}

// ----------------------------------------------------------------------------
// Array Utilities
// ----------------------------------------------------------------------------

/**
 * Group an array by a key
 */
export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce(
    (acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    },
    {} as Record<K, T[]>
  );
}

/**
 * Remove duplicates from an array
 */
export function unique<T>(array: T[], keyFn?: (item: T) => string | number): T[] {
  if (!keyFn) {
    return [...new Set(array)];
  }

  const seen = new Set<string | number>();
  return array.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ----------------------------------------------------------------------------
// Color Utilities
// ----------------------------------------------------------------------------

/**
 * Get a color for a given index (for charts)
 */
export function getChartColor(index: number): string {
  const colors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#14B8A6', // teal
    '#6366F1', // indigo
    '#84CC16', // lime
    '#F97316', // orange
  ] as const;
  return colors[index % colors.length] ?? colors[0];
}
