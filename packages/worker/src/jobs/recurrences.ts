// ============================================================================
// RECURRENCE JOB - Finance Hub
// Process due recurring transactions
// ============================================================================

import { Job } from 'bullmq';
import { prisma } from '../lib/prisma.js';
import type { RecurrenceFreq } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface RecurrenceJobData {
  type: 'process_due' | 'execute_single';
  recurrenceId?: string;
}

interface RecurrenceJobResult {
  processed: number;
  success: number;
  failed: number;
  errors?: Array<{ recurrenceId: string; error: string }>;
}

interface TransactionTemplate {
  accountId: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  categoryId?: string;
  toAccountId?: string;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function calculateNextRun(
  currentDate: Date,
  frequency: RecurrenceFreq,
  interval: number
): Date {
  const result = new Date(currentDate);

  switch (frequency) {
    case 'daily':
      result.setDate(result.getDate() + interval);
      break;
    case 'weekly':
      result.setDate(result.getDate() + interval * 7);
      break;
    case 'monthly':
      result.setMonth(result.getMonth() + interval);
      break;
    case 'yearly':
      result.setFullYear(result.getFullYear() + interval);
      break;
    default:
      result.setMonth(result.getMonth() + interval);
  }

  return result;
}

async function getDueRecurrences(limit: number) {
  const now = new Date();
  return prisma.recurrence.findMany({
    where: {
      isActive: true,
      nextRunAt: { lte: now },
      OR: [
        { endAt: null },
        { endAt: { gte: now } },
      ],
    },
    take: limit,
    orderBy: { nextRunAt: 'asc' },
  });
}

async function executeRecurrence(recurrenceId: string) {
  const recurrence = await prisma.recurrence.findUnique({
    where: { id: recurrenceId },
  });

  if (!recurrence || !recurrence.isActive) {
    return null;
  }

  // Check if ended
  if (recurrence.endAt && new Date() > recurrence.endAt) {
    await prisma.recurrence.update({
      where: { id: recurrenceId },
      data: { isActive: false },
    });
    return null;
  }

  const template = recurrence.template as TransactionTemplate | null;
  if (!template) {
    throw new Error('Recurrence has no template');
  }

  // Create the transaction
  const transaction = await prisma.transaction.create({
    data: {
      workspaceId: recurrence.workspaceId,
      accountId: template.accountId,
      type: template.type,
      amount: template.amount,
      description: template.description,
      categoryId: template.categoryId ?? null,
      date: recurrence.nextRunAt,
      recurrenceId: recurrence.id,
    },
  });

  // Update next run
  const nextRunAt = calculateNextRun(
    recurrence.nextRunAt,
    recurrence.frequency,
    recurrence.interval
  );

  await prisma.recurrence.update({
    where: { id: recurrenceId },
    data: { nextRunAt },
  });

  return transaction;
}

// ----------------------------------------------------------------------------
// Job Processor
// ----------------------------------------------------------------------------

export async function processRecurrenceJob(
  job: Job<RecurrenceJobData>
): Promise<RecurrenceJobResult> {
  const { type, recurrenceId } = job.data;

  if (type === 'execute_single' && recurrenceId) {
    return processSingleRecurrence(recurrenceId);
  }

  return processDueRecurrences();
}

/**
 * Process all due recurrences
 */
async function processDueRecurrences(): Promise<RecurrenceJobResult> {
  const result: RecurrenceJobResult = {
    processed: 0,
    success: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Get all due recurrences
    const dueRecurrences = await getDueRecurrences(100);
    result.processed = dueRecurrences.length;

    if (dueRecurrences.length === 0) {
      console.log('[RecurrenceJob] No due recurrences to process');
      return result;
    }

    console.log(`[RecurrenceJob] Processing ${dueRecurrences.length} due recurrences`);

    // Process each recurrence
    for (const recurrence of dueRecurrences) {
      try {
        const transaction = await executeRecurrence(recurrence.id);

        if (transaction) {
          result.success++;
          console.log(
            `[RecurrenceJob] Executed recurrence ${recurrence.id}: created transaction ${transaction.id}`
          );
        } else {
          // Recurrence was skipped (inactive or ended)
          console.log(`[RecurrenceJob] Skipped recurrence ${recurrence.id}: inactive or ended`);
        }
      } catch (error) {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors?.push({
          recurrenceId: recurrence.id,
          error: errorMessage,
        });
        console.error(`[RecurrenceJob] Failed to execute recurrence ${recurrence.id}:`, errorMessage);
      }
    }

    console.log(
      `[RecurrenceJob] Completed: ${result.success} success, ${result.failed} failed`
    );
  } catch (error) {
    console.error('[RecurrenceJob] Error processing due recurrences:', error);
    throw error;
  }

  return result;
}

/**
 * Process a single recurrence
 */
async function processSingleRecurrence(recurrenceId: string): Promise<RecurrenceJobResult> {
  const result: RecurrenceJobResult = {
    processed: 1,
    success: 0,
    failed: 0,
  };

  try {
    const transaction = await executeRecurrence(recurrenceId);

    if (transaction) {
      result.success = 1;
      console.log(
        `[RecurrenceJob] Executed recurrence ${recurrenceId}: created transaction ${transaction.id}`
      );
    } else {
      console.log(`[RecurrenceJob] Skipped recurrence ${recurrenceId}: inactive or ended`);
    }
  } catch (error) {
    result.failed = 1;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors = [{ recurrenceId, error: errorMessage }];
    console.error(`[RecurrenceJob] Failed to execute recurrence ${recurrenceId}:`, errorMessage);
  }

  return result;
}

// ----------------------------------------------------------------------------
// Scheduled Job
// ----------------------------------------------------------------------------

/**
 * Schedule recurring transaction processing
 * Runs every hour to check for due recurrences
 */
export const RECURRENCE_CRON = '0 * * * *'; // Every hour at minute 0

export const recurrenceJobConfig = {
  name: 'process-recurrences',
  data: { type: 'process_due' as const },
  opts: {
    repeat: {
      pattern: RECURRENCE_CRON,
    },
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 5000,
    },
  },
};

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------

/**
 * Queue a single recurrence for immediate execution
 */
export function createExecuteRecurrenceJob(recurrenceId: string) {
  return {
    name: 'execute-recurrence',
    data: {
      type: 'execute_single' as const,
      recurrenceId,
    },
    opts: {
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 1000,
      },
    },
  };
}

export default processRecurrenceJob;
