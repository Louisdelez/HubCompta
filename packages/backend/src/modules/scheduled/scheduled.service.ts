// ============================================================================
// SCHEDULED TRANSACTION SERVICE - Finance Hub
// One-time future transactions management
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { TransactionType, Prisma, ScheduledTransaction } from '@prisma/client';
import { startOfDay, isBefore, addDays } from 'date-fns';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface CreateScheduledInput {
  workspaceId: string;
  accountId: string;
  categoryId?: string;
  amount: number;
  currency?: string;
  type: TransactionType;
  description: string;
  scheduledDate: Date;
  notes?: string;
}

export interface UpdateScheduledInput {
  accountId?: string;
  categoryId?: string | null;
  amount?: number;
  currency?: string;
  type?: TransactionType;
  description?: string;
  scheduledDate?: Date;
  notes?: string | null;
}

export interface ScheduledListOptions {
  filter?: 'all' | 'upcoming' | 'executed';
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface ScheduledWithRelations extends ScheduledTransaction {
  account: {
    id: string;
    name: string;
    type: string;
    currency: string;
  };
  category?: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
}

// ----------------------------------------------------------------------------
// Service
// ----------------------------------------------------------------------------

export const scheduledService = {
  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  /**
   * Create a new scheduled transaction
   */
  async create(input: CreateScheduledInput): Promise<ScheduledTransaction> {
    // Verify account belongs to workspace
    const account = await prisma.account.findFirst({
      where: {
        id: input.accountId,
        workspaceId: input.workspaceId,
        deletedAt: null,
      },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    // Verify category if provided
    if (input.categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: input.categoryId,
          workspaceId: input.workspaceId,
        },
      });

      if (!category) {
        throw new Error('Category not found');
      }
    }

    // Verify scheduled date is in the future
    if (isBefore(startOfDay(input.scheduledDate), startOfDay(new Date()))) {
      throw new Error('Scheduled date must be in the future');
    }

    return prisma.scheduledTransaction.create({
      data: {
        workspaceId: input.workspaceId,
        accountId: input.accountId,
        categoryId: input.categoryId,
        amount: input.amount,
        currency: input.currency ?? 'EUR',
        type: input.type,
        description: input.description,
        scheduledDate: startOfDay(input.scheduledDate),
        notes: input.notes,
        isExecuted: false,
      },
    });
  },

  /**
   * Get a scheduled transaction by ID
   */
  async getById(id: string, workspaceId: string): Promise<ScheduledWithRelations | null> {
    const scheduled = await prisma.scheduledTransaction.findFirst({
      where: { id, workspaceId },
      include: {
        account: {
          select: { id: true, name: true, type: true, currency: true },
        },
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
      },
    });

    return scheduled as ScheduledWithRelations | null;
  },

