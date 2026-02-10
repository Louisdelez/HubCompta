// ============================================================================
// DOCUMENT ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { documentService } from '@/modules/documents/document.service.js';
import { uploadService } from '@/modules/documents/upload.service.js';
import { duplicateService } from '@/modules/documents/duplicate.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { checkPermission } from '@/core/auth/rbac.js';
import { auditService } from '@/modules/audit/audit.service.js';

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------

const uploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string(),
  size: z.number().positive(),
  isVault: z.boolean().optional().default(false),
});

const confirmUploadSchema = z.object({
  sessionId: z.string().uuid(),
  hash: z.string().length(64), // SHA-256 hex
  encryptedKey: z.string().optional(),
});

const listQuerySchema = z.object({
  status: z.enum(['inbox', 'linked', 'archived']).optional(),
  search: z.string().optional(),
  mimeType: z.string().optional(),
  isVault: z.enum(['true', 'false']).optional(),
  unlinkedOnly: z.enum(['true', 'false']).optional(),
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 50)),
  sortBy: z.enum(['createdAt', 'filename', 'size']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const linkSchema = z.object({
  transactionId: z.string().uuid(),
});

// ----------------------------------------------------------------------------
// Route Handlers
// ----------------------------------------------------------------------------

export function documentRoutes(app: FastifyInstance): void {
  // Apply auth guard to all routes
  app.addHook('onRequest', authGuard);

  // --------------------------------------------------------------------------
  // POST /documents/upload-url - Request upload URL
  // --------------------------------------------------------------------------
  app.post(
    '/upload-url',
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Body: z.infer<typeof uploadRequestSchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'document', 'create');

      // Validate body
      const input = uploadRequestSchema.parse(request.body);

      const session = await uploadService.createUploadSession(workspaceId, userId, input);

      return reply.send({ success: true, data: session });
    }
  );

  // --------------------------------------------------------------------------
  // POST /documents/confirm - Confirm upload completion
  // --------------------------------------------------------------------------
  app.post(
    '/confirm',
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Body: z.infer<typeof confirmUploadSchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'document', 'create');

      // Validate body
      const input = confirmUploadSchema.parse(request.body);

      const result = await uploadService.confirmUpload(input);

      if (!result.isDuplicate) {
        // Audit log for new document
        await auditService.log({
          workspaceId,
          userId,
          action: 'document.upload',
          entityType: 'document',
          entityId: result.documentId,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        });
      }

      return reply.send({ success: true, data: result });
    }
  );

  // --------------------------------------------------------------------------
  // POST /documents/cancel - Cancel upload session
  // --------------------------------------------------------------------------
  app.post(
    '/cancel',
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Body: { sessionId: string };
      }>,
      reply: FastifyReply
    ) => {
      const { sessionId } = request.body;

      await uploadService.cancelUpload(sessionId);

      return reply.status(204).send();
    }
  );

  // --------------------------------------------------------------------------
  // GET /documents - List documents
  // --------------------------------------------------------------------------
  app.get(
    '/',
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Querystring: z.infer<typeof listQuerySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'document', 'read');

      const query = listQuerySchema.parse(request.query);

      const { documents, total } = await documentService.list(
        workspaceId,
        {
          status: query.status,
          search: query.search,
          mimeType: query.mimeType,
          isVault: query.isVault === 'true' ? true : query.isVault === 'false' ? false : undefined,
          unlinkedOnly: query.unlinkedOnly === 'true',
        },
        {
          page: query.page,
          limit: query.limit,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
        }
      );

      return reply.send({ success: true, data: { documents, total, page: query.page, limit: query.limit } });
    }
  );

  // --------------------------------------------------------------------------
  // GET /documents/inbox-count - Get inbox count
  // --------------------------------------------------------------------------
  app.get(
    '/inbox-count',
    async (
      request: FastifyRequest<{ Params: { workspaceId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      await checkPermission(userId, workspaceId, 'document', 'read');

      const count = await documentService.getInboxCount(workspaceId);

      return reply.send({ success: true, data: { count } });
    }
  );

  // --------------------------------------------------------------------------
  // GET /documents/:documentId - Get document by ID
  // --------------------------------------------------------------------------
  app.get(
    '/:documentId',
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; documentId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, documentId } = request.params;
      const userId = request.user!.sub;

      await checkPermission(userId, workspaceId, 'document', 'read');

      const document = await documentService.getById(workspaceId, documentId);

      if (!document) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } });
      }

      return reply.send({ success: true, data: document });
    }
  );

  // --------------------------------------------------------------------------
  // GET /documents/:documentId/download - Get download URL
  // --------------------------------------------------------------------------
  app.get(
    '/:documentId/download',
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; documentId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, documentId } = request.params;
      const userId = request.user!.sub;

      await checkPermission(userId, workspaceId, 'document', 'read');

      const { url, filename } = await documentService.getDownloadUrl(workspaceId, documentId);

      return reply.send({ success: true, data: { url, filename } });
    }
  );

  // --------------------------------------------------------------------------
  // POST /documents/:documentId/link - Link to transaction
  // --------------------------------------------------------------------------
  app.post(
    '/:documentId/link',
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string; documentId: string };
        Body: z.infer<typeof linkSchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, documentId } = request.params;
      const userId = request.user!.sub;

      await checkPermission(userId, workspaceId, 'document', 'update');

      const { transactionId } = linkSchema.parse(request.body);

      await documentService.linkToTransaction(workspaceId, documentId, transactionId);

      // Audit log
      await auditService.log({
        workspaceId,
        userId,
        action: 'document.link',
        entityType: 'document',
        entityId: documentId,
        newValue: { transactionId },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.status(204).send();
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /documents/:documentId/link/:transactionId - Unlink from transaction
  // --------------------------------------------------------------------------
  app.delete(
    '/:documentId/link/:transactionId',
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string; documentId: string; transactionId: string };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, documentId, transactionId } = request.params;
      const userId = request.user!.sub;

      await checkPermission(userId, workspaceId, 'document', 'update');

      await documentService.unlinkFromTransaction(workspaceId, documentId, transactionId);

      // Audit log
      await auditService.log({
        workspaceId,
        userId,
        action: 'document.unlink',
        entityType: 'document',
        entityId: documentId,
        oldValue: { transactionId },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.status(204).send();
    }
  );

  // --------------------------------------------------------------------------
  // POST /documents/:documentId/archive - Archive document
  // --------------------------------------------------------------------------
  app.post(
    '/:documentId/archive',
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; documentId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, documentId } = request.params;
      const userId = request.user!.sub;

      await checkPermission(userId, workspaceId, 'document', 'update');

      const document = await documentService.archive(workspaceId, documentId);

      return reply.send({ success: true, data: document });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /documents/:documentId - Delete document
  // --------------------------------------------------------------------------
  app.delete(
    '/:documentId',
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; documentId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, documentId } = request.params;
      const userId = request.user!.sub;

      await checkPermission(userId, workspaceId, 'document', 'delete');

      // Get document info for audit
      const document = await documentService.getById(workspaceId, documentId);

      await documentService.delete(workspaceId, documentId);

      // Audit log
      await auditService.log({
        workspaceId,
        userId,
        action: 'document.delete',
        entityType: 'document',
        entityId: documentId,
        oldValue: document ? { filename: document.filename } : null,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.status(204).send();
    }
  );

  // --------------------------------------------------------------------------
  // GET /documents/check-duplicate - Check for duplicates
  // --------------------------------------------------------------------------
  app.get(
    '/check-duplicate',
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Querystring: { hash?: string; filename?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const { hash, filename } = request.query;
      const userId = request.user!.sub;

      await checkPermission(userId, workspaceId, 'document', 'read');

      if (hash) {
        const result = await duplicateService.checkByHash(workspaceId, hash);
        return reply.send({ success: true, data: result });
      }

      if (filename) {
        const similar = await duplicateService.findSimilarByFilename(workspaceId, filename);
        return reply.send({ success: true, data: { similar } });
      }

      return reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'hash or filename required' } });
    }
  );
}

export default documentRoutes;
