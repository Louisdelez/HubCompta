// ============================================================================
// QUEUE WORKERS - Finance Hub
// Background job processors
// ============================================================================

import { Worker, Job } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import { assetService } from '../../modules/invest/asset.service.js';
import { positionService } from '../../modules/invest/position.service.js';
import { currencyService } from '../../modules/currency/currency.service.js';
import { smartAlertService } from '../../modules/notifications/smart-alert.service.js';
import { summaryService } from '../../modules/notifications/summary.service.js';
import type {
  MarketDataJobData,
  ExchangeRateJobData,
  PortfolioSnapshotJobData,
  SmartNotificationJobData,
} from './index.js';
import { QUEUES } from './index.js';
import { logger } from '../middleware/logger.js';
import { prisma } from '../database/client.js';

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
let smartNotificationsWorker: Worker | null = null;

// ----------------------------------------------------------------------------
// Market Data Worker
// ----------------------------------------------------------------------------

async function processMarketDataJob(job: Job<MarketDataJobData>): Promise<void> {
  const { provider, assetIds, updateAll } = job.data;

  logger.info({ provider, updateAll, jobId: job.id }, 'Processing market data job');

  try {
    if (updateAll || provider === 'all') {
      // Update all assets with positions
      const result = await assetService.updateAllPrices();
      logger.info({ updated: result.updated, failed: result.failed }, 'Market data update complete');
    } else if (assetIds && assetIds.length > 0) {
      // Update specific assets
      const quotes = await assetService.updatePrices(assetIds);
      logger.info({ count: quotes.size }, 'Updated asset prices');
    }
  } catch (error) {
    logger.error({ error, jobId: job.id }, 'Market data job failed');
    throw error;
  }
}

// ----------------------------------------------------------------------------
// Exchange Rates Worker
// ----------------------------------------------------------------------------

async function processExchangeRatesJob(job: Job<ExchangeRateJobData>): Promise<void> {
  const { source } = job.data;

  logger.info({ source: source || 'ecb', jobId: job.id }, 'Processing exchange rates job');

  try {
    if (source === 'ecb' || !source) {
      const result = await currencyService.fetchECBRates();
      logger.info({ imported: result.imported, date: result.date?.toISOString() }, 'Exchange rates update complete');
    }
  } catch (error) {
    logger.error({ error, jobId: job.id }, 'Exchange rates job failed');
    throw error;
  }
}

// ----------------------------------------------------------------------------
// Portfolio Snapshot Worker
// ----------------------------------------------------------------------------

async function processPortfolioSnapshotJob(job: Job<PortfolioSnapshotJobData>): Promise<void> {
  const { workspaceId } = job.data;

  logger.info({ workspaceId: workspaceId || 'all', jobId: job.id }, 'Processing portfolio snapshot job');

  try {
    if (workspaceId) {
      // Snapshot for a specific workspace
      const snapshot = await positionService.takePortfolioSnapshot(workspaceId);
      logger.info({ workspaceId, totalValue: snapshot.totalValue, totalCost: snapshot.totalCost }, 'Portfolio snapshot taken');
    } else {
      // Snapshot for all workspaces with positions
      const results = await positionService.takeAllWorkspacesSnapshots();
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      logger.info({ successful, failed }, 'Portfolio snapshots complete');
    }
  } catch (error) {
    logger.error({ error, jobId: job.id }, 'Portfolio snapshot job failed');
    throw error;
  }
}

// ----------------------------------------------------------------------------
// Smart Notifications Worker
// ----------------------------------------------------------------------------

