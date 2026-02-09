// ============================================================================
// REPORT SERVICE - Finance Hub
// Advanced reporting and analytics
// ============================================================================

import { prisma } from '@/core/database/client.js';
import {
  startOfMonth as _startOfMonth,
  endOfMonth as _endOfMonth,
  startOfYear,
  endOfYear,
  format,
  eachMonthOfInterval,
  eachDayOfInterval,
  eachWeekOfInterval,
} from 'date-fns';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface DateRange {
  from: Date;
  to: Date;
}

export interface CashFlowReport {
  period: DateRange;
  operating: {
    income: number;
    expenses: number;
    net: number;
    byCategory: CategoryAmount[];
  };
  investing: {
    inflows: number;
    outflows: number;
    net: number;
  };
  financing: {
    inflows: number;
    outflows: number;
    net: number;
  };
  netCashFlow: number;
  openingBalance: number;
  closingBalance: number;
}

export interface ProfitLossReport {
  period: DateRange;
  revenue: {
    total: number;
    byCategory: CategoryAmount[];
  };
  expenses: {
    total: number;
    byCategory: CategoryAmount[];
  };
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
}

export interface BudgetVsActualReport {
  period: DateRange;
  categories: BudgetComparison[];
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  totalVariancePercent: number;
}

export interface BudgetComparison {
  categoryId: string;
  categoryName: string;
  categoryColor?: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: 'under' | 'on_track' | 'over';
}

export interface CategoryAmount {
  categoryId: string | null;
  categoryName: string;
  categoryColor?: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface TrendData {
  date: string;
  income: number;
  expenses: number;
  net: number;
  balance?: number;
}

export interface CategoryTrend {
  categoryId: string;
  categoryName: string;
  categoryColor?: string;
  data: { date: string; amount: number }[];
  total: number;
  average: number;
}

export interface AccountSummary {
  accountId: string;
  accountName: string;
  accountType: string;
  openingBalance: number;
  closingBalance: number;
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
}

// ----------------------------------------------------------------------------
// Report Service
// ----------------------------------------------------------------------------

export const reportService = {
  // --------------------------------------------------------------------------
  // Cash Flow Report
  // --------------------------------------------------------------------------
  async getCashFlowReport(workspaceId: string, range: DateRange): Promise<CashFlowReport> {
    const { from, to } = range;

    // Get all transactions in the period
    const transactions = await prisma.transaction.findMany({
      where: {
        account: { workspaceId },
        date: { gte: from, lte: to },
        transferPairId: null,
      },
      include: {
        category: true,
        account: true,
      },
    });

    // Separate by type
    const income = transactions.filter((t) => Number(t.amount) > 0);
    const expenses = transactions.filter((t) => Number(t.amount) < 0);

    // Group by category
    const incomeByCategory = this.groupByCategory(income.map(t => ({ ...t, amount: Number(t.amount) })));
    const expensesByCategory = this.groupByCategory(expenses.map(t => ({ ...t, amount: Number(t.amount) })));

    const totalIncome = income.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpenses = Math.abs(expenses.reduce((sum, t) => sum + Number(t.amount), 0));

    // Get investment transactions (positions)
    const investTransactions = await prisma.investTransaction.findMany({
      where: {
        position: {
          account: { workspaceId },
        },
        date: { gte: from, lte: to },
      },
    });

    const investInflows = investTransactions
      .filter((t) => t.type === 'sell' || t.type === 'dividend')
      .reduce((sum, t) => sum + Number(t.quantity) * Number(t.price), 0);

    const investOutflows = investTransactions
      .filter((t) => t.type === 'buy')
      .reduce((sum, t) => sum + Number(t.quantity) * Number(t.price) + Number(t.fees), 0);

    // Get opening and closing balances
    const accounts = await prisma.account.findMany({
      where: { workspaceId, isArchived: false },
    });

    const openingBalance = await this.getBalanceAtDate(workspaceId, from);
    const closingBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

    return {
      period: range,
      operating: {
        income: totalIncome,
        expenses: totalExpenses,
        net: totalIncome - totalExpenses,
        byCategory: [...incomeByCategory, ...expensesByCategory],
      },
      investing: {
        inflows: investInflows,
        outflows: investOutflows,
        net: investInflows - investOutflows,
      },
      financing: {
        inflows: 0,
        outflows: 0,
        net: 0,
      },
      netCashFlow: totalIncome - totalExpenses + (investInflows - investOutflows),
      openingBalance,
      closingBalance,
    };
  },

  // --------------------------------------------------------------------------
  // Profit & Loss Report (for Pro mode)
  // --------------------------------------------------------------------------
  async getProfitLossReport(workspaceId: string, range: DateRange): Promise<ProfitLossReport> {
    const { from, to } = range;

    // Get invoices as revenue
    const invoices = await prisma.invoice.findMany({
      where: {
        workspaceId,
        status: 'paid',
        issueDate: { gte: from, lte: to },
      },
    });

    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);

    // Get expenses from transactions
    const expenseTransactions = await prisma.transaction.findMany({
      where: {
        account: { workspaceId },
        date: { gte: from, lte: to },
        amount: { lt: 0 },
        transferPairId: null,
      },
      include: { category: true },
    });

    const expensesByCategory = this.groupByCategory(expenseTransactions.map(t => ({ ...t, amount: Number(t.amount) })));
    const totalExpenses = Math.abs(expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0));

