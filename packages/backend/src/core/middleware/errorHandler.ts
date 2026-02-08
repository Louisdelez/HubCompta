// ============================================================================
// ERROR HANDLER MIDDLEWARE - Finance Hub
// ============================================================================

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

// ----------------------------------------------------------------------------
// Custom Error Classes
// ----------------------------------------------------------------------------

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with ID ${id} not found` : `${resource} not found`,
      'NOT_FOUND',
      404
    );
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(entityOrMessage: string, field?: string, value?: string) {
    const message = field && value
      ? `${entityOrMessage} with ${field} "${value}" already exists`
      : entityOrMessage;
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('Too many requests', 'RATE_LIMITED', 429, { retryAfter });
    this.name = 'RateLimitError';
  }
}

export class SessionLockedError extends AppError {
  constructor() {
    super('Session is locked', 'SESSION_LOCKED', 423);
    this.name = 'SessionLockedError';
  }
}

export class MfaRequiredError extends AppError {
  constructor(tempToken: string, methods: string[]) {
    super('MFA verification required', 'MFA_REQUIRED', 401, { tempToken, methods });
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
// Error Handler
// ----------------------------------------------------------------------------

export async function errorHandler(
  error: FastifyError | AppError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Log error
  request.log.error({
    err: error,
    url: request.url,
    method: request.method,
    userId: (request.user as { sub?: string })?.sub,
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
        message: 'Validation failed',
        details: { fields: formattedErrors },
      },
    };
    statusCode = 400;
  }
  // Handle custom AppError
  else if (error instanceof AppError) {
    response = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
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
        message: error.message,
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
        message: 'Too many requests, please try again later',
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
        message: 'Invalid or expired token',
      },
    };
    statusCode = 401;
  }
  // Handle unknown errors
  else {
    // Don't leak internal error details in production
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : error.message || 'Unknown error';

    response = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    };
    statusCode = 500;
  }

  await reply.status(statusCode).send(response);
}
