// ============================================================================
// SAVINGS ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { savingsService } from '@/modules/savings/savings.service.js';
import { auditService } from '@/modules/audit/audit.service.js';
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
// OpenAPI Schemas
// ----------------------------------------------------------------------------

const workspaceParamsSchema = {
  type: 'object' as const,
  required: ['workspaceId'],
  properties: {
    workspaceId: { type: 'string' as const, format: 'uuid', description: 'Workspace ID' },
  },
};

const goalParamsSchema = {
  type: 'object' as const,
  required: ['workspaceId', 'goalId'],
  properties: {
    workspaceId: { type: 'string' as const, format: 'uuid', description: 'Workspace ID' },
    goalId: { type: 'string' as const, format: 'uuid', description: 'Savings goal ID' },
  },
};

const contributionParamsSchema = {
  type: 'object' as const,
  required: ['workspaceId', 'goalId', 'contributionId'],
  properties: {
    workspaceId: { type: 'string' as const, format: 'uuid', description: 'Workspace ID' },
    goalId: { type: 'string' as const, format: 'uuid', description: 'Savings goal ID' },
    contributionId: { type: 'string' as const, format: 'uuid', description: 'Contribution ID' },
  },
};

const savingsGoalSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const, format: 'uuid' },
    workspaceId: { type: 'string' as const, format: 'uuid' },
    name: { type: 'string' as const },
    targetAmount: { type: 'number' as const },
    currentAmount: { type: 'number' as const },
    targetDate: { type: 'string' as const, format: 'date-time', nullable: true },
    icon: { type: 'string' as const, nullable: true },
    color: { type: 'string' as const, nullable: true },
    accountId: { type: 'string' as const, format: 'uuid', nullable: true },
    isCompleted: { type: 'boolean' as const },
    completedAt: { type: 'string' as const, format: 'date-time', nullable: true },
    createdAt: { type: 'string' as const, format: 'date-time' },
    updatedAt: { type: 'string' as const, format: 'date-time' },
  },
};

const successResponseSchema = (dataSchema: object) => ({
  type: 'object' as const,
  properties: {
    success: { type: 'boolean' as const, enum: [true] },
    data: dataSchema,
  },
});

