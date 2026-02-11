// ============================================================================
// EXPORT SERVICE - Finance Hub
// Export data to various formats (CSV, Excel, JSON, PDF)
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { Prisma } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type ExportFormat = 'csv' | 'excel' | 'json' | 'pdf';

export interface ExportOptions {
  workspaceId: string;
  format: ExportFormat;
  dateFrom?: Date;
  dateTo?: Date;
  accountIds?: string[];
  categoryIds?: string[];
  includeArchived?: boolean;
}

export interface TransactionExportData {
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: string;
  account: string;
  category: string;
  tags: string;
  notes: string;
  status: string;
}

export interface AccountExportData {
  name: string;
  type: string;
  currency: string;
  balance: number;
  isArchived: boolean;
}

export interface CategoryExportData {
  name: string;
  type: string;
  parentCategory: string;
}

export interface BudgetExportData {
  name: string;
  category: string;
  amount: number;
  period: string;
  alertThreshold: number;
}

export interface FullBackupData {
  exportedAt: string;
  version: string;
  workspace: {
    id: string;
    name: string;
    type: string;
    currency: string;
  };
  accounts: AccountExportData[];
  categories: CategoryExportData[];
  transactions: TransactionExportData[];
  budgets: BudgetExportData[];
  tags: { name: string; color: string | null }[];
  rules: { name: string; conditions: unknown; actions: unknown; isEnabled: boolean }[];
  recurrences: { name: string; frequency: string; template: unknown; isActive: boolean }[];
}

// ----------------------------------------------------------------------------
// Export Service
// ----------------------------------------------------------------------------

