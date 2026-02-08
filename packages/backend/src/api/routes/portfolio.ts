// ============================================================================
// PORTFOLIO ROUTES - Finance Hub
// Portfolio summary and analytics
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { positionService } from '@/modules/invest/position.service.js';
import { assetService } from '@/modules/invest/asset.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export async function portfolioRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth guard and workspace context to all routes
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // --------------------------------------------------------------------------
  // GET /portfolio/summary - Get portfolio summary
  // --------------------------------------------------------------------------
  app.get(
    '/summary',
    { preHandler: [requirePermission('transaction:read')] },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Querystring: { accountId?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const { accountId } = request.query;

      const summary = await positionService.getPortfolioSummary(workspaceId, accountId);

      return reply.send({
        success: true,
        data: summary,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /portfolio/refresh-prices - Refresh all position prices
  // --------------------------------------------------------------------------
  app.post(
    '/refresh-prices',
    { preHandler: [requirePermission('transaction:read')] },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
      }>,
      reply: FastifyReply
    ) => {
      const result = await assetService.updateAllPrices();

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /portfolio/performance - Get portfolio performance over time
  // --------------------------------------------------------------------------
  app.get(
    '/performance',
    { preHandler: [requirePermission('transaction:read')] },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Querystring: {
          from?: string;
          to?: string;
          accountId?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const { accountId } = request.query;

      // Get current summary for now
      // TODO: Implement historical performance tracking
      const summary = await positionService.getPortfolioSummary(workspaceId, accountId);

      return reply.send({
        success: true,
        data: {
          current: summary,
          // Historical performance would go here
          history: [],
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /portfolio/allocation - Get allocation breakdown
  // --------------------------------------------------------------------------
  app.get(
    '/allocation',
    { preHandler: [requirePermission('transaction:read')] },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Querystring: { accountId?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const { accountId } = request.query;

      const summary = await positionService.getPortfolioSummary(workspaceId, accountId);

      // Group by asset type
      const byType = summary.allocation;

      // Group by currency
      const byCurrency = new Map<string, number>();
      for (const pos of summary.positions) {
        const currency = pos.asset.currency;
        const current = byCurrency.get(currency) || 0;
        byCurrency.set(currency, current + pos.currentValue);
      }

      const currencyAllocation = Array.from(byCurrency.entries()).map(([currency, value]) => ({
        currency,
        value,
        percent: summary.totalValue > 0 ? (value / summary.totalValue) * 100 : 0,
      }));

      return reply.send({
        success: true,
        data: {
          totalValue: summary.totalValue,
          byType,
          byCurrency: currencyAllocation,
        },
      });
    }
  );
}

export default portfolioRoutes;
