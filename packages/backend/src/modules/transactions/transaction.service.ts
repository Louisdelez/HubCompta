// ============================================================================
// TRANSACTION SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError, ValidationError } from '@/core/middleware/errorHandler.js';
import type { Transaction, TransactionType, Prisma } from '@prisma/client';

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

export const BATCH_MAX_SIZE = 100;

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface BatchResult<T> {
  success: T[];
  failed: { index: number; error: string }[];
  total: number;
  successCount: number;
  failedCount: number;
}

export interface BatchUpdateItem {
  id: string;
  data: TransactionUpdateInput;
}

export interface TransactionCreateInput {
  accountId: string;
  amount: number;
  type: TransactionType;
  description: string;
  date: Date;
  categoryId?: string | null;
  payee?: string | null;
  reference?: string | null;
  notes?: string | null;
  tags?: string[];
  isReconciled?: boolean;
}

export interface TransactionUpdateInput {
  amount?: number;
  type?: TransactionType;
  description?: string;
  date?: Date;
  categoryId?: string | null;
  payee?: string | null;
  reference?: string | null;
  notes?: string | null;
  isReconciled?: boolean;
}

export interface TransactionWithRelations extends Transaction {
  category?: { id: string; name: string; icon: string | null; color: string | null } | null;
  tags: { id: string; name: string; color: string | null }[];
  account: { id: string; name: string; type: string; currency: string };
  linkedDocuments: { id: string; filename: string }[];
}

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  tagIds?: string[];
  isTransfer?: boolean;
}

export interface TransactionListOptions {
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'amount' | 'description';
  sortOrder?: 'asc' | 'desc';
}

// ----------------------------------------------------------------------------
// Transaction Service
// ----------------------------------------------------------------------------