export const exportService = {
  /**
   * Export transactions to the specified format
   */
  async exportTransactions(options: ExportOptions): Promise<{ data: string; filename: string; mimeType: string }> {
    const transactions = await this.getTransactionData(options);

    switch (options.format) {
      case 'csv':
        return {
          data: this.transactionsToCSV(transactions),
          filename: `transactions_${this.getDateString()}.csv`,
          mimeType: 'text/csv',
        };
      case 'json':
        return {
          data: JSON.stringify(transactions, null, 2),
          filename: `transactions_${this.getDateString()}.json`,
          mimeType: 'application/json',
        };
      case 'excel':
        return {
          data: this.transactionsToCSV(transactions), // CSV for now, can be enhanced with xlsx library
          filename: `transactions_${this.getDateString()}.csv`,
          mimeType: 'text/csv',
        };
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  },

  /**
   * Export accounts to the specified format
   */
  async exportAccounts(options: ExportOptions): Promise<{ data: string; filename: string; mimeType: string }> {
    const accounts = await this.getAccountData(options);

    switch (options.format) {
      case 'csv':
        return {
          data: this.accountsToCSV(accounts),
          filename: `accounts_${this.getDateString()}.csv`,
          mimeType: 'text/csv',
        };
      case 'json':
        return {
          data: JSON.stringify(accounts, null, 2),
          filename: `accounts_${this.getDateString()}.json`,
          mimeType: 'application/json',
        };
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  },

  /**
   * Export full workspace backup as JSON
   */
  async exportFullBackup(workspaceId: string): Promise<{ data: string; filename: string; mimeType: string }> {
    const backup = await this.getFullBackupData(workspaceId);

    return {
      data: JSON.stringify(backup, null, 2),
      filename: `backup_${this.getDateString()}.json`,
      mimeType: 'application/json',
    };
  },

  /**
   * Generate a financial report in PDF format (returns HTML for now)
   */
  async generateReport(options: {
    workspaceId: string;
    type: 'monthly' | 'yearly' | 'category' | 'account';
    year: number;
    month?: number;
    accountId?: string;
  }): Promise<{ data: string; filename: string; mimeType: string }> {
    const { workspaceId, type, year, month, accountId } = options;

    let reportData: unknown;
    let reportHtml: string;

    switch (type) {
      case 'monthly':
        reportData = await this.getMonthlyReportData(workspaceId, year, month ?? 1);
        reportHtml = this.generateMonthlyReportHTML(reportData as any);
        break;
      case 'yearly':
        reportData = await this.getYearlyReportData(workspaceId, year);
        reportHtml = this.generateYearlyReportHTML(reportData as any);
        break;
      case 'category':
        reportData = await this.getCategoryReportData(workspaceId, year, month);
        reportHtml = this.generateCategoryReportHTML(reportData as any);
        break;
      case 'account':
        if (!accountId) throw new Error('Account ID required for account report');
        reportData = await this.getAccountReportData(workspaceId, accountId, year, month);
        reportHtml = this.generateAccountReportHTML(reportData as any);
        break;
      default:
        throw new Error(`Unsupported report type: ${type}`);
    }

    return {
      data: reportHtml,
      filename: `report_${type}_${year}${month ? `-${month}` : ''}.html`,
      mimeType: 'text/html',
    };
  },

  // --------------------------------------------------------------------------
  // Data Fetchers
  // --------------------------------------------------------------------------

  async getTransactionData(options: ExportOptions): Promise<TransactionExportData[]> {
    const where: Prisma.TransactionWhereInput = {
      workspaceId: options.workspaceId,
      deletedAt: null,
    };

    if (options.dateFrom || options.dateTo) {
      where.date = {};
      if (options.dateFrom) where.date.gte = options.dateFrom;
      if (options.dateTo) where.date.lte = options.dateTo;
    }

    if (options.accountIds?.length) {
      where.accountId = { in: options.accountIds };
    }

    if (options.categoryIds?.length) {
      where.categoryId = { in: options.categoryIds };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        account: { select: { name: true } },
        category: { select: { name: true } },
        tags: { include: { tag: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
    });

    return transactions.map((t) => ({
      date: t.date.toISOString().split('T')[0] ?? '',
      description: t.description,
      amount: Number(t.amount),
      currency: t.currency,
      type: t.type,
      account: t.account.name,
      category: t.category?.name ?? '',
      tags: t.tags.map((tt) => tt.tag.name).join(', '),
      notes: t.notes ?? '',
      status: t.status,
    }));
  },

  async getAccountData(options: ExportOptions): Promise<AccountExportData[]> {
    const where: Prisma.AccountWhereInput = {
      workspaceId: options.workspaceId,
      deletedAt: null,
    };

    if (!options.includeArchived) {
      where.isArchived = false;
    }

    const accounts = await prisma.account.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return accounts.map((a) => ({
      name: a.name,
      type: a.type,
      currency: a.currency,
      balance: Number(a.balance),
      isArchived: a.isArchived,
    }));
  },

  async getFullBackupData(workspaceId: string): Promise<FullBackupData> {
    const [workspace, accounts, categories, transactions, budgets, tags, rules, recurrences] =
      await Promise.all([
        prisma.workspace.findUniqueOrThrow({
          where: { id: workspaceId },
          select: { id: true, name: true, type: true, currency: true },
        }),
        prisma.account.findMany({
          where: { workspaceId, deletedAt: null },
          orderBy: { name: 'asc' },
        }),
        prisma.category.findMany({
          where: { workspaceId },
          include: { parent: { select: { name: true } } },
          orderBy: { name: 'asc' },
        }),
        prisma.transaction.findMany({
          where: { workspaceId, deletedAt: null },
          include: {
            account: { select: { name: true } },
            category: { select: { name: true } },
            tags: { include: { tag: { select: { name: true } } } },
          },
          orderBy: { date: 'desc' },
        }),
        prisma.budget.findMany({
          where: { workspaceId },
          include: { category: { select: { name: true } } },
          orderBy: { name: 'asc' },
        }),
        prisma.tag.findMany({
          where: { workspaceId },
          orderBy: { name: 'asc' },
        }),
        prisma.rule.findMany({
          where: { workspaceId },
          orderBy: { priority: 'asc' },
        }),
        prisma.recurrence.findMany({
          where: { workspaceId },
          orderBy: { name: 'asc' },
        }),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      workspace: {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        currency: workspace.currency,
      },
      accounts: accounts.map((a) => ({
        name: a.name,
        type: a.type,
        currency: a.currency,
        balance: Number(a.balance),
        isArchived: a.isArchived,
      })),
      categories: categories.map((c) => ({
        name: c.name,
        type: c.type,
        parentCategory: c.parent?.name ?? '',
      })),
      transactions: transactions.map((t) => ({
        date: t.date.toISOString().split('T')[0] ?? '',
        description: t.description,
        amount: Number(t.amount),
        currency: t.currency,
        type: t.type,
        account: t.account.name,
        category: t.category?.name ?? '',
        tags: t.tags.map((tt) => tt.tag.name).join(', '),
        notes: t.notes ?? '',
        status: t.status,
      })),
      budgets: budgets.map((b) => ({
        name: b.name,
        category: b.category.name,
        amount: Number(b.amount),
        period: b.period,
        alertThreshold: b.alertThreshold,
      })),
      tags: tags.map((t) => ({
        name: t.name,
        color: t.color,
      })),
      rules: rules.map((r) => ({
        name: r.name,
        conditions: r.conditions,
        actions: r.actions,
        isEnabled: r.isEnabled,
      })),
      recurrences: recurrences.map((r) => ({
        name: r.name,
        frequency: r.frequency,
        template: r.template,
        isActive: r.isActive,
      })),
    };
  },

  // --------------------------------------------------------------------------
  // Report Data Fetchers
  // --------------------------------------------------------------------------

  async getMonthlyReportData(workspaceId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const [income, expenses, byCategory, topTransactions] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          workspaceId,
          deletedAt: null,
          type: 'income',
          date: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          workspaceId,
          deletedAt: null,
          type: 'expense',
          date: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ['categoryId'],
        where: {
          workspaceId,
          deletedAt: null,
          type: 'expense',
          date: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'asc' } },
        take: 10,
      }),
      prisma.transaction.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          date: { gte: startDate, lte: endDate },
        },
        include: {
          account: { select: { name: true } },
          category: { select: { name: true, icon: true } },
        },
        orderBy: { amount: 'asc' },
        take: 10,
      }),
    ]);

    // Get category names
    const categoryIds = byCategory.map((c) => c.categoryId).filter(Boolean) as string[];
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, icon: true },
    });
    const categoryMap = new Map<string, { id: string; name: string; icon: string | null }>(categories.map((c) => [c.id, c]));

    return {
      period: { year, month },
      income: Number(income._sum.amount ?? 0),
      expenses: Math.abs(Number(expenses._sum.amount ?? 0)),
      net: Number(income._sum.amount ?? 0) + Number(expenses._sum.amount ?? 0),
      byCategory: byCategory.map((c) => ({
        category: categoryMap.get(c.categoryId ?? '')?.name ?? 'Non catégorisé',
        icon: categoryMap.get(c.categoryId ?? '')?.icon ?? '📦',
        amount: Math.abs(Number(c._sum.amount ?? 0)),
      })),
      topTransactions: topTransactions.map((t) => ({
        date: t.date.toISOString().split('T')[0],
        description: t.description,
        amount: Number(t.amount),
        account: t.account.name,
        category: t.category?.name ?? '',
      })),
    };
  },

  async getYearlyReportData(workspaceId: string, year: number) {
    // Year boundaries for reference (used implicitly in monthly queries)
    const _startDate = new Date(year, 0, 1);
    const _endDate = new Date(year, 11, 31);

    const monthlyData = await Promise.all(
      Array.from({ length: 12 }, (_, i) => i + 1).map(async (month) => {
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);

        const [income, expenses] = await Promise.all([
          prisma.transaction.aggregate({
            where: {
              workspaceId,
              deletedAt: null,
              type: 'income',
              date: { gte: monthStart, lte: monthEnd },
            },
            _sum: { amount: true },
          }),
          prisma.transaction.aggregate({
            where: {
              workspaceId,
              deletedAt: null,
              type: 'expense',
              date: { gte: monthStart, lte: monthEnd },
            },
            _sum: { amount: true },
          }),
        ]);

        return {
          month,
          income: Number(income._sum.amount ?? 0),
          expenses: Math.abs(Number(expenses._sum.amount ?? 0)),
        };
      })
    );

    const totals = monthlyData.reduce(
      (acc, m) => ({
        income: acc.income + m.income,
        expenses: acc.expenses + m.expenses,
      }),
      { income: 0, expenses: 0 }
    );

    return {
      year,
      monthlyData,
      totals: {
        ...totals,
        net: totals.income - totals.expenses,
        savingsRate: totals.income > 0 ? ((totals.income - totals.expenses) / totals.income) * 100 : 0,
      },
    };
  },

  async getCategoryReportData(workspaceId: string, year: number, month?: number) {
    const startDate = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
    const endDate = month ? new Date(year, month, 0) : new Date(year, 11, 31);

    const byCategory = await prisma.transaction.groupBy({
      by: ['categoryId', 'type'],
      where: {
        workspaceId,
        deletedAt: null,
        date: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
      _count: true,
    });

    const categoryIds = byCategory.map((c) => c.categoryId).filter(Boolean) as string[];
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, icon: true, type: true },
    });
    const categoryMap = new Map<string, { id: string; name: string; icon: string | null; type: string }>(categories.map((c) => [c.id, c]));

    return {
      period: { year, month },
      categories: byCategory.map((c) => ({
        category: categoryMap.get(c.categoryId ?? '')?.name ?? 'Non catégorisé',
        icon: categoryMap.get(c.categoryId ?? '')?.icon ?? '📦',
        type: c.type,
        amount: Math.abs(Number(c._sum.amount ?? 0)),
        count: c._count,
      })),
    };
  },

  async getAccountReportData(workspaceId: string, accountId: string, year: number, month?: number) {
    const startDate = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
    const endDate = month ? new Date(year, month, 0) : new Date(year, 11, 31);

    const [account, transactions, summary] = await Promise.all([
      prisma.account.findUniqueOrThrow({
        where: { id: accountId },
        select: { name: true, type: true, currency: true, balance: true },
      }),
      prisma.transaction.findMany({
        where: {
          workspaceId,
          accountId,
          deletedAt: null,
          date: { gte: startDate, lte: endDate },
        },
        include: { category: { select: { name: true, icon: true } } },
        orderBy: { date: 'desc' },
      }),
      prisma.transaction.aggregate({
        where: {
          workspaceId,
          accountId,
          deletedAt: null,
          date: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      period: { year, month },
      account: {
        name: account.name,
        type: account.type,
        currency: account.currency,
        currentBalance: Number(account.balance),
      },
      transactions: transactions.map((t) => ({
        date: t.date.toISOString().split('T')[0],
        description: t.description,
        amount: Number(t.amount),
        type: t.type,
        category: t.category?.name ?? '',
      })),
      summary: {
        totalTransactions: summary._count,
        netChange: Number(summary._sum.amount ?? 0),
      },
    };
  },

  // --------------------------------------------------------------------------
  // Format Converters
  // --------------------------------------------------------------------------

  transactionsToCSV(data: TransactionExportData[]): string {
    const headers = ['Date', 'Description', 'Montant', 'Devise', 'Type', 'Compte', 'Catégorie', 'Tags', 'Notes', 'Statut'];
    const rows = data.map((t) => [
      t.date,
      this.escapeCSV(t.description),
      t.amount.toString(),
      t.currency,
      t.type,
      this.escapeCSV(t.account),
      this.escapeCSV(t.category),
      this.escapeCSV(t.tags),
      this.escapeCSV(t.notes),
      t.status,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  },

  accountsToCSV(data: AccountExportData[]): string {
    const headers = ['Nom', 'Type', 'Devise', 'Solde', 'Archivé'];
    const rows = data.map((a) => [
      this.escapeCSV(a.name),
      a.type,
      a.currency,
      a.balance.toString(),
      a.isArchived ? 'Oui' : 'Non',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  },

  escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  },

  // --------------------------------------------------------------------------
  // HTML Report Generators
  // --------------------------------------------------------------------------

  generateMonthlyReportHTML(data: {
    period: { year: number; month: number };
    income: number;
    expenses: number;
    net: number;
    byCategory: { category: string; icon: string; amount: number }[];
    topTransactions: { date: string; description: string; amount: number; account: string; category: string }[];
  }): string {
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const monthName = monthNames[data.period.month - 1];

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport Mensuel - ${monthName} ${data.period.year}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1, h2 { color: #1f2937; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
    .card { background: #f9fafb; border-radius: 12px; padding: 20px; }
    .card h3 { margin: 0 0 8px; color: #6b7280; font-size: 14px; }
    .card .value { font-size: 24px; font-weight: 700; }
    .income { color: #059669; }
    .expense { color: #dc2626; }
    .net { color: ${data.net >= 0 ? '#059669' : '#dc2626'}; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .amount { text-align: right; font-family: monospace; }
    .positive { color: #059669; }
    .negative { color: #dc2626; }
    @media print { body { max-width: none; } }
  </style>
</head>
<body>
  <h1>Rapport Mensuel</h1>
  <p style="color: #6b7280;">${monthName} ${data.period.year}</p>

  <div class="summary">
    <div class="card">
      <h3>Revenus</h3>
      <div class="value income">${this.formatCurrency(data.income)}</div>
    </div>
    <div class="card">
      <h3>Dépenses</h3>
      <div class="value expense">${this.formatCurrency(data.expenses)}</div>
    </div>
    <div class="card">
      <h3>Solde</h3>
      <div class="value net">${this.formatCurrency(data.net)}</div>
    </div>
  </div>

  <h2>Dépenses par catégorie</h2>
  <table>
    <thead>
      <tr><th>Catégorie</th><th class="amount">Montant</th></tr>
    </thead>
    <tbody>
      ${data.byCategory.map((c) => `
        <tr>
          <td>${c.icon} ${c.category}</td>
          <td class="amount negative">${this.formatCurrency(c.amount)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>Principales transactions</h2>
  <table>
    <thead>
      <tr><th>Date</th><th>Description</th><th>Compte</th><th class="amount">Montant</th></tr>
    </thead>
    <tbody>
      ${data.topTransactions.map((t) => `
        <tr>
          <td>${new Date(t.date).toLocaleDateString('fr-FR')}</td>
          <td>${t.description}</td>
          <td>${t.account}</td>
          <td class="amount ${t.amount >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(t.amount)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
    Généré le ${new Date().toLocaleDateString('fr-FR')} - Finance Hub
  </footer>
</body>
</html>`;
  },

  generateYearlyReportHTML(data: {
    year: number;
    monthlyData: { month: number; income: number; expenses: number }[];
    totals: { income: number; expenses: number; net: number; savingsRate: number };
  }): string {
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport Annuel - ${data.year}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1, h2 { color: #1f2937; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .card { background: #f9fafb; border-radius: 12px; padding: 16px; }
    .card h3 { margin: 0 0 8px; color: #6b7280; font-size: 12px; }
    .card .value { font-size: 20px; font-weight: 700; }
    .income { color: #059669; }
    .expense { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .amount { text-align: right; font-family: monospace; }
    .positive { color: #059669; }
    .negative { color: #dc2626; }
    @media print { body { max-width: none; } }
  </style>
</head>
<body>
  <h1>Rapport Annuel ${data.year}</h1>

  <div class="summary">
    <div class="card">
      <h3>Revenus totaux</h3>
      <div class="value income">${this.formatCurrency(data.totals.income)}</div>
    </div>
    <div class="card">
      <h3>Dépenses totales</h3>
      <div class="value expense">${this.formatCurrency(data.totals.expenses)}</div>
    </div>
    <div class="card">
      <h3>Solde net</h3>
      <div class="value" style="color: ${data.totals.net >= 0 ? '#059669' : '#dc2626'}">${this.formatCurrency(data.totals.net)}</div>
    </div>
    <div class="card">
      <h3>Taux d'épargne</h3>
      <div class="value">${data.totals.savingsRate.toFixed(1)}%</div>
    </div>
  </div>

  <h2>Données mensuelles</h2>
  <table>
    <thead>
      <tr><th>Mois</th><th class="amount">Revenus</th><th class="amount">Dépenses</th><th class="amount">Solde</th></tr>
    </thead>
    <tbody>
      ${data.monthlyData.map((m) => `
        <tr>
          <td>${monthNames[m.month - 1]}</td>
          <td class="amount positive">${this.formatCurrency(m.income)}</td>
          <td class="amount negative">${this.formatCurrency(m.expenses)}</td>
          <td class="amount" style="color: ${m.income - m.expenses >= 0 ? '#059669' : '#dc2626'}">${this.formatCurrency(m.income - m.expenses)}</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr style="font-weight: 700;">
        <td>Total</td>
        <td class="amount positive">${this.formatCurrency(data.totals.income)}</td>
        <td class="amount negative">${this.formatCurrency(data.totals.expenses)}</td>
        <td class="amount" style="color: ${data.totals.net >= 0 ? '#059669' : '#dc2626'}">${this.formatCurrency(data.totals.net)}</td>
      </tr>
    </tfoot>
  </table>

  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
    Généré le ${new Date().toLocaleDateString('fr-FR')} - Finance Hub
  </footer>
</body>
</html>`;
  },

  generateCategoryReportHTML(data: {
    period: { year: number; month?: number };
    categories: { category: string; icon: string; type: string; amount: number; count: number }[];
  }): string {
    const expenseCategories = data.categories.filter((c) => c.type === 'expense');
    const incomeCategories = data.categories.filter((c) => c.type === 'income');

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport par catégorie - ${data.period.year}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1, h2 { color: #1f2937; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .amount { text-align: right; font-family: monospace; }
    .count { text-align: center; color: #6b7280; }
    .positive { color: #059669; }
    .negative { color: #dc2626; }
    @media print { body { max-width: none; } }
  </style>
</head>
<body>
  <h1>Rapport par catégorie</h1>
  <p style="color: #6b7280;">${data.period.month ? `${data.period.month}/${data.period.year}` : data.period.year}</p>

  <h2>Dépenses</h2>
  <table>
    <thead>
      <tr><th>Catégorie</th><th class="count">Nb</th><th class="amount">Montant</th></tr>
    </thead>
    <tbody>
      ${expenseCategories.map((c) => `
        <tr>
          <td>${c.icon} ${c.category}</td>
          <td class="count">${c.count}</td>
          <td class="amount negative">${this.formatCurrency(c.amount)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>Revenus</h2>
  <table>
    <thead>
      <tr><th>Catégorie</th><th class="count">Nb</th><th class="amount">Montant</th></tr>
    </thead>
    <tbody>
      ${incomeCategories.map((c) => `
        <tr>
          <td>${c.icon} ${c.category}</td>
          <td class="count">${c.count}</td>
          <td class="amount positive">${this.formatCurrency(c.amount)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
    Généré le ${new Date().toLocaleDateString('fr-FR')} - Finance Hub
  </footer>
</body>
</html>`;
  },

  generateAccountReportHTML(data: {
    period: { year: number; month?: number };
    account: { name: string; type: string; currency: string; currentBalance: number };
    transactions: { date: string; description: string; amount: number; type: string; category: string }[];
    summary: { totalTransactions: number; netChange: number };
  }): string {
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport de compte - ${data.account.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1, h2 { color: #1f2937; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0; }
    .card { background: #f9fafb; border-radius: 12px; padding: 16px; }
    .card h3 { margin: 0 0 8px; color: #6b7280; font-size: 12px; }
    .card .value { font-size: 20px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .amount { text-align: right; font-family: monospace; }
    .positive { color: #059669; }
    .negative { color: #dc2626; }
    @media print { body { max-width: none; } }
  </style>
</head>
<body>
  <h1>${data.account.name}</h1>
  <p style="color: #6b7280;">${data.account.type} - ${data.account.currency}</p>

  <div class="summary">
    <div class="card">
      <h3>Solde actuel</h3>
      <div class="value">${this.formatCurrency(data.account.currentBalance, data.account.currency)}</div>
    </div>
    <div class="card">
      <h3>Transactions</h3>
      <div class="value">${data.summary.totalTransactions}</div>
    </div>
    <div class="card">
      <h3>Variation nette</h3>
      <div class="value" style="color: ${data.summary.netChange >= 0 ? '#059669' : '#dc2626'}">${this.formatCurrency(data.summary.netChange, data.account.currency)}</div>
    </div>
  </div>

  <h2>Transactions</h2>
  <table>
    <thead>
      <tr><th>Date</th><th>Description</th><th>Catégorie</th><th class="amount">Montant</th></tr>
    </thead>
    <tbody>
      ${data.transactions.map((t) => `
        <tr>
          <td>${new Date(t.date).toLocaleDateString('fr-FR')}</td>
          <td>${t.description}</td>
          <td>${t.category}</td>
          <td class="amount ${t.amount >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(t.amount, data.account.currency)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
    Généré le ${new Date().toLocaleDateString('fr-FR')} - Finance Hub
  </footer>
</body>
</html>`;
  },

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  getDateString(): string {
    return new Date().toISOString().split('T')[0] ?? '';
  },

  formatCurrency(amount: number, currency: string = 'EUR', locale: string = 'fr-FR'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount);
  },

  formatDate(date: Date | string, locale: string = 'fr-FR'): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(dateObj);
  },

  /**
   * Get locale for a workspace based on owner's country
   */
  async getWorkspaceLocale(workspaceId: string): Promise<string> {
    const membership = await prisma.membership.findFirst({
      where: { workspaceId, role: 'owner' },
      include: { user: { select: { locale: true, country: true } } },
    });
    if (membership?.user?.locale) return membership.user.locale;
    const country = membership?.user?.country || 'FR';
    return country === 'CH' ? 'de-CH' : 'fr-FR';
  },

  /**
   * Restore workspace data from a backup
   */
  async restoreFromBackup(
    workspaceId: string,
    backup: FullBackupData,
    options: { merge?: boolean } = {}
  ): Promise<{ imported: { accounts: number; categories: number; tags: number; transactions: number; budgets: number; rules: number; recurrences: number }; errors: string[] }> {
    const errors: string[] = [];
    const imported = {
      accounts: 0,
      categories: 0,
      tags: 0,
      transactions: 0,
      budgets: 0,
      rules: 0,
      recurrences: 0,
    };

    // Create maps for ID lookups (name -> new id)
    const accountMap = new Map<string, string>();
    const categoryMap = new Map<string, string>();
    const tagMap = new Map<string, string>();

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Import categories first (they may have parent relationships)
        for (const cat of backup.categories ?? []) {
          try {
            const existing = await tx.category.findFirst({
              where: { workspaceId, name: cat.name },
            });

            if (existing) {
              categoryMap.set(cat.name, existing.id);
              if (options.merge) continue;
            }

            if (!existing) {
              const created = await tx.category.create({
                data: {
                  workspaceId,
                  name: cat.name,
                  type: cat.type as 'income' | 'expense',
                },
              });
              categoryMap.set(cat.name, created.id);
              imported.categories++;
            }
          } catch (e) {
            errors.push(`Category ${cat.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
        }

        // 2. Update parent categories
        for (const cat of backup.categories ?? []) {
          if (cat.parentCategory) {
            const parentId = categoryMap.get(cat.parentCategory);
            const catId = categoryMap.get(cat.name);
            if (parentId && catId) {
              await tx.category.update({
                where: { id: catId },
                data: { parentId },
              });
            }
          }
        }

        // 3. Import tags
        for (const tag of backup.tags ?? []) {
          try {
            const existing = await tx.tag.findFirst({
              where: { workspaceId, name: tag.name },
            });

            if (existing) {
              tagMap.set(tag.name, existing.id);
              continue;
            }

            const created = await tx.tag.create({
              data: {
                workspaceId,
                name: tag.name,
                color: tag.color,
              },
            });
            tagMap.set(tag.name, created.id);
            imported.tags++;
          } catch (e) {
            errors.push(`Tag ${tag.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
        }

        // 4. Import accounts
        for (const acc of backup.accounts ?? []) {
          try {
            const existing = await tx.account.findFirst({
              where: { workspaceId, name: acc.name, deletedAt: null },
            });

            if (existing) {
              accountMap.set(acc.name, existing.id);
              if (options.merge) continue;
            }

            if (!existing) {
              const created = await tx.account.create({
                data: {
                  workspaceId,
                  name: acc.name,
                  type: acc.type as 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash' | 'loan',
                  currency: acc.currency,
                  balance: acc.balance,
                  isArchived: acc.isArchived,
                },
              });
              accountMap.set(acc.name, created.id);
              imported.accounts++;
            }
          } catch (e) {
            errors.push(`Account ${acc.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
        }

        // 5. Import transactions
        for (const txn of backup.transactions ?? []) {
          try {
            const accountId = accountMap.get(txn.account);
            if (!accountId) {
              errors.push(`Transaction ${txn.description}: Account not found`);
              continue;
            }

            const categoryId = txn.category ? categoryMap.get(txn.category) : undefined;

            const created = await tx.transaction.create({
              data: {
                workspaceId,
                accountId,
                categoryId,
                description: txn.description,
                amount: txn.amount,
                currency: txn.currency,
                type: txn.type as 'income' | 'expense' | 'transfer',
                status: txn.status as 'pending' | 'cleared' | 'reconciled',
                date: new Date(txn.date),
                notes: txn.notes || undefined,
              },
            });

            // Add tags
            if (txn.tags) {
              const tagNames = txn.tags.split(',').map((t) => t.trim()).filter(Boolean);
              for (const tagName of tagNames) {
                const tagId = tagMap.get(tagName);
                if (tagId) {
                  await tx.transactionTag.create({
                    data: { transactionId: created.id, tagId },
                  });
                }
              }
            }

            imported.transactions++;
          } catch (e) {
            errors.push(`Transaction ${txn.description}: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
        }

        // 6. Import budgets
        for (const budget of backup.budgets ?? []) {
          try {
            const categoryId = categoryMap.get(budget.category);
            if (!categoryId) {
              errors.push(`Budget ${budget.name}: Category not found`);
              continue;
            }

            const existing = await tx.budget.findFirst({
              where: { workspaceId, name: budget.name },
            });

            if (existing && options.merge) continue;

            if (!existing) {
              await tx.budget.create({
                data: {
                  workspaceId,
                  categoryId,
                  name: budget.name,
                  amount: budget.amount,
                  period: budget.period as 'monthly' | 'yearly',
                  alertThreshold: budget.alertThreshold,
                  startDate: new Date(),
                },
              });
              imported.budgets++;
            }
          } catch (e) {
            errors.push(`Budget ${budget.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
        }

        // 7. Import rules
        for (const rule of backup.rules ?? []) {
          try {
            const existing = await tx.rule.findFirst({
              where: { workspaceId, name: rule.name },
            });

            if (existing && options.merge) continue;

            if (!existing) {
              await tx.rule.create({
                data: {
                  workspaceId,
                  name: rule.name,
                  conditions: rule.conditions as any,
                  actions: rule.actions as any,
                  isEnabled: rule.isEnabled,
                  priority: 0,
                },
              });
              imported.rules++;
            }
          } catch (e) {
            errors.push(`Rule ${rule.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
        }

        // 8. Import recurrences
        for (const rec of backup.recurrences ?? []) {
          try {
            const existing = await tx.recurrence.findFirst({
              where: { workspaceId, name: rec.name },
            });

            if (existing && options.merge) continue;

            if (!existing) {
              await tx.recurrence.create({
                data: {
                  workspaceId,
                  name: rec.name,
                  frequency: rec.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly',
                  template: rec.template as any,
                  isActive: rec.isActive,
                  nextRunAt: new Date(),
                },
              });
              imported.recurrences++;
            }
          } catch (e) {
            errors.push(`Recurrence ${rec.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
        }
      });
    } catch (e) {
      errors.push(`Transaction failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    return { imported, errors };
  },
};

export default exportService;
