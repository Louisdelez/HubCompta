// ============================================================================
// ALERT ROUTES - Finance Hub
// Price alert management
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { alertService } from '@/modules/notifications/alert.service.js';
import { auditService } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';
import { z } from 'zod';

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------

const createPriceAlertSchema = z.object({
  assetId: z.string(),
  targetPrice: z.number().positive(),
  direction: z.enum(['above', 'below']),
});

const updateAlertSchema = z.object({
  name: z.string().optional(),
  isEnabled: z.boolean().optional(),
  targetPrice: z.number().positive().optional(),
});

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export function alertRoutes(app: FastifyInstance): void {
  // Apply auth guard and workspace context to all routes
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/alerts/price - List price alerts
  // --------------------------------------------------------------------------
  app.get<{
    Params: { workspaceId: string };
  }>(
    '/',
    { preHandler: [requirePermission('transaction:read')] },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      const alerts = await alertService.listForUser(userId, workspaceId);

      // Filter to only price alerts
      const priceAlerts = alerts.filter(
        (a) => a.type === 'price_above' || a.type === 'price_below'
      );

      return reply.send({
        success: true,
        data: priceAlerts,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/alerts/price - Create price alert
  // --------------------------------------------------------------------------
  app.post<{
    Params: { workspaceId: string };
  }>(
    '/',
    { preHandler: [requirePermission('transaction:create')] },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;
      const input = createPriceAlertSchema.parse(request.body);

      const alert = await alertService.createPriceAlert(
        userId,
        workspaceId,
        input.assetId,
        input.targetPrice,
        input.direction
      );

      await auditService.log({
        userId,
        workspaceId,
        action: 'alert.created',
        entityType: 'alert_rule',
        entityId: alert.id,
        changes: {
          assetId: input.assetId,
          targetPrice: input.targetPrice,
          direction: input.direction,
        },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: alert,
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /workspaces/:workspaceId/alerts/:alertId - Update alert
  // --------------------------------------------------------------------------
  app.patch<{
    Params: { workspaceId: string; alertId: string };
  }>(
    '/:alertId',
    { preHandler: [requirePermission('transaction:update')] },
    async (request, reply) => {
      const { alertId } = request.params;
      const userId = request.user!.sub;
      const input = updateAlertSchema.parse(request.body);

      // Verify ownership
      const existing = await alertService.getById(alertId, userId);
      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: 'Alerte non trouvee',
        });
      }

      const updateData: { name?: string; isEnabled?: boolean } = {};
      if (input.name) updateData.name = input.name;
      if (input.isEnabled !== undefined) updateData.isEnabled = input.isEnabled;

      await alertService.update(alertId, userId, updateData);

      await auditService.log({
        userId,
        action: 'alert.updated',
        entityType: 'alert_rule',
        entityId: alertId,
        changes: input,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: { message: 'Alerte mise a jour' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /workspaces/:workspaceId/alerts/:alertId - Delete alert
  // --------------------------------------------------------------------------
  app.delete<{
    Params: { workspaceId: string; alertId: string };
  }>(
    '/:alertId',
    { preHandler: [requirePermission('transaction:delete')] },
    async (request, reply) => {
      const { alertId } = request.params;
      const userId = request.user!.sub;

      // Verify ownership
      const existing = await alertService.getById(alertId, userId);
      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: 'Alerte non trouvee',
        });
      }

      await alertService.delete(alertId, userId);

      await auditService.log({
        userId,
        action: 'alert.deleted',
        entityType: 'alert_rule',
        entityId: alertId,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: { message: 'Alerte supprimee' },
      });
    }
  );
}

export default alertRoutes;
