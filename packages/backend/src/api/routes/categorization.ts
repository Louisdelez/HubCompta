// ============================================================================
// CATEGORIZATION ROUTES - Finance Hub
// AI-powered transaction categorization
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { mlCategorizationService } from '@/modules/categorization/ml-categorization.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';
import { auditService } from '@/modules/audit/audit.service.js';

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------

const predictSchema = z.object({
  description: z.string().min(1).max(500),
  amount: z.number(),
  date: z.coerce.date().optional(),
});

const feedbackSchema = z.object({
  transactionId: z.string().uuid(),
  accepted: z.boolean(),
  actualCategoryId: z.string().uuid().optional(),
});

const autoCategorizeSchema = z.object({
  minConfidence: z.number().min(0).max(1).optional().default(0.8),
});

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export function categorizationRoutes(app: FastifyInstance): void {
  // Apply auth guard and workspace context
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // --------------------------------------------------------------------------
  // POST /categorization/predict - Predict category for transaction
  // --------------------------------------------------------------------------
  app.post<{
    Params: { workspaceId: string };
    Body: z.infer<typeof predictSchema>;
  }>(
    '/predict',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const input = predictSchema.parse(request.body);

      const prediction = await mlCategorizationService.predict(
        workspaceId,
        input.description,
        input.amount,
        input.date ?? new Date()
      );

      return reply.send({
        success: true,
        data: prediction,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /categorization/feedback - Submit feedback on prediction
  // --------------------------------------------------------------------------
  app.post<{
    Params: { workspaceId: string };
    Body: z.infer<typeof feedbackSchema>;
  }>(
    '/feedback',
    { preHandler: requirePermission('transaction:update') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const input = feedbackSchema.parse(request.body);

      await mlCategorizationService.processFeedback(
        workspaceId,
        input.transactionId,
        input.accepted,
        input.actualCategoryId
      );

      return reply.send({
        success: true,
        data: { message: 'Feedback recorded' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /categorization/train - Train model on historical data
  // --------------------------------------------------------------------------
  app.post<{ Params: { workspaceId: string } }>(
    '/train',
    { preHandler: requirePermission('workspace:update') },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const result = await mlCategorizationService.train(workspaceId);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: 'categorization.train',
        changes: result,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /categorization/auto - Auto-categorize uncategorized transactions
  // --------------------------------------------------------------------------
  app.post<{
    Params: { workspaceId: string };
    Body: z.infer<typeof autoCategorizeSchema>;
  }>(
    '/auto',
    { preHandler: requirePermission('transaction:update') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const input = autoCategorizeSchema.parse(request.body);

      const result = await mlCategorizationService.autoCategorize(
        workspaceId,
        input.minConfidence
      );

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: 'categorization.auto',
        changes: result,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /categorization/pending - Get pending predictions for review
  // --------------------------------------------------------------------------
  app.get<{
    Params: { workspaceId: string };
    Querystring: { minConfidence?: string; maxConfidence?: string };
  }>(
    '/pending',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const minConfidence = parseFloat(request.query.minConfidence ?? '0.5');
      const maxConfidence = parseFloat(request.query.maxConfidence ?? '0.8');

      const pending = await mlCategorizationService.getPendingPredictions(
        workspaceId,
        minConfidence,
        maxConfidence
      );

      return reply.send({
        success: true,
        data: pending,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /categorization/stats - Get categorization statistics
  // --------------------------------------------------------------------------
  app.get<{ Params: { workspaceId: string } }>(
    '/stats',
    { preHandler: requirePermission('transaction:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const stats = await mlCategorizationService.getStats(workspaceId);

      return reply.send({
        success: true,
        data: stats,
      });
    }
  );
}

export default categorizationRoutes;
