// ============================================================================
// RULES ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ruleService } from '@/modules/rules/rule.service.js';
import { auditService, AUDIT_ACTIONS } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';
import { ruleCreateSchema, ruleUpdateSchema } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WorkspaceParams {
  workspaceId: string;
}

interface RuleParams extends WorkspaceParams {
  ruleId: string;
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export async function ruleRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth guard and workspace context to all routes
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/rules - List rules
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams }>(
    '/',
    { preHandler: requirePermission('rule:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const rules = await ruleService.list(workspaceId);

      return reply.send({
        success: true,
        data: rules,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/rules - Create rule
  // --------------------------------------------------------------------------
  app.post<{ Params: WorkspaceParams }>(
    '/',
    { preHandler: requirePermission('rule:manage') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const input = ruleCreateSchema.parse(request.body);

      const rule = await ruleService.create(workspaceId, input);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: 'rule.created',
        entityType: 'rule',
        entityId: rule.id,
        changes: { name: rule.name },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: rule,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/rules/:ruleId - Get rule
  // --------------------------------------------------------------------------
  app.get<{ Params: RuleParams }>(
    '/:ruleId',
    { preHandler: requirePermission('rule:read') },
    async (request, reply) => {
      const { workspaceId, ruleId } = request.params;

      const rule = await ruleService.getById(workspaceId, ruleId);

      if (!rule) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Rule not found' },
        });
      }

      return reply.send({
        success: true,
        data: rule,
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /workspaces/:workspaceId/rules/:ruleId - Update rule
  // --------------------------------------------------------------------------
  app.patch<{ Params: RuleParams }>(
    '/:ruleId',
    { preHandler: requirePermission('rule:manage') },
    async (request, reply) => {
      const { workspaceId, ruleId } = request.params;
      const input = ruleUpdateSchema.parse(request.body);

      const rule = await ruleService.update(workspaceId, ruleId, input);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: 'rule.updated',
        entityType: 'rule',
        entityId: ruleId,
        changes: input,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: rule,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /workspaces/:workspaceId/rules/:ruleId - Delete rule
  // --------------------------------------------------------------------------
  app.delete<{ Params: RuleParams }>(
    '/:ruleId',
    { preHandler: requirePermission('rule:manage') },
    async (request, reply) => {
      const { workspaceId, ruleId } = request.params;

      await ruleService.delete(workspaceId, ruleId);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: 'rule.deleted',
        entityType: 'rule',
        entityId: ruleId,
        ipAddress: request.ip,
        severity: 'warning',
      });

      return reply.send({
        success: true,
        data: { message: 'Rule deleted' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/rules/:ruleId/toggle - Toggle rule enabled
  // --------------------------------------------------------------------------
  app.post<{ Params: RuleParams }>(
    '/:ruleId/toggle',
    { preHandler: requirePermission('rule:manage') },
    async (request, reply) => {
      const { workspaceId, ruleId } = request.params;

      const rule = await ruleService.toggle(workspaceId, ruleId);

      return reply.send({
        success: true,
        data: rule,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/rules/reorder - Reorder rules
  // --------------------------------------------------------------------------
  app.post<{ Params: WorkspaceParams }>(
    '/reorder',
    { preHandler: requirePermission('rule:manage') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { ruleIds } = request.body as { ruleIds: string[] };

      await ruleService.reorder(workspaceId, ruleIds);

      return reply.send({
        success: true,
        data: { message: 'Rules reordered' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/rules/test - Test rule conditions
  // --------------------------------------------------------------------------
  app.post<{ Params: WorkspaceParams }>(
    '/test',
    { preHandler: requirePermission('rule:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { conditions } = request.body as {
        conditions: Array<{
          field: 'description' | 'amount';
          operator: string;
          value: string;
        }>;
      };

      const results = await ruleService.testRule(workspaceId, conditions);

      return reply.send({
        success: true,
        data: results,
      });
    }
  );
}

export default ruleRoutes;
