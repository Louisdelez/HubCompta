// ============================================================================
// LOAN ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { loanService } from '@/modules/loans/loan.service.js';
import { auditService, AUDIT_ACTIONS } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';
import { loanCreateSchema, loanUpdateSchema, loanPaymentCreateSchema, loanQuerySchema } from '@finance-hub/shared';
import type { LoanType } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WorkspaceParams {
  workspaceId: string;
}

interface LoanParams extends WorkspaceParams {
  loanId: string;
}

interface PaymentParams extends LoanParams {
  paymentId: string;
}

interface LoanQuery {
  type?: LoanType;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export function loanRoutes(app: FastifyInstance): void {
  // Apply auth guard and workspace context to all routes
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/loans - List loans
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: LoanQuery }>(
    '/',
    { preHandler: requirePermission('account:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const query = loanQuerySchema.parse(request.query);

      const loans = await loanService.list(workspaceId, {
        type: query.type,
        includeDeleted: query.includeDeleted,
      });

      return reply.send({
        success: true,
        data: loans,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/loans/summary - Get loan summary
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams }>(
    '/summary',
    { preHandler: requirePermission('account:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const summary = await loanService.getSummary(workspaceId);

      return reply.send({
        success: true,
        data: summary,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/loans/debt-free-date - Get projected debt-free date
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams }>(
    '/debt-free-date',
    { preHandler: requirePermission('account:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const debtFreeData = await loanService.getDebtFreeDate(workspaceId);

      return reply.send({
        success: true,
        data: debtFreeData,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/loans/debt-summary - Get comprehensive debt summary
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams }>(
    '/debt-summary',
    { preHandler: requirePermission('account:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const summary = await loanService.getDebtSummary(workspaceId);

      return reply.send({
        success: true,
        data: summary,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/loans - Create loan
  // --------------------------------------------------------------------------
  app.post<{ Params: WorkspaceParams }>(
    '/',
    { preHandler: requirePermission('account:create') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const input = loanCreateSchema.parse(request.body);

      const loan = await loanService.create(workspaceId, {
        ...input,
        interestRate: input.interestRate ?? null,
        counterparty: input.counterparty ?? null,
        notes: input.notes ?? null,
        endDate: input.endDate ?? null,
      });

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.LOAN_CREATED,
        entityType: 'loan',
        entityId: loan.id,
        changes: { name: loan.name, type: loan.type, principalAmount: loan.principalAmount },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: loan,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/loans/:loanId - Get loan details
  // --------------------------------------------------------------------------
  app.get<{ Params: LoanParams }>(
    '/:loanId',
    { preHandler: requirePermission('account:read') },
    async (request, reply) => {
      const { workspaceId, loanId } = request.params;

      const loan = await loanService.getById(workspaceId, loanId);

      if (!loan) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Loan not found', code: 'NOT_FOUND' },
        });
      }

      return reply.send({
        success: true,
        data: loan,
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /workspaces/:workspaceId/loans/:loanId - Update loan
  // --------------------------------------------------------------------------
  app.patch<{ Params: LoanParams }>(
    '/:loanId',
    { preHandler: requirePermission('account:update') },
    async (request, reply) => {
      const { workspaceId, loanId } = request.params;
      const input = loanUpdateSchema.parse(request.body);

      const loan = await loanService.update(workspaceId, loanId, input);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.LOAN_UPDATED,
        entityType: 'loan',
        entityId: loanId,
        changes: input,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: loan,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /workspaces/:workspaceId/loans/:loanId - Soft delete loan
  // --------------------------------------------------------------------------
  app.delete<{ Params: LoanParams }>(
    '/:loanId',
    { preHandler: requirePermission('account:delete') },
    async (request, reply) => {
      const { workspaceId, loanId } = request.params;

      await loanService.delete(workspaceId, loanId);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.LOAN_DELETED,
        entityType: 'loan',
        entityId: loanId,
        ipAddress: request.ip,
        severity: 'warning',
      });

      return reply.send({
        success: true,
        data: { message: 'Loan deleted' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/loans/:loanId/payments - Add payment
  // --------------------------------------------------------------------------
  app.post<{ Params: LoanParams }>(
    '/:loanId/payments',
    { preHandler: requirePermission('account:update') },
    async (request, reply) => {
      const { workspaceId, loanId } = request.params;
      const input = loanPaymentCreateSchema.parse(request.body);

      const loan = await loanService.addPayment(workspaceId, loanId, {
        ...input,
        notes: input.notes ?? null,
      });

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.LOAN_PAYMENT_ADDED,
        entityType: 'loan',
        entityId: loanId,
        changes: { amount: input.amount, principal: input.principal, interest: input.interest },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: loan,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /workspaces/:workspaceId/loans/:loanId/payments/:paymentId - Delete payment
  // --------------------------------------------------------------------------
  app.delete<{ Params: PaymentParams }>(
    '/:loanId/payments/:paymentId',
    { preHandler: requirePermission('account:update') },
    async (request, reply) => {
      const { workspaceId, loanId, paymentId } = request.params;

      const loan = await loanService.deletePayment(workspaceId, loanId, paymentId);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.LOAN_PAYMENT_DELETED,
        entityType: 'loan_payment',
        entityId: paymentId,
        changes: { loanId },
        ipAddress: request.ip,
        severity: 'warning',
      });

      return reply.send({
        success: true,
        data: loan,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/loans/:loanId/simulate - Simulate extra payment
  // --------------------------------------------------------------------------
  app.post<{ Params: LoanParams; Body: { extraAmount: number; paymentType?: 'monthly' | 'one_time' } }>(
    '/:loanId/simulate',
    { preHandler: requirePermission('account:read') },
    async (request, reply) => {
      const { workspaceId, loanId } = request.params;
      const { extraAmount, paymentType = 'monthly' } = request.body;

      const simulation = await loanService.simulateExtraPayment(
        workspaceId,
        loanId,
        extraAmount,
        paymentType
      );

      return reply.send({
        success: true,
        data: simulation,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/loans/:loanId/amortization - Get amortization schedule
  // --------------------------------------------------------------------------
  app.get<{ Params: LoanParams }>(
    '/:loanId/amortization',
    { preHandler: requirePermission('account:read') },
    async (request, reply) => {
      const { workspaceId, loanId } = request.params;

      const schedule = await loanService.generateAmortizationSchedule(workspaceId, loanId);

      return reply.send({
        success: true,
        data: schedule,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/loans/:loanId/interest - Get total interest calculation
  // --------------------------------------------------------------------------
  app.get<{ Params: LoanParams }>(
    '/:loanId/interest',
    { preHandler: requirePermission('account:read') },
    async (request, reply) => {
      const { workspaceId, loanId } = request.params;

      const interestData = await loanService.calculateTotalInterest(workspaceId, loanId);

      return reply.send({
        success: true,
        data: interestData,
      });
    }
  );
}

export default loanRoutes;
