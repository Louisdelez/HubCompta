// ============================================================================
// CONTACT ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { contactService } from '@/modules/pro/contact.service.js';
import { auditService, AUDIT_ACTIONS } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';
import { contactCreateSchema, contactUpdateSchema } from '@finance-hub/shared';
import type { ContactType } from '@prisma/client';

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export async function contactRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth guard and workspace context to all routes
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // --------------------------------------------------------------------------
  // GET /contacts - List contacts
  // --------------------------------------------------------------------------
  app.get(
    '/',
    { preHandler: [requirePermission('pro:read')] },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Querystring: {
          type?: ContactType;
          search?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const { type, search } = request.query;

      const contacts = await contactService.list(workspaceId, { type, search });

      return reply.send({
        success: true,
        data: contacts,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /contacts/stats - Get contact statistics
  // --------------------------------------------------------------------------
  app.get(
    '/stats',
    { preHandler: [requirePermission('pro:read')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const stats = await contactService.getStats(workspaceId);

      return reply.send({
        success: true,
        data: stats,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /contacts/:id - Get contact details
  // --------------------------------------------------------------------------
  app.get(
    '/:id',
    { preHandler: [requirePermission('pro:read')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;
      const contact = await contactService.getById(workspaceId, id);

      if (!contact) {
        return reply.status(404).send({
          success: false,
          error: 'Contact non trouvé',
        });
      }

      return reply.send({
        success: true,
        data: contact,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /contacts - Create contact
  // --------------------------------------------------------------------------
  app.post(
    '/',
    { preHandler: [requirePermission('pro:manage')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const input = contactCreateSchema.parse(request.body);

      const contact = await contactService.create(workspaceId, input);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.CONTACT_CREATED,
        entityType: 'contact',
        entityId: contact.id,
        changes: { name: contact.name, type: contact.type },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: contact,
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /contacts/:id - Update contact
  // --------------------------------------------------------------------------
  app.patch(
    '/:id',
    { preHandler: [requirePermission('pro:manage')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;
      const input = contactUpdateSchema.parse(request.body);

      const contact = await contactService.update(workspaceId, id, input);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.CONTACT_UPDATED,
        entityType: 'contact',
        entityId: id,
        changes: input,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: contact,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /contacts/:id - Delete contact
  // --------------------------------------------------------------------------
  app.delete(
    '/:id',
    { preHandler: [requirePermission('pro:manage')] },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;

      await contactService.delete(workspaceId, id);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.CONTACT_DELETED,
        entityType: 'contact',
        entityId: id,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: { message: 'Contact supprimé' },
      });
    }
  );
}

export default contactRoutes;
