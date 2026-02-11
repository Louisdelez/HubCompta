// ============================================================================
// DISCORD SERVICE - Finance Hub
// Discord Webhook integration for notifications
// ============================================================================

import { logger } from '@/core/middleware/logger.js';
import type { NotificationType, Notification } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
    icon_url?: string;
  };
  timestamp?: string;
  thumbnail?: {
    url: string;
  };
}

export interface DiscordWebhookPayload {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
}

export interface DiscordSendResult {
  success: boolean;
  error?: string;
}

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const DISCORD_BOT_NAME = process.env.DISCORD_BOT_NAME ?? 'HubCompta';
const DISCORD_AVATAR_URL = process.env.DISCORD_AVATAR_URL;

// Colors for different notification types
const COLORS = {
  danger: 0xDC3545,    // Red
  warning: 0xFFC107,   // Yellow
  success: 0x28A745,   // Green
  info: 0x17A2B8,      // Blue
  primary: 0x6366F1,   // Indigo (brand color)
};

// ----------------------------------------------------------------------------
// Discord Service
// ----------------------------------------------------------------------------

export const discordService = {
  /**
   * Check if Discord is configured (always true as it uses user webhooks)
   */
  isConfigured(): boolean {
    return true;
  },

  /**
   * Validate a Discord webhook URL
   */
  async validateWebhookUrl(webhookUrl: string): Promise<boolean> {
    if (!this.isValidWebhookUrl(webhookUrl)) {
      return false;
    }

    try {
      // Discord webhooks support GET to retrieve webhook info
      const response = await fetch(webhookUrl, {
        method: 'GET',
      });

      return response.ok;
    } catch (error) {
      logger.error({ error }, 'Failed to validate Discord webhook URL');
      return false;
    }
  },

  /**
   * Check if URL matches Discord webhook format
   */
  isValidWebhookUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return (
        parsed.hostname === 'discord.com' &&
        parsed.pathname.startsWith('/api/webhooks/')
      );
    } catch {
      return false;
    }
  },

  /**
   * Send a message via Discord webhook
   */
  async sendWebhook(webhookUrl: string, embed: DiscordEmbed): Promise<DiscordSendResult> {
    if (!this.isValidWebhookUrl(webhookUrl)) {
      return { success: false, error: 'Invalid Discord webhook URL' };
    }

    try {
      const payload: DiscordWebhookPayload = {
        username: DISCORD_BOT_NAME,
        avatar_url: DISCORD_AVATAR_URL,
        embeds: [embed],
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Discord API error: ${response.status} - ${error}`);
      }

      logger.info('Discord webhook message sent');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to send Discord webhook');
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Send a test message to verify webhook
   */
  async sendTestMessage(webhookUrl: string): Promise<DiscordSendResult> {
    const embed: DiscordEmbed = {
      title: '🔔 Test de connexion HubCompta',
      description: 'Votre webhook Discord est correctement configure. Vous recevrez vos notifications financieres ici.',
      color: COLORS.success,
      footer: {
        text: 'HubCompta',
      },
      timestamp: new Date().toISOString(),
    };

    return this.sendWebhook(webhookUrl, embed);
  },

  /**
   * Send verification code via Discord
   */
  async sendVerificationCode(webhookUrl: string, code: string): Promise<DiscordSendResult> {
    const embed: DiscordEmbed = {
      title: '🔐 Code de verification HubCompta',
      description: `Votre code de verification est: **${code}**\n\nCe code expire dans 15 minutes.`,
      color: COLORS.info,
      footer: {
        text: 'HubCompta',
      },
      timestamp: new Date().toISOString(),
    };

    return this.sendWebhook(webhookUrl, embed);
  },

  /**
   * Format notification as Discord embed
   */
  formatNotification(notification: Pick<Notification, 'type' | 'title' | 'message' | 'data'>): DiscordEmbed {
    const color = this.getColorForType(notification.type);
    const emoji = this.getEmojiForType(notification.type);

    const embed: DiscordEmbed = {
      title: `${emoji} ${notification.title}`,
      description: notification.message,
      color,
      footer: {
        text: 'HubCompta',
      },
      timestamp: new Date().toISOString(),
    };

    // Add data-specific fields
    const data = notification.data as Record<string, unknown> | null;
    if (data) {
      embed.fields = [];

      if (notification.type === 'budget_alert' || notification.type === 'budget_warning') {
        const percentUsed = data.percentUsed as number | undefined;
        const categoryName = data.categoryName as string | undefined;
        if (percentUsed !== undefined) {
          embed.fields.push({
            name: 'Utilisation',
            value: `${percentUsed.toFixed(0)}%`,
            inline: true,
          });
        }
        if (categoryName) {
          embed.fields.push({
            name: 'Categorie',
            value: categoryName,
            inline: true,
          });
        }
      }

      if (notification.type === 'low_balance_warning') {
        const balance = data.balance as number | undefined;
        const accountName = data.accountName as string | undefined;
        const threshold = data.threshold as number | undefined;
        if (accountName) {
          embed.fields.push({
            name: 'Compte',
            value: accountName,
            inline: true,
          });
        }
        if (balance !== undefined) {
          embed.fields.push({
            name: 'Solde',
            value: `${balance.toFixed(2)} EUR`,
            inline: true,
          });
        }
        if (threshold !== undefined) {
          embed.fields.push({
            name: 'Seuil',
            value: `${threshold.toFixed(2)} EUR`,
            inline: true,
          });
        }
      }

      if (notification.type === 'import_complete') {
        const imported = data.imported as number | undefined;
        const skipped = data.skipped as number | undefined;
        const errors = data.errors as number | undefined;
        if (imported !== undefined) {
          embed.fields.push({
            name: 'Importees',
            value: imported.toString(),
            inline: true,
          });
        }
        if (skipped !== undefined && skipped > 0) {
          embed.fields.push({
            name: 'Ignorees',
            value: skipped.toString(),
            inline: true,
          });
        }
        if (errors !== undefined && errors > 0) {
          embed.fields.push({
            name: 'Erreurs',
            value: errors.toString(),
            inline: true,
          });
        }
      }

      if (notification.type === 'weekly_summary' || notification.type === 'monthly_report') {
        const totalSpent = data.totalSpent as number | undefined;
        const totalIncome = data.totalIncome as number | undefined;
        const netChange = data.netChange as number | undefined;
        if (totalSpent !== undefined) {
          embed.fields.push({
            name: 'Depenses',
            value: `${totalSpent.toFixed(2)} EUR`,
            inline: true,
          });
        }
        if (totalIncome !== undefined) {
          embed.fields.push({
            name: 'Revenus',
            value: `${totalIncome.toFixed(2)} EUR`,
            inline: true,
          });
        }
        if (netChange !== undefined) {
          const sign = netChange >= 0 ? '+' : '';
          embed.fields.push({
            name: 'Bilan',
            value: `${sign}${netChange.toFixed(2)} EUR`,
            inline: true,
          });
        }
      }

      // Remove fields if empty
      if (embed.fields.length === 0) {
        delete embed.fields;
      }
    }

    return embed;
  },

  /**
   * Get color for notification type
   */
  getColorForType(type: NotificationType): number {
    const colorMap: Record<NotificationType, number> = {
      budget_alert: COLORS.danger,
      budget_warning: COLORS.warning,
      bill_reminder: COLORS.info,
      import_complete: COLORS.success,
      export_ready: COLORS.success,
      invoice_overdue: COLORS.danger,
      invoice_paid: COLORS.success,
      quote_accepted: COLORS.success,
      quote_expiring: COLORS.warning,
      price_alert: COLORS.info,
      system: COLORS.primary,
      savings_milestone: COLORS.success,
      savings_off_track: COLORS.warning,
      unusual_spending: COLORS.warning,
      weekly_summary: COLORS.primary,
      monthly_report: COLORS.primary,
      low_balance_warning: COLORS.danger,
      recurring_processed: COLORS.info,
      goal_achieved: COLORS.success,
      bill_upcoming: COLORS.warning,
    };
    return colorMap[type] ?? COLORS.primary;
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
};

export default discordService;
