// ============================================================================
// NOTIFICATION CHANNEL SERVICE TESTS - Finance Hub
// Tests for channel.service.ts
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NotificationChannel, ChannelType } from '@prisma/client';

// Mock error handler
vi.mock('@/core/middleware/errorHandler.js', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(resource: string, id?: string) {
      super(id ? `${resource} with ID ${id} not found` : `${resource} not found`);
      this.name = 'NotFoundError';
    }
  },
  ConflictError: class ConflictError extends Error {
    constructor(entityOrMessage: string, field?: string, value?: string) {
      const message = field && value
        ? `${entityOrMessage} with ${field} "${value}" already exists`
        : entityOrMessage;
      super(message);
      this.name = 'ConflictError';
    }
  },
  ValidationError: class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  },
}));

// Mock Prisma client
vi.mock('@/core/database/client.js', () => ({
  prisma: {
    notificationChannel: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

import { prisma } from '@/core/database/client.js';
import { notificationChannelService, NOTIFICATION_TYPES } from './channel.service.js';

// Helper to create mock channel
const createMockChannel = (overrides = {}): NotificationChannel => ({
  id: 'channel-123',
  userId: 'user-123',
  channelType: 'email' as ChannelType,
  email: 'test@example.com',
  emailVerified: false,
  whatsappPhone: null,
  whatsappVerified: false,
  discordWebhookUrl: null,
  discordVerified: false,
  enabledTypes: ['budget_alert', 'budget_warning'],
  isActive: false,
  verificationCode: null,
  verificationSentAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('notificationChannelService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // NOTIFICATION_TYPES constant
  // --------------------------------------------------------------------------

  describe('NOTIFICATION_TYPES', () => {
    it('should contain all expected notification types', () => {
      expect(NOTIFICATION_TYPES).toContain('budget_alert');
      expect(NOTIFICATION_TYPES).toContain('budget_warning');
      expect(NOTIFICATION_TYPES).toContain('bill_reminder');
      expect(NOTIFICATION_TYPES).toContain('weekly_summary');
      expect(NOTIFICATION_TYPES).toContain('monthly_report');
      expect(NOTIFICATION_TYPES.length).toBeGreaterThan(10);
    });
  });

  // --------------------------------------------------------------------------
  // getChannels
  // --------------------------------------------------------------------------

  describe('getChannels', () => {
    it('should return all channels for a user', async () => {
      const mockChannels = [
        createMockChannel({ id: 'channel-1', channelType: 'email' }),
        createMockChannel({ id: 'channel-2', channelType: 'discord' }),
      ];

      vi.mocked(prisma.notificationChannel.findMany).mockResolvedValue(mockChannels);

      const result = await notificationChannelService.getChannels('user-123');

      expect(result).toEqual(mockChannels);
      expect(prisma.notificationChannel.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return empty array if no channels', async () => {
      vi.mocked(prisma.notificationChannel.findMany).mockResolvedValue([]);

      const result = await notificationChannelService.getChannels('user-123');

      expect(result).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // getChannel
  // --------------------------------------------------------------------------

  describe('getChannel', () => {
    it('should return channel if found and belongs to user', async () => {
      const mockChannel = createMockChannel();
      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue(mockChannel);

      const result = await notificationChannelService.getChannel('channel-123', 'user-123');

      expect(result).toEqual(mockChannel);
      expect(prisma.notificationChannel.findFirst).toHaveBeenCalledWith({
        where: { id: 'channel-123', userId: 'user-123' },
      });
    });

    it('should return null if channel not found', async () => {
      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue(null);

      const result = await notificationChannelService.getChannel('non-existent', 'user-123');

      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // addChannel
  // --------------------------------------------------------------------------

  describe('addChannel', () => {
    it('should create email channel', async () => {
      const mockChannel = createMockChannel();
      vi.mocked(prisma.notificationChannel.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.notificationChannel.create).mockResolvedValue(mockChannel);

      const result = await notificationChannelService.addChannel({
        userId: 'user-123',
        channelType: 'email',
        email: 'test@example.com',
      });

      expect(result).toEqual(mockChannel);
      expect(prisma.notificationChannel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          channelType: 'email',
          email: 'test@example.com',
          isActive: false,
        }),
      });
    });

    it('should throw error if channel type already exists for user', async () => {
      const existingChannel = createMockChannel();
      vi.mocked(prisma.notificationChannel.findUnique).mockResolvedValue(existingChannel);

      await expect(
        notificationChannelService.addChannel({
          userId: 'user-123',
          channelType: 'email',
          email: 'test@example.com',
        })
      ).rejects.toThrow('already exists');
    });

    it('should throw error if email missing for email channel', async () => {
      vi.mocked(prisma.notificationChannel.findUnique).mockResolvedValue(null);

      await expect(
        notificationChannelService.addChannel({
          userId: 'user-123',
          channelType: 'email',
        })
      ).rejects.toThrow('Email address is required');
    });

    it('should throw error if phone missing for whatsapp channel', async () => {
      vi.mocked(prisma.notificationChannel.findUnique).mockResolvedValue(null);

      await expect(
        notificationChannelService.addChannel({
          userId: 'user-123',
          channelType: 'whatsapp',
        })
      ).rejects.toThrow('Phone number is required');
    });

    it('should throw error if webhook URL missing for discord channel', async () => {
      vi.mocked(prisma.notificationChannel.findUnique).mockResolvedValue(null);

      await expect(
        notificationChannelService.addChannel({
          userId: 'user-123',
          channelType: 'discord',
        })
      ).rejects.toThrow('Webhook URL is required');
    });
  });

  // --------------------------------------------------------------------------
  // updateChannel
  // --------------------------------------------------------------------------

  describe('updateChannel', () => {
    it('should update channel settings', async () => {
      const mockChannel = createMockChannel();
      const updatedChannel = { ...mockChannel, enabledTypes: ['budget_alert'] };

      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue(mockChannel);
      vi.mocked(prisma.notificationChannel.update).mockResolvedValue(updatedChannel);

      const result = await notificationChannelService.updateChannel('channel-123', 'user-123', {
        enabledTypes: ['budget_alert'],
      });

      expect(result).toEqual(updatedChannel);
    });

    it('should throw error if channel not found', async () => {
      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue(null);

      await expect(
        notificationChannelService.updateChannel('non-existent', 'user-123', {})
      ).rejects.toThrow('not found');
    });
  });

  // --------------------------------------------------------------------------
  // removeChannel
  // --------------------------------------------------------------------------

  describe('removeChannel', () => {
    it('should delete channel', async () => {
      const mockChannel = createMockChannel();
      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue(mockChannel);
      vi.mocked(prisma.notificationChannel.delete).mockResolvedValue(mockChannel);

      await notificationChannelService.removeChannel('channel-123', 'user-123');

      expect(prisma.notificationChannel.delete).toHaveBeenCalledWith({
        where: { id: 'channel-123' },
      });
    });

    it('should throw error if channel not found', async () => {
      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue(null);

      await expect(
        notificationChannelService.removeChannel('non-existent', 'user-123')
      ).rejects.toThrow('not found');
    });
  });

  // --------------------------------------------------------------------------
  // verifyChannel
  // --------------------------------------------------------------------------

  describe('verifyChannel', () => {
    it('should verify channel with correct code', async () => {
      const mockChannel = createMockChannel({
        verificationCode: '123456',
        verificationSentAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago (still valid)
      });
      const verifiedChannel = { ...mockChannel, emailVerified: true, isActive: true };

      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue(mockChannel);
      vi.mocked(prisma.notificationChannel.update).mockResolvedValue(verifiedChannel);

      const result = await notificationChannelService.verifyChannel('channel-123', 'user-123', '123456');

      expect(result.success).toBe(true);
    });

    it('should fail with wrong code', async () => {
      const mockChannel = createMockChannel({
        verificationCode: '123456',
        verificationSentAt: new Date(Date.now() - 5 * 60 * 1000),
      });

      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue(mockChannel);

      const result = await notificationChannelService.verifyChannel('channel-123', 'user-123', '000000');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('should fail with expired code', async () => {
      const mockChannel = createMockChannel({
        verificationCode: '123456',
        verificationSentAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago (expired, >15min)
      });

      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue(mockChannel);

      const result = await notificationChannelService.verifyChannel('channel-123', 'user-123', '123456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });
  });

  // --------------------------------------------------------------------------
  // setEnabledTypes
  // --------------------------------------------------------------------------

  describe('setEnabledTypes', () => {
    it('should filter and set valid notification types', async () => {
      const mockChannel = createMockChannel();
      const updatedChannel = { ...mockChannel, enabledTypes: ['budget_alert', 'bill_reminder'] };

      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue(mockChannel);
      vi.mocked(prisma.notificationChannel.update).mockResolvedValue(updatedChannel);

      const result = await notificationChannelService.setEnabledTypes(
        'channel-123',
        'user-123',
        ['budget_alert', 'bill_reminder', 'invalid_type']
      );

      expect(result).toEqual(['budget_alert', 'bill_reminder']);
      expect(result).not.toContain('invalid_type');
    });
  });

  // --------------------------------------------------------------------------
  // getActiveChannelsForType
  // --------------------------------------------------------------------------

  describe('getActiveChannelsForType', () => {
    it('should return active channels for notification type', async () => {
      const mockChannels = [
        createMockChannel({
          id: 'channel-1',
          channelType: 'email',
          isActive: true,
          enabledTypes: ['budget_alert'],
        }),
      ];

      vi.mocked(prisma.notificationChannel.findMany).mockResolvedValue(mockChannels);

      const result = await notificationChannelService.getActiveChannelsForType('user-123', 'budget_alert');

      expect(result).toHaveLength(1);
      expect(prisma.notificationChannel.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          isActive: true,
          enabledTypes: { has: 'budget_alert' },
        },
      });
    });
  });
});
