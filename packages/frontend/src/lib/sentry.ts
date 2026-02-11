// ============================================================================
// SENTRY INTEGRATION - Finance Hub Frontend
// Error monitoring and performance tracking
// ============================================================================

import * as Sentry from '@sentry/react';
import type { Breadcrumb } from '@sentry/react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface SentryUser {
  id: string;
  email?: string | undefined;
  username?: string | undefined;
}

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const SENTRY_ENABLED =
  import.meta.env.VITE_SENTRY_ENABLED !== 'false' &&
  !!import.meta.env.VITE_SENTRY_DSN;

// Sensitive fields to filter from Sentry
const SENSITIVE_FIELDS = [
  'password',
  'newPassword',
  'currentPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'tempToken',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'creditCard',
  'cvv',
  'ssn',
  'pin',
];

// ----------------------------------------------------------------------------
// Data Filtering
// ----------------------------------------------------------------------------

/**
 * Recursively filter sensitive data from objects
 */
function filterSensitiveData(data: unknown): Record<string, unknown> | unknown {
  if (data === null || data === undefined) {
    return {};
  }

  if (Array.isArray(data)) {
    return data.map(filterSensitiveData);
  }

  if (typeof data === 'object') {
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowercaseKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.some((field) => lowercaseKey.includes(field.toLowerCase()))) {
        filtered[key] = '[FILTERED]';
      } else {
        filtered[key] = filterSensitiveData(value);
      }
    }
    return filtered;
  }

  return data;
}

// ----------------------------------------------------------------------------
// Initialize Sentry
// ----------------------------------------------------------------------------

export function initSentry(): void {
  if (!SENTRY_ENABLED) {
    console.log('[Sentry] Disabled - VITE_SENTRY_DSN not set or VITE_SENTRY_ENABLED=false');
    return;
  }

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',

    // Performance monitoring
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

    // Session replay
    replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,

    // Integrations
    integrations: [
      // Browser tracing for performance
      Sentry.browserTracingIntegration({
        // Track navigation and page loads
        enableInp: true,
      }),

      // Session replay for error debugging
      Sentry.replayIntegration({
        // Mask all text content by default for privacy
        maskAllText: true,
        // Block all media for privacy
        blockAllMedia: true,
        // Network capture settings
        networkDetailAllowUrls: [window.location.origin],
        networkRequestHeaders: ['X-Workspace-Id', 'X-Request-Id'],
        networkResponseHeaders: ['X-Request-Id'],
      }),
    ],

    // Filter sensitive data
    beforeSend(event) {
      // Filter request body
      if (event.request?.data) {
        event.request.data = filterSensitiveData(event.request.data) as string;
      }

      // Filter extra data
      if (event.extra) {
        event.extra = filterSensitiveData(event.extra) as Record<string, unknown>;
      }

      // Filter breadcrumb data
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb): Breadcrumb => {
          const filteredData = breadcrumb.data
            ? filterSensitiveData(breadcrumb.data) as Record<string, unknown>
            : {};
          return {
            ...breadcrumb,
            data: filteredData,
          };
        });
      }

      // Don't send events for network errors (usually connectivity issues)
      if (event.exception?.values?.some((e) => e.type === 'NetworkError')) {
        return null;
      }

      return event;
    },

    // Filter breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Filter sensitive data from breadcrumbs
      if (breadcrumb.data) {
        breadcrumb.data = filterSensitiveData(breadcrumb.data) as Record<string, unknown>;
      }

      // Filter out noisy console logs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
        return null;
      }

      return breadcrumb;
    },

    // Ignore common non-actionable errors
    ignoreErrors: [
      // Network errors
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      'NetworkError',
      'ChunkLoadError',
      // Browser extensions
      'ResizeObserver loop',
      // User actions
      'AbortError',
      // React specific
      'Minified React error',
    ],

    // Don't track these URLs
    denyUrls: [
      // Browser extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
    ],
  });

  console.log('[Sentry] Initialized successfully');
}

// ----------------------------------------------------------------------------
// User Context
// ----------------------------------------------------------------------------

/**
 * Set the current user context for Sentry
 */
