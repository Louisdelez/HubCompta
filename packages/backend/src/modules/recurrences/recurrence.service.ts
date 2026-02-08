// ============================================================================
// RECURRENCE SERVICE - Finance Hub
// Recurring transactions management
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { RecurrenceFreq, Prisma } from '@prisma/client';
import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  setDate,
  setDay,
  startOfDay,
  isBefore,
  isAfter,
} from 'date-fns';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface TransactionTemplate {
  accountId: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  categoryId?: string;
  tags?: string[];
  notes?: string;
  // For transfers
  toAccountId?: string;
}

export interface CreateRecurrenceInput {
  workspaceId: string;
  name: string;
  frequency: RecurrenceFreq;
  interval?: number;
  dayOfMonth?: number;
  dayOfWeek?: number;
  template: TransactionTemplate;
  startAt: Date;
  endAt?: Date;
}

export interface UpdateRecurrenceInput {
  name?: string;
  frequency?: RecurrenceFreq;
  interval?: number;
  dayOfMonth?: number;
  dayOfWeek?: number;
  template?: Partial<TransactionTemplate>;
  endAt?: Date | null;
  isActive?: boolean;
}

export interface RecurrenceWithStats {
  id: string;
  workspaceId: string;
  name: string;
  frequency: RecurrenceFreq;
  interval: number;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  template: TransactionTemplate;
  nextRunAt: Date;
  endAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    transactions: number;
  };
  lastTransaction?: {
    id: string;
    date: Date;
    amount: number;
  } | null;
}

// ----------------------------------------------------------------------------
// Service
// ----------------------------------------------------------------------------

