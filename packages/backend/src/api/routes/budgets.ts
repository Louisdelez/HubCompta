// ============================================================================
// BUDGET ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { budgetService } from '@/modules/budgets/budget.service.js';
import { alertService } from '@/modules/budgets/alert.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { checkPermission } from '@/core/auth/rbac.js';
import { auditService } from '@/modules/audit/audit.service.js';

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------

const createBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(100),
  amount: z.number().positive(),
  period: z.enum(['monthly', 'yearly']),
  alertThreshold: z.number().min(1).max(100).optional().default(80),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().optional().transform((s) => (s ? new Date(s) : undefined)),
  envelopeMode: z.boolean().optional().default(false),
  rolloverEnabled: z.boolean().optional().default(true),
});

const updateBudgetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  amount: z.number().positive().optional(),
  alertThreshold: z.number().min(1).max(100).optional(),
  endDate: z.string().nullable().optional().transform((s) => (s ? new Date(s) : s === null ? null : undefined)),
  envelopeMode: z.boolean().optional(),
  rolloverEnabled: z.boolean().optional(),
});

const reallocateSchema = z.object({
  fromBudgetId: z.string().uuid(),
  toBudgetId: z.string().uuid(),
  amount: z.number().positive(),
});

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

const budgetParamsSchema = {
  type: 'object' as const,
  required: ['workspaceId', 'budgetId'],
  properties: {
    workspaceId: { type: 'string' as const, format: 'uuid', description: 'Workspace ID' },
    budgetId: { type: 'string' as const, format: 'uuid', description: 'Budget ID' },
  },
};

const budgetSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const, format: 'uuid' },
    workspaceId: { type: 'string' as const, format: 'uuid' },
    categoryId: { type: 'string' as const, format: 'uuid' },
    name: { type: 'string' as const },
    amount: { type: 'number' as const },
    spent: { type: 'number' as const },
    remaining: { type: 'number' as const },
    progress: { type: 'number' as const, description: 'Percentage of budget used (0-100+)' },
    period: { type: 'string' as const, enum: ['monthly', 'yearly'] },
    alertThreshold: { type: 'number' as const },
    startDate: { type: 'string' as const, format: 'date-time' },
    endDate: { type: 'string' as const, format: 'date-time', nullable: true },
    envelopeMode: { type: 'boolean' as const, description: 'Whether envelope budgeting mode is enabled' },
    rolloverEnabled: { type: 'boolean' as const, description: 'Whether unused funds roll over to next period' },
    rolloverAmount: { type: 'number' as const, description: 'Amount rolled over from previous period' },
    availableAmount: { type: 'number' as const, description: 'Total available (budget + rollover - spent)' },
    rolloverFromPrevious: { type: 'number' as const, description: 'Rollover amount from previous month' },
    createdAt: { type: 'string' as const, format: 'date-time' },
    updatedAt: { type: 'string' as const, format: 'date-time' },
    category: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' as const, format: 'uuid' },
        name: { type: 'string' as const },
        icon: { type: 'string' as const, nullable: true },
        color: { type: 'string' as const, nullable: true },
      },
    },
  },
};

const envelopeStatusSchema = {
  type: 'object' as const,
  properties: {
    totalEnvelopes: { type: 'number' as const },
    totalAvailable: { type: 'number' as const },
    totalSpent: { type: 'number' as const },
    envelopes: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const, format: 'uuid' },
          name: { type: 'string' as const },
          categoryName: { type: 'string' as const },
          budgetAmount: { type: 'number' as const },
          rolloverAmount: { type: 'number' as const },
          spent: { type: 'number' as const },
          available: { type: 'number' as const },
        },
      },
    },
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
// Route Handlers
// ----------------------------------------------------------------------------

