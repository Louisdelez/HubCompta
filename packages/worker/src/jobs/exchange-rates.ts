// ============================================================================
// EXCHANGE RATES JOB - Finance Hub
// Fetch and update exchange rates periodically
// ============================================================================

import { Job } from 'bullmq';
import { prisma } from '../lib/prisma.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ExchangeRateJobData {
  source?: 'ecb' | 'manual';
  baseCurrency?: string;
}

interface ExchangeRateJobResult {
  imported: number;
  source: string;
  date: Date | null;
  duration: number;
}

// ----------------------------------------------------------------------------
// ECB Rate Fetcher
// ----------------------------------------------------------------------------

async function fetchECBRates(): Promise<{ rates: ExchangeRateData[]; date: Date | null }> {
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

  if (!dateMatch?.[1]) {
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
      });
    }
  }

  return { rates, date };
}

interface ExchangeRateData {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  date: Date;
}

async function importRates(
  rates: ExchangeRateData[],
  source: string
): Promise<number> {
  let imported = 0;

  for (const rate of rates) {
    const normalizedDate = new Date(rate.date);
    normalizedDate.setHours(0, 0, 0, 0);

    await prisma.exchangeRate.upsert({
      where: {
        baseCurrency_targetCurrency_date: {
          baseCurrency: rate.baseCurrency,
          targetCurrency: rate.targetCurrency,
          date: normalizedDate,
        },
      },
      update: {
        rate: rate.rate,
        source,
      },
      create: {
        baseCurrency: rate.baseCurrency,
        targetCurrency: rate.targetCurrency,
        rate: rate.rate,
        date: normalizedDate,
        source,
      },
    });
    imported++;
  }

  return imported;
}

// ----------------------------------------------------------------------------
// Job Processor
// ----------------------------------------------------------------------------

export async function processExchangeRateJob(
  job: Job<ExchangeRateJobData>
): Promise<ExchangeRateJobResult> {
  const startTime = Date.now();
  const { source = 'ecb' } = job.data;

  console.log(`[ExchangeRateJob] Starting exchange rate fetch from ${source}`);

  try {
    if (source === 'ecb') {
      const { rates, date } = await fetchECBRates();

      if (rates.length === 0) {
        console.log('[ExchangeRateJob] No rates returned from ECB');
        return {
          imported: 0,
          source,
          date: null,
          duration: Date.now() - startTime,
        };
      }

      const imported = await importRates(rates, 'ecb');

      console.log(
        `[ExchangeRateJob] Imported ${imported} rates from ECB for date ${date?.toISOString()}`
      );

      return {
        imported,
        source,
        date,
        duration: Date.now() - startTime,
      };
    }

    // Other sources can be added here
    throw new Error(`Unknown source: ${source}`);
  } catch (error) {
    console.error('[ExchangeRateJob] Error fetching exchange rates:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// Scheduled Job Configuration
// ----------------------------------------------------------------------------

// Run daily at 14:00 UTC (after ECB publishes rates around 13:00 UTC)
export const EXCHANGE_RATE_CRON = '0 14 * * *';

export const exchangeRateJobConfig = {
  name: 'fetch-exchange-rates',
  data: { source: 'ecb' as const },
  opts: {
    repeat: {
      pattern: EXCHANGE_RATE_CRON,
    },
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 60000, // 1 minute
    },
  },
};

export default processExchangeRateJob;
