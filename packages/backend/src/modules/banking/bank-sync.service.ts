// ============================================================================
// BANK SYNC SERVICE - Finance Hub
// Transaction synchronization and duplicate detection
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { logger } from '@/core/middleware/logger.js';
import { createHash } from 'crypto';
import type { BankTransaction } from './providers/provider.interface.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface TransactionMatch {
  bankTransaction: BankTransaction;
  existingTransactionId: string | null;
  matchType: 'exact_hash' | 'probable_duplicate' | 'new';
  confidence: number;
}

export interface SyncStats {
  total: number;
  imported: number;
  duplicates: number;
  errors: number;
}

// ----------------------------------------------------------------------------
// Hash Generation
// ----------------------------------------------------------------------------

/**
 * Generate a unique hash for a bank transaction to detect duplicates.
 * Uses a combination of stable fields that won't change across syncs.
 */
export function generateTransactionHash(tx: BankTransaction): string {
  // Combine stable fields for hash
  const hashInput = [
    tx.accountId,
    tx.id, // Provider's transaction ID
    tx.amount.toFixed(2),
    tx.currency,
    tx.date.toISOString().split('T')[0], // Date only, no time
    tx.reference ?? '',
  ].join('|');

  return createHash('sha256').update(hashInput).digest('hex').substring(0, 32);
}

/**
 * Generate a fuzzy hash for probable duplicate detection.
 * Used when exact hash doesn't match but transaction looks similar.
 */
export function generateFuzzyHash(tx: BankTransaction): string {
  const hashInput = [
    tx.amount.toFixed(2),
    tx.currency,
    tx.date.toISOString().split('T')[0],
    normalizeDescription(tx.description),
  ].join('|');

  return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
}

/**
 * Normalize transaction description for comparison.
 * Removes common variations like extra spaces, case differences, etc.
 */
function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim()
    .substring(0, 50);
}

// ----------------------------------------------------------------------------
// Bank Sync Service
// ----------------------------------------------------------------------------

