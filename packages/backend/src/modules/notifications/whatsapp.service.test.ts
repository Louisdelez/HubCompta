// ============================================================================
// WHATSAPP SERVICE TESTS - Finance Hub
// Tests for whatsapp.service.ts
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

describe('whatsappService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isConfigured', () => {
    it('should return true when Twilio is configured', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'test_sid';
      process.env.TWILIO_AUTH_TOKEN = 'test_token';
      process.env.TWILIO_WHATSAPP_NUMBER = '+14155238886';

      const { whatsappService } = await import('./whatsapp.service.js');
      expect(whatsappService.isConfigured()).toBe(true);
    });

    it('should return true when Meta is configured', async () => {
      process.env.WHATSAPP_BUSINESS_TOKEN = 'test_token';
      process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';

      const { whatsappService } = await import('./whatsapp.service.js');
      expect(whatsappService.isConfigured()).toBe(true);
    });

    it('should return false when nothing is configured', async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_WHATSAPP_NUMBER;
      delete process.env.WHATSAPP_BUSINESS_TOKEN;
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;

      const { whatsappService } = await import('./whatsapp.service.js');
      expect(whatsappService.isConfigured()).toBe(false);
    });
  });

  describe('getProvider', () => {
    it('should return twilio when Twilio is configured', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'test_sid';
      process.env.TWILIO_AUTH_TOKEN = 'test_token';
      process.env.TWILIO_WHATSAPP_NUMBER = '+14155238886';

      const { whatsappService } = await import('./whatsapp.service.js');
      expect(whatsappService.getProvider()).toBe('twilio');
    });

    it('should return meta when Meta is configured', async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      process.env.WHATSAPP_BUSINESS_TOKEN = 'test_token';
      process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';

      const { whatsappService } = await import('./whatsapp.service.js');
      expect(whatsappService.getProvider()).toBe('meta');
    });

    it('should return null when not configured', async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_WHATSAPP_NUMBER;
      delete process.env.WHATSAPP_BUSINESS_TOKEN;
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;

      const { whatsappService } = await import('./whatsapp.service.js');
      expect(whatsappService.getProvider()).toBeNull();
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format French number without prefix', async () => {
      const { whatsappService } = await import('./whatsapp.service.js');
      expect(whatsappService.formatPhoneNumber('0612345678')).toBe('+33612345678');
    });

    it('should format number with + prefix', async () => {
      const { whatsappService } = await import('./whatsapp.service.js');
      expect(whatsappService.formatPhoneNumber('+33612345678')).toBe('+33612345678');
    });

    it('should format number with 33 prefix', async () => {
      const { whatsappService } = await import('./whatsapp.service.js');
      expect(whatsappService.formatPhoneNumber('33612345678')).toBe('+33612345678');
    });

    it('should remove spaces and dashes', async () => {
      const { whatsappService } = await import('./whatsapp.service.js');
      expect(whatsappService.formatPhoneNumber('+33 6 12 34 56 78')).toBe('+33612345678');
      expect(whatsappService.formatPhoneNumber('+33-6-12-34-56-78')).toBe('+33612345678');
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should validate correct E.164 format', async () => {
      const { whatsappService } = await import('./whatsapp.service.js');
      expect(whatsappService.isValidPhoneNumber('+33612345678')).toBe(true);
      expect(whatsappService.isValidPhoneNumber('+14155238886')).toBe(true);
    });

    it('should validate French number without prefix', async () => {
      const { whatsappService } = await import('./whatsapp.service.js');
      expect(whatsappService.isValidPhoneNumber('0612345678')).toBe(true);
    });

    it('should reject invalid numbers', async () => {
      const { whatsappService } = await import('./whatsapp.service.js');
      expect(whatsappService.isValidPhoneNumber('123')).toBe(false);
      expect(whatsappService.isValidPhoneNumber('abc')).toBe(false);
    });
  });

  describe('formatNotification', () => {
    it('should format budget alert notification', async () => {
      const { whatsappService } = await import('./whatsapp.service.js');

      const notification = {
        type: 'budget_alert' as const,
        title: 'Budget dépassé',
        message: 'Le budget Alimentation a été dépassé',
        data: { percentUsed: 115 },
      };

      const result = whatsappService.formatNotification(notification);

      expect(result).toContain('🚨');
      expect(result).toContain('*Budget dépassé*');
      expect(result).toContain('Utilisation: 115%');
    });

    it('should format low balance warning', async () => {
      const { whatsappService } = await import('./whatsapp.service.js');

      const notification = {
        type: 'low_balance_warning' as const,
        title: 'Solde bas',
        message: 'Le solde de votre compte est bas',
        data: { balance: 50.25, threshold: 100 },
      };

      const result = whatsappService.formatNotification(notification);

      expect(result).toContain('💸');
      expect(result).toContain('*Solde bas*');
      expect(result).toContain('Solde actuel: 50.25 EUR');
    });

    it('should include app link', async () => {
      const { whatsappService } = await import('./whatsapp.service.js');

      const notification = {
        type: 'system' as const,
        title: 'Test',
        message: 'Test message',
        data: null,
      };

      const result = whatsappService.formatNotification(notification);

      expect(result).toContain('Voir les details:');
    });
  });

  describe('getEmojiForType', () => {
    it('should return correct emojis for notification types', async () => {
      const { whatsappService } = await import('./whatsapp.service.js');

      expect(whatsappService.getEmojiForType('budget_alert')).toBe('🚨');
      expect(whatsappService.getEmojiForType('budget_warning')).toBe('⚠️');
      expect(whatsappService.getEmojiForType('import_complete')).toBe('✅');
      expect(whatsappService.getEmojiForType('savings_milestone')).toBe('🏆');
      expect(whatsappService.getEmojiForType('goal_achieved')).toBe('🎯');
    });
  });

  describe('sendMessage', () => {
    it('should return error when not configured', async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_WHATSAPP_NUMBER;
      delete process.env.WHATSAPP_BUSINESS_TOKEN;
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;

      const { whatsappService } = await import('./whatsapp.service.js');
      const result = await whatsappService.sendMessage('+33612345678', 'Test message');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('sendVerificationCode', () => {
    it('should format verification message correctly', async () => {
      // Mock sendMessage to capture the message
      const { whatsappService } = await import('./whatsapp.service.js');
      const sendMessageSpy = vi.spyOn(whatsappService, 'sendMessage').mockResolvedValue({ success: true });

      await whatsappService.sendVerificationCode('+33612345678', '123456');

      expect(sendMessageSpy).toHaveBeenCalledWith(
        '+33612345678',
        expect.stringContaining('123456')
      );
      expect(sendMessageSpy).toHaveBeenCalledWith(
        '+33612345678',
        expect.stringContaining('15 minutes')
      );
    });
  });
});
