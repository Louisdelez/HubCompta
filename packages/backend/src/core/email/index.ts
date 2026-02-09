// ============================================================================
// EMAIL SERVICE - Finance Hub
// Email sending service with provider abstraction
// ============================================================================

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import { logger } from '../middleware/logger.js';
import { prisma } from '../database/client.js';
import type {
  EmailMessage,
  EmailResult,
  EmailProvider,
  EmailProviderConfig,
  SMTPConfig,
  SendGridConfig,
  SESConfig,
  EmailTemplateName,
  EmailTemplateData,
  NotificationPreferencesInput,
} from './types.js';
import { generateEmailTemplate } from './templates.js';

// Re-export types and templates
export * from './types.js';
export { generateEmailTemplate } from './templates.js';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? 'noreply@hubcompta.com';
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';

// SendGrid configuration (optional)
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

// AWS SES configuration (optional)
const AWS_SES_REGION = process.env.AWS_SES_REGION;
const AWS_SES_ACCESS_KEY_ID = process.env.AWS_SES_ACCESS_KEY_ID;
const AWS_SES_SECRET_ACCESS_KEY = process.env.AWS_SES_SECRET_ACCESS_KEY;

// Determine which provider to use
function getProviderConfig(): EmailProviderConfig | null {
  // Priority: SMTP > SendGrid > SES
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return {
      provider: 'smtp',
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    };
  }

  if (SENDGRID_API_KEY) {
    return {
      provider: 'sendgrid',
      apiKey: SENDGRID_API_KEY,
    };
  }

  if (AWS_SES_REGION && AWS_SES_ACCESS_KEY_ID && AWS_SES_SECRET_ACCESS_KEY) {
    return {
      provider: 'ses',
      region: AWS_SES_REGION,
      accessKeyId: AWS_SES_ACCESS_KEY_ID,
      secretAccessKey: AWS_SES_SECRET_ACCESS_KEY,
    };
  }

  return null;
}

// ----------------------------------------------------------------------------
// Transporter Factory
// ----------------------------------------------------------------------------

let transporter: Transporter | null = null;
let currentProvider: EmailProvider | null = null;

function createSMTPTransporter(config: SMTPConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  } as SMTPTransport.Options);
}

function createSendGridTransporter(config: SendGridConfig): Transporter {
  return nodemailer.createTransport({
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    auth: {
      user: 'apikey',
      pass: config.apiKey,
    },
  } as SMTPTransport.Options);
}

function createSESTransporter(config: SESConfig): Transporter {
  // Using SMTP interface for SES for simplicity
  return nodemailer.createTransport({
    host: `email-smtp.${config.region}.amazonaws.com`,
    port: 587,
    secure: false,
    auth: {
      user: config.accessKeyId,
      pass: config.secretAccessKey,
    },
  } as SMTPTransport.Options);
}

function getTransporter(): Transporter | null {
  if (transporter) {
    return transporter;
  }

  const config = getProviderConfig();
  if (!config) {
    logger.warn('No email provider configured. Emails will not be sent.');
    return null;
  }

  switch (config.provider) {
    case 'smtp':
      transporter = createSMTPTransporter(config);
      currentProvider = 'smtp';
      break;
    case 'sendgrid':
      transporter = createSendGridTransporter(config);
      currentProvider = 'sendgrid';
      break;
    case 'ses':
      transporter = createSESTransporter(config);
      currentProvider = 'ses';
      break;
  }

  logger.info({ provider: currentProvider }, 'Email transporter initialized');
  return transporter;
}

// ----------------------------------------------------------------------------
// Email Service
// ----------------------------------------------------------------------------

