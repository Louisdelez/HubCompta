// ============================================================================
// BULLMQ QUEUE SETUP - Finance Hub
// ============================================================================

import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import { logger } from '../middleware/logger.js';

// Redis connection for BullMQ
const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required');
}

// Parse Redis URL for connection options
function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null, // Required for BullMQ
  };
}

const connection = parseRedisUrl(REDIS_URL);

// ----------------------------------------------------------------------------
// Queue Definitions
// ----------------------------------------------------------------------------

export const QUEUES = {
  IMPORT: 'import',
  EXPORT: 'export',
  MARKET_DATA: 'market-data',
  CLEANUP: 'cleanup',
  BACKUP: 'backup',
  NOTIFICATIONS: 'notifications',
  PRO_STATUS: 'pro-status',
  ALERTS: 'alerts',
  RECURRENCES: 'recurrences',
  EXCHANGE_RATES: 'exchange-rates',
  PORTFOLIO_SNAPSHOT: 'portfolio-snapshot',
  SMART_NOTIFICATIONS: 'smart-notifications',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

// Queue instances (lazy initialization)
const queues = new Map<QueueName, Queue>();

/**
 * Get or create a queue instance
 */
export function getQueue(name: QueueName): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: {
          age: 24 * 60 * 60, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
        },
      },
    });
    queues.set(name, queue);
  }
  return queue;
}

// ----------------------------------------------------------------------------
// Job Types
// ----------------------------------------------------------------------------

export interface ImportJobData {
  jobId: string;
  workspaceId: string;
  accountId: string;
  userId: string;
  filename: string;
  storageKey: string;
  columnMapping: Record<string, string>;
  dateFormat?: string;
  skipFirstRow: boolean;
  applyRules: boolean;
}

export interface ExportJobData {
  exportId: string;
  workspaceId: string;
  userId: string;
  format: 'csv' | 'pdf';
  dateRange?: {
    from: string;
    to: string;
  };
  accountIds?: string[];
  includeDocuments: boolean;
}

export interface MarketDataJobData {
  assetIds?: string[];
  provider: 'yahoo' | 'coingecko' | 'all';
  updateAll?: boolean;
}

export interface CleanupJobData {
  type: 'orphaned_documents' | 'expired_sessions' | 'old_audit_logs';
  olderThanDays?: number;
}

export interface BackupJobData {
  workspaceId?: string; // Optional: specific workspace, or all if not set
  includeDocuments: boolean;
}

export interface RecurrenceJobData {
  type: 'process_due' | 'execute_single';
  recurrenceId?: string;
}

export interface AlertsJobData {
  workspaceId?: string;
  alertTypes?: string[];
}

export interface ProStatusJobData {
  workspaceId?: string;
}

export interface ExchangeRateJobData {
  source?: 'ecb' | 'manual';
  baseCurrency?: string;
}

export interface PortfolioSnapshotJobData {
  workspaceId?: string; // Optional: specific workspace, or all if not set
}

export interface SmartNotificationJobData {
  type: 'weekly_summary' | 'monthly_report' | 'anomaly_detection' | 'daily_checks';
  workspaceId?: string; // Optional: specific workspace, or all if not set
  userId?: string; // Optional: specific user, or all if not set
}

// ----------------------------------------------------------------------------
// Queue Operations
// ----------------------------------------------------------------------------

/**
 * Add a job to the import queue
 */
export async function addImportJob(data: ImportJobData): Promise<Job<ImportJobData>> {
  const queue = getQueue(QUEUES.IMPORT);
  return queue.add('process-import', data, {
    jobId: data.jobId,
  });
}

/**
 * Add a job to the export queue
 */
export async function addExportJob(data: ExportJobData): Promise<Job<ExportJobData>> {
  const queue = getQueue(QUEUES.EXPORT);
  return queue.add('process-export', data, {
    jobId: data.exportId,
  });
}

/**
 * Add a market data fetch job
 */
export async function addMarketDataJob(data: MarketDataJobData): Promise<Job<MarketDataJobData>> {
  const queue = getQueue(QUEUES.MARKET_DATA);
  return queue.add('fetch-prices', data, {
    // Dedupe by provider to avoid duplicate fetches
    jobId: `market-data-${data.provider}-${Date.now()}`,
  });
}

