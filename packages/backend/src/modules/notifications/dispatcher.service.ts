// ============================================================================
// NOTIFICATION DISPATCHER SERVICE - Finance Hub
// Orchestrates sending notifications to all configured channels
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { Notification, NotificationType, ChannelType } from '@prisma/client';
import { logger } from '@/core/middleware/logger.js';
import { emailService } from '@/core/email/index.js';
import { whatsappService } from './whatsapp.service.js';
import { smsService } from './sms.service.js';
import { discordService } from './discord.service.js';
import { notificationChannelService } from './channel.service.js';
import { pushService } from './push.service.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface DeliveryReport {
  notificationId: string;
  channels: {
    [K in ChannelType | 'push']?: {
      success: boolean;
      error?: string;
    };
  };
  deliveredVia: (ChannelType | 'push')[];
}

export interface DispatchOptions {
  skipEmail?: boolean; // Skip email even if configured (for in-app only notifications)
  skipPush?: boolean; // Skip push notifications
  forceChannels?: ChannelType[]; // Only send to these channels
}

// Notification types that should not be sent to external channels (in-app only)
const IN_APP_ONLY_TYPES: NotificationType[] = [
  'system',
];

// ----------------------------------------------------------------------------
// Notification Dispatcher Service
// ----------------------------------------------------------------------------

