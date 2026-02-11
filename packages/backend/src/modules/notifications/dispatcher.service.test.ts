// ============================================================================
// NOTIFICATION DISPATCHER SERVICE TESTS - Finance Hub
// Tests for dispatcher.service.ts
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Notification, NotificationType, ChannelType } from '@prisma/client';

// Mock error handler
vi.mock('@/core/middleware/errorHandler.js', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(resource: string, id?: string) {
      super(id ? `${resource} with ID ${id} not found` : `${resource} not found`);
      this.name = 'NotFoundError';
    }
  },
}));

// Mock Prisma client
vi.mock('@/core/database/client.js', () => ({
  prisma: {
    notification: {
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock('@/core/middleware/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock email service
vi.mock('@/core/email/index.js', () => ({
  emailService: {
    isConfigured: vi.fn().mockReturnValue(true),
    send: vi.fn().mockResolvedValue({ success: true }),
  },
  notificationPreferencesService: {
    shouldSendEmail: vi.fn().mockResolvedValue(true),
    getForUser: vi.fn().mockResolvedValue({ emailEnabled: true }),
  },
}));

// Mock WhatsApp service
vi.mock('./whatsapp.service.js', () => ({
  whatsappService: {
    isConfigured: vi.fn().mockReturnValue(true),
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
    formatNotification: vi.fn().mockReturnValue('Formatted message'),
  },
}));

// Mock Discord service
vi.mock('./discord.service.js', () => ({
  discordService: {
    isConfigured: vi.fn().mockReturnValue(true),
    sendWebhook: vi.fn().mockResolvedValue({ success: true }),
    formatNotification: vi.fn().mockReturnValue({ title: 'Test', description: 'Test' }),
    sendVerificationCode: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock channel service
vi.mock('./channel.service.js', () => ({
  notificationChannelService: {
    getActiveChannelsForType: vi.fn().mockResolvedValue([]),
  },
}));

import { prisma } from '@/core/database/client.js';
import { emailService } from '@/core/email/index.js';
import { whatsappService } from './whatsapp.service.js';
import { discordService } from './discord.service.js';
import { notificationChannelService } from './channel.service.js';
import { notificationDispatcherService } from './dispatcher.service.js';

// Helper to create mock notification
const createMockNotification = (overrides = {}): Notification => ({
  id: 'notif-123',
  userId: 'user-123',
  workspaceId: 'workspace-123',
  type: 'budget_alert' as NotificationType,
  title: 'Budget Alert',
  message: 'Budget exceeded',
  data: { percentUsed: 115 },
  isRead: false,
  readAt: null,
  deliveredVia: [],
  deliveryStatus: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('notificationDispatcherService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // dispatch
  // --------------------------------------------------------------------------

  describe('dispatch', () => {
    it('should skip in-app only notifications', async () => {
      const notification = createMockNotification({ type: 'system' });

      const result = await notificationDispatcherService.dispatch(notification);

      expect(result.notificationId).toBe('notif-123');
      expect(result.deliveredVia).toEqual([]);
      expect(notificationChannelService.getActiveChannelsForType).not.toHaveBeenCalled();
    });

    it('should dispatch to all active channels', async () => {
      const notification = createMockNotification();

      vi.mocked(notificationChannelService.getActiveChannelsForType).mockResolvedValue([
        {
          id: 'channel-1',
          channelType: 'email' as ChannelType,
          email: 'test@example.com',
          whatsappPhone: null,
          discordWebhookUrl: null,
        },
        {
          id: 'channel-2',
          channelType: 'discord' as ChannelType,
          email: null,
          whatsappPhone: null,
          discordWebhookUrl: 'https://discord.com/api/webhooks/123/abc',
        },
      ]);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-123',
        displayName: 'Test User',
      } as any);

      vi.mocked(prisma.notification.update).mockResolvedValue(notification);

      const result = await notificationDispatcherService.dispatch(notification);

      expect(result.deliveredVia).toContain('email');
      expect(result.deliveredVia).toContain('discord');
      expect(emailService.send).toHaveBeenCalled();
      expect(discordService.sendWebhook).toHaveBeenCalled();
    });

    it('should skip email when skipEmail option is true', async () => {
      const notification = createMockNotification();

      vi.mocked(notificationChannelService.getActiveChannelsForType).mockResolvedValue([
        {
          id: 'channel-1',
          channelType: 'email' as ChannelType,
          email: 'test@example.com',
          whatsappPhone: null,
          discordWebhookUrl: null,
        },
      ]);

      const result = await notificationDispatcherService.dispatch(notification, { skipEmail: true });

      expect(result.deliveredVia).toEqual([]);
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('should only send to forced channels when specified', async () => {
      const notification = createMockNotification();

      vi.mocked(notificationChannelService.getActiveChannelsForType).mockResolvedValue([
        {
          id: 'channel-1',
          channelType: 'email' as ChannelType,
          email: 'test@example.com',
          whatsappPhone: null,
          discordWebhookUrl: null,
        },
        {
          id: 'channel-2',
          channelType: 'discord' as ChannelType,
          email: null,
          whatsappPhone: null,
          discordWebhookUrl: 'https://discord.com/api/webhooks/123/abc',
        },
      ]);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-123',
        displayName: 'Test User',
      } as any);

      vi.mocked(prisma.notification.update).mockResolvedValue(notification);

      const result = await notificationDispatcherService.dispatch(notification, {
        forceChannels: ['discord'],
      });

      expect(result.deliveredVia).not.toContain('email');
      expect(result.deliveredVia).toContain('discord');
      expect(emailService.send).not.toHaveBeenCalled();
      expect(discordService.sendWebhook).toHaveBeenCalled();
    });

    it('should update notification with delivery info', async () => {
      const notification = createMockNotification();

      vi.mocked(notificationChannelService.getActiveChannelsForType).mockResolvedValue([
        {
          id: 'channel-1',
          channelType: 'email' as ChannelType,
          email: 'test@example.com',
          whatsappPhone: null,
          discordWebhookUrl: null,
        },
      ]);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-123',
        displayName: 'Test User',
      } as any);

      vi.mocked(prisma.notification.update).mockResolvedValue(notification);

      await notificationDispatcherService.dispatch(notification);

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-123' },
        data: expect.objectContaining({
          deliveredVia: ['email'],
          deliveryStatus: expect.objectContaining({
            email: { success: true },
          }),
        }),
      });
    });

    it('should handle channel failures gracefully', async () => {
      const notification = createMockNotification();

      vi.mocked(notificationChannelService.getActiveChannelsForType).mockResolvedValue([
        {
          id: 'channel-1',
          channelType: 'discord' as ChannelType,
          email: null,
          whatsappPhone: null,
          discordWebhookUrl: 'https://discord.com/api/webhooks/123/abc',
        },
      ]);

      vi.mocked(discordService.sendWebhook).mockResolvedValue({
        success: false,
        error: 'Webhook failed',
      });

      const result = await notificationDispatcherService.dispatch(notification);

      expect(result.deliveredVia).toEqual([]);
      expect(result.channels.discord?.success).toBe(false);
      expect(result.channels.discord?.error).toBe('Webhook failed');
    });
  });

  // --------------------------------------------------------------------------
  // dispatchToChannel
  // --------------------------------------------------------------------------

  describe('dispatchToChannel', () => {
    it('should dispatch to email channel', async () => {
      const notification = createMockNotification();

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-123',
        displayName: 'Test User',
      } as any);

      const result = await notificationDispatcherService.dispatchToChannel(
        notification,
        'email',
        { email: 'test@example.com', whatsappPhone: null, discordWebhookUrl: null }
      );

      expect(result.success).toBe(true);
      expect(emailService.send).toHaveBeenCalled();
    });

    it('should dispatch to WhatsApp channel', async () => {
      const notification = createMockNotification();

      const result = await notificationDispatcherService.dispatchToChannel(
        notification,
        'whatsapp',
        { email: null, whatsappPhone: '+33612345678', discordWebhookUrl: null }
      );

      expect(result.success).toBe(true);
      expect(whatsappService.formatNotification).toHaveBeenCalledWith(notification);
      expect(whatsappService.sendMessage).toHaveBeenCalledWith('+33612345678', 'Formatted message');
    });

    it('should dispatch to Discord channel', async () => {
      const notification = createMockNotification();

      // Ensure Discord service mock returns success
      vi.mocked(discordService.sendWebhook).mockResolvedValue({ success: true });
      vi.mocked(discordService.formatNotification).mockReturnValue({ title: 'Test', description: 'Test' });

      const result = await notificationDispatcherService.dispatchToChannel(
        notification,
        'discord',
        { email: null, whatsappPhone: null, discordWebhookUrl: 'https://discord.com/api/webhooks/123/abc' }
      );

      expect(result.success).toBe(true);
      expect(discordService.formatNotification).toHaveBeenCalledWith(notification);
      expect(discordService.sendWebhook).toHaveBeenCalled();
    });

    it('should return error for unknown channel type', async () => {
      const notification = createMockNotification();

      const result = await notificationDispatcherService.dispatchToChannel(
        notification,
        'unknown' as ChannelType,
        { email: null, whatsappPhone: null, discordWebhookUrl: null }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown channel type');
    });
  });

  // --------------------------------------------------------------------------
  // sendVerificationToChannel
  // --------------------------------------------------------------------------

  describe('sendVerificationToChannel', () => {
    it('should send verification to email', async () => {
      const result = await notificationDispatcherService.sendVerificationToChannel(
        'email',
        'test@example.com',
        '123456'
      );

      expect(result.success).toBe(true);
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining('verification'),
        })
      );
    });

    it('should send verification to WhatsApp', async () => {
      vi.mocked(whatsappService.isConfigured).mockReturnValue(true);

      // Mock sendVerificationCode on whatsappService
      const whatsappServiceWithVerify = whatsappService as any;
      whatsappServiceWithVerify.sendVerificationCode = vi.fn().mockResolvedValue({ success: true });

      const result = await notificationDispatcherService.sendVerificationToChannel(
        'whatsapp',
        '+33612345678',
        '123456'
      );

      expect(result.success).toBe(true);
    });

    it('should send verification to Discord', async () => {
      const result = await notificationDispatcherService.sendVerificationToChannel(
        'discord',
        'https://discord.com/api/webhooks/123/abc',
        '123456'
      );

      expect(result.success).toBe(true);
      expect(discordService.sendVerificationCode).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/abc',
        '123456'
      );
    });

    it('should return error when email not configured', async () => {
      vi.mocked(emailService.isConfigured).mockReturnValue(false);

      const result = await notificationDispatcherService.sendVerificationToChannel(
        'email',
        'test@example.com',
        '123456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  // --------------------------------------------------------------------------
  // formatEmailHtml
  // --------------------------------------------------------------------------

  describe('formatEmailHtml', () => {
    it('should format email with notification details', () => {
      const notification = createMockNotification();

      const html = notificationDispatcherService.formatEmailHtml(notification, 'Test User');

      expect(html).toContain('Test User');
      expect(html).toContain('Budget Alert');
      expect(html).toContain('Budget exceeded');
      expect(html).toContain('HubCompta');
    });

    it('should include emoji for notification type', () => {
      const notification = createMockNotification({ type: 'savings_milestone' });

      const html = notificationDispatcherService.formatEmailHtml(notification, 'User');

      expect(html).toContain('🏆');
    });
  });

  // --------------------------------------------------------------------------
  // getEmojiForType
  // --------------------------------------------------------------------------

  describe('getEmojiForType', () => {
    it('should return correct emojis for notification types', () => {
      expect(notificationDispatcherService.getEmojiForType('budget_alert')).toBe('🚨');
      expect(notificationDispatcherService.getEmojiForType('budget_warning')).toBe('⚠️');
      expect(notificationDispatcherService.getEmojiForType('import_complete')).toBe('✅');
      expect(notificationDispatcherService.getEmojiForType('savings_milestone')).toBe('🏆');
      expect(notificationDispatcherService.getEmojiForType('goal_achieved')).toBe('🎯');
    });

    it('should return info emoji for unknown type', () => {
      const emoji = notificationDispatcherService.getEmojiForType('unknown_type' as NotificationType);
      expect(emoji).toBe('ℹ️');
    });
  });
});
