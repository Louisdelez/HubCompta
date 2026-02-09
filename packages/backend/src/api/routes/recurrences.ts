// ============================================================================
// RECURRENCE ROUTES - Finance Hub
// Recurring transactions management API
// ============================================================================

import type { FastifyPluginAsync } from 'fastify';
import { recurrenceService } from '@/modules/recurrences/index.js';
import { auditService } from '@/modules/audit/audit.service.js';
import type { RecurrenceFreq } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface RecurrenceParams {
  workspaceId: string;
  recurrenceId: string;
}

interface CreateRecurrenceBody {
  name: string;
  frequency: RecurrenceFreq;
  interval?: number;
  dayOfMonth?: number;
  dayOfWeek?: number;
  template: {
    accountId: string;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    categoryId?: string;
    tags?: string[];
    notes?: string;
  };
  startAt: string;
  endAt?: string;
}

interface UpdateRecurrenceBody {
  name?: string;
  frequency?: RecurrenceFreq;
  interval?: number;
  dayOfMonth?: number;
  dayOfWeek?: number;
  template?: {
    accountId?: string;
    type?: 'income' | 'expense';
    amount?: number;
    description?: string;
    categoryId?: string;
    tags?: string[];
    notes?: string;
  };
  endAt?: string | null;
  isActive?: boolean;
}

interface ListQuery {
  isActive?: string;
  page?: string;
  pageSize?: string;
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

const recurrenceRoutes: FastifyPluginAsync = async (fastify) => {
  // ==========================================================================
  // List Recurrences
  // ==========================================================================

  /**
   * GET /workspaces/:workspaceId/recurrences
   * List all recurrences for a workspace
   */
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: ListQuery;
  }>('/', async (request, _reply) => {
    const { workspaceId } = request.params;
    const { isActive, page, pageSize } = request.query;

    const result = await recurrenceService.list(workspaceId, {
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });

    return { data: result.data, meta: result.meta };
  });

  // ==========================================================================
  // Get Recurrence
  // ==========================================================================

  /**
   * GET /workspaces/:workspaceId/recurrences/:recurrenceId
   * Get a recurrence by ID
   */
  fastify.get<{ Params: RecurrenceParams }>('/:recurrenceId', async (request, reply) => {
    const { workspaceId, recurrenceId } = request.params;

    const recurrence = await recurrenceService.getById(recurrenceId, workspaceId);

    if (!recurrence) {
      return reply.status(404).send({ error: 'Recurrence non trouvee' });
    }

    return { data: recurrence };
  });

  // ==========================================================================
  // Create Recurrence
  // ==========================================================================

