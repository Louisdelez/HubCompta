// ============================================================================
// AUTH GUARD MIDDLEWARE - Finance Hub
// ============================================================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '@/core/crypto/jwt.js';
import { UnauthorizedError, SessionLockedError } from '@/core/middleware/errorHandler.js';
import { sessionService } from '@/modules/auth/session.service.js';
import type { TokenPayload } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
    sessionId?: string;
  }
}

// ----------------------------------------------------------------------------
// Auth Guard
// ----------------------------------------------------------------------------

/**
 * Authentication guard middleware
 * Verifies JWT token and attaches user to request
 */
export async function authGuard(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  // Get token from Authorization header
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  // Verify token
  let payload: TokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }

  // Attach user to request
  request.user = payload;
}

/**
 * Session validation guard
 * Checks if session is valid and not locked
 * Use after authGuard for endpoints that need session validation
 */
export async function sessionGuard(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    throw new UnauthorizedError('Authentication required');
  }

  // For now, we don't have sessionId in the access token
  // Session validation happens during token refresh
  // This guard can be extended to validate sessions from Redis cache
}

/**
 * Combined auth + session guard
 */
export async function authenticatedGuard(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await authGuard(request, reply);
  await sessionGuard(request, reply);
}

// ----------------------------------------------------------------------------
// Optional Auth
// ----------------------------------------------------------------------------

/**
 * Optional authentication - doesn't throw if no token
 * Useful for endpoints that work differently for authenticated vs anonymous users
 */
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return; // No token, continue without user
  }

  const token = authHeader.slice(7);

  try {
    request.user = verifyAccessToken(token);
  } catch {
    // Invalid token, continue without user
  }
}

// ----------------------------------------------------------------------------
// Instance Admin Guard
// ----------------------------------------------------------------------------

/**
 * Instance admin guard
 * Requires user to be an instance admin
 */
export async function instanceAdminGuard(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await authGuard(request, reply);

  // Check if user is instance admin
  // This requires a database lookup since isInstanceAdmin is not in the JWT
  const { prisma } = await import('@/core/database/client.js');

  const user = await prisma.user.findUnique({
    where: { id: request.user!.sub },
    select: { isInstanceAdmin: true },
  });

  if (!user?.isInstanceAdmin) {
    throw new UnauthorizedError('Instance admin access required');
  }
}
