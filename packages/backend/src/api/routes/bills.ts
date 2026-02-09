// ============================================================================
// BILL ROUTES - Finance Hub
// Bill Pay Reminders API
// ============================================================================

import type { FastifyPluginAsync } from 'fastify';
import { billService } from '@/modules/bills/bill.service.js';
import { auditService } from '@/modules/audit/audit.service.js';
import type { BillFrequency } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface BillParams {
  workspaceId: string;
  billId: string;
}

interface CreateBillBody {
  name: string;
  vendor?: string;
  amount: number;
  currency?: string;
  dueDate: string;
  frequency?: BillFrequency;
  categoryId?: string;
  reminderDays?: number;
  notes?: string;
}

interface UpdateBillBody {
  name?: string;
  vendor?: string | null;
  amount?: number;
  currency?: string;
  dueDate?: string;
  frequency?: BillFrequency;
  categoryId?: string | null;
  reminderDays?: number;
  notes?: string | null;
}

interface ListQuery {
  filter?: 'all' | 'unpaid' | 'paid' | 'overdue' | 'upcoming';
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  page?: string;
  pageSize?: string;
}

interface PayBillBody {
  transactionId?: string;
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

const billRoutes: FastifyPluginAsync = async (fastify) => {
  // ==========================================================================
  // List Bills
  // ==========================================================================

  /**
   * GET /workspaces/:workspaceId/bills
   * List all bills for a workspace
   */
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: ListQuery;
  }>('/', async (request, _reply) => {
    const { workspaceId } = request.params;
    const { filter, startDate, endDate, categoryId, page, pageSize } = request.query;

    const result = await billService.list(workspaceId, {
      filter,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      categoryId,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });

    return { data: result.data, meta: result.meta };
  });

  // ==========================================================================
  // Get Bill
  // ==========================================================================

  /**
   * GET /workspaces/:workspaceId/bills/:billId
   * Get a bill by ID
   */
  fastify.get<{ Params: BillParams }>('/:billId', async (request, reply) => {
    const { workspaceId, billId } = request.params;

    const bill = await billService.getById(billId, workspaceId);

    if (!bill) {
      return reply.status(404).send({ error: 'Facture non trouvee' });
    }

    return { data: bill };
  });

  // ==========================================================================
  // Create Bill
  // ==========================================================================