const errorResponseSchema = {
  type: 'object' as const,
  properties: {
    success: { type: 'boolean' as const, enum: [false] },
    error: {
      type: 'object' as const,
      properties: {
        message: { type: 'string' as const },
        code: { type: 'string' as const },
      },
    },
  },
};

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
    {
      preHandler: requirePermission('budget:read'),
      schema: {
        summary: 'List savings goals',
        description: 'Retrieve all savings goals for a workspace. Supports filtering by completion status.',
        tags: ['Savings'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        querystring: {
          type: 'object' as const,
          properties: {
            includeDeleted: { type: 'boolean' as const, description: 'Include soft-deleted goals' },
            includeCompleted: { type: 'boolean' as const, description: 'Include completed goals' },
            page: { type: 'integer' as const, minimum: 1, description: 'Page number' },
            pageSize: { type: 'integer' as const, minimum: 1, maximum: 100, description: 'Items per page' },
          },
        },
        response: {
          200: successResponseSchema({ type: 'array' as const, items: savingsGoalSchema }),
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('budget:read'),
      schema: {
        summary: 'Get savings summary',
        description: 'Get an overview of all savings goals including total saved, targets, and progress.',
        tags: ['Savings'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        response: {
          200: successResponseSchema({
            type: 'object' as const,
            properties: {
              totalGoals: { type: 'integer' as const },
              activeGoals: { type: 'integer' as const },
              completedGoals: { type: 'integer' as const },
              totalTargetAmount: { type: 'number' as const },
              totalCurrentAmount: { type: 'number' as const },
              overallProgress: { type: 'number' as const, description: 'Progress percentage (0-100)' },
            },
          }),
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('budget:create'),
      schema: {
        summary: 'Create savings goal',
        description: 'Create a new savings goal with a target amount and optional target date.',
        tags: ['Savings'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        body: {
          type: 'object' as const,
          required: ['name', 'targetAmount'],
          properties: {
            name: { type: 'string' as const, minLength: 1, maxLength: 100, description: 'Goal name' },
            targetAmount: { type: 'number' as const, minimum: 0.01, description: 'Target amount to save' },
            targetDate: { type: 'string' as const, format: 'date-time', description: 'Optional target date' },
            icon: { type: 'string' as const, description: 'Optional icon identifier' },
            color: { type: 'string' as const, pattern: '^#[0-9A-Fa-f]{6}$', description: 'Optional hex color' },
            accountId: { type: 'string' as const, format: 'uuid', description: 'Optional linked account ID' },
          },
        },
        response: {
          201: successResponseSchema(savingsGoalSchema),
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('budget:read'),
      schema: {
        summary: 'Get savings goal details',
        description: 'Retrieve detailed information about a specific savings goal.',
        tags: ['Savings'],
        security: [{ bearerAuth: [] }],
        params: goalParamsSchema,
        response: {
          200: successResponseSchema(savingsGoalSchema),
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('budget:update'),
      schema: {
        summary: 'Update savings goal',
        description: 'Update an existing savings goal. All fields are optional.',
        tags: ['Savings'],
        security: [{ bearerAuth: [] }],
        params: goalParamsSchema,
        body: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' as const, minLength: 1, maxLength: 100, description: 'Goal name' },
            targetAmount: { type: 'number' as const, minimum: 0.01, description: 'Target amount to save' },
            targetDate: { type: 'string' as const, format: 'date-time', nullable: true, description: 'Target date' },
            icon: { type: 'string' as const, nullable: true, description: 'Icon identifier' },
            color: { type: 'string' as const, pattern: '^#[0-9A-Fa-f]{6}$', nullable: true, description: 'Hex color' },
            accountId: { type: 'string' as const, format: 'uuid', nullable: true, description: 'Linked account ID' },
          },
        },
        response: {
          200: successResponseSchema(savingsGoalSchema),
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('budget:delete'),
      schema: {
        summary: 'Delete savings goal',
        description: 'Soft delete a savings goal. The goal can be restored later.',
        tags: ['Savings'],
        security: [{ bearerAuth: [] }],
        params: goalParamsSchema,
        response: {
          200: successResponseSchema({
            type: 'object' as const,
            properties: {
              message: { type: 'string' as const },
            },
          }),
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('budget:update'),
      schema: {
        summary: 'Add contribution',
        description: 'Add a contribution to a savings goal. Optionally link to an existing transaction.',
        tags: ['Savings'],
        security: [{ bearerAuth: [] }],
        params: goalParamsSchema,
        body: {
          type: 'object' as const,
          required: ['amount'],
          properties: {
            amount: { type: 'number' as const, minimum: 0.01, description: 'Contribution amount' },
            notes: { type: 'string' as const, description: 'Optional notes' },
            transactionId: { type: 'string' as const, format: 'uuid', description: 'Optional linked transaction ID' },
          },
        },
        response: {
          201: successResponseSchema(savingsGoalSchema),
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('budget:read'),
      schema: {
        summary: 'Get contribution history',
        description: 'Retrieve the full contribution history for a savings goal.',
        tags: ['Savings'],
        security: [{ bearerAuth: [] }],
        params: goalParamsSchema,
        response: {
          200: successResponseSchema({
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                id: { type: 'string' as const, format: 'uuid' },
                goalId: { type: 'string' as const, format: 'uuid' },
                amount: { type: 'number' as const },
                notes: { type: 'string' as const, nullable: true },
                transactionId: { type: 'string' as const, format: 'uuid', nullable: true },
                createdAt: { type: 'string' as const, format: 'date-time' },
              },
            },
          }),
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('budget:update'),
      schema: {
        summary: 'Delete contribution',
        description: 'Delete a contribution from a savings goal. The goal\'s current amount will be updated.',
        tags: ['Savings'],
        security: [{ bearerAuth: [] }],
        params: contributionParamsSchema,
        response: {
          200: successResponseSchema(savingsGoalSchema),
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('budget:update'),
      schema: {
        summary: 'Mark goal as completed',
        description: 'Mark a savings goal as completed. This will set the completion date.',
        tags: ['Savings'],
        security: [{ bearerAuth: [] }],
        params: goalParamsSchema,
        response: {
          200: successResponseSchema(savingsGoalSchema),
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('budget:update'),
      schema: {
        summary: 'Reopen completed goal',
        description: 'Reopen a previously completed savings goal to continue tracking progress.',
        tags: ['Savings'],
        security: [{ bearerAuth: [] }],
        params: goalParamsSchema,
        response: {
          200: successResponseSchema(savingsGoalSchema),
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
