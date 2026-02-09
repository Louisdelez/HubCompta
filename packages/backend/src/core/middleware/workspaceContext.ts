// ============================================================================
// WORKSPACE CONTEXT MIDDLEWARE - Finance Hub
// ============================================================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../database/client.js';
import { ForbiddenError, NotFoundError, UnauthorizedError } from './errorHandler.js';
import type { MembershipRole } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface WorkspaceContext {
  workspaceId: string;
  workspaceName: string;
  workspaceType: string;
  role: MembershipRole;
  userId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    workspace?: WorkspaceContext;
  }
}

// ----------------------------------------------------------------------------
// Middleware
// ----------------------------------------------------------------------------

/**
 * Workspace context middleware
 * Validates workspace access and attaches context to request
 */
export async function workspaceContextMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  // Get user from JWT (must be authenticated)
  const user = request.user as { sub: string } | undefined;
  if (!user?.sub) {
    throw new UnauthorizedError('Authentication required');
  }

  // Get workspace ID from header or route param
  const workspaceId =
    (request.headers['x-workspace-id'] as string) ||
    (request.params as { workspaceId?: string })?.workspaceId;

  if (!workspaceId) {
    throw new ForbiddenError('Workspace ID required');
  }

  // Fetch workspace and membership in one query
  const membership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: user.sub,
      },
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          type: true,
          deletedAt: true,
        },
      },
    },
  });

  // Check if user has access
  if (!membership) {
    throw new ForbiddenError('Access to this workspace denied');
  }

  // Check if workspace is not deleted
  if (membership.workspace.deletedAt) {
    throw new NotFoundError('Workspace', workspaceId);
  }

  // Attach workspace context to request
  request.workspace = {
    workspaceId: membership.workspace.id,
    workspaceName: membership.workspace.name,
    workspaceType: membership.workspace.type,
    role: membership.role as MembershipRole,
    userId: user.sub,
  };
}

// ----------------------------------------------------------------------------
// Role-based Access Control Helpers
// ----------------------------------------------------------------------------

import { PERMISSIONS, ROLE_HIERARCHY } from '@finance-hub/shared';

type Permission = keyof typeof PERMISSIONS;

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: MembershipRole, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission] as readonly string[];
  return allowedRoles.includes(role);
}

/**
 * Check if role1 has higher or equal privileges than role2
 */
export function isRoleAtLeast(role: MembershipRole, minimumRole: MembershipRole): boolean {
  const roleIndex = ROLE_HIERARCHY.indexOf(role as (typeof ROLE_HIERARCHY)[number]);
  const minIndex = ROLE_HIERARCHY.indexOf(minimumRole as (typeof ROLE_HIERARCHY)[number]);
  return roleIndex >= minIndex;
}

/**
 * Create a permission check middleware
 */
export function requirePermission(permission: Permission) {
  return function permissionCheck(
    request: FastifyRequest,
    _reply: FastifyReply
  ): void {
    if (!request.workspace) {
      throw new ForbiddenError('Workspace context required');
    }

    if (!hasPermission(request.workspace.role, permission)) {
      throw new ForbiddenError(`Permission denied: ${permission}`);
    }
  };
}

/**
 * Create a role check middleware
 */
export function requireRole(minimumRole: MembershipRole) {
  return function roleCheck(
    request: FastifyRequest,
    _reply: FastifyReply
  ): void {
    if (!request.workspace) {
      throw new ForbiddenError('Workspace context required');
    }

    if (!isRoleAtLeast(request.workspace.role, minimumRole)) {
      throw new ForbiddenError(`Minimum role required: ${minimumRole}`);
    }
  };
}
