// ============================================================================
// EXPORT SERVICE - Finance Hub
// Generate CSV and PDF exports
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { reportService } from './report.service.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface ExportOptions {
  workspaceId: string;
  format: 'csv' | 'json';
  type: 'transactions' | 'categories' | 'accounts' | 'budget_report' | 'cash_flow' | 'profit_loss';
  dateRange?: {
    from: Date;
    to: Date;
  };
  accountIds?: string[];
  categoryIds?: string[];
  includeHeaders?: boolean;
}

export interface ExportResult {
  filename: string;
  mimeType: string;
  content: string | Buffer;
  size: number;
}

// ----------------------------------------------------------------------------
// CSV Helpers
// ----------------------------------------------------------------------------

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCSVRow(values: unknown[]): string {
  return values.map(escapeCSV).join(',');
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy', { locale: fr });
}

function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy HH:mm', { locale: fr });
}

function formatAmount(amount: number): string {
  return amount.toFixed(2).replace('.', ',');
}

// ----------------------------------------------------------------------------
// Export Service
// ----------------------------------------------------------------------------

export const exportService = {
  // --------------------------------------------------------------------------
  // Main Export Method
  // --------------------------------------------------------------------------
  async export(options: ExportOptions): Promise<ExportResult> {
    switch (options.type) {
      case 'transactions':
        return this.exportTransactions(options);
      case 'categories':
        return this.exportCategories(options);
      case 'accounts':
        return this.exportAccounts(options);
      case 'budget_report':
        return this.exportBudgetReport(options);
      case 'cash_flow':
        return this.exportCashFlow(options);
      case 'profit_loss':
        return this.exportProfitLoss(options);
      default:
        throw new Error(`Export type not supported: ${options.type}`);
    }
  },

  // --------------------------------------------------------------------------
  // Export Transactions
  // --------------------------------------------------------------------------
  async exportTransactions(options: ExportOptions): Promise<ExportResult> {
    const { workspaceId, dateRange, accountIds, categoryIds, format: exportFormat } = options;

    const transactions = await prisma.transaction.findMany({
      where: {
        account: {
          workspaceId,
          ...(accountIds?.length ? { id: { in: accountIds } } : {}),
        },
        ...(dateRange
          ? {
              date: {
                gte: dateRange.from,
                lte: dateRange.to,
              },
            }
          : {}),
        ...(categoryIds?.length ? { categoryId: { in: categoryIds } } : {}),
      },
      include: {
        account: { select: { name: true } },
        category: { select: { name: true } },
        tags: { select: { tag: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
    });

    if (exportFormat === 'json') {
      const content = JSON.stringify(
        transactions.map((t) => ({
          date: formatDate(t.date),
          description: t.description,
          amount: Number(t.amount),
          account: t.account.name,
          category: t.category?.name || '',
          tags: t.tags.map((tt) => tt.tag.name).join(', '),
          notes: t.notes || '',
          status: t.status,
        })),
        null,
        2
      );

      return {
        filename: `transactions_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`,
        mimeType: 'application/json',
        content,
        size: Buffer.byteLength(content, 'utf8'),
      };
    }

    // CSV format
    const headers = [
      'Date',
      'Description',
      'Montant',
      'Compte',
      'Catégorie',
      'Tags',
      'Notes',
      'Statut',
    ];

    const rows = transactions.map((t) =>
      formatCSVRow([
        formatDate(t.date),
        t.description,
        formatAmount(Number(t.amount)),
        t.account.name,
        t.category?.name || '',
        t.tags.map((tt) => tt.tag.name).join('; '),
        t.notes || '',
        t.status,
      ])
    );

    const content = [formatCSVRow(headers), ...rows].join('\n');

    return {
      filename: `transactions_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      content: '\ufeff' + content, // BOM for Excel
      size: Buffer.byteLength(content, 'utf8'),
    };
  },

  // --------------------------------------------------------------------------
  // Export Categories
  // --------------------------------------------------------------------------
  async exportCategories(options: ExportOptions): Promise<ExportResult> {
    const { workspaceId, format: exportFormat } = options;

    const categories = await prisma.category.findMany({
      where: { workspaceId },
      include: {
        parent: { select: { name: true } },
        _count: { select: { transactions: true } },
      },
      orderBy: { name: 'asc' },
    });

    if (exportFormat === 'json') {
      const content = JSON.stringify(
        categories.map((c) => ({
          name: c.name,
          type: c.type,
          parent: c.parent?.name || '',
          color: c.color || '',
          icon: c.icon || '',
          transactionCount: c._count.transactions,
        })),
        null,
        2
      );

      return {
        filename: `categories_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`,
        mimeType: 'application/json',
        content,
        size: Buffer.byteLength(content, 'utf8'),
      };
    }

    const headers = ['Nom', 'Type', 'Catégorie parente', 'Couleur', 'Icône', 'Nb transactions'];

    const rows = categories.map((c) =>
      formatCSVRow([
        c.name,
        c.type === 'expense' ? 'Dépense' : c.type === 'income' ? 'Revenu' : 'Les deux',
        c.parent?.name || '',
        c.color || '',
        c.icon || '',
        c._count.transactions,
      ])
    );

    const content = [formatCSVRow(headers), ...rows].join('\n');

    return {
      filename: `categories_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      content: '\ufeff' + content,
      size: Buffer.byteLength(content, 'utf8'),
    };
  },

  // --------------------------------------------------------------------------
  // Export Accounts
  // --------------------------------------------------------------------------
  async exportAccounts(options: ExportOptions): Promise<ExportResult> {
    const { workspaceId, format: exportFormat } = options;

    const accounts = await prisma.account.findMany({
      where: { workspaceId },
      include: {
        _count: { select: { transactions: true } },
      },
      orderBy: { name: 'asc' },
    });

    if (exportFormat === 'json') {
      const content = JSON.stringify(
        accounts.map((a) => ({
          name: a.name,
          type: a.type,
          currency: a.currency,
          balance: Number(a.balance),
          isArchived: a.isArchived,
          transactionCount: a._count.transactions,
        })),
        null,
        2
      );

      return {
        filename: `accounts_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`,
        mimeType: 'application/json',
        content,
        size: Buffer.byteLength(content, 'utf8'),
      };
    }

    const headers = ['Nom', 'Type', 'Devise', 'Solde', 'Archivé', 'Nb transactions'];

    const typeLabels: Record<string, string> = {
      checking: 'Compte courant',
      savings: 'Épargne',
      credit_card: 'Carte de crédit',
      investment: 'Investissement',
      loan: 'Prêt',
      cash: 'Espèces',
      other: 'Autre',
    };

    const rows = accounts.map((a) =>
      formatCSVRow([
        a.name,
        typeLabels[a.type] || a.type,
        a.currency,
        formatAmount(Number(a.balance)),
        a.isArchived ? 'Oui' : 'Non',
        a._count.transactions,
      ])
    );

    const content = [formatCSVRow(headers), ...rows].join('\n');

    return {
      filename: `accounts_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      content: '\ufeff' + content,
      size: Buffer.byteLength(content, 'utf8'),
    };
  },

  // --------------------------------------------------------------------------
  // Export Budget Report
  // --------------------------------------------------------------------------
  async exportBudgetReport(options: ExportOptions): Promise<ExportResult> {
    const { workspaceId, dateRange, format: exportFormat } = options;

    if (!dateRange) {
      throw new Error('Date range is required for budget report');
    }

    const report = await reportService.getBudgetVsActualReport(workspaceId, dateRange);

    if (exportFormat === 'json') {
      const content = JSON.stringify(report, null, 2);

      return {
        filename: `budget_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`,
        mimeType: 'application/json',
        content,
        size: Buffer.byteLength(content, 'utf8'),
      };
    }

    const headers = ['Catégorie', 'Budget', 'Réalisé', 'Écart', 'Écart %', 'Statut'];

    const statusLabels: Record<string, string> = {
      under: 'Sous budget',
      on_track: 'Dans les clous',
      over: 'Dépassement',
    };

    const rows = report.categories.map((c) =>
      formatCSVRow([
        c.categoryName,
        formatAmount(c.budgeted),
        formatAmount(c.actual),
        formatAmount(c.variance),
        formatAmount(c.variancePercent) + '%',
        statusLabels[c.status] || c.status,
      ])
    );

    // Add totals row
    rows.push(
      formatCSVRow([
        'TOTAL',
        formatAmount(report.totalBudget),
        formatAmount(report.totalActual),
        formatAmount(report.totalVariance),
        formatAmount(report.totalVariancePercent) + '%',
        '',
      ])
    );

    const periodInfo = `Période: ${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`;
    const content = [periodInfo, '', formatCSVRow(headers), ...rows].join('\n');

    return {
      filename: `budget_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      content: '\ufeff' + content,
      size: Buffer.byteLength(content, 'utf8'),
    };
  },

  // --------------------------------------------------------------------------
  // Export Cash Flow Report
  // --------------------------------------------------------------------------
  async exportCashFlow(options: ExportOptions): Promise<ExportResult> {
    const { workspaceId, dateRange, format: exportFormat } = options;

    if (!dateRange) {
      throw new Error('Date range is required for cash flow report');
    }

    const report = await reportService.getCashFlowReport(workspaceId, dateRange);

    if (exportFormat === 'json') {
      const content = JSON.stringify(report, null, 2);

      return {
        filename: `cash_flow_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`,
        mimeType: 'application/json',
        content,
        size: Buffer.byteLength(content, 'utf8'),
      };
    }

    const lines: string[] = [
      `RAPPORT DE FLUX DE TRÉSORERIE`,
      `Période: ${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`,
      '',
      'FLUX OPÉRATIONNELS',
      `  Revenus,${formatAmount(report.operating.income)}`,
      `  Dépenses,${formatAmount(report.operating.expenses)}`,
      `  Net opérationnel,${formatAmount(report.operating.net)}`,
      '',
      'FLUX D\'INVESTISSEMENT',
      `  Entrées,${formatAmount(report.investing.inflows)}`,
      `  Sorties,${formatAmount(report.investing.outflows)}`,
      `  Net investissement,${formatAmount(report.investing.net)}`,
      '',
      'RÉSUMÉ',
      `  Solde d'ouverture,${formatAmount(report.openingBalance)}`,
      `  Flux net total,${formatAmount(report.netCashFlow)}`,
      `  Solde de clôture,${formatAmount(report.closingBalance)}`,
    ];

    const content = lines.join('\n');

    return {
      filename: `cash_flow_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      content: '\ufeff' + content,
      size: Buffer.byteLength(content, 'utf8'),
    };
  },

  // --------------------------------------------------------------------------
  // Export Profit & Loss Report
  // --------------------------------------------------------------------------
  async exportProfitLoss(options: ExportOptions): Promise<ExportResult> {
    const { workspaceId, dateRange, format: exportFormat } = options;

    if (!dateRange) {
      throw new Error('Date range is required for profit & loss report');
    }

    const report = await reportService.getProfitLossReport(workspaceId, dateRange);

    if (exportFormat === 'json') {
      const content = JSON.stringify(report, null, 2);

      return {
        filename: `profit_loss_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`,
        mimeType: 'application/json',
        content,
        size: Buffer.byteLength(content, 'utf8'),
      };
    }

    const lines: string[] = [
      `COMPTE DE RÉSULTAT`,
      `Période: ${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`,
      '',
      'REVENUS',
      `  Total revenus,${formatAmount(report.revenue.total)}`,
      '',
      'CHARGES',
    ];

    // Add expense categories
    for (const cat of report.expenses.byCategory) {
      lines.push(`  ${cat.categoryName},${formatAmount(cat.amount)}`);
    }

    lines.push(
      `  Total charges,${formatAmount(report.expenses.total)}`,
      '',
      'RÉSULTAT',
      `  Résultat brut,${formatAmount(report.grossProfit)}`,
      `  Résultat net,${formatAmount(report.netProfit)}`,
      `  Marge nette,${formatAmount(report.profitMargin)}%`
    );

    const content = lines.join('\n');

    return {
      filename: `profit_loss_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      content: '\ufeff' + content,
      size: Buffer.byteLength(content, 'utf8'),
    };
  },

  // --------------------------------------------------------------------------
  // Export Invoices (Pro mode)
  // --------------------------------------------------------------------------
  async exportInvoices(
    workspaceId: string,
    dateRange?: { from: Date; to: Date },
    status?: string
  ): Promise<ExportResult> {
    const invoices = await prisma.invoice.findMany({
      where: {
        workspaceId,
        ...(dateRange
          ? {
              issueDate: {
                gte: dateRange.from,
                lte: dateRange.to,
              },
            }
          : {}),
        ...(status ? { status: status as 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' } : {}),
      },
      include: {
        contact: { select: { name: true } },
      },
      orderBy: { issueDate: 'desc' },
    });

    const headers = [
      'Numéro',
      'Date émission',
      'Date échéance',
      'Client',
      'Total HT',
      'TVA',
      'Total TTC',
      'Statut',
      'Date paiement',
    ];

    const statusLabels: Record<string, string> = {
      draft: 'Brouillon',
      sent: 'Envoyée',
      paid: 'Payée',
      overdue: 'En retard',
      cancelled: 'Annulée',
    };

    const rows = invoices.map((inv) =>
      formatCSVRow([
        inv.number,
        formatDate(inv.issueDate),
        formatDate(inv.dueDate),
        inv.contact.name,
        formatAmount(Number(inv.subtotal)),
        formatAmount(Number(inv.vatAmount)),
        formatAmount(Number(inv.total)),
        statusLabels[inv.status] || inv.status,
        inv.paidAt ? formatDate(inv.paidAt) : '',
      ])
    );

    const content = [formatCSVRow(headers), ...rows].join('\n');

    return {
      filename: `invoices_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      content: '\ufeff' + content,
      size: Buffer.byteLength(content, 'utf8'),
    };
  },

  // --------------------------------------------------------------------------
  // Export Quotes (Pro mode)
  // --------------------------------------------------------------------------
  async exportQuotes(
    workspaceId: string,
    dateRange?: { from: Date; to: Date },
    status?: string
  ): Promise<ExportResult> {
    const quotes = await prisma.quote.findMany({
      where: {
        workspaceId,
        ...(dateRange
          ? {
              issueDate: {
                gte: dateRange.from,
                lte: dateRange.to,
              },
            }
          : {}),
        ...(status ? { status: status as 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' } : {}),
      },
      include: {
        contact: { select: { name: true } },
      },
      orderBy: { issueDate: 'desc' },
    });

    const headers = [
      'Numéro',
      'Date émission',
      'Date validité',
      'Client',
      'Total HT',
      'TVA',
      'Total TTC',
      'Statut',
    ];

    const statusLabels: Record<string, string> = {
      draft: 'Brouillon',
      sent: 'Envoyé',
      accepted: 'Accepté',
      rejected: 'Refusé',
      expired: 'Expiré',
    };

    const rows = quotes.map((q) =>
      formatCSVRow([
        q.number,
        formatDate(q.issueDate),
        formatDate(q.validUntil),
        q.contact.name,
        formatAmount(Number(q.subtotal)),
        formatAmount(Number(q.vatAmount)),
        formatAmount(Number(q.total)),
        statusLabels[q.status] || q.status,
      ])
    );

    const content = [formatCSVRow(headers), ...rows].join('\n');

    return {
      filename: `quotes_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      content: '\ufeff' + content,
      size: Buffer.byteLength(content, 'utf8'),
    };
  },
};

export default exportService;
