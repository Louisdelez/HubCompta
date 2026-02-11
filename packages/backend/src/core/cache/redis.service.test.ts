// ============================================================================
// REDIS CACHE SERVICE TESTS - Finance Hub
// ============================================================================

import { describe, it, expect, vi } from 'vitest';

// Mock Redis before importing the service
vi.mock('ioredis', () => {
  const mockRedis = {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    scan: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  };

  return {
    Redis: vi.fn().mockImplementation(() => mockRedis),
    default: vi.fn().mockImplementation(() => mockRedis),
  };
});

// Mock environment variables
vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
vi.stubEnv('REDIS_ENABLED', 'true');
vi.stubEnv('CACHE_TTL_DEFAULT', '300');

describe('cacheService', () => {
  describe('CACHE_KEYS', () => {
    it('should generate correct user profile key', async () => {
      const { CACHE_KEYS } = await import('./redis.service.js');
      expect(CACHE_KEYS.userProfile('user123')).toBe('user:user123:profile');
    });

    it('should generate correct user accounts key', async () => {
      const { CACHE_KEYS } = await import('./redis.service.js');
      expect(CACHE_KEYS.userAccounts('user123', 'ws456')).toBe('user:user123:accounts:ws456');
    });

    it('should generate correct workspace members key', async () => {
      const { CACHE_KEYS } = await import('./redis.service.js');
      expect(CACHE_KEYS.workspaceMembers('ws456')).toBe('workspace:ws456:members');
    });

    it('should generate correct exchange rates key', async () => {
      const { CACHE_KEYS } = await import('./redis.service.js');
      expect(CACHE_KEYS.exchangeRates()).toBe('global:exchange-rates');
    });

    it('should generate correct user pattern for invalidation', async () => {
      const { CACHE_KEYS } = await import('./redis.service.js');
      expect(CACHE_KEYS.userPattern('user123')).toBe('user:user123:*');
    });
  });

  describe('CACHE_TTL', () => {
    it('should have correct TTL values', async () => {
      const { CACHE_TTL } = await import('./redis.service.js');
      expect(CACHE_TTL.USER_PROFILE).toBe(300);
      expect(CACHE_TTL.CATEGORIES).toBe(3600);
      expect(CACHE_TTL.DASHBOARD).toBe(60);
      expect(CACHE_TTL.EXCHANGE_RATES).toBe(3600);
    });
  });

  describe('withCache helper', () => {
    it('should create a caching wrapper function', async () => {
      const { withCache } = await import('./redis.service.js');
      const wrapper = withCache('test:key', 300);
      expect(typeof wrapper).toBe('function');
    });
  });
});

describe('cacheService integration scenarios', () => {
  it('should gracefully handle missing Redis connection', async () => {
    // Reset modules to test disabled state
    vi.stubEnv('REDIS_ENABLED', 'false');
    vi.resetModules();

    const { cacheService: disabledService } = await import('./redis.service.js');

    // Should return null when disabled
    const result = await disabledService.get('any:key');
    expect(result).toBeNull();

    // Should not throw on set when disabled
    await expect(disabledService.set('any:key', { data: 'test' })).resolves.toBeUndefined();

    // Restore
    vi.stubEnv('REDIS_ENABLED', 'true');
  });
});
