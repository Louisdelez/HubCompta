// ============================================================================
// ROUTE REGISTRATION - Finance Hub
// ============================================================================

import type { FastifyInstance } from 'fastify';

// Import route modules
import { authRoutes } from './auth.js';
import { userRoutes } from './user.js';
import { workspaceRoutes } from './workspaces.js';
import { accountRoutes } from './accounts.js';
import { transactionRoutes } from './transactions.js';
import { categoryRoutes } from './categories.js';
import { tagRoutes } from './tags.js';
import { reportRoutes } from './reports.js';
import { importRoutes } from './import.js';
import { ruleRoutes } from './rules.js';
import { budgetRoutes } from './budgets.js';
import { documentRoutes } from './documents.js';
import { exportRoutes } from './export.js';

// Pro mode routes
import { contactRoutes } from './contacts.js';
import { quoteRoutes } from './quotes.js';
import { invoiceRoutes } from './invoices.js';

// Investment routes
import { assetRoutes } from './assets.js';
import { positionRoutes } from './positions.js';
import { portfolioRoutes } from './portfolio.js';

// Notification routes
import { notificationRoutes } from './notifications.js';
import { notificationChannelRoutes } from './notification-channels.js';

// Alert routes
import { alertRoutes } from './alerts.js';

// Settings routes
import settingsRoutes from './settings.js';

// Health routes
import { healthRoutes } from './health.js';

// Admin routes
import { adminRoutes } from './admin.js';

// Recurrence routes
import { recurrenceRoutes } from './recurrences.js';

// Currency routes
import { currencyRoutes } from './currencies.js';

// Search routes
import { searchRoutes } from './search.js';

// Loan routes
import { loanRoutes } from './loans.js';

// Net worth routes
import { netWorthRoutes } from './networth.js';

// Scheduled transaction routes
import { scheduledRoutes } from './scheduled.js';

// Tax routes
import { taxRoutes } from './tax.js';

// Savings routes
import { savingsRoutes } from './savings.js';

// Bills routes
import { billRoutes } from './bills.js';

// Forecast routes
import { forecastRoutes } from './forecast.js';

// Dashboard routes
import { dashboardRoutes } from './dashboard.js';

// Activity routes
import { workspaceActivityRoutes, userActivityRoutes } from './activity.js';

// AI Categorization routes
import { categorizationRoutes } from './categorization.js';

// Banking routes (Open Banking)
import { bankingRoutes } from './banking.js';

// Gamification routes
import { gamificationRoutes } from './gamification.js';

// OCR routes (receipt scanning)
import { ocrRoutes } from './ocr.js';

// Audit routes
import { auditRoutes } from './audit.js';

