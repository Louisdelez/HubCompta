// ============================================================================
// REPORTS MODULE EXPORTS - Finance Hub
// ============================================================================

export { reportService } from './report.service.js';
export type {
  DateRange,
  CashFlowReport,
  ProfitLossReport,
  BudgetVsActualReport,
  BudgetComparison,
  CategoryAmount,
  TrendData,
  CategoryTrend,
  AccountSummary,
} from './report.service.js';

export { exportService } from './export.service.js';
export type { ExportOptions, ExportResult } from './export.service.js';

export { reportBuilderService } from './report-builder.service.js';
export type {
  ReportColumn,
  AggregationType,
  GroupByField,
  SortDirection,
  ReportFilter,
  ReportConfig,
  CreateTemplateInput,
  UpdateTemplateInput,
  ReportRow,
  GroupedReportData,
  GeneratedReport,
  ExportFormat,
  ExportedReport,
} from './report-builder.service.js';
