// ============================================================================
// JOB PROCESSOR REGISTRY - Finance Hub
// ============================================================================

import { Worker, type Job } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';

// Job data types
import type {
  ImportJobData,
  ExportJobData,
  MarketDataJobData,
  CleanupJobData,
  BackupJobData,
  ProStatusJobData,
  AlertsJobData,
  RecurrenceJobData,
  ExchangeRateJobData,
} from './types.js';

// Job processors
import { handleProStatusJob } from './pro-status.js';
import { handleMarketDataJob } from './marketdata.js';
import { handleAlertsJob } from './alerts.js';
import { processRecurrenceJob } from './recurrences.js';
import { processExchangeRateJob } from './exchange-rates.js';
import { processBackupJob } from './backup.js';

// Configuration
const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required');
}

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null,
  };
}

const connection = parseRedisUrl(REDIS_URL);

// Worker instances
const workers: Worker[] = [];

// ----------------------------------------------------------------------------
// Job Processors
// ----------------------------------------------------------------------------

// Import processor (placeholder - will be implemented in T107)
async function processImport(job: Job<ImportJobData>): Promise<void> {
  console.info(`Processing import job: ${job.id}`, job.data);
  // TODO: Implement import processing
  await job.updateProgress(100);
}

// Export processor (placeholder - will be implemented in T186)
async function processExport(job: Job<ExportJobData>): Promise<void> {
  console.info(`Processing export job: ${job.id}`, job.data);
  // TODO: Implement export processing
  await job.updateProgress(100);
}

// Market data processor (placeholder - will be implemented in T169)
async function processMarketData(job: Job<MarketDataJobData>): Promise<void> {
  console.info(`Processing market data job: ${job.id}`, job.data);
  // TODO: Implement market data fetching
}

// Cleanup processor (placeholder - will be implemented in T135)
async function processCleanup(job: Job<CleanupJobData>): Promise<void> {
  console.info(`Processing cleanup job: ${job.id}`, job.data);
  // TODO: Implement cleanup logic
}

// Backup processor
async function processBackup(job: Job<BackupJobData>): Promise<void> {
  console.info(`Processing backup job: ${job.id}`, job.data);
  const result = await processBackupJob(job);
  console.info(`Backup job result:`, result);
}

// Pro status processor (update overdue invoices and expired quotes)
async function processProStatus(job: Job<ProStatusJobData>): Promise<void> {
  console.info(`Processing pro-status job: ${job.id}`, job.data);
  const result = await handleProStatusJob(job.data);
  console.info(`Pro-status job result:`, result);
}

// Alerts processor (evaluate alert rules and create notifications)
async function processAlerts(job: Job<AlertsJobData>): Promise<void> {
  console.info(`Processing alerts job: ${job.id}`, job.data);
  const result = await handleAlertsJob(job.data);
  console.info(`Alerts job result:`, result);
}

// ----------------------------------------------------------------------------
// Worker Registration
// ----------------------------------------------------------------------------

interface ProcessorConfig<T> {
  name: string;
  processor: (job: Job<T>) => Promise<void>;
  concurrency?: number;
}

function registerWorker<T>(config: ProcessorConfig<T>): Worker<T> {
  const worker = new Worker<T>(config.name, config.processor, {
    connection,
    concurrency: config.concurrency ?? 5,
  });

  worker.on('completed', (job) => {
    console.info(`[${config.name}] Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[${config.name}] Job ${job?.id} failed:`, error.message);
  });

  worker.on('progress', (job, progress) => {
    console.info(`[${config.name}] Job ${job.id} progress: ${progress}%`);
  });

  worker.on('error', (error) => {
    console.error(`[${config.name}] Worker error:`, error);
  });

  workers.push(worker as Worker);
  return worker;
}

// ----------------------------------------------------------------------------
// Start Workers
// ----------------------------------------------------------------------------

export async function startWorker(): Promise<void> {
  // Register all job processors
  registerWorker<ImportJobData>({
    name: 'import',
    processor: processImport,
    concurrency: 2, // Limit concurrent imports
  });

  registerWorker<ExportJobData>({
    name: 'export',
    processor: processExport,
    concurrency: 3,
  });

  registerWorker<MarketDataJobData>({
    name: 'market-data',
    processor: processMarketData,
    concurrency: 1, // Rate limit API calls
  });

  registerWorker<CleanupJobData>({
    name: 'cleanup',
    processor: processCleanup,
    concurrency: 1,
  });

  registerWorker<BackupJobData>({
    name: 'backup',
    processor: processBackup,
    concurrency: 1,
  });

  registerWorker<ProStatusJobData>({
    name: 'pro-status',
    processor: processProStatus,
    concurrency: 1,
  });

  registerWorker<AlertsJobData>({
    name: 'alerts',
    processor: processAlerts,
    concurrency: 1,
  });

  registerWorker<RecurrenceJobData>({
    name: 'recurrences',
    processor: processRecurrenceJob,
    concurrency: 1,
  });

  registerWorker<ExchangeRateJobData>({
    name: 'exchange-rates',
    processor: processExchangeRateJob,
    concurrency: 1,
  });

  console.info(`Registered ${workers.length} job processors`);
}

// ----------------------------------------------------------------------------
// Graceful Shutdown
// ----------------------------------------------------------------------------

export async function gracefulShutdown(): Promise<void> {
  console.info('Closing all workers...');

  await Promise.all(
    workers.map(async (worker) => {
      await worker.close();
    })
  );

  console.info('All workers closed');
}
