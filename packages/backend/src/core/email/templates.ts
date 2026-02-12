// ============================================================================
// EMAIL TEMPLATES - Finance Hub
// Professional HTML email templates with i18n support
// ============================================================================

import type {
  EmailTemplateName,
  EmailTemplateData,
  WelcomeEmailData,
  PasswordResetEmailData,
  InvoiceOverdueEmailData,
  BudgetAlertEmailData,
  ExportReadyEmailData,
  WeeklySummaryEmailData,
} from './types.js';
import { getEmailString, getLanguageMetadata, DEFAULT_LANGUAGE, type LanguageCode } from '../i18n/index.js';

// ----------------------------------------------------------------------------
// Base Template
// ----------------------------------------------------------------------------

const baseStyles = `
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 16px;
    line-height: 1.5;
    color: #333333;
    background-color: #f5f5f5;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
  }
  .header {
    background-color: #2563eb;
    padding: 24px;
    text-align: center;
  }
  .header h1 {
    margin: 0;
    color: #ffffff;
    font-size: 24px;
    font-weight: 600;
  }
  .content {
    padding: 32px 24px;
  }
  .greeting {
    font-size: 18px;
    margin-bottom: 16px;
  }
  .button {
    display: inline-block;
    background-color: #2563eb;
    color: #ffffff !important;
    text-decoration: none;
    padding: 12px 24px;
    border-radius: 6px;
    font-weight: 500;
    margin: 16px 0;
  }
  .button:hover {
    background-color: #1d4ed8;
  }
  .button-secondary {
    background-color: #6b7280;
  }
  .alert-box {
    padding: 16px;
    border-radius: 8px;
    margin: 16px 0;
  }
  .alert-warning {
    background-color: #fef3c7;
    border: 1px solid #f59e0b;
  }
  .alert-danger {
    background-color: #fee2e2;
    border: 1px solid #ef4444;
  }
  .alert-success {
    background-color: #d1fae5;
    border: 1px solid #10b981;
  }
  .alert-info {
    background-color: #dbeafe;
    border: 1px solid #3b82f6;
  }
  .stats-table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
  }
  .stats-table td {
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
  }
  .stats-table .label {
    color: #6b7280;
    width: 50%;
  }
  .stats-table .value {
    font-weight: 600;
    text-align: right;
  }
  .footer {
    background-color: #f9fafb;
    padding: 24px;
    text-align: center;
    font-size: 14px;
    color: #6b7280;
    border-top: 1px solid #e5e7eb;
  }
  .footer a {
    color: #2563eb;
    text-decoration: none;
  }
  .small-text {
    font-size: 12px;
    color: #9ca3af;
  }
`;

function wrapInBaseTemplate(content: string, title: string, locale: LanguageCode): string {
  const langCode = locale.split('-')[0];
  const footer = getEmailString(locale, 'footer');
  const footerIgnore = getEmailString(locale, 'footerIgnore');

  return `
<!DOCTYPE html>
<html lang="${langCode}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>HubCompta</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>${footer}</p>
      <p class="small-text">
        ${footerIgnore}
      </p>
    </div>
  </div>
</body>
</html>
`;
}

// ----------------------------------------------------------------------------
// Template Generators
// ----------------------------------------------------------------------------

function generateWelcomeEmail(data: WelcomeEmailData, locale: LanguageCode): { subject: string; html: string } {
  const t = (key: string, vars?: Record<string, string | number>) => getEmailString(locale, key, vars);

  const content = `
    <p class="greeting">${t('greeting', { displayName: escapeHtml(data.displayName) })}</p>
    <p>${t('welcome.intro')}</p>
    <p>${t('welcome.body')}</p>
    <ul>
      <li>${t('welcome.features.tracking')}</li>
      <li>${t('welcome.features.budgets')}</li>
      <li>${t('welcome.features.reports')}</li>
      <li>${t('welcome.features.invoicing')}</li>
    </ul>
    <p style="text-align: center;">
      <a href="${escapeHtml(data.loginUrl)}" class="button">${t('welcome.cta')}</a>
    </p>
    <p>${t('welcome.closing')}</p>
  `;

  return {
    subject: t('welcome.subject'),
    html: wrapInBaseTemplate(content, t('welcome.title'), locale),
  };
}

function generatePasswordResetEmail(data: PasswordResetEmailData, locale: LanguageCode): { subject: string; html: string } {
  const t = (key: string, vars?: Record<string, string | number>) => getEmailString(locale, key, vars);

  const content = `
    <p class="greeting">${t('greeting', { displayName: escapeHtml(data.displayName) })}</p>
    <p>${t('passwordReset.intro')}</p>
    <p>${t('passwordReset.body')}</p>
    <p style="text-align: center;">
      <a href="${escapeHtml(data.resetUrl)}" class="button">${t('passwordReset.cta')}</a>
    </p>
    <div class="alert-box alert-warning">
      <strong>${t('passwordReset.expiry', { expiresIn: escapeHtml(data.expiresIn) })}</strong>
    </div>
    <p class="small-text">
      ${t('passwordReset.ignoreNote')}
    </p>
  `;

  return {
    subject: t('passwordReset.subject'),
    html: wrapInBaseTemplate(content, t('passwordReset.title'), locale),
  };
}