export const transactionService = {
  /**
   * Create a new transaction
   */
  async create(
    workspaceId: string,
    input: TransactionCreateInput
  ): Promise<Transaction> {
    // Verify account belongs to workspace
    const account = await prisma.account.findFirst({
      where: {
        id: input.accountId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!account) {
      throw new NotFoundError('Account', input.accountId);
    }

    // Verify category if provided
    if (input.categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: input.categoryId,
          workspaceId,
        },
      });

      if (!category) {
        throw new NotFoundError('Category', input.categoryId);
      }
    }

    // Create transaction with tags
    const transaction = await prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.create({
        data: {
          workspaceId,
          accountId: input.accountId,
          amount: input.amount,
          type: input.type,
          description: input.description,
          date: input.date,
          categoryId: input.categoryId,
          notes: input.notes,
        },
      });

      // Add tags if provided
      if (input.tags && input.tags.length > 0) {
        for (const tagId of input.tags) {
          await tx.transactionTag.create({
            data: {
              transactionId: txn.id,
              tagId,
            },
          });
        }
      }

      return txn;
    });

    return transaction;
  },

  /**
   * Get transaction by ID with relations
   */
  async getById(
    workspaceId: string,
    transactionId: string
  ): Promise<TransactionWithRelations | null> {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        workspaceId,
        deletedAt: null,
      },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
        tags: {
          include: {
            tag: {
              select: { id: true, name: true, color: true },
            },
          },
        },
        account: {
          select: { id: true, name: true, type: true, currency: true },
        },
        documentLinks: {
          include: {
            document: {
              select: { id: true, filename: true },
            },
          },
        },
      },
    });

    if (!transaction) return null;

    return {
      ...transaction,
      tags: transaction.tags.map((t) => t.tag),
      linkedDocuments: transaction.documentLinks.map((dl) => dl.document),
    };
  },

  /**
   * List transactions with filters and pagination
   */
  async list(
    workspaceId: string,
    filters: TransactionFilters = {},
    options: TransactionListOptions = {}
  ): Promise<{ transactions: TransactionWithRelations[]; total: number }> {
    const { page = 1, limit = 50, sortBy = 'date', sortOrder = 'desc' } = options;

    const where: Prisma.TransactionWhereInput = {
      workspaceId,
      deletedAt: null,
    };

    // Apply filters
    if (filters.accountId) {
      where.accountId = filters.accountId;
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = filters.startDate;
      if (filters.endDate) where.date.lte = filters.endDate;
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.amount = {};
      if (filters.minAmount !== undefined) where.amount.gte = filters.minAmount;
      if (filters.maxAmount !== undefined) where.amount.lte = filters.maxAmount;
    }

    if (filters.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.tagIds && filters.tagIds.length > 0) {
      where.tags = {
        some: {
          tagId: { in: filters.tagIds },
        },
      };
    }

    if (filters.isTransfer !== undefined) {
      if (filters.isTransfer) {
        where.transferPairId = { not: null };
      } else {
        where.transferPairId = null;
      }
    }

    // Get total count
    const total = await prisma.transaction.count({ where });

    // Get transactions
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
        tags: {
          include: {
            tag: {
              select: { id: true, name: true, color: true },
            },
          },
        },
        account: {
          select: { id: true, name: true, type: true, currency: true },
        },
        documentLinks: {
          include: {
            document: {
              select: { id: true, filename: true },
            },
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      transactions: transactions.map((t) => ({
        ...t,
        tags: t.tags.map((tt) => tt.tag),
        linkedDocuments: t.documentLinks.map((dl) => dl.document),
      })),
      total,
    };
  },

  /**
   * Update transaction
   */
  async update(
    workspaceId: string,
    transactionId: string,
    input: TransactionUpdateInput
  ): Promise<Transaction> {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction', transactionId);
    }

    // Verify category if changing
    if (input.categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: input.categoryId,
          workspaceId,
        },
      });

      if (!category) {
        throw new NotFoundError('Category', input.categoryId);
      }
    }

    return prisma.transaction.update({
      where: { id: transactionId },
      data: input,
    });
  },

  /**
   * Add tags to transaction
   */
  async addTags(
    workspaceId: string,
    transactionId: string,
    tagIds: string[]
  ): Promise<void> {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction', transactionId);
    }

    for (const tagId of tagIds) {
      await prisma.transactionTag.upsert({
        where: {
          transactionId_tagId: { transactionId, tagId },
        },
        create: { transactionId, tagId },
        update: {},
      });
    }
  },

  /**
   * Remove tags from transaction
   */
  async removeTags(
    workspaceId: string,
    transactionId: string,
    tagIds: string[]
  ): Promise<void> {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction', transactionId);
    }

    await prisma.transactionTag.deleteMany({
      where: {
        transactionId,
        tagId: { in: tagIds },
      },
    });
  },

  /**
   * Mark transaction as reconciled
   */
  async reconcile(workspaceId: string, transactionId: string): Promise<Transaction> {
    return this.update(workspaceId, transactionId, { isReconciled: true });
  },

  /**
   * Unmark transaction as reconciled
   */
  async unreconcile(workspaceId: string, transactionId: string): Promise<Transaction> {
    return this.update(workspaceId, transactionId, { isReconciled: false });
  },

  /**
   * Soft delete transaction
   */
  async delete(workspaceId: string, transactionId: string): Promise<void> {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction', transactionId);
    }

    // If it's a transfer, delete the linked transaction too
    if (transaction.transferPairId) {
      await prisma.transaction.update({
        where: { id: transaction.transferPairId },
        data: { deletedAt: new Date() },
      });
    }

    await prisma.transaction.update({
      where: { id: transactionId },
      data: { deletedAt: new Date() },
    });
  },

  /**
   * Bulk delete transactions
   */
  async bulkDelete(workspaceId: string, transactionIds: string[]): Promise<number> {
    const result = await prisma.transaction.updateMany({
      where: {
        id: { in: transactionIds },
        workspaceId,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });

    return result.count;
  },

  /**
   * Get spending by category for a period
   */
  async getSpendingByCategory(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ categoryId: string | null; categoryName: string; total: number }[]> {
    const transactions = await prisma.transaction.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        date: { gte: startDate, lte: endDate },
        amount: { lt: 0 },
        transferPairId: null,
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    const categoryTotals: Record<string, { name: string; total: number }> = {};

    for (const txn of transactions) {
      const key = txn.categoryId ?? 'uncategorized';
      const name = txn.category?.name ?? 'Non catégorisé';

      if (!categoryTotals[key]) {
        categoryTotals[key] = { name, total: 0 };
      }

      categoryTotals[key].total += Math.abs(txn.amount.toNumber());
    }

    return Object.entries(categoryTotals)
      .map(([categoryId, { name, total }]) => ({
        categoryId: categoryId === 'uncategorized' ? null : categoryId,
        categoryName: name,
        total,
      }))
      .sort((a, b) => b.total - a.total);
  },

  /**
   * Create multiple transactions in batch
   */
  async createMany(
    workspaceId: string,
    transactions: TransactionCreateInput[]
  ): Promise<BatchResult<Transaction>> {
    if (transactions.length > BATCH_MAX_SIZE) {
      throw new ValidationError(`Batch size exceeds maximum of ${BATCH_MAX_SIZE} items`);
    }

    const results: BatchResult<Transaction> = {
      success: [],
      failed: [],
      total: transactions.length,
      successCount: 0,
      failedCount: 0,
    };

    // Validate all accounts and categories upfront
    const accountIds = [...new Set(transactions.map((t) => t.accountId))];
    const categoryIds = [...new Set(transactions.map((t) => t.categoryId).filter(Boolean) as string[])];

    const accounts = await prisma.account.findMany({
      where: {
        id: { in: accountIds },
        workspaceId,
        deletedAt: null,
      },
      select: { id: true },
    });
    const validAccountIds = new Set(accounts.map((a) => a.id));

    let validCategoryIds = new Set<string>();
    if (categoryIds.length > 0) {
      const categories = await prisma.category.findMany({
        where: {
          id: { in: categoryIds },
          workspaceId,
        },
        select: { id: true },
      });
      validCategoryIds = new Set(categories.map((c) => c.id));
    }

    // Process each transaction
    for (const [index, input] of transactions.entries()) {
      // Validate account
      if (!validAccountIds.has(input.accountId)) {
        results.failed.push({ index, error: `Invalid account ID: ${input.accountId}` });
        results.failedCount++;
        continue;
      }

      // Validate category if provided
      if (input.categoryId && !validCategoryIds.has(input.categoryId)) {
        results.failed.push({ index, error: `Invalid category ID: ${input.categoryId}` });
        results.failedCount++;
        continue;
      }

      try {
        const transaction = await prisma.$transaction(async (tx) => {
          const txn = await tx.transaction.create({
            data: {
              workspaceId,
              accountId: input.accountId,
              amount: input.amount,
              type: input.type,
              description: input.description,
              date: input.date,
              categoryId: input.categoryId,
              notes: input.notes,
            },
          });

          // Add tags if provided
          if (input.tags && input.tags.length > 0) {
            for (const tagId of input.tags) {
              await tx.transactionTag.create({
                data: {
                  transactionId: txn.id,
                  tagId,
                },
              });
            }
          }

          return txn;
        });

        results.success.push(transaction);
        results.successCount++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({ index, error: message });
        results.failedCount++;
      }
    }

    return results;
  },

  /**
   * Update multiple transactions in batch
   */
  async updateMany(
    workspaceId: string,
    updates: BatchUpdateItem[]
  ): Promise<BatchResult<Transaction>> {
    if (updates.length > BATCH_MAX_SIZE) {
      throw new ValidationError(`Batch size exceeds maximum of ${BATCH_MAX_SIZE} items`);
    }

    const results: BatchResult<Transaction> = {
      success: [],
      failed: [],
      total: updates.length,
      successCount: 0,
      failedCount: 0,
    };

    // Validate all transactions exist upfront
    const transactionIds = updates.map((u) => u.id);
    const existingTransactions = await prisma.transaction.findMany({
      where: {
        id: { in: transactionIds },
        workspaceId,
        deletedAt: null,
      },
      select: { id: true },
    });
    const validTransactionIds = new Set(existingTransactions.map((t) => t.id));

    // Validate categories if provided
    const categoryIds = [...new Set(
      updates
        .map((u) => u.data.categoryId)
        .filter((id): id is string => id !== undefined && id !== null)
    )];

    let validCategoryIds = new Set<string>();
    if (categoryIds.length > 0) {
      const categories = await prisma.category.findMany({
        where: {
          id: { in: categoryIds },
          workspaceId,
        },
        select: { id: true },
      });
      validCategoryIds = new Set(categories.map((c) => c.id));
    }

    // Process each update
    for (const [index, update] of updates.entries()) {
      const { id, data } = update;

      // Validate transaction exists
      if (!validTransactionIds.has(id)) {
        results.failed.push({ index, error: `Transaction not found: ${id}` });
        results.failedCount++;
        continue;
      }

      // Validate category if provided
      if (data.categoryId && !validCategoryIds.has(data.categoryId)) {
        results.failed.push({ index, error: `Invalid category ID: ${data.categoryId}` });
        results.failedCount++;
        continue;
      }

      try {
        const transaction = await prisma.transaction.update({
          where: { id },
          data,
        });

        results.success.push(transaction);
        results.successCount++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({ index, error: message });
        results.failedCount++;
      }
    }

    return results;
  },

  /**
   * Delete multiple transactions in batch with detailed results
   */
  async deleteMany(
    workspaceId: string,
    transactionIds: string[]
  ): Promise<BatchResult<{ id: string }>> {
    if (transactionIds.length > BATCH_MAX_SIZE) {
      throw new ValidationError(`Batch size exceeds maximum of ${BATCH_MAX_SIZE} items`);
    }

    const results: BatchResult<{ id: string }> = {
      success: [],
      failed: [],
      total: transactionIds.length,
      successCount: 0,
      failedCount: 0,
    };

    // Get existing transactions
    const existingTransactions = await prisma.transaction.findMany({
      where: {
        id: { in: transactionIds },
        workspaceId,
        deletedAt: null,
      },
      select: { id: true, transferPairId: true },
    });

    const existingMap = new Map(existingTransactions.map((t) => [t.id, t]));

    for (const [index, id] of transactionIds.entries()) {
      const transaction = existingMap.get(id);

      if (!transaction) {
        results.failed.push({ index, error: `Transaction not found: ${id}` });
        results.failedCount++;
        continue;
      }

      try {
        // If it's a transfer, delete the linked transaction too
        if (transaction.transferPairId) {
          await prisma.transaction.update({
            where: { id: transaction.transferPairId },
            data: { deletedAt: new Date() },
          });
        }

        await prisma.transaction.update({
          where: { id },
          data: { deletedAt: new Date() },
        });

        results.success.push({ id });
        results.successCount++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({ index, error: message });
        results.failedCount++;
      }
    }

    return results;
  },

  /**
   * Categorize multiple transactions at once
   */
  async categorizeMany(
    workspaceId: string,
    categoryId: string | null,
    transactionIds: string[]
  ): Promise<BatchResult<Transaction>> {
    if (transactionIds.length > BATCH_MAX_SIZE) {
      throw new ValidationError(`Batch size exceeds maximum of ${BATCH_MAX_SIZE} items`);
    }

    const results: BatchResult<Transaction> = {
      success: [],
      failed: [],
      total: transactionIds.length,
      successCount: 0,
      failedCount: 0,
    };

    // Validate category if provided
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          workspaceId,
        },
      });

      if (!category) {
        throw new NotFoundError('Category', categoryId);
      }
    }

    // Get existing transactions
    const existingTransactions = await prisma.transaction.findMany({
      where: {
        id: { in: transactionIds },
        workspaceId,
        deletedAt: null,
      },
      select: { id: true },
    });

    const validTransactionIds = new Set(existingTransactions.map((t) => t.id));

    for (const [index, id] of transactionIds.entries()) {
      if (!validTransactionIds.has(id)) {
        results.failed.push({ index, error: `Transaction not found: ${id}` });
        results.failedCount++;
        continue;
      }

      try {
        const transaction = await prisma.transaction.update({
          where: { id },
          data: { categoryId },
        });

        results.success.push(transaction);
        results.successCount++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({ index, error: message });
        results.failedCount++;
      }
    }

    return results;
  },
};

export default transactionService;
