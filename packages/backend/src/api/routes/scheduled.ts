// ============================================================================
// SCHEDULED TRANSACTION ROUTES - Finance Hub
// One-time future transactions management API
// ============================================================================

import type { FastifyPluginAsync } from 'fastify';
import { scheduledService } from '@/modules/scheduled/index.js';
import { auditService } from '@/modules/audit/audit.service.js';
import type { TransactionType } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ScheduledParams {
  workspaceId: string;
  schedId: string;
}

interface CreateScheduledBody {
  accountId: string;
  categoryId?: string;
  amount: number;
  currency?: string;
  type: TransactionType;
  description: string;
  scheduledDate: string;
  notes?: string;
}

interface UpdateScheduledBody {
  accountId?: string;
  categoryId?: string | null;
  amount?: number;
  currency?: string;
  type?: TransactionType;
  description?: string;
  scheduledDate?: string;
  notes?: string | null;
}

interface ListQuery {
  filter?: 'all' | 'upcoming' | 'executed';
  startDate?: string;
  endDate?: string;
  page?: string;
  pageSize?: string;
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

const scheduledRoutes: FastifyPluginAsync = async (fastify) => {
  // ==========================================================================
  // List Scheduled Transactions
  // ==========================================================================

  /**
   * GET /workspaces/:workspaceId/scheduled
   * List all scheduled transactions for a workspace
   */
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: ListQuery;
  }>('/', async (request, _reply) => {
    const { workspaceId } = request.params;
    const { filter, startDate, endDate, page, pageSize } = request.query;

    const result = await scheduledService.list(workspaceId, {
      filter,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });

    return { data: result.data, meta: result.meta };
  });

  // ==========================================================================
  // Get Scheduled Transaction
  // ==========================================================================

  /**
   * GET /workspaces/:workspaceId/scheduled/:schedId
   * Get a scheduled transaction by ID
   */
  fastify.get<{ Params: ScheduledParams }>('/:schedId', async (request, reply) => {
    const { workspaceId, schedId } = request.params;

    const scheduled = await scheduledService.getById(schedId, workspaceId);

    if (!scheduled) {
      return reply.status(404).send({ error: 'Transaction programmee non trouvee' });
    }

    return { data: scheduled };
  });

  // ==========================================================================
  // Create Scheduled Transaction
  // ==========================================================================