function generateInvoiceOverdueEmail(data: InvoiceOverdueEmailData, locale: LanguageCode): { subject: string; html: string } {
  const t = (key: string, vars?: Record<string, string | number>) => getEmailString(locale, key, vars);

  const content = `
    <p class="greeting">${t('greeting', { displayName: escapeHtml(data.displayName) })}</p>
    <div class="alert-box alert-danger">
      <strong>${t('invoiceOverdue.alertTitle')}</strong>
    </div>
    <p>${t('invoiceOverdue.intro', { daysOverdue: data.daysOverdue })}</p>
    <table class="stats-table">
      <tr>
        <td class="label">${t('invoiceOverdue.invoiceNumber')}</td>
        <td class="value">${escapeHtml(data.invoiceNumber)}</td>
      </tr>
      <tr>
        <td class="label">${t('invoiceOverdue.client')}</td>
        <td class="value">${escapeHtml(data.clientName)}</td>
      </tr>
      <tr>
        <td class="label">${t('invoiceOverdue.amount')}</td>
        <td class="value">${escapeHtml(data.amount)} ${escapeHtml(data.currency)}</td>
      </tr>
      <tr>
        <td class="label">${t('invoiceOverdue.dueDate')}</td>
        <td class="value">${escapeHtml(data.dueDate)}</td>
      </tr>
    </table>
    <p style="text-align: center;">
      <a href="${escapeHtml(data.invoiceUrl)}" class="button">${t('invoiceOverdue.cta')}</a>
    </p>
    <p>${t('invoiceOverdue.recommendation')}</p>
  `;

  return {
    subject: t('invoiceOverdue.subject', { invoiceNumber: data.invoiceNumber }),
    html: wrapInBaseTemplate(content, t('invoiceOverdue.title'), locale),
  };
}

function generateBudgetAlertEmail(data: BudgetAlertEmailData, locale: LanguageCode): { subject: string; html: string } {
  const t = (key: string, vars?: Record<string, string | number>) => getEmailString(locale, key, vars);

  const alertClass = data.isExceeded ? 'alert-danger' : 'alert-warning';
  const alertTitle = data.isExceeded ? t('budgetAlert.titleExceeded') : t('budgetAlert.titleWarning');
  const alertMessage = data.isExceeded
    ? t('budgetAlert.messageExceeded', { budgetName: escapeHtml(data.budgetName) })
    : t('budgetAlert.messageWarning', { budgetName: escapeHtml(data.budgetName) });

  const content = `
    <p class="greeting">${t('greeting', { displayName: escapeHtml(data.displayName) })}</p>
    <div class="alert-box ${alertClass}">
      <strong>${alertTitle}</strong>
    </div>
    <p>${alertMessage}</p>
    <table class="stats-table">
      <tr>
        <td class="label">${t('budgetAlert.budget')}</td>
        <td class="value">${escapeHtml(data.budgetName)}</td>
      </tr>
      <tr>
        <td class="label">${t('budgetAlert.category')}</td>
        <td class="value">${escapeHtml(data.categoryName)}</td>
      </tr>
      <tr>
        <td class="label">${t('budgetAlert.spent')}</td>
        <td class="value">${escapeHtml(data.amountSpent)} ${escapeHtml(data.currency)}</td>
      </tr>
      <tr>
        <td class="label">${t('budgetAlert.limit')}</td>
        <td class="value">${escapeHtml(data.budgetLimit)} ${escapeHtml(data.currency)}</td>
      </tr>
      <tr>
        <td class="label">${t('budgetAlert.usage')}</td>
        <td class="value" style="color: ${data.isExceeded ? '#ef4444' : '#f59e0b'};">${data.percentUsed.toFixed(0)}%</td>
      </tr>
    </table>
    <p style="text-align: center;">
      <a href="${escapeHtml(data.budgetUrl)}" class="button">${t('budgetAlert.cta')}</a>
    </p>
  `;

  const subject = data.isExceeded
    ? t('budgetAlert.subjectExceeded', { budgetName: data.budgetName })
    : t('budgetAlert.subjectWarning', { budgetName: data.budgetName, percentUsed: data.percentUsed.toFixed(0) });

  return {
    subject,
    html: wrapInBaseTemplate(content, alertTitle, locale),
  };
}

