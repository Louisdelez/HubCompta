// ============================================================================
// SENTRY INTEGRATION - Finance Hub Backend
// Error monitoring and performance tracking
// ============================================================================

import * as Sentry from '@sentry/node';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface SentryUser {
  id: string;
  email?: string;
  username?: string;
}

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const SENTRY_ENABLED = process.env.SENTRY_ENABLED !== 'false' && !!process.env.SENTRY_DSN;
const SLOW_QUERY_THRESHOLD_MS = 1000; // 1 second

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
function filterSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(filterSensitiveData);
  }

  if (typeof data === 'object') {
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowercaseKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.some(field => lowercaseKey.includes(field.toLowerCase()))) {
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
    console.log('[Sentry] Disabled - SENTRY_DSN not set or SENTRY_ENABLED=false');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || '1.0.0',

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Profile sampling (linked to traces)
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Integrations
    integrations: [
      // Default integrations are automatically added
      Sentry.prismaIntegration(),
    ],

    // Filter sensitive data
    beforeSend(event) {
      // Filter request body
      if (event.request?.data) {
        event.request.data = filterSensitiveData(event.request.data) as string;
      }

      // Filter headers
      if (event.request?.headers) {
        const headers = { ...event.request.headers };
        delete headers['authorization'];
        delete headers['cookie'];
        delete headers['x-api-key'];
        event.request.headers = headers;
      }

      // Filter extra data
      if (event.extra) {
        event.extra = filterSensitiveData(event.extra) as Record<string, unknown>;
      }

      // Filter breadcrumb data
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(breadcrumb => ({
          ...breadcrumb,
          data: breadcrumb.data ? filterSensitiveData(breadcrumb.data) as Record<string, unknown> : undefined,
        }));
      }

      return event;
    },

    // Filter breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Filter sensitive data from breadcrumbs
      if (breadcrumb.data) {
        breadcrumb.data = filterSensitiveData(breadcrumb.data) as Record<string, unknown>;
      }
      return breadcrumb;
    },
  });

  // Capture unhandled exceptions
  process.on('uncaughtException', (error) => {
    Sentry.captureException(error, {
      tags: { type: 'uncaughtException' },
    });
    // Allow Sentry to flush before exiting
    Sentry.close(2000).finally(() => {
      process.exit(1);
    });
  });

  // Capture unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    Sentry.captureException(reason, {
      tags: { type: 'unhandledRejection' },
    });
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
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Set user context from authenticated request
 */
export function setSentryUserFromRequest(request: FastifyRequest): void {
  if (!SENTRY_ENABLED) return;

  const user = request.user as { sub?: string; email?: string } | undefined;
  if (user?.sub) {
    Sentry.setUser({
      id: user.sub,
      email: user.email,
    });
  }
}

// ----------------------------------------------------------------------------
// Breadcrumbs
// ----------------------------------------------------------------------------

/**
 * Add a breadcrumb for debugging context
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info'
): void {
  if (!SENTRY_ENABLED) return;

  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data: data ? filterSensitiveData(data) as Record<string, unknown> : undefined,
    timestamp: Date.now() / 1000,
  });
}

// ----------------------------------------------------------------------------
// Performance Monitoring
// ----------------------------------------------------------------------------

/**
 * Start a custom span for performance monitoring
 */
export function startSpan<T>(
  name: string,
  op: string,
  callback: () => T
): T {
  if (!SENTRY_ENABLED) {
    return callback();
  }

  return Sentry.startSpan(
    { name, op },
    callback
  );
}

/**
 * Start an async span for performance monitoring
 */
export async function startSpanAsync<T>(
  name: string,
  op: string,
  callback: () => Promise<T>
): Promise<T> {
  if (!SENTRY_ENABLED) {
    return callback();
  }

  return Sentry.startSpan(
    { name, op },
    callback
  );
}

/**
 * Track a slow database query
 */
