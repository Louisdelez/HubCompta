// ============================================================================
// I18N MODULE - Finance Hub Backend
// Internationalization support for backend services
// ============================================================================

import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  getTranslation,
  createTranslator,
  parseAcceptLanguage,
  isLanguageSupported,
  getLanguageMetadata,
  getAvailableLanguages,
} from '@finance-hub/shared';
import type { LanguageCode } from '@finance-hub/shared';
import type { I18nConfig, TranslateFunction, I18nContext } from './types.js';

// Re-export types
export * from './types.js';

// Re-export shared utilities
export {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  getTranslation,
  createTranslator,
  parseAcceptLanguage,
  isLanguageSupported,
  getLanguageMetadata,
  getAvailableLanguages,
};

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const config: I18nConfig = {
  defaultLanguage: DEFAULT_LANGUAGE,
  supportedLanguages: SUPPORTED_LANGUAGES,
  fallbackLanguage: FALLBACK_LANGUAGE,
};

/**
 * Get the i18n configuration
 */
export function getI18nConfig(): I18nConfig {
  return config;
}

// ----------------------------------------------------------------------------
// Locale Detection
// ----------------------------------------------------------------------------

/**
 * Detect the best locale from various sources
 * Priority: user preference > accept-language header > default
 */
export function detectLocale(
  userLocale?: string | null,
  acceptLanguageHeader?: string
): LanguageCode {
  // 1. User preference (from database)
  if (userLocale && isLanguageSupported(userLocale)) {
    return userLocale as LanguageCode;
  }

  // 2. Accept-Language header
  if (acceptLanguageHeader) {
    const detected = parseAcceptLanguage(acceptLanguageHeader, config.defaultLanguage);
    if (isLanguageSupported(detected)) {
      return detected;
    }
  }

  // 3. Default
  return config.defaultLanguage;
}

// ----------------------------------------------------------------------------
// Translation Helpers
// ----------------------------------------------------------------------------

/**
 * Create an i18n context for a specific locale
 */
export function createI18nContext(locale: LanguageCode): I18nContext {
  return {
    locale,
    t: createTranslator(locale),
  };
}

/**
 * Get a translation with optional variable replacement
 */
export function t(locale: LanguageCode, key: string, variables?: Record<string, string | number>): string {
  return getTranslation(locale, key, variables);
}

/**
 * Get error message translated
 */
export function getErrorMessage(locale: LanguageCode, errorKey: string, variables?: Record<string, string | number>): string {
  return getTranslation(locale, `errors.${errorKey}`, variables);
}

/**
 * Get notification message translated
 */
export function getNotificationMessage(locale: LanguageCode, notificationKey: string, variables?: Record<string, string | number>): string {
  return getTranslation(locale, `notifications.${notificationKey}`, variables);
}

/**
 * Get email template string translated
 */
export function getEmailString(locale: LanguageCode, emailKey: string, variables?: Record<string, string | number>): string {
  return getTranslation(locale, `email.${emailKey}`, variables);
}

/**
 * Get achievement string translated
 */
export function getAchievementString(locale: LanguageCode, achievementKey: string, variables?: Record<string, string | number>): string {
  return getTranslation(locale, `achievements.${achievementKey}`, variables);
}

// ----------------------------------------------------------------------------
// Pluralization Helper
// ----------------------------------------------------------------------------

/**
 * Get pluralized translation
 * Looks for keys: key_zero, key_one, key_other (or key_plural)
 */
export function tPlural(
  locale: LanguageCode,
  key: string,
  count: number,
  variables?: Record<string, string | number>
): string {
  const allVars = { ...variables, count };

  if (count === 0) {
    const zeroKey = `${key}_zero`;
    const zeroResult = getTranslation(locale, zeroKey, allVars);
    if (zeroResult !== zeroKey) {
      return zeroResult;
    }
  }

  if (count === 1) {
    const oneKey = `${key}_one`;
    const oneResult = getTranslation(locale, oneKey, allVars);
    if (oneResult !== oneKey) {
      return oneResult;
    }
    // Fallback to base key
    return getTranslation(locale, key, allVars);
  }

  // count > 1: try _other, then _plural, then base
  const otherKey = `${key}_other`;
  const otherResult = getTranslation(locale, otherKey, allVars);
  if (otherResult !== otherKey) {
    return otherResult;
  }

  const pluralKey = `${key}_plural`;
  const pluralResult = getTranslation(locale, pluralKey, allVars);
  if (pluralResult !== pluralKey) {
    return pluralResult;
  }

  return getTranslation(locale, key, allVars);
}

// ----------------------------------------------------------------------------
// Date/Number Formatting Helpers
// ----------------------------------------------------------------------------

/**
 * Format a date according to locale
 */
export function formatDate(date: Date, locale: LanguageCode): string {
  const meta = getLanguageMetadata(locale);
  const format = meta.dateFormat;

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString();

  return format
    .replace('DD', day)
    .replace('MM', month)
    .replace('YYYY', year);
}

/**
 * Format a number according to locale
 */
export function formatNumber(value: number, locale: LanguageCode, decimals: number = 2): string {
  const meta = getLanguageMetadata(locale);
  const { decimal, thousands } = meta.numberFormat;

  const fixed = value.toFixed(decimals);
  const parts = fixed.split('.');
  const intPart = parts[0] ?? '0';
  const decPart = parts[1];
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);

  return decPart ? `${formattedInt}${decimal}${decPart}` : formattedInt;
}

/**
 * Format currency according to locale
 */
export function formatCurrency(value: number, locale: LanguageCode, currency: string = 'EUR'): string {
  const formatted = formatNumber(value, locale, 2);

  // Currency symbol placement varies by locale
  // For simplicity, we'll put the symbol after for European locales
  return `${formatted} ${currency}`;
}
