// ============================================================================
// EMAIL TEMPLATES - Finance Hub
// Professional HTML email templates with inline CSS
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

function wrapInBaseTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
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
      <p>Cet email a ete envoye automatiquement par HubCompta.</p>
      <p class="small-text">
        Si vous n'avez pas demande cet email, vous pouvez l'ignorer en toute securite.
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

function generateWelcomeEmail(data: WelcomeEmailData): { subject: string; html: string } {
  const content = `
    <p class="greeting">Bonjour ${escapeHtml(data.displayName)},</p>
    <p>Bienvenue sur HubCompta ! Votre compte a ete cree avec succes.</p>
    <p>HubCompta vous aide a gerer vos finances personnelles et professionnelles en toute simplicite :</p>
    <ul>
      <li>Suivez vos revenus et depenses</li>
      <li>Creez et gerez vos budgets</li>
      <li>Generez des rapports detailles</li>
      <li>Facturez vos clients (mode Pro)</li>
    </ul>
    <p style="text-align: center;">
      <a href="${escapeHtml(data.loginUrl)}" class="button">Acceder a mon espace</a>
    </p>
    <p>A bientot sur HubCompta !</p>
  `;

  return {
    subject: 'Bienvenue sur HubCompta !',
    html: wrapInBaseTemplate(content, 'Bienvenue sur HubCompta'),
  };
}

function generatePasswordResetEmail(data: PasswordResetEmailData): { subject: string; html: string } {
  const content = `
    <p class="greeting">Bonjour ${escapeHtml(data.displayName)},</p>
    <p>Vous avez demande la reinitialisation de votre mot de passe.</p>
    <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
    <p style="text-align: center;">
      <a href="${escapeHtml(data.resetUrl)}" class="button">Reinitialiser mon mot de passe</a>
    </p>
    <div class="alert-box alert-warning">
      <strong>Important :</strong> Ce lien expire dans ${escapeHtml(data.expiresIn)}.
    </div>
    <p class="small-text">
      Si vous n'avez pas demande cette reinitialisation, ignorez cet email.
      Votre mot de passe restera inchange.
    </p>
  `;

  return {
    subject: 'Reinitialisation de votre mot de passe HubCompta',
    html: wrapInBaseTemplate(content, 'Reinitialisation de mot de passe'),
  };
}

function generateInvoiceOverdueEmail(data: InvoiceOverdueEmailData): { subject: string; html: string } {
  const content = `
    <p class="greeting">Bonjour ${escapeHtml(data.displayName)},</p>
    <div class="alert-box alert-danger">
      <strong>Facture en retard de paiement</strong>
    </div>
    <p>La facture suivante est en retard de ${data.daysOverdue} jour(s) :</p>
    <table class="stats-table">
      <tr>
        <td class="label">Numero de facture</td>
        <td class="value">${escapeHtml(data.invoiceNumber)}</td>
      </tr>
      <tr>
        <td class="label">Client</td>
        <td class="value">${escapeHtml(data.clientName)}</td>
      </tr>
      <tr>
        <td class="label">Montant</td>
        <td class="value">${escapeHtml(data.amount)} ${escapeHtml(data.currency)}</td>
      </tr>
      <tr>
        <td class="label">Date d'echeance</td>
        <td class="value">${escapeHtml(data.dueDate)}</td>
      </tr>
    </table>
    <p style="text-align: center;">
      <a href="${escapeHtml(data.invoiceUrl)}" class="button">Voir la facture</a>
    </p>
    <p>Nous vous recommandons de relancer votre client pour le paiement.</p>
  `;

  return {
    subject: `Facture ${data.invoiceNumber} en retard de paiement`,
    html: wrapInBaseTemplate(content, 'Facture en retard'),
  };
}

function generateBudgetAlertEmail(data: BudgetAlertEmailData): { subject: string; html: string } {
  const alertClass = data.isExceeded ? 'alert-danger' : 'alert-warning';
  const alertTitle = data.isExceeded ? 'Budget depasse !' : 'Budget bientot atteint';
  const alertMessage = data.isExceeded
    ? `Votre budget "${escapeHtml(data.budgetName)}" a ete depasse.`
    : `Votre budget "${escapeHtml(data.budgetName)}" approche de sa limite.`;

  const content = `
    <p class="greeting">Bonjour ${escapeHtml(data.displayName)},</p>
    <div class="alert-box ${alertClass}">
      <strong>${alertTitle}</strong>
    </div>
    <p>${alertMessage}</p>
    <table class="stats-table">
      <tr>
        <td class="label">Budget</td>
        <td class="value">${escapeHtml(data.budgetName)}</td>
      </tr>
      <tr>
        <td class="label">Categorie</td>
        <td class="value">${escapeHtml(data.categoryName)}</td>
      </tr>
      <tr>
        <td class="label">Depense</td>
        <td class="value">${escapeHtml(data.amountSpent)} ${escapeHtml(data.currency)}</td>
      </tr>
      <tr>
        <td class="label">Limite</td>
        <td class="value">${escapeHtml(data.budgetLimit)} ${escapeHtml(data.currency)}</td>
      </tr>
      <tr>
        <td class="label">Utilisation</td>
        <td class="value" style="color: ${data.isExceeded ? '#ef4444' : '#f59e0b'};">${data.percentUsed.toFixed(0)}%</td>
      </tr>
    </table>
    <p style="text-align: center;">
      <a href="${escapeHtml(data.budgetUrl)}" class="button">Voir le budget</a>
    </p>
  `;

  const subject = data.isExceeded
    ? `Budget "${data.budgetName}" depasse`
    : `Budget "${data.budgetName}" a ${data.percentUsed.toFixed(0)}%`;

  return {
    subject,
    html: wrapInBaseTemplate(content, 'Alerte budget'),
  };
}

