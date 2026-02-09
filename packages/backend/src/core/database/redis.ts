// ============================================================================
// REDIS CLIENT SINGLETON - Finance Hub
// ============================================================================

import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required');
}

// Parse connection options from URL
const redisOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    if (times > 10) {
      return null; // Stop retrying
    }
    return Math.min(times * 100, 3000); // Exponential backoff, max 3s
  },
  enableReadyCheck: true,
  lazyConnect: false,
};

// Create Redis client singleton
let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis(REDIS_URL!, redisOptions);
  }

  redis.on('error', (error: Error) => {
    console.error('Redis connection error:', error);
  });

  redis.on('connect', () => {
    console.info('Redis connected');
  });

  redis.on('ready', () => {
    console.info('Redis ready');
  });

  redis.on('close', () => {
    console.warn('Redis connection closed');
  });

  return redis;
}

// Export default client
export const redisClient = getRedisClient();

// ----------------------------------------------------------------------------
// Redis Key Prefixes
// ----------------------------------------------------------------------------

export const REDIS_KEYS: {
  session: (sessionId: string) => string;
  rateLimit: (type: string, identifier: string) => string;
  loginAttempts: (email: string) => string;
  accountLockout: (email: string) => string;
  cache: (key: string) => string;
  workspace: (workspaceId: string, key: string) => string;
} = {
  /** Session data: session:{sessionId} */
  session: (sessionId: string) => `session:${sessionId}`,

  /** Rate limiting: ratelimit:{type}:{identifier} */
  rateLimit: (type: string, identifier: string) => `ratelimit:${type}:${identifier}`,

  /** Login attempts: login_attempts:{email} */
  loginAttempts: (email: string) => `login_attempts:${email}`,

  /** Account lockout: lockout:{email} */
  accountLockout: (email: string) => `lockout:${email}`,

  /** Cache: cache:{key} */
  cache: (key: string) => `cache:${key}`,

  /** Workspace context: workspace:{workspaceId}:{key} */
  workspace: (workspaceId: string, key: string) => `workspace:${workspaceId}:${key}`,
} as const;

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Set a value with expiration
 */
export async function setWithExpiry(
  key: string,
  value: string | object,
  expirySeconds: number
): Promise<void> {
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  await redisClient.setex(key, expirySeconds, stringValue);
}

/**
 * Get and parse a JSON value
 */
export async function getJson<T>(key: string): Promise<T | null> {
  const value = await redisClient.get(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Increment a counter with expiry (for rate limiting)
 */
export async function incrementWithExpiry(
  key: string,
  expirySeconds: number
): Promise<number> {
  const multi = redisClient.multi();
  multi.incr(key);
  multi.expire(key, expirySeconds);
  const results = await multi.exec();
  return (results?.[0]?.[1] as number) ?? 0;
}

// ----------------------------------------------------------------------------
// Graceful Shutdown
// ----------------------------------------------------------------------------

process.on('beforeExit', () => {
  if (redis) {
    void redis.quit().then(() => {
      redis = null;
    });
  }
});
