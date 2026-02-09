// ============================================================================
// NOTIFICATION SERVICE - Finance Hub
// In-app notifications management
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { Prisma, type NotificationType } from '@prisma/client';

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
  create(input: CreateNotificationInput) {
    return prisma.notification.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: (input.data ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
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
  // Budget Alert
  // --------------------------------------------------------------------------
  notifyBudgetAlert(
    userId: string,
    workspaceId: string,
    budget: { id: string; name: string; categoryName: string },
    percentUsed: number,
    isExceeded: boolean
  ) {
    const type = isExceeded ? 'budget_alert' : 'budget_warning';
    const title = isExceeded
      ? `Budget "${budget.name}" dépassé`
      : `Budget "${budget.name}" bientôt atteint`;
    const message = isExceeded
      ? `Le budget pour "${budget.categoryName}" a été dépassé (${percentUsed.toFixed(0)}% utilisé).`
      : `Le budget pour "${budget.categoryName}" est à ${percentUsed.toFixed(0)}% de sa limite.`;

    return this.create({
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
  },

  // --------------------------------------------------------------------------
  // Import Complete
  // --------------------------------------------------------------------------
  notifyImportComplete(
    userId: string,
    workspaceId: string,
    result: { imported: number; skipped: number; errors: number }
  ) {
    const hasErrors = result.errors > 0;
    const title = hasErrors ? 'Import terminé avec des erreurs' : 'Import terminé';
    const message = `${result.imported} transaction(s) importée(s)${result.skipped > 0 ? `, ${result.skipped} ignorée(s)` : ''}${hasErrors ? `, ${result.errors} erreur(s)` : ''}.`;

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
  // Export Ready
  // --------------------------------------------------------------------------
  notifyExportReady(
    userId: string,
    workspaceId: string,
    exportInfo: { type: string; filename: string; downloadUrl?: string }
  ) {
    return this.create({
      userId,
      workspaceId,
      type: 'export_ready',
      title: 'Export prêt',
      message: `Votre export ${exportInfo.type} est prêt à être téléchargé.`,
      data: exportInfo,
    });
  },

  // --------------------------------------------------------------------------
  // Invoice Overdue
  // --------------------------------------------------------------------------
  notifyInvoiceOverdue(
    userId: string,
    workspaceId: string,
    invoice: { id: string; number: string; contactName: string; amount: number }
  ) {
    return this.create({
      userId,
      workspaceId,
      type: 'invoice_overdue',
      title: `Facture ${invoice.number} en retard`,
      message: `La facture ${invoice.number} pour ${invoice.contactName} (${invoice.amount.toFixed(2)} €) est en retard de paiement.`,
      data: { invoiceId: invoice.id },
    });
  },

  // --------------------------------------------------------------------------
  // Invoice Paid
  // --------------------------------------------------------------------------
  notifyInvoicePaid(
    userId: string,
    workspaceId: string,
    invoice: { id: string; number: string; contactName: string; amount: number }
  ) {
    return this.create({
      userId,
      workspaceId,
      type: 'invoice_paid',
      title: `Facture ${invoice.number} payée`,
      message: `La facture ${invoice.number} pour ${invoice.contactName} (${invoice.amount.toFixed(2)} €) a été marquée comme payée.`,
      data: { invoiceId: invoice.id },
    });
  },

  // --------------------------------------------------------------------------
  // Quote Accepted
  // --------------------------------------------------------------------------
  notifyQuoteAccepted(
    userId: string,
    workspaceId: string,
    quote: { id: string; number: string; contactName: string; amount: number }
  ) {
    return this.create({
      userId,
      workspaceId,
      type: 'quote_accepted',
      title: `Devis ${quote.number} accepté`,
      message: `Le devis ${quote.number} pour ${quote.contactName} (${quote.amount.toFixed(2)} €) a été accepté.`,
      data: { quoteId: quote.id },
    });
  },

  // --------------------------------------------------------------------------
  // Quote Expiring
  // --------------------------------------------------------------------------
  notifyQuoteExpiring(
    userId: string,
    workspaceId: string,
    quote: { id: string; number: string; contactName: string; daysLeft: number }
  ) {
    return this.create({
      userId,
      workspaceId,
      type: 'quote_expiring',
      title: `Devis ${quote.number} expire bientôt`,
      message: `Le devis ${quote.number} pour ${quote.contactName} expire dans ${quote.daysLeft} jour(s).`,
      data: { quoteId: quote.id },
    });
  },

  // --------------------------------------------------------------------------
  // Price Alert
  // --------------------------------------------------------------------------
  notifyPriceAlert(
    userId: string,
    workspaceId: string,
    alert: {
      assetSymbol: string;
      assetName: string;
      currentPrice: number;
      targetPrice: number;
      direction: 'above' | 'below';
    }
  ) {
    const direction = alert.direction === 'above' ? 'au-dessus de' : 'en-dessous de';
    return this.create({
      userId,
      workspaceId,
      type: 'price_alert',
      title: `Alerte prix: ${alert.assetSymbol}`,
      message: `${alert.assetName} est passé ${direction} ${alert.targetPrice.toFixed(2)} € (actuellement ${alert.currentPrice.toFixed(2)} €).`,
      data: alert,
    });
  },

  // --------------------------------------------------------------------------
  // Bill Reminder
  // --------------------------------------------------------------------------
  notifyBillReminder(
    userId: string,
    workspaceId: string,
    bill: { description: string; amount: number; dueDate: Date; daysUntil: number }
  ) {
    return this.create({
      userId,
      workspaceId,
      type: 'bill_reminder',
      title: 'Rappel de paiement',
      message: `"${bill.description}" (${bill.amount.toFixed(2)} €) est dû dans ${bill.daysUntil} jour(s).`,
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
};

export default notificationService;
