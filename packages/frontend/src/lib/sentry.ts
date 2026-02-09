// ============================================================================
// SENTRY INTEGRATION - Finance Hub Frontend
// Error monitoring and performance tracking
// ============================================================================

import * as Sentry from '@sentry/react';

// ----------------------------------------------------------------------------
// Initialize Sentry
// ----------------------------------------------------------------------------

export function initSentry(): void {
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
    });
  }
}

export { Sentry };
