// ============================================================================
// IMPORT SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError, ValidationError } from '@/core/middleware/errorHandler.js';
import { csvParser, type ColumnMapping, type DetectedFormat } from './csv.parser.js';
import { ruleService } from '@/modules/rules/rule.service.js';
import type { ImportJob } from '@prisma/client';
import crypto from 'crypto';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface ImportPreviewResult {
  totalRows: number;
  validRows: number;
  duplicates: number;
  headers: string[];
  detectedFormat: DetectedFormat | null;
  sampleTransactions: PreviewTransaction[];
  warnings: string[];
}

export interface PreviewTransaction {
  date: string;
  amount: number;
  description: string;
  isDuplicate: boolean;
  suggestedCategory?: { id: string; name: string };
}

export interface ImportExecuteInput {
  accountId: string;
  columnMapping: ColumnMapping;
  dateFormat: string;
  skipDuplicates: boolean;
  applyRules: boolean;
}

export interface ImportResult {
  jobId: string;
  imported: number;
  skipped: number;
  duplicates: number;
  errors: number;
}

// ----------------------------------------------------------------------------
// Import Service
// ----------------------------------------------------------------------------

export const importService = {
  /**
   * Create an import job
   */
  async createJob(
    workspaceId: string,
    accountId: string,
    userId: string,
    fileContent: string,
    fileName: string
  ): Promise<ImportJob> {
    // Verify account belongs to workspace
    const account = await prisma.account.findFirst({
      where: { id: accountId, workspaceId, deletedAt: null },
    });

    if (!account) {
      throw new NotFoundError('Account', accountId);
    }

    return prisma.importJob.create({
      data: {
        workspaceId,
        accountId,
        userId,
        fileName,
        fileContent,
        status: 'pending',
        totalRows: 0,
        processedRows: 0,
        importedRows: 0,
        skippedRows: 0,
        errorRows: 0,
      },
    });
  },

  /**
   * Preview import without executing
   */
  async preview(
    workspaceId: string,
    accountId: string,
    fileContent: string,
    columnMapping?: ColumnMapping
  ): Promise<ImportPreviewResult> {
    // Parse CSV
    const parseResult = csvParser.parse(fileContent);

    if (parseResult.totalRows === 0) {
      throw new ValidationError('CSV file is empty or invalid');
    }

    const format = parseResult.detectedFormat;
    const warnings: string[] = [];

    if (!format) {
      warnings.push('Format non reconnu. Veuillez mapper les colonnes manuellement.');
    }

    // Use provided mapping or detected format
    const mapping: ColumnMapping = columnMapping ?? {
      date: format?.dateColumn ?? '',
      amount: format?.amountColumn ?? '',
      description: format?.descriptionColumn ?? '',
      credit: format?.creditColumn,
      debit: format?.debitColumn,
    };

    // Validate mapping
    if (!mapping.date || !mapping.description) {
      return {
        totalRows: parseResult.totalRows,
        validRows: 0,
        duplicates: 0,
        headers: parseResult.headers,
        detectedFormat: format,
        sampleTransactions: [],
        warnings: [...warnings, 'Mapping de colonnes incomplet'],
      };
    }

    if (!mapping.amount && (!mapping.credit || !mapping.debit)) {
      return {
        totalRows: parseResult.totalRows,
        validRows: 0,
        duplicates: 0,
        headers: parseResult.headers,
        detectedFormat: format,
        sampleTransactions: [],
        warnings: [...warnings, 'Colonne de montant manquante'],
      };
    }

    // Transform and validate rows
    const transformedRows = csvParser.transformRows(
      parseResult.rows,
      mapping,
      format ?? {
        bank: 'Generic',
        dateColumn: mapping.date,
        amountColumn: mapping.amount,
        descriptionColumn: mapping.description,
        dateFormat: 'DD/MM/YYYY',
        amountFormat: 'french',
      }
    );

    const validRows = transformedRows.filter(
      (r) => r.date !== null && r.amount !== 0 && r.description
    );

    // Check for duplicates
    const duplicateHashes = await this.findDuplicates(
      workspaceId,
      accountId,
      validRows.slice(0, 100)
    );

    // Get rule suggestions for sample transactions
    const rules = await ruleService.list(workspaceId);
    const sampleTransactions: PreviewTransaction[] = [];

    for (const row of validRows.slice(0, 10)) {
      const hash = this.generateTransactionHash(row);
      const isDuplicate = duplicateHashes.has(hash);

      // Apply rules to get category suggestion
      let suggestedCategory: { id: string; name: string } | undefined;
      for (const rule of rules) {
        if (ruleService.matchesRule(row.description, row.amount, rule)) {
          const actions = (rule.actions ?? []) as Array<{ type: string; value: string }>;
          const categoryAction = actions.find(
            (a) => a.type === 'set_category'
          );
          if (categoryAction) {
            const category = await prisma.category.findUnique({
              where: { id: categoryAction.value },
              select: { id: true, name: true },
            });
            if (category) {
              suggestedCategory = category;
              break;
            }
          }
        }
      }

      sampleTransactions.push({
        date: row.date?.toISOString() ?? '',
        amount: row.amount,
        description: row.description,
        isDuplicate,
        suggestedCategory,
      });
    }

    const duplicateCount = validRows
      .slice(0, 100)
      .filter((r) => duplicateHashes.has(this.generateTransactionHash(r))).length;

    return {
      totalRows: parseResult.totalRows,
      validRows: validRows.length,
      duplicates: duplicateCount,
      headers: parseResult.headers,
      detectedFormat: format,
      sampleTransactions,
      warnings,
    };
  },

  /**
   * Execute import job
   */
  async execute(
    jobId: string,
    workspaceId: string,
    input: ImportExecuteInput
  ): Promise<ImportResult> {
    const job = await prisma.importJob.findFirst({
      where: { id: jobId, workspaceId },
    });

    if (!job) {
      throw new NotFoundError('ImportJob', jobId);
    }

    if (job.status !== 'pending') {
      throw new ValidationError('Import job already processed');
    }

    // Update job status
    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });

    try {
      // Parse CSV
      const parseResult = csvParser.parse(job.fileContent);
      const format: DetectedFormat = {
        bank: 'Generic',
        dateColumn: input.columnMapping.date,
        amountColumn: input.columnMapping.amount,
        descriptionColumn: input.columnMapping.description,
        dateFormat: input.dateFormat,
        amountFormat: 'french',
        creditColumn: input.columnMapping.credit,
        debitColumn: input.columnMapping.debit,
      };

      // Transform rows
      const transformedRows = csvParser.transformRows(
        parseResult.rows,
        input.columnMapping,
        format
      );

      const validRows = transformedRows.filter(
        (r) => r.date !== null && r.amount !== 0 && r.description
      );

      // Find duplicates if needed
      let duplicateHashes = new Set<string>();
      if (input.skipDuplicates) {
        duplicateHashes = await this.findDuplicates(
          workspaceId,
          input.accountId,
          validRows
        );
      }

      // Get rules if needed
      const rules = input.applyRules ? await ruleService.list(workspaceId) : [];

      let imported = 0;
      let skipped = 0;
      let duplicates = 0;
      let errors = 0;

      // Import transactions in batches
      const batchSize = 100;
      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize);

        for (const row of batch) {
          try {
            const hash = this.generateTransactionHash(row);

            // Skip duplicates
            if (input.skipDuplicates && duplicateHashes.has(hash)) {
              duplicates++;
              skipped++;
              continue;
            }

            // Apply rules
            let categoryId: string | undefined;
            const tags: string[] = [];
            let notes = row.notes;

            for (const rule of rules) {
              if (ruleService.matchesRule(row.description, row.amount, rule)) {
                const actions = (rule.actions ?? []) as Array<{ type: string; value: string }>;
                for (const action of actions) {
                  if (action.type === 'set_category') {
                    categoryId = action.value;
                  } else if (action.type === 'add_tag') {
                    tags.push(action.value);
                  } else if (action.type === 'set_notes') {
                    notes = action.value;
                  }
                }
              }
            }

            // Create transaction
            await prisma.transaction.create({
              data: {
                workspaceId,
                accountId: input.accountId,
                amount: row.amount,
                type: row.amount >= 0 ? 'income' : 'expense',
                description: row.description,
                date: row.date!,
                categoryId,
                notes,
                importHash: hash,
                tags: tags.length > 0 ? {
                  create: tags.map((tagId) => ({ tagId })),
                } : undefined,
              },
            });

            imported++;
          } catch {
            errors++;
          }
        }

        // Update progress
        await prisma.importJob.update({
          where: { id: jobId },
          data: {
            processedRows: Math.min(i + batchSize, validRows.length),
          },
        });
      }

      // Update job as completed
      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          totalRows: parseResult.totalRows,
          processedRows: validRows.length,
          importedRows: imported,
          skippedRows: skipped,
          errorRows: errors,
          completedAt: new Date(),
        },
      });

      return { jobId, imported, skipped, duplicates, errors };
    } catch (err) {
      // Update job as failed
      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      });

      throw err;
    }
  },

  /**
   * Get import job status
   */
  getJob(jobId: string, workspaceId: string): Promise<ImportJob | null> {
    return prisma.importJob.findFirst({
      where: { id: jobId, workspaceId },
    });
  },

  /**
   * List import jobs for workspace
   */
  async listJobs(
    workspaceId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ jobs: ImportJob[]; total: number }> {
    const { page = 1, limit = 20 } = options;

    const [jobs, total] = await Promise.all([
      prisma.importJob.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.importJob.count({ where: { workspaceId } }),
    ]);

    return { jobs, total };
  },

  /**
   * Generate a hash for duplicate detection
   */
  generateTransactionHash(row: {
    date: Date | null;
    amount: number;
    description: string;
  }): string {
    const data = `${row.date?.toISOString().split('T')[0] ?? ''}|${row.amount}|${row.description.toLowerCase().trim()}`;
    return crypto.createHash('md5').update(data).digest('hex');
  },

  /**
   * Find duplicate transactions
   */
  async findDuplicates(
    workspaceId: string,
    accountId: string,
    rows: Array<{ date: Date | null; amount: number; description: string }>
  ): Promise<Set<string>> {
    // Get date range
    const dates = rows.map((r) => r.date).filter((d): d is Date => d !== null);
    if (dates.length === 0) return new Set();

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Add buffer to date range
    minDate.setDate(minDate.getDate() - 1);
    maxDate.setDate(maxDate.getDate() + 1);

    // Get existing transactions in date range
    const existingTransactions = await prisma.transaction.findMany({
      where: {
        workspaceId,
        accountId,
        deletedAt: null,
        date: { gte: minDate, lte: maxDate },
      },
      select: { importHash: true, date: true, amount: true, description: true },
    });

    // Build hash set
    const existingHashes = new Set<string>();

    for (const txn of existingTransactions) {
      if (txn.importHash) {
        existingHashes.add(txn.importHash);
      } else {
        // Generate hash for existing transaction without importHash
        const hash = this.generateTransactionHash({
          date: txn.date,
          amount: txn.amount.toNumber(),
          description: txn.description,
        });
        existingHashes.add(hash);
      }
    }

    return existingHashes;
  },
};

export default importService;
