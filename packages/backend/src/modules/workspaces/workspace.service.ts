// ============================================================================
// WORKSPACE SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError } from '@/core/middleware/errorHandler.js';
import { WORKSPACE } from '@finance-hub/shared';
import type { Workspace, WorkspaceType, MembershipRole } from '@prisma/client';
import type { WorkspaceCreateInput, WorkspaceUpdateInput } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface WorkspaceWithRole extends Workspace {
  role: MembershipRole;
  memberCount: number;
}

// ----------------------------------------------------------------------------
// Workspace Service
// ----------------------------------------------------------------------------

export const workspaceService = {
  /**
   * Create a new workspace
   */
  async create(userId: string, input: WorkspaceCreateInput): Promise<Workspace> {
    // Create workspace and owner membership in a transaction
    const workspace = await prisma.$transaction(async (tx) => {
      // Create workspace
      const ws = await tx.workspace.create({
        data: {
          name: input.name,
          type: input.type as WorkspaceType,
          currency: input.currency ?? 'EUR',
          ownerId: userId,
          settings: {
            fiscalYearStart: WORKSPACE.DEFAULTS.FISCAL_YEAR_START,
            dateFormat: WORKSPACE.DEFAULTS.DATE_FORMAT,
            decimalSeparator: WORKSPACE.DEFAULTS.DECIMAL_SEPARATOR,
            enableProMode: false,
            enableInvestMode: false,
          },
        },
      });

      // Create owner membership
      await tx.membership.create({
        data: {
          workspaceId: ws.id,
          userId,
          role: 'owner',
        },
      });

      return ws;
    });

    return workspace;
  },

  /**
   * Get workspace by ID
   */
  getById(workspaceId: string): Promise<Workspace | null> {
    return prisma.workspace.findUnique({
      where: { id: workspaceId, deletedAt: null },
    });
  },

  /**
   * Get workspace with user's role
   */
  async getWithRole(workspaceId: string, userId: string): Promise<WorkspaceWithRole | null> {
    const membership = await prisma.membership.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
      include: {
        workspace: true,
      },
    });

    if (!membership || membership.workspace.deletedAt) {
      return null;
    }

    const memberCount = await prisma.membership.count({
      where: { workspaceId },
    });

    return {
      ...membership.workspace,
      role: membership.role,
      memberCount,
    };
  },

  /**
   * List workspaces for a user
   */
  async listForUser(userId: string): Promise<WorkspaceWithRole[]> {
    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: {
        workspace: true,
      },
    });

    // Filter out deleted workspaces and get member counts
    const results: WorkspaceWithRole[] = [];

    for (const m of memberships) {
      if (m.workspace.deletedAt) continue;

      const memberCount = await prisma.membership.count({
        where: { workspaceId: m.workspaceId },
      });

      results.push({
        ...m.workspace,
        role: m.role,
        memberCount,
      });
    }

    return results;
  },

  /**
   * Update workspace
   */
  async update(
    workspaceId: string,
    input: WorkspaceUpdateInput
  ): Promise<Workspace> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace || workspace.deletedAt) {
      throw new NotFoundError('Workspace', workspaceId);
    }

    return prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.currency && { currency: input.currency }),
        ...(input.settings && {
          settings: {
            ...(workspace.settings as object),
            ...input.settings,
          },
        }),
      },
    });
  },

  /**
   * Soft delete workspace
   */
  async delete(workspaceId: string): Promise<void> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundError('Workspace', workspaceId);
    }

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { deletedAt: new Date() },
    });
  },

  /**
   * Check if workspace type allows more members
   */
  async canAddMember(workspaceId: string): Promise<boolean> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        _count: { select: { memberships: true } },
      },
    });

    if (!workspace) return false;

    const limit = WORKSPACE.LIMITS[
      `MAX_MEMBERS_${workspace.type.toUpperCase()}` as keyof typeof WORKSPACE.LIMITS
    ];

    return workspace._count.memberships < limit;
  },

  /**
   * Get workspace statistics
   */
  async getStats(workspaceId: string) {
    const [accounts, transactions, documents] = await Promise.all([
      prisma.account.count({
        where: { workspaceId, deletedAt: null },
      }),
      prisma.transaction.count({
        where: { workspaceId, deletedAt: null },
      }),
      prisma.document.count({
        where: { workspaceId, deletedAt: null },
      }),
    ]);

    return { accounts, transactions, documents };
  },
};

export default workspaceService;
