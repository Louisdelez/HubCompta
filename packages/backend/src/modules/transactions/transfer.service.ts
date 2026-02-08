// ============================================================================
// TRANSFER SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError, ValidationError } from '@/core/middleware/errorHandler.js';
import type { Transaction } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: Date;
  description?: string;
  notes?: string | null;
}

export interface TransferResult {
  fromTransaction: Transaction;
  toTransaction: Transaction;
}

// ----------------------------------------------------------------------------
// Transfer Service
// ----------------------------------------------------------------------------

export const transferService = {
  /**
   * Create a transfer between two accounts
   */
  async create(workspaceId: string, input: TransferInput): Promise<TransferResult> {
    if (input.fromAccountId === input.toAccountId) {
      throw new ValidationError('Cannot transfer to the same account');
    }

    if (input.amount <= 0) {
      throw new ValidationError('Transfer amount must be positive');
    }

    // Verify both accounts belong to workspace
    const [fromAccount, toAccount] = await Promise.all([
      prisma.account.findFirst({
        where: {
          id: input.fromAccountId,
          workspaceId,
          deletedAt: null,
        },
      }),
      prisma.account.findFirst({
        where: {
          id: input.toAccountId,
          workspaceId,
          deletedAt: null,
        },
      }),
    ]);

    if (!fromAccount) {
      throw new NotFoundError('Account', input.fromAccountId);
    }

    if (!toAccount) {
      throw new NotFoundError('Account', input.toAccountId);
    }

    // Create both transactions in a single database transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create outgoing transaction (negative amount)
      const fromTransaction = await tx.transaction.create({
        data: {
          workspaceId,
          accountId: input.fromAccountId,
          amount: -input.amount,
          type: 'transfer',
          description: input.description ?? `Virement vers ${toAccount.name}`,
          date: input.date,
          notes: input.notes,
        },
      });

      // Create incoming transaction (positive amount) and link it to the outgoing one
      const toTransaction = await tx.transaction.create({
        data: {
          workspaceId,
          accountId: input.toAccountId,
          amount: input.amount,
          type: 'transfer',
          description: input.description ?? `Virement depuis ${fromAccount.name}`,
          date: input.date,
          notes: input.notes,
          transferPairId: fromTransaction.id,
        },
      });

      // Link the from transaction to the to transaction
      await tx.transaction.update({
        where: { id: fromTransaction.id },
        data: { transferPairId: toTransaction.id },
      });

      return { fromTransaction, toTransaction };
    });

    return result;
  },

  /**
   * Delete a transfer (both transactions)
   */
  async delete(workspaceId: string, transactionId: string): Promise<void> {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        workspaceId,
        deletedAt: null,
        transferPairId: { not: null },
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transfer', transactionId);
    }

    // Delete both linked transactions
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transactionId },
        data: { deletedAt: new Date() },
      }),
      ...(transaction.transferPairId
        ? [
            prisma.transaction.update({
              where: { id: transaction.transferPairId },
              data: { deletedAt: new Date() },
            }),
          ]
        : []),
    ]);
  },

  /**
   * Update a transfer
   */
  async update(
    workspaceId: string,
    transactionId: string,
    input: Partial<TransferInput>
  ): Promise<TransferResult> {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        workspaceId,
        deletedAt: null,
        transferPairId: { not: null },
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transfer', transactionId);
    }

    const linkedTransaction = transaction.transferPairId
      ? await prisma.transaction.findUnique({
          where: { id: transaction.transferPairId },
        })
      : null;

    if (!linkedTransaction) {
      throw new NotFoundError('Linked transfer', transaction.transferPairId ?? '');
    }

    // Determine which is the outgoing (negative) and incoming (positive)
    const isOutgoing = transaction.amount.toNumber() < 0;
    const fromTxn = isOutgoing ? transaction : linkedTransaction;
    const toTxn = isOutgoing ? linkedTransaction : transaction;

    // Get account names for description if amount/accounts changed
    if (input.fromAccountId) {
      const fromAccount = await prisma.account.findFirst({
        where: { id: input.fromAccountId, workspaceId, deletedAt: null },
      });
      if (!fromAccount) throw new NotFoundError('Account', input.fromAccountId);
    }

    if (input.toAccountId) {
      const toAccount = await prisma.account.findFirst({
        where: { id: input.toAccountId, workspaceId, deletedAt: null },
      });
      if (!toAccount) throw new NotFoundError('Account', input.toAccountId);
    }

    // Update both transactions
    const result = await prisma.$transaction(async (tx) => {
      const updatedFrom = await tx.transaction.update({
        where: { id: fromTxn.id },
        data: {
          ...(input.fromAccountId && { accountId: input.fromAccountId }),
          ...(input.amount && { amount: -input.amount }),
          ...(input.date && { date: input.date }),
          ...(input.description && { description: input.description }),
          ...(input.notes !== undefined && { notes: input.notes }),
        },
      });

      const updatedTo = await tx.transaction.update({
        where: { id: toTxn.id },
        data: {
          ...(input.toAccountId && { accountId: input.toAccountId }),
          ...(input.amount && { amount: input.amount }),
          ...(input.date && { date: input.date }),
          ...(input.description && { description: input.description }),
          ...(input.notes !== undefined && { notes: input.notes }),
        },
      });

      return {
        fromTransaction: updatedFrom,
        toTransaction: updatedTo,
      };
    });

    return result;
  },

  /**
   * Get transfer details
   */
  async getTransfer(
    workspaceId: string,
    transactionId: string
  ): Promise<{ from: Transaction; to: Transaction } | null> {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        workspaceId,
        deletedAt: null,
        transferPairId: { not: null },
      },
    });

    if (!transaction || !transaction.transferPairId) {
      return null;
    }

    const linkedTransaction = await prisma.transaction.findUnique({
      where: { id: transaction.transferPairId },
    });

    if (!linkedTransaction) {
      return null;
    }

    // Determine which is from (negative) and to (positive)
    const isOutgoing = transaction.amount.toNumber() < 0;

    return {
      from: isOutgoing ? transaction : linkedTransaction,
      to: isOutgoing ? linkedTransaction : transaction,
    };
  },
};

export default transferService;
