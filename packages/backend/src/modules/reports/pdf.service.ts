// ============================================================================
// PDF SERVICE - Finance Hub
// Generate PDF reports for transactions, budgets, monthly and annual summaries
// Uses PDFKit with HubCompta branding and Catppuccin color scheme
// ============================================================================

import PDFDocument from 'pdfkit';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, eachMonthOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { prisma } from '@/core/database/client.js';
import { reportService } from './report.service.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: 'income' | 'expense' | 'transfer';
  search?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface PDFResult {
  filename: string;
  mimeType: string;
  content: Buffer;
  size: number;
}

interface TransactionForPDF {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: string;
  category: { name: string; icon: string | null } | null;
  account: { name: string; currency: string };
}

// ----------------------------------------------------------------------------
// Catppuccin Colors for Print
// ----------------------------------------------------------------------------

const COLORS = {
  // Primary colors for print (dark text on light background)
  text: '#1e1e2e',
  subtext: '#6c7086',
  surface: '#f5f5f5',
  base: '#ffffff',
  // Accent colors
  blue: '#1e66f5',
  green: '#40a02b',
  red: '#d20f39',
  yellow: '#df8e1d',
  mauve: '#8839ef',
  // Brand color
  brand: '#1e66f5',
};

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency: string = 'EUR', locale: string = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatDateFR(date: Date): string {
  return format(date, 'dd/MM/yyyy', { locale: fr });
}

function formatMonthYear(date: Date): string {
  return format(date, 'MMMM yyyy', { locale: fr });
}

// ----------------------------------------------------------------------------
// PDF Document Helpers
// ----------------------------------------------------------------------------

function addHeader(doc: PDFKit.PDFDocument, title: string, subtitle?: string): void {
  // Logo/Brand text
  doc
    .fontSize(10)
    .fillColor(COLORS.brand)
    .text('HubCompta', 50, 30, { continued: true })
    .fillColor(COLORS.subtext)
    .text(` - ${format(new Date(), "dd/MM/yyyy 'a' HH:mm", { locale: fr })}`);

  // Title
  doc
    .moveDown(2)
    .fontSize(24)
    .fillColor(COLORS.text)
    .text(title, { align: 'center' });

  if (subtitle) {
    doc
      .fontSize(12)
      .fillColor(COLORS.subtext)
      .text(subtitle, { align: 'center' });
  }

  // Separator line
  doc
    .moveDown(1)
    .strokeColor(COLORS.surface)
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(doc.page.width - 50, doc.y)
    .stroke();

  doc.moveDown(1);
}

function addUserInfo(doc: PDFKit.PDFDocument, userName: string, workspaceName: string): void {
  doc
    .fontSize(10)
    .fillColor(COLORS.subtext)
    .text(`Utilisateur: ${userName}`, 50)
    .text(`Espace de travail: ${workspaceName}`);

  doc.moveDown(1);
}

function addSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  doc
    .fontSize(14)
    .fillColor(COLORS.blue)
    .text(title);

  // Underline
  const y = doc.y;
  doc
    .strokeColor(COLORS.blue)
    .lineWidth(1)
    .moveTo(50, y)
    .lineTo(180, y)
    .stroke();

  doc.moveDown(0.5);
}

function addTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  columnWidths?: number[],
  alignments?: ('left' | 'right' | 'center')[]
): void {
  const startX = 50;
  const pageWidth = doc.page.width - 100;
  const colCount = headers.length;
  const defaultWidth = pageWidth / colCount;
  const widths = columnWidths || headers.map(() => defaultWidth);
  const aligns = alignments || headers.map((_, i) => (i === 0 ? 'left' : 'right'));

  // Header row background
  doc.rect(startX, doc.y - 2, pageWidth, 18).fill(COLORS.surface);

  // Header text
  let x = startX;
  doc.fontSize(9).fillColor(COLORS.text).font('Helvetica-Bold');

  const headerY = doc.y;
  for (let i = 0; i < headers.length; i++) {
    const align = aligns[i] ?? 'left';
    doc.text(headers[i] ?? '', x + 4, headerY, { width: (widths[i] ?? defaultWidth) - 8, align });
    x += widths[i] ?? defaultWidth;
  }

  doc.moveDown(0.8);

  // Data rows
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);

  for (const row of rows) {
    x = startX;
    const rowY = doc.y;

    for (let i = 0; i < row.length; i++) {
      const align = aligns[i] ?? 'left';
      doc.text(row[i] ?? '', x + 4, rowY, { width: (widths[i] ?? defaultWidth) - 8, align });
      x += widths[i] ?? defaultWidth;
    }

    doc.moveDown(0.5);

    // Light separator
    doc
      .strokeColor('#e0e0e0')
      .lineWidth(0.5)
      .moveTo(startX, doc.y)
      .lineTo(startX + pageWidth, doc.y)
      .stroke();

    doc.moveDown(0.3);

    // Check for page break
    if (doc.y > doc.page.height - 100) {
      doc.addPage();
    }
  }

  doc.moveDown(0.5);
}

function addSummaryBox(
  doc: PDFKit.PDFDocument,
  items: Array<{ label: string; value: string; color?: string }>
): void {
  const startX = 50;
  const boxWidth = (doc.page.width - 100) / items.length;
  const startY = doc.y;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const x = startX + i * boxWidth;

    // Box background
    doc.rect(x, startY, boxWidth - 8, 50).fill(COLORS.surface);

    // Label
    doc
      .fontSize(9)
      .fillColor(COLORS.subtext)
      .text(item.label, x + 8, startY + 8, { width: boxWidth - 16 });

    // Value
    doc
      .fontSize(14)
      .fillColor(item.color || COLORS.text)
      .font('Helvetica-Bold')
      .text(item.value, x + 8, startY + 26, { width: boxWidth - 16 });
  }

  doc.y = startY + 60;
  doc.font('Helvetica');
  doc.moveDown(1);
}

function addFooter(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    // Footer line
    doc
      .strokeColor(COLORS.surface)
      .lineWidth(0.5)
      .moveTo(50, doc.page.height - 50)
      .lineTo(doc.page.width - 50, doc.page.height - 50)
      .stroke();

    // Footer text
    doc
      .fontSize(8)
      .fillColor(COLORS.subtext)
      .text(
        `Genere par HubCompta - ${format(new Date(), "dd/MM/yyyy 'a' HH:mm", { locale: fr })}`,
        50,
        doc.page.height - 40,
        { align: 'left', width: doc.page.width - 100 }
      )
      .text(
        `Page ${i + 1} / ${totalPages}`,
        50,
        doc.page.height - 40,
        { align: 'right', width: doc.page.width - 100 }
      );
  }
}

// ----------------------------------------------------------------------------
// PDF Service
// ----------------------------------------------------------------------------

