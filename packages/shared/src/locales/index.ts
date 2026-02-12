// ============================================================================
// I18N LOCALES INDEX - Finance Hub
// Central export for all i18n utilities and translations
// ============================================================================

// Types
export * from './types.js';

// Metadata and utilities
export * from './meta.js';

// Import all English translations
import enCommon from './en/common.json' with { type: 'json' };
import enErrors from './en/errors.json' with { type: 'json' };
import enNotifications from './en/notifications.json' with { type: 'json' };
import enEmail from './en/email.json' with { type: 'json' };
import enAchievements from './en/achievements.json' with { type: 'json' };
import enFeatures from './en/features.json' with { type: 'json' };

// Import all French translations
import frCommon from './fr/common.json' with { type: 'json' };
import frErrors from './fr/errors.json' with { type: 'json' };
import frNotifications from './fr/notifications.json' with { type: 'json' };
import frEmail from './fr/email.json' with { type: 'json' };
import frAchievements from './fr/achievements.json' with { type: 'json' };
import frFeatures from './fr/features.json' with { type: 'json' };

// Import all German translations
import deCommon from './de/common.json' with { type: 'json' };
import deErrors from './de/errors.json' with { type: 'json' };
import deNotifications from './de/notifications.json' with { type: 'json' };
import deEmail from './de/email.json' with { type: 'json' };
import deAchievements from './de/achievements.json' with { type: 'json' };
import deFeatures from './de/features.json' with { type: 'json' };

// Import all Spanish translations
import esCommon from './es/common.json' with { type: 'json' };
import esErrors from './es/errors.json' with { type: 'json' };
import esNotifications from './es/notifications.json' with { type: 'json' };
import esEmail from './es/email.json' with { type: 'json' };
import esAchievements from './es/achievements.json' with { type: 'json' };
import esFeatures from './es/features.json' with { type: 'json' };

// Import all Italian translations
import itCommon from './it/common.json' with { type: 'json' };
import itErrors from './it/errors.json' with { type: 'json' };
import itNotifications from './it/notifications.json' with { type: 'json' };
import itEmail from './it/email.json' with { type: 'json' };
import itAchievements from './it/achievements.json' with { type: 'json' };
import itFeatures from './it/features.json' with { type: 'json' };

// Import all Portuguese translations
import ptCommon from './pt/common.json' with { type: 'json' };
import ptErrors from './pt/errors.json' with { type: 'json' };
import ptNotifications from './pt/notifications.json' with { type: 'json' };
import ptEmail from './pt/email.json' with { type: 'json' };
import ptAchievements from './pt/achievements.json' with { type: 'json' };
import ptFeatures from './pt/features.json' with { type: 'json' };

// Import all Dutch translations
import nlCommon from './nl/common.json' with { type: 'json' };
import nlErrors from './nl/errors.json' with { type: 'json' };
import nlNotifications from './nl/notifications.json' with { type: 'json' };
import nlEmail from './nl/email.json' with { type: 'json' };
import nlAchievements from './nl/achievements.json' with { type: 'json' };
import nlFeatures from './nl/features.json' with { type: 'json' };

// Import all Polish translations
import plCommon from './pl/common.json' with { type: 'json' };
import plErrors from './pl/errors.json' with { type: 'json' };
import plNotifications from './pl/notifications.json' with { type: 'json' };
import plEmail from './pl/email.json' with { type: 'json' };
import plAchievements from './pl/achievements.json' with { type: 'json' };
import plFeatures from './pl/features.json' with { type: 'json' };

// Import all Romanian translations
import roCommon from './ro/common.json' with { type: 'json' };
import roErrors from './ro/errors.json' with { type: 'json' };
import roNotifications from './ro/notifications.json' with { type: 'json' };
import roEmail from './ro/email.json' with { type: 'json' };
import roAchievements from './ro/achievements.json' with { type: 'json' };
import roFeatures from './ro/features.json' with { type: 'json' };

