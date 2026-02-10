// ============================================================================
// REPORT BUILDER SERVICE - Finance Hub
// Custom report templates and generation
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type ReportColumn =
  | 'date'
  | 'description'
  | 'amount'
  | 'category'
  | 'categoryId'
  | 'account'
  | 'accountId'
  | 'type'
  | 'status'
  | 'tags'
  | 'notes'
  | 'isReconciled';

export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max';

export type GroupByField =
  | 'category'
  | 'account'
  | 'month'
  | 'week'
  | 'day'
  | 'year'
  | 'type'
  | 'status';

export type SortDirection = 'asc' | 'desc';

export interface ReportFilter {
  dateFrom?: string;
  dateTo?: string;
  categoryIds?: string[];
  accountIds?: string[];
  amountMin?: number;
  amountMax?: number;
  transactionTypes?: ('expense' | 'income' | 'transfer')[];
  statuses?: ('pending' | 'cleared' | 'reconciled')[];
  searchText?: string;
  excludeTransfers?: boolean;
}

export interface ReportConfig {
  columns: ReportColumn[];
  filters: ReportFilter;
  groupBy?: GroupByField;
  aggregations?: {
    field: 'amount';
    type: AggregationType;
    label?: string;
  }[];
  sortBy?: {
    field: ReportColumn;
    direction: SortDirection;
  };
  limit?: number;
}

export interface CreateTemplateInput {
  workspaceId: string;
  userId: string;
  name: string;
  description?: string;
  config: ReportConfig;
  isPublic?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  config?: ReportConfig;
  isPublic?: boolean;
}

export interface ReportRow {
  [key: string]: string | number | boolean | null | string[];
}

export interface GroupedReportData {
  groupKey: string;
  groupLabel: string;
  rows: ReportRow[];
  aggregations?: Record<string, number>;
}

export interface GeneratedReport {
  templateId?: string;
  templateName?: string;
  generatedAt: Date;
  config: ReportConfig;
  data: ReportRow[] | GroupedReportData[];
  summary: {
    totalRows: number;
    aggregations?: Record<string, number>;
  };
}

export interface ExportFormat {
  format: 'json' | 'csv' | 'pdf';
}

