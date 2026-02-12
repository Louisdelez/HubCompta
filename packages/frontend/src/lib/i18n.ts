// ============================================================================
// I18N CONFIGURATION - Finance Hub
// Internationalization setup using i18next with 10 language support
// ============================================================================

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all translation files from shared package
// English
import enCommon from '@finance-hub/shared/src/locales/en/common.json';
import enErrors from '@finance-hub/shared/src/locales/en/errors.json';
import enNotifications from '@finance-hub/shared/src/locales/en/notifications.json';
import enAchievements from '@finance-hub/shared/src/locales/en/achievements.json';
import enFeatures from '@finance-hub/shared/src/locales/en/features.json';

// French
import frCommon from '@finance-hub/shared/src/locales/fr/common.json';
import frErrors from '@finance-hub/shared/src/locales/fr/errors.json';
import frNotifications from '@finance-hub/shared/src/locales/fr/notifications.json';
import frAchievements from '@finance-hub/shared/src/locales/fr/achievements.json';
import frFeatures from '@finance-hub/shared/src/locales/fr/features.json';

// German
import deCommon from '@finance-hub/shared/src/locales/de/common.json';
import deErrors from '@finance-hub/shared/src/locales/de/errors.json';
import deNotifications from '@finance-hub/shared/src/locales/de/notifications.json';
import deAchievements from '@finance-hub/shared/src/locales/de/achievements.json';
import deFeatures from '@finance-hub/shared/src/locales/de/features.json';

// Spanish
import esCommon from '@finance-hub/shared/src/locales/es/common.json';
import esErrors from '@finance-hub/shared/src/locales/es/errors.json';
import esNotifications from '@finance-hub/shared/src/locales/es/notifications.json';
import esAchievements from '@finance-hub/shared/src/locales/es/achievements.json';
import esFeatures from '@finance-hub/shared/src/locales/es/features.json';

// Italian
import itCommon from '@finance-hub/shared/src/locales/it/common.json';
import itErrors from '@finance-hub/shared/src/locales/it/errors.json';
import itNotifications from '@finance-hub/shared/src/locales/it/notifications.json';
import itAchievements from '@finance-hub/shared/src/locales/it/achievements.json';
import itFeatures from '@finance-hub/shared/src/locales/it/features.json';

// Portuguese
import ptCommon from '@finance-hub/shared/src/locales/pt/common.json';
import ptErrors from '@finance-hub/shared/src/locales/pt/errors.json';
import ptNotifications from '@finance-hub/shared/src/locales/pt/notifications.json';
import ptAchievements from '@finance-hub/shared/src/locales/pt/achievements.json';
import ptFeatures from '@finance-hub/shared/src/locales/pt/features.json';

// Dutch
import nlCommon from '@finance-hub/shared/src/locales/nl/common.json';
import nlErrors from '@finance-hub/shared/src/locales/nl/errors.json';
import nlNotifications from '@finance-hub/shared/src/locales/nl/notifications.json';
import nlAchievements from '@finance-hub/shared/src/locales/nl/achievements.json';
import nlFeatures from '@finance-hub/shared/src/locales/nl/features.json';

// Polish
import plCommon from '@finance-hub/shared/src/locales/pl/common.json';
import plErrors from '@finance-hub/shared/src/locales/pl/errors.json';
import plNotifications from '@finance-hub/shared/src/locales/pl/notifications.json';
import plAchievements from '@finance-hub/shared/src/locales/pl/achievements.json';
import plFeatures from '@finance-hub/shared/src/locales/pl/features.json';

// Romanian
import roCommon from '@finance-hub/shared/src/locales/ro/common.json';
import roErrors from '@finance-hub/shared/src/locales/ro/errors.json';
import roNotifications from '@finance-hub/shared/src/locales/ro/notifications.json';
import roAchievements from '@finance-hub/shared/src/locales/ro/achievements.json';
import roFeatures from '@finance-hub/shared/src/locales/ro/features.json';

// Russian
import ruCommon from '@finance-hub/shared/src/locales/ru/common.json';
import ruErrors from '@finance-hub/shared/src/locales/ru/errors.json';
import ruNotifications from '@finance-hub/shared/src/locales/ru/notifications.json';
import ruAchievements from '@finance-hub/shared/src/locales/ru/achievements.json';
import ruFeatures from '@finance-hub/shared/src/locales/ru/features.json';

// ----------------------------------------------------------------------------
// Merge translations into single namespace per language
// ----------------------------------------------------------------------------

function mergeTranslations(...objects: Record<string, unknown>[]): Record<string, unknown> {
  return objects.reduce((acc, obj) => ({ ...acc, ...obj }), {});
}

// ----------------------------------------------------------------------------
// Resources
// ----------------------------------------------------------------------------

