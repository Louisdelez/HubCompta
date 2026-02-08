// ============================================================================
// MEMBERSHIP SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { ConflictError, NotFoundError, ForbiddenError, ValidationError } from '@/core/middleware/errorHandler.js';
import { workspaceService } from './workspace.service.js';
import type { Membership, MembershipRole } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface MemberInfo {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  role: MembershipRole;
  joinedAt: Date;
}

// ----------------------------------------------------------------------------
// Membership Service
// ----------------------------------------------------------------------------

export const membershipService = {
  /**
   * Get membership by workspace and user
   */
  async get(workspaceId: string, userId: string): Promise<Membership | null> {
    return prisma.membership.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
    });
  },

  /**
   * Check if user is member of workspace
   */
  async isMember(workspaceId: string, userId: string): Promise<boolean> {
    const membership = await this.get(workspaceId, userId);
    return membership !== null;
  },

  /**
   * Get user's role in workspace
   */
  async getRole(workspaceId: string, userId: string): Promise<MembershipRole | null> {
    const membership = await this.get(workspaceId, userId);
    return membership?.role ?? null;
  },

  /**
   * List all members of a workspace
   */
  async listMembers(workspaceId: string): Promise<MemberInfo[]> {
    const memberships = await prisma.membership.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // Owner first
        { createdAt: 'asc' },
      ],
    });

    return memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      displayName: m.user.displayName,
      role: m.role,
      joinedAt: m.createdAt,
    }));
  },

  /**
   * Add a member to workspace
   */
  async addMember(
    workspaceId: string,
    userId: string,
    role: MembershipRole
  ): Promise<Membership> {
    // Check if already a member
    const existing = await this.get(workspaceId, userId);
    if (existing) {
      throw new ConflictError('User is already a member of this workspace');
    }

    // Check member limit
    const canAdd = await workspaceService.canAddMember(workspaceId);
    if (!canAdd) {
      throw new ForbiddenError('Workspace has reached its member limit');
    }

    // Cannot add as owner
    if (role === 'owner') {
      throw new ValidationError('Cannot add member as owner');
    }

    return prisma.membership.create({
      data: {
        workspaceId,
        userId,
        role,
      },
    });
  },

  /**
   * Update member role
   */
  async updateRole(
    workspaceId: string,
    memberId: string,
    newRole: MembershipRole,
    actorId: string
  ): Promise<Membership> {
    const membership = await prisma.membership.findUnique({
      where: { id: memberId },
      include: { workspace: true },
    });

    if (!membership || membership.workspaceId !== workspaceId) {
      throw new NotFoundError('Membership', memberId);
    }

    // Cannot change owner's role
    if (membership.role === 'owner') {
      throw new ForbiddenError('Cannot change owner role');
    }

    // Cannot set role to owner
    if (newRole === 'owner') {
      throw new ValidationError('Cannot change role to owner');
    }

    // Cannot change own role (except owner can)
    if (membership.userId === actorId) {
      const actorMembership = await this.get(workspaceId, actorId);
      if (actorMembership?.role !== 'owner') {
        throw new ForbiddenError('Cannot change your own role');
      }
    }

    return prisma.membership.update({
      where: { id: memberId },
      data: { role: newRole },
    });
  },

  /**
   * Remove member from workspace
   */
  async removeMember(
    workspaceId: string,
    memberId: string,
    actorId: string
  ): Promise<void> {
    const membership = await prisma.membership.findUnique({
      where: { id: memberId },
    });

    if (!membership || membership.workspaceId !== workspaceId) {
      throw new NotFoundError('Membership', memberId);
    }

    // Cannot remove owner
    if (membership.role === 'owner') {
      throw new ForbiddenError('Cannot remove workspace owner');
    }

    // If removing self (leaving), allow it
    if (membership.userId !== actorId) {
      // Check actor has permission
      const actorRole = await this.getRole(workspaceId, actorId);
      if (actorRole !== 'owner') {
        throw new ForbiddenError('Only owner can remove members');
      }
    }

    await prisma.membership.delete({
      where: { id: memberId },
    });
  },

  /**
   * Transfer ownership
   */
  async transferOwnership(
    workspaceId: string,
    newOwnerId: string,
    currentOwnerId: string
  ): Promise<void> {
    // Verify current owner
    const currentMembership = await this.get(workspaceId, currentOwnerId);
    if (currentMembership?.role !== 'owner') {
      throw new ForbiddenError('Only owner can transfer ownership');
    }

    // Verify new owner is a member
    const newOwnerMembership = await this.get(workspaceId, newOwnerId);
    if (!newOwnerMembership) {
      throw new NotFoundError('Member', newOwnerId);
    }

    // Transfer in transaction
    await prisma.$transaction([
      // Demote current owner to admin
      prisma.membership.update({
        where: { id: currentMembership.id },
        data: { role: 'admin' },
      }),
      // Promote new owner
      prisma.membership.update({
        where: { id: newOwnerMembership.id },
        data: { role: 'owner' },
      }),
      // Update workspace owner
      prisma.workspace.update({
        where: { id: workspaceId },
        data: { ownerId: newOwnerId },
      }),
    ]);
  },
};

export default membershipService;
