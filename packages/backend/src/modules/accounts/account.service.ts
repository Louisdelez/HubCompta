// ============================================================================
// ACCOUNT SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError, ConflictError } from '@/core/middleware/errorHandler.js';
import type { Account, AccountType, Prisma } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface AccountCreateInput {
  name: string;
  type: AccountType;
  currency?: string;
  initialBalance?: number;
  color?: string;
  icon?: string;
}

export interface AccountUpdateInput {
  name?: string;
  color?: string | null;
  icon?: string | null;
  isArchived?: boolean;
}

export interface AccountWithBalance extends Omit<Account, 'balance'> {
  balance: number;
  transactionCount: number;
}

export interface AccountFilters {
  type?: AccountType;
  includeArchived?: boolean;
}

// ----------------------------------------------------------------------------
// Account Service
// ----------------------------------------------------------------------------

export const accountService = {
  /**
   * Create a new account
   */
  async create(workspaceId: string, input: AccountCreateInput): Promise<Account> {
    // Check for duplicate account name in workspace
    const existing = await prisma.account.findFirst({
      where: {
        workspaceId,
        name: input.name,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictError('account', 'name', input.name);
    }

    const account = await prisma.account.create({
      data: {
        workspaceId,
        name: input.name,
        type: input.type,
        currency: input.currency ?? 'EUR',
        balance: input.initialBalance ?? 0,
        color: input.color,
        icon: input.icon,
      },
    });

    return account;
  },

  /**
   * Get account by ID
   */
  getById(workspaceId: string, accountId: string): Promise<Account | null> {
    return prisma.account.findFirst({
      where: {
        id: accountId,
        workspaceId,
        deletedAt: null,
      },
    });
  },

  /**
   * Get account with calculated balance
   */
  async getWithBalance(workspaceId: string, accountId: string): Promise<AccountWithBalance | null> {
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!account) return null;

    // Calculate balance from transactions
    const transactionSum = await prisma.transaction.aggregate({
      where: {
        accountId,
        deletedAt: null,
      },
      _sum: { amount: true },
      _count: true,
    });

    const balance = account.balance.toNumber() + (transactionSum._sum.amount?.toNumber() ?? 0);

    return {
      ...account,
      balance,
      transactionCount: transactionSum._count,
    };
  },

  /**
   * List accounts for workspace
   */
  async list(workspaceId: string, filters: AccountFilters = {}): Promise<AccountWithBalance[]> {
    const where: Prisma.AccountWhereInput = {
      workspaceId,
      deletedAt: null,
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (!filters.includeArchived) {
      where.isArchived = false;
    }

    const accounts = await prisma.account.findMany({
      where,
      orderBy: [
        { type: 'asc' },
        { name: 'asc' },
      ],
    });

    // Get balances for all accounts
    const accountsWithBalances: AccountWithBalance[] = [];

    for (const account of accounts) {
      const transactionSum = await prisma.transaction.aggregate({
        where: {
          accountId: account.id,
          deletedAt: null,
        },
        _sum: { amount: true },
        _count: true,
      });

      accountsWithBalances.push({
        ...account,
        balance: account.balance.toNumber() + (transactionSum._sum.amount?.toNumber() ?? 0),
        transactionCount: transactionSum._count,
      });
    }

    return accountsWithBalances;
  },

  /**
   * Update account
   */
  async update(
    workspaceId: string,
    accountId: string,
    input: AccountUpdateInput
  ): Promise<Account> {
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!account) {
      throw new NotFoundError('Account', accountId);
    }

    // Check name uniqueness if changing name
    if (input.name && input.name !== account.name) {
      const existing = await prisma.account.findFirst({
        where: {
          workspaceId,
          name: input.name,
          deletedAt: null,
          id: { not: accountId },
        },
      });

      if (existing) {
        throw new ConflictError('account', 'name', input.name);
      }
    }

    return prisma.account.update({
      where: { id: accountId },
      data: input,
    });
  },

  /**
   * Archive account
   */
  async archive(workspaceId: string, accountId: string): Promise<Account> {
    return this.update(workspaceId, accountId, { isArchived: true });
  },

  /**
   * Unarchive account
   */
  async unarchive(workspaceId: string, accountId: string): Promise<Account> {
    return this.update(workspaceId, accountId, { isArchived: false });
  },

  /**
   * Soft delete account
   */
  async delete(workspaceId: string, accountId: string): Promise<void> {
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        workspaceId,
        deletedAt: null,
      },
      include: {
        _count: { select: { transactions: true } },
      },
    });

    if (!account) {
      throw new NotFoundError('Account', accountId);
    }

    // If account has transactions, just archive it
    if (account._count.transactions > 0) {
      await prisma.account.update({
        where: { id: accountId },
        data: { isArchived: true },
      });
      return;
    }

    // Soft delete if no transactions
    await prisma.account.update({
      where: { id: accountId },
      data: { deletedAt: new Date() },
    });
  },

  /**
   * Get total balance across accounts
   */
  async getTotalBalance(workspaceId: string, excludeArchived = true): Promise<number> {
    const accounts = await this.list(workspaceId, { includeArchived: !excludeArchived });

    return accounts.reduce((sum, account) => sum + account.balance, 0);
  },

  /**
   * Get balance by account type
   */
  async getBalanceByType(workspaceId: string): Promise<Record<AccountType, number>> {
    const accounts = await this.list(workspaceId);

    const balanceByType: Record<string, number> = {};

    for (const account of accounts) {
      balanceByType[account.type] = (balanceByType[account.type] ?? 0) + account.balance;
    }

    return balanceByType as Record<AccountType, number>;
  },
};

export default accountService;
