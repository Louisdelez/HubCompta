// ============================================================================
// I18N MIDDLEWARE - Finance Hub Backend
// Fastify plugin for automatic locale detection and translation
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { detectLocale, createTranslator, DEFAULT_LANGUAGE } from './index.js';
import type { LanguageCode } from './types.js';

// ----------------------------------------------------------------------------
// Plugin Options
// ----------------------------------------------------------------------------

export interface I18nPluginOptions {
  /**
   * Header name for locale override
   * @default 'X-Locale'
   */
  localeHeader?: string;

  /**
   * Query parameter name for locale override
   * @default 'lang'
   */
  localeQueryParam?: string;

  /**
   * Default locale if none detected
   * @default 'en'
   */
  defaultLocale?: LanguageCode;
}

// ----------------------------------------------------------------------------
// Plugin Implementation
// ----------------------------------------------------------------------------

async function i18nPlugin(
  fastify: FastifyInstance,
  options: I18nPluginOptions
): Promise<void> {
  const {
    localeHeader = 'X-Locale',
    localeQueryParam = 'lang',
    defaultLocale = DEFAULT_LANGUAGE,
  } = options;

  // Decorate request with locale and t function
  fastify.decorateRequest('locale', defaultLocale);
  fastify.decorateRequest('t', (key: string, _variables?: Record<string, string | number>) => key);

  // Add hook to detect locale on each request
  fastify.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Priority order:
    // 1. Query parameter (?lang=fr)
    // 2. Custom header (X-Locale: fr)
    // 3. User preference from JWT (user.locale)
    // 4. Accept-Language header
    // 5. Default locale

    let locale: LanguageCode = defaultLocale;

    // 1. Query parameter
    const queryLocale = (request.query as Record<string, string>)?.[localeQueryParam];
    if (queryLocale) {
      locale = detectLocale(queryLocale);
    }
    // 2. Custom header
    else if (request.headers[localeHeader.toLowerCase()]) {
      locale = detectLocale(request.headers[localeHeader.toLowerCase()] as string);
    }
    // 3. User preference from JWT
    else if ((request.user as { locale?: string })?.locale) {
      locale = detectLocale((request.user as { locale?: string }).locale);
    }
    // 4. Accept-Language header
    else if (request.headers['accept-language']) {
      locale = detectLocale(undefined, request.headers['accept-language']);
    }

    // Set locale and translator on request
    request.locale = locale;
    request.t = createTranslator(locale);
  });
}

// Export as Fastify plugin
export default fp(i18nPlugin, {
  name: 'i18n',
  fastify: '5.x',
});

// Also export the raw function for testing
export { i18nPlugin };
