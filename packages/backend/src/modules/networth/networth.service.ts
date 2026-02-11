// ============================================================================
// NET WORTH SERVICE - Finance Hub
// Calculate and track net worth over time
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { positionService } from '@/modules/invest/position.service.js';
import { loanService } from '@/modules/loans/loan.service.js';
import { logger } from '@/core/middleware/logger.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface AccountBreakdown {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

export interface InvestmentBreakdown {
  id: string;
  symbol: string;
  name: string;
  type: string;
  value: number;
  currency: string;
}

export interface LoanBreakdown {
  id: string;
  name: string;
  type: 'debt' | 'credit';
  balance: number;
  currency: string;
}

export interface NetWorthBreakdown {
  accounts: AccountBreakdown[];
  investments: InvestmentBreakdown[];
  loans: LoanBreakdown[];
}

export interface NetWorthSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  accountsTotal: number;
  investmentsTotal: number;
  debtsTotal: number;
  creditsTotal: number;
  breakdown: NetWorthBreakdown;
  currency: string;
}

export interface NetWorthHistoryPoint {
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

// ----------------------------------------------------------------------------
// Service
// ----------------------------------------------------------------------------

class NetWorthService {
  /**
   * Calculate current net worth for a workspace
   * Net Worth = (Bank Accounts + Investments + Credits) - Debts
   */
  async calculateCurrentNetWorth(workspaceId: string): Promise<NetWorthSummary> {
    // Get workspace currency
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { currency: true },
    });
    const baseCurrency = workspace?.currency ?? 'EUR';

    // Get all accounts (including loan type accounts for liability calculation)
    const accounts = await prisma.account.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        type: true,
        balance: true,
        currency: true,
      },
    });

    // Get investment portfolio summary
    let investmentsTotal = 0;
    const investmentBreakdown: InvestmentBreakdown[] = [];

    try {
      const portfolioSummary = await positionService.getPortfolioSummary(workspaceId);
      investmentsTotal = portfolioSummary.totalValue;

      for (const position of portfolioSummary.positions) {
        investmentBreakdown.push({
          id: position.id,
          symbol: position.asset.symbol,
          name: position.asset.name,
          type: position.asset.type,
          value: position.currentValue,
          currency: position.asset.currency,
        });
      }
    } catch {
      // No positions or error - continue with 0
      logger.debug({ workspaceId }, 'No investment positions found for net worth calculation');
    }

    // Get loans summary
    let debtsTotal = 0;
    let creditsTotal = 0;
    const loanBreakdown: LoanBreakdown[] = [];

    try {
      const loanSummary = await loanService.getSummary(workspaceId);
      debtsTotal = loanSummary.totalDebt;
      creditsTotal = loanSummary.totalCredit;

      // Get detailed loan list
      const loans = await loanService.list(workspaceId);
      for (const loan of loans) {
        loanBreakdown.push({
          id: loan.id,
          name: loan.name,
          type: loan.type,
          balance: loan.currentBalance,
          currency: loan.currency,
        });
      }
    } catch {
      // No loans or error - continue with 0
      logger.debug({ workspaceId }, 'No loans found for net worth calculation');
    }

    // Calculate totals
    const accountBreakdown: AccountBreakdown[] = accounts.map((acc) => ({
      id: acc.id,
      name: acc.name,
      type: acc.type,
      balance: acc.balance.toNumber(),
      currency: acc.currency,
    }));

    // Assets: positive account balances + investments + credits (money owed to me)
    // For accounts, we include positive checking/savings balances as assets
    // Negative balances (like credit card debt, loans) are liabilities
    let accountsAssets = 0;
    let accountsLiabilities = 0;

    for (const acc of accounts) {
      const balance = acc.balance.toNumber();
      if (acc.type === 'credit_card' || acc.type === 'loan') {
        // Credit card and loan: negative balance = debt (liability)
        // Positive balance on credit card = overpayment (asset)
        // Loan accounts typically have negative balance representing debt
        if (balance < 0) {
          accountsLiabilities += Math.abs(balance);
        } else if (balance > 0) {
          // Rare case: overpayment on credit card or loan is an asset
          accountsAssets += balance;
        }
      } else {
        // Other accounts (checking, savings, cash, investment):
        // positive = asset, negative = debt (overdraft)
        if (balance >= 0) {
          accountsAssets += balance;
        } else {
          accountsLiabilities += Math.abs(balance);
        }
      }
    }

    const accountsTotal = accountsAssets - accountsLiabilities;

    // Total assets = positive account balances + investments + credits (money owed to me)
    const totalAssets = accountsAssets + investmentsTotal + creditsTotal;

    // Total liabilities = negative account balances + debts (money I owe)
    const totalLiabilities = accountsLiabilities + debtsTotal;

    // Net worth = assets - liabilities
    const netWorth = totalAssets - totalLiabilities;

    return {
      totalAssets,
      totalLiabilities,
      netWorth,
      accountsTotal,
      investmentsTotal,
      debtsTotal,
      creditsTotal,
      breakdown: {
        accounts: accountBreakdown,
        investments: investmentBreakdown,
        loans: loanBreakdown,
      },
      currency: baseCurrency,
    };
  }

  /**
   * Create a snapshot of current net worth
   */
  async createSnapshot(workspaceId: string): Promise<{ date: Date; netWorth: number }> {
    const summary = await this.calculateCurrentNetWorth(workspaceId);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const snapshot = await prisma.netWorthSnapshot.upsert({
      where: {
        workspaceId_date: {
          workspaceId,
          date: today,
        },
      },
      create: {
        workspaceId,
        date: today,
        totalAssets: summary.totalAssets,
        totalLiabilities: summary.totalLiabilities,
        netWorth: summary.netWorth,
        breakdown: summary.breakdown as object,
      },
      update: {
        totalAssets: summary.totalAssets,
        totalLiabilities: summary.totalLiabilities,
        netWorth: summary.netWorth,
        breakdown: summary.breakdown as object,
      },
    });

    return {
      date: snapshot.date,
      netWorth: snapshot.netWorth.toNumber(),
    };
  }

  /**
   * Get net worth history for a workspace
   */
  async getHistory(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<NetWorthHistoryPoint[]> {
    const where: { workspaceId: string; date?: { gte?: Date; lte?: Date } } = { workspaceId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    const snapshots = await prisma.netWorthSnapshot.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    return snapshots.map((snapshot) => ({
      date: snapshot.date.toISOString().slice(0, 10),
      totalAssets: snapshot.totalAssets.toNumber(),
      totalLiabilities: snapshot.totalLiabilities.toNumber(),
      netWorth: snapshot.netWorth.toNumber(),
    }));
  }

  /**
   * Take snapshots for all workspaces
   * Used by scheduled jobs
   */
  async takeAllWorkspacesSnapshots(): Promise<{ workspaceId: string; success: boolean }[]> {
    // Get all active workspaces
    const workspaces = await prisma.workspace.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });

    const results: { workspaceId: string; success: boolean }[] = [];

    for (const { id: workspaceId } of workspaces) {
      try {
        await this.createSnapshot(workspaceId);
        results.push({ workspaceId, success: true });
      } catch (error) {
        logger.error({ workspaceId, error }, 'Failed to create net worth snapshot');
        results.push({ workspaceId, success: false });
      }
    }

    return results;
  }
}

export const netWorthService = new NetWorthService();
export default netWorthService;
