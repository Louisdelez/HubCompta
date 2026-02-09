// ============================================================================
// LOAN SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError, ConflictError } from '@/core/middleware/errorHandler.js';
import type { Loan, LoanPayment, LoanType, Prisma } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface LoanCreateInput {
  name: string;
  type: LoanType;
  principalAmount: number;
  interestRate?: number | null;
  currency?: string;
  startDate: Date;
  endDate?: Date | null;
  counterparty?: string | null;
  notes?: string | null;
}

export interface LoanUpdateInput {
  name?: string;
  interestRate?: number | null;
  endDate?: Date | null;
  counterparty?: string | null;
  notes?: string | null;
}

export interface LoanPaymentInput {
  amount: number;
  principal: number;
  interest: number;
  date: Date;
  notes?: string | null;
}

export interface LoanWithPayments extends Omit<Loan, 'principalAmount' | 'currentBalance' | 'interestRate'> {
  principalAmount: number;
  currentBalance: number;
  interestRate: number | null;
  payments: Array<Omit<LoanPayment, 'amount' | 'principal' | 'interest'> & {
    amount: number;
    principal: number;
    interest: number;
  }>;
  paymentCount: number;
  totalPaid: number;
  totalInterestPaid: number;
  progress: number; // 0-100
}

export interface LoanFilters {
  type?: LoanType;
  includeDeleted?: boolean;
}

