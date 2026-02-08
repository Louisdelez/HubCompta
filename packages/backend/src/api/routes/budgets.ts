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
});

const updateBudgetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  amount: z.number().positive().optional(),
  alertThreshold: z.number().min(1).max(100).optional(),
  endDate: z.string().nullable().optional().transform((s) => (s ? new Date(s) : s === null ? null : undefined)),
});

// ----------------------------------------------------------------------------
// Route Handlers
// ----------------------------------------------------------------------------

export async function budgetRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth guard to all routes
  app.addHook('onRequest', authGuard);

  // --------------------------------------------------------------------------
  // GET /budgets - List all budgets with progress
  // --------------------------------------------------------------------------
  app.get(
    '/',
    async (request: FastifyRequest<{ Params: { workspaceId: string } }>, reply: FastifyReply) => {
      const { workspaceId } = request.params;
      const userId = request.user!.id;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      const budgets = await budgetService.list(workspaceId);

      return reply.send(budgets);
    }
  );

  // --------------------------------------------------------------------------
  // GET /budgets/summary - Get budget summary for dashboard
  // --------------------------------------------------------------------------
  app.get(
    '/summary',
    async (request: FastifyRequest<{ Params: { workspaceId: string } }>, reply: FastifyReply) => {
      const { workspaceId } = request.params;
      const userId = request.user!.id;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      const summary = await budgetService.getSummary(workspaceId);

      return reply.send(summary);
    }
  );

  // --------------------------------------------------------------------------
  // GET /budgets/alerts - Get active budget alerts
  // --------------------------------------------------------------------------
  app.get(
    '/alerts',
    async (request: FastifyRequest<{ Params: { workspaceId: string } }>, reply: FastifyReply) => {
      const { workspaceId } = request.params;
      const userId = request.user!.id;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      const alerts = await alertService.getActiveAlerts(workspaceId);

      return reply.send(alerts);
    }
  );

  // --------------------------------------------------------------------------
  // GET /budgets/dashboard - Get dashboard summary
  // --------------------------------------------------------------------------
  app.get(
    '/dashboard',
    async (request: FastifyRequest<{ Params: { workspaceId: string } }>, reply: FastifyReply) => {
      const { workspaceId } = request.params;
      const userId = request.user!.id;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      const summary = await alertService.getDashboardSummary(workspaceId);

      return reply.send(summary);
    }
  );

  // --------------------------------------------------------------------------
  // POST /budgets - Create new budget
  // --------------------------------------------------------------------------
  app.post(
    '/',
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Body: z.infer<typeof createBudgetSchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const userId = request.user!.id;

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

      return reply.status(201).send(budget);
    }
  );

  // --------------------------------------------------------------------------
  // GET /budgets/:budgetId - Get budget by ID with progress
  // --------------------------------------------------------------------------
  app.get(
    '/:budgetId',
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; budgetId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, budgetId } = request.params;
      const userId = request.user!.id;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      const budget = await budgetService.getById(workspaceId, budgetId);

      if (!budget) {
        return reply.status(404).send({ error: 'Budget not found' });
      }

      return reply.send(budget);
    }
  );

  // --------------------------------------------------------------------------
  // GET /budgets/:budgetId/history - Get budget history
  // --------------------------------------------------------------------------
  app.get(
    '/:budgetId/history',
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string; budgetId: string };
        Querystring: { months?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, budgetId } = request.params;
      const months = parseInt(request.query.months ?? '6', 10);
      const userId = request.user!.id;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      const history = await budgetService.getHistory(workspaceId, budgetId, months);

      return reply.send(history);
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /budgets/:budgetId - Update budget
  // --------------------------------------------------------------------------
  app.patch(
    '/:budgetId',
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string; budgetId: string };
        Body: z.infer<typeof updateBudgetSchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, budgetId } = request.params;
      const userId = request.user!.id;

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

      return reply.send(budget);
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /budgets/:budgetId - Delete budget
  // --------------------------------------------------------------------------
  app.delete(
    '/:budgetId',
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; budgetId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, budgetId } = request.params;
      const userId = request.user!.id;

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