export const emailService = {
  /**
   * Check if email service is configured
   */
  isConfigured(): boolean {
    return getProviderConfig() !== null;
  },

  /**
   * Get current email provider
   */
  getProvider(): EmailProvider | null {
    return currentProvider;
  },

  /**
   * Send a raw email
   */
  async send(message: EmailMessage): Promise<EmailResult> {
    const transport = getTransporter();

    if (!transport) {
      logger.warn({ to: message.to }, 'Email not sent: no provider configured');
      return {
        success: false,
        error: 'Email service not configured',
      };
    }

    try {
      const fromAddress = normalizeFromAddress(message.from) ?? SMTP_FROM;
      const replyToAddress = message.replyTo ? normalizeFromAddress(message.replyTo) : undefined;

      const result = await transport.sendMail({
        from: fromAddress,
        to: normalizeRecipients(message.to),
        replyTo: replyToAddress,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
          encoding: a.encoding,
        })),
        headers: message.headers,
      });

      const messageId = result?.messageId ?? 'unknown';

      logger.info(
        {
          messageId,
          to: message.to,
          subject: message.subject,
        },
        'Email sent successfully'
      );

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        {
          error: errorMessage,
          to: message.to,
          subject: message.subject,
        },
        'Failed to send email'
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Send a templated email
   */
  async sendTemplate<T extends EmailTemplateName>(
    to: string,
    templateName: T,
    data: EmailTemplateData[T]
  ): Promise<EmailResult> {
    const { subject, html } = generateEmailTemplate(templateName, data);

    return this.send({
      to,
      subject,
      html,
    });
  },

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(
    to: string,
    displayName: string,
    loginUrl: string
  ): Promise<EmailResult> {
    return this.sendTemplate(to, 'welcome', {
      displayName,
      loginUrl,
    });
  },

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    to: string,
    displayName: string,
    resetUrl: string,
    expiresIn: string = '1 heure'
  ): Promise<EmailResult> {
    return this.sendTemplate(to, 'password_reset', {
      displayName,
      resetUrl,
      expiresIn,
    });
  },

  /**
   * Send invoice overdue email
   */
  async sendInvoiceOverdueEmail(
    to: string,
    data: {
      displayName: string;
      invoiceNumber: string;
      clientName: string;
      amount: string;
      currency: string;
      dueDate: string;
      daysOverdue: number;
      invoiceUrl: string;
    }
  ): Promise<EmailResult> {
    return this.sendTemplate(to, 'invoice_overdue', data);
  },

  /**
   * Send budget alert email
   */
  async sendBudgetAlertEmail(
    to: string,
    data: {
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
  ): Promise<EmailResult> {
    return this.sendTemplate(to, 'budget_alert', data);
  },

  /**
   * Send export ready email
   */
  async sendExportReadyEmail(
    to: string,
    data: {
      displayName: string;
      exportType: string;
      filename: string;
      downloadUrl: string;
      expiresAt: string;
    }
  ): Promise<EmailResult> {
    return this.sendTemplate(to, 'export_ready', data);
  },

  /**
   * Send weekly summary email
   */
  async sendWeeklySummaryEmail(
    to: string,
    data: {
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
  ): Promise<EmailResult> {
    return this.sendTemplate(to, 'weekly_summary', data);
  },

  /**
   * Verify SMTP connection
   */
  async verify(): Promise<boolean> {
    const transport = getTransporter();
    if (!transport) {
      return false;
    }

    try {
      await transport.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error({ error }, 'Email service connection verification failed');
      return false;
    }
  },
};

// ----------------------------------------------------------------------------
// Notification Preferences Service
// ----------------------------------------------------------------------------

export const notificationPreferencesService = {
  /**
   * Get user notification preferences
   */
  async getForUser(userId: string) {
    const preferences = await prisma.notificationPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      // Return default preferences if none exist
      return {
        id: '',
        userId,
        emailEnabled: true,
        budgetAlerts: true,
        invoiceReminders: true,
        weeklySummary: false,
        marketingEmails: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return preferences;
  },

  /**
   * Update user notification preferences
   */
  async update(userId: string, input: NotificationPreferencesInput) {
    const preferences = await prisma.notificationPreferences.upsert({
      where: { userId },
      create: {
        userId,
        emailEnabled: input.emailEnabled ?? true,
        budgetAlerts: input.budgetAlerts ?? true,
        invoiceReminders: input.invoiceReminders ?? true,
        weeklySummary: input.weeklySummary ?? false,
        marketingEmails: input.marketingEmails ?? false,
      },
      update: {
        ...(input.emailEnabled !== undefined && { emailEnabled: input.emailEnabled }),
        ...(input.budgetAlerts !== undefined && { budgetAlerts: input.budgetAlerts }),
        ...(input.invoiceReminders !== undefined && { invoiceReminders: input.invoiceReminders }),
        ...(input.weeklySummary !== undefined && { weeklySummary: input.weeklySummary }),
        ...(input.marketingEmails !== undefined && { marketingEmails: input.marketingEmails }),
      },
    });

    return preferences;
  },

  /**
   * Check if user has email enabled for a specific notification type
   */
  async shouldSendEmail(
    userId: string,
    notificationType: 'budgetAlerts' | 'invoiceReminders' | 'weeklySummary' | 'marketingEmails'
  ): Promise<boolean> {
    const preferences = await this.getForUser(userId);

    if (!preferences.emailEnabled) {
      return false;
    }

    return preferences[notificationType];
  },

  /**
   * Create default preferences for a new user
   */
  async createDefaultForUser(userId: string) {
    return prisma.notificationPreferences.create({
      data: {
        userId,
        emailEnabled: true,
        budgetAlerts: true,
        invoiceReminders: true,
        weeklySummary: false,
        marketingEmails: false,
      },
    });
  },
};

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------

function normalizeRecipients(
  to: string | { email: string; name?: string } | Array<string | { email: string; name?: string }>
): string {
  if (typeof to === 'string') {
    return to;
  }

  if (Array.isArray(to)) {
    return to
      .map((recipient) => {
        if (typeof recipient === 'string') {
          return recipient;
        }
        return recipient.name ? `"${recipient.name}" <${recipient.email}>` : recipient.email;
      })
      .join(', ');
  }

  return to.name ? `"${to.name}" <${to.email}>` : to.email;
}

function normalizeFromAddress(
  from: string | { email: string; name?: string } | undefined
): string | undefined {
  if (!from) {
    return undefined;
  }

  if (typeof from === 'string') {
    return from;
  }

  return from.name ? `"${from.name}" <${from.email}>` : from.email;
}

// ----------------------------------------------------------------------------
// Initialization
// ----------------------------------------------------------------------------

export async function initEmailService(): Promise<void> {
  const config = getProviderConfig();

  if (!config) {
    logger.warn('Email service not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS to enable.');
    return;
  }

  // Initialize transporter
  getTransporter();

  // Verify connection in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const isConnected = await emailService.verify();
    if (!isConnected) {
      logger.warn('Email service verification failed, but will continue');
    }
  }
}

export default emailService;
