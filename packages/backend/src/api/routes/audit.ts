// ============================================================================
// AUDIT ROUTES - Finance Hub
// User audit log endpoints
// ============================================================================

import type { FastifyPluginAsync } from 'fastify';
import { auditService } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import type { AuditStatus, AuditSeverity } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface AuditLogQueryParams {
  action?: string;
  resource?: string;
  status?: AuditStatus;
  severity?: AuditSeverity;
  from?: string;
  to?: string;
  page?: string;
  pageSize?: string;
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

const auditRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply auth guard to all routes
  fastify.addHook('preHandler', authGuard);

  // ==========================================================================
  // GET /users/me/audit-logs - Get current user's audit logs with pagination
  // ==========================================================================
  fastify.get<{ Querystring: AuditLogQueryParams }>(
    '/users/me/audit-logs',
    async (request, reply) => {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Non authentifie' },
        });
      }

      const { action, resource, status, severity, from, to, page, pageSize } = request.query;

      const result = await auditService.query({
        userId,
        action,
        resource,
        status: status,
        severity: severity,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        page: page ? parseInt(page, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize, 10) : 50,
      });

      // Format the response for frontend
      const formattedLogs = result.data.map((log) => ({
        id: log.id,
        action: log.action,
        actionLabel: auditService.getActionLabel(log.action),
        actionType: auditService.getActionType(log.action),
        resource: log.resource ?? log.entityType,
        resourceId: log.resourceId ?? log.entityId,
        status: log.status,
        severity: log.severity,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        details: log.details ?? log.changes,
        createdAt: log.createdAt.toISOString(),
      }));

      return {
        success: true,
        data: formattedLogs,
        meta: result.meta,
      };
    }
  );

  // ==========================================================================
  // GET /users/me/audit-logs/export - Export audit logs as CSV
  // ==========================================================================
  fastify.get<{ Querystring: AuditLogQueryParams }>(
    '/users/me/audit-logs/export',
    async (request, reply) => {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Non authentifie' },
        });
      }

      const { action, resource, status, severity, from, to } = request.query;

      const csvData = await auditService.exportToCsv(userId, {
        action,
        resource,
        status: status,
        severity: severity,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      });

      // Log the export action
      await auditService.logDataExport(
        userId,
        'audit_logs',
        'csv',
        request.ip
      );

      reply.header('Content-Type', 'text/csv');
      reply.header(
        'Content-Disposition',
        `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`
      );

      return csvData;
    }
  );

  // ==========================================================================
  // GET /users/me/audit-logs/recent - Get recent activity (simplified)
  // ==========================================================================
  fastify.get<{ Querystring: { limit?: string } }>(
    '/users/me/audit-logs/recent',
    async (request, reply) => {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Non authentifie' },
        });
      }

      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;

      const logs = await auditService.getRecentActivity(userId, limit);

      const formattedLogs = logs.map((log) => ({
        id: log.id,
        action: log.action,
        actionLabel: auditService.getActionLabel(log.action),
        actionType: auditService.getActionType(log.action),
        resource: log.resource ?? log.entityType,
        resourceId: log.resourceId ?? log.entityId,
        status: log.status,
        severity: log.severity,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
      }));

      return {
        success: true,
        data: formattedLogs,
      };
    }
  );

  // ==========================================================================
  // GET /users/me/security-events - Get security-related events only
  // ==========================================================================
  fastify.get<{ Querystring: { limit?: string } }>(
    '/users/me/security-events',
    async (request, reply) => {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Non authentifie' },
        });
      }

      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;

      const logs = await auditService.getSecurityEvents(userId, limit);

      const formattedLogs = logs.map((log) => ({
        id: log.id,
        action: log.action,
        actionLabel: auditService.getActionLabel(log.action),
        status: log.status,
        severity: log.severity,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        details: log.details ?? log.changes,
        createdAt: log.createdAt.toISOString(),
      }));

      return {
        success: true,
        data: formattedLogs,
      };
    }
  );

  // ==========================================================================
  // GET /users/me/audit-logs/actions - Get list of available action types
  // ==========================================================================
  fastify.get('/users/me/audit-logs/actions', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Non authentifie' },
      });
    }

    // Return available action types for filtering
    const actionTypes = [
      { value: 'auth', label: 'Authentification' },
      { value: 'password', label: 'Mot de passe' },
      { value: 'two_factor', label: 'Double authentification' },
      { value: 'data', label: 'Donnees' },
      { value: 'session', label: 'Sessions' },
      { value: 'settings', label: 'Parametres' },
      { value: 'account', label: 'Comptes' },
      { value: 'transaction', label: 'Transactions' },
      { value: 'category', label: 'Categories' },
      { value: 'budget', label: 'Budgets' },
      { value: 'document', label: 'Documents' },
      { value: 'import', label: 'Imports' },
      { value: 'export', label: 'Exports' },
      { value: 'security', label: 'Securite' },
    ];

    return {
      success: true,
      data: actionTypes,
    };
  });
};

export { auditRoutes };
export default auditRoutes;
