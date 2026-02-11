// ============================================================================
// FORECAST SERVICE TESTS - Finance Hub
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Mock Prisma client
vi.mock('@/core/database/client.js', () => ({
  prisma: {
    transaction: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    budgetForecast: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '@/core/database/client.js';
import { forecastService } from './forecast.service.js';

// Helper to create mock transaction data
const createMockTransaction = (overrides = {}) => ({
  id: 'txn-123',
  workspaceId: 'workspace-123',
  date: new Date('2024-01-15'),
  amount: { toNumber: () => -100 } as Prisma.Decimal,
  categoryId: 'category-123',
  category: {
    id: 'category-123',
    name: 'Food',
    icon: '🍔',
    color: '#FF5722',
  },
  ...overrides,
});

const createMockForecast = (overrides = {}) => ({
  id: 'forecast-123',
  workspaceId: 'workspace-123',
  categoryId: 'category-123',
  month: new Date('2024-02-01'),
  predictedAmount: new Decimal(500),
  confidence: new Decimal(0.75),
  method: 'trend',
  actualAmount: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('ForecastService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // GET HISTORICAL DATA
  // ============================================================================

  describe('getHistoricalData', () => {
    it('should return spending data grouped by category', async () => {
      const transactions = [
        createMockTransaction({
          date: new Date('2024-01-15'),
          amount: { toNumber: () => -100 } as Prisma.Decimal,
          categoryId: 'cat-1',
          category: { id: 'cat-1', name: 'Food', icon: '🍔', color: '#FF5722' },
        }),
        createMockTransaction({
          id: 'txn-2',
          date: new Date('2024-01-20'),
          amount: { toNumber: () => -50 } as Prisma.Decimal,
          categoryId: 'cat-1',
          category: { id: 'cat-1', name: 'Food', icon: '🍔', color: '#FF5722' },
        }),
        createMockTransaction({
          id: 'txn-3',
          date: new Date('2024-01-10'),
          amount: { toNumber: () => -200 } as Prisma.Decimal,
          categoryId: 'cat-2',
          category: { id: 'cat-2', name: 'Transport', icon: '🚗', color: '#2196F3' },
        }),
      ];

      vi.mocked(prisma.transaction.findMany).mockResolvedValue(transactions as any);

      const result = await forecastService.getHistoricalData('workspace-123', 12);

      expect(result).toHaveLength(2);
      expect(result.find(c => c.categoryId === 'cat-1')).toBeDefined();
      expect(result.find(c => c.categoryId === 'cat-2')).toBeDefined();
    });

    it('should aggregate amounts by month within category', async () => {
      const transactions = [
        createMockTransaction({
          date: new Date('2024-01-05'),
          amount: { toNumber: () => -100 } as Prisma.Decimal,
        }),
        createMockTransaction({
          id: 'txn-2',
          date: new Date('2024-01-25'),
          amount: { toNumber: () => -50 } as Prisma.Decimal,
        }),
      ];

      vi.mocked(prisma.transaction.findMany).mockResolvedValue(transactions as any);

      const result = await forecastService.getHistoricalData('workspace-123', 12);

      expect(result).toHaveLength(1);
      // Both transactions should be aggregated into January
      expect(result[0].data[0].amount).toBe(150);
    });

    it('should skip transactions without category', async () => {
      const transactions = [
        createMockTransaction({
          categoryId: null,
          category: null,
        }),
        createMockTransaction({
          id: 'txn-2',
          categoryId: 'cat-1',
          category: { id: 'cat-1', name: 'Food', icon: '🍔', color: '#FF5722' },
        }),
      ];

      vi.mocked(prisma.transaction.findMany).mockResolvedValue(transactions as any);

      const result = await forecastService.getHistoricalData('workspace-123', 12);

      expect(result).toHaveLength(1);
    });

    it('should only include expense transactions', async () => {
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);

      await forecastService.getHistoricalData('workspace-123', 12);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          amount: { lt: 0 },
          transferPairId: null,
        }),
        select: expect.any(Object),
        orderBy: { date: 'asc' },
      });
    });

    it('should return empty array for workspace without transactions', async () => {
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);

      const result = await forecastService.getHistoricalData('workspace-123', 12);

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // CALCULATE TREND
  // ============================================================================

  describe('calculateTrend', () => {
    it('should calculate linear regression slope and intercept', () => {
      const data = [100, 110, 120, 130, 140]; // Clear upward trend

      const result = forecastService.calculateTrend(data);

      expect(result.slope).toBe(10); // Increase of 10 per period
      expect(result.intercept).toBe(100);
      expect(result.r2).toBeCloseTo(1, 2); // Perfect fit
    });

    it('should return zero slope for constant data', () => {
      const data = [100, 100, 100, 100];

      const result = forecastService.calculateTrend(data);

      expect(result.slope).toBe(0);
      expect(result.intercept).toBe(100);
    });

    it('should handle single data point', () => {
      const data = [100];

      const result = forecastService.calculateTrend(data);

      expect(result.slope).toBe(0);
      expect(result.intercept).toBe(100);
      expect(result.r2).toBe(0);
    });

    it('should handle empty data', () => {
      const data: number[] = [];

      const result = forecastService.calculateTrend(data);

      expect(result.slope).toBe(0);
      expect(result.intercept).toBe(0);
    });

    it('should calculate negative slope for decreasing trend', () => {
      const data = [200, 180, 160, 140, 120];

      const result = forecastService.calculateTrend(data);

      expect(result.slope).toBe(-20);
      expect(result.r2).toBeCloseTo(1, 2);
    });
  });

  // ============================================================================
  // CALCULATE SEASONAL FACTOR
  // ============================================================================

  describe('calculateSeasonalFactor', () => {
    it('should return 1 for insufficient data (less than 12 months)', () => {
      const monthlyData = [
        { month: new Date('2024-01-01'), amount: 100 },
        { month: new Date('2024-02-01'), amount: 150 },
        { month: new Date('2024-03-01'), amount: 120 },
      ];

      const result = forecastService.calculateSeasonalFactor(monthlyData, 0);

      expect(result).toBe(1);
    });

    it('should calculate seasonal factor for month with higher spending', () => {
      // Create 12+ months of data with December being higher
      const monthlyData = [];
      for (let i = 0; i < 24; i++) {
        const date = new Date(2023, i % 12, 1);
        // December (month 11) has double spending
        const amount = date.getMonth() === 11 ? 200 : 100;
        monthlyData.push({ month: date, amount });
      }

      const result = forecastService.calculateSeasonalFactor(monthlyData, 11); // December

      expect(result).toBeGreaterThan(1); // December should have factor > 1
    });

    it('should return 1 for uniform spending across months', () => {
      const monthlyData = [];
      for (let i = 0; i < 24; i++) {
        monthlyData.push({ month: new Date(2023, i % 12, 1), amount: 100 });
      }

      const result = forecastService.calculateSeasonalFactor(monthlyData, 5);

      expect(result).toBeCloseTo(1, 1);
    });
  });

  // ============================================================================
  // GENERATE FORECAST
  // ============================================================================

  describe('generateForecast', () => {
    it('should generate forecasts for categories with sufficient data', async () => {
      // Create 6 months of historical data
      const transactions = [];
      for (let month = 0; month < 6; month++) {
        transactions.push(
          createMockTransaction({
            id: `txn-${month}`,
            date: new Date(2023, 6 + month, 15),
            amount: { toNumber: () => -(100 + month * 10) } as Prisma.Decimal,
          })
        );
      }

      vi.mocked(prisma.transaction.findMany).mockResolvedValue(transactions as any);
      vi.mocked(prisma.budgetForecast.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.budgetForecast.createMany).mockResolvedValue({ count: 6 });

      const result = await forecastService.generateForecast('workspace-123', 3);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('categoryId');
      expect(result[0]).toHaveProperty('month');
      expect(result[0]).toHaveProperty('predictedAmount');
      expect(result[0]).toHaveProperty('confidence');
      expect(result[0]).toHaveProperty('method');
    });

    it('should skip categories with less than 3 data points', async () => {
      const transactions = [
        createMockTransaction({ date: new Date('2024-01-15') }),
        createMockTransaction({ id: 'txn-2', date: new Date('2024-02-15') }),
      ];

      vi.mocked(prisma.transaction.findMany).mockResolvedValue(transactions as any);
      vi.mocked(prisma.budgetForecast.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.budgetForecast.createMany).mockResolvedValue({ count: 0 });

      const result = await forecastService.generateForecast('workspace-123', 3);

      // Should only have total workspace forecasts if any, or be empty
      const categoryForecasts = result.filter(f => f.categoryId !== null);
      expect(categoryForecasts).toHaveLength(0);
    });

    it('should return empty array for workspace without data', async () => {
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);

      const result = await forecastService.generateForecast('workspace-123', 3);

      expect(result).toEqual([]);
    });

    it('should include total workspace forecast', async () => {
      const transactions = [];
      for (let month = 0; month < 6; month++) {
        transactions.push(
          createMockTransaction({
            id: `txn-${month}`,
            date: new Date(2023, 6 + month, 15),
            amount: { toNumber: () => -100 } as Prisma.Decimal,
          })
        );
      }

      vi.mocked(prisma.transaction.findMany).mockResolvedValue(transactions as any);
      vi.mocked(prisma.budgetForecast.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.budgetForecast.createMany).mockResolvedValue({ count: 6 });

      const result = await forecastService.generateForecast('workspace-123', 3);

      const totalForecasts = result.filter(f => f.categoryId === null);
      expect(totalForecasts.length).toBeGreaterThan(0);
    });

    it('should ensure predictions are non-negative', async () => {
      // Create decreasing trend that would predict negative values
      const transactions = [];
      for (let month = 0; month < 6; month++) {
        transactions.push(
          createMockTransaction({
            id: `txn-${month}`,
            date: new Date(2023, 6 + month, 15),
            amount: { toNumber: () => -(100 - month * 20) } as Prisma.Decimal,
          })
        );
      }

      vi.mocked(prisma.transaction.findMany).mockResolvedValue(transactions as any);
      vi.mocked(prisma.budgetForecast.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.budgetForecast.createMany).mockResolvedValue({ count: 6 });

      const result = await forecastService.generateForecast('workspace-123', 6);

      result.forEach(forecast => {
        expect(forecast.predictedAmount).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // ============================================================================
  // SAVE FORECAST
  // ============================================================================

  describe('saveForecast', () => {
    it('should delete old forecasts and insert new ones', async () => {
      const forecasts = [
        {
          categoryId: 'cat-1',
          categoryName: 'Food',
          month: new Date('2024-03-01'),
          predictedAmount: 500,
          confidence: 0.8,
          method: 'trend' as const,
        },
      ];

      vi.mocked(prisma.budgetForecast.deleteMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.budgetForecast.createMany).mockResolvedValue({ count: 1 });

      await forecastService.saveForecast('workspace-123', forecasts);

      expect(prisma.budgetForecast.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          workspaceId: 'workspace-123',
          month: { gte: expect.any(Date) },
        }),
      });

      expect(prisma.budgetForecast.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            workspaceId: 'workspace-123',
            categoryId: 'cat-1',
          }),
        ]),
        skipDuplicates: true,
      });
    });

    it('should handle empty forecasts array', async () => {
      vi.mocked(prisma.budgetForecast.deleteMany).mockResolvedValue({ count: 0 });

      await forecastService.saveForecast('workspace-123', []);

      expect(prisma.budgetForecast.deleteMany).toHaveBeenCalled();
      expect(prisma.budgetForecast.createMany).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // GET FORECAST
  // ============================================================================

  describe('getForecast', () => {
    it('should return existing forecasts with category info', async () => {
      const mockForecasts = [
        {
          ...createMockForecast(),
          category: { id: 'cat-1', name: 'Food', icon: '🍔', color: '#FF5722' },
        },
      ];

      vi.mocked(prisma.budgetForecast.findMany).mockResolvedValue(mockForecasts as any);

      const result = await forecastService.getForecast('workspace-123');

      expect(result).toHaveLength(1);
      expect(result[0].category).toBeDefined();
    });

    it('should filter by date range', async () => {
      vi.mocked(prisma.budgetForecast.findMany).mockResolvedValue([]);

      const startMonth = new Date('2024-02-01');
      const endMonth = new Date('2024-04-01');

      await forecastService.getForecast('workspace-123', startMonth, endMonth);

      expect(prisma.budgetForecast.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          month: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        }),
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });

    it('should order by month and category', async () => {
      vi.mocked(prisma.budgetForecast.findMany).mockResolvedValue([]);

      await forecastService.getForecast('workspace-123');

      expect(prisma.budgetForecast.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-123' },
        include: expect.any(Object),
        orderBy: [{ month: 'asc' }, { categoryId: 'asc' }],
      });
    });
  });

  // ============================================================================
  // UPDATE ACTUAL AMOUNTS
  // ============================================================================

  describe('updateActualAmounts', () => {
    it('should update past forecasts with actual spending', async () => {
      const pastForecasts = [
        createMockForecast({
          month: new Date('2024-01-01'),
          actualAmount: null,
          categoryId: 'cat-1',
        }),
      ];

      vi.mocked(prisma.budgetForecast.findMany).mockResolvedValue(pastForecasts as any);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => -450 } as Prisma.Decimal },
      } as any);
      vi.mocked(prisma.budgetForecast.update).mockResolvedValue({} as any);

      await forecastService.updateActualAmounts('workspace-123');

      expect(prisma.budgetForecast.update).toHaveBeenCalledWith({
        where: { id: 'forecast-123' },
        data: { actualAmount: expect.any(Decimal) },
      });
    });

    it('should calculate total spending for forecasts without category', async () => {
      const pastForecasts = [
        createMockForecast({
          month: new Date('2024-01-01'),
          actualAmount: null,
          categoryId: null,
        }),
      ];

      vi.mocked(prisma.budgetForecast.findMany).mockResolvedValue(pastForecasts as any);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => -1500 } as Prisma.Decimal },
      } as any);
      vi.mocked(prisma.budgetForecast.update).mockResolvedValue({} as any);

      await forecastService.updateActualAmounts('workspace-123');

      expect(prisma.transaction.aggregate).toHaveBeenCalledWith({
        where: expect.objectContaining({
          workspaceId: 'workspace-123',
          // No categoryId filter for total
        }),
        _sum: { amount: true },
      });
    });

    it('should handle forecasts with no actual spending', async () => {
      const pastForecasts = [createMockForecast({ actualAmount: null })];

      vi.mocked(prisma.budgetForecast.findMany).mockResolvedValue(pastForecasts as any);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: null },
      } as any);
      vi.mocked(prisma.budgetForecast.update).mockResolvedValue({} as any);

      await forecastService.updateActualAmounts('workspace-123');

      expect(prisma.budgetForecast.update).toHaveBeenCalledWith({
        where: { id: 'forecast-123' },
        data: { actualAmount: new Decimal(0) },
      });
    });
  });

  // ============================================================================
  // GET ACCURACY
  // ============================================================================

  describe('getAccuracy', () => {
    it('should calculate accuracy metrics for forecasts', async () => {
      const forecastsWithActual = [
        {
          ...createMockForecast({
            categoryId: 'cat-1',
            predictedAmount: new Decimal(500),
            actualAmount: new Decimal(480),
            method: 'trend',
          }),
          category: { id: 'cat-1', name: 'Food' },
        },
        {
          ...createMockForecast({
            id: 'forecast-2',
            categoryId: 'cat-2',
            predictedAmount: new Decimal(300),
            actualAmount: new Decimal(350),
            method: 'average',
          }),
          category: { id: 'cat-2', name: 'Transport' },
        },
      ];

      // First call from updateActualAmounts (returns no forecasts needing update)
      // Second call from getAccuracy itself
      vi.mocked(prisma.budgetForecast.findMany)
        .mockResolvedValueOnce([]) // updateActualAmounts finds no past forecasts without actual
        .mockResolvedValueOnce(forecastsWithActual as any); // getAccuracy gets forecasts with actual

      const result = await forecastService.getAccuracy('workspace-123');

      expect(result.overall).toHaveProperty('mape');
      expect(result.overall).toHaveProperty('rmse');
      expect(result.overall).toHaveProperty('accuracy');
      expect(result.byCategory).toHaveLength(2);
      expect(result.byMethod).toHaveLength(2);
    });

    it('should return 100% accuracy for no forecasts', async () => {
      vi.mocked(prisma.budgetForecast.findMany)
        .mockResolvedValueOnce([]) // updateActualAmounts
        .mockResolvedValueOnce([]); // getAccuracy

      const result = await forecastService.getAccuracy('workspace-123');

      expect(result.overall.accuracy).toBe(100);
      expect(result.overall.mape).toBe(0);
      expect(result.overall.rmse).toBe(0);
    });

    it('should skip forecasts where both predicted and actual are zero', async () => {
      const forecastsWithActual = [
        {
          ...createMockForecast({
            predictedAmount: new Decimal(0),
            actualAmount: new Decimal(0),
          }),
          category: null,
        },
      ];

      vi.mocked(prisma.budgetForecast.findMany)
        .mockResolvedValueOnce([]) // updateActualAmounts
        .mockResolvedValueOnce(forecastsWithActual as any); // getAccuracy

      const result = await forecastService.getAccuracy('workspace-123');

      // Should not count this in calculations
      expect(result.overall.accuracy).toBe(100);
    });

    it('should group accuracy by prediction method', async () => {
      const forecastsWithActual = [
        {
          ...createMockForecast({
            categoryId: 'cat-1',
            predictedAmount: new Decimal(500),
            actualAmount: new Decimal(490),
            method: 'trend',
          }),
          category: { id: 'cat-1', name: 'Food' },
        },
        {
          ...createMockForecast({
            id: 'forecast-2',
            categoryId: 'cat-2',
            predictedAmount: new Decimal(300),
            actualAmount: new Decimal(310),
            method: 'trend',
          }),
          category: { id: 'cat-2', name: 'Transport' },
        },
        {
          ...createMockForecast({
            id: 'forecast-3',
            categoryId: 'cat-3',
            predictedAmount: new Decimal(200),
            actualAmount: new Decimal(250),
            method: 'average',
          }),
          category: { id: 'cat-3', name: 'Entertainment' },
        },
      ];

      vi.mocked(prisma.budgetForecast.findMany)
        .mockResolvedValueOnce([]) // updateActualAmounts
        .mockResolvedValueOnce(forecastsWithActual as any); // getAccuracy

      const result = await forecastService.getAccuracy('workspace-123');

      expect(result.byMethod).toHaveLength(2);
      const trendMethod = result.byMethod.find(m => m.method === 'trend');
      const avgMethod = result.byMethod.find(m => m.method === 'average');
      expect(trendMethod?.sampleSize).toBe(2);
      expect(avgMethod?.sampleSize).toBe(1);
    });
  });
});