export const bankSyncService = {
  /**
   * Match incoming bank transactions against existing ones.
   * Returns matched transactions with their status.
   */
  async matchTransactions(
    workspaceId: string,
    accountId: string,
    bankTransactions: BankTransaction[]
  ): Promise<TransactionMatch[]> {
    const results: TransactionMatch[] = [];

    // Get existing transaction hashes for this account
    const existingTransactions = await prisma.transaction.findMany({
      where: {
        workspaceId,
        accountId,
        importHash: { not: null },
      },
      select: {
        id: true,
        importHash: true,
        amount: true,
        date: true,
        description: true,
      },
    });

    // Create hash maps for quick lookup
    const exactHashMap = new Map<string, string>();
    const fuzzyHashMap = new Map<string, { id: string; amount: number; date: Date; description: string }>();

    for (const tx of existingTransactions) {
      if (tx.importHash) {
        exactHashMap.set(tx.importHash, tx.id);
      }
      // Build fuzzy hash from existing transaction data
      const fuzzyKey = [
        (tx.amount as unknown as { toNumber?: () => number }).toNumber?.() ?? tx.amount,
        tx.date.toISOString().split('T')[0],
        normalizeDescription(tx.description ?? ''),
      ].join('|').substring(0, 30);
      fuzzyHashMap.set(fuzzyKey, {
        id: tx.id,
        amount: (tx.amount as unknown as { toNumber?: () => number }).toNumber?.() ?? Number(tx.amount),
        date: tx.date,
        description: tx.description ?? '',
      });
    }

    // Match each bank transaction
    for (const bankTx of bankTransactions) {
      const exactHash = `bank_${bankTx.accountId}_${bankTx.id}`;

      // Check for exact hash match
      if (exactHashMap.has(exactHash)) {
        results.push({
          bankTransaction: bankTx,
          existingTransactionId: exactHashMap.get(exactHash)!,
          matchType: 'exact_hash',
          confidence: 1.0,
        });
        continue;
      }

      // Check for fuzzy match (same amount, date, similar description)
      const fuzzyKey = [
        bankTx.amount.toFixed(2),
        bankTx.date.toISOString().split('T')[0],
        normalizeDescription(bankTx.description),
      ].join('|').substring(0, 30);

      const fuzzyMatch = fuzzyHashMap.get(fuzzyKey);
      if (fuzzyMatch) {
        results.push({
          bankTransaction: bankTx,
          existingTransactionId: fuzzyMatch.id,
          matchType: 'probable_duplicate',
          confidence: 0.9,
        });
        continue;
      }

      // No match found - new transaction
      results.push({
        bankTransaction: bankTx,
        existingTransactionId: null,
        matchType: 'new',
        confidence: 1.0,
      });
    }

    return results;
  },

  /**
   * Sync transactions from bank, avoiding duplicates.
   */
  async syncAccount(
    workspaceId: string,
    linkedAccountId: string,
    bankAccountId: string,
    transactions: BankTransaction[]
  ): Promise<SyncStats> {
    const stats: SyncStats = {
      total: transactions.length,
      imported: 0,
      duplicates: 0,
      errors: 0,
    };

    logger.info(
      { workspaceId, bankAccountId, transactionCount: transactions.length },
      'Starting bank account sync'
    );

    // Match transactions
    const matches = await this.matchTransactions(
      workspaceId,
      linkedAccountId,
      transactions
    );

    // Process each transaction
    for (const match of matches) {
      if (match.matchType === 'exact_hash' || match.matchType === 'probable_duplicate') {
        stats.duplicates++;
        continue;
      }

      try {
        const tx = match.bankTransaction;
        const importHash = `bank_${tx.accountId}_${tx.id}`;

        // Store bank-specific info in notes as JSON
        const bankInfo = JSON.stringify({
          bankAccountId,
          bankTransactionId: tx.id,
          merchantName: tx.merchantName,
          bookingDate: tx.bookingDate?.toISOString(),
          importedAt: new Date().toISOString(),
        });

        await prisma.transaction.create({
          data: {
            workspaceId,
            accountId: linkedAccountId,
            type: tx.amount < 0 ? 'expense' : 'income',
            amount: tx.amount,
            currency: tx.currency,
            date: tx.date,
            description: tx.description,
            notes: bankInfo,
            status: 'cleared',
            importHash,
          },
        });

        stats.imported++;
      } catch (error) {
        logger.error(
          { error, transactionId: match.bankTransaction.id },
          'Failed to import bank transaction'
        );
        stats.errors++;
      }
    }

    logger.info(
      { workspaceId, bankAccountId, stats },
      'Bank account sync completed'
    );

    return stats;
  },

  /**
   * Check if a specific transaction already exists.
   */
  async transactionExists(
    workspaceId: string,
    accountId: string,
    bankTransaction: BankTransaction
  ): Promise<boolean> {
    const importHash = `bank_${bankTransaction.accountId}_${bankTransaction.id}`;

    const existing = await prisma.transaction.findFirst({
      where: {
        workspaceId,
        accountId,
        importHash,
      },
    });

    return !!existing;
  },

  /**
   * Get sync history for a bank account.
   */
  async getSyncHistory(
    workspaceId: string,
    connectionId: string,
    limit: number = 10
  ) {
    const connection = await prisma.bankConnection.findFirst({
      where: { id: connectionId, workspaceId },
      include: {
        bankAccounts: {
          select: {
            id: true,
            name: true,
            lastSyncAt: true,
          },
        },
      },
    });

    if (!connection) {
      return null;
    }

    // Get recent imported transactions
    const recentImports = await prisma.transaction.findMany({
      where: {
        workspaceId,
        importHash: { startsWith: 'bank_' },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        createdAt: true,
      },
    });

    return {
      connection: {
        id: connection.id,
        institutionName: connection.institutionName,
        lastSyncAt: connection.lastSyncAt,
        status: connection.status,
      },
      accounts: connection.bankAccounts,
      recentImports,
    };
  },
};

export default bankSyncService;
