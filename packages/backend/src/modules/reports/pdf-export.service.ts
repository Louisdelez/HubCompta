// ============================================================================
// PDF EXPORT SERVICE - Finance Hub
// Generate PDF reports using PDFKit
// ============================================================================

import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type PDFReportType =
  | 'net_worth'
  | 'year_comparison'
  | 'category_trends'
  | 'tax_summary'
  | 'cash_flow'
  | 'profit_loss'
  | 'budget_report';

export interface PDFExportOptions {
  title: string;
  subtitle?: string;
  period?: { from: Date; to: Date } | { year: number };
  currency?: string;
  locale?: string;
}

export interface PDFExportResult {
  filename: string;
  mimeType: string;
  content: Buffer;
  size: number;
}

// Catppuccin colors for PDF (Mocha palette)
const COLORS = {
  text: '#cdd6f4',
  subtext: '#a6adc8',
  surface: '#313244',
  base: '#1e1e2e',
  blue: '#89b4fa',
  green: '#a6e3a1',
  red: '#f38ba8',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  // For print, use darker colors
  printText: '#1e1e2e',
  printSubtext: '#6c7086',
  printSurface: '#f5f5f5',
  printBlue: '#1e66f5',
  printGreen: '#40a02b',
  printRed: '#d20f39',
};

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency: string = 'EUR', locale: string = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatDateRange(from: Date, to: Date): string {
  return `${format(from, 'dd/MM/yyyy', { locale: fr })} - ${format(to, 'dd/MM/yyyy', { locale: fr })}`;
}

// ----------------------------------------------------------------------------
// PDF Export Service
// ----------------------------------------------------------------------------

