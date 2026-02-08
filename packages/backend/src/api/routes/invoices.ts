// ============================================================================
// INVOICE ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { invoiceService } from '@/modules/pro/invoice.service.js';
import { auditService, AUDIT_ACTIONS } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';
import { invoiceCreateSchema, invoicePaySchema, invoiceLineSchema } from '@finance-hub/shared';
import type { InvoiceStatus } from '@prisma/client';
import { z } from 'zod';

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export async function invoiceRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth guard and workspace context to all routes
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // --------------------------------------------------------------------------
  // GET /invoices - List invoices
  // --------------------------------------------------------------------------
  app.get(
    '/',
    { preHandler: [requirePermission('pro:read')] },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Querystring: {
          status?: InvoiceStatus;
          contactId?: string;
          from?: string;
          to?: string;
          overdue?: boolean;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const { status, contactId, from, to, overdue } = request.query;

      const invoices = await invoiceService.list(workspaceId, {
        status,
        contactId,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        overdue,
      });

      return reply.send({
        success: true,
        data: invoices,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /invoices/stats - Get invoice statistics
  // --------------------------------------------------------------------------
  app.get(
    '/stats',
    { preHandler: [requirePermission('pro:read')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const stats = await invoiceService.getStats(workspaceId);

      return reply.send({
        success: true,
        data: stats,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /invoices/recent - Get recent invoices
  // --------------------------------------------------------------------------
  app.get(
    '/recent',
    { preHandler: [requirePermission('pro:read')] },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Querystring: { limit?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 5;

      const invoices = await invoiceService.getRecent(workspaceId, limit);

      return reply.send({
        success: true,
        data: invoices,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /invoices/:id - Get invoice details
  // --------------------------------------------------------------------------
  app.get(
    '/:id',
    { preHandler: [requirePermission('pro:read')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;
      const invoice = await invoiceService.getById(workspaceId, id);

      if (!invoice) {
        return reply.status(404).send({
          success: false,
          error: 'Facture non trouvée',
        });
      }

      return reply.send({
        success: true,
        data: invoice,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /invoices - Create invoice
  // --------------------------------------------------------------------------
  app.post(
    '/',
    { preHandler: [requirePermission('pro:manage')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const input = invoiceCreateSchema.parse(request.body);

      const invoice = await invoiceService.create(workspaceId, input);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.INVOICE_CREATED,
        entityType: 'invoice',
        entityId: invoice.id,
        changes: { number: invoice.number, total: invoice.total.toString() },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: invoice,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /invoices/from-quote/:quoteId - Create invoice from quote
  // --------------------------------------------------------------------------
  app.post(
    '/from-quote/:quoteId',
    { preHandler: [requirePermission('pro:manage')] },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string; quoteId: string };
        Body: { dueDate: string };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, quoteId } = request.params;
      const { dueDate } = z.object({ dueDate: z.coerce.date() }).parse(request.body);

      const invoice = await invoiceService.createFromQuote(workspaceId, quoteId, dueDate);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.INVOICE_CREATED,
        entityType: 'invoice',
        entityId: invoice.id,
        changes: { number: invoice.number, fromQuote: quoteId },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: invoice,
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /invoices/:id/lines - Update invoice lines (draft only)
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

      const invoice = await invoiceService.updateLines(workspaceId, id, lines);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.INVOICE_UPDATED,
        entityType: 'invoice',
        entityId: id,
        changes: { linesCount: lines.length, total: invoice.total.toString() },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: invoice,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /invoices/:id/send - Send invoice
  // --------------------------------------------------------------------------
  app.post(
    '/:id/send',
    { preHandler: [requirePermission('pro:manage')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;

      const invoice = await invoiceService.send(workspaceId, id);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.INVOICE_SENT,
        entityType: 'invoice',
        entityId: id,
        changes: { status: 'sent' },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: invoice,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /invoices/:id/pay - Record payment
  // --------------------------------------------------------------------------
  app.post(
    '/:id/pay',
    { preHandler: [requirePermission('pro:manage')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;
      const input = invoicePaySchema.parse(request.body);

      const invoice = await invoiceService.recordPayment(workspaceId, id, input);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.INVOICE_PAYMENT_RECORDED,
        entityType: 'invoice',
        entityId: id,
        changes: {
          paidAmount: input.amount,
          totalPaid: invoice.paidAmount.toString(),
          status: invoice.status,
        },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: invoice,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /invoices/:id/cancel - Cancel invoice
  // --------------------------------------------------------------------------
  app.post(
    '/:id/cancel',
    { preHandler: [requirePermission('pro:manage')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;

      const invoice = await invoiceService.cancel(workspaceId, id);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.INVOICE_CANCELLED,
        entityType: 'invoice',
        entityId: id,
        ipAddress: request.ip,
        severity: 'warning',
      });

      return reply.send({
        success: true,
        data: invoice,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /invoices/:id/duplicate - Duplicate invoice
  // --------------------------------------------------------------------------
  app.post(
    '/:id/duplicate',
    { preHandler: [requirePermission('pro:manage')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;

      const invoice = await invoiceService.duplicate(workspaceId, id);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.INVOICE_CREATED,
        entityType: 'invoice',
        entityId: invoice.id,
        changes: { number: invoice.number, duplicatedFrom: id },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: invoice,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /invoices/:id - Delete invoice (draft only)
  // --------------------------------------------------------------------------
  app.delete(
    '/:id',
    { preHandler: [requirePermission('pro:manage')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;

      await invoiceService.delete(workspaceId, id);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.INVOICE_DELETED,
        entityType: 'invoice',
        entityId: id,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: { message: 'Facture supprimée' },
      });
    }
  );
}

export default invoiceRoutes;
