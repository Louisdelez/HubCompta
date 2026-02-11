// ============================================================================
// SMS SERVICE - Finance Hub
// SMS notifications via Twilio
// ============================================================================

import { logger } from '@/core/middleware/logger.js';
import type { NotificationType, Notification } from '@prisma/client';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_SMS_NUMBER = process.env.TWILIO_SMS_NUMBER;

// SMS character limits
const SMS_MAX_LENGTH = 160;
const SMS_MULTIPART_MAX = 306; // Allow 2 SMS segments

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface SMSSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ----------------------------------------------------------------------------
// SMS Service
// ----------------------------------------------------------------------------

export const smsService = {
  /**
   * Check if SMS service is configured
   */
  isConfigured(): boolean {
    return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_SMS_NUMBER);
  },

  /**
   * Get configured provider
   */
  getProvider(): 'twilio' | null {
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_SMS_NUMBER) {
      return 'twilio';
    }
    return null;
  },

  /**
   * Send an SMS message
   */
  async sendMessage(phone: string, message: string): Promise<SMSSendResult> {
    if (!this.isConfigured()) {
      logger.warn({ phone }, 'SMS not configured, message not sent');
      return { success: false, error: 'SMS service not configured' };
    }

    try {
      // Truncate message if too long
      const truncatedMessage = this.truncateMessage(message);
      return await this.sendViaTwilio(phone, truncatedMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, phone }, 'Failed to send SMS');
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Send SMS via Twilio
   */
  async sendViaTwilio(phone: string, message: string): Promise<SMSSendResult> {
    const formattedPhone = this.formatPhoneNumber(phone);
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    const body = new URLSearchParams({
      From: TWILIO_SMS_NUMBER!,
      To: formattedPhone,
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
      throw new Error(`Twilio SMS API error: ${error}`);
    }

    const result = await response.json() as { sid: string };
    logger.info({ messageId: result.sid, phone: formattedPhone }, 'SMS sent via Twilio');

    return { success: true, messageId: result.sid };
  },

  /**
   * Send verification code via SMS
   */
  async sendVerificationCode(phone: string, code: string): Promise<SMSSendResult> {
    const message = `HubCompta: Votre code est ${code}. Expire dans 15min.`;
    return this.sendMessage(phone, message);
  },

  /**
   * Format notification for SMS (160 char awareness)
   */
  formatNotification(notification: Pick<Notification, 'type' | 'title' | 'message' | 'data'>): string {
    const emoji = this.getEmojiForType(notification.type);

    // For SMS, we need to be concise
    // Start with emoji and title
    let text = `${emoji} ${notification.title}`;

    // Add key data if available and space permits
    const data = notification.data as Record<string, unknown> | null;
    if (data) {
      if (notification.type === 'budget_alert' || notification.type === 'budget_warning') {
        const percentUsed = data.percentUsed as number | undefined;
        if (percentUsed !== undefined) {
          text += ` (${percentUsed.toFixed(0)}% utilise)`;
        }
      }
      if (notification.type === 'low_balance_warning') {
        const balance = data.balance as number | undefined;
        if (balance !== undefined) {
          text += ` - ${balance.toFixed(2)}EUR`;
        }
      }
    }

    // Add short message if space allows
    const remainingSpace = SMS_MAX_LENGTH - text.length - 1; // -1 for newline
    if (remainingSpace > 20) {
      // Add truncated message
      const shortMessage = notification.message.substring(0, remainingSpace - 3) + (notification.message.length > remainingSpace - 3 ? '...' : '');
      if (shortMessage.length > 10) {
        text += `\n${shortMessage}`;
      }
    }

    return this.truncateMessage(text);
  },

  /**
   * Get emoji for notification type
   */
  getEmojiForType(type: NotificationType): string {
    const emojiMap: Record<NotificationType, string> = {
      budget_alert: '!',
      budget_warning: '!',
      bill_reminder: '*',
      import_complete: '+',
      export_ready: '+',
      invoice_overdue: '!',
      invoice_paid: '$',
      quote_accepted: '+',
      quote_expiring: '*',
      price_alert: '$',
      system: 'i',
      savings_milestone: '+',
      savings_off_track: '!',
      unusual_spending: '?',
      weekly_summary: '*',
      monthly_report: '*',
      low_balance_warning: '!',
      recurring_processed: '+',
      goal_achieved: '+',
      bill_upcoming: '*',
    };
    return emojiMap[type] ?? 'i';
  },

  /**
   * Truncate message to fit SMS limit
   */
  truncateMessage(message: string): string {
    if (message.length <= SMS_MULTIPART_MAX) {
      return message;
    }
    return message.substring(0, SMS_MULTIPART_MAX - 3) + '...';
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

export default smsService;
