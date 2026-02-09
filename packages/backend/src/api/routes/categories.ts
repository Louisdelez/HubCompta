// ============================================================================
// CATEGORY ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { categoryService } from '@/modules/categories/category.service.js';
import { auditService, AUDIT_ACTIONS } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';
import { categoryCreateSchema, categoryUpdateSchema } from '@finance-hub/shared';
import type { CategoryType } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WorkspaceParams {
  workspaceId: string;
}

interface CategoryParams extends WorkspaceParams {
  categoryId: string;
}

interface CategoryQuery {
  type?: CategoryType;
  flat?: boolean;
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export function categoryRoutes(app: FastifyInstance): void {
  // Apply auth guard and workspace context to all routes
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/categories - List categories
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: CategoryQuery }>(
    '/',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { type, flat } = request.query;

      const categories = flat
        ? await categoryService.listFlat(workspaceId, type)
        : await categoryService.list(workspaceId, type);

      return reply.send({
        success: true,
        data: categories,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/categories - Create category
  // --------------------------------------------------------------------------
  app.post<{ Params: WorkspaceParams }>(
    '/',
    { preHandler: requirePermission('transaction:create') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const input = categoryCreateSchema.parse(request.body);

      const category = await categoryService.create(workspaceId, input);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.CATEGORY_CREATED,
        entityType: 'category',
        entityId: category.id,
        changes: { name: category.name, type: category.type },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: category,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/categories/:categoryId - Get category
  // --------------------------------------------------------------------------
  app.get<{ Params: CategoryParams }>(
    '/:categoryId',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId, categoryId } = request.params;

      const category = await categoryService.getById(workspaceId, categoryId);

      if (!category) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Category not found' },
        });
      }

      return reply.send({
        success: true,
        data: category,
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /workspaces/:workspaceId/categories/:categoryId - Update category
  // --------------------------------------------------------------------------
  app.patch<{ Params: CategoryParams }>(
    '/:categoryId',
    { preHandler: requirePermission('transaction:update') },
    async (request, reply) => {
      const { workspaceId, categoryId } = request.params;
      const input = categoryUpdateSchema.parse(request.body);

      const category = await categoryService.update(workspaceId, categoryId, input);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.CATEGORY_UPDATED,
        entityType: 'category',
        entityId: categoryId,
        changes: input,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: category,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /workspaces/:workspaceId/categories/:categoryId - Delete category
  // --------------------------------------------------------------------------
  app.delete<{ Params: CategoryParams }>(
    '/:categoryId',
    { preHandler: requirePermission('transaction:delete') },
    async (request, reply) => {
      const { workspaceId, categoryId } = request.params;

      await categoryService.delete(workspaceId, categoryId);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.CATEGORY_DELETED,
        entityType: 'category',
        entityId: categoryId,
        ipAddress: request.ip,
        severity: 'warning',
      });

      return reply.send({
        success: true,
        data: { message: 'Category deleted' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/categories/:categoryId/merge - Merge categories
  // --------------------------------------------------------------------------
  app.post<{ Params: CategoryParams }>(
    '/:categoryId/merge',
    { preHandler: requirePermission('transaction:delete') },
    async (request, reply) => {
      const { workspaceId, categoryId } = request.params;
      const { targetCategoryId } = request.body as { targetCategoryId: string };

      await categoryService.merge(workspaceId, categoryId, targetCategoryId);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.CATEGORY_MERGED,
        entityType: 'category',
        entityId: categoryId,
        changes: { mergedInto: targetCategoryId },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: { message: 'Categories merged' },
      });
    }
  );
}

export default categoryRoutes;
