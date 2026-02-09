// ============================================================================
// SENTRY INTEGRATION - Finance Hub Backend
// Error monitoring and performance tracking
// ============================================================================

import * as Sentry from '@sentry/node';

// ----------------------------------------------------------------------------
// Initialize Sentry
// ----------------------------------------------------------------------------

export function initSentry(): void {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
  }
}

export { Sentry };