export function setSentryUser(user: SentryUser | null): void {
  if (!SENTRY_ENABLED) return;

  if (user) {
    const sentryUser: Sentry.User = { id: user.id };
    if (user.email) sentryUser.email = user.email;
    if (user.username) sentryUser.username = user.username;
    Sentry.setUser(sentryUser);
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Clear user context (on logout)
 */
export function clearSentryUser(): void {
  if (!SENTRY_ENABLED) return;
  Sentry.setUser(null);
}

// ----------------------------------------------------------------------------
// Tags and Context
// ----------------------------------------------------------------------------

/**
 * Set a tag for all future events
 */
export function setSentryTag(key: string, value: string): void {
  if (!SENTRY_ENABLED) return;
  Sentry.setTag(key, value);
}

/**
 * Set workspace context
 */
export function setSentryWorkspace(workspaceId: string, workspaceName?: string): void {
  if (!SENTRY_ENABLED) return;

  Sentry.setTag('workspaceId', workspaceId);
  Sentry.setContext('workspace', {
    id: workspaceId,
    name: workspaceName,
  });
}

/**
 * Clear workspace context
 */
export function clearSentryWorkspace(): void {
  if (!SENTRY_ENABLED) return;

  Sentry.setTag('workspaceId', '');
  Sentry.setContext('workspace', null);
}

// ----------------------------------------------------------------------------
// Breadcrumbs
// ----------------------------------------------------------------------------

type SeverityLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';

/**
 * Add a breadcrumb for debugging context
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
  level: SeverityLevel = 'info'
): void {
  if (!SENTRY_ENABLED) return;

  const breadcrumb: Breadcrumb = {
    message,
    category,
    level,
    timestamp: Date.now() / 1000,
  };

  if (data) {
    breadcrumb.data = filterSensitiveData(data) as Record<string, unknown>;
  }

  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Add navigation breadcrumb
 */
export function addNavigationBreadcrumb(from: string, to: string): void {
  if (!SENTRY_ENABLED) return;

  Sentry.addBreadcrumb({
    category: 'navigation',
    message: `Navigated from ${from} to ${to}`,
    data: { from, to },
    level: 'info',
  });
}

/**
 * Add user action breadcrumb
 */
export function addUserActionBreadcrumb(action: string, data?: Record<string, unknown>): void {
  if (!SENTRY_ENABLED) return;

  const breadcrumb: Breadcrumb = {
    category: 'user-action',
    message: action,
    level: 'info',
  };

  if (data) {
    breadcrumb.data = filterSensitiveData(data) as Record<string, unknown>;
  }

  Sentry.addBreadcrumb(breadcrumb);
}

// ----------------------------------------------------------------------------
// Performance Monitoring
// ----------------------------------------------------------------------------

/**
 * Start a custom transaction for critical flows
 */
export function startTransaction(
  name: string,
  op: string
): ReturnType<typeof Sentry.startInactiveSpan> | null {
  if (!SENTRY_ENABLED) return null;

  return Sentry.startInactiveSpan({
    name,
    op,
    forceTransaction: true,
  });
}

/**
 * Measure a custom metric
 */
export function measurePerformance(name: string, value: number, unit: string = 'millisecond'): void {
  if (!SENTRY_ENABLED) return;

  Sentry.metrics.distribution(name, value, {
    unit,
  });
}

// ----------------------------------------------------------------------------
// Error Capture
// ----------------------------------------------------------------------------

/**
 * Capture an exception with additional context
 */
export function captureException(
  error: Error | unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    level?: SeverityLevel;
  }
): string | undefined {
  if (!SENTRY_ENABLED) return undefined;

  const captureContext: Sentry.CaptureContext = {};

  if (context?.tags) {
    captureContext.tags = context.tags;
  }

  if (context?.extra) {
    captureContext.extra = filterSensitiveData(context.extra) as Record<string, unknown>;
  }

  if (context?.level) {
    captureContext.level = context.level;
  }

  return Sentry.captureException(error, captureContext);
}

/**
 * Capture a message
 */
export function captureMessage(
  message: string,
  level: SeverityLevel = 'info',
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): string | undefined {
  if (!SENTRY_ENABLED) return undefined;

  const captureContext: Sentry.CaptureContext = { level };

  if (context?.tags) {
    captureContext.tags = context.tags;
  }

  if (context?.extra) {
    captureContext.extra = filterSensitiveData(context.extra) as Record<string, unknown>;
  }

  return Sentry.captureMessage(message, captureContext);
}

// ----------------------------------------------------------------------------
// React Integration
// ----------------------------------------------------------------------------

/**
 * Sentry Error Boundary wrapper
 * Use this to wrap components that should report errors to Sentry
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * HOC to wrap components with Sentry profiling
 */
export const withSentryProfiler = Sentry.withProfiler;

/**
 * Hook to capture feedback from users
 */
export function showReportDialog(options?: { eventId?: string; title?: string }): void {
  if (!SENTRY_ENABLED) return;

  const dialogOptions: Parameters<typeof Sentry.showReportDialog>[0] = {
    title: options?.title || 'Une erreur est survenue',
    subtitle: 'Notre equipe a ete notifiee.',
    subtitle2: 'Si vous souhaitez nous aider, decrivez ce qui s\'est passe ci-dessous.',
    labelName: 'Nom',
    labelEmail: 'Email',
    labelComments: 'Que s\'est-il passe ?',
    labelClose: 'Fermer',
    labelSubmit: 'Envoyer',
    successMessage: 'Merci pour votre feedback !',
  };

  if (options?.eventId) {
    dialogOptions.eventId = options.eventId;
  }

  Sentry.showReportDialog(dialogOptions);
}

// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

export { Sentry };
export const isSentryEnabled = SENTRY_ENABLED;
