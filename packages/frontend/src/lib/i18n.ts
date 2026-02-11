// ============================================================================
// I18N CONFIGURATION - Finance Hub
// Internationalization setup using i18next
// ============================================================================

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import frTranslation from '../locales/fr/translation.json';
import enTranslation from '../locales/en/translation.json';

// ----------------------------------------------------------------------------
// Resources
// ----------------------------------------------------------------------------

const resources = {
  fr: {
    translation: frTranslation,
  },
  en: {
    translation: enTranslation,
  },
};

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
    fallbackLng: 'fr', // French as default language
    supportedLngs: ['fr', 'en'],

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
// Utilities
// ----------------------------------------------------------------------------

/**
 * Get the current language code
 */
export const getCurrentLanguage = (): string => {
  return i18n.language;
};

/**
 * Change the current language
 */
export const changeLanguage = async (language: string): Promise<void> => {
  await i18n.changeLanguage(language);
};

/**
 * Get available languages
 */
export const getAvailableLanguages = (): { code: string; name: string; nativeName: string }[] => {
  return [
    { code: 'fr', name: 'French', nativeName: 'Francais' },
    { code: 'en', name: 'English', nativeName: 'English' },
  ];
};

export default i18n;
