// ============================================================================
// NET WORTH ROUTES - Finance Hub
// Net worth tracking and history
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { netWorthService } from '@/modules/networth/networth.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WorkspaceParams {
  workspaceId: string;
}

interface HistoryQuery {
  start?: string;
  end?: string;
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export function netWorthRoutes(app: FastifyInstance): void {
  // Apply auth guard and workspace context to all routes
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/networth - Get current net worth
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams }>(
    '/',
    { preHandler: requirePermission('account:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const summary = await netWorthService.calculateCurrentNetWorth(workspaceId);

      return reply.send({
        success: true,
        data: summary,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/networth/history - Get net worth history
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: HistoryQuery }>(
    '/history',
    { preHandler: requirePermission('account:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { start, end } = request.query;

      const startDate = start ? new Date(start) : undefined;
      const endDate = end ? new Date(end) : undefined;

      const history = await netWorthService.getHistory(workspaceId, startDate, endDate);

      return reply.send({
        success: true,
        data: history,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/networth/snapshot - Create manual snapshot
  // --------------------------------------------------------------------------
  app.post<{ Params: WorkspaceParams }>(
    '/snapshot',
    { preHandler: requirePermission('account:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const snapshot = await netWorthService.createSnapshot(workspaceId);

      return reply.send({
        success: true,
        data: snapshot,
      });
    }
  );
}

export default netWorthRoutes;
