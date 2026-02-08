// ============================================================================
// IMPORT JOB PROCESSOR - Finance Hub Worker
// ============================================================================

import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ImportJobData {
  jobId: string;
  workspaceId: string;
  accountId: string;
  columnMapping: {
    date: string;
    amount: string;
    description: string;
    credit?: string;
    debit?: string;
  };
  dateFormat: string;
  skipDuplicates: boolean;
  applyRules: boolean;
}

interface ImportJobResult {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: number;
}

// ----------------------------------------------------------------------------
// CSV Parser (minimal version for worker)
// ----------------------------------------------------------------------------

function parseCSV(content: string, delimiter = ';'): Array<Record<string, string>> {
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/"/g, ''));

  return lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((v) => v.trim().replace(/"/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
}

function parseAmount(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[€$£\s]/g, '').replace(',', '.');
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : amount;
}

function parseDate(value: string, format: string): Date | null {
  if (!value) return null;
  const v = value.trim();

  try {
    let day: number, month: number, year: number;

    switch (format) {
      case 'DD/MM/YYYY':
        [day, month, year] = v.split('/').map(Number);
        break;
      case 'YYYY-MM-DD':
        [year, month, day] = v.split('-').map(Number);
        break;
      case 'DD-MM-YYYY':
        [day, month, year] = v.split('-').map(Number);
        break;
      default:
        return new Date(v);
    }

    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day);
  } catch {
    return null;
  }
}

function generateHash(date: Date | null, amount: number, description: string): string {
  const crypto = require('crypto');
  const data = `${date?.toISOString().split('T')[0] ?? ''}|${amount}|${description.toLowerCase().trim()}`;
  return crypto.createHash('md5').update(data).digest('hex');
}

// ----------------------------------------------------------------------------
// Processor
// ----------------------------------------------------------------------------

export async function processImportJob(job: Job<ImportJobData>): Promise<ImportJobResult> {
  const { jobId, workspaceId, accountId, columnMapping, dateFormat, skipDuplicates, applyRules } = job.data;

  console.log(`[Import] Starting job ${jobId}`);

  // Get import job
  const importJob = await prisma.importJob.findUnique({
    where: { id: jobId },
  });

  if (!importJob) {
    throw new Error(`Import job ${jobId} not found`);
  }

  if (importJob.status !== 'pending') {
    throw new Error(`Import job ${jobId} already processed`);
  }

  // Update status to processing
  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: 'processing' },
  });

  let imported = 0;
  let skipped = 0;
  let duplicates = 0;
  let errors = 0;

  try {
    // Parse CSV
    const rows = parseCSV(importJob.fileContent);
    const totalRows = rows.length;

    console.log(`[Import] Parsed ${totalRows} rows`);

    // Get existing transaction hashes if checking for duplicates
    const existingHashes = new Set<string>();
    if (skipDuplicates) {
      const existingTransactions = await prisma.transaction.findMany({
        where: {
          workspaceId,
          accountId,
          deletedAt: null,
        },
        select: { importHash: true },
      });

      existingTransactions.forEach((t) => {
        if (t.importHash) existingHashes.add(t.importHash);
      });
    }

    // Get rules if applying
    const rules = applyRules
      ? await prisma.rule.findMany({
          where: { workspaceId, isEnabled: true },
          orderBy: { priority: 'desc' },
        })
      : [];

    // Process rows in batches
    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      for (const row of batch) {
        try {
          // Parse row data
          let amount: number;
          if (columnMapping.credit && columnMapping.debit) {
            const credit = parseAmount(row[columnMapping.credit]);
            const debit = parseAmount(row[columnMapping.debit]);
            amount = credit > 0 ? credit : -debit;
          } else {
            amount = parseAmount(row[columnMapping.amount]);
          }

          const date = parseDate(row[columnMapping.date], dateFormat);
          const description = row[columnMapping.description]?.trim();

          // Validate
          if (!date || !description || amount === 0) {
            skipped++;
            continue;
          }

          // Check for duplicates
          const hash = generateHash(date, amount, description);
          if (skipDuplicates && existingHashes.has(hash)) {
            duplicates++;
            skipped++;
            continue;
          }

          // Apply rules
          let categoryId: string | undefined;
          let appliedRuleId: string | undefined;

          for (const rule of rules) {
            const conditions = rule.conditions as Array<{
              field: string;
              operator: string;
              value: string;
            }>;

            const matches = conditions.every((cond) => {
              if (cond.field === 'description') {
                const desc = description.toLowerCase();
                const val = cond.value.toLowerCase();
                switch (cond.operator) {
                  case 'contains':
                    return desc.includes(val);
                  case 'equals':
                    return desc === val;
                  case 'starts_with':
                    return desc.startsWith(val);
                  case 'ends_with':
                    return desc.endsWith(val);
                  default:
                    return false;
                }
              }
              return false;
            });

            if (matches) {
              const actions = rule.actions as Array<{ type: string; value: string }>;
              for (const action of actions) {
                if (action.type === 'set_category') {
                  categoryId = action.value;
                }
              }
              appliedRuleId = rule.id;
              break;
            }
          }

          // Create transaction
          await prisma.transaction.create({
            data: {
              workspaceId,
              accountId,
              amount,
              type: amount >= 0 ? 'income' : 'expense',
              description,
              date,
              categoryId,
              importHash: hash,
              importJobId: jobId,
              appliedRuleId,
            },
          });

          imported++;
          existingHashes.add(hash);
        } catch (err) {
          console.error(`[Import] Error processing row:`, err);
          errors++;
        }
      }

      // Update progress
      const progress = Math.round(((i + batch.length) / totalRows) * 100);
      await job.updateProgress(progress);

      await prisma.importJob.update({
        where: { id: jobId },
        data: { processedRows: i + batch.length },
      });
    }

    // Mark as completed
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        totalRows,
        processedRows: totalRows,
        importedRows: imported,
        skippedRows: skipped,
        errorRows: errors,
        completedAt: new Date(),
      },
    });

    console.log(`[Import] Job ${jobId} completed: ${imported} imported, ${skipped} skipped, ${errors} errors`);

    return { imported, skipped, duplicates, errors };
  } catch (err) {
    console.error(`[Import] Job ${jobId} failed:`, err);

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      },
    });

    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

export default processImportJob;
