// ============================================================================
// ERROR HANDLER MIDDLEWARE - Finance Hub
// With i18n support for localized error messages
// ============================================================================

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import {
  sentryErrorHandler,
  addBreadcrumb,
  isSentryEnabled,
} from '../monitoring/sentry.js';
import { getErrorMessage, detectLocale, DEFAULT_LANGUAGE, type LanguageCode } from '../i18n/index.js';

// ----------------------------------------------------------------------------
// Custom Error Classes (with i18n support)
// ----------------------------------------------------------------------------

export class AppError extends Error {
  public i18nKey?: string;
  public i18nVariables?: Record<string, string | number>;

  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>,
    i18nKey?: string,
    i18nVariables?: Record<string, string | number>
  ) {
    super(message);
    this.name = 'AppError';
    this.i18nKey = i18nKey;
    this.i18nVariables = i18nVariables;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get localized message for this error
   */
  getLocalizedMessage(locale: LanguageCode): string {
    if (this.i18nKey) {
      return getErrorMessage(locale, this.i18nKey, this.i18nVariables);
    }
    return this.message;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    const i18nKey = id ? 'resourceNotFoundWithId' : 'resourceNotFound';
    const i18nVariables: Record<string, string | number> = id
      ? { resource, id }
      : { resource };

    super(message, 'NOT_FOUND', 404, undefined, i18nKey, i18nVariables);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401, undefined, 'unauthorized');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 'FORBIDDEN', 403, undefined, 'forbidden');
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(entityOrMessage: string, field?: string, value?: string) {
    const message = field && value
      ? `${entityOrMessage} with ${field} "${value}" already exists`
      : entityOrMessage;
    const i18nKey = field && value ? 'conflictError' : 'alreadyExists';
    const i18nVariables: Record<string, string | number> = field && value
      ? { resource: entityOrMessage, field, value }
      : { resource: entityOrMessage };

    super(message, 'CONFLICT', 409, undefined, i18nKey, i18nVariables);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details, 'validation');
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('Too many requests', 'RATE_LIMITED', 429, { retryAfter }, 'tooManyRequests');
    this.name = 'RateLimitError';
  }
}

export class SessionLockedError extends AppError {
  constructor() {
    super('Session is locked', 'SESSION_LOCKED', 423, undefined, 'sessionLocked');
    this.name = 'SessionLockedError';
  }
}

export class MfaRequiredError extends AppError {
  constructor(tempToken: string, methods: string[]) {
    super('MFA verification required', 'MFA_REQUIRED', 401, { tempToken, methods }, 'mfaRequired');
    this.name = 'MfaRequiredError';
  }
}

// ----------------------------------------------------------------------------
// Error Response Format
// ----------------------------------------------------------------------------

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ----------------------------------------------------------------------------
// Helper to get locale from request
// ----------------------------------------------------------------------------

function getRequestLocale(request: FastifyRequest): LanguageCode {
  // Use the locale from i18n middleware if available
  if (request.locale) {
    return request.locale;
  }

  // Otherwise detect from request
  const userLocale = (request.user as { locale?: string })?.locale;
  const acceptLanguage = request.headers['accept-language'];

  return detectLocale(userLocale, acceptLanguage);
}

// ----------------------------------------------------------------------------
// Error Handler
// ----------------------------------------------------------------------------

export async function errorHandler(
  error: FastifyError | AppError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Get locale for error messages
  const locale = getRequestLocale(request);

  // Log error
  request.log.error({
    err: error,
    url: request.url,
    method: request.method,
    userId: (request.user as { sub?: string })?.sub,
    locale,
  });

  let response: ErrorResponse;
  let statusCode: number;

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const formattedErrors = error.errors.reduce(
      (acc, err) => {
        const path = err.path.join('.');
        acc[path] = err.message;
        return acc;
      },
      {} as Record<string, string>
    );

    response = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: getErrorMessage(locale, 'validation'),
        details: { fields: formattedErrors },
      },
    };
    statusCode = 400;
  }
  // Handle custom AppError (with i18n support)
  else if (error instanceof AppError) {
    response = {
      success: false,
      error: {
        code: error.code,
        message: error.getLocalizedMessage(locale),
        details: error.details,
      },
    };
    statusCode = error.statusCode;
  }
  // Handle Fastify validation errors
  else if ('validation' in error && error.validation) {
    response = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: getErrorMessage(locale, 'validation'),
        details: { validation: error.validation },
      },
    };
    statusCode = 400;
  }
  // Handle rate limit errors
  else if ('statusCode' in error && error.statusCode === 429) {
    response = {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: getErrorMessage(locale, 'tooManyRequests'),
      },
    };
    statusCode = 429;
  }
  // Handle JWT errors
  else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    response = {
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: getErrorMessage(locale, 'invalidToken'),
      },
    };
    statusCode = 401;
  }
  // Handle unknown errors
  else {
    // Report unexpected errors to Sentry with full context
    if (isSentryEnabled) {
      sentryErrorHandler(error, request, reply);
    }

    // Don't leak internal error details in production
    const message =
      process.env.NODE_ENV === 'production'
        ? getErrorMessage(locale, 'internalError')
        : error.message || getErrorMessage(locale, 'generic');

    response = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    };
    statusCode = 500;
  }

  // Add breadcrumb for error tracking
  if (isSentryEnabled) {
    addBreadcrumb(
      `Error: ${response.error.code}`,
      'error',
      {
        code: response.error.code,
        message: response.error.message,
        statusCode,
        url: request.url,
        method: request.method,
        locale,
      },
      statusCode >= 500 ? 'error' : 'warning'
    );
  }

  await reply.status(statusCode).send(response);
}