  /**
   * List scheduled transactions for a workspace
   */
  async list(
    workspaceId: string,
    options: ScheduledListOptions = {}
  ): Promise<{ data: ScheduledWithRelations[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }> {
    const { filter = 'all', startDate, endDate, page = 1, pageSize = 20 } = options;

    const where: Prisma.ScheduledTransactionWhereInput = {
      workspaceId,
    };

    // Apply filter
    if (filter === 'upcoming') {
      where.isExecuted = false;
      where.scheduledDate = { gte: startOfDay(new Date()) };
    } else if (filter === 'executed') {
      where.isExecuted = true;
    }

    // Apply date range
    if (startDate || endDate) {
      where.scheduledDate = {
        ...(where.scheduledDate as object || {}),
        ...(startDate && { gte: startOfDay(startDate) }),
        ...(endDate && { lte: startOfDay(endDate) }),
      };
    }

    const [scheduled, total] = await Promise.all([
      prisma.scheduledTransaction.findMany({
        where,
        include: {
          account: {
            select: { id: true, name: true, type: true, currency: true },
          },
          category: {
            select: { id: true, name: true, icon: true, color: true },
          },
        },
        orderBy: [
          { isExecuted: 'asc' },
          { scheduledDate: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.scheduledTransaction.count({ where }),
    ]);

    return {
      data: scheduled as ScheduledWithRelations[],
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Update a scheduled transaction
   */
  async update(
    id: string,
    workspaceId: string,
    input: UpdateScheduledInput
  ): Promise<ScheduledTransaction> {
    const existing = await prisma.scheduledTransaction.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new Error('Scheduled transaction not found');
    }

    if (existing.isExecuted) {
      throw new Error('Cannot update an executed scheduled transaction');
    }

    // Verify account if changing
    if (input.accountId) {
      const account = await prisma.account.findFirst({
        where: {
          id: input.accountId,
          workspaceId,
          deletedAt: null,
        },
      });

      if (!account) {
        throw new Error('Account not found');
      }
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
        throw new Error('Category not found');
      }
    }

    // Verify scheduled date if changing
    if (input.scheduledDate && isBefore(startOfDay(input.scheduledDate), startOfDay(new Date()))) {
      throw new Error('Scheduled date must be in the future');
    }

    return prisma.scheduledTransaction.update({
      where: { id },
      data: {
        ...(input.accountId && { accountId: input.accountId }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.currency && { currency: input.currency }),
        ...(input.type && { type: input.type }),
        ...(input.description && { description: input.description }),
        ...(input.scheduledDate && { scheduledDate: startOfDay(input.scheduledDate) }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });
  },

  /**
   * Delete a scheduled transaction
   */
  async delete(id: string, workspaceId: string): Promise<void> {
    const scheduled = await prisma.scheduledTransaction.findFirst({
      where: { id, workspaceId },
    });

    if (!scheduled) {
      throw new Error('Scheduled transaction not found');
    }

    await prisma.scheduledTransaction.delete({
      where: { id },
    });
  },

  // ==========================================================================
  // Execution
  // ==========================================================================

  /**
   * Execute a scheduled transaction (create real transaction)
   */
  async execute(id: string, workspaceId: string): Promise<{ scheduled: ScheduledTransaction; transaction: { id: string } }> {
    const scheduled = await prisma.scheduledTransaction.findFirst({
      where: { id, workspaceId },
    });

    if (!scheduled) {
      throw new Error('Scheduled transaction not found');
    }

    if (scheduled.isExecuted) {
      throw new Error('Scheduled transaction already executed');
    }

    // Create the transaction and update the scheduled transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the real transaction
      const transaction = await tx.transaction.create({
        data: {
          workspaceId: scheduled.workspaceId,
          accountId: scheduled.accountId,
          type: scheduled.type,
          amount: scheduled.amount,
          currency: scheduled.currency,
          description: scheduled.description,
          categoryId: scheduled.categoryId,
          date: startOfDay(new Date()),
          notes: scheduled.notes,
          status: 'cleared',
        },
      });

      // Update account balance
      const balanceChange = scheduled.type === 'income'
        ? scheduled.amount.toNumber()
        : -scheduled.amount.toNumber();

      await tx.account.update({
        where: { id: scheduled.accountId },
        data: { balance: { increment: balanceChange } },
      });

      // Mark scheduled transaction as executed
      const updated = await tx.scheduledTransaction.update({
        where: { id },
        data: {
          isExecuted: true,
          executedAt: new Date(),
          transactionId: transaction.id,
        },
      });

      return { scheduled: updated, transaction };
    });

    return result;
  },

  /**
   * Get scheduled transactions due for execution
   */
  async getDue(limit = 100): Promise<ScheduledTransaction[]> {
    const today = startOfDay(new Date());

    return prisma.scheduledTransaction.findMany({
      where: {
        isExecuted: false,
        scheduledDate: { lte: today },
      },
      take: limit,
      orderBy: { scheduledDate: 'asc' },
    });
  },

  /**
   * Auto-execute all due scheduled transactions
   */
  async executeAllDue(): Promise<{ executed: number; failed: number; errors: string[] }> {
    const dueScheduled = await this.getDue();

    const result = {
      executed: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const scheduled of dueScheduled) {
      try {
        await this.execute(scheduled.id, scheduled.workspaceId);
        result.executed++;
      } catch (error) {
        result.failed++;
        result.errors.push(
          `Failed to execute ${scheduled.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return result;
  },

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Get upcoming scheduled transactions (next N days)
   */
  async getUpcoming(
    workspaceId: string,
    days = 30,
    limit = 10
  ): Promise<ScheduledWithRelations[]> {
    const today = startOfDay(new Date());
    const endDate = addDays(today, days);

    const scheduled = await prisma.scheduledTransaction.findMany({
      where: {
        workspaceId,
        isExecuted: false,
        scheduledDate: {
          gte: today,
          lte: endDate,
        },
      },
      include: {
        account: {
          select: { id: true, name: true, type: true, currency: true },
        },
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
      },
      orderBy: { scheduledDate: 'asc' },
      take: limit,
    });

    return scheduled as ScheduledWithRelations[];
  },

  /**
   * Get summary of upcoming scheduled transactions
   */
  async getUpcomingSummary(workspaceId: string, days = 30): Promise<{
    totalIncome: number;
    totalExpense: number;
    netFlow: number;
    count: number;
    items: Array<{
      id: string;
      description: string;
      amount: number;
      type: TransactionType;
      scheduledDate: Date;
      daysUntil: number;
    }>;
  }> {
    const today = startOfDay(new Date());
    const endDate = addDays(today, days);

    const scheduled = await prisma.scheduledTransaction.findMany({
      where: {
        workspaceId,
        isExecuted: false,
        scheduledDate: {
          gte: today,
          lte: endDate,
        },
      },
      orderBy: { scheduledDate: 'asc' },
    });

    let totalIncome = 0;
    let totalExpense = 0;

    const items = scheduled.map((s) => {
      const amount = s.amount.toNumber();
      if (s.type === 'income') {
        totalIncome += amount;
      } else if (s.type === 'expense') {
        totalExpense += amount;
      }

      const daysUntil = Math.ceil(
        (s.scheduledDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: s.id,
        description: s.description,
        amount,
        type: s.type,
        scheduledDate: s.scheduledDate,
        daysUntil,
      };
    });

    return {
      totalIncome,
      totalExpense,
      netFlow: totalIncome - totalExpense,
      count: scheduled.length,
      items,
    };
  },

  /**
   * Get count by status
   */
  async getStatusCounts(workspaceId: string): Promise<{
    upcoming: number;
    overdue: number;
    executed: number;
  }> {
    const today = startOfDay(new Date());

    const [upcoming, overdue, executed] = await Promise.all([
      prisma.scheduledTransaction.count({
        where: {
          workspaceId,
          isExecuted: false,
          scheduledDate: { gte: today },
        },
      }),
      prisma.scheduledTransaction.count({
        where: {
          workspaceId,
          isExecuted: false,
          scheduledDate: { lt: today },
        },
      }),
      prisma.scheduledTransaction.count({
        where: {
          workspaceId,
          isExecuted: true,
        },
      }),
    ]);

    return { upcoming, overdue, executed };
  },
};

export default scheduledService;
