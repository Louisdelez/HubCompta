// ============================================================================
// RATE LIMITING MIDDLEWARE - Finance Hub
// Protection against abuse and DDoS
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redisClient } from '@/core/database/redis.js';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

interface RateLimitConfig {
  // General API rate limit
  api: {
    windowMs: number; // Time window in milliseconds
    max: number; // Max requests per window
  };
  // Authentication endpoints (stricter)
  auth: {
    windowMs: number;
    max: number;
  };
  // Login attempts (very strict to prevent brute force)
  login: {
    windowMs: number;
    max: number;
    blockDuration: number; // Block duration after max attempts
  };
  // File uploads
  upload: {
    windowMs: number;
    max: number;
  };
  // Export operations
  export: {
    windowMs: number;
    max: number;
  };
}

const DEFAULT_CONFIG: RateLimitConfig = {
  api: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 auth attempts per 15 minutes
  },
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts
    blockDuration: 30 * 60 * 1000, // 30 minute block
  },
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 uploads per hour
  },
  export: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 exports per hour
  },
};

// ----------------------------------------------------------------------------
// Rate Limit Store (Redis-backed)
// ----------------------------------------------------------------------------

const RATE_LIMIT_PREFIX = 'ratelimit:';

interface RateLimitEntry {
  count: number;
  resetAt: number;
  blocked?: boolean;
  blockedUntil?: number;
}

async function getRateLimitEntry(key: string): Promise<RateLimitEntry | null> {
  const data = await redisClient.get(key);
  if (!data) return null;
  return JSON.parse(data);
}

async function setRateLimitEntry(
  key: string,
  entry: RateLimitEntry,
  ttlMs: number
): Promise<void> {
  await redisClient.set(key, JSON.stringify(entry), 'PX', ttlMs);
}

async function incrementRateLimit(
  identifier: string,
  category: string,
  windowMs: number,
  max: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `${RATE_LIMIT_PREFIX}${category}:${identifier}`;
  const now = Date.now();

  let entry = await getRateLimitEntry(key);

  // Check if blocked
  if (entry?.blocked && entry.blockedUntil && entry.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
    };
  }

  // Reset if window expired
  if (!entry || entry.resetAt <= now) {
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    await setRateLimitEntry(key, entry, windowMs);
    return {
      allowed: true,
      remaining: max - 1,
      resetAt: entry.resetAt,
    };
  }

  // Increment counter
  entry.count += 1;
  const allowed = entry.count <= max;
  const remaining = Math.max(0, max - entry.count);

  await setRateLimitEntry(key, entry, entry.resetAt - now);

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
  };
}

async function blockIdentifier(
  identifier: string,
  category: string,
  blockDuration: number
): Promise<void> {
  const key = `${RATE_LIMIT_PREFIX}${category}:${identifier}`;
  const now = Date.now();

  const entry: RateLimitEntry = {
    count: 0,
    resetAt: now + blockDuration,
    blocked: true,
    blockedUntil: now + blockDuration,
  };

  await setRateLimitEntry(key, entry, blockDuration);
}

// ----------------------------------------------------------------------------
// Identifier Extraction
// ----------------------------------------------------------------------------

function getIdentifier(request: FastifyRequest): string {
  // Use user ID if authenticated
  if (request.user?.sub) {
    return `user:${request.user.sub}`;
  }

  // Otherwise use IP address
  const forwarded = request.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string'
    ? (forwarded.split(',')[0]?.trim() ?? request.ip)
    : request.ip;

  return `ip:${ip}`;
}

// ----------------------------------------------------------------------------
// Middleware Factory
// ----------------------------------------------------------------------------

interface RateLimitOptions {
  category: keyof RateLimitConfig;
  config?: Partial<RateLimitConfig>;
  keyGenerator?: (request: FastifyRequest) => string;
  skip?: (request: FastifyRequest) => boolean;
  onBlocked?: (request: FastifyRequest, reply: FastifyReply) => void;
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  const config = { ...DEFAULT_CONFIG, ...options.config };
  const categoryConfig = config[options.category];

  return async function rateLimitMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Skip if configured
    if (options.skip?.(request)) {
      return;
    }

    const identifier = options.keyGenerator?.(request) ?? getIdentifier(request);
    const { windowMs, max } = categoryConfig;

    const result = await incrementRateLimit(identifier, options.category, windowMs, max);

    // Set rate limit headers
    reply.header('X-RateLimit-Limit', max);
    reply.header('X-RateLimit-Remaining', result.remaining);
    reply.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      reply.header('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000));

      if (options.onBlocked) {
        options.onBlocked(request, reply);
        return;
      }

      return reply.status(429).send({
        error: 'Trop de requetes',
        message: 'Vous avez depasse la limite de requetes. Veuillez reessayer plus tard.',
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      });
    }
  };
}

// ----------------------------------------------------------------------------
// Pre-configured Middlewares
// ----------------------------------------------------------------------------

export const apiRateLimit = createRateLimitMiddleware({
  category: 'api',
});

export const authRateLimit = createRateLimitMiddleware({
  category: 'auth',
});

export const loginRateLimit = createRateLimitMiddleware({
  category: 'login',
  keyGenerator: (request) => {
    // For login, use email as identifier to prevent brute force on specific accounts
    const body = request.body as { email?: string } | undefined;
    if (body?.email) {
      return `email:${body.email.toLowerCase()}`;
    }
    return getIdentifier(request);
  },
  onBlocked: async (request, reply) => {
    // Block the identifier after max attempts
    const body = request.body as { email?: string } | undefined;
    const identifier = body?.email
      ? `email:${body.email.toLowerCase()}`
      : getIdentifier(request);

    await blockIdentifier(identifier, 'login', DEFAULT_CONFIG.login.blockDuration);

    return reply.status(429).send({
      error: 'Compte temporairement bloque',
      message: 'Trop de tentatives de connexion. Veuillez reessayer dans 30 minutes.',
      retryAfter: Math.ceil(DEFAULT_CONFIG.login.blockDuration / 1000),
    });
  },
});

export const uploadRateLimit = createRateLimitMiddleware({
  category: 'upload',
});

export const exportRateLimit = createRateLimitMiddleware({
  category: 'export',
});

// ----------------------------------------------------------------------------
// Plugin Registration
// ----------------------------------------------------------------------------

export async function registerRateLimiting(app: FastifyInstance): Promise<void> {
  // Apply global API rate limiting
  app.addHook('preHandler', async (request, reply) => {
    // Skip health checks and static files
    if (
      request.url.startsWith('/health') ||
      request.url.startsWith('/static') ||
      request.url.startsWith('/public')
    ) {
      return;
    }

    await apiRateLimit(request, reply);
  });
}

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------

/**
 * Reset rate limit for a specific identifier
 */
export async function resetRateLimit(
  identifier: string,
  category: keyof RateLimitConfig
): Promise<void> {
  const key = `${RATE_LIMIT_PREFIX}${category}:${identifier}`;
  await redisClient.del(key);
}

/**
 * Check if identifier is currently blocked
 */
export async function isBlocked(
  identifier: string,
  category: keyof RateLimitConfig
): Promise<boolean> {
  const key = `${RATE_LIMIT_PREFIX}${category}:${identifier}`;
  const entry = await getRateLimitEntry(key);

  if (!entry) return false;

  return !!(entry.blocked && entry.blockedUntil && entry.blockedUntil > Date.now());
}

export default {
  createRateLimitMiddleware,
  apiRateLimit,
  authRateLimit,
  loginRateLimit,
  uploadRateLimit,
  exportRateLimit,
  registerRateLimiting,
  resetRateLimit,
  isBlocked,
};