async function processSmartNotificationJob(job: Job<SmartNotificationJobData>): Promise<void> {
  const { type, workspaceId, userId } = job.data;

  logger.info({ type, workspaceId: workspaceId || 'all', jobId: job.id }, 'Processing smart notification job');

  try {
    switch (type) {
      case 'weekly_summary': {
        const result = await summaryService.processAllWeeklySummaries();
        logger.info({ processed: result.processed, failed: result.failed }, 'Weekly summaries complete');
        break;
      }

      case 'monthly_report': {
        const result = await summaryService.processAllMonthlyReports();
        logger.info({ processed: result.processed, failed: result.failed }, 'Monthly reports complete');
        break;
      }

      case 'anomaly_detection': {
        // If specific workspace provided, process only that one
        if (workspaceId && userId) {
          const result = await smartAlertService.runAnomalyDetection(workspaceId, userId);
          logger.info(
            { workspaceId, ...result },
            'Anomaly detection complete for workspace'
          );
        } else {
          // Process all active workspaces
          const workspaces = await prisma.workspace.findMany({
            where: { deletedAt: null },
            include: {
              memberships: {
                where: { role: 'owner' },
                take: 1,
              },
            },
          });

          let processed = 0;
          let failed = 0;

          for (const workspace of workspaces) {
            const owner = workspace.memberships[0];
            if (!owner) continue;

            try {
              await smartAlertService.runAnomalyDetection(workspace.id, owner.userId);
              processed++;
            } catch (error) {
              logger.error(
                { error, workspaceId: workspace.id },
                'Failed to run anomaly detection for workspace'
              );
              failed++;
            }
          }

          logger.info({ processed, failed }, 'Anomaly detection complete for all workspaces');
        }
        break;
      }

      case 'daily_checks': {
        // If specific workspace provided, process only that one
        if (workspaceId && userId) {
          const result = await smartAlertService.runDailyChecks(workspaceId, userId);
          logger.info(
            { workspaceId, ...result },
            'Daily checks complete for workspace'
          );
        } else {
          // Process all active workspaces
          const workspaces = await prisma.workspace.findMany({
            where: { deletedAt: null },
            include: {
              memberships: {
                where: { role: 'owner' },
                take: 1,
              },
            },
          });

          let processed = 0;
          let failed = 0;

          for (const workspace of workspaces) {
            const owner = workspace.memberships[0];
            if (!owner) continue;

            try {
              await smartAlertService.runDailyChecks(workspace.id, owner.userId);
              processed++;
            } catch (error) {
              logger.error(
                { error, workspaceId: workspace.id },
                'Failed to run daily checks for workspace'
              );
              failed++;
            }
          }

          logger.info({ processed, failed }, 'Daily checks complete for all workspaces');
        }
        break;
      }

      default:
        logger.warn({ type }, 'Unknown smart notification type');
    }
  } catch (error) {
    logger.error({ error, jobId: job.id }, 'Smart notification job failed');
    throw error;
  }
}

// ----------------------------------------------------------------------------
// Worker Initialization
// ----------------------------------------------------------------------------

export function initializeWorkers(): void {
  if (!REDIS_URL) {
    logger.warn('REDIS_URL not set, workers will not be initialized');
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
    logger.info({ jobId: job.id, queue: QUEUES.MARKET_DATA }, 'Market data job completed');
  });

  marketDataWorker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, queue: QUEUES.MARKET_DATA, error }, 'Market data job failed');
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
    logger.info({ jobId: job.id, queue: QUEUES.EXCHANGE_RATES }, 'Exchange rates job completed');
  });

  exchangeRatesWorker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, queue: QUEUES.EXCHANGE_RATES, error }, 'Exchange rates job failed');
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
    logger.info({ jobId: job.id, queue: QUEUES.PORTFOLIO_SNAPSHOT }, 'Portfolio snapshot job completed');
  });

  portfolioSnapshotWorker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, queue: QUEUES.PORTFOLIO_SNAPSHOT, error }, 'Portfolio snapshot job failed');
  });

  // Smart Notifications Worker
  smartNotificationsWorker = new Worker<SmartNotificationJobData>(
    QUEUES.SMART_NOTIFICATIONS,
    processSmartNotificationJob,
    {
      connection,
      concurrency: 1,
    }
  );

  smartNotificationsWorker.on('completed', (job) => {
    logger.info({ jobId: job.id, queue: QUEUES.SMART_NOTIFICATIONS }, 'Smart notification job completed');
  });

  smartNotificationsWorker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, queue: QUEUES.SMART_NOTIFICATIONS, error }, 'Smart notification job failed');
  });

  logger.info('Queue workers initialized');
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

  if (smartNotificationsWorker) {
    shutdownPromises.push(smartNotificationsWorker.close());
  }

  await Promise.all(shutdownPromises);
  logger.info('Queue workers shut down');
}
