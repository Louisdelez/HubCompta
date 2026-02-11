// ============================================================================
// RATE LIMIT MIDDLEWARE TESTS - HubCompta
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Mock modules - must be defined inline in vi.mock
vi.mock('@/core/database/redis.js', () => {
  return {
    redisClient: {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    },
  };
});

vi.mock('@/core/middleware/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocking
import {
  createRateLimitMiddleware,
  loginRateLimit,
  registerRateLimit,
  apiRateLimit,
  resetRateLimit,
  isBlocked,
  blockIdentifier,
  getRemainingRequests,
  rateLimitConfig,
} from './rateLimit.js';
import { redisClient } from '@/core/database/redis.js';

// Create typed mock references
const mockRedisGet = vi.mocked(redisClient.get);
const mockRedisSet = vi.mocked(redisClient.set);
const mockRedisDel = vi.mocked(redisClient.del);

// ----------------------------------------------------------------------------
// Test Utilities
// ----------------------------------------------------------------------------

function createMockRequest(overrides: Partial<FastifyRequest> = {}): FastifyRequest {
  return {
    ip: '127.0.0.1',
    headers: {},
    user: undefined,
    url: '/test',
    ...overrides,
  } as FastifyRequest;
}

interface MockReplyInternal {
  statusCode: number;
  sentData: unknown;
  headers: Record<string, string | number>;
  header: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

function createMockReply(): { reply: FastifyReply; mock: MockReplyInternal } {
  const mockReply: MockReplyInternal = {
    statusCode: 200,
    sentData: undefined,
    headers: {},
    header: vi.fn(),
    status: vi.fn(),
    send: vi.fn(),
  };

  mockReply.header.mockImplementation((name: string, value: string | number) => {
    mockReply.headers[name] = value;
    return mockReply;
  });
  mockReply.status.mockImplementation((code: number) => {
    mockReply.statusCode = code;
    return mockReply;
  });
  mockReply.send.mockImplementation((data: unknown) => {
    mockReply.sentData = data;
    return mockReply;
  });

  return { reply: mockReply as unknown as FastifyReply, mock: mockReply };
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('Rate Limit Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockRedisDel.mockResolvedValue(1);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rateLimitConfig', () => {
    it('should have correct default values', () => {
      expect(rateLimitConfig.api.max).toBe(100);
      expect(rateLimitConfig.api.windowMs).toBe(60000);
      expect(rateLimitConfig.login.max).toBe(5);
      expect(rateLimitConfig.register.max).toBe(3);
      expect(rateLimitConfig.forgotPassword.max).toBe(3);
      expect(rateLimitConfig.import.max).toBe(10);
      expect(rateLimitConfig.pdfReport.max).toBe(5);
    });
  });

  describe('createRateLimitMiddleware', () => {
    it('should allow request when under limit', async () => {
      const middleware = createRateLimitMiddleware({ category: 'api' });
      const request = createMockRequest();
      const { reply, mock } = createMockReply();

      await middleware(request, reply);

      expect(mock.status).not.toHaveBeenCalledWith(429);
      expect(mock.headers['X-RateLimit-Limit']).toBe(100);
      expect(mock.headers['X-RateLimit-Remaining']).toBe(99);
    });

    it('should block request when limit exceeded', async () => {
      // Simulate limit exceeded
      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          count: 101,
          resetAt: Date.now() + 60000,
        })
      );

      const middleware = createRateLimitMiddleware({ category: 'api' });
      const request = createMockRequest();
      const { reply, mock } = createMockReply();

      await middleware(request, reply);

      expect(mock.status).toHaveBeenCalledWith(429);
      expect(mock.sentData).toMatchObject({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
        },
      });
      expect(mock.headers['Retry-After']).toBeDefined();
    });

    it('should use custom key generator', async () => {
      const keyGenerator = vi.fn().mockReturnValue('custom:key');
      const middleware = createRateLimitMiddleware({
        category: 'api',
        keyGenerator,
      });

      const request = createMockRequest({ body: { email: 'test@example.com' } });
      const { reply } = createMockReply();

      await middleware(request, reply);

      expect(keyGenerator).toHaveBeenCalledWith(request);
    });

    it('should skip rate limiting when skip function returns true', async () => {
      const middleware = createRateLimitMiddleware({
        category: 'api',
        skip: () => true,
      });

      const request = createMockRequest();
      const { reply, mock } = createMockReply();

      await middleware(request, reply);

      expect(mockRedisGet).not.toHaveBeenCalled();
      expect(mock.header).not.toHaveBeenCalled();
    });

    it('should use user ID as identifier when authenticated', async () => {
      const middleware = createRateLimitMiddleware({ category: 'api' });
      const request = createMockRequest({
        user: {
          sub: 'user-123',
          email: 'test@example.com',
          deviceId: 'device-123',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      const { reply } = createMockReply();

      await middleware(request, reply);

      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.stringContaining('user:user-123'),
        expect.any(String),
        'PX',
        expect.any(Number)
      );
    });

    it('should use IP as identifier when not authenticated', async () => {
      const middleware = createRateLimitMiddleware({ category: 'api' });
      const request = createMockRequest({ ip: '192.168.1.100' });
      const { reply } = createMockReply();

      await middleware(request, reply);

      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.stringContaining('ip:192.168.1.100'),
        expect.any(String),
        'PX',
        expect.any(Number)
      );
    });
  });

  describe('loginRateLimit', () => {
    it('should use email as identifier for login requests', async () => {
      const request = createMockRequest({
        body: { email: 'test@example.com', password: 'secret' },
      });
      const { reply } = createMockReply();

      await loginRateLimit(request, reply);

      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.stringContaining('email:test@example.com'),
        expect.any(String),
        'PX',
        expect.any(Number)
      );
    });

    it('should fall back to IP when no email provided', async () => {
      const request = createMockRequest({
        ip: '10.0.0.1',
        body: { password: 'secret' },
      });
      const { reply } = createMockReply();

      await loginRateLimit(request, reply);

      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.stringContaining('ip:10.0.0.1'),
        expect.any(String),
        'PX',
        expect.any(Number)
      );
    });
  });

  describe('registerRateLimit', () => {
    it('should always use IP as identifier for registration', async () => {
      const request = createMockRequest({
        ip: '10.0.0.2',
        body: { email: 'new@example.com' },
      });
      const { reply } = createMockReply();

      await registerRateLimit(request, reply);

      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.stringContaining('ip:10.0.0.2'),
        expect.any(String),
        'PX',
        expect.any(Number)
      );
    });
  });

  describe('resetRateLimit', () => {
    it('should delete the rate limit key', async () => {
      await resetRateLimit('user:123', 'login');

      expect(mockRedisDel).toHaveBeenCalledWith('ratelimit:login:user:123');
    });
  });

  describe('isBlocked', () => {
    it('should return false when no entry exists', async () => {
      mockRedisGet.mockResolvedValue(null);

      const result = await isBlocked('user:123', 'login');

      expect(result).toBe(false);
    });

    it('should return true when blocked and not expired', async () => {
      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          count: 0,
          resetAt: Date.now() + 60000,
          blocked: true,
          blockedUntil: Date.now() + 60000,
        })
      );

      const result = await isBlocked('user:123', 'login');

      expect(result).toBe(true);
    });

    it('should return false when block has expired', async () => {
      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          count: 0,
          resetAt: Date.now() - 1000,
          blocked: true,
          blockedUntil: Date.now() - 1000,
        })
      );

      const result = await isBlocked('user:123', 'login');

      expect(result).toBe(false);
    });
  });

  describe('blockIdentifier', () => {
    it('should create a blocked entry with correct TTL', async () => {
      const blockDuration = 30 * 60 * 1000; // 30 minutes

      await blockIdentifier('user:123', 'login', blockDuration);

      expect(mockRedisSet).toHaveBeenCalledWith(
        'ratelimit:login:user:123',
        expect.stringMatching(/"blocked":true/),
        'PX',
        blockDuration
      );
    });
  });

  describe('getRemainingRequests', () => {
    it('should return max when no entry exists', async () => {
      mockRedisGet.mockResolvedValue(null);

      const result = await getRemainingRequests('user:123', 'api');

      expect(result).toEqual({
        remaining: 100,
        resetAt: null,
      });
    });

    it('should calculate remaining correctly', async () => {
      const resetAt = Date.now() + 30000;
      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          count: 40,
          resetAt,
        })
      );

      const result = await getRemainingRequests('user:123', 'api');

      expect(result).toEqual({
        remaining: 60,
        resetAt,
      });
    });

    it('should return 0 remaining when count exceeds max', async () => {
      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          count: 150,
          resetAt: Date.now() + 30000,
        })
      );

      const result = await getRemainingRequests('user:123', 'api');

      expect(result.remaining).toBe(0);
    });
  });

  describe('X-Forwarded-For handling', () => {
    it('should extract IP from X-Forwarded-For header', async () => {
      const request = createMockRequest({
        ip: '127.0.0.1',
        headers: {
          'x-forwarded-for': '203.0.113.50, 198.51.100.1, 192.0.2.1',
        },
      });
      const { reply } = createMockReply();

      await apiRateLimit(request, reply);

      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.stringContaining('ip:203.0.113.50'),
        expect.any(String),
        'PX',
        expect.any(Number)
      );
    });
  });

  describe('Rate limit headers', () => {
    it('should set all required headers on success', async () => {
      const request = createMockRequest();
      const { reply, mock } = createMockReply();

      await apiRateLimit(request, reply);

      expect(mock.headers['X-RateLimit-Limit']).toBeDefined();
      expect(mock.headers['X-RateLimit-Remaining']).toBeDefined();
      expect(mock.headers['X-RateLimit-Reset']).toBeDefined();
    });

    it('should set Retry-After header on rate limit', async () => {
      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          count: 101,
          resetAt: Date.now() + 30000,
        })
      );

      const request = createMockRequest();
      const { reply, mock } = createMockReply();

      await apiRateLimit(request, reply);

      expect(mock.headers['Retry-After']).toBeDefined();
    });
  });

  describe('Window expiration', () => {
    it('should reset counter when window expires', async () => {
      // First request - window expired
      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          count: 100,
          resetAt: Date.now() - 1000, // Expired
        })
      );

      const request = createMockRequest();
      const { reply, mock } = createMockReply();

      await apiRateLimit(request, reply);

      // Should not be rate limited because window expired
      expect(mock.status).not.toHaveBeenCalledWith(429);
      expect(mock.headers['X-RateLimit-Remaining']).toBe(99);
    });
  });
});