export interface LoanSummary {
  totalDebt: number;
  totalCredit: number;
  netPosition: number;
  debtCount: number;
  creditCount: number;
  debtByCurrency: Record<string, number>;
  creditByCurrency: Record<string, number>;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function convertDecimalsToNumber(loan: Loan): Omit<LoanWithPayments, 'payments' | 'paymentCount' | 'totalPaid' | 'totalInterestPaid' | 'progress'> {
  return {
    ...loan,
    principalAmount: loan.principalAmount.toNumber(),
    currentBalance: loan.currentBalance.toNumber(),
    interestRate: loan.interestRate?.toNumber() ?? null,
  };
}

function convertPaymentDecimalsToNumber(payment: LoanPayment) {
  return {
    ...payment,
    amount: payment.amount.toNumber(),
    principal: payment.principal.toNumber(),
    interest: payment.interest.toNumber(),
  };
}

// ----------------------------------------------------------------------------
// Loan Service
// ----------------------------------------------------------------------------

export const loanService = {
  /**
   * Create a new loan
   */
  async create(workspaceId: string, input: LoanCreateInput): Promise<LoanWithPayments> {
    // Check for duplicate loan name in workspace
    const existing = await prisma.loan.findFirst({
      where: {
        workspaceId,
        name: input.name,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictError('loan', 'name', input.name);
    }

    const loan = await prisma.loan.create({
      data: {
        workspaceId,
        name: input.name,
        type: input.type,
        principalAmount: input.principalAmount,
        currentBalance: input.principalAmount, // Initially same as principal
        interestRate: input.interestRate,
        currency: input.currency ?? 'EUR',
        startDate: input.startDate,
        endDate: input.endDate,
        counterparty: input.counterparty,
        notes: input.notes,
      },
    });

    return {
      ...convertDecimalsToNumber(loan),
      payments: [],
      paymentCount: 0,
      totalPaid: 0,
      totalInterestPaid: 0,
      progress: 0,
    };
  },

  /**
   * Get loan by ID with payments
   */
  async getById(workspaceId: string, loanId: string): Promise<LoanWithPayments | null> {
    const loan = await prisma.loan.findFirst({
      where: {
        id: loanId,
        workspaceId,
        deletedAt: null,
      },
      include: {
        payments: {
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!loan) return null;

    const payments = loan.payments.map(convertPaymentDecimalsToNumber);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalInterestPaid = payments.reduce((sum, p) => sum + p.interest, 0);
    const principalAmount = loan.principalAmount.toNumber();
    const currentBalance = loan.currentBalance.toNumber();
    const progress = principalAmount > 0
      ? Math.min(100, Math.round(((principalAmount - currentBalance) / principalAmount) * 100))
      : 0;

    return {
      ...convertDecimalsToNumber(loan),
      payments,
      paymentCount: payments.length,
      totalPaid,
      totalInterestPaid,
      progress,
    };
  },

  /**
   * List loans for workspace
   */
  async list(workspaceId: string, filters: LoanFilters = {}): Promise<LoanWithPayments[]> {
    const where: Prisma.LoanWhereInput = {
      workspaceId,
    };

    if (!filters.includeDeleted) {
      where.deletedAt = null;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    const loans = await prisma.loan.findMany({
      where,
      include: {
        payments: {
          orderBy: { date: 'desc' },
        },
      },
      orderBy: [
        { type: 'asc' },
        { name: 'asc' },
      ],
    });

    return loans.map((loan) => {
      const payments = loan.payments.map(convertPaymentDecimalsToNumber);
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const totalInterestPaid = payments.reduce((sum, p) => sum + p.interest, 0);
      const principalAmount = loan.principalAmount.toNumber();
      const currentBalance = loan.currentBalance.toNumber();
      const progress = principalAmount > 0
        ? Math.min(100, Math.round(((principalAmount - currentBalance) / principalAmount) * 100))
        : 0;

      return {
        ...convertDecimalsToNumber(loan),
        payments,
        paymentCount: payments.length,
        totalPaid,
        totalInterestPaid,
        progress,
      };
    });
  },

  /**
   * Update loan
   */
  async update(
    workspaceId: string,
    loanId: string,
    input: LoanUpdateInput
  ): Promise<LoanWithPayments> {
    const loan = await prisma.loan.findFirst({
      where: {
        id: loanId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!loan) {
      throw new NotFoundError('Loan', loanId);
    }

    // Check name uniqueness if changing name
    if (input.name && input.name !== loan.name) {
      const existing = await prisma.loan.findFirst({
        where: {
          workspaceId,
          name: input.name,
          deletedAt: null,
          id: { not: loanId },
        },
      });

      if (existing) {
        throw new ConflictError('loan', 'name', input.name);
      }
    }

    const updated = await prisma.loan.update({
      where: { id: loanId },
      data: input,
      include: {
        payments: {
          orderBy: { date: 'desc' },
        },
      },
    });

    const payments = updated.payments.map(convertPaymentDecimalsToNumber);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalInterestPaid = payments.reduce((sum, p) => sum + p.interest, 0);
    const principalAmount = updated.principalAmount.toNumber();
    const currentBalance = updated.currentBalance.toNumber();
    const progress = principalAmount > 0
      ? Math.min(100, Math.round(((principalAmount - currentBalance) / principalAmount) * 100))
      : 0;

    return {
      ...convertDecimalsToNumber(updated),
      payments,
      paymentCount: payments.length,
      totalPaid,
      totalInterestPaid,
      progress,
    };
  },

  /**
   * Soft delete loan
   */
  async delete(workspaceId: string, loanId: string): Promise<void> {
    const loan = await prisma.loan.findFirst({
      where: {
        id: loanId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!loan) {
      throw new NotFoundError('Loan', loanId);
    }

    await prisma.loan.update({
      where: { id: loanId },
      data: { deletedAt: new Date() },
    });
  },

  /**
   * Add payment to loan
   */
  async addPayment(
    workspaceId: string,
    loanId: string,
    input: LoanPaymentInput
  ): Promise<LoanWithPayments> {
    const loan = await prisma.loan.findFirst({
      where: {
        id: loanId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!loan) {
      throw new NotFoundError('Loan', loanId);
    }

    // Calculate new balance
    const newBalance = loan.currentBalance.toNumber() - input.principal;

    // Create payment and update loan balance in transaction
    await prisma.$transaction([
      prisma.loanPayment.create({
        data: {
          loanId,
          amount: input.amount,
          principal: input.principal,
          interest: input.interest,
          date: input.date,
          notes: input.notes,
        },
      }),
      prisma.loan.update({
        where: { id: loanId },
        data: { currentBalance: Math.max(0, newBalance) },
      }),
    ]);

    // Return updated loan
    return (await this.getById(workspaceId, loanId))!;
  },

  /**
   * Delete a payment (and restore balance)
   */
  async deletePayment(
    workspaceId: string,
    loanId: string,
    paymentId: string
  ): Promise<LoanWithPayments> {
    const loan = await prisma.loan.findFirst({
      where: {
        id: loanId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!loan) {
      throw new NotFoundError('Loan', loanId);
    }

    const payment = await prisma.loanPayment.findFirst({
      where: {
        id: paymentId,
        loanId,
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment', paymentId);
    }

    // Restore balance
    const restoredBalance = loan.currentBalance.toNumber() + payment.principal.toNumber();

    // Delete payment and update balance in transaction
    await prisma.$transaction([
      prisma.loanPayment.delete({
        where: { id: paymentId },
      }),
      prisma.loan.update({
        where: { id: loanId },
        data: { currentBalance: Math.min(loan.principalAmount.toNumber(), restoredBalance) },
      }),
    ]);

    // Return updated loan
    return (await this.getById(workspaceId, loanId))!;
  },

  /**
   * Get summary of all loans
   */
  async getSummary(workspaceId: string): Promise<LoanSummary> {
    const loans = await prisma.loan.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
    });

    let totalDebt = 0;
    let totalCredit = 0;
    let debtCount = 0;
    let creditCount = 0;
    const debtByCurrency: Record<string, number> = {};
    const creditByCurrency: Record<string, number> = {};

    for (const loan of loans) {
      const balance = loan.currentBalance.toNumber();
      const currency = loan.currency;

      if (loan.type === 'debt') {
        totalDebt += balance;
        debtCount++;
        debtByCurrency[currency] = (debtByCurrency[currency] ?? 0) + balance;
      } else {
        totalCredit += balance;
        creditCount++;
        creditByCurrency[currency] = (creditByCurrency[currency] ?? 0) + balance;
      }
    }

    return {
      totalDebt,
      totalCredit,
      netPosition: totalCredit - totalDebt,
      debtCount,
      creditCount,
      debtByCurrency,
      creditByCurrency,
    };
  },
};

export default loanService;
