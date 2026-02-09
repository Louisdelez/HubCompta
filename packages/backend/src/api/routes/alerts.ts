// ============================================================================
// ALERT ROUTES - Finance Hub
// Price alert management using dedicated PriceAlert model
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { prisma } from '@/core/database/client.js';
import { auditService } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------

const createPriceAlertSchema = z.object({
  symbol: z.string().min(1).max(20),
  positionId: z.string().optional(),
  targetPrice: z.number().positive(),
  direction: z.enum(['above', 'below']),
  isRecurring: z.boolean().optional().default(false),
});

const updatePriceAlertSchema = z.object({
  targetPrice: z.number().positive().optional(),
  direction: z.enum(['above', 'below']).optional(),
  isRecurring: z.boolean().optional(),
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
    Querystring: { positionId?: string; symbol?: string };
  }>(
    '/',
    { preHandler: [requirePermission('transaction:read')] },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { positionId, symbol } = request.query;

      const alerts = await prisma.priceAlert.findMany({
        where: {
          workspaceId,
          ...(positionId && { positionId }),
          ...(symbol && { symbol }),
        },
        include: {
          position: {
            include: {
              asset: {
                select: {
                  id: true,
                  symbol: true,
                  name: true,
                  lastPrice: true,
                  currency: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Format response
      const formattedAlerts = alerts.map((alert) => ({
        id: alert.id,
        workspaceId: alert.workspaceId,
        positionId: alert.positionId,
        symbol: alert.symbol,
        direction: alert.direction,
        targetPrice: Number(alert.targetPrice),
        isRecurring: alert.isRecurring,
        isTriggered: alert.isTriggered,
        triggeredAt: alert.triggeredAt,
        createdAt: alert.createdAt,
        updatedAt: alert.updatedAt,
        position: alert.position
          ? {
              id: alert.position.id,
              asset: {
                id: alert.position.asset.id,
                symbol: alert.position.asset.symbol,
                name: alert.position.asset.name,
                lastPrice: alert.position.asset.lastPrice
                  ? Number(alert.position.asset.lastPrice)
                  : null,
                currency: alert.position.asset.currency,
              },
            }
          : null,
      }));

      return reply.send({
        success: true,
        data: formattedAlerts,
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

      // Verify position belongs to workspace if provided
      if (input.positionId) {
        const position = await prisma.position.findFirst({
          where: {
            id: input.positionId,
            workspaceId,
          },
        });

        if (!position) {
          return reply.status(404).send({
            success: false,
            error: 'Position non trouvee',
          });
        }
      }

      const alert = await prisma.priceAlert.create({
        data: {
          workspaceId,
          positionId: input.positionId,
          symbol: input.symbol,
          direction: input.direction,
          targetPrice: new Decimal(input.targetPrice),
          isRecurring: input.isRecurring ?? false,
        },
      });

      await auditService.log({
        userId,
        workspaceId,
        action: 'price_alert.created',
        entityType: 'price_alert',
        entityId: alert.id,
        changes: {
          symbol: input.symbol,
          targetPrice: input.targetPrice,
          direction: input.direction,
          isRecurring: input.isRecurring,
        },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: {
          id: alert.id,
          workspaceId: alert.workspaceId,
          positionId: alert.positionId,
          symbol: alert.symbol,
          direction: alert.direction,
          targetPrice: Number(alert.targetPrice),
          isRecurring: alert.isRecurring,
          isTriggered: alert.isTriggered,
          triggeredAt: alert.triggeredAt,
          createdAt: alert.createdAt,
          updatedAt: alert.updatedAt,
        },
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
      const { workspaceId, alertId } = request.params;
      const userId = request.user!.sub;
      const input = updatePriceAlertSchema.parse(request.body);

      // Verify alert exists and belongs to workspace
      const existing = await prisma.priceAlert.findFirst({
        where: {
          id: alertId,
          workspaceId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: 'Alerte non trouvee',
        });
      }

      const updateData: {
        targetPrice?: Decimal;
        direction?: string;
        isRecurring?: boolean;
      } = {};

      if (input.targetPrice !== undefined) {
        updateData.targetPrice = new Decimal(input.targetPrice);
      }
      if (input.direction !== undefined) {
        updateData.direction = input.direction;
      }
      if (input.isRecurring !== undefined) {
        updateData.isRecurring = input.isRecurring;
      }

      const updatedAlert = await prisma.priceAlert.update({
        where: { id: alertId },
        data: updateData,
      });

      await auditService.log({
        userId,
        workspaceId,
        action: 'price_alert.updated',
        entityType: 'price_alert',
        entityId: alertId,
        changes: input,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: {
          id: updatedAlert.id,
          workspaceId: updatedAlert.workspaceId,
          positionId: updatedAlert.positionId,
          symbol: updatedAlert.symbol,
          direction: updatedAlert.direction,
          targetPrice: Number(updatedAlert.targetPrice),
          isRecurring: updatedAlert.isRecurring,
          isTriggered: updatedAlert.isTriggered,
          triggeredAt: updatedAlert.triggeredAt,
          createdAt: updatedAlert.createdAt,
          updatedAt: updatedAlert.updatedAt,
        },
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
      const { workspaceId, alertId } = request.params;
      const userId = request.user!.sub;

      // Verify alert exists and belongs to workspace
      const existing = await prisma.priceAlert.findFirst({
        where: {
          id: alertId,
          workspaceId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: 'Alerte non trouvee',
        });
      }

      await prisma.priceAlert.delete({
        where: { id: alertId },
      });

      await auditService.log({
        userId,
        workspaceId,
        action: 'price_alert.deleted',
        entityType: 'price_alert',
        entityId: alertId,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: { message: 'Alerte supprimee' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/alerts/:alertId/reset - Reset triggered alert
  // --------------------------------------------------------------------------
  app.post<{
    Params: { workspaceId: string; alertId: string };
  }>(
    '/:alertId/reset',
    { preHandler: [requirePermission('transaction:update')] },
    async (request, reply) => {
      const { workspaceId, alertId } = request.params;
      const userId = request.user!.sub;

      // Verify alert exists and belongs to workspace
      const existing = await prisma.priceAlert.findFirst({
        where: {
          id: alertId,
          workspaceId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: 'Alerte non trouvee',
        });
      }

      const updatedAlert = await prisma.priceAlert.update({
        where: { id: alertId },
        data: {
          isTriggered: false,
          triggeredAt: null,
        },
      });

      await auditService.log({
        userId,
        workspaceId,
        action: 'price_alert.reset',
        entityType: 'price_alert',
        entityId: alertId,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: {
          id: updatedAlert.id,
          workspaceId: updatedAlert.workspaceId,
          positionId: updatedAlert.positionId,
          symbol: updatedAlert.symbol,
          direction: updatedAlert.direction,
          targetPrice: Number(updatedAlert.targetPrice),
          isRecurring: updatedAlert.isRecurring,
          isTriggered: updatedAlert.isTriggered,
          triggeredAt: updatedAlert.triggeredAt,
          createdAt: updatedAlert.createdAt,
          updatedAt: updatedAlert.updatedAt,
        },
      });
    }
  );
}

export default alertRoutes;
