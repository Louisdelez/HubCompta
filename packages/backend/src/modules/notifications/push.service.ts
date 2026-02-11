// ============================================================================
// PUSH NOTIFICATION SERVICE - Finance Hub
// Web Push notifications using VAPID protocol
// ============================================================================

import webpush from 'web-push';
import { prisma } from '@/core/database/client.js';
import type { Notification, NotificationType } from '@prisma/client';
import { logger } from '@/core/middleware/logger.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export interface PushSendResult {
  success: boolean;
  subscriptionId?: string;
  error?: string;
  statusCode?: number;
}

// Maximum number of consecutive failures before deactivating subscription
const MAX_FAILURE_COUNT = 5;

// ----------------------------------------------------------------------------
// VAPID Configuration
// ----------------------------------------------------------------------------

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_EMAIL = process.env.VAPID_EMAIL ?? 'mailto:admin@hubcompta.com';

// Configure web-push if VAPID keys are available
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  logger.info('Push notification service configured with VAPID keys');
} else {
  logger.warn('Push notification service not configured: VAPID keys missing');
}

// ----------------------------------------------------------------------------
// Push Service
// ----------------------------------------------------------------------------

export const pushService = {
  /**
   * Check if push notifications are configured
   */
  isConfigured(): boolean {
    return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
  },

  /**
   * Get the public VAPID key for client-side subscription
   */
  getVapidPublicKey(): string {
    return VAPID_PUBLIC_KEY;
  },

  /**
   * Subscribe a user to push notifications
   */
  async subscribe(
    userId: string,
    subscription: PushSubscriptionInput,
    deviceInfo?: { userAgent?: string; deviceName?: string }
  ): Promise<{ id: string; success: boolean; error?: string }> {
    try {
      // Check if subscription already exists
      const existing = await prisma.pushSubscription.findUnique({
        where: { endpoint: subscription.endpoint },
      });

      if (existing) {
        // Update existing subscription
        const updated = await prisma.pushSubscription.update({
          where: { id: existing.id },
          data: {
            userId,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            userAgent: deviceInfo?.userAgent,
            deviceName: deviceInfo?.deviceName,
            isActive: true,
            failureCount: 0,
            lastUsedAt: new Date(),
          },
        });

        logger.info({ userId, subscriptionId: updated.id }, 'Push subscription updated');
        return { id: updated.id, success: true };
      }

      // Create new subscription
      const created = await prisma.pushSubscription.create({
        data: {
          userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent: deviceInfo?.userAgent,
          deviceName: deviceInfo?.deviceName,
          isActive: true,
        },
      });

      logger.info({ userId, subscriptionId: created.id }, 'Push subscription created');
      return { id: created.id, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, userId }, 'Failed to create push subscription');
      return { id: '', success: false, error: errorMessage };
    }
  },

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(userId: string, endpoint: string): Promise<{ success: boolean; error?: string }> {
    try {
      const subscription = await prisma.pushSubscription.findFirst({
        where: {
          userId,
          endpoint,
        },
      });

      if (!subscription) {
        return { success: false, error: 'Subscription not found' };
      }

      await prisma.pushSubscription.delete({
        where: { id: subscription.id },
      });

      logger.info({ userId, subscriptionId: subscription.id }, 'Push subscription deleted');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, userId }, 'Failed to delete push subscription');
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Unsubscribe by subscription ID
   */
  async unsubscribeById(userId: string, subscriptionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const subscription = await prisma.pushSubscription.findFirst({
        where: {
          id: subscriptionId,
          userId,
        },
      });

      if (!subscription) {
        return { success: false, error: 'Subscription not found' };
      }

      await prisma.pushSubscription.delete({
        where: { id: subscriptionId },
      });

      logger.info({ userId, subscriptionId }, 'Push subscription deleted');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, userId }, 'Failed to delete push subscription');
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Get all push subscriptions for a user
   */
  async getSubscriptions(userId: string) {
    return prisma.pushSubscription.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
        endpoint: true,
        userAgent: true,
        deviceName: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Send push notification to a specific subscription
   */
  async sendToSubscription(
    subscriptionId: string,
    payload: PushNotificationPayload
  ): Promise<PushSendResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Push service not configured' };
    }

    const subscription = await prisma.pushSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription || !subscription.isActive) {
      return { success: false, error: 'Subscription not found or inactive' };
    }

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    try {
      const response = await webpush.sendNotification(
        pushSubscription,
        JSON.stringify(payload),
        {
          TTL: 60 * 60, // 1 hour TTL
          urgency: 'normal',
        }
      );

      // Update last used timestamp and reset failure count
      await prisma.pushSubscription.update({
        where: { id: subscriptionId },
        data: {
          lastUsedAt: new Date(),
          failureCount: 0,
        },
      });

      logger.debug({ subscriptionId, statusCode: response.statusCode }, 'Push notification sent');

      return {
        success: true,
        subscriptionId,
        statusCode: response.statusCode,
      };
    } catch (error) {
      return this.handleSendError(subscriptionId, error);
    }
  },

  /**
   * Send push notification to all user's subscriptions
   */
  async sendToUser(
    userId: string,
    payload: PushNotificationPayload
  ): Promise<{ success: boolean; results: PushSendResult[] }> {
    if (!this.isConfigured()) {
      return { success: false, results: [] };
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    if (subscriptions.length === 0) {
      return { success: true, results: [] };
    }

    const results: PushSendResult[] = [];

    for (const subscription of subscriptions) {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      };

      try {
        const response = await webpush.sendNotification(
          pushSubscription,
          JSON.stringify(payload),
          {
            TTL: 60 * 60,
            urgency: 'normal',
          }
        );

        // Update last used timestamp
        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: {
            lastUsedAt: new Date(),
            failureCount: 0,
          },
        });

        results.push({
          success: true,
          subscriptionId: subscription.id,
          statusCode: response.statusCode,
        });
      } catch (error) {
        const result = await this.handleSendError(subscription.id, error);
        results.push(result);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    logger.info(
      { userId, total: subscriptions.length, success: successCount },
      'Push notifications sent to user'
    );

    return {
      success: successCount > 0,
      results,
    };
  },

  /**
   * Handle send errors and manage subscription status
   */
  async handleSendError(subscriptionId: string, error: unknown): Promise<PushSendResult> {
    const webPushError = error as { statusCode?: number; message?: string };
    const statusCode = webPushError.statusCode;
    const errorMessage = webPushError.message ?? 'Unknown error';

    // Handle gone (410) or not found (404) - subscription is no longer valid
    if (statusCode === 410 || statusCode === 404) {
      await prisma.pushSubscription.delete({
        where: { id: subscriptionId },
      });

      logger.info({ subscriptionId, statusCode }, 'Push subscription removed (expired)');

      return {
        success: false,
        subscriptionId,
        error: 'Subscription expired',
        statusCode,
      };
    }

    // Increment failure count for other errors
    const subscription = await prisma.pushSubscription.update({
      where: { id: subscriptionId },
      data: {
        failureCount: { increment: 1 },
      },
    });

    // Deactivate if too many failures
    if (subscription.failureCount >= MAX_FAILURE_COUNT) {
      await prisma.pushSubscription.update({
        where: { id: subscriptionId },
        data: { isActive: false },
      });

      logger.warn(
        { subscriptionId, failureCount: subscription.failureCount },
        'Push subscription deactivated due to failures'
      );
    }

    logger.error({ subscriptionId, statusCode, error: errorMessage }, 'Push notification failed');

    return {
      success: false,
      subscriptionId,
      error: errorMessage,
      statusCode,
    };
  },

  /**
   * Format a notification for push delivery
   */
  formatNotification(notification: Notification): PushNotificationPayload {
    const icon = '/pwa-192x192.png';
    const badge = '/pwa-192x192.png';

    // Determine URL based on notification type
    let url = '/notifications';
    const data = notification.data as Record<string, unknown> | null;

    if (data) {
      switch (notification.type) {
        case 'budget_alert':
        case 'budget_warning':
          url = data.budgetId ? `/budgets/${data.budgetId}` : '/budgets';
          break;
        case 'invoice_overdue':
        case 'invoice_paid':
          url = data.invoiceId ? `/invoices/${data.invoiceId}` : '/invoices';
          break;
        case 'quote_accepted':
        case 'quote_expiring':
          url = data.quoteId ? `/quotes/${data.quoteId}` : '/quotes';
          break;
        case 'price_alert':
          url = '/investments';
          break;
        case 'import_complete':
          url = '/transactions';
          break;
        case 'low_balance_warning':
          url = data.accountId ? `/accounts/${data.accountId}` : '/accounts';
          break;
        case 'savings_milestone':
        case 'savings_off_track':
        case 'goal_achieved':
          url = '/savings';
          break;
        case 'unusual_spending':
          url = data.transactionId ? `/transactions/${data.transactionId}` : '/transactions';
          break;
        case 'weekly_summary':
        case 'monthly_report':
          url = '/reports';
          break;
        case 'bill_reminder':
        case 'bill_upcoming':
          url = '/bills';
          break;
      }
    }

    return {
      title: notification.title,
      body: notification.message,
      icon,
      badge,
      tag: `hubcompta-${notification.type}-${notification.id}`,
      data: {
        notificationId: notification.id,
        type: notification.type,
        workspaceId: notification.workspaceId,
        url,
        ...data,
      },
      requireInteraction: this.isHighPriority(notification.type),
      actions: this.getActionsForType(notification.type),
    };
  },

  /**
   * Check if notification type is high priority
   */
  isHighPriority(type: NotificationType): boolean {
    const highPriorityTypes: NotificationType[] = [
      'budget_alert',
      'invoice_overdue',
      'low_balance_warning',
      'unusual_spending',
    ];
    return highPriorityTypes.includes(type);
  },

  /**
   * Get action buttons for notification type
   */
  getActionsForType(type: NotificationType): Array<{ action: string; title: string }> {
    switch (type) {
      case 'budget_alert':
      case 'budget_warning':
        return [
          { action: 'view', title: 'Voir le budget' },
          { action: 'dismiss', title: 'Ignorer' },
        ];
      case 'invoice_overdue':
        return [
          { action: 'view', title: 'Voir la facture' },
          { action: 'remind', title: 'Rappeler' },
        ];
      case 'bill_reminder':
      case 'bill_upcoming':
        return [
          { action: 'view', title: 'Voir' },
          { action: 'paid', title: 'Marquer paye' },
        ];
      case 'unusual_spending':
        return [
          { action: 'view', title: 'Voir' },
          { action: 'dismiss', title: 'OK' },
        ];
      default:
        return [{ action: 'view', title: 'Voir' }];
    }
  },

  /**
   * Send push notification for a notification entity
   */
  async sendForNotification(notification: Notification): Promise<{ success: boolean; sentCount: number }> {
    if (!this.isConfigured()) {
      return { success: false, sentCount: 0 };
    }

    const payload = this.formatNotification(notification);
    const result = await this.sendToUser(notification.userId, payload);

    return {
      success: result.success,
      sentCount: result.results.filter((r) => r.success).length,
    };
  },

  /**
   * Cleanup inactive and expired subscriptions
   */
  async cleanupSubscriptions(): Promise<number> {
    // Delete subscriptions that have been inactive for over 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await prisma.pushSubscription.deleteMany({
      where: {
        OR: [
          { isActive: false },
          {
            lastUsedAt: {
              lt: thirtyDaysAgo,
            },
          },
        ],
      },
    });

    if (result.count > 0) {
      logger.info({ count: result.count }, 'Cleaned up inactive push subscriptions');
    }

    return result.count;
  },
};

export default pushService;
