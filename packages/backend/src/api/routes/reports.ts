// ============================================================================
// REPORTS ROUTES - Finance Hub
// Advanced reporting and export endpoints
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { reportService } from '@/modules/reports/report.service.js';
import { exportService } from '@/modules/reports/export.service.js';
import { transactionService } from '@/modules/transactions/transaction.service.js';
import { balanceService } from '@/modules/accounts/balance.service.js';
import { accountService } from '@/modules/accounts/account.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WorkspaceParams {
  workspaceId: string;
}

interface SummaryQuery {
  year?: string;
  month?: string;
}

interface DateRangeQuery {
  from?: string;
  to?: string;
}

interface HistoryQuery extends DateRangeQuery {
  granularity?: 'day' | 'week' | 'month';
}

interface ExportQuery extends DateRangeQuery {
  format?: 'csv' | 'json';
  accountIds?: string;
  categoryIds?: string;
  status?: string;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function parseDateRange(query: DateRangeQuery): { from: Date; to: Date } {
  const now = new Date();
  const from = query.from ? new Date(query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = query.to ? new Date(query.to) : now;
  return { from, to };
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth guard and workspace context to all routes
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // ==========================================================================
  // BASIC REPORTS
  // ==========================================================================

  // --------------------------------------------------------------------------
  // GET /reports/summary - Monthly summary
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: SummaryQuery }>(
    '/summary',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { year, month } = request.query;

      const now = new Date();
      const targetYear = year ? parseInt(year) : now.getFullYear();
      const targetMonth = month ? parseInt(month) : now.getMonth() + 1;

      // Get monthly flow
      const flow = await balanceService.getMonthlyFlow(workspaceId, targetYear, targetMonth);

      // Get spending by category
      const startDate = new Date(targetYear, targetMonth - 1, 1);
      const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);
      const spendingByCategory = await transactionService.getSpendingByCategory(
        workspaceId,
        startDate,
        endDate
      );

      // Get current balances
      const accounts = await accountService.list(workspaceId);
      const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

      // Calculate compared to previous month
      const prevFlow = await balanceService.getMonthlyFlow(
        workspaceId,
        targetMonth === 1 ? targetYear - 1 : targetYear,
        targetMonth === 1 ? 12 : targetMonth - 1
      );

      return reply.send({
        success: true,
        data: {
          period: {
            year: targetYear,
            month: targetMonth,
            startDate,
            endDate,
          },
          flow: {
            income: flow.income,
            expenses: flow.expenses,
            net: flow.net,
            savingsRate: flow.income > 0 ? ((flow.income - flow.expenses) / flow.income) * 100 : 0,
          },
          comparison: {
            incomeChange: prevFlow.income > 0 ? ((flow.income - prevFlow.income) / prevFlow.income) * 100 : 0,
            expenseChange: prevFlow.expenses > 0 ? ((flow.expenses - prevFlow.expenses) / prevFlow.expenses) * 100 : 0,
          },
          spendingByCategory: spendingByCategory.slice(0, 10),
          totalBalance,
          accountsCount: accounts.length,
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /reports/net-worth - Net worth over time
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: HistoryQuery }>(
    '/net-worth',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { from, to, granularity = 'month' } = request.query;

      const now = new Date();
      const start = from ? new Date(from) : new Date(now.getFullYear(), 0, 1);
      const end = to ? new Date(to) : now;

      const history = await balanceService.getBalanceHistory(workspaceId, start, end, granularity);
      const netWorth = await balanceService.getNetWorth(workspaceId);

      return reply.send({
        success: true,
        data: {
          current: netWorth,
          history: history.snapshots.map((s) => ({
            date: s.date,
            total: s.total,
            byType: s.byType,
          })),
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /reports/spending-trend - Spending trend over months
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: { months?: string } }>(
    '/spending-trend',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const months = request.query.months ? parseInt(request.query.months) : 6;

      const now = new Date();
      const trends: { year: number; month: number; income: number; expenses: number; net: number }[] = [];

      for (let i = months - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const flow = await balanceService.getMonthlyFlow(
          workspaceId,
          date.getFullYear(),
          date.getMonth() + 1
        );

        trends.push({
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          ...flow,
        });
      }

      const avgIncome = trends.reduce((s, t) => s + t.income, 0) / months;
      const avgExpenses = trends.reduce((s, t) => s + t.expenses, 0) / months;

      return reply.send({
        success: true,
        data: {
          trends,
          averages: {
            income: avgIncome,
            expenses: avgExpenses,
            net: avgIncome - avgExpenses,
          },
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /reports/category-breakdown - Category breakdown
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: SummaryQuery }>(
    '/category-breakdown',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { year, month } = request.query;

      const now = new Date();
      const targetYear = year ? parseInt(year) : now.getFullYear();
      const targetMonth = month ? parseInt(month) : now.getMonth() + 1;

      const startDate = new Date(targetYear, targetMonth - 1, 1);
      const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

      const breakdown = await transactionService.getSpendingByCategory(
        workspaceId,
        startDate,
        endDate
      );

      const total = breakdown.reduce((s, b) => s + b.total, 0);

      return reply.send({
        success: true,
        data: {
          period: { year: targetYear, month: targetMonth },
          total,
          categories: breakdown.map((b) => ({
            ...b,
            percentage: total > 0 ? (b.total / total) * 100 : 0,
          })),
        },
      });
    }
  );

  // ==========================================================================
  // ADVANCED REPORTS
  // ==========================================================================

  // --------------------------------------------------------------------------
  // GET /reports/cash-flow - Cash flow report
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: DateRangeQuery }>(
    '/cash-flow',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const range = parseDateRange(request.query);

      const report = await reportService.getCashFlowReport(workspaceId, range);

      return reply.send({
        success: true,
        data: report,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /reports/profit-loss - Profit & Loss report (Pro mode)
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: DateRangeQuery }>(
    '/profit-loss',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const range = parseDateRange(request.query);

      const report = await reportService.getProfitLossReport(workspaceId, range);

      return reply.send({
        success: true,
        data: report,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /reports/budget-comparison - Budget vs Actual
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: DateRangeQuery }>(
    '/budget-comparison',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const range = parseDateRange(request.query);

      const report = await reportService.getBudgetVsActualReport(workspaceId, range);

      return reply.send({
        success: true,
        data: report,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /reports/income-expense-trend - Income/Expense over time
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: HistoryQuery }>(
    '/income-expense-trend',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { granularity = 'month' } = request.query;
      const range = parseDateRange(request.query);

      const data = await reportService.getIncomeExpenseTrend(workspaceId, range, granularity);

      return reply.send({
        success: true,
        data,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /reports/category-trends - Category spending trends
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: DateRangeQuery & { categoryIds?: string } }>(
    '/category-trends',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { categoryIds } = request.query;
      const range = parseDateRange(request.query);

      const parsedCategoryIds = categoryIds ? categoryIds.split(',') : undefined;
      const data = await reportService.getCategoryTrends(workspaceId, range, parsedCategoryIds);

      return reply.send({
        success: true,
        data,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /reports/account-summaries - Account summaries
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: DateRangeQuery }>(
    '/account-summaries',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const range = parseDateRange(request.query);

      const data = await reportService.getAccountSummaries(workspaceId, range);

      return reply.send({
        success: true,
        data,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /reports/top-merchants - Top spending merchants
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: DateRangeQuery & { limit?: string } }>(
    '/top-merchants',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { limit } = request.query;
      const range = parseDateRange(request.query);

      const data = await reportService.getTopMerchants(
        workspaceId,
        range,
        limit ? parseInt(limit) : 10
      );

      return reply.send({
        success: true,
        data,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /reports/yearly-summary - Yearly summary
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: { year?: string } }>(
    '/yearly-summary',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const year = request.query.year ? parseInt(request.query.year) : new Date().getFullYear();

      const data = await reportService.getYearlySummary(workspaceId, year);

      return reply.send({
        success: true,
        data,
      });
    }
  );

  // ==========================================================================
  // EXPORTS
  // ==========================================================================

  // --------------------------------------------------------------------------
  // GET /reports/export/transactions - Export transactions
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: ExportQuery }>(
    '/export/transactions',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { format = 'csv', accountIds, categoryIds, from, to } = request.query;

      const result = await exportService.export({
        workspaceId,
        format,
        type: 'transactions',
        dateRange: from && to ? { from: new Date(from), to: new Date(to) } : undefined,
        accountIds: accountIds ? accountIds.split(',') : undefined,
        categoryIds: categoryIds ? categoryIds.split(',') : undefined,
      });

      reply.header('Content-Type', result.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
      return reply.send(result.content);
    }
  );

  // --------------------------------------------------------------------------
  // GET /reports/export/categories - Export categories
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: ExportQuery }>(
    '/export/categories',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { format = 'csv' } = request.query;

      const result = await exportService.export({
        workspaceId,
        format,
        type: 'categories',
      });

      reply.header('Content-Type', result.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
      return reply.send(result.content);
    }
  );

  // --------------------------------------------------------------------------
  // GET /reports/export/accounts - Export accounts
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: ExportQuery }>(
    '/export/accounts',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { format = 'csv' } = request.query;

      const result = await exportService.export({
        workspaceId,
        format,
        type: 'accounts',
      });

      reply.header('Content-Type', result.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
      return reply.send(result.content);
    }
  );

  // --------------------------------------------------------------------------
  // GET /reports/export/budget-report - Export budget comparison
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: ExportQuery }>(
    '/export/budget-report',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { format = 'csv', from, to } = request.query;

      if (!from || !to) {
        return reply.status(400).send({
          success: false,
          error: { message: 'Les paramètres from et to sont requis' },
        });
      }

      const result = await exportService.export({
        workspaceId,
        format,
        type: 'budget_report',
        dateRange: { from: new Date(from), to: new Date(to) },
      });

      reply.header('Content-Type', result.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
      return reply.send(result.content);
    }
  );

  // --------------------------------------------------------------------------
  // GET /reports/export/cash-flow - Export cash flow report
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: ExportQuery }>(
    '/export/cash-flow',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { format = 'csv', from, to } = request.query;

      if (!from || !to) {
        return reply.status(400).send({
          success: false,
          error: { message: 'Les paramètres from et to sont requis' },
        });
      }

      const result = await exportService.export({
        workspaceId,
        format,
        type: 'cash_flow',
        dateRange: { from: new Date(from), to: new Date(to) },
      });

      reply.header('Content-Type', result.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
      return reply.send(result.content);
    }
  );

  // --------------------------------------------------------------------------
  // GET /reports/export/profit-loss - Export P&L report
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: ExportQuery }>(
    '/export/profit-loss',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { format = 'csv', from, to } = request.query;

      if (!from || !to) {
        return reply.status(400).send({
          success: false,
          error: { message: 'Les paramètres from et to sont requis' },
        });
      }

      const result = await exportService.export({
        workspaceId,
        format,
        type: 'profit_loss',
        dateRange: { from: new Date(from), to: new Date(to) },
      });

      reply.header('Content-Type', result.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
      return reply.send(result.content);
    }
  );

  // --------------------------------------------------------------------------
  // GET /reports/export/invoices - Export invoices (Pro mode)
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: ExportQuery }>(
    '/export/invoices',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { from, to, status } = request.query;

      const dateRange = from && to ? { from: new Date(from), to: new Date(to) } : undefined;

      const result = await exportService.exportInvoices(workspaceId, dateRange, status);

      reply.header('Content-Type', result.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
      return reply.send(result.content);
    }
  );

  // --------------------------------------------------------------------------
  // GET /reports/export/quotes - Export quotes (Pro mode)
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: ExportQuery }>(
    '/export/quotes',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { from, to, status } = request.query;

      const dateRange = from && to ? { from: new Date(from), to: new Date(to) } : undefined;

      const result = await exportService.exportQuotes(workspaceId, dateRange, status);

      reply.header('Content-Type', result.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
      return reply.send(result.content);
    }
  );
}

export default reportRoutes;
