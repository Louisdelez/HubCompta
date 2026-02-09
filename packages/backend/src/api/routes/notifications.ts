// ============================================================================
// NOTIFICATIONS ROUTES - Finance Hub
// In-app notifications API
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { notificationService } from '@/modules/notifications/notification.service.js';
import { alertService, type AlertConfig } from '@/modules/notifications/alert.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import type { NotificationType, AlertRuleType } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface NotificationQuery {
  page?: string;
  pageSize?: string;
  isRead?: string;
  type?: NotificationType;
  workspaceId?: string;
}

interface NotificationParams {
  notificationId: string;
}

interface AlertRuleParams {
  ruleId: string;
}

interface CreateAlertBody {
  workspaceId?: string;
  type: AlertRuleType;
  name: string;
  config: AlertConfig;
}

interface UpdateAlertBody {
  name?: string;
  isEnabled?: boolean;
  config?: AlertConfig;
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export function notificationRoutes(app: FastifyInstance): void {
  // Apply auth guard to all routes
  app.addHook('preHandler', authGuard);

  // ==========================================================================
  // NOTIFICATIONS
  // ==========================================================================

  // --------------------------------------------------------------------------
  // GET /notifications - List notifications for current user
  // --------------------------------------------------------------------------
  app.get<{ Querystring: NotificationQuery }>(
    '/',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { page, pageSize, isRead, type, workspaceId } = request.query;

      const result = await notificationService.listForUser(
        userId,
        {
          isRead: isRead !== undefined ? isRead === 'true' : undefined,
          type,
          workspaceId,
        },
        {
          page: page ? parseInt(page) : 1,
          pageSize: pageSize ? parseInt(pageSize) : 20,
        }
      );

      return reply.send({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /notifications/unread-count - Get unread notification count
  // --------------------------------------------------------------------------
  app.get<{ Querystring: { workspaceId?: string } }>(
    '/unread-count',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { workspaceId } = request.query;

      const count = await notificationService.getUnreadCount(userId, workspaceId);

      return reply.send({
        success: true,
        data: { count },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /notifications/:notificationId/read - Mark as read
  // --------------------------------------------------------------------------
  app.post<{ Params: NotificationParams }>(
    '/:notificationId/read',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { notificationId } = request.params;

      await notificationService.markAsRead(notificationId, userId);

      return reply.send({
        success: true,
        message: 'Notification marquée comme lue',
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /notifications/read-all - Mark all as read
  // --------------------------------------------------------------------------
  app.post<{ Body: { workspaceId?: string } }>(
    '/read-all',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { workspaceId } = request.body || {};

      const result = await notificationService.markAllAsRead(userId, workspaceId);

      return reply.send({
        success: true,
        message: `${result.count} notification(s) marquée(s) comme lue(s)`,
        data: { count: result.count },
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /notifications/:notificationId - Delete notification
  // --------------------------------------------------------------------------
  app.delete<{ Params: NotificationParams }>(
    '/:notificationId',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { notificationId } = request.params;

      await notificationService.delete(notificationId, userId);

      return reply.send({
        success: true,
        message: 'Notification supprimée',
      });
    }
  );

  // ==========================================================================
  // ALERT RULES
  // ==========================================================================

  // --------------------------------------------------------------------------
  // GET /notifications/alerts - List alert rules
  // --------------------------------------------------------------------------
  app.get<{ Querystring: { workspaceId?: string } }>(
    '/alerts',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { workspaceId } = request.query;

      const rules = await alertService.listForUser(userId, workspaceId);

      return reply.send({
        success: true,
        data: rules,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /notifications/alerts - Create alert rule
  // --------------------------------------------------------------------------
  app.post<{ Body: CreateAlertBody }>(
    '/alerts',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { workspaceId, type, name, config } = request.body;

      const rule = await alertService.create({
        userId,
        workspaceId,
        type,
        name,
        config,
      });

      return reply.status(201).send({
        success: true,
        data: rule,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /notifications/alerts/:ruleId - Get alert rule
  // --------------------------------------------------------------------------
  app.get<{ Params: AlertRuleParams }>(
    '/alerts/:ruleId',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { ruleId } = request.params;

      const rule = await alertService.getById(ruleId, userId);

      if (!rule) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Règle d\'alerte non trouvée' },
        });
      }

      return reply.send({
        success: true,
        data: rule,
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /notifications/alerts/:ruleId - Update alert rule
  // --------------------------------------------------------------------------
  app.patch<{ Params: AlertRuleParams; Body: UpdateAlertBody }>(
    '/alerts/:ruleId',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { ruleId } = request.params;
      const { name, isEnabled, config } = request.body;

      await alertService.update(ruleId, userId, {
        name,
        isEnabled,
        config,
      });

      const rule = await alertService.getById(ruleId, userId);

      return reply.send({
        success: true,
        data: rule,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /notifications/alerts/:ruleId - Delete alert rule
  // --------------------------------------------------------------------------
  app.delete<{ Params: AlertRuleParams }>(
    '/alerts/:ruleId',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { ruleId } = request.params;

      await alertService.delete(ruleId, userId);

      return reply.send({
        success: true,
        message: 'Règle d\'alerte supprimée',
      });
    }
  );

  // ==========================================================================
  // QUICK ALERT CREATION
  // ==========================================================================

  // --------------------------------------------------------------------------
  // POST /notifications/alerts/budget - Create budget alert
  // --------------------------------------------------------------------------
  app.post<{
    Body: {
      workspaceId: string;
      budgetId: string;
      thresholdPercent?: number;
    };
  }>(
    '/alerts/budget',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { workspaceId, budgetId, thresholdPercent } = request.body;

      const rule = await alertService.createBudgetAlert(
        userId,
        workspaceId,
        budgetId,
        thresholdPercent
      );

      return reply.status(201).send({
        success: true,
        data: rule,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /notifications/alerts/price - Create price alert
  // --------------------------------------------------------------------------
  app.post<{
    Body: {
      workspaceId: string;
      assetId: string;
      targetPrice: number;
      direction: 'above' | 'below';
    };
  }>(
    '/alerts/price',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { workspaceId, assetId, targetPrice, direction } = request.body;

      const rule = await alertService.createPriceAlert(
        userId,
        workspaceId,
        assetId,
        targetPrice,
        direction
      );

      return reply.status(201).send({
        success: true,
        data: rule,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /notifications/alerts/balance - Create low balance alert
  // --------------------------------------------------------------------------
  app.post<{
    Body: {
      workspaceId: string;
      accountId: string;
      threshold: number;
    };
  }>(
    '/alerts/balance',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { workspaceId, accountId, threshold } = request.body;

      const rule = await alertService.createLowBalanceAlert(
        userId,
        workspaceId,
        accountId,
        threshold
      );

      return reply.status(201).send({
        success: true,
        data: rule,
      });
    }
  );
}

export default notificationRoutes;
