// ============================================================================
// RATE LIMITING MIDDLEWARE - Finance Hub
// Protection against abuse and DDoS using @fastify/rate-limit
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { RateLimitPluginOptions } from '@fastify/rate-limit';
import fastifyRateLimit from '@fastify/rate-limit';
import { redisClient } from '@/core/database/redis.js';
import { logger } from '@/core/middleware/logger.js';

// ----------------------------------------------------------------------------
// Configuration Types
// ----------------------------------------------------------------------------

export interface RateLimitConfig {
  /** General API rate limit (read operations) */
  api: RouteRateLimitConfig;
  /** Authentication endpoints (stricter) */
  auth: RouteRateLimitConfig;
  /** Login attempts (very strict to prevent brute force) */
  login: RouteRateLimitConfig & { blockDuration: number };
  /** File uploads / imports */
  import: RouteRateLimitConfig;
  /** Export operations */
  export: RouteRateLimitConfig;
  /** Write operations (create, update, delete) */
  write: RouteRateLimitConfig;
  /** Registration (very strict to prevent abuse) */
  register: RouteRateLimitConfig;
  /** Sensitive operations (password change, MFA setup) */
  sensitive: RouteRateLimitConfig;
  /** Password reset / forgot password */
  forgotPassword: RouteRateLimitConfig;
  /** PDF report generation */
  pdfReport: RouteRateLimitConfig;
}

interface RouteRateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Max requests per window */
  max: number;
}

// ----------------------------------------------------------------------------
// Default Configuration
// ----------------------------------------------------------------------------

const DEFAULT_CONFIG: RateLimitConfig = {
  api: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
  },
  auth: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 auth attempts per minute
  },
  login: {
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 login attempts per minute (strict)
    blockDuration: 30 * 60 * 1000, // 30 minute block after max attempts
  },
  import: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 import operations per minute
  },
  export: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 exports per hour
  },
  write: {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 write operations per minute
  },
  register: {
    windowMs: 60 * 1000, // 1 minute
    max: 3, // 3 registrations per minute (very strict)
  },
  sensitive: {
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 sensitive operations per minute
  },
  forgotPassword: {
    windowMs: 60 * 1000, // 1 minute
    max: 3, // 3 forgot password requests per minute
  },
  pdfReport: {
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 PDF generations per minute
  },
};

// ----------------------------------------------------------------------------
// Whitelist Configuration
// ----------------------------------------------------------------------------

/** Trusted IPs that bypass rate limiting */
const TRUSTED_IPS = new Set<string>(
  (process.env.RATE_LIMIT_WHITELIST_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean)
);

/** Trusted API keys that bypass rate limiting */
const TRUSTED_API_KEYS = new Set<string>(
  (process.env.RATE_LIMIT_WHITELIST_API_KEYS || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)
);

/**
 * Check if request should bypass rate limiting
 */
function shouldBypass(request: FastifyRequest): boolean {
  // Check trusted IPs
  const ip = getClientIp(request);
  if (TRUSTED_IPS.has(ip)) {
    logger.debug({ ip }, 'Rate limit bypassed for trusted IP');
    return true;
  }

  // Check API key
  const apiKey = request.headers['x-api-key'];
  if (typeof apiKey === 'string' && TRUSTED_API_KEYS.has(apiKey)) {
    logger.debug('Rate limit bypassed for trusted API key');
    return true;
  }

  return false;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Get client IP address, handling proxies
 */
function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() ?? request.ip;
  }
  return request.ip;
}

/**
 * Get identifier for rate limiting
 */
function getIdentifier(request: FastifyRequest): string {
  // Use user ID if authenticated
  if (request.user?.sub) {
    return `user:${request.user.sub}`;
  }

  // Otherwise use IP address
  return `ip:${getClientIp(request)}`;
}

/**
 * Build error response for rate limit exceeded
 */
function buildErrorResponse(
  _request: FastifyRequest,
  context: { after: string; max: number; ttl: number }
): {
  success: false;
  error: {
    code: string;
    message: string;
    retryAfter: string;
  };
} {
  return {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Trop de requetes. Reessayez dans ${context.after}`,
      retryAfter: context.after,
    },
  };
}

// ----------------------------------------------------------------------------
// Redis-backed Rate Limit Store (Custom Implementation)
// ----------------------------------------------------------------------------

const RATE_LIMIT_PREFIX = 'ratelimit:';

interface RateLimitEntry {
  count: number;
  resetAt: number;
  blocked?: boolean;
  blockedUntil?: number;
}

async function getRateLimitEntry(key: string): Promise<RateLimitEntry | null> {
  try {
    const data = await redisClient.get(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function setRateLimitEntry(
  key: string,
  entry: RateLimitEntry,
  ttlMs: number
): Promise<void> {
  try {
    await redisClient.set(key, JSON.stringify(entry), 'PX', ttlMs);
  } catch (error) {
    logger.error({ error, key }, 'Failed to set rate limit entry');
  }
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

/**
 * Block an identifier for a specified duration
 */
export async function blockIdentifier(
  identifier: string,
  category: keyof RateLimitConfig,
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
// Middleware Factory
// ----------------------------------------------------------------------------

interface RateLimitMiddlewareOptions {
  category: keyof RateLimitConfig;
  config?: Partial<RateLimitConfig>;
  keyGenerator?: (request: FastifyRequest) => string;
  skip?: (request: FastifyRequest) => boolean;
  onBlocked?: (request: FastifyRequest, reply: FastifyReply) => void;
}

export function createRateLimitMiddleware(options: RateLimitMiddlewareOptions) {
  const config = { ...DEFAULT_CONFIG, ...options.config };
  const categoryConfig = config[options.category];

  return async function rateLimitMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Skip if whitelisted
    if (shouldBypass(request)) {
      return;
    }

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
      const retryAfterSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);
      reply.header('Retry-After', retryAfterSeconds);

      if (options.onBlocked) {
        options.onBlocked(request, reply);
        return;
      }

      logger.warn(
        { identifier, category: options.category, ip: getClientIp(request) },
        'Rate limit exceeded'
      );

      return reply.status(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Trop de requetes. Reessayez dans ${retryAfterSeconds} secondes`,
          retryAfter: retryAfterSeconds,
        },
      });
    }
  };
}

