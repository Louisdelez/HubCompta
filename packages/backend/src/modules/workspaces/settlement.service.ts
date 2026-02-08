// ============================================================================
// SETTLEMENT SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError } from '@/core/middleware/errorHandler.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface MemberBalance {
  memberId: string;
  memberName: string;
  memberEmail: string;
  totalPaid: number;
  fairShare: number;
  balance: number; // positive = owed money, negative = owes money
}

export interface Transfer {
  from: {
    id: string;
    name: string;
  };
  to: {
    id: string;
    name: string;
  };
  amount: number;
}

export interface SettlementResult {
  workspaceId: string;
  workspaceName: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalExpenses: number;
  memberCount: number;
  fairSharePerMember: number;
  balances: MemberBalance[];
  suggestedTransfers: Transfer[];
  currency: string;
}

export interface SettlementOptions {
  startDate?: Date;
  endDate?: Date;
  categoryIds?: string[];
  excludeTransfers?: boolean;
}

// ----------------------------------------------------------------------------
// Settlement Service
// ----------------------------------------------------------------------------

export const settlementService = {
  /**
   * Calculate settlement for a flatshare workspace
   */
  async calculateSettlement(
    workspaceId: string,
    options: SettlementOptions = {}
  ): Promise<SettlementResult> {
    // Get workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        deletedAt: null,
      },
    });

    if (!workspace) {
      throw new NotFoundError('Workspace', workspaceId);
    }

    // Get all active members
    const memberships = await prisma.membership.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: { id: true, email: true, displayName: true },
        },
      },
    });

    if (memberships.length === 0) {
      throw new Error('Aucun membre dans cet espace');
    }

    // Get member accounts (accounts that belong to individual members)
    // We use the account name to match with member names, or use a naming convention
    const accounts = await prisma.account.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        isArchived: false,
      },
    });

    // Build member-to-account mapping
    // Strategy: Match account names with member displayNames or emails
    const memberAccountMap = new Map<string, string[]>(); // memberId -> accountIds

    for (const membership of memberships) {
      const memberName = membership.user.displayName?.toLowerCase() || '';
      const memberEmail = (membership.user.email.split('@')[0] ?? '').toLowerCase();

      const matchingAccounts = accounts.filter((account) => {
        const accountName = account.name.toLowerCase();
        return (
          accountName.includes(memberName) ||
          accountName.includes(memberEmail) ||
          memberName.includes(accountName) ||
          memberEmail.includes(accountName)
        );
      });

      if (matchingAccounts.length > 0) {
        memberAccountMap.set(
          membership.userId,
          matchingAccounts.map((a) => a.id)
        );
      }
    }

    // Set default date range (current month if not specified)
    const now = new Date();
    const startDate = options.startDate ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = options.endDate ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Build transaction query
    const transactionWhere: any = {
      workspaceId,
      deletedAt: null,
      date: {
        gte: startDate,
        lte: endDate,
      },
      amount: { lt: 0 }, // Only expenses
    };

    if (options.excludeTransfers !== false) {
      transactionWhere.transferPairId = null;
    }

    if (options.categoryIds && options.categoryIds.length > 0) {
      transactionWhere.categoryId = { in: options.categoryIds };
    }

    // Get all shared expenses
    const transactions = await prisma.transaction.findMany({
      where: transactionWhere,
      select: {
        id: true,
        accountId: true,
        amount: true,
        description: true,
      },
    });

    // Calculate total expenses
    let totalExpenses = 0;
    const expensesByAccount = new Map<string, number>();

    for (const txn of transactions) {
      const amount = Math.abs(txn.amount.toNumber());
      totalExpenses += amount;

      const current = expensesByAccount.get(txn.accountId) ?? 0;
      expensesByAccount.set(txn.accountId, current + amount);
    }

    // Calculate fair share
    const memberCount = memberships.length;
    const fairSharePerMember = memberCount > 0 ? totalExpenses / memberCount : 0;

    // Calculate balances per member
    const balances: MemberBalance[] = [];

    for (const membership of memberships) {
      const memberAccountIds = memberAccountMap.get(membership.userId) ?? [];
      let totalPaid = 0;

      for (const accountId of memberAccountIds) {
        totalPaid += expensesByAccount.get(accountId) ?? 0;
      }

      // If member has no linked account, they might still be part of the share
      const balance = totalPaid - fairSharePerMember;

      balances.push({
        memberId: membership.userId,
        memberName: membership.user.displayName || membership.user.email.split('@')[0] || 'Unknown',
        memberEmail: membership.user.email,
        totalPaid,
        fairShare: fairSharePerMember,
        balance, // positive = is owed money, negative = owes money
      });
    }

    // Sort by balance (those who are owed first)
    balances.sort((a, b) => b.balance - a.balance);

    // Calculate optimal transfers to settle debts
    const suggestedTransfers = this.calculateOptimalTransfers(balances);

    return {
      workspaceId,
      workspaceName: workspace.name,
      period: { startDate, endDate },
      totalExpenses,
      memberCount,
      fairSharePerMember,
      balances,
      suggestedTransfers,
      currency: workspace.currency,
    };
  },

  /**
   * Calculate optimal transfers to settle all debts
   * Uses a greedy algorithm to minimize number of transfers
   */
  calculateOptimalTransfers(balances: MemberBalance[]): Transfer[] {
    const transfers: Transfer[] = [];

    // Create working copies of balances
    const debtors: { id: string; name: string; amount: number }[] = [];
    const creditors: { id: string; name: string; amount: number }[] = [];

    for (const balance of balances) {
      if (balance.balance < -0.01) {
        // Owes money (debtor)
        debtors.push({
          id: balance.memberId,
          name: balance.memberName,
          amount: Math.abs(balance.balance),
        });
      } else if (balance.balance > 0.01) {
        // Is owed money (creditor)
        creditors.push({
          id: balance.memberId,
          name: balance.memberName,
          amount: balance.balance,
        });
      }
    }

    // Sort debtors by amount (highest first)
    debtors.sort((a, b) => b.amount - a.amount);
    // Sort creditors by amount (highest first)
    creditors.sort((a, b) => b.amount - a.amount);

    // Greedy matching
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      if (!debtor || !creditor) break;

      const transferAmount = Math.min(debtor.amount, creditor.amount);

      if (transferAmount > 0.01) {
        transfers.push({
          from: { id: debtor.id, name: debtor.name },
          to: { id: creditor.id, name: creditor.name },
          amount: Math.round(transferAmount * 100) / 100, // Round to cents
        });
      }

      debtor.amount -= transferAmount;
      creditor.amount -= transferAmount;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return transfers;
  },

  /**
   * Get settlement history (past months)
   */
  async getHistory(
    workspaceId: string,
    months: number = 6
  ): Promise<{ period: string; totalExpenses: number; settled: boolean }[]> {
    const history: { period: string; totalExpenses: number; settled: boolean }[] = [];
    const now = new Date();

    for (let i = 0; i < months; i++) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const result = await prisma.transaction.aggregate({
        where: {
          workspaceId,
          deletedAt: null,
          date: { gte: startDate, lte: endDate },
          amount: { lt: 0 },
          transferPairId: null,
        },
        _sum: { amount: true },
      });

      const totalExpenses = Math.abs(result._sum.amount?.toNumber() ?? 0);

      history.push({
        period: startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        totalExpenses,
        settled: i > 0, // Assume past months are settled
      });
    }

    return history;
  },

  /**
   * Get expense breakdown by category for settlement period
   */
  async getExpenseBreakdown(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ categoryId: string | null; categoryName: string; amount: number }[]> {
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

    const breakdown = new Map<string, { name: string; amount: number }>();

    for (const txn of transactions) {
      const key = txn.categoryId ?? 'uncategorized';
      const name = txn.category?.name ?? 'Non catégorisé';
      const current = breakdown.get(key) ?? { name, amount: 0 };
      current.amount += Math.abs(txn.amount.toNumber());
      breakdown.set(key, current);
    }

    return Array.from(breakdown.entries())
      .map(([categoryId, { name, amount }]) => ({
        categoryId: categoryId === 'uncategorized' ? null : categoryId,
        categoryName: name,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  },
};

export default settlementService;