function generateExportReadyEmail(data: ExportReadyEmailData): { subject: string; html: string } {
  const content = `
    <p class="greeting">Bonjour ${escapeHtml(data.displayName)},</p>
    <div class="alert-box alert-success">
      <strong>Votre export est pret !</strong>
    </div>
    <p>Votre export ${escapeHtml(data.exportType)} est maintenant disponible au telechargement.</p>
    <table class="stats-table">
      <tr>
        <td class="label">Type d'export</td>
        <td class="value">${escapeHtml(data.exportType)}</td>
      </tr>
      <tr>
        <td class="label">Fichier</td>
        <td class="value">${escapeHtml(data.filename)}</td>
      </tr>
      <tr>
        <td class="label">Expire le</td>
        <td class="value">${escapeHtml(data.expiresAt)}</td>
      </tr>
    </table>
    <p style="text-align: center;">
      <a href="${escapeHtml(data.downloadUrl)}" class="button">Telecharger l'export</a>
    </p>
    <p class="small-text">
      Ce lien de telechargement expirera le ${escapeHtml(data.expiresAt)}.
    </p>
  `;

  return {
    subject: `Votre export ${data.exportType} est pret`,
    html: wrapInBaseTemplate(content, 'Export pret'),
  };
}

function generateWeeklySummaryEmail(data: WeeklySummaryEmailData): { subject: string; html: string } {
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
          <strong>Alertes budget</strong>
          <ul style="margin: 8px 0 0 0; padding-left: 20px;">
            ${data.budgetAlerts.map((b) => `<li>${escapeHtml(b.name)}: ${b.percentUsed.toFixed(0)}%</li>`).join('')}
          </ul>
        </div>
      `
      : '';

  const content = `
    <p class="greeting">Bonjour ${escapeHtml(data.displayName)},</p>
    <p>Voici le resume de votre semaine du ${escapeHtml(data.weekStart)} au ${escapeHtml(data.weekEnd)} :</p>

    <div class="alert-box alert-info">
      <table style="width: 100%;">
        <tr>
          <td style="text-align: center; padding: 8px;">
            <div style="font-size: 12px; color: #6b7280;">Revenus</div>
            <div style="font-size: 20px; font-weight: 600; color: #10b981;">+${escapeHtml(data.totalIncome)}</div>
          </td>
          <td style="text-align: center; padding: 8px;">
            <div style="font-size: 12px; color: #6b7280;">Depenses</div>
            <div style="font-size: 20px; font-weight: 600; color: #ef4444;">-${escapeHtml(data.totalExpenses)}</div>
          </td>
          <td style="text-align: center; padding: 8px;">
            <div style="font-size: 12px; color: #6b7280;">Solde</div>
            <div style="font-size: 20px; font-weight: 600;">${escapeHtml(data.netChange)} ${escapeHtml(data.currency)}</div>
          </td>
        </tr>
      </table>
    </div>

    ${
      data.topCategories.length > 0
        ? `
      <h3 style="margin-top: 24px; margin-bottom: 12px;">Top categories de depenses</h3>
      <table class="stats-table">
        ${topCategoriesHtml}
      </table>
    `
        : ''
    }

    ${budgetAlertsHtml}

    <p style="text-align: center; margin-top: 24px;">
      <a href="${escapeHtml(data.dashboardUrl)}" class="button">Voir le tableau de bord</a>
    </p>
  `;

  return {
    subject: `Resume de votre semaine - ${data.weekStart} au ${data.weekEnd}`,
    html: wrapInBaseTemplate(content, 'Resume hebdomadaire'),
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
  data: EmailTemplateData[T]
): { subject: string; html: string } {
  switch (templateName) {
    case 'welcome':
      return generateWelcomeEmail(data as WelcomeEmailData);
    case 'password_reset':
      return generatePasswordResetEmail(data as PasswordResetEmailData);
    case 'invoice_overdue':
      return generateInvoiceOverdueEmail(data as InvoiceOverdueEmailData);
    case 'budget_alert':
      return generateBudgetAlertEmail(data as BudgetAlertEmailData);
    case 'export_ready':
      return generateExportReadyEmail(data as ExportReadyEmailData);
    case 'weekly_summary':
      return generateWeeklySummaryEmail(data as WeeklySummaryEmailData);
    default:
      throw new Error(`Unknown email template: ${templateName}`);
  }
}

export default generateEmailTemplate;
