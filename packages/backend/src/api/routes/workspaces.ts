// ============================================================================
// WORKSPACE ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { workspaceService } from '@/modules/workspaces/workspace.service.js';
import { membershipService } from '@/modules/workspaces/membership.service.js';
import { invitationService } from '@/modules/workspaces/invitation.service.js';
import { settlementService } from '@/modules/workspaces/settlement.service.js';
import { auditService, AUDIT_ACTIONS } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission, requireRole } from '@/core/middleware/workspaceContext.js';
import {
  workspaceCreateSchema,
  workspaceUpdateSchema,
  memberInviteSchema,
  memberUpdateSchema,
} from '@finance-hub/shared';
import { ForbiddenError } from '@/core/middleware/errorHandler.js';

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export async function workspaceRoutes(app: FastifyInstance): Promise<void> {
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
  app.patch(
    '/:id',
    {
      preHandler: [
        async (req, reply) => {
          req.params = { ...req.params, workspaceId: (req.params as { id: string }).id };
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('workspace:update'),
      ],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
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
  app.delete(
    '/:id',
    {
      preHandler: [
        async (req, reply) => {
          req.params = { ...req.params, workspaceId: (req.params as { id: string }).id };
          await workspaceContextMiddleware(req, reply);
        },
        requireRole('owner'),
      ],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
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
  app.get(
    '/:id/members',
    {
      preHandler: [
        async (req, reply) => {
          req.params = { ...req.params, workspaceId: (req.params as { id: string }).id };
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:read'),
      ],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
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
  app.post(
    '/:id/invite',
    {
      preHandler: [
        async (req, reply) => {
          req.params = { ...req.params, workspaceId: (req.params as { id: string }).id };
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:invite'),
      ],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
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
  app.get(
    '/:id/invitations',
    {
      preHandler: [
        async (req, reply) => {
          req.params = { ...req.params, workspaceId: (req.params as { id: string }).id };
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:invite'),
      ],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
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
  app.delete(
    '/:id/invitations/:code',
    {
      preHandler: [
        async (req, reply) => {
          req.params = { ...req.params, workspaceId: (req.params as { id: string }).id };
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:invite'),
      ],
    },
    async (
      request: FastifyRequest<{ Params: { id: string; code: string } }>,
      reply: FastifyReply
    ) => {
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
  app.patch(
    '/:id/members/:memberId',
    {
      preHandler: [
        async (req, reply) => {
          req.params = { ...req.params, workspaceId: (req.params as { id: string }).id };
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:update'),
      ],
    },
    async (
      request: FastifyRequest<{ Params: { id: string; memberId: string } }>,
      reply: FastifyReply
    ) => {
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
  app.delete(
    '/:id/members/:memberId',
    {
      preHandler: [
        async (req, reply) => {
          req.params = { ...req.params, workspaceId: (req.params as { id: string }).id };
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('member:remove'),
      ],
    },
    async (
      request: FastifyRequest<{ Params: { id: string; memberId: string } }>,
      reply: FastifyReply
    ) => {
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
  // GET /workspaces/:id/settlement - Get settlement calculation
  // --------------------------------------------------------------------------
  app.get(
    '/:id/settlement',
    {
      preHandler: [
        async (req, reply) => {
          req.params = { ...req.params, workspaceId: (req.params as { id: string }).id };
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('transaction:read'),
      ],
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: {
          startDate?: string;
          endDate?: string;
          categoryIds?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
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
  app.get(
    '/:id/settlement/history',
    {
      preHandler: [
        async (req, reply) => {
          req.params = { ...req.params, workspaceId: (req.params as { id: string }).id };
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('transaction:read'),
      ],
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { months?: string };
      }>,
      reply: FastifyReply
    ) => {
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
  app.get(
    '/:id/settlement/breakdown',
    {
      preHandler: [
        async (req, reply) => {
          req.params = { ...req.params, workspaceId: (req.params as { id: string }).id };
          await workspaceContextMiddleware(req, reply);
        },
        requirePermission('transaction:read'),
      ],
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { startDate?: string; endDate?: string };
      }>,
      reply: FastifyReply
    ) => {
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
}

export default workspaceRoutes;
