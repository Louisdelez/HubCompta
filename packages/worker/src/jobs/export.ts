// ============================================================================
// EXPORT JOB - Finance Hub Worker
// Export data to various formats and store in S3
// ============================================================================

import { prisma } from '../lib/prisma.js';
import { uploadFile } from '../lib/storage.js';
import type { ExportJobData, ExportJobResult } from './types.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface TransactionExportRow {
  date: string;
  description: string;
  amount: number;
  type: string;
  account: string;
  category: string;
}

// ----------------------------------------------------------------------------
// Export Functions
// ----------------------------------------------------------------------------

async function getTransactionsForExport(
  workspaceId: string,
  options: { dateRange?: { from: string; to: string }; accountIds?: string[] }
): Promise<TransactionExportRow[]> {
  const where: Record<string, unknown> = {
    workspaceId,
    deletedAt: null,
  };

  if (options.dateRange) {
    where.date = {
      gte: new Date(options.dateRange.from),
      lte: new Date(options.dateRange.to),
    };
  }

  if (options.accountIds && options.accountIds.length > 0) {
    where.accountId = { in: options.accountIds };
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      account: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  });

  return transactions.map((t) => ({
    date: t.date.toISOString().split('T')[0] ?? '',
    description: t.description,
    amount: Number(t.amount),
    type: t.type,
    account: t.account.name,
    category: t.category?.name ?? '',
  }));
}

function transactionsToCSV(transactions: TransactionExportRow[]): string {
  const headers = ['Date', 'Description', 'Montant', 'Type', 'Compte', 'Catégorie'];
  const rows = transactions.map((t) => [
    t.date,
    `"${t.description.replace(/"/g, '""')}"`,
    t.amount.toFixed(2),
    t.type,
    `"${t.account}"`,
    `"${t.category}"`,
  ]);

  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

// ----------------------------------------------------------------------------
// Job Handler
// ----------------------------------------------------------------------------

export async function handleExportJob(data: ExportJobData): Promise<ExportJobResult> {
  const { exportId, workspaceId, format, dateRange, accountIds } = data;

  console.log(`[Export] Starting export job ${exportId} for workspace ${workspaceId}`);

  // Build options object, only including defined properties
  const options: { dateRange?: { from: string; to: string }; accountIds?: string[] } = {};
  if (dateRange) {
    options.dateRange = dateRange;
  }
  if (accountIds) {
    options.accountIds = accountIds;
  }

  // Get transactions
  const transactions = await getTransactionsForExport(workspaceId, options);

  console.log(`[Export] Found ${transactions.length} transactions to export`);

  // Generate export content
  let content: string;
  let filename: string;
  let mimeType: string;

  if (format === 'csv') {
    content = transactionsToCSV(transactions);
    filename = `export_${exportId}.csv`;
    mimeType = 'text/csv';
  } else {
    // PDF would require a PDF library - for now, default to JSON
    content = JSON.stringify(transactions, null, 2);
    filename = `export_${exportId}.json`;
    mimeType = 'application/json';
  }

  // Upload to storage
  const storageKey = `exports/${workspaceId}/${filename}`;
  const buffer = Buffer.from(content, 'utf-8');

  await uploadFile(storageKey, buffer, mimeType);

  console.log(`[Export] Uploaded to ${storageKey}`);

  // Set expiration (7 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  return {
    storageKey,
    filename,
    size: buffer.length,
    expiresAt: expiresAt.toISOString(),
  };
}

export default handleExportJob;
