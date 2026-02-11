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

export interface ExtraPaymentSimulation {
  newEndDate: Date;
  originalEndDate: Date;
  interestSaved: number;
  monthsReduced: number;
  newTotalInterest: number;
  originalTotalInterest: number;
  newMonthlyPayment: number;
}

export interface AmortizationRow {
  month: number;
  date: Date;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
  cumulativeInterest: number;
  cumulativePrincipal: number;
}

export interface DebtSummary {
  totalDebt: number;
  totalMonthlyPayment: number;
  projectedDebtFreeDate: Date | null;
  debtsByType: {
    loanId: string;
    name: string;
    balance: number;
    monthlyPayment: number;
    interestRate: number;
    projectedEndDate: Date | null;
  }[];
  totalInterestRemaining: number;
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

// ----------------------------------------------------------------------------
// Calculation Helpers
// ----------------------------------------------------------------------------

/**
 * Calculate monthly payment for a loan using the standard amortization formula
 */
function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (annualRate === 0) {
    return principal / termMonths;
  }
  const monthlyRate = annualRate / 12 / 100;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
}

/**
 * Calculate remaining months to pay off a loan
 */
function calculateRemainingMonths(
  balance: number,
  monthlyPayment: number,
  annualRate: number
): number {
  if (balance <= 0) return 0;
  if (annualRate === 0) {
    return Math.ceil(balance / monthlyPayment);
  }
  const monthlyRate = annualRate / 12 / 100;
  // n = -ln(1 - r*P/M) / ln(1 + r)
  const denominator = monthlyPayment - balance * monthlyRate;
  if (denominator <= 0) return 999; // Payment too low to cover interest
  return Math.ceil(-Math.log(denominator / monthlyPayment) / Math.log(1 + monthlyRate));
}

/**
 * Calculate total interest for remaining loan life
 */
