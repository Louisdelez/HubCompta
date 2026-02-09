// ============================================================================
// EMAIL SERVICE TYPES - Finance Hub
// ============================================================================

// ----------------------------------------------------------------------------
// Provider Configuration Types
// ----------------------------------------------------------------------------

export type EmailProvider = 'smtp' | 'sendgrid' | 'ses';

export interface SMTPConfig {
  provider: 'smtp';
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface SendGridConfig {
  provider: 'sendgrid';
  apiKey: string;
}

export interface SESConfig {
  provider: 'ses';
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export type EmailProviderConfig = SMTPConfig | SendGridConfig | SESConfig;

// ----------------------------------------------------------------------------
// Email Message Types
// ----------------------------------------------------------------------------

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: 'base64' | 'binary' | 'utf-8';
}

export interface EmailMessage {
  to: EmailAddress | EmailAddress[] | string;
  from?: EmailAddress | string;
  replyTo?: EmailAddress | string;
  subject: string;
  text?: string;
  html: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ----------------------------------------------------------------------------
// Email Template Types
// ----------------------------------------------------------------------------

export type EmailTemplateName =
  | 'welcome'
  | 'password_reset'
  | 'invoice_overdue'
  | 'budget_alert'
  | 'export_ready'
  | 'weekly_summary';

export interface WelcomeEmailData {
  displayName: string;
  loginUrl: string;
}

export interface PasswordResetEmailData {
  displayName: string;
  resetUrl: string;
  expiresIn: string;
}

export interface InvoiceOverdueEmailData {
  displayName: string;
  invoiceNumber: string;
  clientName: string;
  amount: string;
  currency: string;
  dueDate: string;
  daysOverdue: number;
  invoiceUrl: string;
}

export interface BudgetAlertEmailData {
  displayName: string;
  budgetName: string;
  categoryName: string;
  percentUsed: number;
  amountSpent: string;
  budgetLimit: string;
  currency: string;
  isExceeded: boolean;
  budgetUrl: string;
}

export interface ExportReadyEmailData {
  displayName: string;
  exportType: string;
  filename: string;
  downloadUrl: string;
  expiresAt: string;
}

export interface WeeklySummaryEmailData {
  displayName: string;
  weekStart: string;
  weekEnd: string;
  totalIncome: string;
  totalExpenses: string;
  netChange: string;
  currency: string;
  topCategories: Array<{
    name: string;
    amount: string;
    percentage: number;
  }>;
  budgetAlerts: Array<{
    name: string;
    percentUsed: number;
  }>;
  dashboardUrl: string;
}

export type EmailTemplateData = {
  welcome: WelcomeEmailData;
  password_reset: PasswordResetEmailData;
  invoice_overdue: InvoiceOverdueEmailData;
  budget_alert: BudgetAlertEmailData;
  export_ready: ExportReadyEmailData;
  weekly_summary: WeeklySummaryEmailData;
};

// ----------------------------------------------------------------------------
// Notification Preferences Types
// ----------------------------------------------------------------------------

export interface NotificationPreferencesInput {
  emailEnabled?: boolean;
  budgetAlerts?: boolean;
  invoiceReminders?: boolean;
  weeklySummary?: boolean;
  marketingEmails?: boolean;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  emailEnabled: boolean;
  budgetAlerts: boolean;
  invoiceReminders: boolean;
  weeklySummary: boolean;
  marketingEmails: boolean;
  createdAt: Date;
  updatedAt: Date;
}
