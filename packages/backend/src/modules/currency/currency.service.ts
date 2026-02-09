// ============================================================================
// CURRENCY SERVICE - Finance Hub
// Multi-currency support with exchange rates
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { Prisma } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface ConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  rate: number;
  date: Date;
  source: string;
}

export interface ExchangeRateData {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  date: Date;
  source?: string;
}

// FRED (Federal Reserve) series IDs for USD-based exchange rates
// Format: { currency: seriesId, direction: 'to_usd' | 'from_usd' }
const FRED_SERIES: Record<string, { seriesId: string; direction: 'to_usd' | 'from_usd' }> = {
  EUR: { seriesId: 'DEXUSEU', direction: 'from_usd' }, // USD per EUR
  GBP: { seriesId: 'DEXUSUK', direction: 'from_usd' }, // USD per GBP
  CHF: { seriesId: 'DEXSZUS', direction: 'to_usd' },   // CHF per USD
  JPY: { seriesId: 'DEXJPUS', direction: 'to_usd' },   // JPY per USD
  CAD: { seriesId: 'DEXCAUS', direction: 'to_usd' },   // CAD per USD
  AUD: { seriesId: 'DEXUSAL', direction: 'from_usd' }, // USD per AUD
  NZD: { seriesId: 'DEXUSNZ', direction: 'from_usd' }, // USD per NZD
  CNY: { seriesId: 'DEXCHUS', direction: 'to_usd' },   // CNY per USD
  KRW: { seriesId: 'DEXKOUS', direction: 'to_usd' },   // KRW per USD
  INR: { seriesId: 'DEXINUS', direction: 'to_usd' },   // INR per USD
  BRL: { seriesId: 'DEXBZUS', direction: 'to_usd' },   // BRL per USD
  MXN: { seriesId: 'DEXMXUS', direction: 'to_usd' },   // MXN per USD
  THB: { seriesId: 'DEXTHUS', direction: 'to_usd' },   // THB per USD
  MYR: { seriesId: 'DEXMAUS', direction: 'to_usd' },   // MYR per USD
  ZAR: { seriesId: 'DEXSFUS', direction: 'to_usd' },   // ZAR per USD
  SGD: { seriesId: 'DEXSIUS', direction: 'to_usd' },   // SGD per USD
  HKD: { seriesId: 'DEXHKUS', direction: 'to_usd' },   // HKD per USD
  SEK: { seriesId: 'DEXSDUS', direction: 'to_usd' },   // SEK per USD
  NOK: { seriesId: 'DEXNOUS', direction: 'to_usd' },   // NOK per USD
  DKK: { seriesId: 'DEXDNUS', direction: 'to_usd' },   // DKK per USD
  TWD: { seriesId: 'DEXTAUS', direction: 'to_usd' },   // TWD per USD
};

// Common currencies with their metadata
const COMMON_CURRENCIES = [
  { code: 'EUR', name: 'Euro', symbol: '\u20AC', decimals: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '\u00A3', decimals: 2 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', decimals: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '\u00A5', decimals: 0 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '\u00A5', decimals: 2 },
  { code: 'INR', name: 'Indian Rupee', symbol: '\u20B9', decimals: 2 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2 },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', decimals: 2 },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'z\u0142', decimals: 2 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimals: 2 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', decimals: 2 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', decimals: 2 },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'K\u010D', decimals: 2 },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', decimals: 0 },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei', decimals: 2 },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв', decimals: 2 },
  { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn', decimals: 2 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '\u20BA', decimals: 2 },
  { code: 'RUB', name: 'Russian Ruble', symbol: '\u20BD', decimals: 2 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2 },
  { code: 'KRW', name: 'South Korean Won', symbol: '\u20A9', decimals: 0 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2 },
  { code: 'THB', name: 'Thai Baht', symbol: '\u0E3F', decimals: 2 },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', decimals: 0 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2 },
];

// ----------------------------------------------------------------------------
// Currency Service
// ----------------------------------------------------------------------------

