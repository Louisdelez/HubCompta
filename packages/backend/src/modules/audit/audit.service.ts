// ============================================================================
// AUDIT LOG SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { AuditSeverity, AuditStatus, AuditLog } from '@prisma/client';
import type { FastifyRequest } from 'fastify';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface AuditLogEntry {
  userId?: string;
  workspaceId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  resource?: string;
  resourceId?: string;
  changes?: Record<string, unknown>;
  details?: Record<string, unknown>;
  newValue?: Record<string, unknown> | null;
  oldValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  severity?: AuditSeverity;
  status?: AuditStatus;
}

export interface AuditLogParams {
  userId: string;
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  details?: object;
  status: 'SUCCESS' | 'FAILURE';
  request?: FastifyRequest;
}

export interface AuditFilters {
  action?: string;
  resource?: string;
  status?: AuditStatus;
  severity?: AuditSeverity;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export interface AuditQueryParams {
  userId?: string;
  workspaceId?: string;
  action?: string;
  entityType?: string;
  resource?: string;
  severity?: AuditSeverity;
  status?: AuditStatus;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

// Type for audit action values
export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

// ----------------------------------------------------------------------------
// Audit Actions
// ----------------------------------------------------------------------------

export const AUDIT_ACTIONS = {
  // Auth events
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGIN_SUCCESS: 'auth.login.succeeded',
  AUTH_LOGIN_FAILED: 'auth.login.failed',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_FAILED: 'auth.failed',
  AUTH_MFA_SETUP: 'auth.mfa.setup',
  AUTH_MFA_REMOVED: 'auth.mfa.removed',
  AUTH_SESSION_LOCKED: 'auth.session.locked',
  AUTH_SESSION_UNLOCKED: 'auth.session.unlocked',
  AUTH_DEVICE_REVOKED: 'auth.device.revoked',
  AUTH_PASSWORD_CHANGED: 'auth.password.changed',

  // Password events
  PASSWORD_CHANGE: 'password.change',
  PASSWORD_RESET: 'password.reset',

  // Two-factor events
  TWO_FACTOR_ENABLE: 'two_factor.enable',
  TWO_FACTOR_DISABLE: 'two_factor.disable',

  // Data events
  DATA_EXPORT: 'data.export',
  DATA_IMPORT: 'data.import',

  // Session events
  SESSION_REVOKE: 'session.revoke',

  // Settings events
  SETTINGS_CHANGE: 'settings.change',

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
  ACCOUNT_CREATE: 'account.create',
  ACCOUNT_DELETE: 'account.delete',

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
   * Log an audit event (extended version with request support)
   */
  async log(entry: AuditLogEntry): Promise<AuditLog> {
    return prisma.auditLog.create({
      data: {
        userId: entry.userId,
        workspaceId: entry.workspaceId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        resource: entry.resource ?? entry.entityType,
        resourceId: entry.resourceId ?? entry.entityId,
        changes: entry.changes as object | undefined,
        details: entry.details as object | undefined,
        ipAddress: entry.ipAddress ?? undefined,
        userAgent: entry.userAgent ?? undefined,
        severity: entry.severity ?? 'info',
        status: entry.status ?? 'success',
      },
    });
  },

  /**
   * Log an audit event with request context
   */
  async logWithRequest(params: AuditLogParams): Promise<AuditLog> {
    const { userId, action, resource, resourceId, details, status, request } = params;

    return this.log({
      userId,
      action,
      resource,
      resourceId,
      details: details as Record<string, unknown>,
      status: status === 'SUCCESS' ? 'success' : 'failure',
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'],
    });
  },

  /**
   * Get audit logs for a specific user
   */
  async getLogsForUser(userId: string, filters?: AuditFilters): Promise<AuditLog[]> {
    const {
      action,
      resource,
      status,
      severity,
      from,
      to,
      page = 1,
      pageSize = 50,
    } = filters ?? {};

    const where = {
      userId,
      ...(action && { action: { contains: action } }),
      ...(resource && { resource }),
      ...(status && { status }),
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

    return prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  },

  /**
   * Get recent activity for a user
   */
  async getRecentActivity(userId: string, limit = 20): Promise<AuditLog[]> {
    return prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
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
      details: { deviceId, deviceName, isNewDevice },
      ipAddress,
      userAgent,
      severity: 'info',
      status: 'success',
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
      details: { email, reason, attemptCount },
      ipAddress,
      userAgent,
      severity: reason === 'account_locked' ? 'warning' : 'info',
      status: 'failure',
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
      details: { sessionId, reason },
      ipAddress,
      severity: 'info',
      status: 'success',
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
      resource: 'mfa',
      resourceId: mfaId,
      details: { type, name },
      ipAddress,
      severity: 'info',
      status: 'success',
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
      resource: 'mfa',
      resourceId: mfaId,
      details: { type, name },
      ipAddress,
      severity: 'warning',
      status: 'success',
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
      details: { sessionId, reason },
      ipAddress,
      severity: 'info',
      status: 'success',
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
      details: { sessionId },
      ipAddress,
      severity: 'info',
      status: 'success',
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
      resource: 'device',
      resourceId: deviceId,
      details: { deviceName },
      ipAddress,
      severity: 'warning',
      status: 'success',
    });
  },

  /**
   * Log password change
   */
  async logPasswordChanged(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AUDIT_ACTIONS.PASSWORD_CHANGE,
      resource: 'user',
      resourceId: userId,
      ipAddress,
      userAgent,
      severity: 'warning',
      status: 'success',
    });
  },

  /**
   * Log 2FA enable
   */
  async logTwoFactorEnabled(
    userId: string,
    method: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AUDIT_ACTIONS.TWO_FACTOR_ENABLE,
      resource: 'mfa',
      details: { method },
      ipAddress,
      severity: 'info',
      status: 'success',
    });
  },

  /**
   * Log 2FA disable
   */
  async logTwoFactorDisabled(
    userId: string,
    method: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AUDIT_ACTIONS.TWO_FACTOR_DISABLE,
      resource: 'mfa',
      details: { method },
      ipAddress,
      severity: 'warning',
      status: 'success',
    });
  },

  /**
   * Log data export
   */
  async logDataExport(
    userId: string,
    exportType: string,
    format: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AUDIT_ACTIONS.DATA_EXPORT,
      resource: 'export',
      details: { exportType, format },
      ipAddress,
      severity: 'warning',
      status: 'success',
    });
  },

  /**
   * Log data import
   */
  async logDataImport(
    userId: string,
    workspaceId: string,
    importType: string,
    rowCount: number,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId,
      workspaceId,
      action: AUDIT_ACTIONS.DATA_IMPORT,
      resource: 'import',
      details: { importType, rowCount },
      ipAddress,
      severity: 'info',
      status: 'success',
    });
  },

  /**
   * Log session revoke
   */
  async logSessionRevoked(
    userId: string,
    targetSessionId: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AUDIT_ACTIONS.SESSION_REVOKE,
      resource: 'session',
      resourceId: targetSessionId,
      ipAddress,
      severity: 'warning',
      status: 'success',
    });
  },

  /**
   * Log settings change
   */
  async logSettingsChanged(
    userId: string,
    settingType: string,
    changes: Record<string, unknown>,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AUDIT_ACTIONS.SETTINGS_CHANGE,
      resource: 'settings',
      details: { settingType, ...changes },
      ipAddress,
      severity: 'info',
      status: 'success',
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
      details: { sensitiveAction: action, verified },
      ipAddress,
      severity: 'critical',
      status: verified ? 'success' : 'failure',
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
      details: { reason, ...details },
      ipAddress,
      severity: 'critical',
      status: 'failure',
    });
  },

  /**
   * Query audit logs with pagination
   */
  async query(params: AuditQueryParams) {
    const {
      userId,
      workspaceId,
      action,
      entityType,
      resource,
      severity,
      status,
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
      ...(resource && { resource }),
      ...(severity && { severity }),
      ...(status && { status }),
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
      resource: log.resource,
      resourceId: log.resourceId,
      changes: log.changes as Record<string, unknown> | null,
      details: log.details as Record<string, unknown> | null,
      status: log.status,
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
      resource: log.resource,
      resourceId: log.resourceId,
      changes: log.changes as Record<string, unknown> | null,
      details: log.details as Record<string, unknown> | null,
      status: log.status,
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
   * Export audit logs to CSV format
   */
  async exportToCsv(
    userId: string,
    filters?: AuditFilters
  ): Promise<string> {
    const logs = await this.getLogsForUser(userId, { ...filters, pageSize: 10000 });

    const headers = ['Date', 'Action', 'Resource', 'Resource ID', 'Status', 'IP Address', 'User Agent', 'Details'];
    const rows = logs.map((log) => [
      log.createdAt.toISOString(),
      log.action,
      log.resource ?? log.entityType ?? '',
      log.resourceId ?? log.entityId ?? '',
      log.status,
      log.ipAddress ?? '',
      log.userAgent ?? '',
      JSON.stringify(log.details ?? log.changes ?? {}),
    ]);

    const escapeCSV = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    return [
      headers.join(','),
      ...rows.map((r) => r.map(escapeCSV).join(',')),
    ].join('\n');
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
      // Auth actions
      'auth.login': 'Connexion',
      'auth.login.succeeded': 'Connexion reussie',
      'auth.login.failed': 'Tentative de connexion echouee',
      'auth.logout': 'Deconnexion',
      'auth.failed': 'Authentification echouee',
      'auth.mfa.setup': 'MFA configure',
      'auth.mfa.removed': 'MFA supprime',
      'auth.session.locked': 'Session verrouillee',
      'auth.session.unlocked': 'Session deverrouillee',
      'auth.device.revoked': 'Appareil revoque',
      'auth.password.changed': 'Mot de passe modifie',

      // Password actions
      'password.change': 'Changement de mot de passe',
      'password.reset': 'Reinitialisation du mot de passe',

      // Two-factor actions
      'two_factor.enable': 'Activation 2FA',
      'two_factor.disable': 'Desactivation 2FA',

      // Data actions
      'data.export': 'Export de donnees',
      'data.import': 'Import de donnees',

      // Session actions
      'session.revoke': 'Session revoquee',

      // Settings actions
      'settings.change': 'Modification des parametres',

      // Transaction actions
      'transaction.created': 'Transaction creee',
      'transaction.updated': 'Transaction modifiee',
      'transaction.deleted': 'Transaction supprimee',
      'transaction.bulk_deleted': 'Transactions supprimees',
      'transfer.created': 'Transfert cree',

      // Account actions
      'account.created': 'Compte cree',
      'account.updated': 'Compte modifie',
      'account.archived': 'Compte archive',
      'account.deleted': 'Compte supprime',
      'account.create': 'Creation de compte',
      'account.delete': 'Suppression de compte',

      // Category actions
      'category.created': 'Categorie creee',
      'category.updated': 'Categorie modifiee',
      'category.deleted': 'Categorie supprimee',
      'category.merged': 'Categories fusionnees',

      // Budget actions
      'budget.created': 'Budget cree',
      'budget.updated': 'Budget modifie',
      'budget.deleted': 'Budget supprime',

      // Document actions
      'document.uploaded': 'Document televerse',
      'document.linked': 'Document lie',
      'document.unlinked': 'Document delie',
      'document.archived': 'Document archive',
      'document.deleted': 'Document supprime',

      // Workspace actions
      'workspace.created': 'Workspace cree',
      'workspace.updated': 'Workspace modifie',
      'workspace.deleted': 'Workspace supprime',
      'workspace.member.invited': 'Membre invite',
      'workspace.member.joined': 'Membre a rejoint',
      'workspace.member.role.changed': 'Role du membre modifie',
      'workspace.member.removed': 'Membre supprime',

      // Import/Export actions
      'import.started': 'Import demarre',
      'import.completed': 'Import termine',
      'import.failed': 'Import echoue',
      'export.requested': 'Export demande',
      'export.completed': 'Export termine',

      // Tag actions
      'tag.created': 'Tag cree',
      'tag.updated': 'Tag modifie',
      'tag.deleted': 'Tag supprime',
      'tag.merged': 'Tags fusionnes',

      // Security actions
      'security.sensitive_action': 'Action sensible',
      'security.suspicious_activity': 'Activite suspecte',

      // Pro Mode actions
      'pro.contact.created': 'Contact cree',
      'pro.contact.updated': 'Contact modifie',
      'pro.contact.deleted': 'Contact supprime',
      'pro.quote.created': 'Devis cree',
      'pro.quote.updated': 'Devis modifie',
      'pro.quote.sent': 'Devis envoye',
      'pro.quote.accepted': 'Devis accepte',
      'pro.quote.rejected': 'Devis refuse',
      'pro.invoice.created': 'Facture creee',
      'pro.invoice.updated': 'Facture modifiee',
      'pro.invoice.sent': 'Facture envoyee',
      'pro.invoice.payment_recorded': 'Paiement enregistre',
      'pro.invoice.cancelled': 'Facture annulee',

      // Investment actions
      'invest.position.opened': 'Position ouverte',
      'invest.position.transaction': 'Transaction investissement',
      'invest.position.deleted': 'Position fermee',
      'invest.watchlist.created': 'Liste de suivi creee',
      'invest.watchlist.updated': 'Liste de suivi modifiee',
      'invest.watchlist.deleted': 'Liste de suivi supprimee',

      // Loan actions
      'loan.created': 'Pret cree',
      'loan.updated': 'Pret modifie',
      'loan.deleted': 'Pret supprime',
      'loan.payment.added': 'Paiement de pret ajoute',
      'loan.payment.deleted': 'Paiement de pret supprime',

      // Alert actions
      'notification.alert.created': 'Alerte creee',
      'notification.alert.updated': 'Alerte modifiee',
      'notification.alert.deleted': 'Alerte supprimee',
      'notification.alert.triggered': 'Alerte declenchee',
    };

    return labels[action] ?? action.replace(/\./g, ' ').replace(/_/g, ' ');
  },
};

export default auditService;
