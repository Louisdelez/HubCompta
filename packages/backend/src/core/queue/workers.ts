// ============================================================================
// QUEUE WORKERS - Finance Hub
// Background job processors
// ============================================================================

import { Worker, Job } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import { assetService } from '../../modules/invest/asset.service.js';
import { positionService } from '../../modules/invest/position.service.js';
import { currencyService } from '../../modules/currency/currency.service.js';
import type {
  MarketDataJobData,
  ExchangeRateJobData,
  PortfolioSnapshotJobData,
} from './index.js';
import { QUEUES } from './index.js';

// Parse Redis URL for connection options
const REDIS_URL = process.env.REDIS_URL;

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null,
  };
}

// ----------------------------------------------------------------------------
// Worker Instances
// ----------------------------------------------------------------------------

let marketDataWorker: Worker | null = null;
let exchangeRatesWorker: Worker | null = null;
let portfolioSnapshotWorker: Worker | null = null;

// ----------------------------------------------------------------------------
// Market Data Worker
// ----------------------------------------------------------------------------

async function processMarketDataJob(job: Job<MarketDataJobData>): Promise<void> {
  const { provider, assetIds, updateAll } = job.data;

  console.info(`Processing market data job: provider=${provider}, updateAll=${updateAll}`);

  try {
    if (updateAll || provider === 'all') {
      // Update all assets with positions
      const result = await assetService.updateAllPrices();
      console.info(`Market data update complete: ${result.updated} updated, ${result.failed} failed`);
    } else if (assetIds && assetIds.length > 0) {
      // Update specific assets
      const quotes = await assetService.updatePrices(assetIds);
      console.info(`Updated ${quotes.size} asset prices`);
    }
  } catch (error) {
    console.error('Market data job failed:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// Exchange Rates Worker
// ----------------------------------------------------------------------------

async function processExchangeRatesJob(job: Job<ExchangeRateJobData>): Promise<void> {
  const { source } = job.data;

  console.info(`Processing exchange rates job: source=${source || 'ecb'}`);

  try {
    if (source === 'ecb' || !source) {
      const result = await currencyService.fetchECBRates();
      console.info(`Exchange rates update: ${result.imported} rates imported for ${result.date?.toISOString()}`);
    }
  } catch (error) {
    console.error('Exchange rates job failed:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// Portfolio Snapshot Worker
// ----------------------------------------------------------------------------

async function processPortfolioSnapshotJob(job: Job<PortfolioSnapshotJobData>): Promise<void> {
  const { workspaceId } = job.data;

  console.info(`Processing portfolio snapshot job: workspaceId=${workspaceId || 'all'}`);

  try {
    if (workspaceId) {
      // Snapshot for a specific workspace
      const snapshot = await positionService.takePortfolioSnapshot(workspaceId);
      console.info(`Portfolio snapshot taken for workspace ${workspaceId}: value=${snapshot.totalValue}, cost=${snapshot.totalCost}`);
    } else {
      // Snapshot for all workspaces with positions
      const results = await positionService.takeAllWorkspacesSnapshots();
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      console.info(`Portfolio snapshots complete: ${successful} successful, ${failed} failed`);
    }
  } catch (error) {
    console.error('Portfolio snapshot job failed:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// Worker Initialization
// ----------------------------------------------------------------------------

export function initializeWorkers(): void {
  if (!REDIS_URL) {
    console.warn('REDIS_URL not set, workers will not be initialized');
    return;
  }

  const connection = parseRedisUrl(REDIS_URL);

  // Market Data Worker
  marketDataWorker = new Worker<MarketDataJobData>(
    QUEUES.MARKET_DATA,
    processMarketDataJob,
    {
      connection,
      concurrency: 1, // Process one at a time to respect rate limits
    }
  );

  marketDataWorker.on('completed', (job) => {
    console.info(`Market data job ${job.id} completed`);
  });

  marketDataWorker.on('failed', (job, error) => {
    console.error(`Market data job ${job?.id} failed:`, error);
  });

  // Exchange Rates Worker
  exchangeRatesWorker = new Worker<ExchangeRateJobData>(
    QUEUES.EXCHANGE_RATES,
    processExchangeRatesJob,
    {
      connection,
      concurrency: 1,
    }
  );

  exchangeRatesWorker.on('completed', (job) => {
    console.info(`Exchange rates job ${job.id} completed`);
  });

  exchangeRatesWorker.on('failed', (job, error) => {
    console.error(`Exchange rates job ${job?.id} failed:`, error);
  });

  // Portfolio Snapshot Worker
  portfolioSnapshotWorker = new Worker<PortfolioSnapshotJobData>(
    QUEUES.PORTFOLIO_SNAPSHOT,
    processPortfolioSnapshotJob,
    {
      connection,
      concurrency: 1,
    }
  );

  portfolioSnapshotWorker.on('completed', (job) => {
    console.info(`Portfolio snapshot job ${job.id} completed`);
  });

  portfolioSnapshotWorker.on('failed', (job, error) => {
    console.error(`Portfolio snapshot job ${job?.id} failed:`, error);
  });

  console.info('Queue workers initialized');
}

// ----------------------------------------------------------------------------
// Worker Shutdown
// ----------------------------------------------------------------------------

export async function shutdownWorkers(): Promise<void> {
  const shutdownPromises: Promise<void>[] = [];

  if (marketDataWorker) {
    shutdownPromises.push(marketDataWorker.close());
  }

  if (exchangeRatesWorker) {
    shutdownPromises.push(exchangeRatesWorker.close());
  }

  if (portfolioSnapshotWorker) {
    shutdownPromises.push(portfolioSnapshotWorker.close());
  }

  await Promise.all(shutdownPromises);
  console.info('Queue workers shut down');
}