export function trackSlowQuery(
  query: string,
  durationMs: number,
  params?: unknown[]
): void {
  if (!SENTRY_ENABLED) return;

  if (durationMs >= SLOW_QUERY_THRESHOLD_MS) {
    addBreadcrumb(
      `Slow query: ${durationMs}ms`,
      'database',
      {
        query: query.slice(0, 500), // Truncate long queries
        duration: durationMs,
        paramsCount: params?.length ?? 0,
      },
      'warning'
    );

    // Capture as a performance issue if very slow
    if (durationMs >= SLOW_QUERY_THRESHOLD_MS * 3) {
      Sentry.captureMessage(`Very slow database query: ${durationMs}ms`, {
        level: 'warning',
        tags: {
          type: 'slow_query',
          duration_ms: durationMs,
        },
        extra: {
          query: query.slice(0, 1000),
        },
      });
    }
  }
}

// ----------------------------------------------------------------------------
// Error Capture
// ----------------------------------------------------------------------------

/**
 * Capture an exception with additional context
 */
export function captureException(
  error: unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    user?: SentryUser;
    level?: Sentry.SeverityLevel;
  }
): string | undefined {
  if (!SENTRY_ENABLED) return undefined;

  return Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra ? filterSensitiveData(context.extra) as Record<string, unknown> : undefined,
    user: context?.user,
    level: context?.level,
  });
}

/**
 * Capture a message
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): string | undefined {
  if (!SENTRY_ENABLED) return undefined;

  return Sentry.captureMessage(message, {
    level,
    tags: context?.tags,
    extra: context?.extra ? filterSensitiveData(context.extra) as Record<string, unknown> : undefined,
  });
}

// ----------------------------------------------------------------------------
// Fastify Plugin
// ----------------------------------------------------------------------------

/**
 * Sentry error handler for Fastify
 * Adds request context and user info to error reports
 */
export function sentryErrorHandler(
  error: Error,
  request: FastifyRequest,
  _reply: FastifyReply
): void {
  if (!SENTRY_ENABLED) return;

  const user = request.user as { sub?: string; email?: string } | undefined;

  Sentry.withScope((scope) => {
    // Set user context
    if (user?.sub) {
      scope.setUser({
        id: user.sub,
        email: user.email,
      });
    }

    // Set request context
    scope.setContext('request', {
      url: request.url,
      method: request.method,
      headers: filterSensitiveData(request.headers) as Record<string, unknown>,
      query: request.query,
      params: request.params,
    });

    // Set tags
    scope.setTag('url', request.url);
    scope.setTag('method', request.method);

    // Get workspace ID if present
    const workspaceId = request.headers['x-workspace-id'] as string | undefined;
    if (workspaceId) {
      scope.setTag('workspaceId', workspaceId);
    }

    Sentry.captureException(error);
  });
}

/**
 * Register Sentry request hooks for Fastify
 */
export function registerSentryHooks(app: FastifyInstance): void {
  if (!SENTRY_ENABLED) return;

  // Add user context on authenticated requests
  app.addHook('preHandler', async (request) => {
    setSentryUserFromRequest(request);

    // Add request breadcrumb
    addBreadcrumb(
      `${request.method} ${request.url}`,
      'http',
      {
        url: request.url,
        method: request.method,
        query: request.query as Record<string, unknown>,
      }
    );
  });

  // Track response time
  app.addHook('onResponse', async (request, reply) => {
    const responseTime = reply.elapsedTime;

    // Log slow requests
    if (responseTime > 3000) {
      addBreadcrumb(
        `Slow request: ${responseTime.toFixed(0)}ms`,
        'http',
        {
          url: request.url,
          method: request.method,
          statusCode: reply.statusCode,
          responseTime,
        },
        'warning'
      );
    }
  });
}

// ----------------------------------------------------------------------------
// Graceful Shutdown
// ----------------------------------------------------------------------------

/**
 * Flush Sentry events before shutdown
 */
export async function flushSentry(timeout = 2000): Promise<boolean> {
  if (!SENTRY_ENABLED) return true;

  return Sentry.close(timeout);
}

// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

export { Sentry };
export const isSentryEnabled = SENTRY_ENABLED;
