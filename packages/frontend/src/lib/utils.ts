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

interface FormatCurrencyOptions {
  compact?: boolean;
  showSymbol?: boolean;
}

/**
 * Format a number as currency
 */
export function formatCurrency(
  amount: number,
  currency: string = 'EUR',
  options: FormatCurrencyOptions = {}
): string {
  const { compact = false, showSymbol = true } = options;

  const formatter = new Intl.NumberFormat('fr-FR', {
    style: showSymbol ? 'currency' : 'decimal',
    currency,
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: 2,
    notation: compact ? 'compact' : 'standard',
  });

  return formatter.format(amount);
}

// ----------------------------------------------------------------------------
// Number Formatting
// ----------------------------------------------------------------------------

/**
 * Format a number with locale-specific formatting
 */
export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {}
): string {
  const formatter = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
    ...options,
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
 * Format a date string
 */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('fr-FR', options).format(dateObj);
}

/**
 * Format a date as relative time (e.g., "il y a 2 heures")
 */
export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return "à l'instant";
  } else if (diffMin < 60) {
    return `il y a ${diffMin} minute${diffMin > 1 ? 's' : ''}`;
  } else if (diffHour < 24) {
    return `il y a ${diffHour} heure${diffHour > 1 ? 's' : ''}`;
  } else if (diffDay < 7) {
    return `il y a ${diffDay} jour${diffDay > 1 ? 's' : ''}`;
  } else {
    return formatDate(dateObj);
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
 * Check if a string is a valid SIRET number
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
