// ============================================================================
// DISCORD SERVICE TESTS - Finance Hub
// Tests for discord.service.ts
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@/core/middleware/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { discordService } from './discord.service.js';

describe('discordService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isConfigured', () => {
    it('should always return true (uses user webhooks)', () => {
      expect(discordService.isConfigured()).toBe(true);
    });
  });

  describe('isValidWebhookUrl', () => {
    it('should validate correct Discord webhook URLs', () => {
      expect(
        discordService.isValidWebhookUrl('https://discord.com/api/webhooks/123456/abc123token')
      ).toBe(true);
    });

    it('should reject non-Discord URLs', () => {
      expect(discordService.isValidWebhookUrl('https://example.com/webhook')).toBe(false);
      expect(discordService.isValidWebhookUrl('https://slack.com/api/webhooks/123')).toBe(false);
    });

    it('should reject Discord URLs without webhooks path', () => {
      expect(discordService.isValidWebhookUrl('https://discord.com/channels/123')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(discordService.isValidWebhookUrl('not-a-url')).toBe(false);
      expect(discordService.isValidWebhookUrl('')).toBe(false);
    });
  });

  describe('validateWebhookUrl', () => {
    it('should return true for valid webhook', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '123', name: 'Test Webhook' }),
      });

      const result = await discordService.validateWebhookUrl(
        'https://discord.com/api/webhooks/123456/abc123token'
      );

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123456/abc123token',
        { method: 'GET' }
      );
    });

    it('should return false for invalid webhook', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await discordService.validateWebhookUrl(
        'https://discord.com/api/webhooks/invalid/token'
      );

      expect(result).toBe(false);
    });

    it('should return false for non-Discord URL', async () => {
      const result = await discordService.validateWebhookUrl('https://example.com/webhook');

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await discordService.validateWebhookUrl(
        'https://discord.com/api/webhooks/123456/abc123token'
      );

      expect(result).toBe(false);
    });
  });

  describe('sendWebhook', () => {
    it('should send embed to webhook', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const embed = {
        title: 'Test',
        description: 'Test message',
        color: 0x28A745,
      };

      const result = await discordService.sendWebhook(
        'https://discord.com/api/webhooks/123456/abc123token',
        embed
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123456/abc123token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Test'),
        })
      );
    });

    it('should return error for invalid URL', async () => {
      const result = await discordService.sendWebhook('https://example.com/webhook', {
        title: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid Discord webhook URL');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      });

      const result = await discordService.sendWebhook(
        'https://discord.com/api/webhooks/123456/abc123token',
        { title: 'Test' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Discord API error');
    });
  });

  describe('sendTestMessage', () => {
    it('should send test message with success color', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await discordService.sendTestMessage(
        'https://discord.com/api/webhooks/123456/abc123token'
      );

      expect(result.success).toBe(true);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.embeds[0].title).toContain('Test');
      expect(callBody.embeds[0].color).toBe(0x28A745); // success color
    });
  });

  describe('sendVerificationCode', () => {
    it('should send verification code embed', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await discordService.sendVerificationCode(
        'https://discord.com/api/webhooks/123456/abc123token',
        '123456'
      );

      expect(result.success).toBe(true);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.embeds[0].description).toContain('123456');
      expect(callBody.embeds[0].description).toContain('15 minutes');
    });
  });

  describe('formatNotification', () => {
    it('should format budget alert with fields', () => {
      const notification = {
        type: 'budget_alert' as const,
        title: 'Budget dépassé',
        message: 'Le budget Alimentation a été dépassé',
        data: { percentUsed: 115, categoryName: 'Alimentation' },
      };

      const embed = discordService.formatNotification(notification);

      expect(embed.title).toContain('🚨');
      expect(embed.title).toContain('Budget dépassé');
      expect(embed.color).toBe(0xDC3545); // danger color
      expect(embed.fields).toBeDefined();
      expect(embed.fields).toContainEqual(
        expect.objectContaining({ name: 'Utilisation', value: '115%' })
      );
      expect(embed.fields).toContainEqual(
        expect.objectContaining({ name: 'Categorie', value: 'Alimentation' })
      );
    });

    it('should format low balance warning with fields', () => {
      const notification = {
        type: 'low_balance_warning' as const,
        title: 'Solde bas',
        message: 'Le solde est bas',
        data: { accountName: 'Compte Courant', balance: 50.25, threshold: 100 },
      };

      const embed = discordService.formatNotification(notification);

      expect(embed.title).toContain('💸');
      expect(embed.color).toBe(0xDC3545); // danger color
      expect(embed.fields).toContainEqual(
        expect.objectContaining({ name: 'Compte', value: 'Compte Courant' })
      );
      expect(embed.fields).toContainEqual(
        expect.objectContaining({ name: 'Solde', value: '50.25 EUR' })
      );
    });

    it('should format import complete with stats', () => {
      const notification = {
        type: 'import_complete' as const,
        title: 'Import terminé',
        message: 'Import réussi',
        data: { imported: 50, skipped: 5, errors: 2 },
      };

      const embed = discordService.formatNotification(notification);

      expect(embed.title).toContain('✅');
      expect(embed.color).toBe(0x28A745); // success color
      expect(embed.fields).toContainEqual(
        expect.objectContaining({ name: 'Importees', value: '50' })
      );
      expect(embed.fields).toContainEqual(
        expect.objectContaining({ name: 'Ignorees', value: '5' })
      );
      expect(embed.fields).toContainEqual(
        expect.objectContaining({ name: 'Erreurs', value: '2' })
      );
    });

    it('should format weekly summary with financial data', () => {
      const notification = {
        type: 'weekly_summary' as const,
        title: 'Résumé hebdomadaire',
        message: 'Votre résumé de la semaine',
        data: { totalSpent: 500, totalIncome: 800, netChange: 300 },
      };

      const embed = discordService.formatNotification(notification);

      expect(embed.title).toContain('📊');
      expect(embed.color).toBe(0x6366F1); // primary color
      expect(embed.fields).toContainEqual(
        expect.objectContaining({ name: 'Depenses', value: '500.00 EUR' })
      );
      expect(embed.fields).toContainEqual(
        expect.objectContaining({ name: 'Revenus', value: '800.00 EUR' })
      );
      expect(embed.fields).toContainEqual(
        expect.objectContaining({ name: 'Bilan', value: '+300.00 EUR' })
      );
    });

    it('should include footer and timestamp', () => {
      const notification = {
        type: 'system' as const,
        title: 'Test',
        message: 'Test message',
        data: null,
      };

      const embed = discordService.formatNotification(notification);

      expect(embed.footer).toEqual({ text: 'HubCompta' });
      expect(embed.timestamp).toBeDefined();
    });
  });

  describe('getColorForType', () => {
    it('should return danger color for alerts', () => {
      expect(discordService.getColorForType('budget_alert')).toBe(0xDC3545);
      expect(discordService.getColorForType('invoice_overdue')).toBe(0xDC3545);
      expect(discordService.getColorForType('low_balance_warning')).toBe(0xDC3545);
    });

    it('should return warning color for warnings', () => {
      expect(discordService.getColorForType('budget_warning')).toBe(0xFFC107);
      expect(discordService.getColorForType('quote_expiring')).toBe(0xFFC107);
      expect(discordService.getColorForType('savings_off_track')).toBe(0xFFC107);
    });

    it('should return success color for positive events', () => {
      expect(discordService.getColorForType('import_complete')).toBe(0x28A745);
      expect(discordService.getColorForType('invoice_paid')).toBe(0x28A745);
      expect(discordService.getColorForType('goal_achieved')).toBe(0x28A745);
    });
  });

  describe('getEmojiForType', () => {
    it('should return correct emojis', () => {
      expect(discordService.getEmojiForType('budget_alert')).toBe('🚨');
      expect(discordService.getEmojiForType('budget_warning')).toBe('⚠️');
      expect(discordService.getEmojiForType('import_complete')).toBe('✅');
      expect(discordService.getEmojiForType('weekly_summary')).toBe('📊');
      expect(discordService.getEmojiForType('goal_achieved')).toBe('🎯');
    });
  });
});