  /**
   * POST /workspaces/:workspaceId/scheduled
   * Create a new scheduled transaction
   */
  fastify.post<{
    Params: { workspaceId: string };
    Body: CreateScheduledBody;
  }>('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    const { workspaceId } = request.params;
    const { accountId, categoryId, amount, currency, type, description, scheduledDate, notes } =
      request.body;

    // Validation
    if (!accountId) {
      return reply.status(400).send({ error: 'accountId est requis' });
    }
    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: 'Montant invalide' });
    }
    if (!description?.trim()) {
      return reply.status(400).send({ error: 'Description requise' });
    }
    if (!scheduledDate) {
      return reply.status(400).send({ error: 'Date programmee requise' });
    }
    if (!type || !['income', 'expense', 'transfer'].includes(type)) {
      return reply.status(400).send({ error: 'Type de transaction invalide' });
    }

    try {
      const scheduled = await scheduledService.create({
        workspaceId,
        accountId,
        categoryId,
        amount,
        currency,
        type,
        description,
        scheduledDate: new Date(scheduledDate),
        notes,
      });

      await auditService.log({
        userId,
        workspaceId,
        action: 'scheduled.created',
        entityType: 'scheduled_transaction',
        entityId: scheduled.id,
        changes: { description, amount, scheduledDate },
        ipAddress: request.ip,
      });

      return reply.status(201).send({ data: scheduled });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Account not found') {
          return reply.status(404).send({ error: 'Compte non trouve' });
        }
        if (error.message === 'Category not found') {
          return reply.status(404).send({ error: 'Categorie non trouvee' });
        }
        if (error.message === 'Scheduled date must be in the future') {
          return reply.status(400).send({ error: 'La date doit etre dans le futur' });
        }
      }
      throw error;
    }
  });

  // ==========================================================================
  // Update Scheduled Transaction
  // ==========================================================================

  /**
   * PATCH /workspaces/:workspaceId/scheduled/:schedId
   * Update a scheduled transaction
   */
  fastify.patch<{
    Params: ScheduledParams;
    Body: UpdateScheduledBody;
  }>('/:schedId', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    const { workspaceId, schedId } = request.params;

    try {
      const scheduled = await scheduledService.update(schedId, workspaceId, {
        ...request.body,
        scheduledDate: request.body.scheduledDate
          ? new Date(request.body.scheduledDate)
          : undefined,
      });

      await auditService.log({
        userId,
        workspaceId,
        action: 'scheduled.updated',
        entityType: 'scheduled_transaction',
        entityId: schedId,
        changes: request.body as unknown as Record<string, unknown>,
        ipAddress: request.ip,
      });

      return { data: scheduled };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Scheduled transaction not found') {
          return reply.status(404).send({ error: 'Transaction programmee non trouvee' });
        }
        if (error.message === 'Cannot update an executed scheduled transaction') {
          return reply.status(400).send({ error: 'Impossible de modifier une transaction deja executee' });
        }
        if (error.message === 'Account not found') {
          return reply.status(404).send({ error: 'Compte non trouve' });
        }
        if (error.message === 'Category not found') {
          return reply.status(404).send({ error: 'Categorie non trouvee' });
        }
        if (error.message === 'Scheduled date must be in the future') {
          return reply.status(400).send({ error: 'La date doit etre dans le futur' });
        }
      }
      throw error;
    }
  });

  // ==========================================================================
  // Delete Scheduled Transaction
  // ==========================================================================

  /**
   * DELETE /workspaces/:workspaceId/scheduled/:schedId
   * Delete a scheduled transaction
   */
  fastify.delete<{ Params: ScheduledParams }>('/:schedId', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    const { workspaceId, schedId } = request.params;

    try {
      await scheduledService.delete(schedId, workspaceId);

      await auditService.log({
        userId,
        workspaceId,
        action: 'scheduled.deleted',
        entityType: 'scheduled_transaction',
        entityId: schedId,
        ipAddress: request.ip,
      });

      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.message === 'Scheduled transaction not found') {
        return reply.status(404).send({ error: 'Transaction programmee non trouvee' });
      }
      throw error;
    }
  });

  // ==========================================================================
  // Execute Scheduled Transaction Now
  // ==========================================================================

  /**
   * POST /workspaces/:workspaceId/scheduled/:schedId/execute
   * Execute a scheduled transaction immediately
   */
  fastify.post<{ Params: ScheduledParams }>('/:schedId/execute', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    const { workspaceId, schedId } = request.params;

    try {
      const result = await scheduledService.execute(schedId, workspaceId);

      await auditService.log({
        userId,
        workspaceId,
        action: 'scheduled.executed',
        entityType: 'scheduled_transaction',
        entityId: schedId,
        changes: { transactionId: result.transaction.id },
        ipAddress: request.ip,
      });

      return { data: result };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Scheduled transaction not found') {
          return reply.status(404).send({ error: 'Transaction programmee non trouvee' });
        }
        if (error.message === 'Scheduled transaction already executed') {
          return reply.status(400).send({ error: 'Transaction deja executee' });
        }
      }
      throw error;
    }
  });

  // ==========================================================================
  // Get Upcoming Summary
  // ==========================================================================

  /**
   * GET /workspaces/:workspaceId/scheduled/upcoming
   * Get upcoming scheduled transactions summary
   */
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: { days?: string; limit?: string };
  }>('/upcoming', async (request, _reply) => {
    const { workspaceId } = request.params;
    const days = request.query.days ? parseInt(request.query.days) : 30;
    const limit = request.query.limit ? parseInt(request.query.limit) : 10;

    const scheduled = await scheduledService.getUpcoming(workspaceId, days, limit);

    return { data: scheduled };
  });

  // ==========================================================================
  // Get Summary
  // ==========================================================================

  /**
   * GET /workspaces/:workspaceId/scheduled/summary
   * Get summary of upcoming scheduled transactions
   */
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: { days?: string };
  }>('/summary', async (request, _reply) => {
    const { workspaceId } = request.params;
    const days = request.query.days ? parseInt(request.query.days) : 30;

    const summary = await scheduledService.getUpcomingSummary(workspaceId, days);

    return { data: summary };
  });

  // ==========================================================================
  // Get Status Counts
  // ==========================================================================

  /**
   * GET /workspaces/:workspaceId/scheduled/counts
   * Get counts by status
   */
  fastify.get<{ Params: { workspaceId: string } }>('/counts', async (request, _reply) => {
    const { workspaceId } = request.params;

    const counts = await scheduledService.getStatusCounts(workspaceId);

    return { data: counts };
  });
};

export { scheduledRoutes };
export default scheduledRoutes;
