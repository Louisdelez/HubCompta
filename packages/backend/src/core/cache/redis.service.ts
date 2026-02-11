// ============================================================================
// REDIS CACHE SERVICE - Finance Hub
// High-performance caching with graceful degradation
// ============================================================================

import { Redis } from 'ioredis';
import { logger } from '../middleware/logger.js';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const REDIS_URL = process.env.REDIS_URL;
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';
const DEFAULT_TTL = parseInt(process.env.CACHE_TTL_DEFAULT ?? '300', 10);

// TTL configurations (in seconds)
export const CACHE_TTL = {
  /** User profile data: 5 minutes */
  USER_PROFILE: 300,
  /** Account list: 5 minutes */
  ACCOUNTS: 300,
  /** Categories: 1 hour (rarely changes) */
  CATEGORIES: 3600,
  /** Dashboard stats: 1 minute */
  DASHBOARD: 60,
  /** Exchange rates: 1 hour */
  EXCHANGE_RATES: 3600,
  /** Workspace members: 5 minutes */
  WORKSPACE_MEMBERS: 300,
  /** Settings: 10 minutes */
  SETTINGS: 600,
} as const;

// ----------------------------------------------------------------------------
// Cache Key Builders
// ----------------------------------------------------------------------------

export const CACHE_KEYS = {
  // User-related keys
  userProfile: (userId: string) => `user:${userId}:profile`,
  userAccounts: (userId: string, workspaceId: string) => `user:${userId}:accounts:${workspaceId}`,
  userCategories: (userId: string, workspaceId: string) => `user:${userId}:categories:${workspaceId}`,
  userDashboard: (userId: string, workspaceId: string, period: string) =>
    `user:${userId}:dashboard:${workspaceId}:${period}`,
  userSettings: (userId: string) => `user:${userId}:settings`,

  // Workspace-related keys
  workspaceMembers: (workspaceId: string) => `workspace:${workspaceId}:members`,
  workspaceCategories: (workspaceId: string) => `workspace:${workspaceId}:categories`,
  workspaceAccounts: (workspaceId: string) => `workspace:${workspaceId}:accounts`,

  // Global keys
  exchangeRates: () => 'global:exchange-rates',
  currencies: () => 'global:currencies',

  // Pattern helpers for invalidation
  userPattern: (userId: string) => `user:${userId}:*`,
  workspacePattern: (workspaceId: string) => `workspace:${workspaceId}:*`,
} as const;

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
}

// ----------------------------------------------------------------------------
// Redis Client Setup
// ----------------------------------------------------------------------------

let redis: Redis | null = null;
let isConnected = false;

const stats: CacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
};

function getClient(): Redis | null {
  if (!REDIS_ENABLED || !REDIS_URL) {
    return null;
  }

  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 5) {
          logger.warn('Redis cache: max retries reached, cache disabled');
          return null;
        }
        return Math.min(times * 100, 2000);
      },
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redis.on('connect', () => {
      isConnected = true;
      logger.info('Redis cache connected');
    });

    redis.on('ready', () => {
      isConnected = true;
      logger.info('Redis cache ready');
    });

    redis.on('error', (error: Error) => {
      isConnected = false;
      stats.errors++;
      logger.error({ error }, 'Redis cache error');
    });

    redis.on('close', () => {
      isConnected = false;
      logger.warn('Redis cache connection closed');
    });

    // Connect lazily
    void redis.connect().catch((err) => {
      logger.warn({ err }, 'Redis cache initial connection failed, will retry');
    });
  }

  return isConnected ? redis : null;
}

// ----------------------------------------------------------------------------
// Cache Service
// ----------------------------------------------------------------------------

