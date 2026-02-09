// ============================================================================
// JOB DATA TYPES - Finance Hub Worker
// ============================================================================

// ----------------------------------------------------------------------------
// Import Job
// ----------------------------------------------------------------------------

export interface ImportJobData {
  jobId: string;
  workspaceId: string;
  accountId: string;
  userId: string;
  filename: string;
  storageKey: string;
  columnMapping: Record<string, string>;
  dateFormat?: string;
  skipFirstRow: boolean;
  applyRules: boolean;
}

export interface ImportJobResult {
  imported: number;
  skipped: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  message: string;
}

// ----------------------------------------------------------------------------
// Export Job
// ----------------------------------------------------------------------------

export interface ExportJobData {
  exportId: string;
  workspaceId: string;
  userId: string;
  format: 'csv' | 'pdf';
  dateRange?: {
    from: string;
    to: string;
  };
  accountIds?: string[];
  includeDocuments: boolean;
}

export interface ExportJobResult {
  storageKey: string;
  filename: string;
  size: number;
  expiresAt: string;
}

// ----------------------------------------------------------------------------
// Market Data Job
// ----------------------------------------------------------------------------

export interface MarketDataJobData {
  assetIds: string[];
  provider: 'yahoo' | 'coingecko';
}

export interface MarketDataJobResult {
  updated: number;
  failed: number;
}

// ----------------------------------------------------------------------------
// Cleanup Job
// ----------------------------------------------------------------------------

export interface CleanupJobData {
  type: 'orphaned_documents' | 'expired_sessions' | 'old_audit_logs';
  olderThanDays?: number;
}

export interface CleanupJobResult {
  deleted: number;
}

// ----------------------------------------------------------------------------
// Backup Job
// ----------------------------------------------------------------------------

export interface BackupJobData {
  type: 'full' | 'incremental' | 'workspace';
  workspaceId?: string;
  triggeredBy?: string;
  retention?: number;
}

export interface BackupJobResult {
  success: boolean;
  backupId: string;
  size: number;
  duration: number;
  includedWorkspaces: number;
  includedTables: string[];
  storagePath: string;
}

// ----------------------------------------------------------------------------
// Notification Job
// ----------------------------------------------------------------------------

export interface NotificationJobData {
  userId: string;
  type: 'budget_alert' | 'import_complete' | 'export_ready';
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// Pro Status Job (Overdue Invoices & Expired Quotes)
// ----------------------------------------------------------------------------

export interface ProStatusJobData {
  workspaceId?: string; // If provided, only update this workspace
}

export interface ProStatusJobResult {
  overdueInvoices: number;
  expiredQuotes: number;
  workspacesProcessed?: number;
  duration?: number;
}

// ----------------------------------------------------------------------------
// Alerts Job
// ----------------------------------------------------------------------------

export interface AlertsJobData {
  workspaceId?: string;
  alertTypes?: string[];
}

export interface AlertsJobResult {
  budgetAlerts: number;
  priceAlerts: number;
  balanceAlerts: number;
  recurringReminders: number;
  duration: number;
}

// ----------------------------------------------------------------------------
// Recurrence Job
// ----------------------------------------------------------------------------

export interface RecurrenceJobData {
  type: 'process_due' | 'execute_single';
  recurrenceId?: string;
}

export interface RecurrenceJobResult {
  processed: number;
  success: number;
  failed: number;
  errors?: Array<{ recurrenceId: string; error: string }>;
}

// ----------------------------------------------------------------------------
// Exchange Rate Job
// ----------------------------------------------------------------------------

export interface ExchangeRateJobData {
  source?: 'ecb' | 'manual';
  baseCurrency?: string;
}

export interface ExchangeRateJobResult {
  imported: number;
  source: string;
  date: Date | null;
  duration: number;
}