export const pdfExportService = {
  // --------------------------------------------------------------------------
  // Main PDF Generation Method
  // --------------------------------------------------------------------------
  async generateReportPDF(
    reportData: unknown,
    type: PDFReportType,
    options: PDFExportOptions
  ): Promise<PDFExportResult> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
          info: {
            Title: options.title,
            Author: 'Finance Hub',
            Subject: `Rapport ${type}`,
            Creator: 'Finance Hub PDF Export',
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          const content = Buffer.concat(chunks);
          resolve({
            filename: `${type}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`,
            mimeType: 'application/pdf',
            content,
            size: content.length,
          });
        });
        doc.on('error', reject);

        // Add header
        this.addHeader(doc, options);

        // Generate content based on type
        switch (type) {
          case 'net_worth':
            this.generateNetWorthPDF(doc, reportData, options);
            break;
          case 'year_comparison':
            this.generateYearComparisonPDF(doc, reportData, options);
            break;
          case 'category_trends':
            this.generateCategoryTrendsPDF(doc, reportData, options);
            break;
          case 'tax_summary':
            this.generateTaxSummaryPDF(doc, reportData, options);
            break;
          case 'cash_flow':
            this.generateCashFlowPDF(doc, reportData, options);
            break;
          case 'profit_loss':
            this.generateProfitLossPDF(doc, reportData, options);
            break;
          case 'budget_report':
            this.generateBudgetReportPDF(doc, reportData, options);
            break;
          default:
            this.generateGenericPDF(doc, reportData, options);
        }

        // Add footer
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  },

  // --------------------------------------------------------------------------
  // Header & Footer
  // --------------------------------------------------------------------------
  addHeader(doc: PDFKit.PDFDocument, options: PDFExportOptions): void {
    doc
      .fontSize(24)
      .fillColor(COLORS.printText)
      .text(options.title, { align: 'center' });

    if (options.subtitle) {
      doc
        .fontSize(12)
        .fillColor(COLORS.printSubtext)
        .text(options.subtitle, { align: 'center' });
    }

    if (options.period) {
      const periodText = 'year' in options.period
        ? `Annee ${options.period.year}`
        : formatDateRange(options.period.from, options.period.to);

      doc
        .fontSize(10)
        .fillColor(COLORS.printSubtext)
        .text(periodText, { align: 'center' });
    }

    doc.moveDown(2);
  },

  addFooter(doc: PDFKit.PDFDocument): void {
    const pageCount = (doc as unknown as { _pageBuffer: unknown[] })._pageBuffer?.length || 1;

    // Add footer on each page
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);

      doc
        .fontSize(8)
        .fillColor(COLORS.printSubtext)
        .text(
          `Genere le ${format(new Date(), "dd/MM/yyyy 'a' HH:mm", { locale: fr })} - Finance Hub`,
          50,
          doc.page.height - 40,
          { align: 'left', width: doc.page.width - 100 }
        )
        .text(
          `Page ${i + 1} / ${pageCount}`,
          50,
          doc.page.height - 40,
          { align: 'right', width: doc.page.width - 100 }
        );
    }
  },

  // --------------------------------------------------------------------------
  // Section Helpers
  // --------------------------------------------------------------------------
  addSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
    doc
      .fontSize(14)
      .fillColor(COLORS.printBlue)
      .text(title)
      .moveDown(0.5);

    // Underline
    const y = doc.y;
    doc
      .strokeColor(COLORS.printBlue)
      .lineWidth(1)
      .moveTo(50, y - 5)
      .lineTo(200, y - 5)
      .stroke();

    doc.moveDown(0.5);
  },

  addTable(
    doc: PDFKit.PDFDocument,
    headers: string[],
    rows: string[][],
    columnWidths?: number[]
  ): void {
    const startX = 50;
    const pageWidth = doc.page.width - 100;
    const colCount = headers.length;
    const defaultWidth = pageWidth / colCount;
    const widths = columnWidths || headers.map(() => defaultWidth);

    // Header row
    let x = startX;
    doc.fontSize(10).fillColor(COLORS.printText).font('Helvetica-Bold');

    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i] ?? '', x, doc.y, { width: widths[i], align: i === 0 ? 'left' : 'right' });
      x += widths[i] ?? 0;
    }

    doc.moveDown(0.5);

    // Separator line
    doc
      .strokeColor(COLORS.printSubtext)
      .lineWidth(0.5)
      .moveTo(startX, doc.y)
      .lineTo(startX + pageWidth, doc.y)
      .stroke();

    doc.moveDown(0.5);

    // Data rows
    doc.font('Helvetica').fillColor(COLORS.printText);

    for (const row of rows) {
      x = startX;
      const rowY = doc.y;

      for (let i = 0; i < row.length; i++) {
        doc.text(row[i] ?? '', x, rowY, { width: widths[i], align: i === 0 ? 'left' : 'right' });
        x += widths[i] ?? 0;
      }

      doc.moveDown(0.3);

      // Check for page break
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
      }
    }

    doc.moveDown(1);
  },

  addSummaryBox(
    doc: PDFKit.PDFDocument,
    items: Array<{ label: string; value: string; color?: string }>
  ): void {
    const startX = 50;
    const boxWidth = (doc.page.width - 100) / items.length;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      const x = startX + i * boxWidth;

      // Box background
      doc
        .rect(x, doc.y, boxWidth - 10, 50)
        .fill(COLORS.printSurface);

      // Label
      doc
        .fontSize(9)
        .fillColor(COLORS.printSubtext)
        .text(item.label, x + 10, doc.y + 8, { width: boxWidth - 20 });

      // Value
      doc
        .fontSize(14)
        .fillColor(item.color || COLORS.printText)
        .font('Helvetica-Bold')
        .text(item.value, x + 10, doc.y + 22, { width: boxWidth - 20 });
    }

    doc.y += 60;
    doc.font('Helvetica');
    doc.moveDown(1);
  },

  // --------------------------------------------------------------------------
  // Net Worth Report PDF
  // --------------------------------------------------------------------------
  generateNetWorthPDF(
    doc: PDFKit.PDFDocument,
    data: unknown,
    options: PDFExportOptions
  ): void {
    const report = data as {
      currentNetWorth: number;
      change: number;
      changePercent: number;
      assets: { total: number; breakdown: Array<{ name: string; balance: number; changePercent: number }> };
      liabilities: { total: number; breakdown: Array<{ name: string; balance: number; change: number }> };
      history: Array<{ date: string; netWorth: number }>;
    };

    const currency = options.currency || 'EUR';

    // Summary
    this.addSummaryBox(doc, [
      { label: 'Patrimoine net', value: formatCurrency(report.currentNetWorth, currency), color: COLORS.printBlue },
      { label: 'Evolution', value: formatPercent(report.changePercent), color: report.change >= 0 ? COLORS.printGreen : COLORS.printRed },
      { label: 'Total actifs', value: formatCurrency(report.assets.total, currency), color: COLORS.printGreen },
      { label: 'Total passifs', value: formatCurrency(report.liabilities.total, currency), color: COLORS.printRed },
    ]);

    // Assets table
    this.addSectionTitle(doc, 'Actifs');
    this.addTable(
      doc,
      ['Compte', 'Solde', 'Evolution'],
      report.assets.breakdown.map((a) => [
        a.name,
        formatCurrency(a.balance, currency),
        formatPercent(a.changePercent),
      ]),
      [250, 125, 100]
    );

    // Liabilities table
    if (report.liabilities.breakdown.length > 0) {
      this.addSectionTitle(doc, 'Passifs');
      this.addTable(
        doc,
        ['Compte', 'Solde', 'Evolution'],
        report.liabilities.breakdown.map((l) => [
          l.name,
          `-${formatCurrency(l.balance, currency)}`,
          formatCurrency(l.change, currency),
        ]),
        [250, 125, 100]
      );
    }

    // History (last 6 months)
    if (report.history.length > 0) {
      this.addSectionTitle(doc, 'Evolution sur la periode');
      this.addTable(
        doc,
        ['Mois', 'Patrimoine'],
        report.history.slice(-6).map((h) => [h.date, formatCurrency(h.netWorth, currency)]),
        [250, 225]
      );
    }
  },

  // --------------------------------------------------------------------------
  // Year Comparison Report PDF
  // --------------------------------------------------------------------------
  generateYearComparisonPDF(
    doc: PDFKit.PDFDocument,
    data: unknown,
    options: PDFExportOptions
  ): void {
    const report = data as {
      currentYear: number;
      previousYear: number;
      summary: {
        currentYear: { income: number; expenses: number; net: number };
        previousYear: { income: number; expenses: number; net: number };
        changes: { incomePercent: number; expensesPercent: number; netPercent: number };
      };
      monthly: Array<{
        month: number;
        currentYear: { net: number };
        previousYear: { net: number };
      }>;
      categories: Array<{
        categoryName: string;
        currentYear: number;
        previousYear: number;
        changePercent: number;
      }>;
    };

    const currency = options.currency || 'EUR';
    const monthNames = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Summary comparison
    this.addSectionTitle(doc, `Comparaison ${report.currentYear} vs ${report.previousYear}`);

    this.addTable(
      doc,
      ['', `${report.currentYear}`, `${report.previousYear}`, 'Evolution'],
      [
        ['Revenus', formatCurrency(report.summary.currentYear.income, currency), formatCurrency(report.summary.previousYear.income, currency), formatPercent(report.summary.changes.incomePercent)],
        ['Depenses', formatCurrency(report.summary.currentYear.expenses, currency), formatCurrency(report.summary.previousYear.expenses, currency), formatPercent(report.summary.changes.expensesPercent)],
        ['Epargne nette', formatCurrency(report.summary.currentYear.net, currency), formatCurrency(report.summary.previousYear.net, currency), formatPercent(report.summary.changes.netPercent)],
      ],
      [120, 120, 120, 100]
    );

    // Monthly comparison
    this.addSectionTitle(doc, 'Comparaison mensuelle');
    this.addTable(
      doc,
      ['Mois', `${report.currentYear}`, `${report.previousYear}`],
      report.monthly.map((m) => [
        monthNames[m.month - 1] ?? '',
        formatCurrency(m.currentYear.net, currency),
        formatCurrency(m.previousYear.net, currency),
      ]),
      [150, 160, 160]
    );

    // Category comparison (top 10)
    if (report.categories.length > 0) {
      doc.addPage();
      this.addSectionTitle(doc, 'Comparaison par categorie');
      this.addTable(
        doc,
        ['Categorie', `${report.currentYear}`, `${report.previousYear}`, 'Evolution'],
        report.categories.slice(0, 15).map((c) => [
          c.categoryName,
          formatCurrency(c.currentYear, currency),
          formatCurrency(c.previousYear, currency),
          formatPercent(c.changePercent),
        ]),
        [150, 100, 100, 100]
      );
    }
  },

  // --------------------------------------------------------------------------
  // Category Trends Report PDF
  // --------------------------------------------------------------------------
  generateCategoryTrendsPDF(
    doc: PDFKit.PDFDocument,
    data: unknown,
    options: PDFExportOptions
  ): void {
    const report = data as {
      categories: Array<{
        categoryName: string;
        total: number;
        average: number;
        trend: 'up' | 'down' | 'stable';
        trendPercent: number;
        data: Array<{ month: number; year: number; amount: number }>;
      }>;
      months: Array<{ month: number; year: number }>;
    };

    const currency = options.currency || 'EUR';
    const monthNames = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Summary table
    this.addSectionTitle(doc, 'Resume par categorie');
    this.addTable(
      doc,
      ['Categorie', 'Total', 'Moyenne', 'Tendance'],
      report.categories.slice(0, 15).map((c) => [
        c.categoryName,
        formatCurrency(c.total, currency),
        formatCurrency(c.average, currency),
        `${c.trend === 'up' ? '\u2191' : c.trend === 'down' ? '\u2193' : '\u2192'} ${formatPercent(c.trendPercent)}`,
      ]),
      [180, 100, 100, 100]
    );

    // Monthly data for top categories
    if (report.categories.length > 0) {
      doc.addPage();
      this.addSectionTitle(doc, 'Evolution mensuelle');

      const monthHeaders = ['Categorie', ...report.months.map((m) => `${monthNames[m.month - 1]} ${String(m.year).slice(2)}`)];
      const colWidth = (doc.page.width - 100 - 120) / report.months.length;

      this.addTable(
        doc,
        monthHeaders,
        report.categories.slice(0, 10).map((c) => [
          c.categoryName,
          ...c.data.map((d) => formatCurrency(d.amount, currency)),
        ]),
        [120, ...report.months.map(() => colWidth)]
      );
    }
  },

  // --------------------------------------------------------------------------
  // Tax Summary Report PDF
  // --------------------------------------------------------------------------
  generateTaxSummaryPDF(
    doc: PDFKit.PDFDocument,
    data: unknown,
    options: PDFExportOptions
  ): void {
    const report = data as {
      year: number;
      country: string;
      income: {
        total: number;
        salary: number;
        freelance: number;
        investments: number;
        other: number;
        byCategory: Array<{ categoryName: string; amount: number }>;
      };
      deductibleExpenses: {
        total: number;
        byCategory: Array<{
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
    };

    const currency = options.currency || 'EUR';

    // Summary box
    this.addSummaryBox(doc, [
      { label: 'Revenu brut', value: formatCurrency(report.summary.grossIncome, currency) },
      { label: 'Deductions', value: formatCurrency(report.summary.totalDeductions, currency) },
      { label: 'Revenu imposable', value: formatCurrency(report.summary.taxableIncome, currency), color: COLORS.printBlue },
      { label: 'Impot estime', value: formatCurrency(report.summary.estimatedTax, currency), color: COLORS.printRed },
    ]);

    // Income breakdown
    this.addSectionTitle(doc, 'Revenus');
    this.addTable(
      doc,
      ['Type', 'Montant'],
      [
        ['Salaires', formatCurrency(report.income.salary, currency)],
        ['Activite independante', formatCurrency(report.income.freelance, currency)],
        ['Investissements', formatCurrency(report.income.investments, currency)],
        ['Autres', formatCurrency(report.income.other, currency)],
        ['TOTAL', formatCurrency(report.income.total, currency)],
      ],
      [300, 175]
    );

    // Deductible expenses
    if (report.deductibleExpenses.byCategory.length > 0) {
      this.addSectionTitle(doc, 'Charges deductibles');
      this.addTable(
        doc,
        ['Categorie', 'Montant', 'Taux', 'Deductible'],
        report.deductibleExpenses.byCategory.map((c) => [
          c.categoryName,
          formatCurrency(c.amount, currency),
          `${(c.deductionRate * 100).toFixed(0)}%`,
          formatCurrency(c.deductibleAmount, currency),
        ]),
        [180, 100, 60, 100]
      );
    }

    // Investment income
    if (report.investments.dividends > 0 || report.investments.realizedGains > 0) {
      this.addSectionTitle(doc, 'Revenus de placements');
      this.addTable(
        doc,
        ['Type', 'Montant'],
        [
          ['Dividendes', formatCurrency(report.investments.dividends, currency)],
          ['Plus-values realisees', formatCurrency(report.investments.realizedGains, currency)],
          ['Moins-values realisees', `-${formatCurrency(report.investments.realizedLosses, currency)}`],
          ['Total net', formatCurrency(report.investments.netInvestmentIncome, currency)],
        ],
        [300, 175]
      );
    }

    // Notes
    if (report.summary.notes.length > 0) {
      doc.addPage();
      this.addSectionTitle(doc, 'Notes importantes');
      doc.fontSize(10).fillColor(COLORS.printSubtext);
      for (const note of report.summary.notes) {
        doc.text(`\u2022 ${note}`).moveDown(0.3);
      }

      doc.moveDown(1);
      doc
        .fontSize(9)
        .fillColor(COLORS.printRed)
        .text(
          'Avertissement: Ce resume est fourni a titre indicatif uniquement. ' +
            'Consultez un professionnel pour votre declaration fiscale officielle.'
        );
    }
  },

  // --------------------------------------------------------------------------
  // Cash Flow Report PDF
  // --------------------------------------------------------------------------
  generateCashFlowPDF(
    doc: PDFKit.PDFDocument,
    data: unknown,
    options: PDFExportOptions
  ): void {
    const report = data as {
      period: { from: Date; to: Date };
      operating: { income: number; expenses: number; net: number; byCategory: Array<{ categoryName: string; amount: number }> };
      investing: { inflows: number; outflows: number; net: number };
      financing: { inflows: number; outflows: number; net: number };
      netCashFlow: number;
      openingBalance: number;
      closingBalance: number;
    };

    const currency = options.currency || 'EUR';

    // Summary
    this.addSummaryBox(doc, [
      { label: 'Solde ouverture', value: formatCurrency(report.openingBalance, currency) },
      { label: 'Flux net', value: formatCurrency(report.netCashFlow, currency), color: report.netCashFlow >= 0 ? COLORS.printGreen : COLORS.printRed },
      { label: 'Solde cloture', value: formatCurrency(report.closingBalance, currency), color: COLORS.printBlue },
    ]);

    // Operating activities
    this.addSectionTitle(doc, 'Flux operationnels');
    this.addTable(
      doc,
      ['', 'Montant'],
      [
        ['Revenus', formatCurrency(report.operating.income, currency)],
        ['Depenses', `-${formatCurrency(report.operating.expenses, currency)}`],
        ['Flux operationnel net', formatCurrency(report.operating.net, currency)],
      ],
      [300, 175]
    );

    // Investing activities
    this.addSectionTitle(doc, "Flux d'investissement");
    this.addTable(
      doc,
      ['', 'Montant'],
      [
        ['Entrees', formatCurrency(report.investing.inflows, currency)],
        ['Sorties', `-${formatCurrency(report.investing.outflows, currency)}`],
        ["Flux d'investissement net", formatCurrency(report.investing.net, currency)],
      ],
      [300, 175]
    );

    // Summary
    this.addSectionTitle(doc, 'Resume');
    this.addTable(
      doc,
      ['', 'Montant'],
      [
        ["Solde d'ouverture", formatCurrency(report.openingBalance, currency)],
        ['Flux operationnel', formatCurrency(report.operating.net, currency)],
        ["Flux d'investissement", formatCurrency(report.investing.net, currency)],
        ['Flux de financement', formatCurrency(report.financing.net, currency)],
        ['Variation totale', formatCurrency(report.netCashFlow, currency)],
        ['Solde de cloture', formatCurrency(report.closingBalance, currency)],
      ],
      [300, 175]
    );
  },

  // --------------------------------------------------------------------------
  // Profit & Loss Report PDF
  // --------------------------------------------------------------------------
  generateProfitLossPDF(
    doc: PDFKit.PDFDocument,
    data: unknown,
    options: PDFExportOptions
  ): void {
    const report = data as {
      period: { from: Date; to: Date };
      revenue: { total: number; byCategory: Array<{ categoryName: string; amount: number }> };
      expenses: { total: number; byCategory: Array<{ categoryName: string; amount: number; percentage: number }> };
      grossProfit: number;
      netProfit: number;
      profitMargin: number;
    };

    const currency = options.currency || 'EUR';

    // Summary
    this.addSummaryBox(doc, [
      { label: 'Chiffre d\'affaires', value: formatCurrency(report.revenue.total, currency) },
      { label: 'Charges', value: formatCurrency(report.expenses.total, currency), color: COLORS.printRed },
      { label: 'Resultat net', value: formatCurrency(report.netProfit, currency), color: report.netProfit >= 0 ? COLORS.printGreen : COLORS.printRed },
      { label: 'Marge', value: `${report.profitMargin.toFixed(1)}%` },
    ]);

    // Revenue
    this.addSectionTitle(doc, 'Produits');
    this.addTable(
      doc,
      ['', 'Montant'],
      [['Total des revenus', formatCurrency(report.revenue.total, currency)]],
      [300, 175]
    );

    // Expenses
    this.addSectionTitle(doc, 'Charges');
    this.addTable(
      doc,
      ['Categorie', 'Montant', '%'],
      [
        ...report.expenses.byCategory.map((c) => [
          c.categoryName,
          formatCurrency(c.amount, currency),
          `${c.percentage.toFixed(1)}%`,
        ]),
        ['TOTAL CHARGES', formatCurrency(report.expenses.total, currency), '100%'],
      ],
      [220, 125, 80]
    );

    // Result
    this.addSectionTitle(doc, 'Resultat');
    this.addTable(
      doc,
      ['', 'Montant'],
      [
        ['Resultat brut', formatCurrency(report.grossProfit, currency)],
        ['Resultat net', formatCurrency(report.netProfit, currency)],
        ['Marge nette', `${report.profitMargin.toFixed(1)}%`],
      ],
      [300, 175]
    );
  },

  // --------------------------------------------------------------------------
  // Budget Report PDF
  // --------------------------------------------------------------------------
  generateBudgetReportPDF(
    doc: PDFKit.PDFDocument,
    data: unknown,
    options: PDFExportOptions
  ): void {
    const report = data as {
      period: { from: Date; to: Date };
      categories: Array<{
        categoryName: string;
        budgeted: number;
        actual: number;
        variance: number;
        variancePercent: number;
        status: 'under' | 'on_track' | 'over';
      }>;
      totalBudget: number;
      totalActual: number;
      totalVariance: number;
      totalVariancePercent: number;
    };

    const currency = options.currency || 'EUR';

    // Summary
    this.addSummaryBox(doc, [
      { label: 'Budget total', value: formatCurrency(report.totalBudget, currency) },
      { label: 'Realise', value: formatCurrency(report.totalActual, currency) },
      { label: 'Ecart', value: formatCurrency(report.totalVariance, currency), color: report.totalVariance >= 0 ? COLORS.printGreen : COLORS.printRed },
      { label: 'Ecart %', value: formatPercent(report.totalVariancePercent), color: report.totalVariance >= 0 ? COLORS.printGreen : COLORS.printRed },
    ]);

    // Detail table
    this.addSectionTitle(doc, 'Detail par categorie');
    this.addTable(
      doc,
      ['Categorie', 'Budget', 'Realise', 'Ecart', 'Statut'],
      report.categories.map((c) => [
        c.categoryName,
        formatCurrency(c.budgeted, currency),
        formatCurrency(c.actual, currency),
        formatCurrency(c.variance, currency),
        c.status === 'under' ? 'Sous budget' : c.status === 'on_track' ? 'Dans les clous' : 'Depasse',
      ]),
      [140, 90, 90, 90, 90]
    );
  },

  // --------------------------------------------------------------------------
  // Generic PDF (fallback)
  // --------------------------------------------------------------------------
  generateGenericPDF(
    doc: PDFKit.PDFDocument,
    data: unknown,
    _options: PDFExportOptions
  ): void {
    doc
      .fontSize(10)
      .fillColor(COLORS.printText)
      .text(JSON.stringify(data, null, 2));
  },
};

export default pdfExportService;
