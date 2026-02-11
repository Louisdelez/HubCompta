// ============================================================================
// OCR SERVICE TESTS - Finance Hub
// ============================================================================

import { describe, it, expect } from 'vitest';
import { ocrService } from './ocr.service.js';

describe('ocrService', () => {
  describe('parseMerchant', () => {
    it('should detect known merchants', () => {
      expect(ocrService.parseMerchant('carrefour city')).toBe('Carrefour');
      expect(ocrService.parseMerchant('e.leclerc drive')).toBe('Leclerc');
      expect(ocrService.parseMerchant('lidl france')).toBe('Lidl');
      expect(ocrService.parseMerchant('auchan supermarche')).toBe('Auchan');
      expect(ocrService.parseMerchant('monoprix')).toBe('Monoprix');
    });

    it('should return null for unknown merchants', () => {
      expect(ocrService.parseMerchant('random store')).toBe(null);
    });
  });

  describe('parseDate', () => {
    it('should parse DD/MM/YYYY format', () => {
      const date = ocrService.parseDate('Date: 15/03/2024');
      expect(date).not.toBe(null);
      expect(date?.getDate()).toBe(15);
      expect(date?.getMonth()).toBe(2); // March is 0-indexed
      expect(date?.getFullYear()).toBe(2024);
    });

    it('should parse DD-MM-YYYY format', () => {
      const date = ocrService.parseDate('15-03-2024');
      expect(date).not.toBe(null);
      expect(date?.getDate()).toBe(15);
    });

    it('should parse DD.MM.YYYY format', () => {
      const date = ocrService.parseDate('15.03.2024');
      expect(date).not.toBe(null);
      expect(date?.getDate()).toBe(15);
    });

    it('should parse DD/MM/YY format', () => {
      const date = ocrService.parseDate('15/03/24');
      expect(date).not.toBe(null);
      expect(date?.getFullYear()).toBe(2024);
    });

    it('should parse French month names', () => {
      const date = ocrService.parseDate('15 mars 2024');
      expect(date).not.toBe(null);
      expect(date?.getMonth()).toBe(2);
    });

    it('should return null for invalid dates', () => {
      expect(ocrService.parseDate('no date here')).toBe(null);
    });
  });

  describe('parseAmount', () => {
    it('should extract amounts with TOTAL keyword', () => {
      expect(ocrService.parseAmount('TOTAL: 42,50')).toBe(42.5);
      expect(ocrService.parseAmount('Total TTC 125.99')).toBe(125.99);
    });

    it('should extract amounts with euro symbol', () => {
      expect(ocrService.parseAmount('Prix: 19,99 EUR')).toBe(19.99);
      expect(ocrService.parseAmount('15.50EUR')).toBe(15.50);
    });

    it('should handle French number format (comma as decimal)', () => {
      expect(ocrService.parseAmount('TOTAL: 1234,56')).toBe(1234.56);
    });

    it('should return the largest amount when no explicit total', () => {
      const text = 'Article 1: 10.00\nArticle 2: 20.00\nArticle 3: 30.00';
      expect(ocrService.parseAmount(text)).toBe(30);
    });

    it('should return null for no amounts', () => {
      expect(ocrService.parseAmount('no amounts')).toBe(null);
    });
  });

  describe('parseItems', () => {
    it('should extract line items', () => {
      const lines = [
        'Pain 2,50',
        'Lait 1,20',
        'Beurre 3,00',
      ];
      const items = ocrService.parseItems(lines);
      expect(items).toHaveLength(3);
      expect(items[0]).toEqual({ name: 'Pain', price: 2.5 });
      expect(items[1]).toEqual({ name: 'Lait', price: 1.2 });
    });

    it('should filter out total lines', () => {
      const lines = [
        'Article 5,00',
        'TOTAL 5,00',
        'Sous-total 5,00',
      ];
      const items = ocrService.parseItems(lines);
      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('Article');
    });

    it('should filter out payment method lines', () => {
      const lines = [
        'Article 5,00',
        'Carte bancaire 5,00',
        'Especes 0,00',
      ];
      const items = ocrService.parseItems(lines);
      expect(items).toHaveLength(1);
    });
  });

  describe('validateImage', () => {
    it('should accept valid image types', () => {
      expect(ocrService.validateImage('image/jpeg', 1000).valid).toBe(true);
      expect(ocrService.validateImage('image/png', 1000).valid).toBe(true);
      expect(ocrService.validateImage('image/webp', 1000).valid).toBe(true);
      expect(ocrService.validateImage('image/heic', 1000).valid).toBe(true);
    });

    it('should reject invalid image types', () => {
      const result = ocrService.validateImage('application/pdf', 1000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non supporte');
    });

    it('should reject oversized files', () => {
      const result = ocrService.validateImage('image/jpeg', 20 * 1024 * 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('15MB');
    });
  });

  describe('extractReceiptData', () => {
    it('should calculate confidence based on extracted data', async () => {
      // Low confidence - no data
      const result1 = await ocrService.extractReceiptData('random text');
      expect(result1.confidence).toBe(0);

      // Higher confidence - amount found
      const result2 = await ocrService.extractReceiptData('TOTAL 50,00 EUR');
      expect(result2.confidence).toBeGreaterThan(0);

      // Full confidence - all data found
      const result3 = await ocrService.extractReceiptData(`
        CARREFOUR CITY
        15/03/2024
        Pain 2,50
        TOTAL TTC 2,50 EUR
      `);
      expect(result3.confidence).toBeGreaterThan(0.5);
    });
  });
});
