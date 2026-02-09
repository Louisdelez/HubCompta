// ============================================================================
// AUDIT LOG SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { AuditSeverity } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface AuditLogEntry {
  userId?: string;
  workspaceId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  changes?: Record<string, unknown>;
  newValue?: Record<string, unknown> | null;
  oldValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  severity?: AuditSeverity;
}

export interface AuditQueryParams {
  userId?: string;
  workspaceId?: string;
  action?: string;
  entityType?: string;
  severity?: AuditSeverity;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

// ----------------------------------------------------------------------------
// Audit Actions
// ----------------------------------------------------------------------------

export const AUDIT_ACTIONS = {
  // Auth events
  AUTH_LOGIN_SUCCESS: 'auth.login.succeeded',
  AUTH_LOGIN_FAILED: 'auth.login.failed',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_MFA_SETUP: 'auth.mfa.setup',
  AUTH_MFA_REMOVED: 'auth.mfa.removed',
  AUTH_SESSION_LOCKED: 'auth.session.locked',
  AUTH_SESSION_UNLOCKED: 'auth.session.unlocked',
  AUTH_DEVICE_REVOKED: 'auth.device.revoked',
  AUTH_PASSWORD_CHANGED: 'auth.password.changed',

  // User events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',

  // Workspace events
  WORKSPACE_CREATED: 'workspace.created',
  WORKSPACE_UPDATED: 'workspace.updated',
  WORKSPACE_DELETED: 'workspace.deleted',
  WORKSPACE_MEMBER_INVITED: 'workspace.member.invited',
  WORKSPACE_MEMBER_JOINED: 'workspace.member.joined',
  WORKSPACE_MEMBER_ROLE_CHANGED: 'workspace.member.role.changed',
  WORKSPACE_MEMBER_REMOVED: 'workspace.member.removed',

  // Account events
  ACCOUNT_CREATED: 'account.created',
  ACCOUNT_UPDATED: 'account.updated',
  ACCOUNT_ARCHIVED: 'account.archived',
  ACCOUNT_DELETED: 'account.deleted',

  // Transaction events
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_UPDATED: 'transaction.updated',
  TRANSACTION_DELETED: 'transaction.deleted',
  TRANSACTION_BULK_DELETED: 'transaction.bulk_deleted',
  TRANSFER_CREATED: 'transfer.created',

  // Category events
  CATEGORY_CREATED: 'category.created',
  CATEGORY_UPDATED: 'category.updated',
  CATEGORY_DELETED: 'category.deleted',
  CATEGORY_MERGED: 'category.merged',

  // Tag events
  TAG_CREATED: 'tag.created',
  TAG_UPDATED: 'tag.updated',
  TAG_DELETED: 'tag.deleted',
  TAG_MERGED: 'tag.merged',

  // Import events
  IMPORT_STARTED: 'import.started',
  IMPORT_COMPLETED: 'import.completed',
  IMPORT_FAILED: 'import.failed',

  // Export events
  EXPORT_REQUESTED: 'export.requested',
  EXPORT_COMPLETED: 'export.completed',

  // Security events
  SECURITY_STEP_UP: 'security.sensitive_action',
  SECURITY_SUSPICIOUS: 'security.suspicious_activity',

  // Budget events
  BUDGET_CREATED: 'budget.created',
  BUDGET_UPDATED: 'budget.updated',
  BUDGET_DELETED: 'budget.deleted',

  // Document events
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_LINKED: 'document.linked',
  DOCUMENT_UNLINKED: 'document.unlinked',
  DOCUMENT_ARCHIVED: 'document.archived',
  DOCUMENT_DELETED: 'document.deleted',

  // Pro Mode - Contact events
  CONTACT_CREATED: 'pro.contact.created',
  CONTACT_UPDATED: 'pro.contact.updated',
  CONTACT_DELETED: 'pro.contact.deleted',

  // Pro Mode - Quote events
  QUOTE_CREATED: 'pro.quote.created',
  QUOTE_UPDATED: 'pro.quote.updated',
  QUOTE_SENT: 'pro.quote.sent',
  QUOTE_ACCEPTED: 'pro.quote.accepted',
  QUOTE_REJECTED: 'pro.quote.rejected',
  QUOTE_DELETED: 'pro.quote.deleted',

  // Pro Mode - Invoice events
  INVOICE_CREATED: 'pro.invoice.created',
  INVOICE_UPDATED: 'pro.invoice.updated',
  INVOICE_SENT: 'pro.invoice.sent',
  INVOICE_PAYMENT_RECORDED: 'pro.invoice.payment_recorded',
  INVOICE_CANCELLED: 'pro.invoice.cancelled',
  INVOICE_DELETED: 'pro.invoice.deleted',

  // Investment events
  POSITION_OPENED: 'invest.position.opened',
  POSITION_TRANSACTION: 'invest.position.transaction',
  POSITION_DELETED: 'invest.position.deleted',
  WATCHLIST_CREATED: 'invest.watchlist.created',
  WATCHLIST_UPDATED: 'invest.watchlist.updated',
  WATCHLIST_DELETED: 'invest.watchlist.deleted',

  // Notification events
  ALERT_CREATED: 'notification.alert.created',
  ALERT_UPDATED: 'notification.alert.updated',
  ALERT_DELETED: 'notification.alert.deleted',
  ALERT_TRIGGERED: 'notification.alert.triggered',

  // Loan events
  LOAN_CREATED: 'loan.created',
  LOAN_UPDATED: 'loan.updated',
  LOAN_DELETED: 'loan.deleted',
  LOAN_PAYMENT_ADDED: 'loan.payment.added',
  LOAN_PAYMENT_DELETED: 'loan.payment.deleted',
} as const;

// ----------------------------------------------------------------------------
// Audit Service
// ----------------------------------------------------------------------------

export const auditService = {
  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        workspaceId: entry.workspaceId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        changes: entry.changes as object | undefined,
        ipAddress: entry.ipAddress ?? undefined,
        userAgent: entry.userAgent ?? undefined,
        severity: entry.severity ?? 'info',
      },
    });
  },

  /**
   * Log authentication success
   */
  async logLoginSuccess(
    userId: string,
    deviceId: string,
    deviceName: string,
    isNewDevice: boolean,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
      changes: { deviceId, deviceName, isNewDevice },
      ipAddress,
      userAgent,
      severity: 'info',
    });
  },

  /**
   * Log authentication failure
   */
  async logLoginFailed(
    email: string,
    reason: 'invalid_credentials' | 'mfa_failed' | 'account_locked',
    attemptCount: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
      changes: { email, reason, attemptCount },
      ipAddress,
      userAgent,
      severity: reason === 'account_locked' ? 'warning' : 'info',
    });
  },

  /**
   * Log logout
   */
  async logLogout(
    userId: string,
    sessionId: string,
    reason: 'manual' | 'expired' | 'revoked',
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AUDIT_ACTIONS.AUTH_LOGOUT,
      changes: { sessionId, reason },
      ipAddress,
      severity: 'info',
    });
  },

  /**
   * Log MFA setup
   */
  async logMfaSetup(
    userId: string,
    mfaId: string,
    type: string,
    name: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AUDIT_ACTIONS.AUTH_MFA_SETUP,
      entityType: 'mfa',
      entityId: mfaId,
      changes: { type, name },
      ipAddress,
      severity: 'info',
    });
  },

  /**
   * Log MFA removal
   */
  async logMfaRemoved(
    userId: string,
    mfaId: string,
    type: string,
    name: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AUDIT_ACTIONS.AUTH_MFA_REMOVED,
      entityType: 'mfa',
      entityId: mfaId,
      changes: { type, name },
      ipAddress,
      severity: 'warning',
    });
  },

  /**
   * Log session lock
   */
  async logSessionLocked(
    userId: string,
    sessionId: string,
    reason: 'inactivity' | 'manual',
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AUDIT_ACTIONS.AUTH_SESSION_LOCKED,
      changes: { sessionId, reason },
      ipAddress,
      severity: 'info',
    });
  },

  /**
   * Log session unlock
   */
  async logSessionUnlocked(
    userId: string,
    sessionId: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AUDIT_ACTIONS.AUTH_SESSION_UNLOCKED,
      changes: { sessionId },
      ipAddress,
      severity: 'info',
    });
  },

  /**
   * Log device revocation
   */
  async logDeviceRevoked(
    userId: string,
    deviceId: string,
    deviceName: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AUDIT_ACTIONS.AUTH_DEVICE_REVOKED,
      entityType: 'device',
      entityId: deviceId,
      changes: { deviceName },
      ipAddress,
      severity: 'warning',
    });
  },

  /**
   * Log sensitive action (step-up auth)
   */
  async logSensitiveAction(
    userId: string,
    action: string,
    verified: boolean,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AUDIT_ACTIONS.SECURITY_STEP_UP,
      changes: { sensitiveAction: action, verified },
      ipAddress,
      severity: 'critical',
    });
  },

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(
    userId: string | undefined,
    reason: string,
    details: Record<string, unknown>,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AUDIT_ACTIONS.SECURITY_SUSPICIOUS,
      changes: { reason, ...details },
      ipAddress,
      severity: 'critical',
    });
  },

  /**
   * Query audit logs
   */
  async query(params: AuditQueryParams) {
    const {
      userId,
      workspaceId,
      action,
      entityType,
      severity,
      from,
      to,
      page = 1,
      pageSize = 50,
    } = params;

    const where = {
      ...(userId && { userId }),
      ...(workspaceId && { workspaceId }),
      ...(action && { action: { contains: action } }),
      ...(entityType && { entityType }),
      ...(severity && { severity }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { email: true, displayName: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Get security events for a user
   */
  getSecurityEvents(userId: string, limit = 20) {
    return prisma.auditLog.findMany({
      where: {
        userId,
        action: { startsWith: 'auth.' },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  /**
   * Get formatted activity feed for a workspace
   */
  async getActivityFeed(
    workspaceId: string,
    options: {
      page?: number;
      pageSize?: number;
      types?: string[];
      userId?: string;
      from?: Date;
      to?: Date;
    } = {}
  ) {
    const { page = 1, pageSize = 50, types, userId, from, to } = options;

    // Build where clause
    const where = {
      workspaceId,
      ...(userId && { userId }),
      ...(types?.length && { action: { in: types } }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Format activities for frontend consumption
    const activities = logs.map((log) => ({
      id: log.id,
      action: log.action,
      actionType: this.getActionType(log.action),
      actionLabel: this.getActionLabel(log.action),
      entityType: log.entityType,
      entityId: log.entityId,
      changes: log.changes as Record<string, unknown> | null,
      user: log.user
        ? {
            id: log.user.id,
            name: log.user.displayName ?? log.user.email,
            email: log.user.email,
          }
        : null,
      createdAt: log.createdAt.toISOString(),
      severity: log.severity,
    }));

    return {
      data: activities,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Get user's activity across all their workspaces
   */
  async getUserActivity(
    userId: string,
    options: {
      page?: number;
      pageSize?: number;
      workspaceIds?: string[];
      from?: Date;
      to?: Date;
    } = {}
  ) {
    const { page = 1, pageSize = 50, workspaceIds, from, to } = options;

    const where = {
      userId,
      ...(workspaceIds?.length && { workspaceId: { in: workspaceIds } }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Format activities
    const activities = logs.map((log) => ({
      id: log.id,
      action: log.action,
      actionType: this.getActionType(log.action),
      actionLabel: this.getActionLabel(log.action),
      entityType: log.entityType,
      entityId: log.entityId,
      changes: log.changes as Record<string, unknown> | null,
      user: log.user
        ? {
            id: log.user.id,
            name: log.user.displayName ?? log.user.email,
            email: log.user.email,
          }
        : null,
      workspace: log.workspace
        ? {
            id: log.workspace.id,
            name: log.workspace.name,
          }
        : null,
      createdAt: log.createdAt.toISOString(),
      severity: log.severity,
    }));

    return {
      data: activities,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Get the action type category from action string
   */
  getActionType(action: string): string {
    const prefix = action.split('.')[0];
    return prefix ?? 'other';
  },

  /**
   * Get human-readable label for an action
   */
  getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      // Transaction actions
      'transaction.created': 'Created a transaction',
      'transaction.updated': 'Updated a transaction',
      'transaction.deleted': 'Deleted a transaction',
      'transaction.bulk_deleted': 'Deleted multiple transactions',
      'transfer.created': 'Created a transfer',

      // Account actions
      'account.created': 'Created an account',
      'account.updated': 'Updated an account',
      'account.archived': 'Archived an account',
      'account.deleted': 'Deleted an account',

      // Category actions
      'category.created': 'Created a category',
      'category.updated': 'Updated a category',
      'category.deleted': 'Deleted a category',
      'category.merged': 'Merged categories',

      // Budget actions
      'budget.created': 'Created a budget',
      'budget.updated': 'Updated a budget',
      'budget.deleted': 'Deleted a budget',

      // Document actions
      'document.uploaded': 'Uploaded a document',
      'document.linked': 'Linked a document',
      'document.unlinked': 'Unlinked a document',
      'document.archived': 'Archived a document',
      'document.deleted': 'Deleted a document',

      // Workspace actions
      'workspace.created': 'Created the workspace',
      'workspace.updated': 'Updated workspace settings',
      'workspace.deleted': 'Deleted the workspace',
      'workspace.member.invited': 'Invited a member',
      'workspace.member.joined': 'Joined the workspace',
      'workspace.member.role.changed': 'Changed member role',
      'workspace.member.removed': 'Removed a member',

      // Import/Export actions
      'import.started': 'Started an import',
      'import.completed': 'Completed an import',
      'import.failed': 'Import failed',
      'export.requested': 'Requested an export',
      'export.completed': 'Export completed',

      // Tag actions
      'tag.created': 'Created a tag',
      'tag.updated': 'Updated a tag',
      'tag.deleted': 'Deleted a tag',
      'tag.merged': 'Merged tags',

      // Pro Mode actions
      'pro.contact.created': 'Created a contact',
      'pro.contact.updated': 'Updated a contact',
      'pro.contact.deleted': 'Deleted a contact',
      'pro.quote.created': 'Created a quote',
      'pro.quote.updated': 'Updated a quote',
      'pro.quote.sent': 'Sent a quote',
      'pro.quote.accepted': 'Quote accepted',
      'pro.quote.rejected': 'Quote rejected',
      'pro.invoice.created': 'Created an invoice',
      'pro.invoice.updated': 'Updated an invoice',
      'pro.invoice.sent': 'Sent an invoice',
      'pro.invoice.payment_recorded': 'Recorded invoice payment',
      'pro.invoice.cancelled': 'Cancelled an invoice',

      // Investment actions
      'invest.position.opened': 'Opened a position',
      'invest.position.transaction': 'Made investment transaction',
      'invest.position.deleted': 'Closed a position',
      'invest.watchlist.created': 'Created a watchlist',
      'invest.watchlist.updated': 'Updated a watchlist',
      'invest.watchlist.deleted': 'Deleted a watchlist',

      // Loan actions
      'loan.created': 'Created a loan',
      'loan.updated': 'Updated a loan',
      'loan.deleted': 'Deleted a loan',
      'loan.payment.added': 'Added loan payment',
      'loan.payment.deleted': 'Deleted loan payment',

      // Alert actions
      'notification.alert.created': 'Created an alert',
      'notification.alert.updated': 'Updated an alert',
      'notification.alert.deleted': 'Deleted an alert',
      'notification.alert.triggered': 'Alert triggered',

      // Auth actions
      'auth.login.succeeded': 'Logged in',
      'auth.logout': 'Logged out',
      'auth.mfa.setup': 'Set up MFA',
      'auth.mfa.removed': 'Removed MFA',
      'auth.password.changed': 'Changed password',
    };

    return labels[action] ?? action.replace(/\./g, ' ').replace(/_/g, ' ');
  },
};

export default auditService;
