// ============================================================================
// WORKSPACE ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { workspaceService } from '@/modules/workspaces/workspace.service.js';
import { membershipService } from '@/modules/workspaces/membership.service.js';
import { invitationService } from '@/modules/workspaces/invitation.service.js';
import { settlementService } from '@/modules/workspaces/settlement.service.js';
import { auditService, AUDIT_ACTIONS } from '@/modules/audit/audit.service.js';
import { insightsService } from '@/modules/notifications/insights.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission, requireRole } from '@/core/middleware/workspaceContext.js';
import {
  workspaceCreateSchema,
  workspaceUpdateSchema,
  memberInviteSchema,
  memberUpdateSchema,
  familyInviteSchema,
  memberFamilySettingsSchema,
} from '@finance-hub/shared';
import { ForbiddenError } from '@/core/middleware/errorHandler.js';
import { prisma } from '@/core/database/client.js';

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export function workspaceRoutes(app: FastifyInstance): void {
  // Apply auth guard to all routes
  app.addHook('preHandler', authGuard);

  // --------------------------------------------------------------------------
  // GET /workspaces - List user's workspaces
  // --------------------------------------------------------------------------
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaces = await workspaceService.listForUser(request.user!.sub);

    return reply.send({
      success: true,
      data: workspaces,
    });
  });

  // --------------------------------------------------------------------------
  // POST /workspaces - Create workspace
  // --------------------------------------------------------------------------
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = workspaceCreateSchema.parse(request.body);
    const workspace = await workspaceService.create(request.user!.sub, input);

    await auditService.log({
      userId: request.user!.sub,
      workspaceId: workspace.id,
      action: AUDIT_ACTIONS.WORKSPACE_CREATED,
      entityType: 'workspace',
      entityId: workspace.id,
      changes: { name: workspace.name, type: workspace.type },
      ipAddress: request.ip,
    });

    return reply.status(201).send({
      success: true,
      data: workspace,
    });
  });

  // --------------------------------------------------------------------------
  // GET /workspaces/:id - Get workspace details
  // --------------------------------------------------------------------------
  app.get(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const workspace = await workspaceService.getWithRole(id, request.user!.sub);

      if (!workspace) {
        throw new ForbiddenError('Access denied');
      }

      const stats = await workspaceService.getStats(id);

      return reply.send({
        success: true,
        data: { ...workspace, stats },
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /workspaces/:id - Update workspace
  // --------------------------------------------------------------------------
  app.patch<{ Params: { id: string; workspaceId?: string } }>(
    '/:id',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('workspace:update'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const input = workspaceUpdateSchema.parse(request.body);

      const workspace = await workspaceService.update(id, input);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId: id,
        action: AUDIT_ACTIONS.WORKSPACE_UPDATED,
        entityType: 'workspace',
        entityId: id,
        changes: input,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: workspace,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /workspaces/:id - Delete workspace
  // --------------------------------------------------------------------------
  app.delete<{ Params: { id: string; workspaceId?: string } }>(
    '/:id',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requireRole('owner'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const stats = await workspaceService.getStats(id);

      await workspaceService.delete(id);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId: id,
        action: AUDIT_ACTIONS.WORKSPACE_DELETED,
        entityType: 'workspace',
        entityId: id,
        changes: stats,
        ipAddress: request.ip,
        severity: 'warning',
      });

      return reply.send({
        success: true,
        data: { message: 'Workspace deleted' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:id/members - List members
  // --------------------------------------------------------------------------
  app.get<{ Params: { id: string; workspaceId?: string } }>(
    '/:id/members',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:read'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const members = await membershipService.listMembers(id);

      return reply.send({
        success: true,
        data: members,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:id/invite - Invite member
  // --------------------------------------------------------------------------
  app.post<{ Params: { id: string; workspaceId?: string } }>(
    '/:id/invite',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:invite'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const input = memberInviteSchema.parse(request.body);

      const { code, invitation } = await invitationService.create(
        id,
        input.email,
        input.role,
        request.user!.sub
      );

      await auditService.log({
        userId: request.user!.sub,
        workspaceId: id,
        action: AUDIT_ACTIONS.WORKSPACE_MEMBER_INVITED,
        changes: { email: input.email, role: input.role },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: {
          invitation,
          inviteLink: `/invite/${code}`,
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:id/invitations - List pending invitations
  // --------------------------------------------------------------------------
  app.get<{ Params: { id: string; workspaceId?: string } }>(
    '/:id/invitations',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:invite'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const invitations = await invitationService.listForWorkspace(id);

      return reply.send({
        success: true,
        data: invitations,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /workspaces/:id/invitations/:code - Revoke invitation
  // --------------------------------------------------------------------------
  app.delete<{ Params: { id: string; code: string; workspaceId?: string } }>(
    '/:id/invitations/:code',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:invite'),
      ],
    },
    async (request, reply) => {
      const { code } = request.params;
      await invitationService.revoke(code);

      return reply.send({
        success: true,
        data: { message: 'Invitation revoked' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /workspaces/:id/members/:memberId - Update member role
  // --------------------------------------------------------------------------
  app.patch<{ Params: { id: string; memberId: string; workspaceId?: string } }>(
    '/:id/members/:memberId',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:update'),
      ],
    },
    async (request, reply) => {
      const { id, memberId } = request.params;
      const input = memberUpdateSchema.parse(request.body);

      const membership = await membershipService.updateRole(
        id,
        memberId,
        input.role,
        request.user!.sub
      );

      await auditService.log({
        userId: request.user!.sub,
        workspaceId: id,
        action: AUDIT_ACTIONS.WORKSPACE_MEMBER_ROLE_CHANGED,
        entityType: 'membership',
        entityId: memberId,
        changes: { newRole: input.role },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: membership,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /workspaces/:id/members/:memberId - Remove member
  // --------------------------------------------------------------------------
  app.delete<{ Params: { id: string; memberId: string; workspaceId?: string } }>(
    '/:id/members/:memberId',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:remove'),
      ],
    },
    async (request, reply) => {
      const { id, memberId } = request.params;

      await membershipService.removeMember(id, memberId, request.user!.sub);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId: id,
        action: AUDIT_ACTIONS.WORKSPACE_MEMBER_REMOVED,
        entityType: 'membership',
        entityId: memberId,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: { message: 'Member removed' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:id/members/invite - Family invite with spending controls
  // --------------------------------------------------------------------------
  app.post<{ Params: { id: string; workspaceId?: string } }>(
    '/:id/members/invite',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:invite'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const input = familyInviteSchema.parse(request.body);

      // First, try to find user by email
      const { code, invitation } = await invitationService.create(
        id,
        input.email,
        input.role,
        request.user!.sub,
        {
          spendingLimit: input.spendingLimit ?? undefined,
          approvalRequired: input.approvalRequired,
          visibleCategories: input.visibleCategories,
        }
      );

      await auditService.log({
        userId: request.user!.sub,
        workspaceId: id,
        action: AUDIT_ACTIONS.WORKSPACE_MEMBER_INVITED,
        changes: {
          email: input.email,
          role: input.role,
          spendingLimit: input.spendingLimit,
          approvalRequired: input.approvalRequired,
        },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: {
          invitation,
          inviteLink: `/invite/${code}`,
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /workspaces/:id/members/:memberId/settings - Update family settings
  // --------------------------------------------------------------------------
  app.patch<{ Params: { id: string; memberId: string; workspaceId?: string } }>(
    '/:id/members/:memberId/settings',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:update'),
      ],
    },
    async (request, reply) => {
      const { id, memberId } = request.params;
      const input = memberFamilySettingsSchema.parse(request.body);

      const membership = await membershipService.updateFamilySettings(
        id,
        memberId,
        input
      );

      await auditService.log({
        userId: request.user!.sub,
        workspaceId: id,
        action: 'workspace.member.settings_updated',
        entityType: 'membership',
        entityId: memberId,
        changes: input,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: membership,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:id/members/:memberId/spending - Check spending limit
  // --------------------------------------------------------------------------
  app.get<{ Params: { id: string; memberId: string; workspaceId?: string } }>(
    '/:id/members/:memberId/spending',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:read'),
      ],
    },
    async (request, reply) => {
      const { memberId } = request.params;

      // Get the membership to find the user
      const members = await membershipService.listMembers(request.params.id);
      const member = members.find((m) => m.id === memberId);

      if (!member) {
        throw new ForbiddenError('Member not found');
      }

      const spendingCheck = await membershipService.checkSpendingLimit(
        member.userId,
        request.params.id,
        0 // Check current status only
      );

      return reply.send({
        success: true,
        data: {
          ...spendingCheck,
          memberName: member.displayName,
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:id/family/overview - Get family workspace overview
  // --------------------------------------------------------------------------
  app.get<{ Params: { id: string; workspaceId?: string } }>(
    '/:id/family/overview',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:read'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;

      // Get workspace info
      const workspace = await workspaceService.getById(id);
      if (!workspace) {
        throw new ForbiddenError('Workspace not found');
      }

      // Get members with spending info
      const members = await membershipService.listMembers(id);

      // Count pending approvals (transactions from members with approvalRequired)
      const membersRequiringApproval = members
        .filter((m) => m.approvalRequired)
        .map((m) => m.userId);

      let pendingApprovalsCount = 0;
      if (membersRequiringApproval.length > 0) {
        // For now, count pending transactions - in a real implementation,
        // you'd have a separate pending_approval status on transactions
        pendingApprovalsCount = await prisma.transaction.count({
          where: {
            workspaceId: id,
            status: 'pending',
            deletedAt: null,
          },
        });
      }

      // Calculate total spent this month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const totalSpentResult = await prisma.transaction.aggregate({
        where: {
          workspaceId: id,
          type: 'expense',
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          deletedAt: null,
        },
        _sum: { amount: true },
      });

      const totalSpentThisMonth = Math.abs(Number(totalSpentResult._sum.amount ?? 0));

      // Calculate total budget limit (sum of all member limits)
      const totalBudget = members.reduce((sum, m) => {
        return sum + (m.spendingLimit ?? 0);
      }, 0);

      return reply.send({
        success: true,
        data: {
          members: members.map((m) => ({
            id: m.id,
            displayName: m.displayName,
            role: m.role,
            spendingLimit: m.spendingLimit,
            currentMonthSpent: m.currentMonthSpent ?? 0,
            approvalRequired: m.approvalRequired,
          })),
          pendingApprovalsCount,
          totalSpentThisMonth,
          totalBudget,
          currency: workspace.currency,
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:id/transactions/pending-approval - Get pending approvals
  // --------------------------------------------------------------------------
  app.get<{
    Params: { id: string; workspaceId?: string };
    Querystring: { limit?: string };
  }>(
    '/:id/transactions/pending-approval',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:update'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;

      // Get pending transactions
      const pendingTransactions = await prisma.transaction.findMany({
        where: {
          workspaceId: id,
          status: 'pending',
          deletedAt: null,
        },
        include: {
          category: {
            select: {
              name: true,
              icon: true,
            },
          },
          account: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      // For now, we'll use a simplified approach - in a real app you'd track who created each transaction
      // Get workspace members to show "requested by" info
      const members = await membershipService.listMembers(id);
      const firstMember = members.find((m) => m.role !== 'owner') ?? members[0];

      const result = pendingTransactions.map((t) => ({
        id: t.id,
        description: t.description,
        amount: Math.abs(Number(t.amount)),
        currency: t.currency,
        date: t.date.toISOString(),
        categoryName: t.category?.name ?? null,
        categoryIcon: t.category?.icon ?? null,
        accountName: t.account.name,
        requestedBy: {
          id: firstMember?.userId ?? '',
          displayName: firstMember?.displayName ?? 'Unknown',
          email: firstMember?.email ?? '',
        },
        createdAt: t.createdAt.toISOString(),
      }));

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:id/transactions/:transactionId/approve - Approve transaction
  // --------------------------------------------------------------------------
  app.post<{ Params: { id: string; transactionId: string; workspaceId?: string } }>(
    '/:id/transactions/:transactionId/approve',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:update'),
      ],
    },
    async (request, reply) => {
      const { id, transactionId } = request.params;

      // Update transaction status to cleared
      const transaction = await prisma.transaction.update({
        where: {
          id: transactionId,
          workspaceId: id,
          status: 'pending',
        },
        data: {
          status: 'cleared',
        },
      });

      await auditService.log({
        userId: request.user!.sub,
        workspaceId: id,
        action: 'transaction.approved',
        entityType: 'transaction',
        entityId: transactionId,
        changes: { status: 'cleared' },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: transaction,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:id/transactions/:transactionId/reject - Reject transaction
  // --------------------------------------------------------------------------
  app.post<{ Params: { id: string; transactionId: string; workspaceId?: string } }>(
    '/:id/transactions/:transactionId/reject',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:update'),
      ],
    },
    async (request, reply) => {
      const { id, transactionId } = request.params;

      // Soft delete the rejected transaction
      await prisma.transaction.update({
        where: {
          id: transactionId,
          workspaceId: id,
          status: 'pending',
        },
        data: {
          deletedAt: new Date(),
        },
      });

      await auditService.log({
        userId: request.user!.sub,
        workspaceId: id,
        action: 'transaction.rejected',
        entityType: 'transaction',
        entityId: transactionId,
        ipAddress: request.ip,
        severity: 'warning',
      });

      return reply.send({
        success: true,
        data: { message: 'Transaction rejected' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:id/settlement - Get settlement calculation
  // --------------------------------------------------------------------------
  app.get<{
    Params: { id: string; workspaceId?: string };
    Querystring: { startDate?: string; endDate?: string; categoryIds?: string };
  }>(
    '/:id/settlement',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('transaction:read'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { startDate, endDate, categoryIds } = request.query;

      const settlement = await settlementService.calculateSettlement(id, {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        categoryIds: categoryIds ? categoryIds.split(',') : undefined,
      });

      return reply.send({
        success: true,
        data: settlement,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:id/settlement/history - Get settlement history
  // --------------------------------------------------------------------------
  app.get<{
    Params: { id: string; workspaceId?: string };
    Querystring: { months?: string };
  }>(
    '/:id/settlement/history',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('transaction:read'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const months = parseInt(request.query.months ?? '6', 10);

      const history = await settlementService.getHistory(id, months);

      return reply.send({
        success: true,
        data: history,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:id/settlement/breakdown - Get expense breakdown
  // --------------------------------------------------------------------------
  app.get<{
    Params: { id: string; workspaceId?: string };
    Querystring: { startDate?: string; endDate?: string };
  }>(
    '/:id/settlement/breakdown',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('transaction:read'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const now = new Date();
      const startDate = request.query.startDate
        ? new Date(request.query.startDate)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = request.query.endDate
        ? new Date(request.query.endDate)
        : new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const breakdown = await settlementService.getExpenseBreakdown(id, startDate, endDate);

      return reply.send({
        success: true,
        data: breakdown,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:id/insights - Get smart insights for workspace
  // --------------------------------------------------------------------------
  app.get<{
    Params: { id: string; workspaceId?: string };
    Querystring: { limit?: string };
  }>(
    '/:id/insights',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('transaction:read'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.sub;
      const limit = parseInt(request.query.limit ?? '10', 10);

      const insights = await insightsService.getForWorkspace(id, userId, limit);

      return reply.send(insights);
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:id/notifications/preferences - Get notification preferences
  // --------------------------------------------------------------------------
  app.get<{ Params: { id: string; workspaceId?: string } }>(
    '/:id/notifications/preferences',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
      ],
    },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { id: workspaceId } = request.params;

      // Get user's membership to access notification preferences stored in settings
      const membership = await prisma.membership.findFirst({
        where: {
          userId,
          workspaceId,
        },
      });

      // Get stored preferences from membership settings
      const membershipSettings = (membership?.settings ?? {}) as Record<string, unknown>;
      const storedPrefs = (membershipSettings.notificationPreferences ?? {}) as Record<
        string,
        { inApp?: boolean; email?: boolean; push?: boolean }
      >;

      // Define all available notification types with defaults
      const notificationTypes = [
        // Savings
        { type: 'savings_milestone', inApp: true, email: false, push: false },
        { type: 'savings_off_track', inApp: true, email: false, push: false },
        { type: 'goal_achieved', inApp: true, email: true, push: false },
        // Spending
        { type: 'unusual_spending', inApp: true, email: false, push: false },
        { type: 'budget_threshold', inApp: true, email: false, push: false },
        { type: 'budget_exceeded', inApp: true, email: true, push: false },
        { type: 'low_balance_warning', inApp: true, email: true, push: false },
        // Summaries
        { type: 'weekly_summary', inApp: true, email: false, push: false },
        { type: 'monthly_report', inApp: true, email: false, push: false },
        // Recurring
        { type: 'recurring_processed', inApp: true, email: false, push: false },
        { type: 'recurring_upcoming', inApp: true, email: false, push: false },
        { type: 'bill_upcoming', inApp: true, email: false, push: false },
      ];

      // Merge stored preferences with defaults
      const preferences = notificationTypes.map((defaultPref) => {
        const storedPref = storedPrefs[defaultPref.type];
        return {
          type: defaultPref.type,
          inApp: storedPref?.inApp ?? defaultPref.inApp,
          email: storedPref?.email ?? defaultPref.email,
          push: storedPref?.push ?? defaultPref.push,
        };
      });

      return reply.send({
        preferences,
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /workspaces/:id/notifications/preferences - Update notification preferences
  // --------------------------------------------------------------------------
  app.patch<{
    Params: { id: string; workspaceId?: string };
    Body: {
      type: string;
      channel: 'inApp' | 'email' | 'push';
      enabled: boolean;
    };
  }>(
    '/:id/notifications/preferences',
    {
      preHandler: [
        async (req, reply) => {
          (req.params as { id: string; workspaceId?: string }).workspaceId = req.params.id;
          await workspaceContextMiddleware(req, reply);
        },
      ],
    },
    async (request, reply) => {
      const { id: workspaceId } = request.params;
      const userId = request.user!.sub;
      const { type, channel, enabled } = request.body;

      // Get current membership
      const membership = await prisma.membership.findFirst({
        where: {
          userId,
          workspaceId,
        },
      });

      if (!membership) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Membership not found' },
        });
      }

      // Update the settings with new preference
      const currentSettings = (membership.settings ?? {}) as Record<string, unknown>;
      const currentPrefs = (currentSettings.notificationPreferences ?? {}) as Record<
        string,
        { inApp?: boolean; email?: boolean; push?: boolean }
      >;

      // Update the specific preference
      const updatedPrefs = {
        ...currentPrefs,
        [type]: {
          ...currentPrefs[type],
          [channel]: enabled,
        },
      };

      // Save back to membership settings
      await prisma.membership.update({
        where: { id: membership.id },
        data: {
          settings: {
            ...currentSettings,
            notificationPreferences: updatedPrefs,
          },
        },
      });

      return reply.send({
        success: true,
        message: 'Preference mise a jour',
      });
    }
  );
}

export default workspaceRoutes;
