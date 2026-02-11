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
  // Net Worth Report - Patrimony evolution over time
  // --------------------------------------------------------------------------
  async generateNetWorthReport(
    workspaceId: string,
    months: number = 12
  ): Promise<{
    history: { date: string; assets: number; liabilities: number; netWorth: number }[];
    currentNetWorth: number;
    previousNetWorth: number;
    change: number;
    changePercent: number;
    assets: { total: number; breakdown: { id: string; name: string; type: string; balance: number; change: number; changePercent: number }[] };
    liabilities: { total: number; breakdown: { id: string; name: string; type: string; balance: number; change: number }[] };
  }> {
    const now = new Date();
    const history: { date: string; assets: number; liabilities: number; netWorth: number }[] = [];

    // Get all accounts
    const accounts = await prisma.account.findMany({
      where: { workspaceId, isArchived: false },
    });

    // Separate assets and liabilities
    const assetTypes = ['checking', 'savings', 'investment', 'cash', 'other'];
    const liabilityTypes = ['credit_card', 'loan'];

    const assetAccounts = accounts.filter((a) => assetTypes.includes(a.type));
    const liabilityAccounts = accounts.filter((a) => liabilityTypes.includes(a.type));

    // Generate monthly history
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      let assets = 0;
      let liabilities = 0;

      for (const acc of assetAccounts) {
        assets += await this.getAccountBalanceAtDate(acc.id, endOfMonth);
      }

      for (const acc of liabilityAccounts) {
        const balance = await this.getAccountBalanceAtDate(acc.id, endOfMonth);
        liabilities += Math.abs(balance);
      }

      history.push({
        date: format(date, 'yyyy-MM'),
        assets,
        liabilities,
        netWorth: assets - liabilities,
      });
    }

    // Calculate current totals
    const currentAssets = assetAccounts.reduce((sum, a) => sum + Number(a.balance), 0);
    const currentLiabilities = Math.abs(
      liabilityAccounts.reduce((sum, a) => sum + Number(a.balance), 0)
    );
    const currentNetWorth = currentAssets - currentLiabilities;

    // Get previous month values
    const previousData = history[history.length - 2] || history[0] || { netWorth: 0 };
    const previousNetWorth = previousData?.netWorth || 0;
    const change = currentNetWorth - previousNetWorth;
    const changePercent = previousNetWorth !== 0 ? (change / Math.abs(previousNetWorth)) * 100 : 0;

    // Get previous month end for comparison
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Build asset breakdown
    const assetBreakdown = await Promise.all(
      assetAccounts.map(async (acc) => {
        const prevBalance = await this.getAccountBalanceAtDate(acc.id, prevMonthEnd);
        const currentBalance = Number(acc.balance);
        const change = currentBalance - prevBalance;
        const changePercent = prevBalance !== 0 ? (change / Math.abs(prevBalance)) * 100 : 0;

        return {
          id: acc.id,
          name: acc.name,
          type: acc.type === 'savings' ? 'bank' : acc.type === 'investment' ? 'investment' : 'bank',
          balance: currentBalance,
          change,
          changePercent,
        };
      })
    );

    // Build liability breakdown
    const liabilityBreakdown = await Promise.all(
      liabilityAccounts.map(async (acc) => {
        const prevBalance = Math.abs(await this.getAccountBalanceAtDate(acc.id, prevMonthEnd));
        const currentBalance = Math.abs(Number(acc.balance));
        const change = currentBalance - prevBalance;

        return {
          id: acc.id,
          name: acc.name,
          type: acc.type === 'credit_card' ? 'credit' : 'loan',
          balance: currentBalance,
          change,
        };
      })
    );

    return {
      history,
      currentNetWorth,
      previousNetWorth,
      change,
      changePercent,
      assets: {
        total: currentAssets,
        breakdown: assetBreakdown.sort((a, b) => b.balance - a.balance),
      },
      liabilities: {
        total: currentLiabilities,
        breakdown: liabilityBreakdown.sort((a, b) => b.balance - a.balance),
      },
    };
  },

  // --------------------------------------------------------------------------
  // Year Over Year Comparison Report
  // --------------------------------------------------------------------------
  async generateYearOverYear(
    workspaceId: string,
    year: number
  ): Promise<{
    currentYear: number;
    previousYear: number;
    summary: {
      currentYear: { income: number; expenses: number; net: number; savingsRate: number };
      previousYear: { income: number; expenses: number; net: number; savingsRate: number };
      changes: { income: number; incomePercent: number; expenses: number; expensesPercent: number; net: number; netPercent: number };
    };
    monthly: Array<{
      month: number;
      currentYear: { income: number; expenses: number; net: number };
      previousYear: { income: number; expenses: number; net: number };
    }>;
    categories: Array<{
      categoryId: string;
      categoryName: string;
      categoryIcon: string | null;
      currentYear: number;
      previousYear: number;
      change: number;
      changePercent: number;
    }>;
  }> {
    const currentYear = year;
    const previousYear = year - 1;

    // Get monthly data for both years
    const monthly: Array<{
      month: number;
      currentYear: { income: number; expenses: number; net: number };
      previousYear: { income: number; expenses: number; net: number };
    }> = [];

    const currentYearTotals = { income: 0, expenses: 0 };
    const previousYearTotals = { income: 0, expenses: 0 };

    for (let month = 1; month <= 12; month++) {
      // Current year data
      const currentStart = new Date(currentYear, month - 1, 1);
      const currentEnd = new Date(currentYear, month, 0, 23, 59, 59);

      const currentIncome = await prisma.transaction.aggregate({
        where: {
          account: { workspaceId },
          date: { gte: currentStart, lte: currentEnd },
          amount: { gt: 0 },
          transferPairId: null,
        },
        _sum: { amount: true },
      });

      const currentExpenses = await prisma.transaction.aggregate({
        where: {
          account: { workspaceId },
          date: { gte: currentStart, lte: currentEnd },
          amount: { lt: 0 },
          transferPairId: null,
        },
        _sum: { amount: true },
      });

      // Previous year data
      const prevStart = new Date(previousYear, month - 1, 1);
      const prevEnd = new Date(previousYear, month, 0, 23, 59, 59);

      const prevIncome = await prisma.transaction.aggregate({
        where: {
          account: { workspaceId },
          date: { gte: prevStart, lte: prevEnd },
          amount: { gt: 0 },
          transferPairId: null,
        },
        _sum: { amount: true },
      });

      const prevExpenses = await prisma.transaction.aggregate({
        where: {
          account: { workspaceId },
          date: { gte: prevStart, lte: prevEnd },
          amount: { lt: 0 },
          transferPairId: null,
        },
        _sum: { amount: true },
      });

      const currInc = Number(currentIncome._sum.amount || 0);
      const currExp = Math.abs(Number(currentExpenses._sum.amount || 0));
      const prevInc = Number(prevIncome._sum.amount || 0);
      const prevExp = Math.abs(Number(prevExpenses._sum.amount || 0));

      currentYearTotals.income += currInc;
      currentYearTotals.expenses += currExp;
      previousYearTotals.income += prevInc;
      previousYearTotals.expenses += prevExp;

      monthly.push({
        month,
        currentYear: { income: currInc, expenses: currExp, net: currInc - currExp },
        previousYear: { income: prevInc, expenses: prevExp, net: prevInc - prevExp },
      });
    }

    // Calculate totals
    const currentNet = currentYearTotals.income - currentYearTotals.expenses;
    const previousNet = previousYearTotals.income - previousYearTotals.expenses;

    const currentSavingsRate = currentYearTotals.income > 0
      ? (currentNet / currentYearTotals.income) * 100
      : 0;
    const previousSavingsRate = previousYearTotals.income > 0
      ? (previousNet / previousYearTotals.income) * 100
      : 0;

    // Get category comparison
    const currentYearStart = new Date(currentYear, 0, 1);
    const currentYearEnd = new Date(currentYear, 11, 31, 23, 59, 59);
    const previousYearStart = new Date(previousYear, 0, 1);
    const previousYearEnd = new Date(previousYear, 11, 31, 23, 59, 59);

    // Get current year spending by category
    const currentByCategory = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        account: { workspaceId },
        date: { gte: currentYearStart, lte: currentYearEnd },
        amount: { lt: 0 },
        transferPairId: null,
      },
      _sum: { amount: true },
    });

    // Get previous year spending by category
    const previousByCategory = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        account: { workspaceId },
        date: { gte: previousYearStart, lte: previousYearEnd },
        amount: { lt: 0 },
        transferPairId: null,
      },
      _sum: { amount: true },
    });

    // Get all categories
    const categoryIds = [...new Set([
      ...currentByCategory.map((c) => c.categoryId).filter(Boolean),
      ...previousByCategory.map((c) => c.categoryId).filter(Boolean),
    ])] as string[];

    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, icon: true },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const categoryComparison = categoryIds.map((catId) => {
      const cat = categoryMap.get(catId);
      const currentAmount = Math.abs(Number(
        currentByCategory.find((c) => c.categoryId === catId)?._sum.amount || 0
      ));
      const previousAmount = Math.abs(Number(
        previousByCategory.find((c) => c.categoryId === catId)?._sum.amount || 0
      ));
      const change = currentAmount - previousAmount;
      const changePercent = previousAmount !== 0 ? (change / previousAmount) * 100 : 0;

      return {
        categoryId: catId,
        categoryName: cat?.name || 'Non categorise',
        categoryIcon: cat?.icon || null,
        currentYear: currentAmount,
        previousYear: previousAmount,
        change,
        changePercent,
      };
    }).sort((a, b) => b.currentYear - a.currentYear);

    return {
      currentYear,
      previousYear,
      summary: {
        currentYear: {
          income: currentYearTotals.income,
          expenses: currentYearTotals.expenses,
          net: currentNet,
          savingsRate: currentSavingsRate,
        },
        previousYear: {
          income: previousYearTotals.income,
          expenses: previousYearTotals.expenses,
          net: previousNet,
          savingsRate: previousSavingsRate,
        },
        changes: {
          income: currentYearTotals.income - previousYearTotals.income,
          incomePercent: previousYearTotals.income !== 0
            ? ((currentYearTotals.income - previousYearTotals.income) / previousYearTotals.income) * 100
            : 0,
          expenses: currentYearTotals.expenses - previousYearTotals.expenses,
          expensesPercent: previousYearTotals.expenses !== 0
            ? ((currentYearTotals.expenses - previousYearTotals.expenses) / previousYearTotals.expenses) * 100
            : 0,
          net: currentNet - previousNet,
          netPercent: previousNet !== 0 ? ((currentNet - previousNet) / Math.abs(previousNet)) * 100 : 0,
        },
      },
      monthly,
      categories: categoryComparison,
    };
  },

  // --------------------------------------------------------------------------
  // Enhanced Category Trends Report
  // --------------------------------------------------------------------------
  async generateCategoryTrendsReport(
    workspaceId: string,
    months: number = 6
  ): Promise<{
    categories: Array<{
      categoryId: string;
      categoryName: string;
      categoryIcon: string | null;
      categoryColor: string | null;
      data: Array<{ month: number; year: number; amount: number }>;
      average: number;
      total: number;
      trend: 'up' | 'down' | 'stable';
      trendPercent: number;
    }>;
    months: Array<{ month: number; year: number }>;
  }> {
    const now = new Date();
    const monthsList: Array<{ month: number; year: number }> = [];

    // Generate month list
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthsList.push({
        month: date.getMonth() + 1,
        year: date.getFullYear(),
      });
    }

    // Get all categories with spending
    const allCategories = await prisma.category.findMany({
      where: { workspaceId },
      select: { id: true, name: true, icon: true, color: true },
    });

    const categoryResults: Array<{
      categoryId: string;
      categoryName: string;
      categoryIcon: string | null;
      categoryColor: string | null;
      data: Array<{ month: number; year: number; amount: number }>;
      average: number;
      total: number;
      trend: 'up' | 'down' | 'stable';
      trendPercent: number;
    }> = [];

    for (const category of allCategories) {
      const data: Array<{ month: number; year: number; amount: number }> = [];
      let total = 0;

      for (const { month, year } of monthsList) {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59);

        const result = await prisma.transaction.aggregate({
          where: {
            categoryId: category.id,
            date: { gte: start, lte: end },
            amount: { lt: 0 },
          },
          _sum: { amount: true },
        });

        const amount = Math.abs(Number(result._sum.amount || 0));
        total += amount;
        data.push({ month, year, amount });
      }

      // Skip categories with no spending
      if (total === 0) continue;

      const average = total / months;

      // Calculate trend (compare last 2 months vs first 2 months)
      const recentAvg = data.slice(-2).reduce((s, d) => s + d.amount, 0) / 2;
      const oldAvg = data.slice(0, 2).reduce((s, d) => s + d.amount, 0) / 2;
      const trendPercent = oldAvg !== 0 ? ((recentAvg - oldAvg) / oldAvg) * 100 : 0;

      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (trendPercent > 10) trend = 'up';
      else if (trendPercent < -10) trend = 'down';

      categoryResults.push({
        categoryId: category.id,
        categoryName: category.name,
        categoryIcon: category.icon,
        categoryColor: category.color,
        data,
        average,
        total,
        trend,
        trendPercent,
      });
    }

    // Sort by total spending
    categoryResults.sort((a, b) => b.total - a.total);

    return {
      categories: categoryResults,
      months: monthsList,
    };
  },

  // --------------------------------------------------------------------------
  // Tax Summary Report
  // --------------------------------------------------------------------------
  async generateTaxSummary(
    workspaceId: string,
    year: number,
    country: 'FR' | 'CH' = 'FR'
  ): Promise<{
    year: number;
    country: string;
    income: {
      total: number;
      salary: number;
      freelance: number;
      investments: number;
      other: number;
      byCategory: Array<{ categoryId: string; categoryName: string; amount: number }>;
    };
    deductibleExpenses: {
      total: number;
      byCategory: Array<{
        categoryId: string;
        categoryName: string;
        amount: number;
        deductionRate: number;
        deductibleAmount: number;
        description: string;
      }>;
    };
    investments: {
      dividends: number;
      realizedGains: number;
      realizedLosses: number;
      netInvestmentIncome: number;
    };
    summary: {
      grossIncome: number;
      totalDeductions: number;
      taxableIncome: number;
      estimatedTax: number;
      notes: string[];
    };
  }> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    // Define deductible categories based on country
    const deductibleCategories: Record<string, { rate: number; description: string }> = country === 'FR'
      ? {
          'Frais professionnels': { rate: 1.0, description: 'Frais pro deductibles a 100%' },
          'Transport': { rate: 0.5, description: 'Frais de transport (forfait ou reel)' },
          'Formation': { rate: 1.0, description: 'Formation professionnelle' },
          'Assurance': { rate: 0.5, description: 'Assurances deductibles partiellement' },
          'Sante': { rate: 0.25, description: 'Frais de sante complementaire' },
          'Dons': { rate: 0.66, description: 'Dons aux associations (reduction 66%)' },
          'Immobilier': { rate: 0.5, description: 'Interets emprunt, travaux' },
        }
      : {
          'Frais professionnels': { rate: 1.0, description: 'Frais professionnels effectifs' },
          'Transport': { rate: 1.0, description: 'Frais de deplacement' },
          'Formation': { rate: 1.0, description: 'Frais de formation continue' },
          '3e pilier': { rate: 1.0, description: 'Cotisations 3e pilier A (max CHF 7056)' },
          'Assurance maladie': { rate: 1.0, description: 'Primes assurance maladie' },
          'Interets dettes': { rate: 1.0, description: 'Interets passifs' },
          'Frais de garde': { rate: 1.0, description: 'Frais de garde enfants' },
        };

    // Get all income
    const incomeTransactions = await prisma.transaction.findMany({
      where: {
        account: { workspaceId },
        date: { gte: startDate, lte: endDate },
        amount: { gt: 0 },
        transferPairId: null,
      },
      include: { category: true },
    });

    // Categorize income
    let salary = 0;
    let freelance = 0;
    let investmentIncome = 0;
    let otherIncome = 0;

    const incomeByCategory = new Map<string, { name: string; amount: number }>();

    for (const tx of incomeTransactions) {
      const amount = Number(tx.amount);
      const catName = tx.category?.name?.toLowerCase() || '';
      const catId = tx.categoryId || 'other';

      if (catName.includes('salaire') || catName.includes('salary')) {
        salary += amount;
      } else if (catName.includes('freelance') || catName.includes('honoraire')) {
        freelance += amount;
      } else if (catName.includes('dividend') || catName.includes('interet') || catName.includes('investment')) {
        investmentIncome += amount;
      } else {
        otherIncome += amount;
      }

      const existing = incomeByCategory.get(catId) || { name: tx.category?.name || 'Autre', amount: 0 };
      existing.amount += amount;
      incomeByCategory.set(catId, existing);
    }

    // Get expenses by category and calculate deductions
    const expenseTransactions = await prisma.transaction.findMany({
      where: {
        account: { workspaceId },
        date: { gte: startDate, lte: endDate },
        amount: { lt: 0 },
        transferPairId: null,
      },
      include: { category: true },
    });

    const expensesByCategory = new Map<string, { name: string; amount: number }>();

    for (const tx of expenseTransactions) {
      const amount = Math.abs(Number(tx.amount));
      const catId = tx.categoryId || 'other';

      const existing = expensesByCategory.get(catId) || { name: tx.category?.name || 'Autre', amount: 0 };
      existing.amount += amount;
      expensesByCategory.set(catId, existing);
    }

    // Calculate deductible expenses
    const deductibleExpensesData: Array<{
      categoryId: string;
      categoryName: string;
      amount: number;
      deductionRate: number;
      deductibleAmount: number;
      description: string;
    }> = [];

    let totalDeductions = 0;

    for (const [catId, data] of expensesByCategory) {
      const deductible = Object.entries(deductibleCategories).find(([key]) =>
        data.name.toLowerCase().includes(key.toLowerCase())
      );

      if (deductible) {
        const [, config] = deductible;
        const deductibleAmount = data.amount * config.rate;
        totalDeductions += deductibleAmount;

        deductibleExpensesData.push({
          categoryId: catId,
          categoryName: data.name,
          amount: data.amount,
          deductionRate: config.rate,
          deductibleAmount,
          description: config.description,
        });
      }
    }

    // Get investment data
    const investTransactions = await prisma.investTransaction.findMany({
      where: {
        position: { account: { workspaceId } },
        date: { gte: startDate, lte: endDate },
      },
    });

    let dividends = 0;
    let realizedGains = 0;
    const realizedLosses = 0;

    for (const tx of investTransactions) {
      if (tx.type === 'dividend') {
        dividends += Number(tx.quantity) * Number(tx.price);
      } else if (tx.type === 'sell') {
        // Simplified gain/loss calculation
        const proceeds = Number(tx.quantity) * Number(tx.price) - Number(tx.fees);
        // Would need cost basis to calculate actual gain/loss
        if (proceeds > 0) realizedGains += proceeds * 0.1; // Estimate
      }
    }

    // Calculate totals
    const grossIncome = salary + freelance + investmentIncome + otherIncome;
    const taxableIncome = grossIncome - totalDeductions;

    // Estimate tax (very simplified)
    let estimatedTax = 0;
    const notes: string[] = [];

    if (country === 'FR') {
      // French progressive tax (simplified)
      if (taxableIncome <= 10777) {
        estimatedTax = 0;
      } else if (taxableIncome <= 27478) {
        estimatedTax = (taxableIncome - 10777) * 0.11;
      } else if (taxableIncome <= 78570) {
        estimatedTax = (27478 - 10777) * 0.11 + (taxableIncome - 27478) * 0.3;
      } else {
        estimatedTax = (27478 - 10777) * 0.11 + (78570 - 27478) * 0.3 + (taxableIncome - 78570) * 0.41;
      }
      notes.push('Bareme IR 2024 (simplifie)');
      notes.push('Prelevement a la source non pris en compte');
      if (freelance > 0) {
        notes.push('Revenus freelance: cotisations sociales a deduire');
      }
    } else {
      // Swiss tax (simplified - varies by canton)
      estimatedTax = taxableIncome * 0.15; // Average estimate
      notes.push('Estimation basee sur un taux moyen de 15%');
      notes.push('Le taux reel depend du canton et de la commune');
      notes.push('Impot federal, cantonal et communal inclus');
    }

    return {
      year,
      country: country === 'FR' ? 'France' : 'Suisse',
      income: {
        total: grossIncome,
        salary,
        freelance,
        investments: investmentIncome,
        other: otherIncome,
        byCategory: Array.from(incomeByCategory.entries())
          .map(([categoryId, data]) => ({
            categoryId,
            categoryName: data.name,
            amount: data.amount,
          }))
          .sort((a, b) => b.amount - a.amount),
      },
      deductibleExpenses: {
        total: totalDeductions,
        byCategory: deductibleExpensesData.sort((a, b) => b.deductibleAmount - a.deductibleAmount),
      },
      investments: {
        dividends,
        realizedGains,
        realizedLosses,
        netInvestmentIncome: dividends + realizedGains - realizedLosses,
      },
      summary: {
        grossIncome,
        totalDeductions,
        taxableIncome,
        estimatedTax,
        notes,
      },
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
