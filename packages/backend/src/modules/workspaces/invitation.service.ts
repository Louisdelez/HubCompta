// ============================================================================
// INVITATION SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { redisClient } from '@/core/database/redis.js';
import { ConflictError, NotFoundError, ValidationError } from '@/core/middleware/errorHandler.js';
import { membershipService } from './membership.service.js';
import { workspaceService } from './workspace.service.js';
import { randomBytes } from 'crypto';
import type { MembershipRole } from '@prisma/client';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const INVITATION_EXPIRY_DAYS = 7;
const INVITATION_PREFIX = 'invitation:';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface Invitation {
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: MembershipRole;
  invitedBy: string;
  invitedByName: string;
  expiresAt: Date;
  createdAt: Date;
}

interface StoredInvitation {
  workspaceId: string;
  email: string;
  role: MembershipRole;
  invitedBy: string;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function generateInviteCode(): string {
  return randomBytes(16).toString('hex');
}

function getInviteKey(code: string): string {
  return `${INVITATION_PREFIX}${code}`;
}

function getInvitesByEmailKey(email: string): string {
  return `${INVITATION_PREFIX}email:${email.toLowerCase()}`;
}

// ----------------------------------------------------------------------------
// Invitation Service
// ----------------------------------------------------------------------------

export const invitationService = {
  /**
   * Create an invitation
   */
  async create(
    workspaceId: string,
    email: string,
    role: MembershipRole,
    invitedBy: string
  ): Promise<{ code: string; invitation: Invitation }> {
    // Validate role
    if (role === 'owner') {
      throw new ValidationError('Cannot invite as owner');
    }

    // Check workspace exists
    const workspace = await workspaceService.getById(workspaceId);
    if (!workspace) {
      throw new NotFoundError('Workspace', workspaceId);
    }

    // Check if user already exists and is a member
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      const isMember = await membershipService.isMember(workspaceId, existingUser.id);
      if (isMember) {
        throw new ConflictError('User is already a member of this workspace');
      }
    }

    // Check member limit
    const canAdd = await workspaceService.canAddMember(workspaceId);
    if (!canAdd) {
      throw new ValidationError('Workspace has reached its member limit');
    }

    // Get inviter info
    const inviter = await prisma.user.findUnique({
      where: { id: invitedBy },
      select: { displayName: true },
    });

    // Generate invite code
    const code = generateInviteCode();
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Store invitation in Redis
    const stored: StoredInvitation = {
      workspaceId,
      email: email.toLowerCase(),
      role,
      invitedBy,
      createdAt: new Date().toISOString(),
    };

    await redisClient.setex(
      getInviteKey(code),
      INVITATION_EXPIRY_DAYS * 24 * 60 * 60,
      JSON.stringify(stored)
    );

    // Also index by email for lookup
    await redisClient.sadd(getInvitesByEmailKey(email), code);
    await redisClient.expire(
      getInvitesByEmailKey(email),
      INVITATION_EXPIRY_DAYS * 24 * 60 * 60
    );

    const invitation: Invitation = {
      id: code,
      workspaceId,
      workspaceName: workspace.name,
      email: email.toLowerCase(),
      role,
      invitedBy,
      invitedByName: inviter?.displayName ?? 'Unknown',
      expiresAt,
      createdAt: new Date(),
    };

    return { code, invitation };
  },

  /**
   * Get invitation by code
   */
  async getByCode(code: string): Promise<Invitation | null> {
    const stored = await redisClient.get(getInviteKey(code));
    if (!stored) return null;

    const data = JSON.parse(stored) as StoredInvitation;

    // Get workspace and inviter info
    const [workspace, inviter] = await Promise.all([
      workspaceService.getById(data.workspaceId),
      prisma.user.findUnique({
        where: { id: data.invitedBy },
        select: { displayName: true },
      }),
    ]);

    if (!workspace) return null;

    // Calculate expiry
    const ttl = await redisClient.ttl(getInviteKey(code));
    const expiresAt = new Date(Date.now() + ttl * 1000);

    return {
      id: code,
      workspaceId: data.workspaceId,
      workspaceName: workspace.name,
      email: data.email,
      role: data.role,
      invitedBy: data.invitedBy,
      invitedByName: inviter?.displayName ?? 'Unknown',
      expiresAt,
      createdAt: new Date(data.createdAt),
    };
  },

  /**
   * Accept an invitation
   */
  async accept(code: string, userId: string): Promise<void> {
    const invitation = await this.getByCode(code);
    if (!invitation) {
      throw new NotFoundError('Invitation', code);
    }

    // Verify user email matches invitation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (user?.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ValidationError('This invitation is for a different email address');
    }

    // Add member
    await membershipService.addMember(
      invitation.workspaceId,
      userId,
      invitation.role
    );

    // Delete invitation
    await this.revoke(code);
  },

  /**
   * Revoke an invitation
   */
  async revoke(code: string): Promise<void> {
    const stored = await redisClient.get(getInviteKey(code));
    if (stored) {
      const data = JSON.parse(stored) as StoredInvitation;
      await redisClient.srem(getInvitesByEmailKey(data.email), code);
    }
    await redisClient.del(getInviteKey(code));
  },

  /**
   * List pending invitations for a workspace
   */
  async listForWorkspace(workspaceId: string): Promise<Invitation[]> {
    // This is inefficient for large numbers of invitations
    // In production, you'd want a proper database table for invitations
    // For now, we scan Redis keys (not recommended for production)
    const pattern = `${INVITATION_PREFIX}*`;
    const keys = await redisClient.keys(pattern);

    const invitations: Invitation[] = [];

    for (const key of keys) {
      if (key.includes(':email:')) continue; // Skip email index keys

      const code = key.replace(INVITATION_PREFIX, '');
      const invitation = await this.getByCode(code);

      if (invitation && invitation.workspaceId === workspaceId) {
        invitations.push(invitation);
      }
    }

    return invitations;
  },

  /**
   * Get invitations for a user by email
   */
  async getForEmail(email: string): Promise<Invitation[]> {
    const codes = await redisClient.smembers(getInvitesByEmailKey(email));
    const invitations: Invitation[] = [];

    for (const code of codes) {
      const invitation = await this.getByCode(code);
      if (invitation) {
        invitations.push(invitation);
      }
    }

    return invitations;
  },
};

export default invitationService;