function generateExportReadyEmail(data: ExportReadyEmailData, locale: LanguageCode): { subject: string; html: string } {
  const t = (key: string, vars?: Record<string, string | number>) => getEmailString(locale, key, vars);

  const content = `
    <p class="greeting">${t('greeting', { displayName: escapeHtml(data.displayName) })}</p>
    <div class="alert-box alert-success">
      <strong>${t('exportReady.alertTitle')}</strong>
    </div>
    <p>${t('exportReady.intro', { exportType: escapeHtml(data.exportType) })}</p>
    <table class="stats-table">
      <tr>
        <td class="label">${t('exportReady.exportType')}</td>
        <td class="value">${escapeHtml(data.exportType)}</td>
      </tr>
      <tr>
        <td class="label">${t('exportReady.filename')}</td>
        <td class="value">${escapeHtml(data.filename)}</td>
      </tr>
      <tr>
        <td class="label">${t('exportReady.expiresAt')}</td>
        <td class="value">${escapeHtml(data.expiresAt)}</td>
      </tr>
    </table>
    <p style="text-align: center;">
      <a href="${escapeHtml(data.downloadUrl)}" class="button">${t('exportReady.cta')}</a>
    </p>
    <p class="small-text">
      ${t('exportReady.expiryNote', { expiresAt: escapeHtml(data.expiresAt) })}
    </p>
  `;

  return {
    subject: t('exportReady.subject', { exportType: data.exportType }),
    html: wrapInBaseTemplate(content, t('exportReady.title'), locale),
  };
}

function generateWeeklySummaryEmail(data: WeeklySummaryEmailData, locale: LanguageCode): { subject: string; html: string } {
  const t = (key: string, vars?: Record<string, string | number>) => getEmailString(locale, key, vars);

  const topCategoriesHtml = data.topCategories
    .map(
      (cat) => `
        <tr>
          <td class="label">${escapeHtml(cat.name)}</td>
          <td class="value">${escapeHtml(cat.amount)} (${cat.percentage.toFixed(0)}%)</td>
        </tr>
      `
    )
    .join('');

  const budgetAlertsHtml =
    data.budgetAlerts.length > 0
      ? `
        <div class="alert-box alert-warning" style="margin-top: 24px;">
          <strong>${t('weeklySummary.budgetAlerts')}</strong>
          <ul style="margin: 8px 0 0 0; padding-left: 20px;">
            ${data.budgetAlerts.map((b) => `<li>${escapeHtml(b.name)}: ${b.percentUsed.toFixed(0)}%</li>`).join('')}
          </ul>
        </div>
      `
      : '';

  const content = `
    <p class="greeting">${t('greeting', { displayName: escapeHtml(data.displayName) })}</p>
    <p>${t('weeklySummary.intro', { weekStart: escapeHtml(data.weekStart), weekEnd: escapeHtml(data.weekEnd) })}</p>

    <div class="alert-box alert-info">
      <table style="width: 100%;">
        <tr>
          <td style="text-align: center; padding: 8px;">
            <div style="font-size: 12px; color: #6b7280;">${t('weeklySummary.income')}</div>
            <div style="font-size: 20px; font-weight: 600; color: #10b981;">+${escapeHtml(data.totalIncome)}</div>
          </td>
          <td style="text-align: center; padding: 8px;">
            <div style="font-size: 12px; color: #6b7280;">${t('weeklySummary.expenses')}</div>
            <div style="font-size: 20px; font-weight: 600; color: #ef4444;">-${escapeHtml(data.totalExpenses)}</div>
          </td>
          <td style="text-align: center; padding: 8px;">
            <div style="font-size: 12px; color: #6b7280;">${t('weeklySummary.balance')}</div>
            <div style="font-size: 20px; font-weight: 600;">${escapeHtml(data.netChange)} ${escapeHtml(data.currency)}</div>
          </td>
        </tr>
      </table>
    </div>

    ${
      data.topCategories.length > 0
        ? `
      <h3 style="margin-top: 24px; margin-bottom: 12px;">${t('weeklySummary.topCategories')}</h3>
      <table class="stats-table">
        ${topCategoriesHtml}
      </table>
    `
        : ''
    }

    ${budgetAlertsHtml}

    <p style="text-align: center; margin-top: 24px;">
      <a href="${escapeHtml(data.dashboardUrl)}" class="button">${t('weeklySummary.cta')}</a>
    </p>
  `;

  return {
    subject: t('weeklySummary.subject', { weekStart: data.weekStart, weekEnd: data.weekEnd }),
    html: wrapInBaseTemplate(content, t('weeklySummary.title'), locale),
  };
}

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------

function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] ?? char);
}

// ----------------------------------------------------------------------------
// Main Template Generator
// ----------------------------------------------------------------------------

export function generateEmailTemplate<T extends EmailTemplateName>(
  templateName: T,
  data: EmailTemplateData[T],
  locale: LanguageCode = DEFAULT_LANGUAGE
): { subject: string; html: string } {
  switch (templateName) {
    case 'welcome':
      return generateWelcomeEmail(data as WelcomeEmailData, locale);
    case 'password_reset':
      return generatePasswordResetEmail(data as PasswordResetEmailData, locale);
    case 'invoice_overdue':
      return generateInvoiceOverdueEmail(data as InvoiceOverdueEmailData, locale);
    case 'budget_alert':
      return generateBudgetAlertEmail(data as BudgetAlertEmailData, locale);
    case 'export_ready':
      return generateExportReadyEmail(data as ExportReadyEmailData, locale);
    case 'weekly_summary':
      return generateWeeklySummaryEmail(data as WeeklySummaryEmailData, locale);
    default:
      throw new Error(`Unknown email template: ${templateName}`);
  }
}

export default generateEmailTemplate;
