// ============================================================================
// SAVINGS ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { savingsService } from '@/modules/savings/savings.service.js';
import { auditService, AUDIT_ACTIONS } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';
import {
  savingsGoalCreateSchema,
  savingsGoalUpdateSchema,
  savingsContributionCreateSchema,
  savingsGoalQuerySchema,
} from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WorkspaceParams {
  workspaceId: string;
}

interface GoalParams extends WorkspaceParams {
  goalId: string;
}

interface ContributionParams extends GoalParams {
  contributionId: string;
}

interface GoalQuery {
  includeDeleted?: boolean;
  includeCompleted?: boolean;
  page?: number;
  pageSize?: number;
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export function savingsRoutes(app: FastifyInstance): void {
  // Apply auth guard and workspace context to all routes
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/savings - List savings goals
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: GoalQuery }>(
    '/',
    { preHandler: requirePermission('budget:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const query = savingsGoalQuerySchema.parse(request.query);

      const goals = await savingsService.list(workspaceId, {
        includeDeleted: query.includeDeleted,
        includeCompleted: query.includeCompleted,
      });

      return reply.send({
        success: true,
        data: goals,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/savings/summary - Get savings summary
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams }>(
    '/summary',
    { preHandler: requirePermission('budget:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const summary = await savingsService.getSummary(workspaceId);

      return reply.send({
        success: true,
        data: summary,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/savings - Create savings goal
  // --------------------------------------------------------------------------
  app.post<{ Params: WorkspaceParams }>(
    '/',
    { preHandler: requirePermission('budget:create') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const input = savingsGoalCreateSchema.parse(request.body);

      const goal = await savingsService.create(workspaceId, {
        ...input,
        targetDate: input.targetDate ?? null,
        icon: input.icon ?? null,
        color: input.color ?? null,
        accountId: input.accountId ?? null,
      });

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: 'savings.goal.created',
        entityType: 'savings_goal',
        entityId: goal.id,
        changes: { name: goal.name, targetAmount: goal.targetAmount },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: goal,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/savings/:goalId - Get savings goal details
  // --------------------------------------------------------------------------
  app.get<{ Params: GoalParams }>(
    '/:goalId',
    { preHandler: requirePermission('budget:read') },
    async (request, reply) => {
      const { workspaceId, goalId } = request.params;

      const goal = await savingsService.getById(workspaceId, goalId);

      if (!goal) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Savings goal not found', code: 'NOT_FOUND' },
        });
      }

      return reply.send({
        success: true,
        data: goal,
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /workspaces/:workspaceId/savings/:goalId - Update savings goal
  // --------------------------------------------------------------------------
  app.patch<{ Params: GoalParams }>(
    '/:goalId',
    { preHandler: requirePermission('budget:update') },
    async (request, reply) => {
      const { workspaceId, goalId } = request.params;
      const input = savingsGoalUpdateSchema.parse(request.body);

      const goal = await savingsService.update(workspaceId, goalId, input);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: 'savings.goal.updated',
        entityType: 'savings_goal',
        entityId: goalId,
        changes: input,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: goal,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /workspaces/:workspaceId/savings/:goalId - Soft delete savings goal
  // --------------------------------------------------------------------------
  app.delete<{ Params: GoalParams }>(
    '/:goalId',
    { preHandler: requirePermission('budget:delete') },
    async (request, reply) => {
      const { workspaceId, goalId } = request.params;

      await savingsService.delete(workspaceId, goalId);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: 'savings.goal.deleted',
        entityType: 'savings_goal',
        entityId: goalId,
        ipAddress: request.ip,
        severity: 'warning',
      });

      return reply.send({
        success: true,
        data: { message: 'Savings goal deleted' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/savings/:goalId/contribute - Add contribution
  // --------------------------------------------------------------------------
  app.post<{ Params: GoalParams }>(
    '/:goalId/contribute',
    { preHandler: requirePermission('budget:update') },
    async (request, reply) => {
      const { workspaceId, goalId } = request.params;
      const input = savingsContributionCreateSchema.parse(request.body);

      const goal = await savingsService.addContribution(workspaceId, goalId, {
        ...input,
        notes: input.notes ?? null,
        transactionId: input.transactionId ?? null,
      });

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: 'savings.contribution.added',
        entityType: 'savings_goal',
        entityId: goalId,
        changes: { amount: input.amount },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: goal,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/savings/:goalId/history - Get contribution history
  // --------------------------------------------------------------------------
  app.get<{ Params: GoalParams }>(
    '/:goalId/history',
    { preHandler: requirePermission('budget:read') },
    async (request, reply) => {
      const { workspaceId, goalId } = request.params;

      const history = await savingsService.getContributionHistory(workspaceId, goalId);

      return reply.send({
        success: true,
        data: history,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /workspaces/:workspaceId/savings/:goalId/contributions/:contributionId - Delete contribution
  // --------------------------------------------------------------------------
  app.delete<{ Params: ContributionParams }>(
    '/:goalId/contributions/:contributionId',
    { preHandler: requirePermission('budget:update') },
    async (request, reply) => {
      const { workspaceId, goalId, contributionId } = request.params;

      const goal = await savingsService.deleteContribution(workspaceId, goalId, contributionId);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: 'savings.contribution.deleted',
        entityType: 'savings_contribution',
        entityId: contributionId,
        changes: { goalId },
        ipAddress: request.ip,
        severity: 'warning',
      });

      return reply.send({
        success: true,
        data: goal,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/savings/:goalId/complete - Mark goal as completed
  // --------------------------------------------------------------------------
  app.post<{ Params: GoalParams }>(
    '/:goalId/complete',
    { preHandler: requirePermission('budget:update') },
    async (request, reply) => {
      const { workspaceId, goalId } = request.params;

      const goal = await savingsService.markCompleted(workspaceId, goalId);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: 'savings.goal.completed',
        entityType: 'savings_goal',
        entityId: goalId,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: goal,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/savings/:goalId/reopen - Reopen completed goal
  // --------------------------------------------------------------------------
  app.post<{ Params: GoalParams }>(
    '/:goalId/reopen',
    { preHandler: requirePermission('budget:update') },
    async (request, reply) => {
      const { workspaceId, goalId } = request.params;

      const goal = await savingsService.reopen(workspaceId, goalId);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: 'savings.goal.reopened',
        entityType: 'savings_goal',
        entityId: goalId,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: goal,
      });
    }
  );
}

export default savingsRoutes;