export const pdfService = {
  // --------------------------------------------------------------------------
  // Generate Transaction Report PDF
  // --------------------------------------------------------------------------
  async generateTransactionReport(
    userId: string,
    filters: TransactionFilters,
    dateRange: DateRange
  ): Promise<PDFResult> {
    return new Promise(async (resolve, reject) => {
      try {
        // Get user info
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, displayName: true },
        });

        // Get user's workspaces
        const membership = await prisma.membership.findFirst({
          where: { userId },
          include: { workspace: true },
        });

        if (!membership) {
          throw new Error('No workspace found for user');
        }

        const workspaceId = membership.workspaceId;
        const workspaceName = membership.workspace.name;

        // Build transaction query conditions
        const conditions: Record<string, unknown> = {
          account: { workspaceId },
          date: { gte: dateRange.from, lte: dateRange.to },
          transferPairId: null,
        };

        if (filters.accountId) {
          conditions.accountId = filters.accountId;
        }
        if (filters.categoryId) {
          conditions.categoryId = filters.categoryId;
        }
        if (filters.search) {
          conditions.description = { contains: filters.search, mode: 'insensitive' };
        }
        if (filters.type === 'income') {
          conditions.amount = { gt: 0 };
        } else if (filters.type === 'expense') {
          conditions.amount = { lt: 0 };
        }
        if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
          conditions.amount = {
            ...(filters.minAmount !== undefined ? { gte: filters.minAmount } : {}),
            ...(filters.maxAmount !== undefined ? { lte: filters.maxAmount } : {}),
          };
        }

        // Fetch transactions
        const transactions = await prisma.transaction.findMany({
          where: conditions,
          include: {
            category: { select: { name: true, icon: true } },
            account: { select: { name: true, currency: true } },
          },
          orderBy: { date: 'desc' },
          take: 500, // Limit for PDF
        });

        // Calculate totals
        const totalIncome = transactions
          .filter((t) => Number(t.amount) > 0)
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const totalExpenses = Math.abs(
          transactions
            .filter((t) => Number(t.amount) < 0)
            .reduce((sum, t) => sum + Number(t.amount), 0)
        );
        const netTotal = totalIncome - totalExpenses;

        // Create PDF
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 60, left: 50, right: 50 },
          bufferPages: true,
          info: {
            Title: 'Rapport des Transactions',
            Author: 'HubCompta',
            Subject: `Transactions du ${formatDateFR(dateRange.from)} au ${formatDateFR(dateRange.to)}`,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          const content = Buffer.concat(chunks);
          resolve({
            filename: `transactions_${format(dateRange.from, 'yyyyMMdd')}_${format(dateRange.to, 'yyyyMMdd')}.pdf`,
            mimeType: 'application/pdf',
            content,
            size: content.length,
          });
        });
        doc.on('error', reject);

        // Header
        addHeader(
          doc,
          'Rapport des Transactions',
          `Du ${formatDateFR(dateRange.from)} au ${formatDateFR(dateRange.to)}`
        );

        // User info
        const userName = user?.displayName || user?.email || 'Utilisateur';
        addUserInfo(doc, userName, workspaceName);

        // Summary
        addSummaryBox(doc, [
          { label: 'Nombre de transactions', value: transactions.length.toString() },
          { label: 'Revenus', value: formatCurrency(totalIncome), color: COLORS.green },
          { label: 'Depenses', value: formatCurrency(totalExpenses), color: COLORS.red },
          { label: 'Solde net', value: formatCurrency(netTotal), color: netTotal >= 0 ? COLORS.green : COLORS.red },
        ]);

        // Transactions table
        addSectionTitle(doc, 'Detail des transactions');

        const rows = transactions.map((t) => [
          formatDateFR(t.date),
          t.description.slice(0, 30),
          t.category?.name || 'Non categorise',
          t.account.name,
          formatCurrency(Number(t.amount), t.account.currency),
        ]);

        addTable(
          doc,
          ['Date', 'Description', 'Categorie', 'Compte', 'Montant'],
          rows,
          [70, 150, 100, 80, 80],
          ['left', 'left', 'left', 'left', 'right']
        );

        // Footer
        addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  },

  // --------------------------------------------------------------------------
  // Generate Budget Report PDF
  // --------------------------------------------------------------------------
  async generateBudgetReport(userId: string, month: Date): Promise<PDFResult> {
    return new Promise(async (resolve, reject) => {
      try {
        // Get user info
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, displayName: true },
        });

        const membership = await prisma.membership.findFirst({
          where: { userId },
          include: { workspace: true },
        });

        if (!membership) {
          throw new Error('No workspace found for user');
        }

        const workspaceId = membership.workspaceId;
        const workspaceName = membership.workspace.name;

        // Get budget vs actual data
        const from = startOfMonth(month);
        const to = endOfMonth(month);
        const budgetReport = await reportService.getBudgetVsActualReport(workspaceId, { from, to });

        // Create PDF
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 60, left: 50, right: 50 },
          bufferPages: true,
          info: {
            Title: 'Rapport Budget',
            Author: 'HubCompta',
            Subject: `Budget ${formatMonthYear(month)}`,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          const content = Buffer.concat(chunks);
          resolve({
            filename: `budget_${format(month, 'yyyy_MM')}.pdf`,
            mimeType: 'application/pdf',
            content,
            size: content.length,
          });
        });
        doc.on('error', reject);

        // Header
        addHeader(doc, 'Rapport Budget', formatMonthYear(month));

        // User info
        const userName = user?.displayName || user?.email || 'Utilisateur';
        addUserInfo(doc, userName, workspaceName);

        // Summary
        addSummaryBox(doc, [
          { label: 'Budget total', value: formatCurrency(budgetReport.totalBudget) },
          { label: 'Realise', value: formatCurrency(budgetReport.totalActual) },
          { label: 'Ecart', value: formatCurrency(budgetReport.totalVariance), color: budgetReport.totalVariance >= 0 ? COLORS.green : COLORS.red },
          { label: 'Ecart %', value: formatPercent(budgetReport.totalVariancePercent), color: budgetReport.totalVariance >= 0 ? COLORS.green : COLORS.red },
        ]);

        // Budget detail table
        addSectionTitle(doc, 'Detail par categorie');

        const rows = budgetReport.categories.map((c) => [
          c.categoryName,
          formatCurrency(c.budgeted),
          formatCurrency(c.actual),
          formatCurrency(c.variance),
          c.status === 'under' ? 'Sous budget' : c.status === 'on_track' ? 'Dans les clous' : 'Depasse',
        ]);

        addTable(
          doc,
          ['Categorie', 'Budget', 'Realise', 'Ecart', 'Statut'],
          rows,
          [140, 90, 90, 90, 80],
          ['left', 'right', 'right', 'right', 'center']
        );

        // Over budget warning
        const overBudgetCategories = budgetReport.categories.filter((c) => c.status === 'over');
        if (overBudgetCategories.length > 0) {
          doc.moveDown(1);
          doc
            .fontSize(10)
            .fillColor(COLORS.red)
            .text(`Attention: ${overBudgetCategories.length} categorie(s) ont depasse leur budget.`);
        }

        // Footer
        addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  },

  // --------------------------------------------------------------------------
  // Generate Monthly Report PDF
  // --------------------------------------------------------------------------
  async generateMonthlyReport(userId: string, month: Date): Promise<PDFResult> {
    return new Promise(async (resolve, reject) => {
      try {
        // Get user info
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, displayName: true },
        });

        const membership = await prisma.membership.findFirst({
          where: { userId },
          include: { workspace: true },
        });

        if (!membership) {
          throw new Error('No workspace found for user');
        }

        const workspaceId = membership.workspaceId;
        const workspaceName = membership.workspace.name;

        const from = startOfMonth(month);
        const to = endOfMonth(month);

        // Get various reports
        const [cashFlow, budgetReport, categoryTrends] = await Promise.all([
          reportService.getCashFlowReport(workspaceId, { from, to }),
          reportService.getBudgetVsActualReport(workspaceId, { from, to }),
          reportService.getCategoryTrends(workspaceId, { from, to }),
        ]);

        // Get top transactions
        const topExpenses = await prisma.transaction.findMany({
          where: {
            account: { workspaceId },
            date: { gte: from, lte: to },
            amount: { lt: 0 },
            transferPairId: null,
          },
          include: {
            category: { select: { name: true } },
            account: { select: { name: true, currency: true } },
          },
          orderBy: { amount: 'asc' },
          take: 10,
        });

        // Create PDF
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 60, left: 50, right: 50 },
          bufferPages: true,
          info: {
            Title: 'Rapport Mensuel',
            Author: 'HubCompta',
            Subject: `Rapport mensuel ${formatMonthYear(month)}`,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          const content = Buffer.concat(chunks);
          resolve({
            filename: `rapport_mensuel_${format(month, 'yyyy_MM')}.pdf`,
            mimeType: 'application/pdf',
            content,
            size: content.length,
          });
        });
        doc.on('error', reject);

        // Header
        addHeader(doc, 'Rapport Mensuel', formatMonthYear(month));

        // User info
        const userName = user?.displayName || user?.email || 'Utilisateur';
        addUserInfo(doc, userName, workspaceName);

        // Cash flow summary
        addSummaryBox(doc, [
          { label: 'Revenus', value: formatCurrency(cashFlow.operating.income), color: COLORS.green },
          { label: 'Depenses', value: formatCurrency(cashFlow.operating.expenses), color: COLORS.red },
          { label: 'Epargne nette', value: formatCurrency(cashFlow.operating.net), color: cashFlow.operating.net >= 0 ? COLORS.green : COLORS.red },
          { label: 'Taux d\'epargne', value: cashFlow.operating.income > 0 ? formatPercent((cashFlow.operating.net / cashFlow.operating.income) * 100) : '0%' },
        ]);

        // Budget overview
        addSectionTitle(doc, 'Suivi du budget');

        const budgetRows = budgetReport.categories.slice(0, 10).map((c) => [
          c.categoryName,
          formatCurrency(c.budgeted),
          formatCurrency(c.actual),
          c.status === 'under' ? 'OK' : c.status === 'on_track' ? 'OK' : 'DEPASSE',
        ]);

        addTable(
          doc,
          ['Categorie', 'Budget', 'Depense', 'Statut'],
          budgetRows,
          [180, 100, 100, 80],
          ['left', 'right', 'right', 'center']
        );

        // Top expenses
        doc.addPage();
        addSectionTitle(doc, 'Top 10 des depenses');

        const expenseRows = topExpenses.map((t) => [
          formatDateFR(t.date),
          t.description.slice(0, 35),
          t.category?.name || 'Non categorise',
          formatCurrency(Math.abs(Number(t.amount)), t.account.currency),
        ]);

        addTable(
          doc,
          ['Date', 'Description', 'Categorie', 'Montant'],
          expenseRows,
          [70, 180, 120, 100],
          ['left', 'left', 'left', 'right']
        );

        // Category breakdown
        addSectionTitle(doc, 'Repartition par categorie');

        const categoryRows = categoryTrends.slice(0, 10).map((c) => [
          c.categoryName,
          formatCurrency(c.total),
          `${((c.total / cashFlow.operating.expenses) * 100).toFixed(1)}%`,
        ]);

        addTable(
          doc,
          ['Categorie', 'Total', 'Part'],
          categoryRows,
          [200, 120, 80],
          ['left', 'right', 'right']
        );

        // Footer
        addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  },

  // --------------------------------------------------------------------------
  // Generate Annual Report PDF
  // --------------------------------------------------------------------------
  async generateAnnualReport(userId: string, year: number): Promise<PDFResult> {
    return new Promise(async (resolve, reject) => {
      try {
        // Get user info
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, displayName: true },
        });

        const membership = await prisma.membership.findFirst({
          where: { userId },
          include: { workspace: true },
        });

        if (!membership) {
          throw new Error('No workspace found for user');
        }

        const workspaceId = membership.workspaceId;
        const workspaceName = membership.workspace.name;

        const from = startOfYear(new Date(year, 0, 1));
        const to = endOfYear(new Date(year, 0, 1));

        // Get year over year data
        const yearComparison = await reportService.generateYearOverYear(workspaceId, year);
        const netWorthReport = await reportService.generateNetWorthReport(workspaceId, 12);

        // Get monthly data
        const months = eachMonthOfInterval({ start: from, end: to });
        const monthlyData: Array<{ month: string; income: number; expenses: number; net: number }> = [];

        for (const month of months) {
          const monthStart = startOfMonth(month);
          const monthEnd = endOfMonth(month);
          const cashFlow = await reportService.getCashFlowReport(workspaceId, { from: monthStart, to: monthEnd });
          monthlyData.push({
            month: format(month, 'MMM', { locale: fr }),
            income: cashFlow.operating.income,
            expenses: cashFlow.operating.expenses,
            net: cashFlow.operating.net,
          });
        }

        // Create PDF
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 60, left: 50, right: 50 },
          bufferPages: true,
          info: {
            Title: 'Rapport Annuel',
            Author: 'HubCompta',
            Subject: `Rapport annuel ${year}`,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          const content = Buffer.concat(chunks);
          resolve({
            filename: `rapport_annuel_${year}.pdf`,
            mimeType: 'application/pdf',
            content,
            size: content.length,
          });
        });
        doc.on('error', reject);

        // Header
        addHeader(doc, 'Rapport Annuel', `Annee ${year}`);

        // User info
        const userName = user?.displayName || user?.email || 'Utilisateur';
        addUserInfo(doc, userName, workspaceName);

        // Annual summary
        const { summary } = yearComparison;
        addSummaryBox(doc, [
          { label: 'Revenus totaux', value: formatCurrency(summary.currentYear.income), color: COLORS.green },
          { label: 'Depenses totales', value: formatCurrency(summary.currentYear.expenses), color: COLORS.red },
          { label: 'Epargne nette', value: formatCurrency(summary.currentYear.net), color: summary.currentYear.net >= 0 ? COLORS.green : COLORS.red },
          { label: 'Taux d\'epargne', value: `${summary.currentYear.savingsRate.toFixed(1)}%` },
        ]);

        // Year over year comparison
        addSectionTitle(doc, `Comparaison ${year} vs ${year - 1}`);

        addTable(
          doc,
          ['Indicateur', `${year}`, `${year - 1}`, 'Evolution'],
          [
            ['Revenus', formatCurrency(summary.currentYear.income), formatCurrency(summary.previousYear.income), formatPercent(summary.changes.incomePercent)],
            ['Depenses', formatCurrency(summary.currentYear.expenses), formatCurrency(summary.previousYear.expenses), formatPercent(summary.changes.expensesPercent)],
            ['Epargne', formatCurrency(summary.currentYear.net), formatCurrency(summary.previousYear.net), formatPercent(summary.changes.netPercent)],
          ],
          [120, 120, 120, 100],
          ['left', 'right', 'right', 'right']
        );

        // Monthly breakdown
        doc.addPage();
        addSectionTitle(doc, 'Evolution mensuelle');

        const monthlyRows = monthlyData.map((m) => [
          m.month,
          formatCurrency(m.income),
          formatCurrency(m.expenses),
          formatCurrency(m.net),
        ]);

        addTable(
          doc,
          ['Mois', 'Revenus', 'Depenses', 'Net'],
          monthlyRows,
          [80, 130, 130, 130],
          ['left', 'right', 'right', 'right']
        );

        // Category comparison
        addSectionTitle(doc, 'Depenses par categorie');

        const categoryRows = yearComparison.categories.slice(0, 15).map((c) => [
          c.categoryName,
          formatCurrency(c.currentYear),
          formatCurrency(c.previousYear),
          formatPercent(c.changePercent),
        ]);

        addTable(
          doc,
          ['Categorie', `${year}`, `${year - 1}`, 'Evolution'],
          categoryRows,
          [150, 100, 100, 100],
          ['left', 'right', 'right', 'right']
        );

        // Net worth summary
        doc.addPage();
        addSectionTitle(doc, 'Evolution du patrimoine');

        doc
          .fontSize(11)
          .fillColor(COLORS.text)
          .text(`Patrimoine actuel: ${formatCurrency(netWorthReport.currentNetWorth)}`, { continued: true })
          .fillColor(netWorthReport.change >= 0 ? COLORS.green : COLORS.red)
          .text(` (${formatPercent(netWorthReport.changePercent)})`);

        doc.moveDown(0.5);

        // Assets and liabilities summary
        addTable(
          doc,
          ['Type', 'Montant'],
          [
            ['Total Actifs', formatCurrency(netWorthReport.assets.total)],
            ['Total Passifs', formatCurrency(netWorthReport.liabilities.total)],
            ['Patrimoine Net', formatCurrency(netWorthReport.currentNetWorth)],
          ],
          [300, 180],
          ['left', 'right']
        );

        // Notes
        doc.moveDown(1);
        doc
          .fontSize(9)
          .fillColor(COLORS.subtext)
          .text('Note: Ce rapport est genere automatiquement par HubCompta. Les montants sont calcules sur la base des transactions enregistrees.');

        // Footer
        addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  },
};

export default pdfService;
