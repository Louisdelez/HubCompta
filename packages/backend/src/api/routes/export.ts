// ============================================================================
// EXPORT API ROUTES - Finance Hub
// ============================================================================

import { FastifyPluginAsync } from 'fastify';
import { exportService, ExportFormat } from '../../modules/export/index.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ExportQuery {
  format?: string;
  dateFrom?: string;
  dateTo?: string;
  accountIds?: string;
  categoryIds?: string;
  includeArchived?: string;
}

interface ReportQuery {
  type: string;
  year: string;
  month?: string;
  accountId?: string;
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export const exportRoutes: FastifyPluginAsync = async (fastify) => {
  // Export transactions
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: ExportQuery;
  }>('/transactions', {
    preHandler: [fastify.authenticate, fastify.requireWorkspaceMember],
  }, async (request, reply) => {
    const { workspaceId } = request.params;
    const { format = 'csv', dateFrom, dateTo, accountIds, categoryIds, includeArchived } = request.query;

    const result = await exportService.exportTransactions({
      workspaceId,
      format: format as ExportFormat,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      accountIds: accountIds?.split(','),
      categoryIds: categoryIds?.split(','),
      includeArchived: includeArchived === 'true',
    });

    reply
      .header('Content-Type', result.mimeType)
      .header('Content-Disposition', `attachment; filename="${result.filename}"`)
      .send(result.data);
  });

  // Export accounts
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: ExportQuery;
  }>('/accounts', {
    preHandler: [fastify.authenticate, fastify.requireWorkspaceMember],
  }, async (request, reply) => {
    const { workspaceId } = request.params;
    const { format = 'csv', includeArchived } = request.query;

    const result = await exportService.exportAccounts({
      workspaceId,
      format: format as ExportFormat,
      includeArchived: includeArchived === 'true',
    });

    reply
      .header('Content-Type', result.mimeType)
      .header('Content-Disposition', `attachment; filename="${result.filename}"`)
      .send(result.data);
  });

  // Export full backup
  fastify.get<{
    Params: { workspaceId: string };
  }>('/backup', {
    preHandler: [fastify.authenticate, fastify.requireWorkspaceMember],
  }, async (request, reply) => {
    const { workspaceId } = request.params;

    const result = await exportService.exportFullBackup(workspaceId);

    reply
      .header('Content-Type', result.mimeType)
      .header('Content-Disposition', `attachment; filename="${result.filename}"`)
      .send(result.data);
  });

  // Generate report
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: ReportQuery;
  }>('/report', {
    preHandler: [fastify.authenticate, fastify.requireWorkspaceMember],
    schema: {
      querystring: {
        type: 'object',
        required: ['type', 'year'],
        properties: {
          type: { type: 'string', enum: ['monthly', 'yearly', 'category', 'account'] },
          year: { type: 'string' },
          month: { type: 'string' },
          accountId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    const { workspaceId } = request.params;
    const { type, year, month, accountId } = request.query;

    const result = await exportService.generateReport({
      workspaceId,
      type: type as 'monthly' | 'yearly' | 'category' | 'account',
      year: parseInt(year, 10),
      month: month ? parseInt(month, 10) : undefined,
      accountId,
    });

    reply
      .header('Content-Type', result.mimeType)
      .header('Content-Disposition', `attachment; filename="${result.filename}"`)
      .send(result.data);
  });

  // Get available export formats
  fastify.get('/formats', {
    preHandler: [fastify.authenticate],
  }, async () => {
    return {
      formats: [
        { id: 'csv', name: 'CSV', extension: '.csv', mimeType: 'text/csv' },
        { id: 'json', name: 'JSON', extension: '.json', mimeType: 'application/json' },
        { id: 'excel', name: 'Excel (CSV)', extension: '.csv', mimeType: 'text/csv' },
      ],
      reportTypes: [
        { id: 'monthly', name: 'Rapport mensuel' },
        { id: 'yearly', name: 'Rapport annuel' },
        { id: 'category', name: 'Rapport par catégorie' },
        { id: 'account', name: 'Rapport de compte' },
      ],
    };
  });

  // Validate backup file (preview before restore)
  fastify.post<{
    Params: { workspaceId: string };
    Body: { backup: unknown };
  }>('/validate-backup', {
    preHandler: [fastify.authenticate, fastify.requireWorkspaceMember],
  }, async (request, reply) => {
    const { backup } = request.body as { backup: any };

    // Validate backup structure
    if (!backup || typeof backup !== 'object') {
      return reply.status(400).send({ error: 'Invalid backup format' });
    }

    const requiredFields = ['version', 'workspace', 'accounts', 'transactions', 'categories'];
    const missingFields = requiredFields.filter((f) => !(f in backup));

    if (missingFields.length > 0) {
      return reply.status(400).send({
        error: 'Missing required fields',
        missingFields,
      });
    }

    // Return backup summary
    return {
      valid: true,
      summary: {
        version: backup.version,
        exportedAt: backup.exportedAt,
        workspace: backup.workspace?.name,
        counts: {
          accounts: backup.accounts?.length ?? 0,
          transactions: backup.transactions?.length ?? 0,
          categories: backup.categories?.length ?? 0,
          budgets: backup.budgets?.length ?? 0,
          tags: backup.tags?.length ?? 0,
          rules: backup.rules?.length ?? 0,
          recurrences: backup.recurrences?.length ?? 0,
        },
      },
    };
  });
};

export default exportRoutes;