// ----------------------------------------------------------------------------
// Route Registration
// ----------------------------------------------------------------------------

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // API version prefix
  const apiPrefix = '/api/v1';

  // ----------------------------------------------------------------------------
  // Public Routes (no auth required)
  // ----------------------------------------------------------------------------

  // Auth routes (login, register, MFA)
  await app.register(authRoutes, { prefix: `${apiPrefix}/auth` });

  // ----------------------------------------------------------------------------
  // Protected Routes (auth required)
  // ----------------------------------------------------------------------------

  // User routes
  await app.register(userRoutes, { prefix: `${apiPrefix}/user` });

  // Workspace routes
  await app.register(workspaceRoutes, { prefix: `${apiPrefix}/workspaces` });

  // Account routes (workspace scoped)
  await app.register(accountRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/accounts` });

  // Transaction routes (workspace scoped)
  await app.register(transactionRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/transactions` });

  // Category routes (workspace scoped)
  await app.register(categoryRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/categories` });

  // Tag routes (workspace scoped)
  await app.register(tagRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/tags` });

  // Report routes (workspace scoped)
  await app.register(reportRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/reports` });

  // Import routes (workspace scoped)
  await app.register(importRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/import` });

  // Rule routes (workspace scoped)
  await app.register(ruleRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/rules` });

  // Budget routes (workspace scoped)
  await app.register(budgetRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/budgets` });

  // Document routes (workspace scoped)
  await app.register(documentRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/documents` });

  // Recurrence routes (workspace scoped)
  await app.register(recurrenceRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/recurrences` });

  // Export routes (workspace scoped)
  await app.register(exportRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/export` });

  // ----------------------------------------------------------------------------
  // Pro Mode Routes (workspace scoped)
  // ----------------------------------------------------------------------------

  // Contact routes
  await app.register(contactRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/contacts` });

  // Quote routes
  await app.register(quoteRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/quotes` });

  // Invoice routes
  await app.register(invoiceRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/invoices` });

  // ----------------------------------------------------------------------------
  // Investment Routes
  // ----------------------------------------------------------------------------

  // Asset search (global)
  await app.register(assetRoutes, { prefix: `${apiPrefix}/assets` });

  // Currency routes (global)
  await app.register(currencyRoutes, { prefix: `${apiPrefix}/currencies` });

  // Position routes (workspace scoped)
  await app.register(positionRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/positions` });

  // Portfolio routes (workspace scoped)
  await app.register(portfolioRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/portfolio` });

  // Alert routes (workspace scoped)
  await app.register(alertRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/alerts/price` });

  // Loan routes (workspace scoped)
  await app.register(loanRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/loans` });

  // Net worth routes (workspace scoped)
  await app.register(netWorthRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/networth` });

  // Scheduled transaction routes (workspace scoped)
  await app.register(scheduledRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/scheduled` });

  // Tax routes (workspace scoped)
  await app.register(taxRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/tax` });

  // Savings routes (workspace scoped)
  await app.register(savingsRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/savings` });

  // Bills routes (workspace scoped)
  await app.register(billRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/bills` });

  // Forecast routes (workspace scoped)
  await app.register(forecastRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/forecast` });

  // Activity routes (workspace scoped)
  await app.register(workspaceActivityRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/activity` });

  // AI Categorization routes (workspace scoped)
  await app.register(categorizationRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/categorization` });

  // Banking routes (workspace scoped)
  await app.register(bankingRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/banking` });

  // OCR routes (workspace scoped)
  await app.register(ocrRoutes, { prefix: `${apiPrefix}/workspaces/:workspaceId/ocr` });

  // ----------------------------------------------------------------------------
  // Dashboard Routes (user scoped)
  // ----------------------------------------------------------------------------

  await app.register(dashboardRoutes, { prefix: `${apiPrefix}/dashboard` });

  // Activity routes (user scoped)
  await app.register(userActivityRoutes, { prefix: `${apiPrefix}/activity` });

  // ----------------------------------------------------------------------------
  // Notification Routes (user scoped)
  // ----------------------------------------------------------------------------

  await app.register(notificationRoutes, { prefix: `${apiPrefix}/notifications` });

  // Notification Channels Routes (user scoped)
  await app.register(notificationChannelRoutes, { prefix: `${apiPrefix}/users/me/notification-channels` });

  // ----------------------------------------------------------------------------
  // Settings Routes (user scoped)
  // ----------------------------------------------------------------------------

  await app.register(settingsRoutes, { prefix: `${apiPrefix}/settings` });

  // ----------------------------------------------------------------------------
  // Gamification Routes (user scoped)
  // ----------------------------------------------------------------------------

  await app.register(gamificationRoutes, { prefix: `${apiPrefix}/gamification` });

  // ----------------------------------------------------------------------------
  // Audit Routes (user scoped)
  // ----------------------------------------------------------------------------

  await app.register(auditRoutes, { prefix: apiPrefix });

  // ----------------------------------------------------------------------------
  // Admin Routes
  // ----------------------------------------------------------------------------

  // ----------------------------------------------------------------------------
  // Search Routes
  // ----------------------------------------------------------------------------

  await app.register(searchRoutes, { prefix: apiPrefix });

  // Health check routes
  await app.register(healthRoutes, { prefix: '/health' });

  // Admin routes (instance admin only)
  await app.register(adminRoutes, { prefix: `${apiPrefix}/admin` });

  // Placeholder route for now
  app.get(`${apiPrefix}/ping`, () => {
    return { pong: true, timestamp: new Date().toISOString() };
  });
}
