// ============================================================================
// NOTIFICATION SERVICE - Finance Hub
// In-app notifications management with multi-channel delivery
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { Prisma, type NotificationType } from '@prisma/client';
import { broadcastNotification } from '@/core/websocket/index.js';
import type { NotificationPayload } from '@/core/websocket/types.js';
import { emailService, notificationPreferencesService } from '@/core/email/index.js';
import { logger } from '@/core/middleware/logger.js';
import { notificationDispatcherService } from './dispatcher.service.js';
import {
  getNotificationMessage,
  DEFAULT_LANGUAGE,
} from '@/core/i18n/index.js';
import type { LanguageCode } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Helper to get user locale
// ----------------------------------------------------------------------------

async function getUserLocale(userId: string): Promise<LanguageCode> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { locale: true },
  });
  return (user?.locale as LanguageCode) || DEFAULT_LANGUAGE;
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface CreateNotificationInput {
  userId: string;
  workspaceId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface NotificationFilters {
  isRead?: boolean;
  type?: NotificationType;
  workspaceId?: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// ----------------------------------------------------------------------------
// Notification Service
// ----------------------------------------------------------------------------

export const notificationService = {
  // --------------------------------------------------------------------------
  // Create Notification
  // --------------------------------------------------------------------------
  async create(input: CreateNotificationInput, options?: { skipMultiChannel?: boolean }) {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: (input.data ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    // Broadcast via WebSocket
    const payload: NotificationPayload = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      workspaceId: notification.workspaceId ?? undefined,
      data: input.data,
      createdAt: notification.createdAt.toISOString(),
    };
    broadcastNotification(input.userId, payload);

    // Dispatch to multi-channel (async, don't block the response)
    if (!options?.skipMultiChannel) {
      notificationDispatcherService.dispatch(notification).catch((error) => {
        logger.error({ error, notificationId: notification.id }, 'Failed to dispatch notification to channels');
      });
    }

    return notification;
  },

  // --------------------------------------------------------------------------
  // Create Multiple Notifications (for batch operations)
  // --------------------------------------------------------------------------
  createMany(notifications: CreateNotificationInput[]) {
    return prisma.notification.createMany({
      data: notifications.map((n) => ({
        userId: n.userId,
        workspaceId: n.workspaceId,
        type: n.type,
        title: n.title,
        message: n.message,
        data: (n.data ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      })),
    });
  },

  // --------------------------------------------------------------------------
  // Get Notifications for User
  // --------------------------------------------------------------------------
  async listForUser(
    userId: string,
    filters: NotificationFilters = {},
    pagination: PaginationParams = {}
  ) {
    const { isRead, type, workspaceId } = filters;
    const { page = 1, pageSize = 20 } = pagination;

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(isRead !== undefined && { isRead }),
      ...(type && { type }),
      ...(workspaceId && { workspaceId }),
    };

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          workspace: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  // --------------------------------------------------------------------------
  // Get Unread Count
  // --------------------------------------------------------------------------
  getUnreadCount(userId: string, workspaceId?: string) {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
        ...(workspaceId && { workspaceId }),
      },
    });
  },

  // --------------------------------------------------------------------------
  // Mark as Read
  // --------------------------------------------------------------------------
  markAsRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  },

  // --------------------------------------------------------------------------
  // Mark All as Read
  // --------------------------------------------------------------------------
  markAllAsRead(userId: string, workspaceId?: string) {
    return prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
        ...(workspaceId && { workspaceId }),
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  },

  // --------------------------------------------------------------------------
  // Delete Notification
  // --------------------------------------------------------------------------
  delete(notificationId: string, userId: string) {
    return prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId,
      },
    });
  },

  // --------------------------------------------------------------------------
  // Delete Old Notifications
  // --------------------------------------------------------------------------
  deleteOld(olderThanDays: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    return prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true,
      },
    });
  },

  // ==========================================================================
  // Notification Creators (convenience methods)
  // ==========================================================================

  // --------------------------------------------------------------------------
  // Budget Alert (with optional email)
  // --------------------------------------------------------------------------
  async notifyBudgetAlert(
    userId: string,
    workspaceId: string,
    budget: { id: string; name: string; categoryName: string; amount: number; spent: number },
    percentUsed: number,
    isExceeded: boolean,
    options?: { currency?: string; budgetUrl?: string }
  ) {
    const locale = await getUserLocale(userId);
    const type = isExceeded ? 'budget_alert' : 'budget_warning';
    const titleKey = isExceeded ? 'budgetExceeded.title' : 'budgetWarning.title';
    const messageKey = isExceeded ? 'budgetExceeded.message' : 'budgetWarning.message';

    const title = getNotificationMessage(locale, titleKey, {
      budgetName: budget.name,
    });
    const message = getNotificationMessage(locale, messageKey, {
      categoryName: budget.categoryName,
      percentUsed: percentUsed.toFixed(0),
    });

    // Create in-app notification
    const notification = await this.create({
      userId,
      workspaceId,
      type: type as NotificationType,
      title,
      message,
      data: {
        budgetId: budget.id,
        categoryName: budget.categoryName,
        percentUsed,
      },
    });

    // Send email if user has budget alerts enabled
    try {
      const shouldSendEmail = await notificationPreferencesService.shouldSendEmail(userId, 'budgetAlerts');
      if (shouldSendEmail) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          const currency = options?.currency ?? 'EUR';
          const budgetUrl = options?.budgetUrl ?? `${process.env.FRONTEND_URL}/budgets`;

          await emailService.sendBudgetAlertEmail(user.email, {
            displayName: user.displayName,
            budgetName: budget.name,
            categoryName: budget.categoryName,
            percentUsed,
            amountSpent: budget.spent.toFixed(2),
            budgetLimit: budget.amount.toFixed(2),
            currency,
            isExceeded,
            budgetUrl,
          });
        }
      }
    } catch (error) {
      logger.error({ error, userId }, 'Failed to send budget alert email');
    }

    return notification;
  },

  // --------------------------------------------------------------------------
  // Import Complete
  // --------------------------------------------------------------------------
  async notifyImportComplete(
    userId: string,
    workspaceId: string,
    result: { imported: number; skipped: number; errors: number }
  ) {
    const locale = await getUserLocale(userId);
    const hasErrors = result.errors > 0;

    const titleKey = hasErrors ? 'importCompleteWithErrors.title' : 'importComplete.title';
    const title = getNotificationMessage(locale, titleKey);

    // Build skipped and errors parts
    const skippedPart = result.skipped > 0
      ? getNotificationMessage(locale, 'importComplete.skipped', { count: result.skipped })
      : '';
    const errorsPart = hasErrors
      ? getNotificationMessage(locale, 'importComplete.errors', { count: result.errors })
      : '';

    const message = getNotificationMessage(locale, 'importComplete.message', {
      imported: result.imported,
      skipped: skippedPart,
      errors: errorsPart,
    });

    return this.create({
      userId,
      workspaceId,
      type: 'import_complete',
      title,
      message,
      data: result,
    });
  },

  // --------------------------------------------------------------------------
  // Export Ready (with email)
  // --------------------------------------------------------------------------
  async notifyExportReady(
    userId: string,
    workspaceId: string,
    exportInfo: { type: string; filename: string; downloadUrl?: string; expiresAt?: string }
  ) {
    const locale = await getUserLocale(userId);
    const title = getNotificationMessage(locale, 'exportReady.title');
    const message = getNotificationMessage(locale, 'exportReady.message', {
      exportType: exportInfo.type,
    });

    // Create in-app notification
    const notification = await this.create({
      userId,
      workspaceId,
      type: 'export_ready',
      title,
      message,
      data: exportInfo,
    });

    // Always send email for export ready (if email is enabled globally)
    try {
      const preferences = await notificationPreferencesService.getForUser(userId);
      if (preferences.emailEnabled && exportInfo.downloadUrl) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-US';
          await emailService.sendExportReadyEmail(user.email, {
            displayName: user.displayName,
            exportType: exportInfo.type,
            filename: exportInfo.filename,
            downloadUrl: exportInfo.downloadUrl,
            expiresAt: exportInfo.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString(dateLocale),
          });
        }
      }
    } catch (error) {
      logger.error({ error, userId }, 'Failed to send export ready email');
    }

    return notification;
  },

  // --------------------------------------------------------------------------
  // Invoice Overdue (with email)
  // --------------------------------------------------------------------------
  async notifyInvoiceOverdue(
    userId: string,
    workspaceId: string,
    invoice: {
      id: string;
      number: string;
      contactName: string;
      amount: number;
      dueDate?: Date;
      daysOverdue?: number;
    },
    options?: { currency?: string; invoiceUrl?: string }
  ) {
    const locale = await getUserLocale(userId);
    const currency = options?.currency ?? 'EUR';

    const title = getNotificationMessage(locale, 'invoiceOverdue.title', {
      invoiceNumber: invoice.number,
    });
    const message = getNotificationMessage(locale, 'invoiceOverdue.message', {
      invoiceNumber: invoice.number,
      clientName: invoice.contactName,
      amount: invoice.amount.toFixed(2),
      currency,
    });

    // Create in-app notification
    const notification = await this.create({
      userId,
      workspaceId,
      type: 'invoice_overdue',
      title,
      message,
      data: { invoiceId: invoice.id },
    });

    // Send email if user has invoice reminders enabled
    try {
      const shouldSendEmail = await notificationPreferencesService.shouldSendEmail(userId, 'invoiceReminders');
      if (shouldSendEmail) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          const invoiceUrl = options?.invoiceUrl ?? `${process.env.FRONTEND_URL}/invoices/${invoice.id}`;
          const dueDate = invoice.dueDate ?? new Date();
          const daysOverdue = invoice.daysOverdue ?? Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-US';

          await emailService.sendInvoiceOverdueEmail(user.email, {
            displayName: user.displayName,
            invoiceNumber: invoice.number,
            clientName: invoice.contactName,
            amount: invoice.amount.toFixed(2),
            currency,
            dueDate: dueDate.toLocaleDateString(dateLocale),
            daysOverdue: Math.max(1, daysOverdue),
            invoiceUrl,
          });
        }
      }
    } catch (error) {
      logger.error({ error, userId }, 'Failed to send invoice overdue email');
    }

    return notification;
  },

  // --------------------------------------------------------------------------
  // Invoice Paid
  // --------------------------------------------------------------------------
  async notifyInvoicePaid(
    userId: string,
    workspaceId: string,
    invoice: { id: string; number: string; contactName: string; amount: number },
    options?: { currency?: string }
  ) {
    const locale = await getUserLocale(userId);
    const currency = options?.currency ?? 'EUR';

    const title = getNotificationMessage(locale, 'invoicePaid.title', {
      invoiceNumber: invoice.number,
    });
    const message = getNotificationMessage(locale, 'invoicePaid.message', {
      invoiceNumber: invoice.number,
      clientName: invoice.contactName,
      amount: invoice.amount.toFixed(2),
      currency,
    });

    return this.create({
      userId,
      workspaceId,
      type: 'invoice_paid',
      title,
      message,
      data: { invoiceId: invoice.id },
    });
  },

  // --------------------------------------------------------------------------
  // Quote Accepted
  // --------------------------------------------------------------------------
  async notifyQuoteAccepted(
    userId: string,
    workspaceId: string,
    quote: { id: string; number: string; contactName: string; amount: number },
    options?: { currency?: string }
  ) {
    const locale = await getUserLocale(userId);
    const currency = options?.currency ?? 'EUR';

    const title = getNotificationMessage(locale, 'quoteAccepted.title', {
      quoteNumber: quote.number,
    });
    const message = getNotificationMessage(locale, 'quoteAccepted.message', {
      quoteNumber: quote.number,
      clientName: quote.contactName,
      amount: quote.amount.toFixed(2),
      currency,
    });

    return this.create({
      userId,
      workspaceId,
      type: 'quote_accepted',
      title,
      message,
      data: { quoteId: quote.id },
    });
  },

  // --------------------------------------------------------------------------
  // Quote Expiring
  // --------------------------------------------------------------------------
  async notifyQuoteExpiring(
    userId: string,
    workspaceId: string,
    quote: { id: string; number: string; contactName: string; daysLeft: number }
  ) {
    const locale = await getUserLocale(userId);

    const title = getNotificationMessage(locale, 'quoteExpiring.title', {
      quoteNumber: quote.number,
    });
    const message = getNotificationMessage(locale, 'quoteExpiring.message', {
      quoteNumber: quote.number,
      clientName: quote.contactName,
      daysLeft: quote.daysLeft,
    });

    return this.create({
      userId,
      workspaceId,
      type: 'quote_expiring',
      title,
      message,
      data: { quoteId: quote.id },
    });
  },

  // --------------------------------------------------------------------------
  // Price Alert
  // --------------------------------------------------------------------------
  async notifyPriceAlert(
    userId: string,
    workspaceId: string,
    alert: {
      assetSymbol: string;
      assetName: string;
      currentPrice: number;
      targetPrice: number;
      direction: 'above' | 'below';
    },
    options?: { currency?: string }
  ) {
    const locale = await getUserLocale(userId);
    const currency = options?.currency ?? 'EUR';

    const title = getNotificationMessage(locale, 'priceAlert.title', {
      assetSymbol: alert.assetSymbol,
    });
    const messageKey = alert.direction === 'above' ? 'priceAlert.messageAbove' : 'priceAlert.messageBelow';
    const message = getNotificationMessage(locale, messageKey, {
      assetName: alert.assetName,
      targetPrice: alert.targetPrice.toFixed(2),
      currentPrice: alert.currentPrice.toFixed(2),
      currency,
    });

    return this.create({
      userId,
      workspaceId,
      type: 'price_alert',
      title,
      message,
      data: alert,
    });
  },

  // --------------------------------------------------------------------------
  // Bill Reminder
  // --------------------------------------------------------------------------
  async notifyBillReminder(
    userId: string,
    workspaceId: string,
    bill: { description: string; amount: number; dueDate: Date; daysUntil: number },
    options?: { currency?: string }
  ) {
    const locale = await getUserLocale(userId);
    const currency = options?.currency ?? 'EUR';

    const title = getNotificationMessage(locale, 'billReminder.title');
    const message = getNotificationMessage(locale, 'billReminder.message', {
      description: bill.description,
      amount: bill.amount.toFixed(2),
      currency,
      daysUntil: bill.daysUntil,
    });

    return this.create({
      userId,
      workspaceId,
      type: 'bill_reminder',
      title,
      message,
      data: bill,
    });
  },

  // --------------------------------------------------------------------------
  // System Notification
  // --------------------------------------------------------------------------
  notifySystem(userId: string, title: string, message: string, data?: Record<string, unknown>) {
    return this.create({
      userId,
      type: 'system',
      title,
      message,
      data,
    });
  },

  // ==========================================================================
  // Smart Notification Creators
  // ==========================================================================

  // --------------------------------------------------------------------------
  // Unusual Spending Alert
  // --------------------------------------------------------------------------
  async notifyUnusualSpending(
    userId: string,
    workspaceId: string,
    data: {
      transactionId: string;
      amount: number;
      categoryName?: string;
      percentAboveAverage: number;
      description: string;
    },
    options?: { currency?: string }
  ) {
    const locale = await getUserLocale(userId);
    const currency = options?.currency ?? 'EUR';

    const title = data.categoryName
      ? getNotificationMessage(locale, 'unusualSpending.title', { categoryName: data.categoryName })
      : getNotificationMessage(locale, 'unusualSpending.titleGeneric');
    const message = getNotificationMessage(locale, 'unusualSpending.message', {
      description: data.description,
      amount: data.amount.toFixed(2),
      currency,
      percentAboveAverage: data.percentAboveAverage,
    });

    return this.create({
      userId,
      workspaceId,
      type: 'unusual_spending',
      title,
      message,
      data,
    });
  },

  // --------------------------------------------------------------------------
  // Weekly Summary
  // --------------------------------------------------------------------------
  async notifyWeeklySummary(
    userId: string,
    workspaceId: string,
    summary: {
      totalSpent: number;
      totalIncome: number;
      netChange: number;
      comparedToAverage: number;
      topCategories: string[];
      insights: string[];
    },
    options?: { currency?: string }
  ) {
    const locale = await getUserLocale(userId);
    const currency = options?.currency ?? 'EUR';

    const titleKey = summary.netChange >= 0 ? 'weeklySummary.titlePositive' : 'weeklySummary.titleNegative';
    const title = getNotificationMessage(locale, titleKey, {
      netChange: summary.netChange >= 0 ? summary.netChange.toFixed(0) : summary.netChange.toFixed(0),
      currency,
    });

    return this.create({
      userId,
      workspaceId,
      type: 'weekly_summary',
      title,
      message: summary.insights.join(' '),
      data: summary,
    });
  },

  // --------------------------------------------------------------------------
  // Monthly Report
  // --------------------------------------------------------------------------
  async notifyMonthlyReport(
    userId: string,
    workspaceId: string,
    report: {
      month: string;
      totalSpent: number;
      totalIncome: number;
      netChange: number;
      comparedToLastMonth: number;
      topCategories: Array<{ name: string; amount: number }>;
      savingsRate: number;
      insights: string[];
    },
    options?: { currency?: string }
  ) {
    const locale = await getUserLocale(userId);
    const currency = options?.currency ?? 'EUR';

    const title = getNotificationMessage(locale, 'monthlyReport.title', {
      month: report.month,
    });
    const message = report.insights[0] ?? getNotificationMessage(locale, 'monthlyReport.message', {
      totalSpent: report.totalSpent.toFixed(0),
      totalIncome: report.totalIncome.toFixed(0),
      currency,
    });

    return this.create({
      userId,
      workspaceId,
      type: 'monthly_report',
      title,
      message,
      data: report,
    });
  },

  // --------------------------------------------------------------------------
  // Low Balance Warning
  // --------------------------------------------------------------------------
  async notifyLowBalance(
    userId: string,
    workspaceId: string,
    account: {
      id: string;
      name: string;
      balance: number;
      threshold: number;
    },
    options?: { currency?: string }
  ) {
    const locale = await getUserLocale(userId);
    const currency = options?.currency ?? 'EUR';

    const title = getNotificationMessage(locale, 'lowBalance.title', {
      accountName: account.name,
    });
    const message = getNotificationMessage(locale, 'lowBalance.message', {
      accountName: account.name,
      balance: account.balance.toFixed(2),
      threshold: account.threshold.toFixed(2),
      currency,
    });

    return this.create({
      userId,
      workspaceId,
      type: 'low_balance_warning',
      title,
      message,
      data: {
        accountId: account.id,
        accountName: account.name,
        balance: account.balance,
        threshold: account.threshold,
      },
    });
  },

  // --------------------------------------------------------------------------
  // Bill Upcoming
  // --------------------------------------------------------------------------
  async notifyBillUpcoming(
    userId: string,
    workspaceId: string,
    bill: {
      recurrenceId: string;
      description: string;
      amount: number;
      dueDate: Date;
      daysUntilDue: number;
    },
    options?: { currency?: string }
  ) {
    const locale = await getUserLocale(userId);
    const currency = options?.currency ?? 'EUR';

    let titleKey: string;
    if (bill.daysUntilDue === 0) {
      titleKey = 'billUpcoming.titleToday';
    } else if (bill.daysUntilDue === 1) {
      titleKey = 'billUpcoming.titleTomorrow';
    } else {
      titleKey = 'billUpcoming.titleDays';
    }

    const title = getNotificationMessage(locale, titleKey, {
      daysUntilDue: bill.daysUntilDue,
    });
    const message = getNotificationMessage(locale, 'billUpcoming.message', {
      description: bill.description,
      amount: bill.amount.toFixed(2),
      currency,
    });

    return this.create({
      userId,
      workspaceId,
      type: 'bill_upcoming',
      title,
      message,
      data: {
        recurrenceId: bill.recurrenceId,
        description: bill.description,
        amount: bill.amount,
        dueDate: bill.dueDate.toISOString(),
        daysUntilDue: bill.daysUntilDue,
      },
    });
  },
};

export default notificationService;
