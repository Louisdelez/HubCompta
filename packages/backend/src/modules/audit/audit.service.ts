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
  ipAddress?: string;
  userAgent?: string;
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
        changes: entry.changes ?? null,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
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
  async getSecurityEvents(userId: string, limit = 20) {
    return prisma.auditLog.findMany({
      where: {
        userId,
        action: { startsWith: 'auth.' },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};

export default auditService;