/**
 * Add a cleanup job
 */
export async function addCleanupJob(data: CleanupJobData): Promise<Job<CleanupJobData>> {
  const queue = getQueue(QUEUES.CLEANUP);
  return queue.add('cleanup', data);
}

/**
 * Add a backup job
 */
export async function addBackupJob(data: BackupJobData): Promise<Job<BackupJobData>> {
  const queue = getQueue(QUEUES.BACKUP);
  return queue.add('backup', data, {
    jobId: data.workspaceId ? `backup-${data.workspaceId}` : 'backup-all',
  });
}

/**
 * Add a portfolio snapshot job
 */
export async function addPortfolioSnapshotJob(data: PortfolioSnapshotJobData = {}): Promise<Job<PortfolioSnapshotJobData>> {
  const queue = getQueue(QUEUES.PORTFOLIO_SNAPSHOT);
  return queue.add('take-snapshot', data, {
    jobId: data.workspaceId ? `snapshot-${data.workspaceId}` : `snapshot-all-${Date.now()}`,
  });
}

/**
 * Add a recurrence job to process due recurrences or execute a single one
 */
export async function addRecurrenceJob(data: RecurrenceJobData): Promise<Job<RecurrenceJobData>> {
  const queue = getQueue(QUEUES.RECURRENCES);
  if (data.type === 'execute_single' && data.recurrenceId) {
    return queue.add('execute-recurrence', data, {
      jobId: `execute-${data.recurrenceId}-${Date.now()}`,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
  }
  return queue.add('process-due', data);
}

/**
 * Add a smart notification job
 */
export async function addSmartNotificationJob(data: SmartNotificationJobData): Promise<Job<SmartNotificationJobData>> {
  const queue = getQueue(QUEUES.SMART_NOTIFICATIONS);
  return queue.add(`process-${data.type}`, data, {
    jobId: `${data.type}-${data.workspaceId ?? 'all'}-${Date.now()}`,
  });
}

/**
 * Schedule recurring jobs (call this on app startup)
 */
export async function setupScheduledJobs(): Promise<void> {
  // Recurrence processing - every hour
  const recurrenceQueue = getQueue(QUEUES.RECURRENCES);
  await recurrenceQueue.add(
    'process-recurrences',
    { type: 'process_due' },
    {
      repeat: {
        pattern: '0 * * * *', // Every hour at minute 0
      },
      jobId: 'scheduled-recurrences',
    }
  );

  // Pro status check - every 6 hours
  const proStatusQueue = getQueue(QUEUES.PRO_STATUS);
  await proStatusQueue.add(
    'check-pro-status',
    {},
    {
      repeat: {
        pattern: '0 */6 * * *', // Every 6 hours
      },
      jobId: 'scheduled-pro-status',
    }
  );

  // Alerts processing - every hour
  const alertsQueue = getQueue(QUEUES.ALERTS);
  await alertsQueue.add(
    'process-alerts',
    {},
    {
      repeat: {
        pattern: '30 * * * *', // Every hour at minute 30
      },
      jobId: 'scheduled-alerts',
    }
  );

  // Exchange rates - daily at 14:00 UTC (after ECB publishes around 13:00 UTC)
  const exchangeRatesQueue = getQueue(QUEUES.EXCHANGE_RATES);
  await exchangeRatesQueue.add(
    'fetch-exchange-rates',
    { source: 'ecb' },
    {
      repeat: {
        pattern: '0 14 * * *', // Daily at 14:00 UTC
      },
      jobId: 'scheduled-exchange-rates',
    }
  );

  // Market data (investment prices) - every 15 minutes during market hours (weekdays 8-22 UTC)
  const marketDataQueue = getQueue(QUEUES.MARKET_DATA);
  await marketDataQueue.add(
    'update-all-prices',
    { provider: 'all' as 'yahoo' | 'coingecko' },
    {
      repeat: {
        pattern: '*/15 8-22 * * 1-5', // Every 15 min, Mon-Fri 8am-10pm UTC
      },
      jobId: 'scheduled-market-data-weekday',
    }
  );

  // Crypto prices update - every hour on weekends (crypto markets never close)
  await marketDataQueue.add(
    'update-all-prices',
    { provider: 'coingecko' },
    {
      repeat: {
        pattern: '0 * * * 0,6', // Every hour on Sat/Sun
      },
      jobId: 'scheduled-market-data-weekend',
    }
  );

  // Portfolio snapshots - daily at 23:00 UTC (after market close)
  const portfolioSnapshotQueue = getQueue(QUEUES.PORTFOLIO_SNAPSHOT);
  await portfolioSnapshotQueue.add(
    'take-all-snapshots',
    {},
    {
      repeat: {
        pattern: '0 23 * * *', // Daily at 23:00 UTC
      },
      jobId: 'scheduled-portfolio-snapshots',
    }
  );

  // Smart notifications queue
  const smartNotificationsQueue = getQueue(QUEUES.SMART_NOTIFICATIONS);

  // Weekly summary - every Monday at 8:00 UTC
  await smartNotificationsQueue.add(
    'process-weekly-summary',
    { type: 'weekly_summary' as const },
    {
      repeat: {
        pattern: '0 8 * * 1', // Monday at 8:00 UTC
      },
      jobId: 'scheduled-weekly-summary',
    }
  );

  // Monthly report - 1st of each month at 9:00 UTC
  await smartNotificationsQueue.add(
    'process-monthly-report',
    { type: 'monthly_report' as const },
    {
      repeat: {
        pattern: '0 9 1 * *', // 1st of month at 9:00 UTC
      },
      jobId: 'scheduled-monthly-report',
    }
  );

  // Anomaly detection - every 4 hours
  await smartNotificationsQueue.add(
    'process-anomaly-detection',
    { type: 'anomaly_detection' as const },
    {
      repeat: {
        pattern: '0 */4 * * *', // Every 4 hours
      },
      jobId: 'scheduled-anomaly-detection',
    }
  );

  // Daily checks (budgets, savings, bills, balances) - daily at 7:00 UTC
  await smartNotificationsQueue.add(
    'process-daily-checks',
    { type: 'daily_checks' as const },
    {
      repeat: {
        pattern: '0 7 * * *', // Daily at 7:00 UTC
      },
      jobId: 'scheduled-daily-checks',
    }
  );

  logger.info('Scheduled jobs configured');
}

// ----------------------------------------------------------------------------
// Queue Events
// ----------------------------------------------------------------------------

/**
 * Create queue events listener
 */
export function createQueueEvents(name: QueueName): QueueEvents {
  return new QueueEvents(name, { connection });
}

// ----------------------------------------------------------------------------
// Worker Factory
// ----------------------------------------------------------------------------

export interface WorkerOptions<T> {
  name: QueueName;
  processor: (job: Job<T>) => Promise<void>;
  concurrency?: number;
}

/**
 * Create a worker for a queue
 */
export function createWorker<T>(options: WorkerOptions<T>): Worker<T> {
  const worker = new Worker<T>(options.name, options.processor, {
    connection,
    concurrency: options.concurrency ?? 5,
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, queue: options.name }, 'Job completed');
  });

  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, queue: options.name, error }, 'Job failed');
  });

  return worker;
}

// ----------------------------------------------------------------------------
// Graceful Shutdown
// ----------------------------------------------------------------------------

/**
 * Close all queue connections
 */
export async function closeQueues(): Promise<void> {
  const closePromises = Array.from(queues.values()).map((queue) => queue.close());
  await Promise.all(closePromises);
  queues.clear();
}

process.on('beforeExit', () => {
  void closeQueues();
});

// ----------------------------------------------------------------------------
// Convenience Exports
// ----------------------------------------------------------------------------

// Pre-initialized queue instances for common use
export const importQueue = getQueue(QUEUES.IMPORT);
export const exportQueue = getQueue(QUEUES.EXPORT);
export const recurrencesQueue = getQueue(QUEUES.RECURRENCES);
export const backupQueue = getQueue(QUEUES.BACKUP);
export const portfolioSnapshotQueue = getQueue(QUEUES.PORTFOLIO_SNAPSHOT);

/**
 * Get the backup queue instance
 */
export function getBackupQueue(): Queue {
  return getQueue(QUEUES.BACKUP);
}
