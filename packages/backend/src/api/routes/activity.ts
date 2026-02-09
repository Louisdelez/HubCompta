// ============================================================================
// ACTIVITY ROUTES - Finance Hub
// Activity feed endpoints for workspace and user activity
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { auditService } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import {
  workspaceContextMiddleware,
  requirePermission,
} from '@/core/middleware/workspaceContext.js';
import { z } from 'zod';

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------

const activityQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  pageSize: z.coerce.number().min(1).max(100).optional().default(50),
  types: z.string().optional(), // Comma-separated action types
  userId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const userActivityQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  pageSize: z.coerce.number().min(1).max(100).optional().default(50),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ----------------------------------------------------------------------------
// Workspace Activity Routes
// ----------------------------------------------------------------------------

export function workspaceActivityRoutes(app: FastifyInstance): void {
  // Apply auth guard to all routes
  app.addHook('preHandler', authGuard);

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/activity - Get workspace activity feed
  // --------------------------------------------------------------------------
  app.get<{
    Params: { workspaceId: string };
    Querystring: z.infer<typeof activityQuerySchema>;
  }>(
    '/',
    {
      preHandler: [workspaceContextMiddleware, requirePermission('transaction:read')],
    },
    async (request, reply: FastifyReply) => {
      const { workspaceId } = request.params;
      const query = activityQuerySchema.parse(request.query);

      const result = await auditService.getActivityFeed(workspaceId, {
        page: query.page,
        pageSize: query.pageSize,
        types: query.types ? query.types.split(',') : undefined,
        userId: query.userId,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      });

      return reply.send({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    }
  );
}

// ----------------------------------------------------------------------------
// User Activity Routes
// ----------------------------------------------------------------------------

export function userActivityRoutes(app: FastifyInstance): void {
  // Apply auth guard to all routes
  app.addHook('preHandler', authGuard);

  // --------------------------------------------------------------------------
  // GET /activity/me - Get current user's activity across workspaces
  // --------------------------------------------------------------------------
  app.get<{
    Querystring: z.infer<typeof userActivityQuerySchema>;
  }>('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = userActivityQuerySchema.parse(request.query);

    const result = await auditService.getUserActivity(request.user!.sub, {
      page: query.page,
      pageSize: query.pageSize,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });

    return reply.send({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  });
}

export default { workspaceActivityRoutes, userActivityRoutes };