  /**
   * POST /workspaces/:workspaceId/bills
   * Create a new bill
   */
  fastify.post<{
    Params: { workspaceId: string };
    Body: CreateBillBody;
  }>('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    const { workspaceId } = request.params;
    const { name, vendor, amount, currency, dueDate, frequency, categoryId, reminderDays, notes } =
      request.body;

    // Validation
    if (!name?.trim()) {
      return reply.status(400).send({ error: 'Nom requis' });
    }
    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: 'Montant invalide' });
    }
    if (!dueDate) {
      return reply.status(400).send({ error: 'Date d\'echeance requise' });
    }
    if (frequency && !['once', 'weekly', 'monthly', 'yearly'].includes(frequency)) {
      return reply.status(400).send({ error: 'Frequence invalide' });
    }

    try {
      const bill = await billService.create({
        workspaceId,
        name,
        vendor,
        amount,
        currency,
        dueDate: new Date(dueDate),
        frequency,
        categoryId,
        reminderDays,
        notes,
      });

      await auditService.log({
        userId,
        workspaceId,
        action: 'bill.created',
        entityType: 'bill',
        entityId: bill.id,
        changes: { name, amount, dueDate },
        ipAddress: request.ip,
      });

      return reply.status(201).send({ data: bill });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Category not found') {
          return reply.status(404).send({ error: 'Categorie non trouvee' });
        }
      }
      throw error;
    }
  });

  // ==========================================================================
  // Update Bill
  // ==========================================================================

  /**
   * PATCH /workspaces/:workspaceId/bills/:billId
   * Update a bill
   */
  fastify.patch<{
    Params: BillParams;
    Body: UpdateBillBody;
  }>('/:billId', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    const { workspaceId, billId } = request.params;

    try {
      const bill = await billService.update(billId, workspaceId, {
        ...request.body,
        dueDate: request.body.dueDate ? new Date(request.body.dueDate) : undefined,
      });

      await auditService.log({
        userId,
        workspaceId,
        action: 'bill.updated',
        entityType: 'bill',
        entityId: billId,
        changes: request.body as unknown as Record<string, unknown>,
        ipAddress: request.ip,
      });

      return { data: bill };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Bill not found') {
          return reply.status(404).send({ error: 'Facture non trouvee' });
        }
        if (error.message === 'Category not found') {
          return reply.status(404).send({ error: 'Categorie non trouvee' });
        }
      }
      throw error;
    }
  });

  // ==========================================================================
  // Delete Bill
  // ==========================================================================

  /**
   * DELETE /workspaces/:workspaceId/bills/:billId
   * Soft delete a bill
   */
  fastify.delete<{ Params: BillParams }>('/:billId', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    const { workspaceId, billId } = request.params;

    try {
      await billService.delete(billId, workspaceId);

      await auditService.log({
        userId,
        workspaceId,
        action: 'bill.deleted',
        entityType: 'bill',
        entityId: billId,
        ipAddress: request.ip,
      });

      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.message === 'Bill not found') {
        return reply.status(404).send({ error: 'Facture non trouvee' });
      }
      throw error;
    }
  });

  // ==========================================================================
  // Mark Bill as Paid
  // ==========================================================================

  /**
   * POST /workspaces/:workspaceId/bills/:billId/pay
   * Mark a bill as paid
   */
  fastify.post<{
    Params: BillParams;
    Body: PayBillBody;
  }>('/:billId/pay', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    const { workspaceId, billId } = request.params;
    const { transactionId } = request.body;

    try {
      const bill = await billService.markPaid(billId, workspaceId, transactionId);

      await auditService.log({
        userId,
        workspaceId,
        action: 'bill.paid',
        entityType: 'bill',
        entityId: billId,
        changes: { transactionId },
        ipAddress: request.ip,
      });

      return { data: bill };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Bill not found') {
          return reply.status(404).send({ error: 'Facture non trouvee' });
        }
        if (error.message === 'Bill is already paid') {
          return reply.status(400).send({ error: 'Facture deja payee' });
        }
        if (error.message === 'Transaction not found') {
          return reply.status(404).send({ error: 'Transaction non trouvee' });
        }
      }
      throw error;
    }
  });

  // ==========================================================================
  // Mark Bill as Unpaid
  // ==========================================================================

  /**
   * POST /workspaces/:workspaceId/bills/:billId/unpay
   * Mark a bill as unpaid
   */
  fastify.post<{ Params: BillParams }>('/:billId/unpay', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifie' });
    }

    const { workspaceId, billId } = request.params;

    try {
      const bill = await billService.markUnpaid(billId, workspaceId);

      await auditService.log({
        userId,
        workspaceId,
        action: 'bill.unpaid',
        entityType: 'bill',
        entityId: billId,
        ipAddress: request.ip,
      });

      return { data: bill };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Bill not found') {
          return reply.status(404).send({ error: 'Facture non trouvee' });
        }
        if (error.message === 'Bill is not paid') {
          return reply.status(400).send({ error: 'Facture non payee' });
        }
      }
      throw error;
    }
  });

  // ==========================================================================
  // Get Upcoming Bills
  // ==========================================================================

  /**
   * GET /workspaces/:workspaceId/bills/upcoming
   * Get upcoming bills
   */
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: { days?: string; limit?: string };
  }>('/upcoming', async (request, _reply) => {
    const { workspaceId } = request.params;
    const days = request.query.days ? parseInt(request.query.days) : 30;
    const limit = request.query.limit ? parseInt(request.query.limit) : 10;

    const bills = await billService.getUpcoming(workspaceId, days, limit);

    return { data: bills };
  });

  // ==========================================================================
  // Get Overdue Bills
  // ==========================================================================

  /**
   * GET /workspaces/:workspaceId/bills/overdue
   * Get overdue bills
   */
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: { limit?: string };
  }>('/overdue', async (request, _reply) => {
    const { workspaceId } = request.params;
    const limit = request.query.limit ? parseInt(request.query.limit) : 50;

    const bills = await billService.getOverdue(workspaceId, limit);

    return { data: bills };
  });

  // ==========================================================================
  // Get Summary
  // ==========================================================================

  /**
   * GET /workspaces/:workspaceId/bills/summary
   * Get bills summary
   */
  fastify.get<{ Params: { workspaceId: string } }>('/summary', async (request, _reply) => {
    const { workspaceId } = request.params;

    const summary = await billService.getSummary(workspaceId);

    return { data: summary };
  });

  // ==========================================================================
  // Get Status Counts
  // ==========================================================================

  /**
   * GET /workspaces/:workspaceId/bills/counts
   * Get counts by status
   */
  fastify.get<{ Params: { workspaceId: string } }>('/counts', async (request, _reply) => {
    const { workspaceId } = request.params;

    const counts = await billService.getStatusCounts(workspaceId);

    return { data: counts };
  });

  // ==========================================================================
  // Get Calendar Data
  // ==========================================================================

  /**
   * GET /workspaces/:workspaceId/bills/calendar
   * Get bills for calendar view
   */
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: { startDate: string; endDate: string };
  }>('/calendar', async (request, reply) => {
    const { workspaceId } = request.params;
    const { startDate, endDate } = request.query;

    if (!startDate || !endDate) {
      return reply.status(400).send({ error: 'startDate et endDate requis' });
    }

    const bills = await billService.getCalendarData(
      workspaceId,
      new Date(startDate),
      new Date(endDate)
    );

    return { data: bills };
  });
};

export { billRoutes };
export default billRoutes;
