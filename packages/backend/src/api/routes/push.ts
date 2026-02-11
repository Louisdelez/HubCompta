// ============================================================================
// PUSH NOTIFICATION ROUTES - Finance Hub
// Web Push subscription management API
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { pushService } from '@/modules/notifications/push.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { logger } from '@/core/middleware/logger.js';

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
  deviceName: z.string().max(100).optional(),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface SubscriptionParams {
  subscriptionId: string;
}

// ----------------------------------------------------------------------------
// Route Registration
// ----------------------------------------------------------------------------

export async function pushNotificationRoutes(app: FastifyInstance): Promise<void> {
  // --------------------------------------------------------------------------
  // GET /vapid-public-key - Get VAPID public key (no auth required)
  // --------------------------------------------------------------------------
  app.get('/vapid-public-key', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!pushService.isConfigured()) {
      return reply.status(503).send({
        success: false,
        error: { message: 'Push notifications not configured' },
      });
    }

    return reply.send({
      success: true,
      data: {
        publicKey: pushService.getVapidPublicKey(),
      },
    });
  });

  // Apply auth middleware to remaining routes
  app.addHook('preHandler', authGuard);

  // --------------------------------------------------------------------------
  // GET /subscriptions - List user's push subscriptions
  // --------------------------------------------------------------------------
  app.get('/subscriptions', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.sub;

    const subscriptions = await pushService.getSubscriptions(userId);

    // Mask endpoint URLs for security
    const sanitizedSubscriptions = subscriptions.map((sub) => ({
      id: sub.id,
      deviceName: sub.deviceName ?? 'Unknown device',
      userAgent: sub.userAgent ? maskUserAgent(sub.userAgent) : null,
      isActive: sub.isActive,
      lastUsedAt: sub.lastUsedAt,
      createdAt: sub.createdAt,
    }));

    return reply.send({
      success: true,
      data: sanitizedSubscriptions,
    });
  });

  // --------------------------------------------------------------------------
  // POST /subscribe - Subscribe to push notifications
  // --------------------------------------------------------------------------
  app.post('/subscribe', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.sub;

    if (!pushService.isConfigured()) {
      return reply.status(503).send({
        success: false,
        error: { message: 'Push notifications not configured' },
      });
    }

    const body = subscribeSchema.parse(request.body);
    const userAgent = request.headers['user-agent'];

    const result = await pushService.subscribe(
      userId,
      body.subscription,
      {
        userAgent,
        deviceName: body.deviceName,
      }
    );

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { message: result.error ?? 'Failed to subscribe' },
      });
    }

    logger.info({ userId, subscriptionId: result.id }, 'User subscribed to push notifications');

    return reply.status(201).send({
      success: true,
      data: {
        id: result.id,
        message: 'Successfully subscribed to push notifications',
      },
    });
  });

  // --------------------------------------------------------------------------
  // POST /unsubscribe - Unsubscribe from push notifications
  // --------------------------------------------------------------------------
  app.post('/unsubscribe', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.sub;

    const body = unsubscribeSchema.parse(request.body);

    const result = await pushService.unsubscribe(userId, body.endpoint);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { message: result.error ?? 'Failed to unsubscribe' },
      });
    }

    logger.info({ userId }, 'User unsubscribed from push notifications');

    return reply.send({
      success: true,
      data: {
        message: 'Successfully unsubscribed from push notifications',
      },
    });
  });

  // --------------------------------------------------------------------------
  // DELETE /subscriptions/:subscriptionId - Delete specific subscription
  // --------------------------------------------------------------------------
  app.delete<{ Params: SubscriptionParams }>(
    '/subscriptions/:subscriptionId',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { subscriptionId } = request.params;

      const result = await pushService.unsubscribeById(userId, subscriptionId);

      if (!result.success) {
        return reply.status(404).send({
          success: false,
          error: { message: result.error ?? 'Subscription not found' },
        });
      }

      return reply.status(204).send();
    }
  );

  // --------------------------------------------------------------------------
  // POST /test - Send test push notification
  // --------------------------------------------------------------------------
  app.post('/test', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.sub;

    if (!pushService.isConfigured()) {
      return reply.status(503).send({
        success: false,
        error: { message: 'Push notifications not configured' },
      });
    }

    const subscriptions = await pushService.getSubscriptions(userId);

    if (subscriptions.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { message: 'No active push subscriptions found' },
      });
    }

    const result = await pushService.sendToUser(userId, {
      title: 'Test de notification',
      body: 'Les notifications push fonctionnent correctement !',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'hubcompta-test',
      data: {
        type: 'test',
        url: '/settings/notifications',
      },
    });

    const successCount = result.results.filter((r) => r.success).length;

    return reply.send({
      success: result.success,
      data: {
        message: `Test notification sent to ${successCount}/${subscriptions.length} device(s)`,
        sentCount: successCount,
        totalDevices: subscriptions.length,
      },
    });
  });

  // --------------------------------------------------------------------------
  // GET /status - Get push notification status for current user
  // --------------------------------------------------------------------------
  app.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.sub;

    const subscriptions = await pushService.getSubscriptions(userId);

    return reply.send({
      success: true,
      data: {
        isConfigured: pushService.isConfigured(),
        isSubscribed: subscriptions.length > 0,
        subscriptionCount: subscriptions.length,
        devices: subscriptions.map((sub) => ({
          id: sub.id,
          deviceName: sub.deviceName ?? 'Unknown device',
          lastUsedAt: sub.lastUsedAt,
        })),
      },
    });
  });
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Mask user agent string for display
 */
function maskUserAgent(userAgent: string): string {
  // Extract browser and OS info
  const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/);
  const osMatch = userAgent.match(/(Windows|Mac OS X|Linux|Android|iOS)/i);

  const browser = browserMatch ? browserMatch[0] : 'Unknown browser';
  const os = osMatch ? osMatch[0] : 'Unknown OS';

  return `${browser} on ${os}`;
}

export default pushNotificationRoutes;
