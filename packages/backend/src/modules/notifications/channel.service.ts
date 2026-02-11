// ============================================================================
// NOTIFICATION CHANNEL SERVICE - Finance Hub
// Multi-channel notification delivery management
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { NotificationType } from '@prisma/client';
import { logger } from '@/core/middleware/logger.js';
import crypto from 'crypto';

// ChannelType enum - matches Prisma schema (will be available after migration)
export type ChannelType = 'email' | 'whatsapp' | 'discord';

// NotificationChannel type for when Prisma client isn't regenerated
export interface NotificationChannelRecord {
  id: string;
  userId: string;
  channelType: ChannelType;
  email: string | null;
  emailVerified: boolean;
  whatsappPhone: string | null;
  whatsappVerified: boolean;
  discordWebhookUrl: string | null;
  discordVerified: boolean;
  enabledTypes: string[];
  isActive: boolean;
  verificationCode: string | null;
  verificationSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface CreateChannelInput {
  userId: string;
  channelType: ChannelType;
  email?: string;
  whatsappPhone?: string;
  discordWebhookUrl?: string;
  enabledTypes?: string[];
}

export interface UpdateChannelInput {
  email?: string;
  whatsappPhone?: string;
  discordWebhookUrl?: string;
  enabledTypes?: string[];
  isActive?: boolean;
}

export interface ChannelVerificationResult {
  success: boolean;
  error?: string;
}

// All notification types that can be enabled for channels
export const NOTIFICATION_TYPES: NotificationType[] = [
  'budget_alert',
  'budget_warning',
  'bill_reminder',
  'import_complete',
  'export_ready',
  'invoice_overdue',
  'invoice_paid',
  'quote_accepted',
  'quote_expiring',
  'price_alert',
  'system',
  'savings_milestone',
  'savings_off_track',
  'unusual_spending',
  'weekly_summary',
  'monthly_report',
  'low_balance_warning',
  'recurring_processed',
  'goal_achieved',
  'bill_upcoming',
];

// Default enabled types for new channels
export const DEFAULT_ENABLED_TYPES: NotificationType[] = [
  'budget_alert',
  'budget_warning',
  'bill_reminder',
  'invoice_overdue',
  'low_balance_warning',
  'unusual_spending',
];

// ----------------------------------------------------------------------------
// Notification Channel Service
// ----------------------------------------------------------------------------

export const notificationChannelService = {
  // --------------------------------------------------------------------------
  // Get All Channels for User
  // --------------------------------------------------------------------------
  async getChannels(userId: string) {
    return prisma.notificationChannel.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  },

  // --------------------------------------------------------------------------
  // Get Channel by ID
  // --------------------------------------------------------------------------
  async getChannel(channelId: string, userId: string) {
    return prisma.notificationChannel.findFirst({
      where: {
        id: channelId,
        userId,
      },
    });
  },

  // --------------------------------------------------------------------------
  // Get Channel by Type for User
  // --------------------------------------------------------------------------
  async getChannelByType(userId: string, channelType: ChannelType) {
    return prisma.notificationChannel.findUnique({
      where: {
        userId_channelType: {
          userId,
          channelType,
        },
      },
    });
  },

  // --------------------------------------------------------------------------
  // Add Channel
  // --------------------------------------------------------------------------
  async addChannel(input: CreateChannelInput) {
    const { userId, channelType, email, whatsappPhone, discordWebhookUrl, enabledTypes } = input;

    // Check if channel already exists
    const existing = await this.getChannelByType(userId, channelType);
    if (existing) {
      throw new Error(`Channel ${channelType} already exists for this user`);
    }

    // Validate channel-specific fields
    if (channelType === 'email' && !email) {
      throw new Error('Email address is required for email channel');
    }
    if (channelType === 'whatsapp' && !whatsappPhone) {
      throw new Error('Phone number is required for WhatsApp channel');
    }
    if (channelType === 'discord' && !discordWebhookUrl) {
      throw new Error('Webhook URL is required for Discord channel');
    }

    // Create channel
    const channel = await prisma.notificationChannel.create({
      data: {
        userId,
        channelType,
        email: channelType === 'email' ? email : null,
        whatsappPhone: channelType === 'whatsapp' ? whatsappPhone : null,
        discordWebhookUrl: channelType === 'discord' ? discordWebhookUrl : null,
        enabledTypes: enabledTypes ?? DEFAULT_ENABLED_TYPES,
        isActive: false, // Inactive until verified
      },
    });

    logger.info({ userId, channelType, channelId: channel.id }, 'Notification channel created');

    return channel;
  },

  // --------------------------------------------------------------------------
  // Update Channel
  // --------------------------------------------------------------------------
  async updateChannel(channelId: string, userId: string, updates: UpdateChannelInput) {
    const channel = await this.getChannel(channelId, userId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // If changing the target (email, phone, webhook), reset verification
    const needsReverification =
      (updates.email && updates.email !== channel.email) ||
      (updates.whatsappPhone && updates.whatsappPhone !== channel.whatsappPhone) ||
      (updates.discordWebhookUrl && updates.discordWebhookUrl !== channel.discordWebhookUrl);

    const updatedChannel = await prisma.notificationChannel.update({
      where: { id: channelId },
      data: {
        ...(updates.email !== undefined && { email: updates.email }),
        ...(updates.whatsappPhone !== undefined && { whatsappPhone: updates.whatsappPhone }),
        ...(updates.discordWebhookUrl !== undefined && { discordWebhookUrl: updates.discordWebhookUrl }),
        ...(updates.enabledTypes !== undefined && { enabledTypes: updates.enabledTypes }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive }),
        // Reset verification if target changed
        ...(needsReverification && {
          emailVerified: channel.channelType === 'email' ? false : channel.emailVerified,
          whatsappVerified: channel.channelType === 'whatsapp' ? false : channel.whatsappVerified,
          discordVerified: channel.channelType === 'discord' ? false : channel.discordVerified,
          isActive: false,
        }),
      },
    });

    logger.info({ channelId, userId, needsReverification }, 'Notification channel updated');

    return updatedChannel;
  },

  // --------------------------------------------------------------------------
  // Remove Channel
  // --------------------------------------------------------------------------
  async removeChannel(channelId: string, userId: string) {
    const channel = await this.getChannel(channelId, userId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    await prisma.notificationChannel.delete({
      where: { id: channelId },
    });

    logger.info({ channelId, userId, channelType: channel.channelType }, 'Notification channel removed');
  },

  // --------------------------------------------------------------------------
  // Generate Verification Code
  // --------------------------------------------------------------------------
  async sendVerification(channelId: string, userId: string): Promise<string> {
    const channel = await this.getChannel(channelId, userId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Generate 6-digit verification code
    const code = crypto.randomInt(100000, 999999).toString();

    // Save code to database
    await prisma.notificationChannel.update({
      where: { id: channelId },
      data: {
        verificationCode: code,
        verificationSentAt: new Date(),
      },
    });

    logger.info({ channelId, channelType: channel.channelType }, 'Verification code generated');

    return code;
  },

  // --------------------------------------------------------------------------
  // Verify Channel
  // --------------------------------------------------------------------------
  async verifyChannel(channelId: string, userId: string, code: string): Promise<ChannelVerificationResult> {
    const channel = await this.getChannel(channelId, userId);
    if (!channel) {
      return { success: false, error: 'Channel not found' };
    }

    // Check if code matches
    if (channel.verificationCode !== code) {
      return { success: false, error: 'Invalid verification code' };
    }

    // Check if code is expired (15 minutes)
    if (channel.verificationSentAt) {
      const expirationTime = new Date(channel.verificationSentAt.getTime() + 15 * 60 * 1000);
      if (new Date() > expirationTime) {
        return { success: false, error: 'Verification code expired' };
      }
    }

    // Mark channel as verified and active
    const verificationField =
      channel.channelType === 'email'
        ? 'emailVerified'
        : channel.channelType === 'whatsapp'
        ? 'whatsappVerified'
        : 'discordVerified';

    await prisma.notificationChannel.update({
      where: { id: channelId },
      data: {
        [verificationField]: true,
        isActive: true,
        verificationCode: null,
        verificationSentAt: null,
      },
    });

    logger.info({ channelId, channelType: channel.channelType }, 'Channel verified');

    return { success: true };
  },

  // --------------------------------------------------------------------------
  // Get Enabled Types for Channel
  // --------------------------------------------------------------------------
  async getEnabledTypesForChannel(userId: string, channelType: ChannelType): Promise<string[]> {
    const channel = await this.getChannelByType(userId, channelType);
    if (!channel || !channel.isActive) {
      return [];
    }
    return channel.enabledTypes;
  },

  // --------------------------------------------------------------------------
  // Set Enabled Types
  // --------------------------------------------------------------------------
  async setEnabledTypes(channelId: string, userId: string, types: string[]) {
    const channel = await this.getChannel(channelId, userId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Validate types
    const validTypes = types.filter((t) => NOTIFICATION_TYPES.includes(t as NotificationType));

    await prisma.notificationChannel.update({
      where: { id: channelId },
      data: { enabledTypes: validTypes },
    });

    logger.info({ channelId, enabledCount: validTypes.length }, 'Channel enabled types updated');

    return validTypes;
  },

  // --------------------------------------------------------------------------
  // Get Active Channels for Notification Type
  // --------------------------------------------------------------------------
  async getActiveChannelsForType(userId: string, notificationType: NotificationType) {
    const channels = await prisma.notificationChannel.findMany({
      where: {
        userId,
        isActive: true,
        enabledTypes: { has: notificationType },
      },
    });

    return channels;
  },

  // --------------------------------------------------------------------------
  // Check if Channel is Verified
  // --------------------------------------------------------------------------
  isChannelVerified(channel: NotificationChannelRecord): boolean {
    switch (channel.channelType) {
      case 'email':
        return channel.emailVerified;
      case 'whatsapp':
        return channel.whatsappVerified;
      case 'discord':
        return channel.discordVerified;
      default:
        return false;
    }
  },
};

export default notificationChannelService;
