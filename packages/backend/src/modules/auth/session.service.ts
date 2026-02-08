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
import { NotFoundError, UnauthorizedError, SessionLockedError } from '@/core/middleware/errorHandler.js';
import { AUTH } from '@finance-hub/shared';
import { randomUUID } from 'crypto';
import type { Session } from '@prisma/client';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const SESSION_LOCK_MINUTES = parseInt(process.env.SESSION_LOCK_MINUTES ?? '10', 10);
const SESSION_EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS ?? '24', 10);

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface SessionInfo {
  id: string;
  deviceId: string;
  deviceName: string;
  ipAddress: string | null;
  userAgent: string | null;
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

// ----------------------------------------------------------------------------
// Session Service
// ----------------------------------------------------------------------------

export const sessionService = {
  /**
   * Create a new session and generate tokens
   */
  async create(userId: string, deviceId: string, email: string): Promise<TokenPair> {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

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

    // Store session in database
    await prisma.session.create({
      data: {
        id: sessionId,
        userId,
        deviceId,
        tokenHash: hashToken(refreshToken),
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
  async refresh(refreshToken: string): Promise<TokenPair> {
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

    // Update session with new token hash
    await prisma.session.update({
      where: { id: session.id },
      data: {
        tokenHash: hashToken(newRefreshToken),
        updatedAt: new Date(),
      },
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

    await prisma.session.delete({
      where: where as { id: string },
    }).catch(() => {
      // Ignore if already deleted
    });

    // Remove from cache
    await redisClient.del(REDIS_KEYS.session(sessionId));
  },

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    const sessions = await prisma.session.findMany({
      where: { userId },
      select: { id: true },
    });

    // Delete from database
    await prisma.session.deleteMany({
      where: { userId },
    });

    // Remove from cache
    await Promise.all(
      sessions.map((s) => redisClient.del(REDIS_KEYS.session(s.id)))
    );
  },

  /**
   * Revoke all sessions except the current one
   */
  async revokeAllExcept(userId: string, currentSessionId?: string): Promise<void> {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
      select: { id: true },
    });

    // Delete from database
    await prisma.session.deleteMany({
      where: {
        userId,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
    });

    // Remove from cache
    await Promise.all(
      sessions.map((s) => redisClient.del(REDIS_KEYS.session(s.id)))
    );
  },

  /**
   * Revoke all sessions for a device
   */
  async revokeDeviceSessions(deviceId: string): Promise<void> {
    const sessions = await prisma.session.findMany({
      where: { deviceId },
      select: { id: true },
    });

    await prisma.session.deleteMany({
      where: { deviceId },
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
        expiresAt: { gt: new Date() },
      },
      include: {
        device: { select: { name: true, fingerprint: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      deviceId: s.deviceId,
      deviceName: s.device.name,
      ipAddress: null, // Not stored in current schema
      userAgent: s.device.fingerprint, // Use fingerprint as identifier
      isLocked: s.isLocked,
      lastActiveAt: s.updatedAt,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
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

    if (!session || session.expiresAt < new Date()) {
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
   * Clean up expired sessions
   */
  async cleanupExpired(): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
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

  async getCachedSession(sessionId: string): Promise<CachedSession | null> {
    return getJson<CachedSession>(REDIS_KEYS.session(sessionId));
  },
};

export default sessionService;
