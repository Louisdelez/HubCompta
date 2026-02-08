// ============================================================================
// TAG ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tagService } from '@/modules/categories/tag.service.js';
import { auditService, AUDIT_ACTIONS } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';
import { tagCreateSchema, tagUpdateSchema } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WorkspaceParams {
  workspaceId: string;
}

interface TagParams extends WorkspaceParams {
  tagId: string;
}

interface TagSearchQuery {
  q?: string;
  limit?: string;
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export async function tagRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth guard and workspace context to all routes
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/tags - List tags
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams }>(
    '/',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const tags = await tagService.list(workspaceId);

      return reply.send({
        success: true,
        data: tags,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/tags/search - Search tags
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: TagSearchQuery }>(
    '/search',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { q, limit } = request.query;

      if (!q) {
        return reply.send({
          success: true,
          data: [],
        });
      }

      const tags = await tagService.search(
        workspaceId,
        q,
        limit ? parseInt(limit) : 10
      );

      return reply.send({
        success: true,
        data: tags,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/tags/popular - Get popular tags
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: { limit?: string } }>(
    '/popular',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { limit } = request.query;

      const tags = await tagService.getPopular(
        workspaceId,
        limit ? parseInt(limit) : 10
      );

      return reply.send({
        success: true,
        data: tags,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/tags - Create tag
  // --------------------------------------------------------------------------
  app.post<{ Params: WorkspaceParams }>(
    '/',
    { preHandler: requirePermission('transaction:create') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const input = tagCreateSchema.parse(request.body);

      const tag = await tagService.create(workspaceId, input);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.TAG_CREATED,
        entityType: 'tag',
        entityId: tag.id,
        changes: { name: tag.name },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: tag,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/tags/:tagId - Get tag
  // --------------------------------------------------------------------------
  app.get<{ Params: TagParams }>(
    '/:tagId',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId, tagId } = request.params;

      const tag = await tagService.getById(workspaceId, tagId);

      if (!tag) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Tag not found' },
        });
      }

      return reply.send({
        success: true,
        data: tag,
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /workspaces/:workspaceId/tags/:tagId - Update tag
  // --------------------------------------------------------------------------
  app.patch<{ Params: TagParams }>(
    '/:tagId',
    { preHandler: requirePermission('transaction:update') },
    async (request, reply) => {
      const { workspaceId, tagId } = request.params;
      const input = tagUpdateSchema.parse(request.body);

      const tag = await tagService.update(workspaceId, tagId, input);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.TAG_UPDATED,
        entityType: 'tag',
        entityId: tagId,
        changes: input,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: tag,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /workspaces/:workspaceId/tags/:tagId - Delete tag
  // --------------------------------------------------------------------------
  app.delete<{ Params: TagParams }>(
    '/:tagId',
    { preHandler: requirePermission('transaction:delete') },
    async (request, reply) => {
      const { workspaceId, tagId } = request.params;

      await tagService.delete(workspaceId, tagId);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.TAG_DELETED,
        entityType: 'tag',
        entityId: tagId,
        ipAddress: request.ip,
        severity: 'warning',
      });

      return reply.send({
        success: true,
        data: { message: 'Tag deleted' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/tags/:tagId/merge - Merge tags
  // --------------------------------------------------------------------------
  app.post<{ Params: TagParams }>(
    '/:tagId/merge',
    { preHandler: requirePermission('transaction:delete') },
    async (request, reply) => {
      const { workspaceId, tagId } = request.params;
      const { targetTagId } = request.body as { targetTagId: string };

      await tagService.merge(workspaceId, tagId, targetTagId);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.TAG_MERGED,
        entityType: 'tag',
        entityId: tagId,
        changes: { mergedInto: targetTagId },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: { message: 'Tags merged' },
      });
    }
  );
}

export default tagRoutes;
