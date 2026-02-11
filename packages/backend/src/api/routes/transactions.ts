// ============================================================================
// TRANSACTION ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { transactionService, BATCH_MAX_SIZE } from '@/modules/transactions/transaction.service.js';
import type { TransactionCreateInput, BatchUpdateItem } from '@/modules/transactions/transaction.service.js';
import { transferService } from '@/modules/transactions/transfer.service.js';
import { auditService, AUDIT_ACTIONS } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';
import { transactionCreateSchema, transactionUpdateSchema, transferSchema, uuidSchema } from '@finance-hub/shared';
import { z } from 'zod';
import type { TransactionType } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WorkspaceParams {
  workspaceId: string;
}

interface TransactionParams extends WorkspaceParams {
  transactionId: string;
}

interface TransactionQuery {
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  minAmount?: string;
  maxAmount?: string;
  search?: string;
  tagIds?: string;
  isReconciled?: boolean;
  page?: string;
  limit?: string;
  sortBy?: 'date' | 'amount' | 'description';
  sortOrder?: 'asc' | 'desc';
}

// Batch operation schemas
const batchCreateSchema = z.object({
  transactions: z.array(transactionCreateSchema).min(1).max(BATCH_MAX_SIZE),
});

const batchUpdateItemSchema = z.object({
  id: uuidSchema,
  data: transactionUpdateSchema,
});

const batchUpdateSchema = z.object({
  updates: z.array(batchUpdateItemSchema).min(1).max(BATCH_MAX_SIZE),
});

const batchDeleteSchema = z.object({
  transactionIds: z.array(uuidSchema).min(1).max(BATCH_MAX_SIZE),
});

