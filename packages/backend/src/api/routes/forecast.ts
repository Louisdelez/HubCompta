// ============================================================================
// FORECAST ROUTES - Finance Hub
// Budget forecasting API endpoints
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { forecastService } from '@/modules/forecast/forecast.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { checkPermission } from '@/core/auth/rbac.js';
import { auditService } from '@/modules/audit/audit.service.js';

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------

const getForecastQuerySchema = z.object({
  months: z.string().optional().transform((s) => (s ? parseInt(s, 10) : 6)),
  startMonth: z.string().optional().transform((s) => (s ? new Date(s) : undefined)),
  endMonth: z.string().optional().transform((s) => (s ? new Date(s) : undefined)),
});

const generateForecastBodySchema = z.object({
  months: z.number().min(1).max(24).optional().default(6),
});

// ----------------------------------------------------------------------------
// Route Handlers
// ----------------------------------------------------------------------------

export function forecastRoutes(app: FastifyInstance): void {
  // Apply auth guard to all routes
  app.addHook('onRequest', authGuard);

  // --------------------------------------------------------------------------
  // GET /forecast - Get forecasts for a workspace
  // --------------------------------------------------------------------------
  app.get(
    '/',
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Querystring: z.infer<typeof getForecastQuerySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      // Parse query params
      const query = getForecastQuerySchema.parse(request.query);

      // Get forecasts
      const forecasts = await forecastService.getForecast(
        workspaceId,
        query.startMonth,
        query.endMonth
      );

      // If no forecasts exist, generate them
      if (forecasts.length === 0) {
        const generated = await forecastService.generateForecast(workspaceId, query.months);

        // Return the generated forecasts with category info
        const forecastsWithCategories = await forecastService.getForecast(
          workspaceId,
          query.startMonth,
          query.endMonth
        );

        return reply.send(forecastsWithCategories);
      }

      return reply.send(forecasts);
    }
  );

  // --------------------------------------------------------------------------
  // GET /forecast/historical - Get historical spending data
  // --------------------------------------------------------------------------
  app.get(
    '/historical',
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Querystring: { months?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;
      const months = parseInt(request.query.months ?? '12', 10);

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      const historicalData = await forecastService.getHistoricalData(workspaceId, months);

      return reply.send(historicalData);
    }
  );

  // --------------------------------------------------------------------------
  // POST /forecast/generate - Generate new forecasts
  // --------------------------------------------------------------------------
  app.post(
    '/generate',
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Body: z.infer<typeof generateForecastBodySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'create');

      // Validate body
      const input = generateForecastBodySchema.parse(request.body ?? {});

      // Generate forecasts
      const forecasts = await forecastService.generateForecast(workspaceId, input.months);

      // Audit log
      await auditService.log({
        workspaceId,
        userId,
        action: 'forecast.generate',
        entityType: 'forecast',
        newValue: { months: input.months, forecastCount: forecasts.length },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      // Return forecasts with category info
      const forecastsWithCategories = await forecastService.getForecast(workspaceId);

      return reply.status(201).send(forecastsWithCategories);
    }
  );

  // --------------------------------------------------------------------------
  // GET /forecast/accuracy - Get forecast accuracy metrics
  // --------------------------------------------------------------------------
  app.get(
    '/accuracy',
    async (
      request: FastifyRequest<{ Params: { workspaceId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      const accuracy = await forecastService.getAccuracy(workspaceId);

      return reply.send(accuracy);
    }
  );

  // --------------------------------------------------------------------------
  // GET /forecast/summary - Get forecast summary for dashboard widget
  // --------------------------------------------------------------------------
  app.get(
    '/summary',
    async (
      request: FastifyRequest<{ Params: { workspaceId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      // Get next month's forecast
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const twoMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 3, 0);

      let forecasts = await forecastService.getForecast(
        workspaceId,
        nextMonth,
        twoMonthsAhead
      );

      // Generate if no forecasts exist
      if (forecasts.length === 0) {
        await forecastService.generateForecast(workspaceId, 6);
        forecasts = await forecastService.getForecast(
          workspaceId,
          nextMonth,
          twoMonthsAhead
        );
      }

      // Get total forecast (null categoryId)
      const totalForecast = forecasts.find((f) => f.categoryId === null);

      // Get top categories by predicted amount
      const categoryForecasts = forecasts
        .filter((f) => f.categoryId !== null)
        .sort((a, b) => b.predictedAmount.toNumber() - a.predictedAmount.toNumber())
        .slice(0, 5);

      // Get accuracy
      const accuracy = await forecastService.getAccuracy(workspaceId);

      return reply.send({
        nextMonth: {
          date: nextMonth,
          totalPredicted: totalForecast?.predictedAmount.toNumber() ?? 0,
          confidence: totalForecast?.confidence.toNumber() ?? 0,
          method: totalForecast?.method ?? 'average',
        },
        topCategories: categoryForecasts.map((f) => ({
          categoryId: f.categoryId,
          categoryName: f.category?.name ?? 'Inconnue',
          categoryIcon: f.category?.icon,
          categoryColor: f.category?.color,
          predictedAmount: f.predictedAmount.toNumber(),
          confidence: f.confidence.toNumber(),
        })),
        accuracy: accuracy.overall,
      });
    }
  );
}

export default forecastRoutes;