function calculateTotalInterestRemaining(
  balance: number,
  monthlyPayment: number,
  annualRate: number,
  remainingMonths: number
): number {
  if (annualRate === 0) return 0;

  let totalInterest = 0;
  let currentBalance = balance;
  const monthlyRate = annualRate / 12 / 100;

  for (let i = 0; i < remainingMonths && currentBalance > 0; i++) {
    const interest = currentBalance * monthlyRate;
    totalInterest += interest;
    const principalPaid = Math.min(monthlyPayment - interest, currentBalance);
    currentBalance -= principalPaid;
  }

  return totalInterest;
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

  /**
   * Simulate the impact of an extra payment on a loan
   */
  async simulateExtraPayment(
    workspaceId: string,
    loanId: string,
    extraAmount: number,
    paymentType: 'monthly' | 'one_time' = 'monthly'
  ): Promise<ExtraPaymentSimulation> {
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

    const balance = loan.currentBalance.toNumber();
    const interestRate = loan.interestRate?.toNumber() ?? 0;
    const startDate = loan.startDate;
    const endDate = loan.endDate;

    // Calculate original term and monthly payment
    let originalTermMonths: number;
    let monthlyPayment: number;

    if (endDate) {
      const monthsDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
      );
      originalTermMonths = monthsDiff;
      monthlyPayment = calculateMonthlyPayment(
        loan.principalAmount.toNumber(),
        interestRate,
        originalTermMonths
      );
    } else {
      // If no end date, assume a 20-year term for simulation purposes
      originalTermMonths = 240;
      monthlyPayment = calculateMonthlyPayment(
        loan.principalAmount.toNumber(),
        interestRate,
        originalTermMonths
      );
    }

    // Calculate original remaining months from current balance
    const originalRemainingMonths = calculateRemainingMonths(
      balance,
      monthlyPayment,
      interestRate
    );

    // Calculate original total interest remaining
    const originalTotalInterest = calculateTotalInterestRemaining(
      balance,
      monthlyPayment,
      interestRate,
      originalRemainingMonths
    );

    // Calculate new scenario based on payment type
    let newBalance = balance;
    let newMonthlyPayment = monthlyPayment;

    if (paymentType === 'one_time') {
      // One-time extra payment reduces the balance
      newBalance = Math.max(0, balance - extraAmount);
    } else {
      // Monthly extra payment increases the monthly payment
      newMonthlyPayment = monthlyPayment + extraAmount;
    }

    // Calculate new remaining months
    const newRemainingMonths = calculateRemainingMonths(
      newBalance,
      newMonthlyPayment,
      interestRate
    );

    // Calculate new total interest
    const newTotalInterest = calculateTotalInterestRemaining(
      newBalance,
      newMonthlyPayment,
      interestRate,
      newRemainingMonths
    );

    const now = new Date();
    const originalEndDate = new Date(now);
    originalEndDate.setMonth(originalEndDate.getMonth() + originalRemainingMonths);

    const newEndDate = new Date(now);
    newEndDate.setMonth(newEndDate.getMonth() + newRemainingMonths);

    return {
      originalEndDate,
      newEndDate,
      interestSaved: originalTotalInterest - newTotalInterest,
      monthsReduced: originalRemainingMonths - newRemainingMonths,
      originalTotalInterest,
      newTotalInterest,
      newMonthlyPayment,
    };
  },

  /**
   * Generate full amortization schedule for a loan
   */
  async generateAmortizationSchedule(
    workspaceId: string,
    loanId: string
  ): Promise<AmortizationRow[]> {
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

    const principalAmount = loan.principalAmount.toNumber();
    const interestRate = loan.interestRate?.toNumber() ?? 0;
    const startDate = loan.startDate;
    const endDate = loan.endDate;
    const monthlyRate = interestRate / 12 / 100;

    // Calculate term in months
    let termMonths: number;
    if (endDate) {
      termMonths = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
      );
    } else {
      // Default to a reasonable term if not specified
      termMonths = 240;
    }

    // Calculate monthly payment
    const monthlyPayment = calculateMonthlyPayment(principalAmount, interestRate, termMonths);

    const schedule: AmortizationRow[] = [];
    let balance = principalAmount;
    let cumulativeInterest = 0;
    let cumulativePrincipal = 0;

    for (let month = 1; month <= termMonths && balance > 0; month++) {
      const interest = balance * monthlyRate;
      const principalPaid = Math.min(monthlyPayment - interest, balance);
      const actualPayment = principalPaid + interest;

      balance = Math.max(0, balance - principalPaid);
      cumulativeInterest += interest;
      cumulativePrincipal += principalPaid;

      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + month - 1);

      schedule.push({
        month,
        date: paymentDate,
        payment: actualPayment,
        principal: principalPaid,
        interest,
        balance,
        cumulativeInterest,
        cumulativePrincipal,
      });
    }

    return schedule;
  },

  /**
   * Calculate total interest over the life of a loan
   */
  async calculateTotalInterest(
    workspaceId: string,
    loanId: string
  ): Promise<{ totalInterest: number; totalCost: number; interestRatio: number }> {
    const schedule = await this.generateAmortizationSchedule(workspaceId, loanId);
    const loan = await this.getById(workspaceId, loanId);

    if (!loan) {
      throw new NotFoundError('Loan', loanId);
    }

    const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0);
    const totalCost = loan.principalAmount + totalInterest;
    const interestRatio = (totalInterest / loan.principalAmount) * 100;

    return {
      totalInterest,
      totalCost,
      interestRatio,
    };
  },

  /**
   * Calculate when all debts will be paid off for a workspace
   */
  async getDebtFreeDate(workspaceId: string): Promise<{ date: Date | null; totalMonths: number }> {
    const loans = await prisma.loan.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        type: 'debt',
        currentBalance: { gt: 0 },
      },
    });

    if (loans.length === 0) {
      return { date: new Date(), totalMonths: 0 };
    }

    let maxMonths = 0;

    for (const loan of loans) {
      const balance = loan.currentBalance.toNumber();
      const principalAmount = loan.principalAmount.toNumber();
      const interestRate = loan.interestRate?.toNumber() ?? 0;
      const startDate = loan.startDate;
      const endDate = loan.endDate;

      let termMonths: number;
      if (endDate) {
        termMonths = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
        );
      } else {
        termMonths = 240;
      }

      const monthlyPayment = calculateMonthlyPayment(principalAmount, interestRate, termMonths);
      const remainingMonths = calculateRemainingMonths(balance, monthlyPayment, interestRate);

      if (remainingMonths > maxMonths) {
        maxMonths = remainingMonths;
      }
    }

    const debtFreeDate = new Date();
    debtFreeDate.setMonth(debtFreeDate.getMonth() + maxMonths);

    return {
      date: debtFreeDate,
      totalMonths: maxMonths,
    };
  },

  /**
   * Get comprehensive debt summary for a workspace
   */
  async getDebtSummary(workspaceId: string): Promise<DebtSummary> {
    const loans = await prisma.loan.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        type: 'debt',
      },
    });

    let totalDebt = 0;
    let totalMonthlyPayment = 0;
    let totalInterestRemaining = 0;
    const debtsByType: DebtSummary['debtsByType'] = [];

    for (const loan of loans) {
      const balance = loan.currentBalance.toNumber();
      const principalAmount = loan.principalAmount.toNumber();
      const interestRate = loan.interestRate?.toNumber() ?? 0;
      const startDate = loan.startDate;
      const endDate = loan.endDate;

      totalDebt += balance;

      let termMonths: number;
      if (endDate) {
        termMonths = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
        );
      } else {
        termMonths = 240;
      }

      const monthlyPayment = calculateMonthlyPayment(principalAmount, interestRate, termMonths);
      const remainingMonths = calculateRemainingMonths(balance, monthlyPayment, interestRate);
      const interestRemaining = calculateTotalInterestRemaining(
        balance,
        monthlyPayment,
        interestRate,
        remainingMonths
      );

      totalMonthlyPayment += monthlyPayment;
      totalInterestRemaining += interestRemaining;

      const projectedEndDate = new Date();
      projectedEndDate.setMonth(projectedEndDate.getMonth() + remainingMonths);

      debtsByType.push({
        loanId: loan.id,
        name: loan.name,
        balance,
        monthlyPayment,
        interestRate,
        projectedEndDate: balance > 0 ? projectedEndDate : null,
      });
    }

    // Get debt-free date
    const { date: projectedDebtFreeDate } = await this.getDebtFreeDate(workspaceId);

    return {
      totalDebt,
      totalMonthlyPayment,
      projectedDebtFreeDate,
      debtsByType,
      totalInterestRemaining,
    };
  },
};

export default loanService;