const batchCategorizeSchema = z.object({
  categoryId: uuidSchema.nullable(),
  transactionIds: z.array(uuidSchema).min(1).max(BATCH_MAX_SIZE),
});

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export function transactionRoutes(app: FastifyInstance): void {
  // Apply auth guard and workspace context to all routes
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/transactions - List transactions
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: TransactionQuery }>(
    '/',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const query = request.query;

      const filters = {
        accountId: query.accountId,
        categoryId: query.categoryId,
        type: query.type,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        minAmount: query.minAmount ? parseFloat(query.minAmount) : undefined,
        maxAmount: query.maxAmount ? parseFloat(query.maxAmount) : undefined,
        search: query.search,
        tagIds: query.tagIds ? query.tagIds.split(',') : undefined,
        isReconciled: query.isReconciled,
      };

      const options = {
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 50,
        sortBy: query.sortBy ?? 'date',
        sortOrder: query.sortOrder ?? 'desc',
      };

      const { transactions, total } = await transactionService.list(
        workspaceId,
        filters,
        options
      );

      return reply.send({
        success: true,
        data: {
          transactions,
          meta: {
            page: options.page,
            limit: options.limit,
            total,
            totalPages: Math.ceil(total / options.limit),
          },
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/transactions - Create transaction
  // --------------------------------------------------------------------------
  app.post<{ Params: WorkspaceParams }>(
    '/',
    { preHandler: requirePermission('transaction:create') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const input = transactionCreateSchema.parse(request.body);

      const transaction = await transactionService.create(workspaceId, {
        ...input,
        date: new Date(input.date),
      });

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.TRANSACTION_CREATED,
        entityType: 'transaction',
        entityId: transaction.id,
        changes: {
          amount: transaction.amount.toNumber(),
          description: transaction.description,
        },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: transaction,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/transactions/transfer - Create transfer
  // --------------------------------------------------------------------------
  app.post<{ Params: WorkspaceParams }>(
    '/transfer',
    { preHandler: requirePermission('transaction:create') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const input = transferSchema.parse(request.body);

      const result = await transferService.create(workspaceId, {
        ...input,
        date: new Date(input.date),
      });

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.TRANSFER_CREATED,
        entityType: 'transfer',
        entityId: result.fromTransaction.id,
        changes: {
          amount: input.amount,
          fromAccountId: input.fromAccountId,
          toAccountId: input.toAccountId,
        },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: result,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/transactions/:transactionId - Get transaction
  // --------------------------------------------------------------------------
  app.get<{ Params: TransactionParams }>(
    '/:transactionId',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId, transactionId } = request.params;

      const transaction = await transactionService.getById(workspaceId, transactionId);

      if (!transaction) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Transaction not found' },
        });
      }

      return reply.send({
        success: true,
        data: transaction,
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /workspaces/:workspaceId/transactions/:transactionId - Update transaction
  // --------------------------------------------------------------------------
  app.patch<{ Params: TransactionParams }>(
    '/:transactionId',
    { preHandler: requirePermission('transaction:update') },
    async (request, reply) => {
      const { workspaceId, transactionId } = request.params;
      const input = transactionUpdateSchema.parse(request.body);

      const transaction = await transactionService.update(workspaceId, transactionId, {
        ...input,
        date: input.date ? new Date(input.date) : undefined,
      });

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.TRANSACTION_UPDATED,
        entityType: 'transaction',
        entityId: transactionId,
        changes: input,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: transaction,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/transactions/:transactionId/tags - Add tags
  // --------------------------------------------------------------------------
  app.post<{ Params: TransactionParams }>(
    '/:transactionId/tags',
    { preHandler: requirePermission('transaction:update') },
    async (request, reply) => {
      const { workspaceId, transactionId } = request.params;
      const { tagIds } = request.body as { tagIds: string[] };

      await transactionService.addTags(workspaceId, transactionId, tagIds);

      return reply.send({
        success: true,
        data: { message: 'Tags added' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /workspaces/:workspaceId/transactions/:transactionId/tags - Remove tags
  // --------------------------------------------------------------------------
  app.delete<{ Params: TransactionParams }>(
    '/:transactionId/tags',
    { preHandler: requirePermission('transaction:update') },
    async (request, reply) => {
      const { workspaceId, transactionId } = request.params;
      const { tagIds } = request.body as { tagIds: string[] };

      await transactionService.removeTags(workspaceId, transactionId, tagIds);

      return reply.send({
        success: true,
        data: { message: 'Tags removed' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/transactions/:transactionId/reconcile - Reconcile
  // --------------------------------------------------------------------------
  app.post<{ Params: TransactionParams }>(
    '/:transactionId/reconcile',
    { preHandler: requirePermission('transaction:update') },
    async (request, reply) => {
      const { workspaceId, transactionId } = request.params;

      const transaction = await transactionService.reconcile(workspaceId, transactionId);

      return reply.send({
        success: true,
        data: transaction,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /workspaces/:workspaceId/transactions/:transactionId/reconcile - Unreconcile
  // --------------------------------------------------------------------------
  app.delete<{ Params: TransactionParams }>(
    '/:transactionId/reconcile',
    { preHandler: requirePermission('transaction:update') },
    async (request, reply) => {
      const { workspaceId, transactionId } = request.params;

      const transaction = await transactionService.unreconcile(workspaceId, transactionId);

      return reply.send({
        success: true,
        data: transaction,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /workspaces/:workspaceId/transactions/:transactionId - Delete transaction
  // --------------------------------------------------------------------------
  app.delete<{ Params: TransactionParams }>(
    '/:transactionId',
    { preHandler: requirePermission('transaction:delete') },
    async (request, reply) => {
      const { workspaceId, transactionId } = request.params;

      await transactionService.delete(workspaceId, transactionId);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.TRANSACTION_DELETED,
        entityType: 'transaction',
        entityId: transactionId,
        ipAddress: request.ip,
        severity: 'warning',
      });

      return reply.send({
        success: true,
        data: { message: 'Transaction deleted' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/transactions/bulk-delete - Bulk delete (legacy)
  // --------------------------------------------------------------------------
  app.post<{ Params: WorkspaceParams }>(
    '/bulk-delete',
    { preHandler: requirePermission('transaction:delete') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { transactionIds } = request.body as { transactionIds: string[] };

      const count = await transactionService.bulkDelete(workspaceId, transactionIds);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.TRANSACTION_BULK_DELETED,
        changes: { count, transactionIds },
        ipAddress: request.ip,
        severity: 'warning',
      });

      return reply.send({
        success: true,
        data: { deleted: count },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/transactions/batch - Batch create
  // --------------------------------------------------------------------------
  app.post<{ Params: WorkspaceParams }>(
    '/batch',
    { preHandler: requirePermission('transaction:create') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { transactions } = batchCreateSchema.parse(request.body);

      const transactionsWithDates: TransactionCreateInput[] = transactions.map((t) => ({
        ...t,
        date: new Date(t.date),
      }));

      const result = await transactionService.createMany(workspaceId, transactionsWithDates);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.TRANSACTION_CREATED,
        changes: {
          batchOperation: true,
          total: result.total,
          successCount: result.successCount,
          failedCount: result.failedCount,
        },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: result,
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /workspaces/:workspaceId/transactions/batch - Batch update
  // --------------------------------------------------------------------------
  app.patch<{ Params: WorkspaceParams }>(
    '/batch',
    { preHandler: requirePermission('transaction:update') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { updates } = batchUpdateSchema.parse(request.body);

      const updatesWithDates: BatchUpdateItem[] = updates.map((u) => ({
        id: u.id,
        data: {
          ...u.data,
          date: u.data.date ? new Date(u.data.date) : undefined,
        },
      }));

      const result = await transactionService.updateMany(workspaceId, updatesWithDates);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.TRANSACTION_UPDATED,
        changes: {
          batchOperation: true,
          total: result.total,
          successCount: result.successCount,
          failedCount: result.failedCount,
        },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /workspaces/:workspaceId/transactions/batch - Batch delete
  // --------------------------------------------------------------------------
  app.delete<{ Params: WorkspaceParams }>(
    '/batch',
    { preHandler: requirePermission('transaction:delete') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { transactionIds } = batchDeleteSchema.parse(request.body);

      const result = await transactionService.deleteMany(workspaceId, transactionIds);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.TRANSACTION_BULK_DELETED,
        changes: {
          batchOperation: true,
          total: result.total,
          successCount: result.successCount,
          failedCount: result.failedCount,
          transactionIds: result.success.map((s) => s.id),
        },
        ipAddress: request.ip,
        severity: 'warning',
      });

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/transactions/batch/categorize - Batch categorize
  // --------------------------------------------------------------------------
  app.post<{ Params: WorkspaceParams }>(
    '/batch/categorize',
    { preHandler: requirePermission('transaction:update') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { categoryId, transactionIds } = batchCategorizeSchema.parse(request.body);

      const result = await transactionService.categorizeMany(workspaceId, categoryId, transactionIds);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.TRANSACTION_UPDATED,
        changes: {
          batchOperation: true,
          action: 'categorize',
          categoryId,
          total: result.total,
          successCount: result.successCount,
          failedCount: result.failedCount,
        },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: result,
      });
    }
  );
}

export default transactionRoutes;
