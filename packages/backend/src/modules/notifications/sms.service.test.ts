// ============================================================================
// SMS SERVICE TESTS - Finance Hub
// Tests for sms.service.ts
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
vi.mock('@/core/middleware/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Store original env
const originalEnv = process.env;

describe('smsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isConfigured', () => {
    it('should return true when Twilio SMS is configured', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'test_sid';
      process.env.TWILIO_AUTH_TOKEN = 'test_token';
      process.env.TWILIO_SMS_NUMBER = '+14155238886';

      const { smsService } = await import('./sms.service.js');
      expect(smsService.isConfigured()).toBe(true);
    });

    it('should return false when TWILIO_SMS_NUMBER is missing', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'test_sid';
      process.env.TWILIO_AUTH_TOKEN = 'test_token';
      delete process.env.TWILIO_SMS_NUMBER;

      const { smsService } = await import('./sms.service.js');
      expect(smsService.isConfigured()).toBe(false);
    });

    it('should return false when nothing is configured', async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_SMS_NUMBER;

      const { smsService } = await import('./sms.service.js');
      expect(smsService.isConfigured()).toBe(false);
    });
  });

  describe('getProvider', () => {
    it('should return twilio when Twilio SMS is configured', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'test_sid';
      process.env.TWILIO_AUTH_TOKEN = 'test_token';
      process.env.TWILIO_SMS_NUMBER = '+14155238886';

      const { smsService } = await import('./sms.service.js');
      expect(smsService.getProvider()).toBe('twilio');
    });

    it('should return null when not configured', async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_SMS_NUMBER;

      const { smsService } = await import('./sms.service.js');
      expect(smsService.getProvider()).toBeNull();
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format French number without prefix', async () => {
      const { smsService } = await import('./sms.service.js');
      expect(smsService.formatPhoneNumber('0612345678')).toBe('+33612345678');
    });

    it('should format number with + prefix', async () => {
      const { smsService } = await import('./sms.service.js');
      expect(smsService.formatPhoneNumber('+33612345678')).toBe('+33612345678');
    });

    it('should format number with 33 prefix', async () => {
      const { smsService } = await import('./sms.service.js');
      expect(smsService.formatPhoneNumber('33612345678')).toBe('+33612345678');
    });

    it('should remove spaces and dashes', async () => {
      const { smsService } = await import('./sms.service.js');
      expect(smsService.formatPhoneNumber('+33 6 12 34 56 78')).toBe('+33612345678');
      expect(smsService.formatPhoneNumber('+33-6-12-34-56-78')).toBe('+33612345678');
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should validate correct E.164 format', async () => {
      const { smsService } = await import('./sms.service.js');
      expect(smsService.isValidPhoneNumber('+33612345678')).toBe(true);
      expect(smsService.isValidPhoneNumber('+14155238886')).toBe(true);
    });

    it('should validate French number without prefix', async () => {
      const { smsService } = await import('./sms.service.js');
      expect(smsService.isValidPhoneNumber('0612345678')).toBe(true);
    });

    it('should reject invalid numbers', async () => {
      const { smsService } = await import('./sms.service.js');
      expect(smsService.isValidPhoneNumber('123')).toBe(false);
      expect(smsService.isValidPhoneNumber('abc')).toBe(false);
    });
  });

  describe('truncateMessage', () => {
    it('should not truncate short messages', async () => {
      const { smsService } = await import('./sms.service.js');
      const shortMsg = 'Hello!';
      expect(smsService.truncateMessage(shortMsg)).toBe(shortMsg);
    });

    it('should truncate long messages with ellipsis', async () => {
      const { smsService } = await import('./sms.service.js');
      const longMsg = 'A'.repeat(400);
      const result = smsService.truncateMessage(longMsg);
      expect(result.length).toBeLessThanOrEqual(306);
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('formatNotification', () => {
    it('should format budget alert notification concisely', async () => {
      const { smsService } = await import('./sms.service.js');

      const notification = {
        type: 'budget_alert' as const,
        title: 'Budget depasse',
        message: 'Le budget Alimentation a ete depasse',
        data: { percentUsed: 115 },
      };

      const result = smsService.formatNotification(notification);

      expect(result).toContain('!');
      expect(result).toContain('Budget depasse');
      expect(result).toContain('115%');
      expect(result.length).toBeLessThanOrEqual(306);
    });

    it('should format low balance warning concisely', async () => {
      const { smsService } = await import('./sms.service.js');

      const notification = {
        type: 'low_balance_warning' as const,
        title: 'Solde bas',
        message: 'Le solde de votre compte est bas',
        data: { balance: 50.25, threshold: 100 },
      };

      const result = smsService.formatNotification(notification);

      expect(result).toContain('!');
      expect(result).toContain('Solde bas');
      expect(result).toContain('50.25EUR');
      expect(result.length).toBeLessThanOrEqual(306);
    });

    it('should stay within SMS character limit', async () => {
      const { smsService } = await import('./sms.service.js');

      const notification = {
        type: 'system' as const,
        title: 'Test Title',
        message: 'A'.repeat(200), // Long message
        data: null,
      };

      const result = smsService.formatNotification(notification);
      expect(result.length).toBeLessThanOrEqual(306);
    });
  });

  describe('getEmojiForType', () => {
    it('should return simple characters for SMS', async () => {
      const { smsService } = await import('./sms.service.js');

      // SMS uses simple characters instead of emojis to save space
      expect(smsService.getEmojiForType('budget_alert')).toBe('!');
      expect(smsService.getEmojiForType('budget_warning')).toBe('!');
      expect(smsService.getEmojiForType('import_complete')).toBe('+');
      expect(smsService.getEmojiForType('savings_milestone')).toBe('+');
      expect(smsService.getEmojiForType('goal_achieved')).toBe('+');
    });
  });

  describe('sendMessage', () => {
    it('should return error when not configured', async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_SMS_NUMBER;

      const { smsService } = await import('./sms.service.js');
      const result = await smsService.sendMessage('+33612345678', 'Test message');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('sendVerificationCode', () => {
    it('should format verification message correctly', async () => {
      const { smsService } = await import('./sms.service.js');
      const sendMessageSpy = vi.spyOn(smsService, 'sendMessage').mockResolvedValue({ success: true });

      await smsService.sendVerificationCode('+33612345678', '123456');

      expect(sendMessageSpy).toHaveBeenCalledWith(
        '+33612345678',
        expect.stringContaining('123456')
      );
      expect(sendMessageSpy).toHaveBeenCalledWith(
        '+33612345678',
        expect.stringContaining('15min')
      );
    });
  });
});
