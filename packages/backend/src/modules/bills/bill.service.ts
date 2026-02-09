// ============================================================================
// BILL SERVICE - Finance Hub
// Bill Pay Reminders management
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { Bill, BillFrequency, Prisma } from '@prisma/client';
import { startOfDay, addDays, addWeeks, addMonths, addYears, isBefore, isAfter, differenceInDays } from 'date-fns';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface CreateBillInput {
  workspaceId: string;
  name: string;
  vendor?: string;
  amount: number;
  currency?: string;
  dueDate: Date;
  frequency?: BillFrequency;
  categoryId?: string;
  reminderDays?: number;
  notes?: string;
}

export interface UpdateBillInput {
  name?: string;
  vendor?: string | null;
  amount?: number;
  currency?: string;
  dueDate?: Date;
  frequency?: BillFrequency;
  categoryId?: string | null;
  reminderDays?: number;
  notes?: string | null;
}

export interface BillListOptions {
  filter?: 'all' | 'unpaid' | 'paid' | 'overdue' | 'upcoming';
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  page?: number;
  pageSize?: number;
}

export interface BillWithRelations extends Bill {
  category?: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  paidTransaction?: {
    id: string;
    description: string;
    date: Date;
  } | null;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function getNextDueDate(currentDueDate: Date, frequency: BillFrequency): Date {
  const date = startOfDay(currentDueDate);
  switch (frequency) {
    case 'weekly':
      return addWeeks(date, 1);
    case 'monthly':
      return addMonths(date, 1);
    case 'yearly':
      return addYears(date, 1);
    default:
      return date;
  }
}

// ----------------------------------------------------------------------------
// Service
// ----------------------------------------------------------------------------

export const billService = {
  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  /**
   * Create a new bill
   */
  async create(input: CreateBillInput): Promise<Bill> {
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

    return prisma.bill.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        vendor: input.vendor,
        amount: input.amount,
        currency: input.currency ?? 'EUR',
        dueDate: startOfDay(input.dueDate),
        frequency: input.frequency ?? 'once',
        categoryId: input.categoryId,
        reminderDays: input.reminderDays ?? 3,
        notes: input.notes,
        isPaid: false,
      },
    });
  },

  /**
   * Get a bill by ID
   */
  async getById(id: string, workspaceId: string): Promise<BillWithRelations | null> {
    const bill = await prisma.bill.findFirst({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
        paidTransaction: {
          select: { id: true, description: true, date: true },
        },
      },
    });

    return bill as BillWithRelations | null;
  },

  /**
   * List bills for a workspace
   */
  async list(
    workspaceId: string,
    options: BillListOptions = {}
  ): Promise<{ data: BillWithRelations[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }> {
    const { filter = 'all', startDate, endDate, categoryId, page = 1, pageSize = 20 } = options;
    const today = startOfDay(new Date());

    const where: Prisma.BillWhereInput = {
      workspaceId,
      deletedAt: null,
    };

    // Apply filter
    switch (filter) {
      case 'unpaid':
        where.isPaid = false;
        break;
      case 'paid':
        where.isPaid = true;
        break;
      case 'overdue':
        where.isPaid = false;
        where.dueDate = { lt: today };
        break;
      case 'upcoming':
        where.isPaid = false;
        where.dueDate = { gte: today };
        break;
    }

    // Apply date range
    if (startDate || endDate) {
      where.dueDate = {
        ...(where.dueDate as object || {}),
        ...(startDate && { gte: startOfDay(startDate) }),
        ...(endDate && { lte: startOfDay(endDate) }),
      };
    }

    // Apply category filter
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true, icon: true, color: true },
          },
          paidTransaction: {
            select: { id: true, description: true, date: true },
          },
        },
        orderBy: [
          { isPaid: 'asc' },
          { dueDate: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.bill.count({ where }),
    ]);

    return {
      data: bills as BillWithRelations[],
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Update a bill
   */
  async update(
    id: string,
    workspaceId: string,
    input: UpdateBillInput
  ): Promise<Bill> {
    const existing = await prisma.bill.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!existing) {
      throw new Error('Bill not found');
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

    return prisma.bill.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.vendor !== undefined && { vendor: input.vendor }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.currency && { currency: input.currency }),
        ...(input.dueDate && { dueDate: startOfDay(input.dueDate) }),
        ...(input.frequency && { frequency: input.frequency }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.reminderDays !== undefined && { reminderDays: input.reminderDays }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });
  },

  /**
   * Soft delete a bill
   */
  async delete(id: string, workspaceId: string): Promise<void> {
    const bill = await prisma.bill.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!bill) {
      throw new Error('Bill not found');
    }

    await prisma.bill.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  // ==========================================================================
  // Bill Payment
  // ==========================================================================

  /**
   * Mark a bill as paid
   */
  async markPaid(
    id: string,
    workspaceId: string,
    transactionId?: string
  ): Promise<Bill> {
    const bill = await prisma.bill.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!bill) {
      throw new Error('Bill not found');
    }

    if (bill.isPaid) {
      throw new Error('Bill is already paid');
    }

    // Verify transaction if provided
    if (transactionId) {
      const transaction = await prisma.transaction.findFirst({
        where: {
          id: transactionId,
          workspaceId,
          deletedAt: null,
        },
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }
    }

    const updatedBill = await prisma.bill.update({
      where: { id },
      data: {
        isPaid: true,
        paidAt: new Date(),
        paidTransactionId: transactionId,
      },
    });

    // If bill is recurring, create the next instance
    if (bill.frequency !== 'once') {
      const nextDueDate = getNextDueDate(bill.dueDate, bill.frequency);

      await prisma.bill.create({
        data: {
          workspaceId: bill.workspaceId,
          name: bill.name,
          vendor: bill.vendor,
          amount: bill.amount,
          currency: bill.currency,
          dueDate: nextDueDate,
          frequency: bill.frequency,
          categoryId: bill.categoryId,
          reminderDays: bill.reminderDays,
          notes: bill.notes,
          isPaid: false,
        },
      });
    }

    return updatedBill;
  },

  /**
   * Mark a bill as unpaid
   */
  async markUnpaid(id: string, workspaceId: string): Promise<Bill> {
    const bill = await prisma.bill.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!bill) {
      throw new Error('Bill not found');
    }

    if (!bill.isPaid) {
      throw new Error('Bill is not paid');
    }

    return prisma.bill.update({
      where: { id },
      data: {
        isPaid: false,
        paidAt: null,
        paidTransactionId: null,
      },
    });
  },

  // ==========================================================================
  // Bill Queries
  // ==========================================================================

  /**
   * Get upcoming bills (due in next N days)
   */
  async getUpcoming(
    workspaceId: string,
    days = 30,
    limit = 10
  ): Promise<BillWithRelations[]> {
    const today = startOfDay(new Date());
    const endDate = addDays(today, days);

    const bills = await prisma.bill.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        isPaid: false,
        dueDate: {
          gte: today,
          lte: endDate,
        },
      },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
        paidTransaction: {
          select: { id: true, description: true, date: true },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: limit,
    });

    return bills as BillWithRelations[];
  },

  /**
   * Get overdue bills
   */
  async getOverdue(workspaceId: string, limit = 50): Promise<BillWithRelations[]> {
    const today = startOfDay(new Date());

    const bills = await prisma.bill.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        isPaid: false,
        dueDate: { lt: today },
      },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
        paidTransaction: {
          select: { id: true, description: true, date: true },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: limit,
    });

    return bills as BillWithRelations[];
  },

  /**
   * Get bills needing reminders
   */
  async getBillsNeedingReminders(): Promise<Array<Bill & { workspaceId: string; daysUntilDue: number }>> {
    const today = startOfDay(new Date());

    // Get all unpaid bills where due date is within reminder window
    const bills = await prisma.bill.findMany({
      where: {
        deletedAt: null,
        isPaid: false,
        dueDate: { gte: today },
      },
    });

    // Filter bills within their reminder window
    return bills
      .map((bill) => {
        const daysUntilDue = differenceInDays(bill.dueDate, today);
        return {
          ...bill,
          daysUntilDue,
        };
      })
      .filter((bill) => bill.daysUntilDue <= bill.reminderDays && bill.daysUntilDue >= 0);
  },

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get bill summary for a workspace
   */
  async getSummary(workspaceId: string): Promise<{
    totalUnpaid: number;
    totalOverdue: number;
    upcomingThisMonth: number;
    overdueCount: number;
    upcomingCount: number;
    paidThisMonth: number;
  }> {
    const today = startOfDay(new Date());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const [
      unpaidBills,
      overdueBills,
      upcomingThisMonth,
      paidThisMonth,
    ] = await Promise.all([
      // Total unpaid amount
      prisma.bill.aggregate({
        where: {
          workspaceId,
          deletedAt: null,
          isPaid: false,
        },
        _sum: { amount: true },
        _count: true,
      }),
      // Total overdue amount
      prisma.bill.aggregate({
        where: {
          workspaceId,
          deletedAt: null,
          isPaid: false,
          dueDate: { lt: today },
        },
        _sum: { amount: true },
        _count: true,
      }),
      // Upcoming this month
      prisma.bill.aggregate({
        where: {
          workspaceId,
          deletedAt: null,
          isPaid: false,
          dueDate: {
            gte: today,
            lte: endOfMonth,
          },
        },
        _sum: { amount: true },
        _count: true,
      }),
      // Paid this month
      prisma.bill.aggregate({
        where: {
          workspaceId,
          deletedAt: null,
          isPaid: true,
          paidAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalUnpaid: unpaidBills._sum.amount?.toNumber() ?? 0,
      totalOverdue: overdueBills._sum.amount?.toNumber() ?? 0,
      upcomingThisMonth: upcomingThisMonth._sum.amount?.toNumber() ?? 0,
      overdueCount: overdueBills._count,
      upcomingCount: upcomingThisMonth._count,
      paidThisMonth: paidThisMonth._sum.amount?.toNumber() ?? 0,
    };
  },

  /**
   * Get bill counts by status
   */
  async getStatusCounts(workspaceId: string): Promise<{
    unpaid: number;
    overdue: number;
    paid: number;
    upcoming: number;
  }> {
    const today = startOfDay(new Date());

    const [unpaid, overdue, paid, upcoming] = await Promise.all([
      prisma.bill.count({
        where: {
          workspaceId,
          deletedAt: null,
          isPaid: false,
        },
      }),
      prisma.bill.count({
        where: {
          workspaceId,
          deletedAt: null,
          isPaid: false,
          dueDate: { lt: today },
        },
      }),
      prisma.bill.count({
        where: {
          workspaceId,
          deletedAt: null,
          isPaid: true,
        },
      }),
      prisma.bill.count({
        where: {
          workspaceId,
          deletedAt: null,
          isPaid: false,
          dueDate: { gte: today },
        },
      }),
    ]);

    return { unpaid, overdue, paid, upcoming };
  },

  /**
   * Get calendar data for bills (for calendar view)
   */
  async getCalendarData(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    id: string;
    name: string;
    vendor: string | null;
    amount: number;
    currency: string;
    dueDate: Date;
    isPaid: boolean;
    isOverdue: boolean;
    category?: { name: string; color: string | null } | null;
  }>> {
    const today = startOfDay(new Date());

    const bills = await prisma.bill.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        dueDate: {
          gte: startOfDay(startDate),
          lte: startOfDay(endDate),
        },
      },
      include: {
        category: {
          select: { name: true, color: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    return bills.map((bill) => ({
      id: bill.id,
      name: bill.name,
      vendor: bill.vendor,
      amount: bill.amount.toNumber(),
      currency: bill.currency,
      dueDate: bill.dueDate,
      isPaid: bill.isPaid,
      isOverdue: !bill.isPaid && isBefore(bill.dueDate, today),
      category: bill.category,
    }));
  },
};

export default billService;
