// ============================================================================
// FORECAST SERVICE - Finance Hub
// ML-based budget forecasting with trend analysis and seasonal adjustments
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { BudgetForecast } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface HistoricalDataPoint {
  month: Date;
  categoryId: string | null;
  categoryName: string | null;
  amount: number;
}

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  data: { month: Date; amount: number }[];
}

export interface ForecastResult {
  categoryId: string | null;
  categoryName: string | null;
  month: Date;
  predictedAmount: number;
  confidence: number;
  method: 'average' | 'trend' | 'seasonal';
}

export interface ForecastWithCategory extends BudgetForecast {
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
}

export interface AccuracyMetrics {
  overall: {
    mape: number; // Mean Absolute Percentage Error
    rmse: number; // Root Mean Square Error
    accuracy: number; // 1 - MAPE (as percentage)
  };
  byCategory: {
    categoryId: string;
    categoryName: string;
    mape: number;
    accuracy: number;
    sampleSize: number;
  }[];
  byMethod: {
    method: string;
    mape: number;
    accuracy: number;
    sampleSize: number;
  }[];
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Get the first day of a month
 */
function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Add months to a date
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Calculate simple linear regression
 * Returns slope and intercept for y = slope * x + intercept
 */
function linearRegression(data: number[]): { slope: number; intercept: number; r2: number } {
  const n = data.length;
  if (n < 2) {
    return { slope: 0, intercept: data[0] ?? 0, r2: 0 };
  }

  // x values are just indices (0, 1, 2, ...)
  const sumX = (n * (n - 1)) / 2;
  const sumY = data.reduce((sum, y) => sum + y, 0);
  const sumXY = data.reduce((sum, y, x) => sum + x * y, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const meanY = sumY / n;
  const ssTotal = data.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
  const ssResidual = data.reduce((sum, y, x) => {
    const predicted = slope * x + intercept;
    return sum + Math.pow(y - predicted, 2);
  }, 0);
  const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

  return {
    slope: isNaN(slope) ? 0 : slope,
    intercept: isNaN(intercept) ? (data[0] ?? 0) : intercept,
    r2: isNaN(r2) ? 0 : Math.max(0, r2),
  };
}

/**
 * Calculate seasonal factor for a given month
 * Uses historical data to find patterns in spending by month
 */
function calculateSeasonalFactor(
  monthlyData: { month: Date; amount: number }[],
  targetMonth: number
): number {
  if (monthlyData.length < 12) {
    return 1; // Not enough data for seasonal analysis
  }

  // Group data by month
  const monthlyAverages: number[] = new Array(12).fill(0);
  const monthlyCounts: number[] = new Array(12).fill(0);

  for (const point of monthlyData) {
    const month = point.month.getMonth();
    const avgValue = monthlyAverages[month];
    const countValue = monthlyCounts[month];
    if (avgValue !== undefined && countValue !== undefined) {
      monthlyAverages[month] = avgValue + point.amount;
      monthlyCounts[month] = countValue + 1;
    }
  }

  // Calculate averages
  for (let i = 0; i < 12; i++) {
    const countValue = monthlyCounts[i];
    const avgValue = monthlyAverages[i];
    if (countValue !== undefined && countValue > 0 && avgValue !== undefined) {
      monthlyAverages[i] = avgValue / countValue;
    }
  }

  // Calculate overall average
  const nonZeroAverages = monthlyAverages.filter((v) => v > 0);
  const totalAvg = nonZeroAverages.length > 0
    ? nonZeroAverages.reduce((a, b) => a + b, 0) / nonZeroAverages.length
    : 0;

  const targetMonthAvg = monthlyAverages[targetMonth];
  if (totalAvg === 0 || targetMonthAvg === undefined || targetMonthAvg === 0) {
    return 1;
  }

  // Seasonal factor is the ratio of the month's average to the overall average
  return targetMonthAvg / totalAvg;
}

/**
 * Calculate prediction confidence based on data quality
 */
function calculateConfidence(
  dataPoints: number,
  r2: number,
  variability: number
): number {
  // Base confidence on data points (more data = higher confidence)
  let confidence = Math.min(1, dataPoints / 12) * 0.4;

  // Add R-squared contribution (better fit = higher confidence)
  confidence += r2 * 0.3;

  // Subtract for high variability
  const variabilityPenalty = Math.min(0.3, variability * 0.1);
  confidence -= variabilityPenalty;

  return Math.max(0.1, Math.min(0.95, confidence));
}

// ----------------------------------------------------------------------------
// Forecast Service
// ----------------------------------------------------------------------------

export const forecastService = {
  /**
   * Get historical spending data by category
   */
  async getHistoricalData(
    workspaceId: string,
    months: number = 12
  ): Promise<CategorySpending[]> {
    const startDate = addMonths(getMonthStart(new Date()), -months);

    // Get all expense transactions grouped by month and category
    const transactions = await prisma.transaction.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        date: { gte: startDate },
        amount: { lt: 0 }, // Only expenses
        transferPairId: null, // Exclude transfers
      },
      select: {
        date: true,
        amount: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Group by category and month
    const categoryMap = new Map<string, CategorySpending>();

    for (const tx of transactions) {
      if (!tx.categoryId || !tx.category) continue;

      const monthStart = getMonthStart(tx.date);
      const key = tx.categoryId;

      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          categoryId: tx.categoryId,
          categoryName: tx.category.name,
          categoryIcon: tx.category.icon,
          categoryColor: tx.category.color,
          data: [],
        });
      }

      const categoryData = categoryMap.get(key)!;
      const existingMonth = categoryData.data.find(
        (d) => d.month.getTime() === monthStart.getTime()
      );

      if (existingMonth) {
        existingMonth.amount += Math.abs(tx.amount.toNumber());
      } else {
        categoryData.data.push({
          month: monthStart,
          amount: Math.abs(tx.amount.toNumber()),
        });
      }
    }

