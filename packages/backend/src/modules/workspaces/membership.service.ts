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
  // Family sharing fields
  spendingLimit: number | null;
  approvalRequired: boolean;
  visibleCategories: string[];
  currentMonthSpent?: number;
}

export interface FamilyInviteInput {
  email: string;
  role: MembershipRole;
  spendingLimit?: number;
  approvalRequired?: boolean;
  visibleCategories?: string[];
}

export interface SpendingLimitCheckResult {
  allowed: boolean;
  currentSpent: number;
  limit: number | null;
  remaining: number | null;
}

// ----------------------------------------------------------------------------
// Membership Service
// ----------------------------------------------------------------------------

export const membershipService = {
  /**
   * Get membership by workspace and user
   */
  get(workspaceId: string, userId: string): Promise<Membership | null> {
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
   * List all members of a workspace with spending info
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

    // Get current month spending for members with limits
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const results: MemberInfo[] = [];

    for (const m of memberships) {
      let currentMonthSpent: number | undefined;

      // Only calculate spent amount if member has a spending limit
      if (m.spendingLimit !== null) {
        const spentResult = await prisma.transaction.aggregate({
          where: {
            workspaceId,
            type: 'expense',
            date: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
            deletedAt: null,
            // In a real app, you'd track which user created each transaction
            // For now, we aggregate all expenses for simplicity
          },
          _sum: { amount: true },
        });
        currentMonthSpent = Number(spentResult._sum.amount ?? 0);
      }

      results.push({
        id: m.id,
        userId: m.userId,
        email: m.user.email,
        displayName: m.user.displayName,
        role: m.role,
        joinedAt: m.createdAt,
        spendingLimit: m.spendingLimit ? Number(m.spendingLimit) : null,
        approvalRequired: m.approvalRequired,
        visibleCategories: m.visibleCategories,
        currentMonthSpent,
      });
    }

    return results;
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

  // --------------------------------------------------------------------------
  // Family Sharing Methods
  // --------------------------------------------------------------------------

  /**
   * Invite a family member with optional spending controls
   */
  async inviteFamily(
    workspaceId: string,
    userId: string,
    input: FamilyInviteInput
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
    if (input.role === 'owner') {
      throw new ValidationError('Cannot add member as owner');
    }

    return prisma.membership.create({
      data: {
        workspaceId,
        userId,
        role: input.role,
        spendingLimit: input.spendingLimit ?? null,
        approvalRequired: input.approvalRequired ?? false,
        visibleCategories: input.visibleCategories ?? [],
      },
    });
  },

  /**
   * Set spending limit for a member
   */
  async setSpendingLimit(
    workspaceId: string,
    memberId: string,
    limit: number | null
  ): Promise<Membership> {
    const membership = await prisma.membership.findUnique({
      where: { id: memberId },
    });

    if (!membership || membership.workspaceId !== workspaceId) {
      throw new NotFoundError('Membership', memberId);
    }

    // Cannot set limit on owner
    if (membership.role === 'owner') {
      throw new ForbiddenError('Cannot set spending limit on workspace owner');
    }

    return prisma.membership.update({
      where: { id: memberId },
      data: { spendingLimit: limit },
    });
  },

  /**
   * Set approval required for a member
   */
  async setApprovalRequired(
    workspaceId: string,
    memberId: string,
    required: boolean
  ): Promise<Membership> {
    const membership = await prisma.membership.findUnique({
      where: { id: memberId },
    });

    if (!membership || membership.workspaceId !== workspaceId) {
      throw new NotFoundError('Membership', memberId);
    }

    // Cannot require approval on owner
    if (membership.role === 'owner') {
      throw new ForbiddenError('Cannot require approval for workspace owner');
    }

    return prisma.membership.update({
      where: { id: memberId },
      data: { approvalRequired: required },
    });
  },

  /**
   * Set visible categories for a member
   */
  async setVisibleCategories(
    workspaceId: string,
    memberId: string,
    categoryIds: string[]
  ): Promise<Membership> {
    const membership = await prisma.membership.findUnique({
      where: { id: memberId },
    });

    if (!membership || membership.workspaceId !== workspaceId) {
      throw new NotFoundError('Membership', memberId);
    }

    return prisma.membership.update({
      where: { id: memberId },
      data: { visibleCategories: categoryIds },
    });
  },

  /**
   * Check if a user is within their spending limit
   */
  async checkSpendingLimit(
    userId: string,
    workspaceId: string,
    amount: number
  ): Promise<SpendingLimitCheckResult> {
    const membership = await this.get(workspaceId, userId);

    if (!membership) {
      throw new NotFoundError('Membership', userId);
    }

    // No limit set - always allowed
    if (membership.spendingLimit === null) {
      return {
        allowed: true,
        currentSpent: 0,
        limit: null,
        remaining: null,
      };
    }

    const limit = Number(membership.spendingLimit);

    // Calculate current month spending
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const spentResult = await prisma.transaction.aggregate({
      where: {
        workspaceId,
        type: 'expense',
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        deletedAt: null,
      },
      _sum: { amount: true },
    });

    const currentSpent = Number(spentResult._sum.amount ?? 0);
    const remaining = limit - currentSpent;
    const allowed = currentSpent + amount <= limit;

    return {
      allowed,
      currentSpent,
      limit,
      remaining: Math.max(0, remaining),
    };
  },

  /**
   * Update member family settings
   */
  async updateFamilySettings(
    workspaceId: string,
    memberId: string,
    settings: {
      spendingLimit?: number | null;
      approvalRequired?: boolean;
      visibleCategories?: string[];
    }
  ): Promise<Membership> {
    const membership = await prisma.membership.findUnique({
      where: { id: memberId },
    });

    if (!membership || membership.workspaceId !== workspaceId) {
      throw new NotFoundError('Membership', memberId);
    }

    // Cannot update owner settings
    if (membership.role === 'owner') {
      throw new ForbiddenError('Cannot update family settings for workspace owner');
    }

    return prisma.membership.update({
      where: { id: memberId },
      data: {
        ...(settings.spendingLimit !== undefined && { spendingLimit: settings.spendingLimit }),
        ...(settings.approvalRequired !== undefined && { approvalRequired: settings.approvalRequired }),
        ...(settings.visibleCategories !== undefined && { visibleCategories: settings.visibleCategories }),
      },
    });
  },
};

export default membershipService;