export const recurrenceService = {
  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  /**
   * Create a new recurrence
   */
  async create(input: CreateRecurrenceInput) {
    const nextRunAt = this.calculateNextRun(
      input.startAt,
      input.frequency,
      input.interval ?? 1,
      input.dayOfMonth,
      input.dayOfWeek
    );

    return prisma.recurrence.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        frequency: input.frequency,
        interval: input.interval ?? 1,
        dayOfMonth: input.dayOfMonth,
        dayOfWeek: input.dayOfWeek,
        template: input.template as unknown as Prisma.JsonObject,
        nextRunAt,
        endAt: input.endAt,
        isActive: true,
      },
    });
  },

  /**
   * Get a recurrence by ID
   */
  async getById(id: string, workspaceId: string) {
    return prisma.recurrence.findFirst({
      where: { id, workspaceId },
      include: {
        _count: {
          select: { transactions: true },
        },
        transactions: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });
  },

  /**
   * List all recurrences for a workspace
   */
  async list(
    workspaceId: string,
    options: {
      isActive?: boolean;
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    const { isActive, page = 1, pageSize = 20 } = options;

    const where: Prisma.RecurrenceWhereInput = {
      workspaceId,
      ...(isActive !== undefined && { isActive }),
    };

    const [recurrences, total] = await Promise.all([
      prisma.recurrence.findMany({
        where,
        include: {
          _count: {
            select: { transactions: true },
          },
          transactions: {
            orderBy: { date: 'desc' },
            take: 1,
            select: {
              id: true,
              date: true,
              amount: true,
            },
          },
        },
        orderBy: [{ isActive: 'desc' }, { nextRunAt: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.recurrence.count({ where }),
    ]);

    return {
      data: recurrences.map((r) => ({
        ...r,
        template: r.template as unknown as TransactionTemplate,
        lastTransaction: r.transactions[0] ? {
          id: r.transactions[0].id,
          date: r.transactions[0].date,
          amount: Number(r.transactions[0].amount),
        } : null,
      })),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Update a recurrence
   */
  async update(id: string, workspaceId: string, input: UpdateRecurrenceInput) {
    const existing = await prisma.recurrence.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new Error('Recurrence not found');
    }

    // Merge template if partial update
    let template = existing.template as unknown as TransactionTemplate;
    if (input.template) {
      template = { ...template, ...input.template };
    }

    // Recalculate next run if frequency changed
    let nextRunAt = existing.nextRunAt;
    if (input.frequency || input.interval || input.dayOfMonth !== undefined || input.dayOfWeek !== undefined) {
      nextRunAt = this.calculateNextRun(
        new Date(),
        input.frequency ?? existing.frequency,
        input.interval ?? existing.interval,
        input.dayOfMonth ?? existing.dayOfMonth ?? undefined,
        input.dayOfWeek ?? existing.dayOfWeek ?? undefined
      );
    }

    return prisma.recurrence.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.frequency && { frequency: input.frequency }),
        ...(input.interval && { interval: input.interval }),
        ...(input.dayOfMonth !== undefined && { dayOfMonth: input.dayOfMonth }),
        ...(input.dayOfWeek !== undefined && { dayOfWeek: input.dayOfWeek }),
        template: template as unknown as Prisma.JsonObject,
        nextRunAt,
        ...(input.endAt !== undefined && { endAt: input.endAt }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
  },

  /**
   * Delete a recurrence
   */
  async delete(id: string, workspaceId: string) {
    const recurrence = await prisma.recurrence.findFirst({
      where: { id, workspaceId },
    });

    if (!recurrence) {
      throw new Error('Recurrence not found');
    }

    return prisma.recurrence.delete({
      where: { id },
    });
  },

  /**
   * Pause a recurrence
   */
  async pause(id: string, workspaceId: string) {
    return this.update(id, workspaceId, { isActive: false });
  },

  /**
   * Resume a recurrence
   */
  async resume(id: string, workspaceId: string) {
    const recurrence = await prisma.recurrence.findFirst({
      where: { id, workspaceId },
    });

    if (!recurrence) {
      throw new Error('Recurrence not found');
    }

    // Recalculate next run from now
    const nextRunAt = this.calculateNextRun(
      new Date(),
      recurrence.frequency,
      recurrence.interval,
      recurrence.dayOfMonth ?? undefined,
      recurrence.dayOfWeek ?? undefined
    );

    return prisma.recurrence.update({
      where: { id },
      data: {
        isActive: true,
        nextRunAt,
      },
    });
  },

  // ==========================================================================
  // Execution
  // ==========================================================================

  /**
   * Get recurrences due for execution
   */
  async getDueRecurrences(limit = 100) {
    const now = new Date();

    return prisma.recurrence.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
        OR: [{ endAt: null }, { endAt: { gt: now } }],
      },
      take: limit,
      orderBy: { nextRunAt: 'asc' },
    });
  },

  /**
   * Execute a recurrence (create transaction and update next run)
   */
  async execute(recurrenceId: string) {
    const recurrence = await prisma.recurrence.findUnique({
      where: { id: recurrenceId },
    });

    if (!recurrence || !recurrence.isActive) {
      return null;
    }

    const template = recurrence.template as unknown as TransactionTemplate;
    const now = new Date();

    // Check if recurrence has ended
    if (recurrence.endAt && isAfter(now, recurrence.endAt)) {
      await prisma.recurrence.update({
        where: { id: recurrenceId },
        data: { isActive: false },
      });
      return null;
    }

    // Create the transaction
    const transaction = await prisma.transaction.create({
      data: {
        workspaceId: recurrence.workspaceId,
        accountId: template.accountId,
        type: template.type,
        amount: template.amount,
        description: template.description,
        categoryId: template.categoryId,
        date: startOfDay(now),
        notes: template.notes,
        recurrenceId: recurrence.id,
      },
    });

    // Update account balance
    const balanceChange = template.type === 'income' ? template.amount : -template.amount;
    await prisma.account.update({
      where: { id: template.accountId },
      data: { balance: { increment: balanceChange } },
    });

    // Add tags if any
    if (template.tags && template.tags.length > 0) {
      const tags = await prisma.tag.findMany({
        where: {
          workspaceId: recurrence.workspaceId,
          name: { in: template.tags },
        },
      });

      if (tags.length > 0) {
        await prisma.transactionTag.createMany({
          data: tags.map((tag) => ({
            transactionId: transaction.id,
            tagId: tag.id,
          })),
        });
      }
    }

    // Calculate and update next run
    const nextRunAt = this.calculateNextRun(
      recurrence.nextRunAt,
      recurrence.frequency,
      recurrence.interval,
      recurrence.dayOfMonth ?? undefined,
      recurrence.dayOfWeek ?? undefined
    );

    // Check if next run is after end date
    const shouldDeactivate = recurrence.endAt && isAfter(nextRunAt, recurrence.endAt);

    await prisma.recurrence.update({
      where: { id: recurrenceId },
      data: {
        nextRunAt,
        isActive: !shouldDeactivate,
      },
    });

    return transaction;
  },

  /**
   * Skip the next occurrence
   */
  async skipNext(id: string, workspaceId: string) {
    const recurrence = await prisma.recurrence.findFirst({
      where: { id, workspaceId },
    });

    if (!recurrence) {
      throw new Error('Recurrence not found');
    }

    const nextRunAt = this.calculateNextRun(
      recurrence.nextRunAt,
      recurrence.frequency,
      recurrence.interval,
      recurrence.dayOfMonth ?? undefined,
      recurrence.dayOfWeek ?? undefined
    );

    return prisma.recurrence.update({
      where: { id },
      data: { nextRunAt },
    });
  },

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Calculate the next run date based on frequency
   */
  calculateNextRun(
    fromDate: Date,
    frequency: RecurrenceFreq,
    interval: number,
    dayOfMonth?: number,
    dayOfWeek?: number
  ): Date {
    let nextDate = startOfDay(fromDate);
    const now = startOfDay(new Date());

    // If the date is in the past, start from today
    if (isBefore(nextDate, now)) {
      nextDate = now;
    }

    switch (frequency) {
      case 'daily':
        nextDate = addDays(nextDate, interval);
        break;

      case 'weekly':
        if (dayOfWeek !== undefined) {
          // Set to specific day of week
          nextDate = setDay(nextDate, dayOfWeek, { weekStartsOn: 1 });
          if (isBefore(nextDate, now) || nextDate.getTime() === now.getTime()) {
            nextDate = addWeeks(nextDate, interval);
          }
        } else {
          nextDate = addWeeks(nextDate, interval);
        }
        break;

      case 'monthly':
        if (dayOfMonth !== undefined) {
          // Set to specific day of month
          nextDate = setDate(nextDate, Math.min(dayOfMonth, 28)); // Cap at 28 to avoid issues
          if (isBefore(nextDate, now) || nextDate.getTime() === now.getTime()) {
            nextDate = addMonths(nextDate, interval);
            nextDate = setDate(nextDate, Math.min(dayOfMonth, 28));
          }
        } else {
          nextDate = addMonths(nextDate, interval);
        }
        break;

      case 'yearly':
        nextDate = addYears(nextDate, interval);
        break;
    }

    return nextDate;
  },

  /**
   * Get upcoming occurrences preview
   */
  async getUpcomingOccurrences(
    id: string,
    workspaceId: string,
    count = 5
  ): Promise<Date[]> {
    const recurrence = await prisma.recurrence.findFirst({
      where: { id, workspaceId },
    });

    if (!recurrence) {
      return [];
    }

    const dates: Date[] = [];
    let currentDate = recurrence.nextRunAt;

    for (let i = 0; i < count; i++) {
      if (recurrence.endAt && isAfter(currentDate, recurrence.endAt)) {
        break;
      }

      dates.push(currentDate);

      currentDate = this.calculateNextRun(
        currentDate,
        recurrence.frequency,
        recurrence.interval,
        recurrence.dayOfMonth ?? undefined,
        recurrence.dayOfWeek ?? undefined
      );
    }

    return dates;
  },

  /**
   * Get monthly forecast (sum of recurring transactions for a month)
   */
  async getMonthlyForecast(workspaceId: string, month: Date) {
    const recurrences = await prisma.recurrence.findMany({
      where: {
        workspaceId,
        isActive: true,
      },
    });

    let totalIncome = 0;
    let totalExpense = 0;
    const items: Array<{
      name: string;
      type: 'income' | 'expense';
      amount: number;
      occurrences: number;
    }> = [];

    for (const recurrence of recurrences) {
      const template = recurrence.template as unknown as TransactionTemplate;
      const occurrences = this.countOccurrencesInMonth(recurrence, month);

      if (occurrences > 0) {
        const totalAmount = template.amount * occurrences;

        items.push({
          name: recurrence.name,
          type: template.type,
          amount: totalAmount,
          occurrences,
        });

        if (template.type === 'income') {
          totalIncome += totalAmount;
        } else {
          totalExpense += totalAmount;
        }
      }
    }

    return {
      totalIncome,
      totalExpense,
      netFlow: totalIncome - totalExpense,
      items,
    };
  },

  /**
   * Count occurrences of a recurrence in a given month
   */
  countOccurrencesInMonth(
    recurrence: { frequency: RecurrenceFreq; interval: number; nextRunAt: Date; endAt: Date | null },
    month: Date
  ): number {
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    switch (recurrence.frequency) {
      case 'daily':
        return Math.floor(30 / recurrence.interval);

      case 'weekly':
        return Math.floor(4 / recurrence.interval);

      case 'monthly':
        return recurrence.interval === 1 ? 1 : 0;

      case 'yearly':
        // Check if the yearly recurrence falls in this month
        const nextRun = recurrence.nextRunAt;
        if (nextRun.getMonth() === month.getMonth()) {
          return 1;
        }
        return 0;

      default:
        return 0;
    }
  },
};

export default recurrenceService;
