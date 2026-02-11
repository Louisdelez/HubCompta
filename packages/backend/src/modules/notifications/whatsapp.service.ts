// ============================================================================
// WHATSAPP SERVICE - Finance Hub
// WhatsApp Business API integration via Twilio
// ============================================================================

import { logger } from '@/core/middleware/logger.js';
import type { NotificationType, Notification } from '@prisma/client';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;

// Alternative: Meta WhatsApp Business API
const WHATSAPP_BUSINESS_TOKEN = process.env.WHATSAPP_BUSINESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface WhatsAppMessage {
  to: string;
  body: string;
}

export interface WhatsAppTemplateMessage {
  to: string;
  templateId: string;
  params: Record<string, string>;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ----------------------------------------------------------------------------
// WhatsApp Service
// ----------------------------------------------------------------------------

export const whatsappService = {
  /**
   * Check if WhatsApp service is configured
   */
  isConfigured(): boolean {
    return !!(
      (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_NUMBER) ||
      (WHATSAPP_BUSINESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID)
    );
  },

  /**
   * Get configured provider
   */
  getProvider(): 'twilio' | 'meta' | null {
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_NUMBER) {
      return 'twilio';
    }
    if (WHATSAPP_BUSINESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
      return 'meta';
    }
    return null;
  },

  /**
   * Send a WhatsApp message
   */
  async sendMessage(phone: string, message: string): Promise<WhatsAppSendResult> {
    const provider = this.getProvider();

    if (!provider) {
      logger.warn({ phone }, 'WhatsApp not configured, message not sent');
      return { success: false, error: 'WhatsApp service not configured' };
    }

    try {
      if (provider === 'twilio') {
        return await this.sendViaTwilio(phone, message);
      } else {
        return await this.sendViaMeta(phone, message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, phone }, 'Failed to send WhatsApp message');
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Send message via Twilio
   */
  async sendViaTwilio(phone: string, message: string): Promise<WhatsAppSendResult> {
    const formattedPhone = this.formatPhoneNumber(phone);
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    const body = new URLSearchParams({
      From: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
      To: `whatsapp:${formattedPhone}`,
      Body: message,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twilio API error: ${error}`);
    }

    const result = await response.json() as { sid: string };
    logger.info({ messageId: result.sid, phone: formattedPhone }, 'WhatsApp message sent via Twilio');

    return { success: true, messageId: result.sid };
  },

  /**
   * Send message via Meta WhatsApp Business API
   */
  async sendViaMeta(phone: string, message: string): Promise<WhatsAppSendResult> {
    const formattedPhone = this.formatPhoneNumber(phone).replace('+', '');
    const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_BUSINESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: { body: message },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meta API error: ${error}`);
    }

    const result = await response.json() as { messages: Array<{ id: string }> };
    const messageId = result.messages?.[0]?.id;
    logger.info({ messageId, phone: formattedPhone }, 'WhatsApp message sent via Meta');

    return { success: true, messageId };
  },

  /**
   * Send a WhatsApp template message (for approved templates)
   */
  async sendTemplate(phone: string, templateId: string, params: Record<string, string>): Promise<WhatsAppSendResult> {
    const provider = this.getProvider();

    if (!provider) {
      return { success: false, error: 'WhatsApp service not configured' };
    }

    // Template messages are primarily supported via Meta API
    if (provider !== 'meta') {
      // Fall back to regular message for Twilio
      const message = this.formatTemplateAsText(templateId, params);
      return this.sendMessage(phone, message);
    }

    try {
      const formattedPhone = this.formatPhoneNumber(phone).replace('+', '');
      const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_BUSINESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'template',
          template: {
            name: templateId,
            language: { code: 'fr' },
            components: [
              {
                type: 'body',
                parameters: Object.values(params).map((value) => ({
                  type: 'text',
                  text: value,
                })),
              },
            ],
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Meta Template API error: ${error}`);
      }

      const result = await response.json() as { messages: Array<{ id: string }> };
      return { success: true, messageId: result.messages?.[0]?.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, phone, templateId }, 'Failed to send WhatsApp template');
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Send verification code via WhatsApp
   */
  async sendVerificationCode(phone: string, code: string): Promise<WhatsAppSendResult> {
    const message = `Votre code de verification HubCompta est: ${code}\n\nCe code expire dans 15 minutes.`;
    return this.sendMessage(phone, message);
  },

  /**
   * Format notification for WhatsApp
   */
  formatNotification(notification: Pick<Notification, 'type' | 'title' | 'message' | 'data'>): string {
    const emoji = this.getEmojiForType(notification.type);
    let text = `${emoji} *${notification.title}*\n\n${notification.message}`;

    // Add data-specific details if available
    const data = notification.data as Record<string, unknown> | null;
    if (data) {
      if (notification.type === 'budget_alert' || notification.type === 'budget_warning') {
        const percentUsed = data.percentUsed as number | undefined;
        if (percentUsed !== undefined) {
          text += `\n\nUtilisation: ${percentUsed.toFixed(0)}%`;
        }
      }
      if (notification.type === 'low_balance_warning') {
        const balance = data.balance as number | undefined;
        const threshold = data.threshold as number | undefined;
        if (balance !== undefined && threshold !== undefined) {
          text += `\n\nSolde actuel: ${balance.toFixed(2)} EUR`;
        }
      }
    }

    // Add link to app
    const frontendUrl = process.env.FRONTEND_URL ?? 'https://app.hubcompta.com';
    text += `\n\nVoir les details: ${frontendUrl}`;

    return text;
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
   * Format template parameters as plain text (fallback)
   */
  formatTemplateAsText(templateId: string, params: Record<string, string>): string {
    // Simple fallback formatting for Twilio
    let text = '';
    for (const [key, value] of Object.entries(params)) {
      text += `${key}: ${value}\n`;
    }
    return text.trim();
  },

  /**
   * Format phone number to E.164 format
   */
  formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // If no + prefix, assume French number
    if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('0')) {
        cleaned = '+33' + cleaned.substring(1);
      } else if (cleaned.startsWith('33')) {
        cleaned = '+' + cleaned;
      } else {
        cleaned = '+33' + cleaned;
      }
    }

    return cleaned;
  },

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phone: string): boolean {
    const formatted = this.formatPhoneNumber(phone);
    // E.164 format: + followed by 10-15 digits
    return /^\+[1-9]\d{9,14}$/.test(formatted);
  },
};

export default whatsappService;