export const currencyService = {
  /**
   * Get all available currencies
   */
  async listCurrencies(activeOnly = true) {
    const currencies = await prisma.currency.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { code: 'asc' },
    });

    return currencies;
  },

  /**
   * Get currency by code
   */
  async getCurrency(code: string) {
    return prisma.currency.findUnique({
      where: { code: code.toUpperCase() },
    });
  },

  /**
   * Initialize default currencies
   */
  async initializeCurrencies() {
    const existingCount = await prisma.currency.count();
    if (existingCount > 0) {
      return { created: 0, message: 'Currencies already initialized' };
    }

    await prisma.currency.createMany({
      data: COMMON_CURRENCIES,
      skipDuplicates: true,
    });

    return { created: COMMON_CURRENCIES.length, message: 'Currencies initialized' };
  },

  /**
   * Get exchange rate for a specific date
   */
  async getRate(
    baseCurrency: string,
    targetCurrency: string,
    date: Date = new Date()
  ): Promise<{ rate: number; source: string; date: Date } | null> {
    const base = baseCurrency.toUpperCase();
    const target = targetCurrency.toUpperCase();

    // Same currency
    if (base === target) {
      return { rate: 1, source: 'identity', date };
    }

    // Normalize date to start of day
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    // Try to find exact date rate
    let exchangeRate = await prisma.exchangeRate.findUnique({
      where: {
        baseCurrency_targetCurrency_date: {
          baseCurrency: base,
          targetCurrency: target,
          date: normalizedDate,
        },
      },
    });

    // If not found, try reverse rate
    if (!exchangeRate) {
      const reverseRate = await prisma.exchangeRate.findUnique({
        where: {
          baseCurrency_targetCurrency_date: {
            baseCurrency: target,
            targetCurrency: base,
            date: normalizedDate,
          },
        },
      });

      if (reverseRate) {
        return {
          rate: 1 / Number(reverseRate.rate),
          source: `${reverseRate.source} (inverse)`,
          date: reverseRate.date,
        };
      }
    }

    // If still not found, get the most recent rate
    if (!exchangeRate) {
      exchangeRate = await prisma.exchangeRate.findFirst({
        where: {
          baseCurrency: base,
          targetCurrency: target,
          date: { lte: normalizedDate },
        },
        orderBy: { date: 'desc' },
      });
    }

    // Try reverse for most recent
    if (!exchangeRate) {
      const reverseRate = await prisma.exchangeRate.findFirst({
        where: {
          baseCurrency: target,
          targetCurrency: base,
          date: { lte: normalizedDate },
        },
        orderBy: { date: 'desc' },
      });

      if (reverseRate) {
        return {
          rate: 1 / Number(reverseRate.rate),
          source: `${reverseRate.source} (inverse)`,
          date: reverseRate.date,
        };
      }
    }

    // Try triangular conversion via EUR (for BCE rates)
    if (!exchangeRate && base !== 'EUR' && target !== 'EUR') {
      // Get base → EUR rate (inverse of EUR → base)
      const baseToEur = await prisma.exchangeRate.findFirst({
        where: {
          baseCurrency: 'EUR',
          targetCurrency: base,
          date: { lte: normalizedDate },
        },
        orderBy: { date: 'desc' },
      });

      // Get EUR → target rate
      const eurToTarget = await prisma.exchangeRate.findFirst({
        where: {
          baseCurrency: 'EUR',
          targetCurrency: target,
          date: { lte: normalizedDate },
        },
        orderBy: { date: 'desc' },
      });

      if (baseToEur && eurToTarget) {
        // base → EUR → target = (1 / EUR→base) × (EUR→target)
        const crossRate = (1 / Number(baseToEur.rate)) * Number(eurToTarget.rate);
        const olderDate = baseToEur.date < eurToTarget.date ? baseToEur.date : eurToTarget.date;
        return {
          rate: crossRate,
          source: 'ecb (cross-rate via EUR)',
          date: olderDate,
        };
      }
    }

    // Try triangular conversion via USD (for FRED rates)
    if (!exchangeRate && base !== 'USD' && target !== 'USD') {
      // Get base → USD rate (inverse of USD → base)
      const baseToUsd = await prisma.exchangeRate.findFirst({
        where: {
          baseCurrency: 'USD',
          targetCurrency: base,
          date: { lte: normalizedDate },
        },
        orderBy: { date: 'desc' },
      });

      // Get USD → target rate
      const usdToTarget = await prisma.exchangeRate.findFirst({
        where: {
          baseCurrency: 'USD',
          targetCurrency: target,
          date: { lte: normalizedDate },
        },
        orderBy: { date: 'desc' },
      });

      if (baseToUsd && usdToTarget) {
        // base → USD → target = (1 / USD→base) × (USD→target)
        const crossRate = (1 / Number(baseToUsd.rate)) * Number(usdToTarget.rate);
        const olderDate = baseToUsd.date < usdToTarget.date ? baseToUsd.date : usdToTarget.date;
        return {
          rate: crossRate,
          source: 'fred (cross-rate via USD)',
          date: olderDate,
        };
      }
    }

    if (!exchangeRate) {
      return null;
    }

    return {
      rate: Number(exchangeRate.rate),
      source: exchangeRate.source,
      date: exchangeRate.date,
    };
  },

  /**
   * Convert amount between currencies
   */
  async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    date: Date = new Date()
  ): Promise<ConversionResult | null> {
    const rateInfo = await this.getRate(fromCurrency, toCurrency, date);

    if (!rateInfo) {
      return null;
    }

    return {
      originalAmount: amount,
      originalCurrency: fromCurrency.toUpperCase(),
      convertedAmount: amount * rateInfo.rate,
      targetCurrency: toCurrency.toUpperCase(),
      rate: rateInfo.rate,
      date: rateInfo.date,
      source: rateInfo.source,
    };
  },

  /**
   * Set exchange rate manually
   */
  async setRate(data: ExchangeRateData) {
    const normalizedDate = new Date(data.date);
    normalizedDate.setHours(0, 0, 0, 0);

    return prisma.exchangeRate.upsert({
      where: {
        baseCurrency_targetCurrency_date: {
          baseCurrency: data.baseCurrency.toUpperCase(),
          targetCurrency: data.targetCurrency.toUpperCase(),
          date: normalizedDate,
        },
      },
      update: {
        rate: data.rate,
        source: data.source ?? 'manual',
      },
      create: {
        baseCurrency: data.baseCurrency.toUpperCase(),
        targetCurrency: data.targetCurrency.toUpperCase(),
        rate: data.rate,
        date: normalizedDate,
        source: data.source ?? 'manual',
      },
    });
  },

  /**
   * Bulk import exchange rates
   */
  async importRates(rates: ExchangeRateData[]) {
    const results = {
      imported: 0,
      errors: [] as string[],
    };

    for (const rate of rates) {
      try {
        await this.setRate(rate);
        results.imported++;
      } catch (error) {
        results.errors.push(
          `${rate.baseCurrency}/${rate.targetCurrency} ${rate.date}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    return results;
  },

  /**
   * Get historical rates for a currency pair
   */
  async getHistoricalRates(
    baseCurrency: string,
    targetCurrency: string,
    startDate: Date,
    endDate: Date = new Date()
  ) {
    const rates = await prisma.exchangeRate.findMany({
      where: {
        baseCurrency: baseCurrency.toUpperCase(),
        targetCurrency: targetCurrency.toUpperCase(),
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    return rates.map((r) => ({
      date: r.date,
      rate: Number(r.rate),
      source: r.source,
    }));
  },

  /**
   * Get latest rates for a base currency
   */
  async getLatestRates(baseCurrency: string) {
    const base = baseCurrency.toUpperCase();

    // Get distinct target currencies that have rates from this base
    const distinctTargets = await prisma.exchangeRate.findMany({
      where: { baseCurrency: base },
      distinct: ['targetCurrency'],
      select: { targetCurrency: true },
    });

    if (distinctTargets.length === 0) {
      return [];
    }

    // For each target currency, get the most recent rate
    const rates = await Promise.all(
      distinctTargets.map(async ({ targetCurrency }) => {
        const latestRate = await prisma.exchangeRate.findFirst({
          where: {
            baseCurrency: base,
            targetCurrency,
          },
          orderBy: { date: 'desc' },
        });
        return latestRate;
      })
    );

    // Filter out nulls and map to response format
    return rates
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({
        targetCurrency: r.targetCurrency,
        rate: Number(r.rate),
        date: r.date,
        source: r.source,
      }));
  },

  /**
   * Fetch rates from ECB (European Central Bank)
   * Note: ECB provides rates with EUR as base currency
   */
  async fetchECBRates(): Promise<{ imported: number; date: Date | null }> {
    try {
      // ECB XML feed URL
      const response = await fetch(
        'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'
      );

      if (!response.ok) {
        throw new Error(`ECB API error: ${response.status}`);
      }

      const xml = await response.text();

      // Parse XML to extract rates
      const dateMatch = xml.match(/time='(\d{4}-\d{2}-\d{2})'/);
      const rateMatches = xml.matchAll(/currency='([A-Z]{3})'\s+rate='([\d.]+)'/g);

      if (!dateMatch || !dateMatch[1]) {
        throw new Error('Could not parse date from ECB response');
      }

      const date = new Date(dateMatch[1]);
      const rates: ExchangeRateData[] = [];

      for (const match of rateMatches) {
        const currency = match[1];
        const rateStr = match[2];
        if (currency && rateStr) {
          rates.push({
            baseCurrency: 'EUR',
            targetCurrency: currency,
            rate: parseFloat(rateStr),
            date,
            source: 'ecb',
          });
        }
      }

      const result = await this.importRates(rates);

      return {
        imported: result.imported,
        date: rates.length > 0 ? date : null,
      };
    } catch (error) {
      console.error('Failed to fetch ECB rates:', error);
      throw error;
    }
  },

  /**
   * Fetch rates from FRED (Federal Reserve Economic Data)
   * Note: FRED provides rates with USD as base currency
   * Requires FRED_API_KEY environment variable
   */
  async fetchFREDRates(): Promise<{ imported: number; date: Date | null; currencies: string[] }> {
    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) {
      throw new Error('FRED_API_KEY environment variable is not set');
    }

    const rates: ExchangeRateData[] = [];
    const currencies: string[] = [];
    let latestDate: Date | null = null;

    // Fetch each currency series
    for (const [currency, { seriesId, direction }] of Object.entries(FRED_SERIES)) {
      try {
        // Get the most recent observation
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
        const response = await fetch(url);

        if (!response.ok) {
          console.error(`FRED API error for ${seriesId}: ${response.status}`);
          continue;
        }

        const data = await response.json() as {
          observations: Array<{ date: string; value: string }>;
        };

        if (!data.observations || data.observations.length === 0) {
          continue;
        }

        const obs = data.observations[0];
        if (!obs || obs.value === '.') {
          // FRED uses '.' for missing data
          continue;
        }

        const rateValue = parseFloat(obs.value);
        const date = new Date(obs.date);

        if (!latestDate || date > latestDate) {
          latestDate = date;
        }

        // Convert to USD-based rates (USD → currency)
        if (direction === 'from_usd') {
          // FRED gives USD per foreign currency, we want USD → foreign
          // So we need the inverse: 1 USD = 1/rate foreign currency
          rates.push({
            baseCurrency: 'USD',
            targetCurrency: currency,
            rate: 1 / rateValue,
            date,
            source: 'fred',
          });
        } else {
          // FRED gives foreign currency per USD, which is what we want
          rates.push({
            baseCurrency: 'USD',
            targetCurrency: currency,
            rate: rateValue,
            date,
            source: 'fred',
          });
        }

        currencies.push(currency);
      } catch (error) {
        console.error(`Failed to fetch FRED rate for ${currency}:`, error);
      }
    }

    if (rates.length === 0) {
      return { imported: 0, date: null, currencies: [] };
    }

    const result = await this.importRates(rates);

    return {
      imported: result.imported,
      date: latestDate,
      currencies,
    };
  },

  /**
   * Fetch rates from all available sources
   */
  async fetchAllRates(): Promise<{
    ecb: { imported: number; date: Date | null };
    fred: { imported: number; date: Date | null; currencies: string[] } | null;
  }> {
    // Always fetch ECB rates
    const ecbResult = await this.fetchECBRates();

    // Try to fetch FRED rates if API key is available
    let fredResult: { imported: number; date: Date | null; currencies: string[] } | null = null;
    if (process.env.FRED_API_KEY) {
      try {
        fredResult = await this.fetchFREDRates();
      } catch (error) {
        console.error('Failed to fetch FRED rates:', error);
      }
    }

    return {
      ecb: ecbResult,
      fred: fredResult,
    };
  },

  /**
   * Calculate total in workspace currency
   */
  async calculateTotalInBaseCurrency(
    amounts: Array<{ amount: number; currency: string; date?: Date }>,
    baseCurrency: string
  ): Promise<{ total: number; conversions: ConversionResult[] }> {
    const conversions: ConversionResult[] = [];
    let total = 0;

    for (const item of amounts) {
      const conversion = await this.convert(
        item.amount,
        item.currency,
        baseCurrency,
        item.date
      );

      if (conversion) {
        conversions.push(conversion);
        total += conversion.convertedAmount;
      } else {
        // If no rate available, use original amount (fallback)
        conversions.push({
          originalAmount: item.amount,
          originalCurrency: item.currency,
          convertedAmount: item.amount,
          targetCurrency: baseCurrency,
          rate: 1,
          date: item.date ?? new Date(),
          source: 'fallback (no rate)',
        });
        total += item.amount;
      }
    }

    return { total, conversions };
  },
};

export default currencyService;
