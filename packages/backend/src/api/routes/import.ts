// ============================================================================
// IMPORT ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance } from 'fastify';

interface MultipartFile {
  file: AsyncIterableIterator<Buffer>;
  filename: string;
  fields: Record<string, unknown>;
}
import { importService } from '@/modules/import/import.service.js';
import { auditService, AUDIT_ACTIONS } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';
import { importQueue } from '@/core/queue/index.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WorkspaceParams {
  workspaceId: string;
}

interface JobParams extends WorkspaceParams {
  jobId: string;
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export function importRoutes(app: FastifyInstance): void {
  // Apply auth guard and workspace context to all routes
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/import/upload - Upload CSV file
  // --------------------------------------------------------------------------
  app.post<{ Params: WorkspaceParams }>(
    '/upload',
    { preHandler: requirePermission('import:execute') },
    async (request, reply) => {
      const { workspaceId } = request.params;

      // Handle multipart file upload
      const data = await (request as unknown as { file: () => Promise<MultipartFile | undefined> }).file();
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: { message: 'No file uploaded' },
        });
      }

      // Read file content
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const fileContent = Buffer.concat(chunks).toString('utf-8');

      // Get account ID from fields
      const accountId = (data.fields.accountId as { value: string })?.value;
      if (!accountId) {
        return reply.status(400).send({
          success: false,
          error: { message: 'Account ID required' },
        });
      }

      // Create import job
      const job = await importService.createJob(
        workspaceId,
        accountId,
        request.user!.sub,
        fileContent,
        data.filename
      );

      return reply.status(201).send({
        success: true,
        data: {
          jobId: job.id,
          fileName: job.fileName,
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/import/preview - Preview import
  // --------------------------------------------------------------------------
  app.post<{ Params: WorkspaceParams }>(
    '/preview',
    { preHandler: requirePermission('import:execute') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const body = request.body as {
        jobId?: string;
        fileContent?: string;
        accountId: string;
        columnMapping?: {
          date: string;
          amount: string;
          description: string;
          credit?: string;
          debit?: string;
        };
      };

      let fileContent: string;

      if (body.jobId) {
        // Get content from existing job
        const job = await importService.getJob(body.jobId, workspaceId);
        if (!job) {
          return reply.status(404).send({
            success: false,
            error: { message: 'Import job not found' },
          });
        }
        fileContent = job.fileContent;
      } else if (body.fileContent) {
        fileContent = body.fileContent;
      } else {
        return reply.status(400).send({
          success: false,
          error: { message: 'File content or job ID required' },
        });
      }

      const preview = await importService.preview(
        workspaceId,
        body.accountId,
        fileContent,
        body.columnMapping
      );

      return reply.send({
        success: true,
        data: preview,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/import/execute - Execute import
  // --------------------------------------------------------------------------
  app.post<{ Params: WorkspaceParams }>(
    '/execute',
    { preHandler: requirePermission('import:execute') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const body = request.body as {
        jobId: string;
        accountId: string;
        columnMapping: {
          date: string;
          amount: string;
          description: string;
          credit?: string;
          debit?: string;
        };
        dateFormat: string;
        skipDuplicates?: boolean;
        applyRules?: boolean;
        async?: boolean;
      };

      // Verify job exists
      const job = await importService.getJob(body.jobId, workspaceId);
      if (!job) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Import job not found' },
        });
      }

      if (body.async) {
        // Queue job for async processing
        await importQueue?.add('import', {
          jobId: body.jobId,
          workspaceId,
          accountId: body.accountId,
          columnMapping: body.columnMapping,
          dateFormat: body.dateFormat,
          skipDuplicates: body.skipDuplicates ?? true,
          applyRules: body.applyRules ?? true,
        });

        await auditService.log({
          userId: request.user!.sub,
          workspaceId,
          action: AUDIT_ACTIONS.IMPORT_STARTED,
          entityType: 'import',
          entityId: body.jobId,
          changes: { async: true, accountId: body.accountId },
          ipAddress: request.ip,
        });

        return reply.status(202).send({
          success: true,
          data: {
            jobId: body.jobId,
            status: 'processing',
            message: 'Import started in background',
          },
        });
      }

      // Execute synchronously
      const result = await importService.execute(body.jobId, workspaceId, {
        accountId: body.accountId,
        columnMapping: body.columnMapping,
        dateFormat: body.dateFormat,
        skipDuplicates: body.skipDuplicates ?? true,
        applyRules: body.applyRules ?? true,
      });

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.IMPORT_COMPLETED,
        entityType: 'import',
        entityId: body.jobId,
        changes: {
          imported: result.imported,
          skipped: result.skipped,
          duplicates: result.duplicates,
          errors: result.errors,
        },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/import/:jobId - Get import job status
  // --------------------------------------------------------------------------
  app.get<{ Params: JobParams }>(
    '/:jobId',
    { preHandler: requirePermission('import:execute') },
    async (request, reply) => {
      const { workspaceId, jobId } = request.params;

      const job = await importService.getJob(jobId, workspaceId);

      if (!job) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Import job not found' },
        });
      }

      return reply.send({
        success: true,
        data: {
          id: job.id,
          fileName: job.fileName,
          status: job.status,
          totalRows: job.totalRows,
          processedRows: job.processedRows,
          importedRows: job.importedRows,
          skippedRows: job.skippedRows,
          errorRows: job.errorRows,
          error: job.error,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/import - List import jobs
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: { page?: string; limit?: string } }>(
    '/',
    { preHandler: requirePermission('import:execute') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { page, limit } = request.query;

      const result = await importService.listJobs(workspaceId, {
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
      });

      return reply.send({
        success: true,
        data: result.jobs.map((job) => ({
          id: job.id,
          fileName: job.fileName,
          status: job.status,
          importedRows: job.importedRows,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
        })),
        meta: {
          total: result.total,
        },
      });
    }
  );
}

export default importRoutes;