  /**
   * POST /workspaces/:workspaceId/recurrences
   * Create a new recurrence
   */
  fastify.post<{
    Params: { workspaceId: string };
    Body: CreateRecurrenceBody;
  }>('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    const { workspaceId } = request.params;
    const { name, frequency, interval, dayOfMonth, dayOfWeek, template, startAt, endAt } =
      request.body;

    // Validate template
    if (!template.accountId || !template.type || !template.amount || !template.description) {
      return reply.status(400).send({
        error: 'Template invalide',
        message: 'accountId, type, amount et description sont requis',
      });
    }

    const recurrence = await recurrenceService.create({
      workspaceId,
      name,
      frequency,
      interval,
      dayOfMonth,
      dayOfWeek,
      template,
      startAt: new Date(startAt),
      endAt: endAt ? new Date(endAt) : undefined,
    });

    await auditService.log({
      userId,
      workspaceId,
      action: 'recurrence.created',
      entityType: 'recurrence',
      entityId: recurrence.id,
      changes: { name, frequency, template },
      ipAddress: request.ip,
    });

    return reply.status(201).send({ data: recurrence });
  });

  // ==========================================================================
  // Update Recurrence
  // ==========================================================================

  /**
   * PATCH /workspaces/:workspaceId/recurrences/:recurrenceId
   * Update a recurrence
   */
  fastify.patch<{
    Params: RecurrenceParams;
    Body: UpdateRecurrenceBody;
  }>('/:recurrenceId', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    const { workspaceId, recurrenceId } = request.params;

    try {
      const recurrence = await recurrenceService.update(recurrenceId, workspaceId, {
        ...request.body,
        endAt: request.body.endAt === null ? null : request.body.endAt ? new Date(request.body.endAt) : undefined,
      });

      await auditService.log({
        userId,
        workspaceId,
        action: 'recurrence.updated',
        entityType: 'recurrence',
        entityId: recurrenceId,
        changes: request.body as unknown as Record<string, unknown>,
        ipAddress: request.ip,
      });

      return { data: recurrence };
    } catch (error) {
      if (error instanceof Error && error.message === 'Recurrence not found') {
        return reply.status(404).send({ error: 'Recurrence non trouvee' });
      }
      throw error;
    }
  });

  // ==========================================================================
  // Delete Recurrence
  // ==========================================================================

  /**
   * DELETE /workspaces/:workspaceId/recurrences/:recurrenceId
   * Delete a recurrence
   */
  fastify.delete<{ Params: RecurrenceParams }>('/:recurrenceId', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    const { workspaceId, recurrenceId } = request.params;

    try {
      await recurrenceService.delete(recurrenceId, workspaceId);

      await auditService.log({
        userId,
        workspaceId,
        action: 'recurrence.deleted',
        entityType: 'recurrence',
        entityId: recurrenceId,
        ipAddress: request.ip,
      });

      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.message === 'Recurrence not found') {
        return reply.status(404).send({ error: 'Recurrence non trouvee' });
      }
      throw error;
    }
  });

  // ==========================================================================
  // Pause Recurrence
  // ==========================================================================

  /**
   * POST /workspaces/:workspaceId/recurrences/:recurrenceId/pause
   * Pause a recurrence
   */
  fastify.post<{ Params: RecurrenceParams }>('/:recurrenceId/pause', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    const { workspaceId, recurrenceId } = request.params;

    try {
      const recurrence = await recurrenceService.pause(recurrenceId, workspaceId);

      await auditService.log({
        userId,
        workspaceId,
        action: 'recurrence.paused',
        entityType: 'recurrence',
        entityId: recurrenceId,
        ipAddress: request.ip,
      });

      return { data: recurrence };
    } catch (error) {
      if (error instanceof Error && error.message === 'Recurrence not found') {
        return reply.status(404).send({ error: 'Recurrence non trouvee' });
      }
      throw error;
    }
  });

  // ==========================================================================
  // Resume Recurrence
  // ==========================================================================

  /**
   * POST /workspaces/:workspaceId/recurrences/:recurrenceId/resume
   * Resume a paused recurrence
   */
  fastify.post<{ Params: RecurrenceParams }>('/:recurrenceId/resume', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    const { workspaceId, recurrenceId } = request.params;

    try {
      const recurrence = await recurrenceService.resume(recurrenceId, workspaceId);

      await auditService.log({
        userId,
        workspaceId,
        action: 'recurrence.resumed',
        entityType: 'recurrence',
        entityId: recurrenceId,
        ipAddress: request.ip,
      });

      return { data: recurrence };
    } catch (error) {
      if (error instanceof Error && error.message === 'Recurrence not found') {
        return reply.status(404).send({ error: 'Recurrence non trouvee' });
      }
      throw error;
    }
  });

  // ==========================================================================
  // Skip Next Occurrence
  // ==========================================================================

  /**
   * POST /workspaces/:workspaceId/recurrences/:recurrenceId/skip
   * Skip the next occurrence
   */
  fastify.post<{ Params: RecurrenceParams }>('/:recurrenceId/skip', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    const { workspaceId, recurrenceId } = request.params;

    try {
      const recurrence = await recurrenceService.skipNext(recurrenceId, workspaceId);

      await auditService.log({
        userId,
        workspaceId,
        action: 'recurrence.skipped',
        entityType: 'recurrence',
        entityId: recurrenceId,
        ipAddress: request.ip,
      });

      return { data: recurrence };
    } catch (error) {
      if (error instanceof Error && error.message === 'Recurrence not found') {
        return reply.status(404).send({ error: 'Recurrence non trouvee' });
      }
      throw error;
    }
  });

  // ==========================================================================
  // Execute Now
  // ==========================================================================

  /**
   * POST /workspaces/:workspaceId/recurrences/:recurrenceId/execute
   * Execute a recurrence immediately
   */
  fastify.post<{ Params: RecurrenceParams }>('/:recurrenceId/execute', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    const { workspaceId, recurrenceId } = request.params;

    // Verify recurrence belongs to workspace
    const recurrence = await recurrenceService.getById(recurrenceId, workspaceId);
    if (!recurrence) {
      return reply.status(404).send({ error: 'Recurrence non trouvee' });
    }

    const transaction = await recurrenceService.execute(recurrenceId);

    if (!transaction) {
      return reply.status(400).send({
        error: 'Execution impossible',
        message: 'La recurrence est inactive ou terminee',
      });
    }

    await auditService.log({
      userId,
      workspaceId,
      action: 'recurrence.executed',
      entityType: 'recurrence',
      entityId: recurrenceId,
      changes: { transactionId: transaction.id },
      ipAddress: request.ip,
    });

    return { data: { transaction } };
  });

  // ==========================================================================
  // Get Upcoming Occurrences
  // ==========================================================================

  /**
   * GET /workspaces/:workspaceId/recurrences/:recurrenceId/upcoming
   * Get preview of upcoming occurrences
   */
  fastify.get<{
    Params: RecurrenceParams;
    Querystring: { count?: string };
  }>('/:recurrenceId/upcoming', async (request, _reply) => {
    const { workspaceId, recurrenceId } = request.params;
    const count = request.query.count ? parseInt(request.query.count) : 5;

    const dates = await recurrenceService.getUpcomingOccurrences(
      recurrenceId,
      workspaceId,
      Math.min(count, 12)
    );

    return { data: dates };
  });

  // ==========================================================================
  // Monthly Forecast
  // ==========================================================================

  /**
   * GET /workspaces/:workspaceId/recurrences/forecast
   * Get monthly forecast based on recurring transactions
   */
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: { month?: string };
  }>('/forecast', async (request, _reply) => {
    const { workspaceId } = request.params;
    const month = request.query.month ? new Date(request.query.month) : new Date();

    const forecast = await recurrenceService.getMonthlyForecast(workspaceId, month);

    return { data: forecast };
  });
};

export { recurrenceRoutes };
export default recurrenceRoutes;
