// ============================================================================
// SESSION SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { redisClient, REDIS_KEYS, setWithExpiry, getJson } from '@/core/database/redis.js';
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  verifyRefreshToken,
  type RefreshTokenPayload,
} from '@/core/crypto/jwt.js';
import { UnauthorizedError, SessionLockedError } from '@/core/middleware/errorHandler.js';
import { randomUUID } from 'crypto';
import * as UAParserModule from 'ua-parser-js';

// Handle both ESM and CJS imports
const UAParser = (UAParserModule as unknown as { default: typeof UAParserModule }).default ?? UAParserModule;

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const SESSION_EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS ?? '24', 10);

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
}

export interface SessionInfo {
  id: string;
  deviceId: string;
  deviceName: string;
  ipAddress: string | null;
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  location: string | null;
  isLocked: boolean;
  lastActiveAt: Date;
  createdAt: Date;
  expiresAt: Date;
}

interface CachedSession {
  userId: string;
  deviceId: string;
  isLocked: boolean;
  workspaceId?: string;
  role?: string;
}

interface ParsedUserAgent {
  browser: string | null;
  os: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | null;
  deviceName: string;
}

// ----------------------------------------------------------------------------
// User Agent Parser
// ----------------------------------------------------------------------------

function parseUserAgent(userAgent?: string): ParsedUserAgent {
  if (!userAgent) {
    return {
      browser: null,
      os: null,
      deviceType: null,
      deviceName: 'Unknown Device',
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parser = new (UAParser as any)(userAgent);
  const result = parser.getResult();

  // Determine device type
  let deviceType: 'desktop' | 'mobile' | 'tablet' | null = null;
  const deviceTypeStr = result.device.type?.toLowerCase();
  if (deviceTypeStr === 'mobile') {
    deviceType = 'mobile';
  } else if (deviceTypeStr === 'tablet') {
    deviceType = 'tablet';
  } else if (result.os.name) {
    // If there's an OS but no device type, assume desktop
    deviceType = 'desktop';
  }

  // Build browser string
  const browser = result.browser.name
    ? `${result.browser.name}${result.browser.version ? ` ${result.browser.version.split('.')[0]}` : ''}`
    : null;

  // Build OS string
  const os = result.os.name
    ? `${result.os.name}${result.os.version ? ` ${result.os.version}` : ''}`
    : null;

  // Build device name
  let deviceName = 'Unknown Device';
  if (result.device.vendor && result.device.model) {
    deviceName = `${result.device.vendor} ${result.device.model}`;
  } else if (result.os.name) {
    deviceName = result.os.name;
    if (browser) {
      deviceName += ` - ${browser}`;
    }
  }

  return {
    browser,
    os,
    deviceType,
    deviceName,
  };
}

// ----------------------------------------------------------------------------
// Session Service
// ----------------------------------------------------------------------------

export const sessionService = {
  /**
   * Create a new session and generate tokens
   */
  async create(
    userId: string,
    deviceId: string,
    email: string,
    metadata?: SessionMetadata
  ): Promise<TokenPair> {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

    // Parse user agent for device info
    const parsedUA = parseUserAgent(metadata?.userAgent);

    // Generate tokens
    const accessToken = signAccessToken({
      sub: userId,
      email,
      deviceId,
    });

    const refreshToken = signRefreshToken({
      sub: userId,
      deviceId,
      sessionId,
    });

    // Store session in database with metadata
    await prisma.session.create({
      data: {
        id: sessionId,
        userId,
        deviceId,
        tokenHash: hashToken(refreshToken),
        ipAddress: metadata?.ipAddress ?? null,
        userAgent: metadata?.userAgent ?? null,
        deviceName: metadata?.deviceName ?? parsedUA.deviceName,
        browser: parsedUA.browser,
        os: parsedUA.os,
        deviceType: parsedUA.deviceType,
        lastActive: new Date(),
        expiresAt,
      },
    });

    // Cache session in Redis for fast lookup
    await this.cacheSession(sessionId, {
      userId,
      deviceId,
      isLocked: false,
    });

    return { accessToken, refreshToken };
  },

  /**
   * Refresh tokens using refresh token
   */
  async refresh(refreshToken: string, metadata?: SessionMetadata): Promise<TokenPair> {
    // Verify refresh token
    let payload: RefreshTokenPayload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Find session
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: {
        user: { select: { email: true } },
        device: true,
      },
    });

    if (!session) {
      throw new UnauthorizedError('Session not found');
    }

    // Check if session is revoked
    if (session.isRevoked) {
      throw new UnauthorizedError('Session has been revoked');
    }

    // Verify token hash
    if (session.tokenHash !== hashToken(refreshToken)) {
      // Token reuse detected - revoke all sessions for this user
      await this.revokeAllUserSessions(session.userId);
      throw new UnauthorizedError('Token reuse detected');
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await this.revoke(session.id);
      throw new UnauthorizedError('Session expired');
    }

    // Check if session is locked
    if (session.isLocked) {
      throw new SessionLockedError();
    }

    // Generate new tokens
    const newAccessToken = signAccessToken({
      sub: session.userId,
      email: session.user.email,
      deviceId: session.deviceId,
    });

    const newRefreshToken = signRefreshToken({
      sub: session.userId,
      deviceId: session.deviceId,
      sessionId: session.id,
    });

    // Update session with new token hash and metadata
    const updateData: Record<string, unknown> = {
      tokenHash: hashToken(newRefreshToken),
      lastActive: new Date(),
    };

    // Update IP if changed
    if (metadata?.ipAddress && metadata.ipAddress !== session.ipAddress) {
      updateData.ipAddress = metadata.ipAddress;
    }

    await prisma.session.update({
      where: { id: session.id },
      data: updateData,
    });

    // Update cache
    await this.cacheSession(session.id, {
      userId: session.userId,
      deviceId: session.deviceId,
      isLocked: false,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  },

  /**
   * Update session last active time
   */
  async updateLastActive(sessionId: string, ipAddress?: string): Promise<void> {
    const updateData: Record<string, unknown> = {
      lastActive: new Date(),
    };

    if (ipAddress) {
      updateData.ipAddress = ipAddress;
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: updateData,
    }).catch(() => {
      // Ignore if session not found
    });
  },

  /**
   * Lock session (due to inactivity)
   */
  async lock(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        isLocked: true,
        lockedAt: new Date(),
      },
    });

    // Update cache
    const cached = await this.getCachedSession(sessionId);
    if (cached) {
      await this.cacheSession(sessionId, { ...cached, isLocked: true });
    }
  },

  /**
   * Unlock session after password verification
   */
  async unlock(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        isLocked: false,
        lockedAt: null,
      },
    });

    // Update cache
    const cached = await this.getCachedSession(sessionId);
    if (cached) {
      await this.cacheSession(sessionId, { ...cached, isLocked: false });
    }
  },

  /**
   * Revoke a session (optionally validates ownership)
   */
  async revoke(sessionId: string, userId?: string): Promise<void> {
    const where = userId ? { id: sessionId, userId } : { id: sessionId };

    // Soft delete by marking as revoked
    await prisma.session.update({
      where: where as { id: string },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    }).catch(() => {
      // Ignore if already deleted or not found
    });

    // Remove from cache
    await redisClient.del(REDIS_KEYS.session(sessionId));
  },

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    const sessions = await prisma.session.findMany({
      where: { userId, isRevoked: false },
      select: { id: true },
    });

    // Soft delete by marking as revoked
    await prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    // Remove from cache
    await Promise.all(
      sessions.map((s) => redisClient.del(REDIS_KEYS.session(s.id)))
    );
  },

  /**
   * Revoke all sessions except the current one
   */
  async revokeAllExcept(userId: string, currentSessionId?: string): Promise<number> {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        isRevoked: false,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
      select: { id: true },
    });

    // Soft delete by marking as revoked
    const result = await prisma.session.updateMany({
      where: {
        userId,
        isRevoked: false,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    // Remove from cache
    await Promise.all(
      sessions.map((s) => redisClient.del(REDIS_KEYS.session(s.id)))
    );

    return result.count;
  },

  /**
   * Revoke all sessions for a device
   */
  async revokeDeviceSessions(deviceId: string): Promise<void> {
    const sessions = await prisma.session.findMany({
      where: { deviceId, isRevoked: false },
      select: { id: true },
    });

    await prisma.session.updateMany({
      where: { deviceId, isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    await Promise.all(
      sessions.map((s) => redisClient.del(REDIS_KEYS.session(s.id)))
    );
  },

  /**
   * Get user's active sessions
   */
  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        device: { select: { name: true, fingerprint: true } },
      },
      orderBy: { lastActive: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      deviceId: s.deviceId,
      deviceName: s.deviceName ?? s.device.name,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      browser: s.browser,
      os: s.os,
      deviceType: s.deviceType,
      location: s.location,
      isLocked: s.isLocked,
      lastActiveAt: s.lastActive,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  },

  /**
   * Get a specific session by token
   */
  async getSessionByToken(token: string): Promise<SessionInfo | null> {
    const tokenHash = hashToken(token);
    const session = await prisma.session.findFirst({
      where: {
        tokenHash,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        device: { select: { name: true } },
      },
    });

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      deviceId: session.deviceId,
      deviceName: session.deviceName ?? session.device.name,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      browser: session.browser,
      os: session.os,
      deviceType: session.deviceType,
      location: session.location,
      isLocked: session.isLocked,
      lastActiveAt: session.lastActive,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
  },

  /**
   * Check if session is valid and not locked
   */
  async validate(sessionId: string): Promise<CachedSession | null> {
    // Try cache first
    const cached = await this.getCachedSession(sessionId);
    if (cached) {
      return cached;
    }

    // Fallback to database
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.expiresAt < new Date() || session.isRevoked) {
      return null;
    }

    // Cache for next time
    const sessionData: CachedSession = {
      userId: session.userId,
      deviceId: session.deviceId,
      isLocked: session.isLocked,
    };
    await this.cacheSession(sessionId, sessionData);

    return sessionData;
  },

  /**
   * Clean up expired and revoked sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true, revokedAt: { lt: thirtyDaysAgo } },
        ],
      },
    });
    return result.count;
  },

  // ----------------------------------------------------------------------------
  // Cache Helpers
  // ----------------------------------------------------------------------------

  async cacheSession(sessionId: string, data: CachedSession): Promise<void> {
    await setWithExpiry(
      REDIS_KEYS.session(sessionId),
      data,
      SESSION_EXPIRY_HOURS * 60 * 60
    );
  },

  getCachedSession(sessionId: string): Promise<CachedSession | null> {
    return getJson<CachedSession>(REDIS_KEYS.session(sessionId));
  },
};

export default sessionService;
