// ============================================================================
// BALANCE SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { AccountType } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface BalanceSnapshot {
  date: Date;
  total: number;
  byAccount: Record<string, number>;
  byType: Record<AccountType, number>;
}

export interface BalanceHistory {
  startDate: Date;
  endDate: Date;
  snapshots: BalanceSnapshot[];
}

// ----------------------------------------------------------------------------
// Balance Service
// ----------------------------------------------------------------------------

export const balanceService = {
  /**
   * Calculate account balance at a specific date
   */
  async getAccountBalanceAtDate(
    accountId: string,
    date: Date
  ): Promise<number> {
    // Get account with initial balance
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) return 0;

    // Sum all transactions up to the date
    const transactionSum = await prisma.transaction.aggregate({
      where: {
        accountId,
        date: { lte: date },
        deletedAt: null,
      },
      _sum: { amount: true },
    });

    return account.balance.toNumber() + (transactionSum._sum.amount?.toNumber() ?? 0);
  },

  /**
   * Calculate total workspace balance at a specific date
   */
  async getWorkspaceBalanceAtDate(
    workspaceId: string,
    date: Date
  ): Promise<number> {
    // Get all accounts
    const accounts = await prisma.account.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        isArchived: false,
      },
    });

    let total = 0;

    for (const account of accounts) {
      const balance = await this.getAccountBalanceAtDate(account.id, date);
      total += balance;
    }

    return total;
  },

  /**
   * Get balance history for a period
   */
  async getBalanceHistory(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    granularity: 'day' | 'week' | 'month' = 'day'
  ): Promise<BalanceHistory> {
    // Get all accounts
    const accounts = await prisma.account.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        isArchived: false,
      },
    });

    const snapshots: BalanceSnapshot[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const byAccount: Record<string, number> = {};
      const byType: Record<string, number> = {};
      let total = 0;

      for (const account of accounts) {
        const balance = await this.getAccountBalanceAtDate(account.id, currentDate);
        byAccount[account.id] = balance;
        byType[account.type] = (byType[account.type] ?? 0) + balance;
        total += balance;
      }

      snapshots.push({
        date: new Date(currentDate),
        total,
        byAccount,
        byType: byType as Record<AccountType, number>,
      });

      // Increment based on granularity
      switch (granularity) {
        case 'day':
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'week':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'month':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
      }
    }

    return {
      startDate,
      endDate,
      snapshots,
    };
  },

  /**
   * Get monthly income and expenses
   */
  async getMonthlyFlow(
    workspaceId: string,
    year: number,
    month: number
  ): Promise<{ income: number; expenses: number; net: number }> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Get accounts for workspace
    const accounts = await prisma.account.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        isArchived: false,
      },
      select: { id: true },
    });

    const accountIds = accounts.map((a) => a.id);

    // Sum income (positive amounts)
    const incomeSum = await prisma.transaction.aggregate({
      where: {
        accountId: { in: accountIds },
        date: { gte: startDate, lte: endDate },
        amount: { gt: 0 },
        deletedAt: null,
        transferPairId: null,
      },
      _sum: { amount: true },
    });

    // Sum expenses (negative amounts)
    const expenseSum = await prisma.transaction.aggregate({
      where: {
        accountId: { in: accountIds },
        date: { gte: startDate, lte: endDate },
        amount: { lt: 0 },
        deletedAt: null,
        transferPairId: null,
      },
      _sum: { amount: true },
    });

    const income = incomeSum._sum.amount?.toNumber() ?? 0;
    const expenses = Math.abs(expenseSum._sum.amount?.toNumber() ?? 0);

    return {
      income,
      expenses,
      net: income - expenses,
    };
  },

  /**
   * Get balance change over a period
   */
  async getBalanceChange(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ startBalance: number; endBalance: number; change: number; changePercent: number }> {
    const startBalance = await this.getWorkspaceBalanceAtDate(workspaceId, startDate);
    const endBalance = await this.getWorkspaceBalanceAtDate(workspaceId, endDate);
    const change = endBalance - startBalance;
    const changePercent = startBalance !== 0 ? (change / startBalance) * 100 : 0;

    return { startBalance, endBalance, change, changePercent };
  },

  /**
   * Get net worth (assets - liabilities)
   */
  async getNetWorth(workspaceId: string): Promise<{
    assets: number;
    liabilities: number;
    netWorth: number;
  }> {
    // Asset account types
    const assetTypes: AccountType[] = ['checking', 'savings', 'cash', 'investment'];
    // Liability account types
    const liabilityTypes: AccountType[] = ['credit_card', 'loan'];

    const accounts = await prisma.account.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        isArchived: false,
      },
    });

    let assets = 0;
    let liabilities = 0;

    for (const account of accounts) {
      const transactionSum = await prisma.transaction.aggregate({
        where: {
          accountId: account.id,
          deletedAt: null,
        },
        _sum: { amount: true },
      });

      const balance = account.balance.toNumber() + (transactionSum._sum.amount?.toNumber() ?? 0);

      if (assetTypes.includes(account.type)) {
        assets += balance;
      } else if (liabilityTypes.includes(account.type)) {
        liabilities += Math.abs(balance);
      }
    }

    return {
      assets,
      liabilities,
      netWorth: assets - liabilities,
    };
  },
};

export default balanceService;
