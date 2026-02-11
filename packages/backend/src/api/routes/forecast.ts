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
// OpenAPI Schemas
// ----------------------------------------------------------------------------

const workspaceParamsSchema = {
  type: 'object' as const,
  required: ['workspaceId'],
  properties: {
    workspaceId: { type: 'string' as const, format: 'uuid', description: 'Workspace ID' },
  },
};

const forecastSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const, format: 'uuid' },
    workspaceId: { type: 'string' as const, format: 'uuid' },
    categoryId: { type: 'string' as const, format: 'uuid', nullable: true },
    month: { type: 'string' as const, format: 'date-time' },
    predictedAmount: { type: 'number' as const },
    confidence: { type: 'number' as const, description: 'Confidence score (0-1)' },
    method: { type: 'string' as const, enum: ['average', 'trend', 'seasonal', 'ml'], description: 'Prediction method used' },
    category: {
      type: 'object' as const,
      nullable: true,
      properties: {
        id: { type: 'string' as const, format: 'uuid' },
        name: { type: 'string' as const },
        icon: { type: 'string' as const, nullable: true },
        color: { type: 'string' as const, nullable: true },
      },
    },
    createdAt: { type: 'string' as const, format: 'date-time' },
    updatedAt: { type: 'string' as const, format: 'date-time' },
  },
};

const successResponseSchema = (dataSchema: object) => ({
  type: 'object' as const,
  properties: {
    success: { type: 'boolean' as const, enum: [true] },
    data: dataSchema,
  },
});

const errorResponseSchema = {
  type: 'object' as const,
  properties: {
    success: { type: 'boolean' as const, enum: [false] },
    error: {
      type: 'object' as const,
      properties: {
        message: { type: 'string' as const },
        code: { type: 'string' as const },
      },
    },
  },
};

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
    {
      schema: {
        summary: 'Get forecasts',
        description: 'Retrieve spending forecasts for a workspace. Automatically generates forecasts if none exist.',
        tags: ['Forecast'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        querystring: {
          type: 'object' as const,
          properties: {
            months: { type: 'string' as const, pattern: '^[0-9]+$', default: '6', description: 'Number of months to forecast' },
            startMonth: { type: 'string' as const, format: 'date-time', description: 'Start of forecast period' },
            endMonth: { type: 'string' as const, format: 'date-time', description: 'End of forecast period' },
          },
        },
        response: {
          200: successResponseSchema({ type: 'array' as const, items: forecastSchema }),
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
        await forecastService.generateForecast(workspaceId, query.months);

        // Return the generated forecasts with category info
        const forecastsWithCategories = await forecastService.getForecast(
          workspaceId,
          query.startMonth,
          query.endMonth
        );

        return reply.send({ success: true, data: forecastsWithCategories });
      }

      return reply.send({ success: true, data: forecasts });
    }
  );

  // --------------------------------------------------------------------------
  // GET /forecast/historical - Get historical spending data
  // --------------------------------------------------------------------------
  app.get(
    '/historical',
    {
      schema: {
        summary: 'Get historical spending data',
        description: 'Retrieve historical spending data used for forecast calculations.',
        tags: ['Forecast'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        querystring: {
          type: 'object' as const,
          properties: {
            months: { type: 'string' as const, pattern: '^[0-9]+$', default: '12', description: 'Number of months of history' },
          },
        },
        response: {
          200: successResponseSchema({
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                month: { type: 'string' as const, format: 'date' },
                categoryId: { type: 'string' as const, format: 'uuid', nullable: true },
                categoryName: { type: 'string' as const, nullable: true },
                amount: { type: 'number' as const },
                transactionCount: { type: 'integer' as const },
              },
            },
          }),
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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

      return reply.send({ success: true, data: historicalData });
    }
  );

  // --------------------------------------------------------------------------
  // POST /forecast/generate - Generate new forecasts
  // --------------------------------------------------------------------------
  app.post(
    '/generate',
    {
      schema: {
        summary: 'Generate new forecasts',
        description: 'Generate or regenerate spending forecasts based on historical data.',
        tags: ['Forecast'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        body: {
          type: 'object' as const,
          properties: {
            months: { type: 'integer' as const, minimum: 1, maximum: 24, default: 6, description: 'Number of months to forecast' },
          },
        },
        response: {
          201: successResponseSchema({ type: 'array' as const, items: forecastSchema }),
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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

      return reply.status(201).send({ success: true, data: forecastsWithCategories });
    }
  );

  // --------------------------------------------------------------------------
  // GET /forecast/accuracy - Get forecast accuracy metrics
  // --------------------------------------------------------------------------
  app.get(
    '/accuracy',
    {
      schema: {
        summary: 'Get forecast accuracy metrics',
        description: 'Retrieve accuracy metrics comparing past forecasts to actual spending.',
        tags: ['Forecast'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        response: {
          200: successResponseSchema({
            type: 'object' as const,
            properties: {
              overall: { type: 'number' as const, description: 'Overall accuracy percentage (0-100)' },
              byCategory: {
                type: 'array' as const,
                items: {
                  type: 'object' as const,
                  properties: {
                    categoryId: { type: 'string' as const, format: 'uuid' },
                    categoryName: { type: 'string' as const },
                    accuracy: { type: 'number' as const },
                    sampleSize: { type: 'integer' as const },
                  },
                },
              },
              byMonth: {
                type: 'array' as const,
                items: {
                  type: 'object' as const,
                  properties: {
                    month: { type: 'string' as const, format: 'date' },
                    accuracy: { type: 'number' as const },
                    predicted: { type: 'number' as const },
                    actual: { type: 'number' as const },
                  },
                },
              },
            },
          }),
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { workspaceId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      // Check permission
      await checkPermission(userId, workspaceId, 'budget', 'read');

      const accuracy = await forecastService.getAccuracy(workspaceId);

      return reply.send({ success: true, data: accuracy });
    }
  );

  // --------------------------------------------------------------------------
  // GET /forecast/summary - Get forecast summary for dashboard widget
  // --------------------------------------------------------------------------
  app.get(
    '/summary',
    {
      schema: {
        summary: 'Get forecast summary',
        description: 'Get a summary of forecasts for the next month, optimized for dashboard widgets.',
        tags: ['Forecast'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        response: {
          200: successResponseSchema({
            type: 'object' as const,
            properties: {
              nextMonth: {
                type: 'object' as const,
                properties: {
                  date: { type: 'string' as const, format: 'date-time' },
                  totalPredicted: { type: 'number' as const },
                  confidence: { type: 'number' as const },
                  method: { type: 'string' as const },
                },
              },
              topCategories: {
                type: 'array' as const,
                items: {
                  type: 'object' as const,
                  properties: {
                    categoryId: { type: 'string' as const, format: 'uuid' },
                    categoryName: { type: 'string' as const },
                    categoryIcon: { type: 'string' as const, nullable: true },
                    categoryColor: { type: 'string' as const, nullable: true },
                    predictedAmount: { type: 'number' as const },
                    confidence: { type: 'number' as const },
                  },
                },
              },
              accuracy: { type: 'number' as const },
            },
          }),
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
        success: true,
        data: {
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
        },
      });
    }
  );
}

export default forecastRoutes;