export interface ExportedReport {
  filename: string;
  mimeType: string;
  content: string | Buffer;
  size: number;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str: string;
  if (typeof value === 'string') {
    str = value;
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    str = String(value);
  } else if (Array.isArray(value)) {
    str = value.join('; ');
  } else if (typeof value === 'object') {
    str = JSON.stringify(value);
  } else {
    // For other primitive types (symbol, bigint, etc.)
    str = String(value as string | number | boolean);
  }
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

function formatAmount(amount: number): string {
  return amount.toFixed(2).replace('.', ',');
}

function getColumnLabel(column: ReportColumn): string {
  const labels: Record<ReportColumn, string> = {
    date: 'Date',
    description: 'Description',
    amount: 'Montant',
    category: 'Categorie',
    categoryId: 'ID Categorie',
    account: 'Compte',
    accountId: 'ID Compte',
    type: 'Type',
    status: 'Statut',
    tags: 'Tags',
    notes: 'Notes',
    isReconciled: 'Rapproche',
  };
  return labels[column] || column;
}

function getWeekNumber(date: Date): string {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  return `${date.getFullYear()}-S${weekNumber.toString().padStart(2, '0')}`;
}

// ----------------------------------------------------------------------------
// Report Builder Service
// ----------------------------------------------------------------------------

export const reportBuilderService = {
  // --------------------------------------------------------------------------
  // Template CRUD Operations
  // --------------------------------------------------------------------------

  async createTemplate(input: CreateTemplateInput) {
    const template = await prisma.reportTemplate.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        name: input.name,
        description: input.description || null,
        config: input.config as object,
        isPublic: input.isPublic ?? false,
      },
      include: {
        user: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    return template;
  },

  async getTemplate(templateId: string, workspaceId: string) {
    const template = await prisma.reportTemplate.findFirst({
      where: {
        id: templateId,
        workspaceId,
      },
      include: {
        user: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    return template;
  },

  async listTemplates(workspaceId: string, userId?: string) {
    const templates = await prisma.reportTemplate.findMany({
      where: {
        workspaceId,
        OR: [
          { isPublic: true },
          ...(userId ? [{ userId }] : []),
        ],
      },
      include: {
        user: {
          select: { id: true, displayName: true, email: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return templates;
  },

  async updateTemplate(templateId: string, workspaceId: string, userId: string, input: UpdateTemplateInput) {
    // Check ownership or public access
    const existing = await prisma.reportTemplate.findFirst({
      where: {
        id: templateId,
        workspaceId,
        userId, // Only owner can update
      },
    });

    if (!existing) {
      return null;
    }

    const template = await prisma.reportTemplate.update({
      where: { id: templateId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.config !== undefined && { config: input.config as object }),
        ...(input.isPublic !== undefined && { isPublic: input.isPublic }),
      },
      include: {
        user: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    return template;
  },

  async deleteTemplate(templateId: string, workspaceId: string, userId: string) {
    // Check ownership
    const existing = await prisma.reportTemplate.findFirst({
      where: {
        id: templateId,
        workspaceId,
        userId, // Only owner can delete
      },
    });

    if (!existing) {
      return false;
    }

    await prisma.reportTemplate.delete({
      where: { id: templateId },
    });

    return true;
  },

  // --------------------------------------------------------------------------
  // Report Generation
  // --------------------------------------------------------------------------

  async generateReport(
    workspaceId: string,
    config: ReportConfig,
    templateId?: string,
    templateName?: string
  ): Promise<GeneratedReport> {
    const { columns, filters, groupBy, aggregations, sortBy, limit } = config;

    // Build the where clause
    const where: Record<string, unknown> = {
      account: { workspaceId },
      deletedAt: null,
    };

    // Date filters
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        (where.date as Record<string, Date>).gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        (where.date as Record<string, Date>).lte = new Date(filters.dateTo);
      }
    }

    // Category filters
    if (filters.categoryIds?.length) {
      where.categoryId = { in: filters.categoryIds };
    }

    // Account filters
    if (filters.accountIds?.length) {
      where.accountId = { in: filters.accountIds };
    }

    // Amount filters
    if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
      where.amount = {};
      if (filters.amountMin !== undefined) {
        (where.amount as Record<string, number>).gte = filters.amountMin;
      }
      if (filters.amountMax !== undefined) {
        (where.amount as Record<string, number>).lte = filters.amountMax;
      }
    }

    // Transaction type filters
    if (filters.transactionTypes?.length) {
      where.type = { in: filters.transactionTypes };
    }

    // Status filters
    if (filters.statuses?.length) {
      where.status = { in: filters.statuses };
    }

    // Search text
    if (filters.searchText) {
      where.description = { contains: filters.searchText, mode: 'insensitive' };
    }

    // Exclude transfers
    if (filters.excludeTransfers) {
      where.transferPairId = null;
    }

    // Build order by
    const orderBy: Record<string, string> = {};
    if (sortBy) {
      const sortField = sortBy.field === 'category' ? 'categoryId' :
                        sortBy.field === 'account' ? 'accountId' : sortBy.field;
      orderBy[sortField] = sortBy.direction;
    } else {
      orderBy.date = 'desc';
    }

    // Fetch transactions
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        account: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, color: true } },
        tags: { select: { tag: { select: { name: true } } } },
      },
      orderBy,
      take: limit,
    });

    // Transform to report rows
    const rows: ReportRow[] = transactions.map((tx) => {
      const row: ReportRow = {};

      for (const col of columns) {
        switch (col) {
          case 'date':
            row.date = formatDate(tx.date);
            break;
          case 'description':
            row.description = tx.description;
            break;
          case 'amount':
            row.amount = Number(tx.amount);
            break;
          case 'category':
            row.category = tx.category?.name || 'Non categorise';
            break;
          case 'categoryId':
            row.categoryId = tx.categoryId || null;
            break;
          case 'account':
            row.account = tx.account.name;
            break;
          case 'accountId':
            row.accountId = tx.accountId;
            break;
          case 'type':
            row.type = tx.type;
            break;
          case 'status':
            row.status = tx.status;
            break;
          case 'tags':
            row.tags = tx.tags.map((t) => t.tag.name);
            break;
          case 'notes':
            row.notes = tx.notes || null;
            break;
          case 'isReconciled':
            row.isReconciled = tx.isReconciled;
            break;
        }
      }

      // Keep raw data for grouping
      row._rawDate = tx.date.toISOString();
      row._rawCategoryId = tx.categoryId;
      row._rawAccountId = tx.accountId;
      row._rawType = tx.type;
      row._rawStatus = tx.status;
      row._rawAmount = Number(tx.amount);

      return row;
    });

    // Calculate aggregations for the entire dataset
    const calculateAggregations = (dataRows: ReportRow[]): Record<string, number> => {
      if (!aggregations?.length) return {};

      const result: Record<string, number> = {};
      const amounts = dataRows.map((r) => Number(r._rawAmount) || 0);

      for (const agg of aggregations) {
        const label = agg.label || `${agg.type}_${agg.field}`;

        switch (agg.type) {
          case 'sum':
            result[label] = amounts.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            result[label] = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
            break;
          case 'count':
            result[label] = amounts.length;
            break;
          case 'min':
            result[label] = amounts.length > 0 ? Math.min(...amounts) : 0;
            break;
          case 'max':
            result[label] = amounts.length > 0 ? Math.max(...amounts) : 0;
            break;
        }
      }

      return result;
    };

    // Group data if requested
    if (groupBy) {
      const groups = new Map<string, ReportRow[]>();

      for (const row of rows) {
        let groupKey: string;

        switch (groupBy) {
          case 'category':
            groupKey = (row._rawCategoryId as string) || 'uncategorized';
            break;
          case 'account':
            groupKey = row._rawAccountId as string;
            break;
          case 'month': {
            const monthDate = new Date(row._rawDate as string);
            groupKey = format(monthDate, 'yyyy-MM');
            break;
          }
          case 'week': {
            const weekDate = new Date(row._rawDate as string);
            groupKey = getWeekNumber(weekDate);
            break;
          }
          case 'day': {
            const rawDate = row._rawDate as string;
            groupKey = rawDate.split('T')[0] ?? '';
            break;
          }
          case 'year': {
            const yearDate = new Date(row._rawDate as string);
            groupKey = yearDate.getFullYear().toString();
            break;
          }
          case 'type':
            groupKey = row._rawType as string;
            break;
          case 'status':
            groupKey = row._rawStatus as string;
            break;
          default:
            groupKey = 'all';
        }

        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(row);
      }

      // Convert to grouped data
      const groupedData: GroupedReportData[] = Array.from(groups.entries()).map(([groupKey, groupRows]) => {
        // Remove internal fields from rows
        const cleanRows = groupRows.map((r) => {
          const clean = { ...r };
          delete clean._rawDate;
          delete clean._rawCategoryId;
          delete clean._rawAccountId;
          delete clean._rawType;
          delete clean._rawStatus;
          delete clean._rawAmount;
          return clean;
        });

        return {
          groupKey,
          groupLabel: groupRows[0] ? this.getGroupLabel(groupBy, groupRows[0]) : groupKey,
          rows: cleanRows,
          aggregations: calculateAggregations(groupRows),
        };
      });

      // Sort groups
      groupedData.sort((a, b) => {
        if (groupBy === 'month' || groupBy === 'week' || groupBy === 'day' || groupBy === 'year') {
          return b.groupKey.localeCompare(a.groupKey); // Descending for dates
        }
        return a.groupLabel.localeCompare(b.groupLabel);
      });

      return {
        templateId,
        templateName,
        generatedAt: new Date(),
        config,
        data: groupedData,
        summary: {
          totalRows: rows.length,
          aggregations: calculateAggregations(rows),
        },
      };
    }

    // Remove internal fields from rows
    const cleanRows = rows.map((r) => {
      const clean = { ...r };
      delete clean._rawDate;
      delete clean._rawCategoryId;
      delete clean._rawAccountId;
      delete clean._rawType;
      delete clean._rawStatus;
      delete clean._rawAmount;
      return clean;
    });

    return {
      templateId,
      templateName,
      generatedAt: new Date(),
      config,
      data: cleanRows,
      summary: {
        totalRows: cleanRows.length,
        aggregations: calculateAggregations(rows),
      },
    };
  },

  getGroupLabel(groupBy: GroupByField, row: ReportRow): string {
    switch (groupBy) {
      case 'category':
        return (row.category as string) || 'Non categorise';
      case 'account':
        return row.account as string;
      case 'month': {
        const monthDate = new Date(row._rawDate as string);
        return format(monthDate, 'MMMM yyyy', { locale: fr });
      }
      case 'week': {
        const weekDate = new Date(row._rawDate as string);
        const weekNum = getWeekNumber(weekDate);
        return `Semaine ${weekNum.split('-S')[1]} - ${weekNum.split('-S')[0]}`;
      }
      case 'day':
        return formatDate(row._rawDate as string);
      case 'year':
        return new Date(row._rawDate as string).getFullYear().toString();
      case 'type': {
        const type = row._rawType as string;
        return type === 'expense' ? 'Depenses' : type === 'income' ? 'Revenus' : 'Transferts';
      }
      case 'status': {
        const status = row._rawStatus as string;
        return status === 'pending' ? 'En attente' : status === 'cleared' ? 'Rapproche' : 'Valide';
      }
      default:
        return 'Tous';
    }
  },

  async generateFromTemplate(templateId: string, workspaceId: string): Promise<GeneratedReport | null> {
    const template = await this.getTemplate(templateId, workspaceId);

    if (!template) {
      return null;
    }

    const config = template.config as unknown as ReportConfig;
    return this.generateReport(workspaceId, config, template.id, template.name);
  },

  // --------------------------------------------------------------------------
  // Export Functions
  // --------------------------------------------------------------------------

  async exportReport(report: GeneratedReport, exportFormat: ExportFormat): Promise<ExportedReport> {
    const { format: fmt } = exportFormat;

    switch (fmt) {
      case 'json':
        return this.exportToJSON(report);
      case 'csv':
        return this.exportToCSV(report);
      case 'pdf':
        return this.exportToPDF(report);
      default:
        throw new Error(`Unsupported export format: ${fmt}`);
    }
  },

  exportToJSON(report: GeneratedReport): ExportedReport {
    const content = JSON.stringify(report, null, 2);
    const filename = `report_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`;

    return {
      filename,
      mimeType: 'application/json',
      content,
      size: Buffer.byteLength(content, 'utf8'),
    };
  },

  exportToCSV(report: GeneratedReport): ExportedReport {
    const { config, data, summary } = report;
    const lines: string[] = [];

    // Report header
    if (report.templateName) {
      lines.push(`Rapport: ${report.templateName}`);
    }
    lines.push(`Genere le: ${formatDate(report.generatedAt)}`);
    lines.push(`Total lignes: ${summary.totalRows}`);

    // Add summary aggregations
    if (summary.aggregations) {
      for (const [key, value] of Object.entries(summary.aggregations)) {
        lines.push(`${key}: ${formatAmount(value)}`);
      }
    }

    lines.push('');

    // Check if data is grouped
    const firstItem = data[0];
    const isGrouped = Array.isArray(data) && data.length > 0 && firstItem && 'groupKey' in firstItem;

    if (isGrouped) {
      const groupedData = data as GroupedReportData[];

      for (const group of groupedData) {
        lines.push(`--- ${group.groupLabel} ---`);

        // Headers
        const headers = config.columns.map(getColumnLabel);
        lines.push(formatCSVRow(headers));

        // Rows
        for (const row of group.rows) {
          const values = config.columns.map((col) => {
            const value = row[col];
            if (col === 'amount' && typeof value === 'number') {
              return formatAmount(value);
            }
            if (Array.isArray(value)) {
              return value.join('; ');
            }
            return value ?? '';
          });
          lines.push(formatCSVRow(values));
        }

        // Group aggregations
        if (group.aggregations) {
          const aggLine = Object.entries(group.aggregations)
            .map(([k, v]) => `${k}: ${formatAmount(v)}`)
            .join(' | ');
          lines.push(`Sous-total: ${aggLine}`);
        }

        lines.push('');
      }
    } else {
      const flatData = data as ReportRow[];

      // Headers
      const headers = config.columns.map(getColumnLabel);
      lines.push(formatCSVRow(headers));

      // Rows
      for (const row of flatData) {
        const values = config.columns.map((col) => {
          const value = row[col];
          if (col === 'amount' && typeof value === 'number') {
            return formatAmount(value);
          }
          if (Array.isArray(value)) {
            return value.join('; ');
          }
          return value ?? '';
        });
        lines.push(formatCSVRow(values));
      }
    }

    const content = '\ufeff' + lines.join('\n'); // BOM for Excel
    const filename = `report_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;

    return {
      filename,
      mimeType: 'text/csv; charset=utf-8',
      content,
      size: Buffer.byteLength(content, 'utf8'),
    };
  },

  exportToPDF(report: GeneratedReport): ExportedReport {
    // PDF export is a placeholder - would typically use a library like PDFKit or puppeteer
    // For now, return a structured text that could be converted to PDF
    const content = `
RAPPORT PERSONNALISE
====================

${report.templateName ? `Nom: ${report.templateName}` : ''}
Genere le: ${formatDate(report.generatedAt)}
Total lignes: ${report.summary.totalRows}

${report.summary.aggregations ? Object.entries(report.summary.aggregations).map(([k, v]) => `${k}: ${formatAmount(v)}`).join('\n') : ''}

Note: L'export PDF complet necessite une bibliotheque PDF.
Veuillez utiliser l'export CSV ou JSON pour les donnees completes.
    `.trim();

    const filename = `report_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;

    return {
      filename,
      mimeType: 'application/pdf',
      content,
      size: Buffer.byteLength(content, 'utf8'),
    };
  },
};

export default reportBuilderService;