export const notificationDispatcherService = {
  /**
   * Dispatch a notification to all configured and enabled channels
   */
  async dispatch(notification: Notification, options: DispatchOptions = {}): Promise<DeliveryReport> {
    const report: DeliveryReport = {
      notificationId: notification.id,
      channels: {},
      deliveredVia: [],
    };

    // Check if this notification type should be in-app only
    if (IN_APP_ONLY_TYPES.includes(notification.type)) {
      logger.debug({ notificationId: notification.id, type: notification.type }, 'Notification is in-app only, skipping external channels');
      return report;
    }

    // Get all active channels for this notification type
    const channels = await notificationChannelService.getActiveChannelsForType(
      notification.userId,
      notification.type
    );

    // Filter channels based on options
    const targetChannels = options.forceChannels
      ? channels.filter((c) => options.forceChannels!.includes(c.channelType))
      : channels;

    // Dispatch to each channel
    for (const channel of targetChannels) {
      // Skip email if requested
      if (channel.channelType === 'email' && options.skipEmail) {
        continue;
      }

      const result = await this.dispatchToChannel(notification, channel.channelType, channel);
      report.channels[channel.channelType] = result;

      if (result.success) {
        report.deliveredVia.push(channel.channelType);
      }
    }

    // Send push notification (always, unless skipped)
    if (!options.skipPush) {
      const pushResult = await this.dispatchToPush(notification);
      if (pushResult.attempted) {
        report.channels['push'] = { success: pushResult.success, error: pushResult.error };
        if (pushResult.success) {
          report.deliveredVia.push('push');
        }
      }
    }

    // Update notification with delivery info
    if (report.deliveredVia.length > 0) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          deliveredVia: report.deliveredVia,
          deliveryStatus: report.channels,
        },
      });
    }

    logger.info(
      {
        notificationId: notification.id,
        type: notification.type,
        deliveredVia: report.deliveredVia,
      },
      'Notification dispatched'
    );

    return report;
  },

  /**
   * Dispatch to a specific channel
   */
  async dispatchToChannel(
    notification: Notification,
    channelType: ChannelType,
    channelConfig: {
      email?: string | null;
      whatsappPhone?: string | null;
      smsPhone?: string | null;
      discordWebhookUrl?: string | null;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      switch (channelType) {
        case 'email':
          return await this.dispatchToEmail(notification, channelConfig.email!);

        case 'whatsapp':
          return await this.dispatchToWhatsApp(notification, channelConfig.whatsappPhone!);

        case 'sms':
          return await this.dispatchToSMS(notification, channelConfig.smsPhone!);

        case 'discord':
          return await this.dispatchToDiscord(notification, channelConfig.discordWebhookUrl!);

        default:
          return { success: false, error: `Unknown channel type: ${channelType}` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, channelType, notificationId: notification.id }, 'Failed to dispatch to channel');
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Dispatch to email channel
   */
  async dispatchToEmail(notification: Notification, email: string): Promise<{ success: boolean; error?: string }> {
    if (!emailService.isConfigured()) {
      return { success: false, error: 'Email service not configured' };
    }

    // Get user for display name
    const user = await prisma.user.findUnique({
      where: { id: notification.userId },
      select: { displayName: true },
    });

    // Send simple notification email
    const result = await emailService.send({
      to: email,
      subject: notification.title,
      html: this.formatEmailHtml(notification, user?.displayName ?? 'Utilisateur'),
      text: notification.message,
    });

    return { success: result.success, error: result.error };
  },

  /**
   * Dispatch to WhatsApp channel
   */
  async dispatchToWhatsApp(notification: Notification, phone: string): Promise<{ success: boolean; error?: string }> {
    if (!whatsappService.isConfigured()) {
      return { success: false, error: 'WhatsApp service not configured' };
    }

    const message = whatsappService.formatNotification(notification);
    const result = await whatsappService.sendMessage(phone, message);

    return { success: result.success, error: result.error };
  },

  /**
   * Dispatch to SMS channel
   */
  async dispatchToSMS(notification: Notification, phone: string): Promise<{ success: boolean; error?: string }> {
    if (!smsService.isConfigured()) {
      return { success: false, error: 'SMS service not configured' };
    }

    const message = smsService.formatNotification(notification);
    const result = await smsService.sendMessage(phone, message);

    return { success: result.success, error: result.error };
  },

  /**
   * Dispatch to Discord channel
   */
  async dispatchToDiscord(notification: Notification, webhookUrl: string): Promise<{ success: boolean; error?: string }> {
    const embed = discordService.formatNotification(notification);
    const result = await discordService.sendWebhook(webhookUrl, embed);

    return { success: result.success, error: result.error };
  },

  /**
   * Dispatch to push notifications
   */
  async dispatchToPush(notification: Notification): Promise<{ attempted: boolean; success: boolean; error?: string }> {
    if (!pushService.isConfigured()) {
      return { attempted: false, success: false };
    }

    try {
      const result = await pushService.sendForNotification(notification);
      return {
        attempted: true,
        success: result.success,
        error: result.sentCount === 0 ? 'No subscriptions' : undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, notificationId: notification.id }, 'Failed to send push notification');
      return { attempted: true, success: false, error: errorMessage };
    }
  },

  /**
   * Format notification as HTML email
   */
  formatEmailHtml(notification: Notification, displayName: string): string {
    const frontendUrl = process.env.FRONTEND_URL ?? 'https://app.hubcompta.com';
    const emoji = this.getEmojiForType(notification.type);

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${notification.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 24px 32px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">HubCompta</h1>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">
      <p style="margin: 0 0 16px; color: #64748b; font-size: 14px;">Bonjour ${displayName},</p>

      <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 12px; color: #1e293b; font-size: 18px; font-weight: 600;">
          ${emoji} ${notification.title}
        </h2>
        <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6;">
          ${notification.message}
        </p>
      </div>

      <a href="${frontendUrl}" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 14px;">
        Voir les details
      </a>
    </div>

    <!-- Footer -->
    <div style="padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">
        Vous recevez cet email car vous avez active les notifications par email sur HubCompta.
      </p>
      <p style="margin: 8px 0 0; color: #94a3b8; font-size: 12px;">
        <a href="${frontendUrl}/settings/notifications" style="color: #6366f1; text-decoration: none;">Gerer vos preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`;
  },

  /**
   * Get emoji for notification type
   */
  getEmojiForType(type: NotificationType): string {
    const emojiMap: Record<NotificationType, string> = {
      budget_alert: '🚨',
      budget_warning: '⚠️',
      bill_reminder: '📅',
      import_complete: '✅',
      export_ready: '📁',
      invoice_overdue: '⏰',
      invoice_paid: '💰',
      quote_accepted: '🎉',
      quote_expiring: '⌛',
      price_alert: '📈',
      system: 'ℹ️',
      savings_milestone: '🏆',
      savings_off_track: '📉',
      unusual_spending: '🔍',
      weekly_summary: '📊',
      monthly_report: '📋',
      low_balance_warning: '💸',
      recurring_processed: '🔄',
      goal_achieved: '🎯',
      bill_upcoming: '📆',
    };
    return emojiMap[type] ?? 'ℹ️';
  },

  /**
   * Get active channels for a specific notification type
   */
  async getActiveChannelsForType(userId: string, notificationType: NotificationType): Promise<ChannelType[]> {
    const channels = await notificationChannelService.getActiveChannelsForType(userId, notificationType);
    return channels.map((c) => c.channelType);
  },

  /**
   * Send verification code to a channel
   */
  async sendVerificationToChannel(
    channelType: ChannelType,
    target: string,
    code: string
  ): Promise<{ success: boolean; error?: string }> {
    switch (channelType) {
      case 'email': {
        if (!emailService.isConfigured()) {
          return { success: false, error: 'Email service not configured' };
        }
        const emailResult = await emailService.send({
          to: target,
          subject: 'Code de verification HubCompta',
          html: this.formatVerificationEmailHtml(code),
          text: `Votre code de verification HubCompta est: ${code}\n\nCe code expire dans 15 minutes.`,
        });
        return { success: emailResult.success, error: emailResult.error };
      }

      case 'whatsapp': {
        if (!whatsappService.isConfigured()) {
          return { success: false, error: 'WhatsApp service not configured' };
        }
        const whatsappResult = await whatsappService.sendVerificationCode(target, code);
        return { success: whatsappResult.success, error: whatsappResult.error };
      }

      case 'sms': {
        if (!smsService.isConfigured()) {
          return { success: false, error: 'SMS service not configured' };
        }
        const smsResult = await smsService.sendVerificationCode(target, code);
        return { success: smsResult.success, error: smsResult.error };
      }

      case 'discord': {
        const discordResult = await discordService.sendVerificationCode(target, code);
        return { success: discordResult.success, error: discordResult.error };
      }

      default:
        return { success: false, error: `Unknown channel type: ${channelType}` };
    }
  },

  /**
   * Format verification email HTML
   */
  formatVerificationEmailHtml(code: string): string {
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code de verification</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 24px 32px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">HubCompta</h1>
    </div>

    <!-- Content -->
    <div style="padding: 32px; text-align: center;">
      <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 20px; font-weight: 600;">
        Code de verification
      </h2>
      <p style="margin: 0 0 24px; color: #64748b; font-size: 15px;">
        Utilisez ce code pour verifier votre canal de notification:
      </p>

      <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1e293b;">
          ${code}
        </span>
      </div>

      <p style="margin: 0; color: #94a3b8; font-size: 13px;">
        Ce code expire dans 15 minutes.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">
        Si vous n'avez pas demande ce code, vous pouvez ignorer cet email.
      </p>
    </div>
  </div>
</body>
</html>`;
  },
};

export default notificationDispatcherService;