export const cacheService = {
  /**
   * Get value from cache
   * Returns null if not found or cache unavailable
   */
  async get<T>(key: string): Promise<T | null> {
    const client = getClient();
    if (!client) {
      return null;
    }

    try {
      const value = await client.get(key);
      if (!value) {
        stats.misses++;
        return null;
      }

      stats.hits++;
      return JSON.parse(value) as T;
    } catch (error) {
      stats.errors++;
      logger.warn({ error, key }, 'Cache get error');
      return null;
    }
  },

  /**
   * Set value in cache with optional TTL
   */
  async set(key: string, value: unknown, ttlSeconds: number = DEFAULT_TTL): Promise<void> {
    const client = getClient();
    if (!client) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      await client.setex(key, ttlSeconds, serialized);
    } catch (error) {
      stats.errors++;
      logger.warn({ error, key }, 'Cache set error');
    }
  },

  /**
   * Delete a key from cache
   */
  async del(key: string): Promise<void> {
    const client = getClient();
    if (!client) {
      return;
    }

    try {
      await client.del(key);
    } catch (error) {
      stats.errors++;
      logger.warn({ error, key }, 'Cache del error');
    }
  },

  /**
   * Delete keys matching a pattern
   * Use with caution in production (KEYS command can be slow)
   */
  async delPattern(pattern: string): Promise<number> {
    const client = getClient();
    if (!client) {
      return 0;
    }

    try {
      // Use SCAN instead of KEYS for production safety
      let cursor = '0';
      let deletedCount = 0;

      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          await client.del(...keys);
          deletedCount += keys.length;
        }
      } while (cursor !== '0');

      return deletedCount;
    } catch (error) {
      stats.errors++;
      logger.warn({ error, pattern }, 'Cache delPattern error');
      return 0;
    }
  },

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    const client = getClient();
    if (!client) {
      return false;
    }

    try {
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      stats.errors++;
      logger.warn({ error, key }, 'Cache exists error');
      return false;
    }
  },

  /**
   * Get value from cache, or fetch and cache it
   * This is the primary method for cache-aside pattern
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = DEFAULT_TTL
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const result = await fetcher();

    // Cache the result (don't await, fire and forget)
    void this.set(key, result, ttlSeconds);

    return result;
  },

  /**
   * Invalidate all cache entries for a user
   */
  async invalidateUserCache(userId: string): Promise<void> {
    const pattern = CACHE_KEYS.userPattern(userId);
    const deleted = await this.delPattern(pattern);
    if (deleted > 0) {
      logger.debug({ userId, deleted }, 'User cache invalidated');
    }
  },

  /**
   * Invalidate all cache entries for a workspace
   */
  async invalidateWorkspaceCache(workspaceId: string): Promise<void> {
    const pattern = CACHE_KEYS.workspacePattern(workspaceId);
    const deleted = await this.delPattern(pattern);
    if (deleted > 0) {
      logger.debug({ workspaceId, deleted }, 'Workspace cache invalidated');
    }
  },

  /**
   * Invalidate exchange rates cache
   */
  async invalidateExchangeRates(): Promise<void> {
    await this.del(CACHE_KEYS.exchangeRates());
    await this.del(CACHE_KEYS.currencies());
  },

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { enabled: boolean; connected: boolean } {
    return {
      ...stats,
      enabled: REDIS_ENABLED,
      connected: isConnected,
    };
  },

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return REDIS_ENABLED && isConnected;
  },

  /**
   * Warm up common cache entries
   * Call this on app startup if needed
   */
  async warmUp(_dataFetchers: Record<string, () => Promise<unknown>>): Promise<void> {
    if (!this.isAvailable()) {
      logger.info('Cache warmup skipped: cache not available');
      return;
    }

    logger.info('Cache warmup started');
    // Warmup logic can be implemented based on specific needs
    logger.info('Cache warmup completed');
  },

  /**
   * Close the cache connection gracefully
   */
  async close(): Promise<void> {
    if (redis) {
      await redis.quit();
      redis = null;
      isConnected = false;
    }
  },
};

// ----------------------------------------------------------------------------
// Cache Middleware Pattern
// ----------------------------------------------------------------------------

/**
 * Creates a caching wrapper for async handlers
 * Usage:
 *   const cachedResult = await withCache(
 *     CACHE_KEYS.userProfile(userId),
 *     CACHE_TTL.USER_PROFILE
 *   )(async () => userService.getById(userId));
 */
export function withCache<T>(key: string, ttl: number) {
  return async (handler: () => Promise<T>): Promise<T> => {
    return cacheService.getOrSet(key, handler, ttl);
  };
}

/**
 * Creates a caching decorator for service methods
 * Useful for wrapping existing service functions
 */
export function cached<T extends (...args: unknown[]) => Promise<unknown>>(
  keyBuilder: (...args: Parameters<T>) => string,
  ttl: number
) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> {
    const originalMethod = descriptor.value!;

    descriptor.value = async function (this: unknown, ...args: Parameters<T>) {
      const key = keyBuilder(...args);
      return cacheService.getOrSet(key, () => originalMethod.apply(this, args), ttl);
    } as T;

    return descriptor;
  };
}

// ----------------------------------------------------------------------------
// Graceful Shutdown
// ----------------------------------------------------------------------------

process.on('beforeExit', () => {
  void cacheService.close();
});

export default cacheService;