// Import all Russian translations
import ruCommon from './ru/common.json' with { type: 'json' };
import ruErrors from './ru/errors.json' with { type: 'json' };
import ruNotifications from './ru/notifications.json' with { type: 'json' };
import ruEmail from './ru/email.json' with { type: 'json' };
import ruAchievements from './ru/achievements.json' with { type: 'json' };
import ruFeatures from './ru/features.json' with { type: 'json' };

import type { LanguageCode, TranslationNamespace } from './types.js';

// ----------------------------------------------------------------------------
// Translation Resources
// ----------------------------------------------------------------------------

export const translations = {
  en: {
    common: enCommon,
    errors: enErrors,
    notifications: enNotifications,
    email: enEmail,
    achievements: enAchievements,
    features: enFeatures,
  },
  fr: {
    common: frCommon,
    errors: frErrors,
    notifications: frNotifications,
    email: frEmail,
    achievements: frAchievements,
    features: frFeatures,
  },
  de: {
    common: deCommon,
    errors: deErrors,
    notifications: deNotifications,
    email: deEmail,
    achievements: deAchievements,
    features: deFeatures,
  },
  es: {
    common: esCommon,
    errors: esErrors,
    notifications: esNotifications,
    email: esEmail,
    achievements: esAchievements,
    features: esFeatures,
  },
  it: {
    common: itCommon,
    errors: itErrors,
    notifications: itNotifications,
    email: itEmail,
    achievements: itAchievements,
    features: itFeatures,
  },
  pt: {
    common: ptCommon,
    errors: ptErrors,
    notifications: ptNotifications,
    email: ptEmail,
    achievements: ptAchievements,
    features: ptFeatures,
  },
  nl: {
    common: nlCommon,
    errors: nlErrors,
    notifications: nlNotifications,
    email: nlEmail,
    achievements: nlAchievements,
    features: nlFeatures,
  },
  pl: {
    common: plCommon,
    errors: plErrors,
    notifications: plNotifications,
    email: plEmail,
    achievements: plAchievements,
    features: plFeatures,
  },
  ro: {
    common: roCommon,
    errors: roErrors,
    notifications: roNotifications,
    email: roEmail,
    achievements: roAchievements,
    features: roFeatures,
  },
  ru: {
    common: ruCommon,
    errors: ruErrors,
    notifications: ruNotifications,
    email: ruEmail,
    achievements: ruAchievements,
    features: ruFeatures,
  },
} as const;

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Get translations for a specific language
 */
export function getTranslations(locale: LanguageCode) {
  return translations[locale];
}

/**
 * Get a specific namespace for a language
 */
export function getNamespaceTranslations(locale: LanguageCode, namespace: TranslationNamespace) {
  return translations[locale][namespace];
}

/**
 * Get a translation by key path (e.g., "common.save" or "errors.notFound")
 */
export function getTranslation(
  locale: LanguageCode,
  key: string,
  variables?: Record<string, string | number>
): string {
  const parts = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any = translations[locale];

  for (const part of parts) {
    if (result && typeof result === 'object' && part in result) {
      result = result[part];
    } else {
      // Fallback to English if key not found
      result = translations.en;
      for (const fallbackPart of parts) {
        if (result && typeof result === 'object' && fallbackPart in result) {
          result = result[fallbackPart];
        } else {
          return key; // Return the key if not found
        }
      }
      break;
    }
  }

  if (typeof result !== 'string') {
    return key;
  }

  // Replace variables {{variable}}
  if (variables) {
    return result.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
      return String(variables[varName] ?? `{{${varName}}}`);
    });
  }

  return result;
}

/**
 * Create a translation function for a specific locale
 */
export function createTranslator(locale: LanguageCode) {
  return (key: string, variables?: Record<string, string | number>) =>
    getTranslation(locale, key, variables);
}
