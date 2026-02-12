// ============================================================================
// I18N METADATA - Finance Hub
// Language metadata and configuration
// ============================================================================

import type { LanguageCode, LanguageMetadata } from './types.js';

// ----------------------------------------------------------------------------
// Language Metadata Definitions
// ----------------------------------------------------------------------------

export const LANGUAGE_METADATA: Record<LanguageCode, LanguageMetadata> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
    region: 'western',
    flag: '🇬🇧',
    dateFormat: 'MM/DD/YYYY',
    numberFormat: {
      decimal: '.',
      thousands: ',',
    },
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Francais',
    direction: 'ltr',
    region: 'western',
    flag: '🇫🇷',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: {
      decimal: ',',
      thousands: ' ',
    },
  },
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    direction: 'ltr',
    region: 'western',
    flag: '🇩🇪',
    dateFormat: 'DD.MM.YYYY',
    numberFormat: {
      decimal: ',',
      thousands: '.',
    },
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Espanol',
    direction: 'ltr',
    region: 'southern',
    flag: '🇪🇸',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: {
      decimal: ',',
      thousands: '.',
    },
  },
  it: {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    direction: 'ltr',
    region: 'southern',
    flag: '🇮🇹',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: {
      decimal: ',',
      thousands: '.',
    },
  },
  pt: {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Portugues',
    direction: 'ltr',
    region: 'southern',
    flag: '🇵🇹',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: {
      decimal: ',',
      thousands: '.',
    },
  },
  nl: {
    code: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    direction: 'ltr',
    region: 'western',
    flag: '🇳🇱',
    dateFormat: 'DD-MM-YYYY',
    numberFormat: {
      decimal: ',',
      thousands: '.',
    },
  },
  pl: {
    code: 'pl',
    name: 'Polish',
    nativeName: 'Polski',
    direction: 'ltr',
    region: 'eastern',
    flag: '🇵🇱',
    dateFormat: 'DD.MM.YYYY',
    numberFormat: {
      decimal: ',',
      thousands: ' ',
    },
  },
  ro: {
    code: 'ro',
    name: 'Romanian',
    nativeName: 'Romana',
    direction: 'ltr',
    region: 'eastern',
    flag: '🇷🇴',
    dateFormat: 'DD.MM.YYYY',
    numberFormat: {
      decimal: ',',
      thousands: '.',
    },
  },
  ru: {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Russkij',
    direction: 'ltr',
    region: 'eastern',
    flag: '🇷🇺',
    dateFormat: 'DD.MM.YYYY',
    numberFormat: {
      decimal: ',',
      thousands: ' ',
    },
  },
};

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Get language metadata by code
 */
export function getLanguageMetadata(code: LanguageCode): LanguageMetadata {
  return LANGUAGE_METADATA[code];
}

/**
 * Get all languages for a specific region
 */
export function getLanguagesByRegion(region: LanguageMetadata['region']): LanguageMetadata[] {
  return Object.values(LANGUAGE_METADATA).filter((lang) => lang.region === region);
}

/**
 * Get languages grouped by region
 */
export function getLanguagesGroupedByRegion(): Record<LanguageMetadata['region'], LanguageMetadata[]> {
  return {
    western: getLanguagesByRegion('western'),
    eastern: getLanguagesByRegion('eastern'),
    northern: getLanguagesByRegion('northern'),
    southern: getLanguagesByRegion('southern'),
  };
}

/**
 * Get all available languages as array
 */
export function getAvailableLanguages(): LanguageMetadata[] {
  return Object.values(LANGUAGE_METADATA);
}

/**
 * Check if a language code is supported
 */
export function isLanguageSupported(code: string): code is LanguageCode {
  return code in LANGUAGE_METADATA;
}

/**
 * Parse Accept-Language header and return best matching language
 */
export function parseAcceptLanguage(header: string | undefined, defaultLang: LanguageCode = 'en'): LanguageCode {
  if (!header) {
    return defaultLang;
  }

  // Parse header: "en-US,en;q=0.9,fr;q=0.8"
  const languages = header
    .split(',')
    .map((lang) => {
      const parts = lang.trim().split(';q=');
      const codePart = parts[0] ?? '';
      const qStr = parts[1];
      const q = qStr ? parseFloat(qStr) : 1;
      const langCode = codePart.split('-')[0]?.toLowerCase() ?? '';
      return { code: langCode, q };
    })
    .sort((a, b) => b.q - a.q);

  // Find first matching supported language
  for (const item of languages) {
    if (item.code && isLanguageSupported(item.code)) {
      return item.code;
    }
  }

  return defaultLang;
}

/**
 * Format number according to language settings
 */
export function formatNumberByLocale(value: number, locale: LanguageCode): string {
  const { decimal, thousands } = LANGUAGE_METADATA[locale].numberFormat;
  const parts = value.toFixed(2).split('.');
  const intPart = parts[0] ?? '0';
  const decPart = parts[1] ?? '00';
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  return `${formattedInt}${decimal}${decPart}`;
}

/**
 * Get date format pattern for a language
 */
export function getDateFormat(locale: LanguageCode): string {
  return LANGUAGE_METADATA[locale].dateFormat;
}
