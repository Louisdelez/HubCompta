// ============================================================================
// QUOTE ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { quoteService } from '@/modules/pro/quote.service.js';
import { auditService, AUDIT_ACTIONS } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';
import { quoteCreateSchema, invoiceLineSchema } from '@finance-hub/shared';
import type { QuoteStatus } from '@prisma/client';
import { z } from 'zod';

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export async function quoteRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth guard and workspace context to all routes
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // --------------------------------------------------------------------------
  // GET /quotes - List quotes
  // --------------------------------------------------------------------------
  app.get(
    '/',
    { preHandler: [requirePermission('pro:read')] },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Querystring: {
          status?: QuoteStatus;
          contactId?: string;
          from?: string;
          to?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const { status, contactId, from, to } = request.query;

      const quotes = await quoteService.list(workspaceId, {
        status,
        contactId,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      });

      return reply.send({
        success: true,
        data: quotes,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /quotes/:id - Get quote details
  // --------------------------------------------------------------------------
  app.get(
    '/:id',
    { preHandler: [requirePermission('pro:read')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;
      const quote = await quoteService.getById(workspaceId, id);

      if (!quote) {
        return reply.status(404).send({
          success: false,
          error: 'Devis non trouvé',
        });
      }

      return reply.send({
        success: true,
        data: quote,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /quotes - Create quote
  // --------------------------------------------------------------------------
  app.post(
    '/',
    { preHandler: [requirePermission('pro:manage')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const input = quoteCreateSchema.parse(request.body);

      const quote = await quoteService.create(workspaceId, input);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.QUOTE_CREATED,
        entityType: 'quote',
        entityId: quote.id,
        changes: { number: quote.number, total: quote.total.toString() },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: quote,
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /quotes/:id/lines - Update quote lines
  // --------------------------------------------------------------------------
  app.patch(
    '/:id/lines',
    { preHandler: [requirePermission('pro:manage')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;
      const { lines } = z.object({
        lines: z.array(invoiceLineSchema).min(1),
      }).parse(request.body);

      const quote = await quoteService.updateLines(workspaceId, id, lines);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.QUOTE_UPDATED,
        entityType: 'quote',
        entityId: id,
        changes: { linesCount: lines.length, total: quote.total.toString() },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: quote,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /quotes/:id/send - Send quote (change status)
  // --------------------------------------------------------------------------
  app.post(
    '/:id/send',
    { preHandler: [requirePermission('pro:manage')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;

      const quote = await quoteService.updateStatus(workspaceId, id, 'sent');

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.QUOTE_SENT,
        entityType: 'quote',
        entityId: id,
        changes: { status: 'sent' },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: quote,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /quotes/:id/accept - Accept quote
  // --------------------------------------------------------------------------
  app.post(
    '/:id/accept',
    { preHandler: [requirePermission('pro:manage')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;

      const quote = await quoteService.updateStatus(workspaceId, id, 'accepted');

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.QUOTE_ACCEPTED,
        entityType: 'quote',
        entityId: id,
        changes: { status: 'accepted' },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: quote,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /quotes/:id/reject - Reject quote
  // --------------------------------------------------------------------------
  app.post(
    '/:id/reject',
    { preHandler: [requirePermission('pro:manage')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;

      const quote = await quoteService.updateStatus(workspaceId, id, 'rejected');

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.QUOTE_REJECTED,
        entityType: 'quote',
        entityId: id,
        changes: { status: 'rejected' },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: quote,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /quotes/:id/duplicate - Duplicate quote
  // --------------------------------------------------------------------------
  app.post(
    '/:id/duplicate',
    { preHandler: [requirePermission('pro:manage')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;

      const quote = await quoteService.duplicate(workspaceId, id);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.QUOTE_CREATED,
        entityType: 'quote',
        entityId: quote.id,
        changes: { number: quote.number, duplicatedFrom: id },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: quote,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /quotes/:id - Delete quote
  // --------------------------------------------------------------------------
  app.delete(
    '/:id',
    { preHandler: [requirePermission('pro:manage')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;

      await quoteService.delete(workspaceId, id);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.QUOTE_DELETED,
        entityType: 'quote',
        entityId: id,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: { message: 'Devis supprimé' },
      });
    }
  );
}

export default quoteRoutes;
