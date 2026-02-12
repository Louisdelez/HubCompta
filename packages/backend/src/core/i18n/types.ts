// ============================================================================
// I18N TYPES - Finance Hub Backend
// TypeScript interfaces for backend internationalization
// ============================================================================

import type { LanguageCode } from '@finance-hub/shared';

// Re-export shared types
export type { LanguageCode, TranslationNamespace, LanguageMetadata } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Backend-specific types
// ----------------------------------------------------------------------------

export interface I18nConfig {
  defaultLanguage: LanguageCode;
  supportedLanguages: readonly LanguageCode[];
  fallbackLanguage: LanguageCode;
}

export interface I18nRequest {
  locale?: LanguageCode;
  user?: {
    locale?: string;
  };
  headers?: {
    'accept-language'?: string;
  };
}

export type TranslateFunction = (
  key: string,
  variables?: Record<string, string | number>
) => string;

export interface I18nContext {
  locale: LanguageCode;
  t: TranslateFunction;
}

// ----------------------------------------------------------------------------
// Fastify augmentation
// ----------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyRequest {
    locale: LanguageCode;
    t: TranslateFunction;
  }
}
