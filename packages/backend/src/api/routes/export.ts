// ============================================================================
// EXPORT API ROUTES - Finance Hub
// ============================================================================

import { FastifyPluginAsync } from 'fastify';
import { exportService, ExportFormat } from '../../modules/export/index.js';
import { authGuard } from '../../core/auth/authGuard.js';
import { randomUUID } from 'crypto';

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

interface BackupData {
  version?: string;
  exportedAt?: string;
  workspace?: { name?: string };
  accounts?: unknown[];
  transactions?: unknown[];
  categories?: unknown[];
  budgets?: unknown[];
  tags?: unknown[];
  rules?: unknown[];
  recurrences?: unknown[];
  [key: string]: unknown;
}

interface GenerateExportBody {
  entityTypes: string[];
  format: string;
  dateFrom?: string;
  dateTo?: string;
  accountIds?: string[];
  categoryIds?: string[];
  includeArchived?: boolean;
  includeAttachments?: boolean;
}

// In-memory export job storage (for demo purposes - in production use Redis or DB)
const exportJobs = new Map<string, {
  id: string;
  workspaceId: string;
  type: string;
  format: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  error?: string;
  data?: string;
  filename?: string;
  mimeType?: string;
}>();

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export const exportRoutes: FastifyPluginAsync = async (fastify) => {
  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/export - Generate export job
  // --------------------------------------------------------------------------
  fastify.post<{
    Params: { workspaceId: string };
    Body: GenerateExportBody;
  }>('/', {
    preHandler: [authGuard],
  }, async (request, reply) => {
    const { workspaceId } = request.params;
    const { entityTypes, format, dateFrom, dateTo, accountIds, categoryIds, includeArchived } = request.body;

    // Create export job
    const jobId = randomUUID();
    const job = {
      id: jobId,
      workspaceId,
      type: entityTypes.join(','),
      format: format || 'csv',
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    };

    exportJobs.set(jobId, job);

    // Process export asynchronously
    void (async () => {
      try {
        const currentJob = exportJobs.get(jobId);
        if (!currentJob) return;

        currentJob.status = 'processing';
        exportJobs.set(jobId, currentJob);

        let result: { data: string; filename: string; mimeType: string };

        // Handle different export types
        if (entityTypes.includes('backup') || entityTypes.length > 1) {
          result = await exportService.exportFullBackup(workspaceId);
        } else if (entityTypes.includes('transactions')) {
          result = await exportService.exportTransactions({
            workspaceId,
            format: (format || 'csv') as ExportFormat,
            dateFrom: dateFrom ? new Date(dateFrom) : undefined,
            dateTo: dateTo ? new Date(dateTo) : undefined,
            accountIds,
            categoryIds,
            includeArchived: includeArchived ?? false,
          });
        } else if (entityTypes.includes('accounts')) {
          result = await exportService.exportAccounts({
            workspaceId,
            format: (format || 'csv') as ExportFormat,
            includeArchived: includeArchived ?? false,
          });
        } else {
          result = await exportService.exportFullBackup(workspaceId);
        }

        currentJob.status = 'completed';
        currentJob.completedAt = new Date().toISOString();
        currentJob.data = result.data;
        currentJob.filename = result.filename;
        currentJob.mimeType = result.mimeType;
        exportJobs.set(jobId, currentJob);
      } catch (error) {
        const currentJob = exportJobs.get(jobId);
        if (currentJob) {
          currentJob.status = 'failed';
          currentJob.error = error instanceof Error ? error.message : 'Unknown error';
          exportJobs.set(jobId, currentJob);
        }
      }
    });

    return reply.status(202).send({
      success: true,
      data: {
        exportId: jobId,
        status: 'pending',
        message: 'Export started',
      },
    });
  });

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/export/:exportId - Download export file
  // --------------------------------------------------------------------------
  fastify.get<{
    Params: { workspaceId: string; exportId: string };
  }>('/:exportId', {
    preHandler: [authGuard],
  }, async (request, reply) => {
    const { workspaceId, exportId } = request.params;

    const job = exportJobs.get(exportId);

    if (!job) {
      return reply.status(404).send({
        success: false,
        error: { message: 'Export not found' },
      });
    }

    if (job.workspaceId !== workspaceId) {
      return reply.status(403).send({
        success: false,
        error: { message: 'Access denied' },
      });
    }

    if (job.status === 'pending' || job.status === 'processing') {
      return reply.send({
        success: true,
        data: {
          id: job.id,
          status: job.status,
          createdAt: job.createdAt,
        },
      });
    }

    if (job.status === 'failed') {
      return reply.status(500).send({
        success: false,
        error: { message: job.error ?? 'Export failed' },
      });
    }

    // Return the file
    if (job.data && job.mimeType && job.filename) {
      reply
        .header('Content-Type', job.mimeType)
        .header('Content-Disposition', `attachment; filename="${job.filename}"`)
        .send(job.data);
    } else {
      return reply.status(500).send({
        success: false,
        error: { message: 'Export data not available' },
      });
    }
  });

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/export/history - List past exports
  // --------------------------------------------------------------------------
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: { page?: string; limit?: string };
  }>('/history', {
    preHandler: [authGuard],
  }, async (request, reply) => {
    const { workspaceId } = request.params;
    const { page = '1', limit = '20' } = request.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // Filter jobs for this workspace
    const workspaceJobs = Array.from(exportJobs.values())
      .filter((job) => job.workspaceId === workspaceId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = workspaceJobs.length;
    const paginatedJobs = workspaceJobs.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return reply.send({
      success: true,
      data: paginatedJobs.map((job) => ({
        id: job.id,
        type: job.type,
        format: job.format,
        status: job.status,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        error: job.error,
        downloadUrl: job.status === 'completed' ? `/api/v1/workspaces/${workspaceId}/export/${job.id}` : undefined,
      })),
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
      },
    });
  });

  // Export transactions
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: ExportQuery;
  }>('/transactions', {
    preHandler: [authGuard],
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
    preHandler: [authGuard],
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
    preHandler: [authGuard],
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
    preHandler: [authGuard],
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
    preHandler: [authGuard],
  }, () => {
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
    preHandler: [authGuard],
  }, async (request, reply) => {
    const { backup } = request.body as { backup: BackupData };

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

  // Restore from backup
  fastify.post<{
    Params: { workspaceId: string };
    Body: { backup: unknown; merge?: boolean };
  }>('/restore', {
    preHandler: [authGuard],
  }, async (request, reply) => {
    const { workspaceId } = request.params;
    const { backup, merge = true } = request.body as { backup: BackupData; merge?: boolean };

    // Validate backup structure
    if (!backup || typeof backup !== 'object') {
      return reply.status(400).send({
        success: false,
        error: 'Invalid backup format'
      });
    }

    const requiredFields = ['version', 'workspace', 'accounts', 'transactions', 'categories'];
    const missingFields = requiredFields.filter((f) => !(f in backup));

    if (missingFields.length > 0) {
      return reply.status(400).send({
        success: false,
        error: 'Missing required fields',
        missingFields,
      });
    }

    try {
      // At this point we've validated required fields exist, so we can safely cast
      // Ensure exportedAt is set (required by FullBackupData)
      const fullBackup = {
        ...backup,
        exportedAt: backup.exportedAt || new Date().toISOString(),
        version: backup.version || '1.0',
      };
      const result = await exportService.restoreFromBackup(workspaceId, fullBackup as Parameters<typeof exportService.restoreFromBackup>[1], { merge });

      return reply.send({
        success: true,
        data: {
          imported: result.imported,
          errors: result.errors,
          hasErrors: result.errors.length > 0,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Restore failed',
      });
    }
  });
};

export default exportRoutes;