    // Sort data by month within each category
    for (const category of categoryMap.values()) {
      category.data.sort((a, b) => a.month.getTime() - b.month.getTime());
    }

    return Array.from(categoryMap.values());
  },

  /**
   * Calculate trend for a category
   */
  calculateTrend(data: number[]): { slope: number; intercept: number; r2: number } {
    return linearRegression(data);
  },

  /**
   * Calculate seasonal factor for a month
   */
  calculateSeasonalFactor(
    monthlyData: { month: Date; amount: number }[],
    targetMonth: number
  ): number {
    return calculateSeasonalFactor(monthlyData, targetMonth);
  },

  /**
   * Generate forecasts for the next N months
   */
  async generateForecast(
    workspaceId: string,
    forecastMonths: number = 6
  ): Promise<ForecastResult[]> {
    // Get 24 months of historical data for better predictions
    const historicalData = await this.getHistoricalData(workspaceId, 24);

    if (historicalData.length === 0) {
      return [];
    }

    const forecasts: ForecastResult[] = [];
    const now = new Date();
    const currentMonthStart = getMonthStart(now);

    for (const category of historicalData) {
      if (category.data.length < 3) {
        // Not enough data for this category, skip
        continue;
      }

      const amounts = category.data.map((d) => d.amount);
      const trend = this.calculateTrend(amounts);

      // Calculate variability (coefficient of variation)
      const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length;
      const stdDev = Math.sqrt(variance);
      const variability = mean > 0 ? stdDev / mean : 0;

      // Generate forecast for each future month
      for (let i = 1; i <= forecastMonths; i++) {
        const targetMonth = addMonths(currentMonthStart, i);
        const targetMonthIndex = targetMonth.getMonth();

        // Calculate base prediction using trend
        const trendPrediction = trend.slope * (amounts.length + i - 1) + trend.intercept;

        // Apply seasonal adjustment if we have enough data
        const seasonalFactor = category.data.length >= 12
          ? this.calculateSeasonalFactor(category.data, targetMonthIndex)
          : 1;

        // Determine prediction method based on data quality
        let method: 'average' | 'trend' | 'seasonal';
        let predictedAmount: number;

        if (category.data.length >= 12 && Math.abs(seasonalFactor - 1) > 0.1) {
          // Use seasonal method if we have enough data and there's a pattern
          method = 'seasonal';
          predictedAmount = trendPrediction * seasonalFactor;
        } else if (trend.r2 > 0.3 && amounts.length >= 6) {
          // Use trend if we have a good fit
          method = 'trend';
          predictedAmount = trendPrediction;
        } else {
          // Fall back to average
          method = 'average';
          predictedAmount = mean;
        }

        // Ensure prediction is non-negative
        predictedAmount = Math.max(0, predictedAmount);

        // Calculate confidence
        const confidence = calculateConfidence(amounts.length, trend.r2, variability);

        forecasts.push({
          categoryId: category.categoryId,
          categoryName: category.categoryName,
          month: targetMonth,
          predictedAmount: Math.round(predictedAmount * 100) / 100,
          confidence: Math.round(confidence * 100) / 100,
          method,
        });
      }
    }

    // Also generate total workspace forecast
    const totalByMonth = new Map<number, number>();
    for (const category of historicalData) {
      for (const point of category.data) {
        const key = point.month.getTime();
        totalByMonth.set(key, (totalByMonth.get(key) ?? 0) + point.amount);
      }
    }

    const sortedTotals = Array.from(totalByMonth.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([_, amount]) => amount);

    if (sortedTotals.length >= 3) {
      const totalTrend = this.calculateTrend(sortedTotals);
      const totalMean = sortedTotals.reduce((a, b) => a + b, 0) / sortedTotals.length;
      const totalVariance = sortedTotals.reduce((a, b) => a + Math.pow(b - totalMean, 2), 0) / sortedTotals.length;
      const totalStdDev = Math.sqrt(totalVariance);
      const totalVariability = totalMean > 0 ? totalStdDev / totalMean : 0;

      for (let i = 1; i <= forecastMonths; i++) {
        const targetMonth = addMonths(currentMonthStart, i);
        const trendPrediction = totalTrend.slope * (sortedTotals.length + i - 1) + totalTrend.intercept;

        const method: 'average' | 'trend' | 'seasonal' = totalTrend.r2 > 0.3 ? 'trend' : 'average';
        const predictedAmount = method === 'trend' ? trendPrediction : totalMean;
        const confidence = calculateConfidence(sortedTotals.length, totalTrend.r2, totalVariability);

        forecasts.push({
          categoryId: null,
          categoryName: null,
          month: targetMonth,
          predictedAmount: Math.max(0, Math.round(predictedAmount * 100) / 100),
          confidence: Math.round(confidence * 100) / 100,
          method,
        });
      }
    }

    // Save forecasts to database
    await this.saveForecast(workspaceId, forecasts);

    return forecasts;
  },

  /**
   * Save forecast results to database
   */
  async saveForecast(workspaceId: string, forecasts: ForecastResult[]): Promise<void> {
    // Delete existing forecasts for future months
    const now = new Date();
    const currentMonthStart = getMonthStart(now);

    await prisma.budgetForecast.deleteMany({
      where: {
        workspaceId,
        month: { gte: currentMonthStart },
      },
    });

    // Insert new forecasts
    if (forecasts.length > 0) {
      await prisma.budgetForecast.createMany({
        data: forecasts.map((f) => ({
          workspaceId,
          categoryId: f.categoryId,
          month: f.month,
          predictedAmount: new Decimal(f.predictedAmount),
          confidence: new Decimal(f.confidence),
          method: f.method,
        })),
        skipDuplicates: true,
      });
    }
  },

  /**
   * Get existing forecasts
   */
  async getForecast(
    workspaceId: string,
    startMonth?: Date,
    endMonth?: Date
  ): Promise<ForecastWithCategory[]> {
    const where: Record<string, unknown> = { workspaceId };

    if (startMonth || endMonth) {
      where.month = {};
      if (startMonth) {
        (where.month as Record<string, Date>).gte = getMonthStart(startMonth);
      }
      if (endMonth) {
        (where.month as Record<string, Date>).lte = getMonthStart(endMonth);
      }
    }

    return prisma.budgetForecast.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
      },
      orderBy: [{ month: 'asc' }, { categoryId: 'asc' }],
    });
  },

  /**
   * Update forecast with actual amounts (for accuracy tracking)
   */
  async updateActualAmounts(workspaceId: string): Promise<void> {
    const now = new Date();
    const currentMonthStart = getMonthStart(now);

    // Get all past forecasts without actual amounts
    const forecasts = await prisma.budgetForecast.findMany({
      where: {
        workspaceId,
        month: { lt: currentMonthStart },
        actualAmount: null,
      },
    });

    for (const forecast of forecasts) {
      const monthStart = forecast.month;
      const monthEnd = addMonths(monthStart, 1);

      // Calculate actual spending
      let actualAmount: number;

      if (forecast.categoryId) {
        // Get actual spending for this category
        const result = await prisma.transaction.aggregate({
          where: {
            workspaceId,
            categoryId: forecast.categoryId,
            deletedAt: null,
            date: { gte: monthStart, lt: monthEnd },
            amount: { lt: 0 },
            transferPairId: null,
          },
          _sum: { amount: true },
        });
        actualAmount = Math.abs(result._sum.amount?.toNumber() ?? 0);
      } else {
        // Get total spending
        const result = await prisma.transaction.aggregate({
          where: {
            workspaceId,
            deletedAt: null,
            date: { gte: monthStart, lt: monthEnd },
            amount: { lt: 0 },
            transferPairId: null,
          },
          _sum: { amount: true },
        });
        actualAmount = Math.abs(result._sum.amount?.toNumber() ?? 0);
      }

      await prisma.budgetForecast.update({
        where: { id: forecast.id },
        data: { actualAmount: new Decimal(actualAmount) },
      });
    }
  },

  /**
   * Calculate forecast accuracy metrics
   */
  async getAccuracy(workspaceId: string): Promise<AccuracyMetrics> {
    // First, update actual amounts for past forecasts
    await this.updateActualAmounts(workspaceId);

    // Get forecasts with actual amounts
    const forecasts = await prisma.budgetForecast.findMany({
      where: {
        workspaceId,
        actualAmount: { not: null },
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    if (forecasts.length === 0) {
      return {
        overall: { mape: 0, rmse: 0, accuracy: 100 },
        byCategory: [],
        byMethod: [],
      };
    }

    // Calculate overall metrics
    let totalAPE = 0;
    let totalSE = 0;
    let count = 0;

    const categoryMetrics = new Map<string, { ape: number; count: number; name: string }>();
    const methodMetrics = new Map<string, { ape: number; count: number }>();

    for (const forecast of forecasts) {
      const predicted = forecast.predictedAmount.toNumber();
      const actual = forecast.actualAmount!.toNumber();

      if (actual === 0 && predicted === 0) continue;

      const absoluteError = Math.abs(predicted - actual);
      const percentageError = actual > 0 ? (absoluteError / actual) * 100 : 0;
      const squaredError = Math.pow(predicted - actual, 2);

      totalAPE += percentageError;
      totalSE += squaredError;
      count++;

      // Category metrics
      if (forecast.categoryId && forecast.category) {
        const key = forecast.categoryId;
        const existing = categoryMetrics.get(key) ?? { ape: 0, count: 0, name: forecast.category.name };
        categoryMetrics.set(key, {
          ape: existing.ape + percentageError,
          count: existing.count + 1,
          name: forecast.category.name,
        });
      }

      // Method metrics
      const methodKey = forecast.method;
      const existingMethod = methodMetrics.get(methodKey) ?? { ape: 0, count: 0 };
      methodMetrics.set(methodKey, {
        ape: existingMethod.ape + percentageError,
        count: existingMethod.count + 1,
      });
    }

    const mape = count > 0 ? totalAPE / count : 0;
    const rmse = count > 0 ? Math.sqrt(totalSE / count) : 0;

    return {
      overall: {
        mape: Math.round(mape * 100) / 100,
        rmse: Math.round(rmse * 100) / 100,
        accuracy: Math.round((100 - Math.min(100, mape)) * 100) / 100,
      },
      byCategory: Array.from(categoryMetrics.entries()).map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        mape: Math.round((data.ape / data.count) * 100) / 100,
        accuracy: Math.round((100 - Math.min(100, data.ape / data.count)) * 100) / 100,
        sampleSize: data.count,
      })),
      byMethod: Array.from(methodMetrics.entries()).map(([method, data]) => ({
        method,
        mape: Math.round((data.ape / data.count) * 100) / 100,
        accuracy: Math.round((100 - Math.min(100, data.ape / data.count)) * 100) / 100,
        sampleSize: data.count,
      })),
    };
  },
};

export default forecastService;