const resources = {
  en: {
    translation: mergeTranslations(enCommon, enErrors, enNotifications, enAchievements, enFeatures),
  },
  fr: {
    translation: mergeTranslations(frCommon, frErrors, frNotifications, frAchievements, frFeatures),
  },
  de: {
    translation: mergeTranslations(deCommon, deErrors, deNotifications, deAchievements, deFeatures),
  },
  es: {
    translation: mergeTranslations(esCommon, esErrors, esNotifications, esAchievements, esFeatures),
  },
  it: {
    translation: mergeTranslations(itCommon, itErrors, itNotifications, itAchievements, itFeatures),
  },
  pt: {
    translation: mergeTranslations(ptCommon, ptErrors, ptNotifications, ptAchievements, ptFeatures),
  },
  nl: {
    translation: mergeTranslations(nlCommon, nlErrors, nlNotifications, nlAchievements, nlFeatures),
  },
  pl: {
    translation: mergeTranslations(plCommon, plErrors, plNotifications, plAchievements, plFeatures),
  },
  ro: {
    translation: mergeTranslations(roCommon, roErrors, roNotifications, roAchievements, roFeatures),
  },
  ru: {
    translation: mergeTranslations(ruCommon, ruErrors, ruNotifications, ruAchievements, ruFeatures),
  },
};

// ----------------------------------------------------------------------------
// Supported Languages
// ----------------------------------------------------------------------------

export type LanguageCode = 'en' | 'fr' | 'de' | 'es' | 'it' | 'pt' | 'nl' | 'pl' | 'ro' | 'ru';

export const SUPPORTED_LANGUAGES: LanguageCode[] = ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'pl', 'ro', 'ru'];

// ----------------------------------------------------------------------------
// Initialize i18n
// ----------------------------------------------------------------------------

void i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    resources,
    fallbackLng: 'en', // English as fallback
    supportedLngs: SUPPORTED_LANGUAGES,

    // Language detection options
    detection: {
      // Order of language detection
      order: ['localStorage', 'navigator', 'htmlTag'],
      // Keys used to store language choice
      lookupLocalStorage: 'finance-hub-language',
      // Cache user language selection
      caches: ['localStorage'],
    },

    interpolation: {
      // React already escapes values
      escapeValue: false,
    },

    // React specific options
    react: {
      useSuspense: true,
    },
  });

// ----------------------------------------------------------------------------
// Language Metadata
// ----------------------------------------------------------------------------

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  region: 'western' | 'eastern' | 'southern';
}

const languageMetadata: Record<LanguageCode, LanguageInfo> = {
  en: { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', region: 'western' },
  fr: { code: 'fr', name: 'French', nativeName: 'Francais', flag: '🇫🇷', region: 'western' },
  de: { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', region: 'western' },
  es: { code: 'es', name: 'Spanish', nativeName: 'Espanol', flag: '🇪🇸', region: 'southern' },
  it: { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', region: 'southern' },
  pt: { code: 'pt', name: 'Portuguese', nativeName: 'Portugues', flag: '🇵🇹', region: 'southern' },
  nl: { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', region: 'western' },
  pl: { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', region: 'eastern' },
  ro: { code: 'ro', name: 'Romanian', nativeName: 'Romana', flag: '🇷🇴', region: 'eastern' },
  ru: { code: 'ru', name: 'Russian', nativeName: 'Russkij', flag: '🇷🇺', region: 'eastern' },
};

// ----------------------------------------------------------------------------
// Utilities
// ----------------------------------------------------------------------------

/**
 * Get the current language code
 */
export const getCurrentLanguage = (): LanguageCode => {
  const lang = i18n.language?.split('-')[0] as LanguageCode;
  return SUPPORTED_LANGUAGES.includes(lang) ? lang : 'en';
};

/**
 * Change the current language
 */
export const changeLanguage = async (language: LanguageCode): Promise<void> => {
  await i18n.changeLanguage(language);
};

/**
 * Get available languages (simple list)
 */
export const getAvailableLanguages = (): LanguageInfo[] => {
  return SUPPORTED_LANGUAGES.map(code => languageMetadata[code]);
};

/**
 * Get language info by code
 */
export const getLanguageInfo = (code: LanguageCode): LanguageInfo => {
  return languageMetadata[code];
};

/**
 * Get languages grouped by region
 */
export const getLanguagesByRegion = (): Record<string, LanguageInfo[]> => {
  const grouped: Record<string, LanguageInfo[]> = {
    western: [],
    southern: [],
    eastern: [],
  };

  for (const lang of Object.values(languageMetadata)) {
    const regionArray = grouped[lang.region];
    if (regionArray) {
      regionArray.push(lang);
    }
  }

  return grouped;
};

/**
 * Check if a language is supported
 */
export const isLanguageSupported = (code: string): code is LanguageCode => {
  return SUPPORTED_LANGUAGES.includes(code as LanguageCode);
};

export default i18n;
