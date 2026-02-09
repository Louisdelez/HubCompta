// ============================================================================
// PORTFOLIO ROUTES - Finance Hub
// Portfolio summary and analytics
// ============================================================================

import type { FastifyInstance } from 'fastify';
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
  app.get<{
    Params: { workspaceId: string };
    Querystring: { accountId?: string; currency?: string };
  }>(
    '/summary',
    { preHandler: [requirePermission('transaction:read')] },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { accountId, currency } = request.query;

      // If currency is provided, use normalized summary with currency conversion
      if (currency) {
        const summary = await positionService.getNormalizedPortfolioSummary(
          workspaceId,
          currency,
          accountId
        );
        return reply.send({
          success: true,
          data: {
            ...summary,
            positionCount: summary.positions.length,
          },
        });
      }

      // Otherwise return the standard summary
      const summary = await positionService.getPortfolioSummary(workspaceId, accountId);

      return reply.send({
        success: true,
        data: {
          ...summary,
          positionCount: summary.positions.length,
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /portfolio/refresh-prices - Refresh all position prices
  // --------------------------------------------------------------------------
  app.post<{ Params: { workspaceId: string } }>(
    '/refresh-prices',
    { preHandler: [requirePermission('transaction:read')] },
    async (request, reply) => {
      const { workspaceId } = request.params;

      // Refresh prices only for positions in this workspace
      const result = await positionService.refreshPrices(workspaceId);

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /portfolio/performance - Get portfolio performance over time
  // --------------------------------------------------------------------------
  app.get<{
    Params: { workspaceId: string };
    Querystring: { from?: string; to?: string; accountId?: string };
  }>(
    '/performance',
    { preHandler: [requirePermission('transaction:read')] },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { from, to } = request.query;

      // Parse dates if provided
      const startDate = from ? new Date(from) : undefined;
      const endDate = to ? new Date(to) : undefined;

      // Get historical snapshots
      const history = await positionService.getPortfolioHistory(workspaceId, startDate, endDate);

      // Get current summary
      const current = await positionService.getPortfolioSummary(workspaceId);

      return reply.send({
        success: true,
        data: {
          current,
          history,
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /portfolio/snapshot - Manually trigger a portfolio snapshot
  // --------------------------------------------------------------------------
  app.post<{ Params: { workspaceId: string } }>(
    '/snapshot',
    { preHandler: [requirePermission('transaction:read')] },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const snapshot = await positionService.takePortfolioSnapshot(workspaceId);

      return reply.send({
        success: true,
        data: snapshot,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /portfolio/allocation - Get allocation breakdown
  // --------------------------------------------------------------------------
  app.get<{
    Params: { workspaceId: string };
    Querystring: { accountId?: string; currency?: string };
  }>(
    '/allocation',
    { preHandler: [requirePermission('transaction:read')] },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { accountId, currency } = request.query;

      // Use normalized summary if currency is specified
      const summary = currency
        ? await positionService.getNormalizedPortfolioSummary(workspaceId, currency, accountId)
        : await positionService.getPortfolioSummary(workspaceId, accountId);

      // Group by asset type
      const byType = summary.allocation;

      // Group by currency (using original asset currencies)
      const byCurrency = new Map<string, number>();
      for (const pos of summary.positions) {
        const assetCurrency = pos.asset.currency;
        const current = byCurrency.get(assetCurrency) || 0;
        byCurrency.set(assetCurrency, current + pos.currentValue);
      }

      const currencyAllocation = Array.from(byCurrency.entries()).map(([curr, value]) => ({
        currency: curr,
        value,
        percent: summary.totalValue > 0 ? (value / summary.totalValue) * 100 : 0,
      }));

      return reply.send({
        success: true,
        data: {
          totalValue: summary.totalValue,
          baseCurrency: currency,
          byType,
          byCurrency: currencyAllocation,
        },
      });
    }
  );
}

export default portfolioRoutes;