    const grossProfit = totalRevenue;
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      period: range,
      revenue: {
        total: totalRevenue,
        byCategory: [], // Could be expanded to track revenue by service type
      },
      expenses: {
        total: totalExpenses,
        byCategory: expensesByCategory,
      },
      grossProfit,
      netProfit,
      profitMargin,
    };
  },

  // --------------------------------------------------------------------------
  // Budget vs Actual Report
  // --------------------------------------------------------------------------
  async getBudgetVsActualReport(
    workspaceId: string,
    range: DateRange
  ): Promise<BudgetVsActualReport> {
    const { from, to } = range;

    // Get all budgets for the period
    const budgets = await prisma.budget.findMany({
      where: {
        workspaceId,
        OR: [
          // Monthly budgets
          {
            period: 'monthly',
            startDate: { lte: to },
            OR: [{ endDate: null }, { endDate: { gte: from } }],
          },
          // Yearly budgets
          {
            period: 'yearly',
            startDate: { lte: to },
            OR: [{ endDate: null }, { endDate: { gte: from } }],
          },
        ],
      },
      include: { category: true },
    });

    // Calculate months in period for prorating annual budgets
    const monthsInPeriod =
      (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;

    // Get actual spending by category
    const actualSpending = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        account: { workspaceId },
        date: { gte: from, lte: to },
        amount: { lt: 0 },
        transferPairId: null,
      },
      _sum: { amount: true },
      _count: true,
    });

    const spendingMap = new Map(
      actualSpending.map((s) => [s.categoryId, Math.abs(Number(s._sum.amount) || 0)])
    );

    // Build comparison
    const categories: BudgetComparison[] = budgets.map((budget) => {
      const budgetAmount = Number(budget.amount);
      const budgeted =
        budget.period === 'yearly' ? (budgetAmount / 12) * monthsInPeriod : budgetAmount;

      const actual = spendingMap.get(budget.categoryId) || 0;
      const variance = budgeted - actual;
      const variancePercent = budgeted > 0 ? (variance / budgeted) * 100 : 0;

      let status: 'under' | 'on_track' | 'over';
      if (variancePercent > 10) status = 'under';
      else if (variancePercent >= -10) status = 'on_track';
      else status = 'over';

      return {
        categoryId: budget.categoryId,
        categoryName: budget.category.name,
        categoryColor: budget.category.color || undefined,
        budgeted,
        actual,
        variance,
        variancePercent,
        status,
      };
    });

    const totalBudget = categories.reduce((sum, c) => sum + c.budgeted, 0);
    const totalActual = categories.reduce((sum, c) => sum + c.actual, 0);
    const totalVariance = totalBudget - totalActual;

    return {
      period: range,
      categories,
      totalBudget,
      totalActual,
      totalVariance,
      totalVariancePercent: totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0,
    };
  },

  // --------------------------------------------------------------------------
  // Income/Expense Trend
  // --------------------------------------------------------------------------
  async getIncomeExpenseTrend(
    workspaceId: string,
    range: DateRange,
    granularity: 'day' | 'week' | 'month' = 'month'
  ): Promise<TrendData[]> {
    const { from, to } = range;

    // Generate date buckets
    let dates: Date[];
    switch (granularity) {
      case 'day':
        dates = eachDayOfInterval({ start: from, end: to });
        break;
      case 'week':
        dates = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });
        break;
      case 'month':
      default:
        dates = eachMonthOfInterval({ start: from, end: to });
    }

    const trends: TrendData[] = [];

    for (const date of dates) {
      let periodStart: Date;
      let periodEnd: Date;

      switch (granularity) {
        case 'day':
          periodStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
          periodEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
          break;
        case 'week':
          periodStart = date;
          periodEnd = new Date(date.getTime() + 6 * 24 * 60 * 60 * 1000);
          periodEnd.setHours(23, 59, 59);
          break;
        case 'month':
        default:
          periodStart = _startOfMonth(date);
          periodEnd = _endOfMonth(date);
      }

      // Don't go beyond the requested range
      if (periodStart > to) break;
      if (periodEnd > to) periodEnd = to;

      const transactions = await prisma.transaction.findMany({
        where: {
          account: { workspaceId },
          date: { gte: periodStart, lte: periodEnd },
          transferPairId: null,
        },
      });

      const income = transactions.filter((t) => Number(t.amount) > 0).reduce((sum, t) => sum + Number(t.amount), 0);
      const expenses = Math.abs(
        transactions.filter((t) => Number(t.amount) < 0).reduce((sum, t) => sum + Number(t.amount), 0)
      );

      trends.push({
        date: format(periodStart, 'yyyy-MM-dd'),
        income,
        expenses,
        net: income - expenses,
      });
    }

    return trends;
  },

  // --------------------------------------------------------------------------
  // Category Trend
  // --------------------------------------------------------------------------
  async getCategoryTrends(
    workspaceId: string,
    range: DateRange,
    categoryIds?: string[]
  ): Promise<CategoryTrend[]> {
    const { from, to } = range;

    // Get categories to track
    const categories = await prisma.category.findMany({
      where: {
        workspaceId,
        ...(categoryIds?.length ? { id: { in: categoryIds } } : {}),
      },
    });

    const months = eachMonthOfInterval({ start: from, end: to });
    const trends: CategoryTrend[] = [];

    for (const category of categories) {
      const data: { date: string; amount: number }[] = [];
      let total = 0;

      for (const month of months) {
        const periodStart = _startOfMonth(month);
        const periodEnd = _endOfMonth(month);

        const result = await prisma.transaction.aggregate({
          where: {
            categoryId: category.id,
            date: { gte: periodStart, lte: periodEnd },
            amount: { lt: 0 },
          },
          _sum: { amount: true },
        });

        const amount = Math.abs(Number(result._sum.amount) || 0);
        total += amount;

        data.push({
          date: format(periodStart, 'yyyy-MM'),
          amount,
        });
      }

      trends.push({
        categoryId: category.id,
        categoryName: category.name,
        categoryColor: category.color || undefined,
        data,
        total,
        average: months.length > 0 ? total / months.length : 0,
      });
    }

    return trends.sort((a, b) => b.total - a.total);
  },

  // --------------------------------------------------------------------------
  // Account Summary
  // --------------------------------------------------------------------------
  async getAccountSummaries(workspaceId: string, range: DateRange): Promise<AccountSummary[]> {
    const { from, to } = range;

    const accounts = await prisma.account.findMany({
      where: { workspaceId, isArchived: false },
    });

    const summaries: AccountSummary[] = [];

    for (const account of accounts) {
      // Get opening balance (balance at start of period)
      const openingBalance = await this.getAccountBalanceAtDate(account.id, from);

      // Get transactions in period
      const transactions = await prisma.transaction.findMany({
        where: {
          accountId: account.id,
          date: { gte: from, lte: to },
        },
      });

      const totalIncome = transactions.filter((t) => Number(t.amount) > 0).reduce((sum, t) => sum + Number(t.amount), 0);
      const totalExpenses = Math.abs(
        transactions.filter((t) => Number(t.amount) < 0).reduce((sum, t) => sum + Number(t.amount), 0)
      );

      summaries.push({
        accountId: account.id,
        accountName: account.name,
        accountType: account.type,
        openingBalance,
        closingBalance: Number(account.balance),
        totalIncome,
        totalExpenses,
        transactionCount: transactions.length,
      });
    }

    return summaries;
  },

  // --------------------------------------------------------------------------
  // Top Descriptions (by spending)
  // --------------------------------------------------------------------------
  async getTopMerchants(
    workspaceId: string,
    range: DateRange,
    limit: number = 10
  ): Promise<{ payee: string; amount: number; count: number }[]> {
    const { from, to } = range;

    const result = await prisma.transaction.groupBy({
      by: ['description'],
      where: {
        account: { workspaceId },
        date: { gte: from, lte: to },
        amount: { lt: 0 },
        transferPairId: null,
      },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'asc' } },
      take: limit,
    });

    return result
      .filter((r) => r.description)
      .map((r) => ({
        payee: r.description,
        amount: Math.abs(Number(r._sum.amount) || 0),
        count: r._count,
      }));
  },

  // --------------------------------------------------------------------------
  // Yearly Summary
  // --------------------------------------------------------------------------
  async getYearlySummary(workspaceId: string, year: number) {
    const from = startOfYear(new Date(year, 0, 1));
    const to = endOfYear(new Date(year, 0, 1));

    const monthlyData = await this.getIncomeExpenseTrend(workspaceId, { from, to }, 'month');

    const totalIncome = monthlyData.reduce((sum, m) => sum + m.income, 0);
    const totalExpenses = monthlyData.reduce((sum, m) => sum + m.expenses, 0);

    // Get previous year for comparison
    const prevYear = year - 1;
    const prevFrom = startOfYear(new Date(prevYear, 0, 1));
    const prevTo = endOfYear(new Date(prevYear, 0, 1));

    const _prevYearData = await prisma.transaction.aggregate({
      where: {
        account: { workspaceId },
        date: { gte: prevFrom, lte: prevTo },
        transferPairId: null,
      },
      _sum: { amount: true },
    });

    const prevYearExpenses = await prisma.transaction.aggregate({
      where: {
        account: { workspaceId },
        date: { gte: prevFrom, lte: prevTo },
        amount: { lt: 0 },
        transferPairId: null,
      },
      _sum: { amount: true },
    });

    return {
      year,
      totalIncome,
      totalExpenses,
      netSavings: totalIncome - totalExpenses,
      savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0,
      monthlyAverage: {
        income: totalIncome / 12,
        expenses: totalExpenses / 12,
      },
      comparison: {
        incomeChange: 0, // Would need previous year income
        expenseChange:
          prevYearExpenses._sum.amount && totalExpenses > 0
            ? ((totalExpenses - Math.abs(Number(prevYearExpenses._sum.amount))) /
                Math.abs(Number(prevYearExpenses._sum.amount))) *
              100
            : 0,
      },
      monthlyData,
    };
  },

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------
  groupByCategory(
    transactions: { amount: number; category: { id: string; name: string; color: string | null } | null }[]
  ): CategoryAmount[] {
    const groups = new Map<
      string | null,
      { amount: number; count: number; name: string; color?: string }
    >();

    for (const tx of transactions) {
      const categoryId = tx.category?.id || null;
      const existing = groups.get(categoryId) || {
        amount: 0,
        count: 0,
        name: tx.category?.name || 'Non catégorisé',
        color: tx.category?.color || undefined,
      };

      existing.amount += Math.abs(tx.amount);
      existing.count += 1;
      groups.set(categoryId, existing);
    }

    const total = Array.from(groups.values()).reduce((sum, g) => sum + g.amount, 0);

    return Array.from(groups.entries())
      .map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        categoryColor: data.color,
        amount: data.amount,
        percentage: total > 0 ? (data.amount / total) * 100 : 0,
        transactionCount: data.count,
      }))
      .sort((a, b) => b.amount - a.amount);
  },

  async getBalanceAtDate(workspaceId: string, date: Date): Promise<number> {
    const accounts = await prisma.account.findMany({
      where: { workspaceId, isArchived: false },
    });

    let total = 0;

    for (const account of accounts) {
      total += await this.getAccountBalanceAtDate(account.id, date);
    }

    return total;
  },

  async getAccountBalanceAtDate(accountId: string, date: Date): Promise<number> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) return 0;

    // Get all transactions after the date
    const transactionsAfter = await prisma.transaction.aggregate({
      where: {
        accountId,
        date: { gt: date },
      },
      _sum: { amount: true },
    });

    // Current balance minus transactions after date = balance at date
    return Number(account.balance) - (Number(transactionsAfter._sum.amount) || 0);
  },
};

export default reportService;