// ----------------------------------------------------------------------------
// Pre-configured Middlewares
// ----------------------------------------------------------------------------

/** General API rate limit - 100 requests per minute */
export const apiRateLimit = createRateLimitMiddleware({
  category: 'api',
});

/** Auth endpoint rate limit - 10 requests per minute */
export const authRateLimit = createRateLimitMiddleware({
  category: 'auth',
});

/** Login rate limit - 5 requests per minute (per email) */
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
});

/** Register rate limit - 3 requests per minute (per IP) */
export const registerRateLimit = createRateLimitMiddleware({
  category: 'register',
  keyGenerator: (request) => {
    // For registration, use IP as identifier to prevent mass account creation
    return `ip:${getClientIp(request)}`;
  },
});

/** Forgot password rate limit - 3 requests per minute */
export const forgotPasswordRateLimit = createRateLimitMiddleware({
  category: 'forgotPassword',
  keyGenerator: (request) => {
    // Use email + IP combo to prevent abuse
    const body = request.body as { email?: string } | undefined;
    const ip = getClientIp(request);
    if (body?.email) {
      return `forgot:${body.email.toLowerCase()}:${ip}`;
    }
    return `ip:${ip}`;
  },
});

/** Import rate limit - 10 requests per minute */
export const importRateLimit = createRateLimitMiddleware({
  category: 'import',
});

/** Export rate limit - 10 requests per hour */
export const exportRateLimit = createRateLimitMiddleware({
  category: 'export',
});

/** Write operation rate limit - 30 requests per minute */
export const writeRateLimit = createRateLimitMiddleware({
  category: 'write',
});

/** Sensitive operation rate limit - 5 requests per minute */
export const sensitiveRateLimit = createRateLimitMiddleware({
  category: 'sensitive',
});

/** PDF report generation rate limit - 5 requests per minute */
export const pdfReportRateLimit = createRateLimitMiddleware({
  category: 'pdfReport',
});

// ----------------------------------------------------------------------------
// Route-specific Rate Limit Options (for @fastify/rate-limit)
// ----------------------------------------------------------------------------

/**
 * Get route config for @fastify/rate-limit
 * Use this when applying rate limits at route level
 */
export function getRouteRateLimitConfig(
  category: keyof RateLimitConfig,
  customKeyGenerator?: (request: FastifyRequest) => string
): RateLimitPluginOptions {
  const config = DEFAULT_CONFIG[category];

  return {
    max: config.max,
    timeWindow: config.windowMs,
    keyGenerator: customKeyGenerator ?? ((request: FastifyRequest) => getIdentifier(request)),
    errorResponseBuilder: buildErrorResponse,
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    skipOnError: false,
    hook: 'preHandler',
    allowList: (request: FastifyRequest) => shouldBypass(request),
  };
}

// ----------------------------------------------------------------------------
// Plugin Registration
// ----------------------------------------------------------------------------

/**
 * Register global rate limiting with @fastify/rate-limit
 */
export async function registerGlobalRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(fastifyRateLimit, {
    global: true,
    max: DEFAULT_CONFIG.api.max,
    timeWindow: DEFAULT_CONFIG.api.windowMs,
    redis: redisClient,
    keyGenerator: (request: FastifyRequest) => getIdentifier(request),
    errorResponseBuilder: buildErrorResponse,
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    allowList: (request: FastifyRequest) => {
      // Skip health checks and static files
      if (
        request.url.startsWith('/health') ||
        request.url.startsWith('/static') ||
        request.url.startsWith('/public') ||
        request.url.startsWith('/docs')
      ) {
        return true;
      }
      return shouldBypass(request);
    },
  });

  logger.info('Global rate limiting registered');
}

/**
 * Legacy function for backward compatibility
 */
export function registerRateLimiting(app: FastifyInstance): void {
  // Apply global API rate limiting via hook
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

/**
 * Get remaining requests for an identifier
 */
export async function getRemainingRequests(
  identifier: string,
  category: keyof RateLimitConfig
): Promise<{ remaining: number; resetAt: number | null }> {
  const key = `${RATE_LIMIT_PREFIX}${category}:${identifier}`;
  const entry = await getRateLimitEntry(key);
  const config = DEFAULT_CONFIG[category];

  if (!entry) {
    return { remaining: config.max, resetAt: null };
  }

  return {
    remaining: Math.max(0, config.max - entry.count),
    resetAt: entry.resetAt,
  };
}

// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

export const rateLimitConfig = DEFAULT_CONFIG;

export default {
  createRateLimitMiddleware,
  apiRateLimit,
  authRateLimit,
  loginRateLimit,
  registerRateLimit,
  forgotPasswordRateLimit,
  importRateLimit,
  exportRateLimit,
  writeRateLimit,
  sensitiveRateLimit,
  pdfReportRateLimit,
  registerGlobalRateLimit,
  registerRateLimiting,
  resetRateLimit,
  isBlocked,
  blockIdentifier,
  getRemainingRequests,
  getRouteRateLimitConfig,
  rateLimitConfig,
};
