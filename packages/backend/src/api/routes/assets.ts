// ============================================================================
// ASSET ROUTES - Finance Hub
// Asset search and information
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { assetService } from '@/modules/invest/asset.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import type { AssetType } from '@prisma/client';

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export async function assetRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth guard to all routes
  app.addHook('preHandler', authGuard);

  // --------------------------------------------------------------------------
  // GET /assets/search - Search for assets
  // --------------------------------------------------------------------------
  app.get(
    '/search',
    async (
      request: FastifyRequest<{
        Querystring: {
          query: string;
          type?: AssetType;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { query, type } = request.query;

      if (!query || query.length < 2) {
        return reply.status(400).send({
          success: false,
          error: 'Query must be at least 2 characters',
        });
      }

      const results = await assetService.search({ query, type });

      return reply.send({
        success: true,
        data: results,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /assets/:symbol - Get asset by symbol
  // --------------------------------------------------------------------------
  app.get(
    '/:symbol',
    async (
      request: FastifyRequest<{
        Params: { symbol: string };
      }>,
      reply: FastifyReply
    ) => {
      const { symbol } = request.params;

      const asset = await assetService.getOrCreate(symbol);

      if (!asset) {
        return reply.status(404).send({
          success: false,
          error: 'Asset non trouvé',
        });
      }

      return reply.send({
        success: true,
        data: asset,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /assets/:symbol/quote - Get current quote
  // --------------------------------------------------------------------------
  app.get(
    '/:symbol/quote',
    async (
      request: FastifyRequest<{
        Params: { symbol: string };
      }>,
      reply: FastifyReply
    ) => {
      const { symbol } = request.params;

      const asset = await assetService.getBySymbol(symbol);

      if (!asset) {
        return reply.status(404).send({
          success: false,
          error: 'Asset non trouvé',
        });
      }

      const quote = await assetService.getQuote(asset.id);

      return reply.send({
        success: true,
        data: {
          asset,
          quote,
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /assets/:symbol/history - Get historical prices
  // --------------------------------------------------------------------------
  app.get(
    '/:symbol/history',
    async (
      request: FastifyRequest<{
        Params: { symbol: string };
        Querystring: {
          from?: string;
          to?: string;
          interval?: 'daily' | 'weekly' | 'monthly';
        };
      }>,
      reply: FastifyReply
    ) => {
      const { symbol } = request.params;
      const { from, to, interval = 'daily' } = request.query;

      const asset = await assetService.getBySymbol(symbol);

      if (!asset) {
        return reply.status(404).send({
          success: false,
          error: 'Asset non trouvé',
        });
      }

      // Default to last 1 year
      const endDate = to ? new Date(to) : new Date();
      const startDate = from ? new Date(from) : new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);

      const history = await assetService.getHistory(asset.id, startDate, endDate, interval);

      return reply.send({
        success: true,
        data: history,
      });
    }
  );
}

export default assetRoutes;
