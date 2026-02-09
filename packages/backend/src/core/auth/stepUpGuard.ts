// ============================================================================
// STEP-UP AUTH GUARD - Finance Hub
// ============================================================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '@/core/middleware/errorHandler.js';
import { redisClient } from '@/core/database/redis.js';
import { verifyPassword } from '@/core/crypto/password.js';
import { prisma } from '@/core/database/client.js';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const STEP_UP_VALIDITY_SECONDS = 5 * 60; // 5 minutes

// Actions that require step-up authentication
export const SENSITIVE_ACTIONS = [
  'export',
  'vault_access',
  'security_settings',
  'member_management',
  'delete_workspace',
  'change_password',
  'remove_mfa',
] as const;

export type SensitiveAction = (typeof SENSITIVE_ACTIONS)[number];

// ----------------------------------------------------------------------------
// Step-Up Auth
// ----------------------------------------------------------------------------

/**
 * Generate step-up key for Redis
 */
function getStepUpKey(userId: string, action: SensitiveAction): string {
  return `stepup:${userId}:${action}`;
}

/**
 * Request step-up authentication
 * This should be called when a sensitive action is attempted without step-up
 */
export function requireStepUp(action: SensitiveAction): never {
  throw new ForbiddenError(`Step-up authentication required for: ${action}`);
}

/**
 * Verify step-up authentication with password
 */
export async function verifyStepUp(
  userId: string,
  password: string,
  action: SensitiveAction
): Promise<boolean> {
  // Get user's password hash
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  // Verify password
  const isValid = await verifyPassword(user.passwordHash, password);

  if (!isValid) {
    return false;
  }

  // Grant step-up for this action
  await redisClient.setex(
    getStepUpKey(userId, action),
    STEP_UP_VALIDITY_SECONDS,
    Date.now().toString()
  );

  return true;
}

/**
 * Check if user has valid step-up for an action
 */
export async function hasStepUp(
  userId: string,
  action: SensitiveAction
): Promise<boolean> {
  const value = await redisClient.get(getStepUpKey(userId, action));
  return value !== null;
}

/**
 * Revoke step-up for an action
 */
export async function revokeStepUp(
  userId: string,
  action: SensitiveAction
): Promise<void> {
  await redisClient.del(getStepUpKey(userId, action));
}

/**
 * Revoke all step-ups for a user
 */
export async function revokeAllStepUps(userId: string): Promise<void> {
  const keys = SENSITIVE_ACTIONS.map((action) => getStepUpKey(userId, action));
  await redisClient.del(...keys);
}

// ----------------------------------------------------------------------------
// Step-Up Guard Middleware Factory
// ----------------------------------------------------------------------------

/**
 * Create a step-up guard middleware for a specific action
 */
export function stepUpGuard(action: SensitiveAction) {
  return async function stepUpCheck(
    request: FastifyRequest,
    _reply: FastifyReply
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const hasValidStepUp = await hasStepUp(request.user.sub, action);

    if (!hasValidStepUp) {
      throw new ForbiddenError(
        JSON.stringify({
          code: 'STEP_UP_REQUIRED',
          action,
          message: `Re-authentication required for: ${action}`,
        })
      );
    }
  };
}

// ----------------------------------------------------------------------------
// Step-Up Verify Endpoint Helper
// ----------------------------------------------------------------------------

export interface StepUpVerifyRequest {
  password: string;
  action: SensitiveAction;
}

export interface StepUpVerifyResponse {
  success: boolean;
  expiresIn: number;
}

/**
 * Handle step-up verification request
 */
export async function handleStepUpVerify(
  userId: string,
  password: string,
  action: SensitiveAction
): Promise<StepUpVerifyResponse> {
  // Validate action
  if (!SENSITIVE_ACTIONS.includes(action)) {
    throw new ForbiddenError('Invalid action');
  }

  const success = await verifyStepUp(userId, password, action);

  return {
    success,
    expiresIn: success ? STEP_UP_VALIDITY_SECONDS : 0,
  };
}