export function budgetRoutes(app: FastifyInstance): void {
  // Apply auth guard to all routes
  app.addHook('onRequest', authGuard);

  // --------------------------------------------------------------------------
  // GET /budgets - List all budgets with progress
  // --------------------------------------------------------------------------
  app.get(
    '/',
    {
      schema: {
        summary: 'List all budgets',
        description: 'Retrieve all budgets for a workspace with current spending progress.',
        tags: ['Budgets'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        response: {
          200: successResponseSchema({ type: 'array' as const, items: budgetSchema }),
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Params: { workspaceId: string } }>, reply: FastifyReply) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      const budgets = await budgetService.list(workspaceId);

      return reply.send({ success: true, data: budgets });
    }
  );

  // --------------------------------------------------------------------------
  // GET /budgets/summary - Get budget summary for dashboard
  // --------------------------------------------------------------------------
  app.get(
    '/summary',
    {
      schema: {
        summary: 'Get budget summary',
        description: 'Get an overview of all budgets including total budgeted, spent, and remaining amounts.',
        tags: ['Budgets'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        response: {
          200: successResponseSchema({
            type: 'object' as const,
            properties: {
              totalBudgets: { type: 'integer' as const },
              totalBudgeted: { type: 'number' as const },
              totalSpent: { type: 'number' as const },
              totalRemaining: { type: 'number' as const },
              overBudgetCount: { type: 'integer' as const, description: 'Number of budgets exceeding their limits' },
              nearLimitCount: { type: 'integer' as const, description: 'Number of budgets near their alert threshold' },
            },
          }),
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Params: { workspaceId: string } }>, reply: FastifyReply) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      const summary = await budgetService.getSummary(workspaceId);

      return reply.send({ success: true, data: summary });
    }
  );

  // --------------------------------------------------------------------------
  // GET /budgets/alerts - Get active budget alerts
  // --------------------------------------------------------------------------
  app.get(
    '/alerts',
    {
      schema: {
        summary: 'Get active budget alerts',
        description: 'Retrieve all active alerts for budgets that have exceeded or are near their limits.',
        tags: ['Budgets'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        response: {
          200: successResponseSchema({
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                id: { type: 'string' as const, format: 'uuid' },
                budgetId: { type: 'string' as const, format: 'uuid' },
                budgetName: { type: 'string' as const },
                type: { type: 'string' as const, enum: ['warning', 'exceeded'] },
                percentage: { type: 'number' as const },
                message: { type: 'string' as const },
                createdAt: { type: 'string' as const, format: 'date-time' },
              },
            },
          }),
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Params: { workspaceId: string } }>, reply: FastifyReply) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      const alerts = await alertService.getActiveAlerts(workspaceId);

      return reply.send({ success: true, data: alerts });
    }
  );

  // --------------------------------------------------------------------------
  // GET /budgets/dashboard - Get dashboard summary
  // --------------------------------------------------------------------------
  app.get(
    '/dashboard',
    {
      schema: {
        summary: 'Get dashboard summary',
        description: 'Get a comprehensive dashboard view with budgets, alerts, and spending insights.',
        tags: ['Budgets'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        response: {
          200: successResponseSchema({
            type: 'object' as const,
            properties: {
              budgets: { type: 'array' as const, items: budgetSchema },
              alerts: {
                type: 'array' as const,
                items: {
                  type: 'object' as const,
                  properties: {
                    budgetId: { type: 'string' as const, format: 'uuid' },
                    type: { type: 'string' as const },
                    message: { type: 'string' as const },
                  },
                },
              },
              summary: {
                type: 'object' as const,
                properties: {
                  totalBudgeted: { type: 'number' as const },
                  totalSpent: { type: 'number' as const },
                  overallProgress: { type: 'number' as const },
                },
              },
            },
          }),
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Params: { workspaceId: string } }>, reply: FastifyReply) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      const summary = await alertService.getDashboardSummary(workspaceId);

      return reply.send({ success: true, data: summary });
    }
  );

  // --------------------------------------------------------------------------
  // GET /budgets/envelopes - Get envelope status for all envelope budgets
  // --------------------------------------------------------------------------
  app.get(
    '/envelopes',
    {
      schema: {
        summary: 'Get envelope budgets status',
        description: 'Get an overview of all envelope budgets with rollover amounts and available funds.',
        tags: ['Budgets'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        response: {
          200: successResponseSchema(envelopeStatusSchema),
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Params: { workspaceId: string } }>, reply: FastifyReply) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      const status = await budgetService.getEnvelopeStatus(workspaceId);

      return reply.send({ success: true, data: status });
    }
  );

  // --------------------------------------------------------------------------
  // POST /budgets/reallocate - Reallocate funds between envelope budgets
  // --------------------------------------------------------------------------
  app.post(
    '/reallocate',
    {
      schema: {
        summary: 'Reallocate envelope funds',
        description: 'Transfer funds from one envelope budget to another.',
        tags: ['Budgets'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        body: {
          type: 'object' as const,
          required: ['fromBudgetId', 'toBudgetId', 'amount'],
          properties: {
            fromBudgetId: { type: 'string' as const, format: 'uuid', description: 'Source envelope budget ID' },
            toBudgetId: { type: 'string' as const, format: 'uuid', description: 'Destination envelope budget ID' },
            amount: { type: 'number' as const, minimum: 0.01, description: 'Amount to transfer' },
          },
        },
        response: {
          200: successResponseSchema({
            type: 'object' as const,
            properties: {
              from: budgetSchema,
              to: budgetSchema,
            },
          }),
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Body: { fromBudgetId: string; toBudgetId: string; amount: number };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'update');

      // Validate body
      const input = reallocateSchema.parse(request.body);

      const result = await budgetService.reallocateEnvelope(
        workspaceId,
        input.fromBudgetId,
        input.toBudgetId,
        input.amount
      );

      // Audit log
      await auditService.log({
        workspaceId,
        userId,
        action: 'budget.reallocate',
        entityType: 'budget',
        entityId: input.fromBudgetId,
        newValue: { from: input.fromBudgetId, to: input.toBudgetId, amount: input.amount },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.send({ success: true, data: result });
    }
  );

  // --------------------------------------------------------------------------
  // POST /budgets/process-rollover - Process month-end rollover for envelope budgets
  // --------------------------------------------------------------------------
  app.post(
    '/process-rollover',
    {
      schema: {
        summary: 'Process month-end rollover',
        description: 'Process rollover for all envelope budgets at month end. Usually called by a scheduled job.',
        tags: ['Budgets'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        response: {
          200: successResponseSchema({
            type: 'object' as const,
            properties: {
              processed: { type: 'number' as const, description: 'Number of budgets processed' },
              updated: { type: 'number' as const, description: 'Number of budgets updated with rollover' },
            },
          }),
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Params: { workspaceId: string } }>, reply: FastifyReply) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      // Check permission - require admin level for this operation
      await checkPermission(userId, workspaceId, 'budget', 'update');

      const result = await budgetService.processMonthEndRollover(workspaceId);

      // Audit log
      await auditService.log({
        workspaceId,
        userId,
        action: 'budget.process_rollover',
        entityType: 'budget',
        entityId: workspaceId,
        newValue: result,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.send({ success: true, data: result });
    }
  );

  // --------------------------------------------------------------------------
  // GET /budgets/:budgetId/rollover - Get rollover calculation for a budget
  // --------------------------------------------------------------------------
  app.get(
    '/:budgetId/rollover',
    {
      schema: {
        summary: 'Get budget rollover calculation',
        description: 'Calculate the potential rollover amount for a budget based on previous month spending.',
        tags: ['Budgets'],
        security: [{ bearerAuth: [] }],
        params: budgetParamsSchema,
        response: {
          200: successResponseSchema({
            type: 'object' as const,
            properties: {
              rolloverAmount: { type: 'number' as const, description: 'Calculated rollover amount' },
              previousSpent: { type: 'number' as const, description: 'Amount spent in previous period' },
              previousBudget: { type: 'number' as const, description: 'Budget amount for previous period' },
            },
          }),
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; budgetId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, budgetId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      const rollover = await budgetService.calculateRollover(workspaceId, budgetId);

      return reply.send({ success: true, data: rollover });
    }
  );

  // --------------------------------------------------------------------------
  // POST /budgets - Create new budget
  // --------------------------------------------------------------------------
  app.post(
    '/',
    {
      schema: {
        summary: 'Create new budget',
        description: 'Create a new budget for a category with specified amount and period.',
        tags: ['Budgets'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        body: {
          type: 'object' as const,
          required: ['categoryId', 'name', 'amount', 'period', 'startDate'],
          properties: {
            categoryId: { type: 'string' as const, format: 'uuid', description: 'Category to budget for' },
            name: { type: 'string' as const, minLength: 1, maxLength: 100, description: 'Budget name' },
            amount: { type: 'number' as const, minimum: 0.01, description: 'Budget amount' },
            period: { type: 'string' as const, enum: ['monthly', 'yearly'], description: 'Budget period' },
            alertThreshold: { type: 'number' as const, minimum: 1, maximum: 100, default: 80, description: 'Alert threshold percentage' },
            startDate: { type: 'string' as const, format: 'date-time', description: 'Budget start date' },
            endDate: { type: 'string' as const, format: 'date-time', description: 'Optional end date' },
            envelopeMode: { type: 'boolean' as const, default: false, description: 'Enable envelope budgeting mode' },
            rolloverEnabled: { type: 'boolean' as const, default: true, description: 'Enable rollover of unused funds' },
          },
        },
        response: {
          201: successResponseSchema(budgetSchema),
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Body: z.infer<typeof createBudgetSchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'create');

      // Validate body
      const input = createBudgetSchema.parse(request.body);

      const budget = await budgetService.create(workspaceId, input);

      // Audit log
      await auditService.log({
        workspaceId,
        userId,
        action: 'budget.create',
        entityType: 'budget',
        entityId: budget.id,
        newValue: { name: budget.name, amount: budget.amount, period: budget.period },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.status(201).send({ success: true, data: budget });
    }
  );

  // --------------------------------------------------------------------------
  // GET /budgets/:budgetId - Get budget by ID with progress
  // --------------------------------------------------------------------------
  app.get(
    '/:budgetId',
    {
      schema: {
        summary: 'Get budget by ID',
        description: 'Retrieve detailed information about a specific budget including current spending progress.',
        tags: ['Budgets'],
        security: [{ bearerAuth: [] }],
        params: budgetParamsSchema,
        response: {
          200: successResponseSchema(budgetSchema),
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; budgetId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, budgetId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      const budget = await budgetService.getById(workspaceId, budgetId);

      if (!budget) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Budget not found' } });
      }

      return reply.send({ success: true, data: budget });
    }
  );

  // --------------------------------------------------------------------------
  // GET /budgets/:budgetId/history - Get budget history
  // --------------------------------------------------------------------------
  app.get(
    '/:budgetId/history',
    {
      schema: {
        summary: 'Get budget history',
        description: 'Retrieve historical spending data for a budget over the specified number of months.',
        tags: ['Budgets'],
        security: [{ bearerAuth: [] }],
        params: budgetParamsSchema,
        querystring: {
          type: 'object' as const,
          properties: {
            months: { type: 'string' as const, pattern: '^[0-9]+$', default: '6', description: 'Number of months of history' },
          },
        },
        response: {
          200: successResponseSchema({
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                month: { type: 'string' as const, format: 'date' },
                budgeted: { type: 'number' as const },
                spent: { type: 'number' as const },
                remaining: { type: 'number' as const },
              },
            },
          }),
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string; budgetId: string };
        Querystring: { months?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, budgetId } = request.params;
      const months = parseInt(request.query.months ?? '6', 10);
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      const history = await budgetService.getHistory(workspaceId, budgetId, months);

      return reply.send({ success: true, data: history });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /budgets/:budgetId - Update budget
  // --------------------------------------------------------------------------
  app.patch(
    '/:budgetId',
    {
      schema: {
        summary: 'Update budget',
        description: 'Update an existing budget. All fields are optional.',
        tags: ['Budgets'],
        security: [{ bearerAuth: [] }],
        params: budgetParamsSchema,
        body: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' as const, minLength: 1, maxLength: 100, description: 'Budget name' },
            amount: { type: 'number' as const, minimum: 0.01, description: 'Budget amount' },
            alertThreshold: { type: 'number' as const, minimum: 1, maximum: 100, description: 'Alert threshold percentage' },
            endDate: { type: 'string' as const, format: 'date-time', nullable: true, description: 'End date' },
            envelopeMode: { type: 'boolean' as const, description: 'Enable envelope budgeting mode' },
            rolloverEnabled: { type: 'boolean' as const, description: 'Enable rollover of unused funds' },
          },
        },
        response: {
          200: successResponseSchema(budgetSchema),
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string; budgetId: string };
        Body: z.infer<typeof updateBudgetSchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, budgetId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'update');

      // Get old value for audit
      const oldBudget = await budgetService.getById(workspaceId, budgetId);

      // Validate body
      const input = updateBudgetSchema.parse(request.body);

      const budget = await budgetService.update(workspaceId, budgetId, input);

      // Audit log
      await auditService.log({
        workspaceId,
        userId,
        action: 'budget.update',
        entityType: 'budget',
        entityId: budget.id,
        oldValue: oldBudget ? { name: oldBudget.name, amount: oldBudget.amount } : null,
        newValue: input,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.send({ success: true, data: budget });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /budgets/:budgetId - Delete budget
  // --------------------------------------------------------------------------
  app.delete(
    '/:budgetId',
    {
      schema: {
        summary: 'Delete budget',
        description: 'Delete a budget. This action cannot be undone.',
        tags: ['Budgets'],
        security: [{ bearerAuth: [] }],
        params: budgetParamsSchema,
        response: {
          204: { type: 'null' as const, description: 'Budget deleted successfully' },
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; budgetId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, budgetId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'delete');

      // Get budget for audit before deletion
      const budget = await budgetService.getById(workspaceId, budgetId);

      await budgetService.delete(workspaceId, budgetId);

      // Audit log
      await auditService.log({
        workspaceId,
        userId,
        action: 'budget.delete',
        entityType: 'budget',
        entityId: budgetId,
        oldValue: budget ? { name: budget.name } : null,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.status(204).send();
    }
  );
}

export default budgetRoutes;
