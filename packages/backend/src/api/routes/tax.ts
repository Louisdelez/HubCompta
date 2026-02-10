// ============================================================================
// TAX ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { taxService } from '@/modules/tax/tax.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { checkPermission } from '@/core/auth/rbac.js';
import { auditService } from '@/modules/audit/audit.service.js';

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------

const yearParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  year: z.string().transform((s) => parseInt(s, 10)),
});

const deductionParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  year: z.string().transform((s) => parseInt(s, 10)),
  dedId: z.string(),
});

const updateTaxYearSchema = z.object({
  status: z.enum(['open', 'filed', 'closed']).optional(),
  actualTax: z.number().min(0).optional(),
  notes: z.string().optional(),
});

const createDeductionSchema = z.object({
  category: z.enum(['professional', 'medical', 'charitable', 'other']),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  documentId: z.string().uuid().optional(),
});

// ----------------------------------------------------------------------------
// Route Handlers
// ----------------------------------------------------------------------------

export function taxRoutes(app: FastifyInstance): void {
  // Apply auth guard to all routes
  app.addHook('onRequest', authGuard);

  // --------------------------------------------------------------------------
  // GET /tax - List all tax years
  // --------------------------------------------------------------------------
  app.get(
    '/',
    async (request: FastifyRequest<{ Params: { workspaceId: string } }>, reply: FastifyReply) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      await checkPermission(userId, workspaceId, 'budget', 'read');

      const taxYears = await taxService.list(workspaceId);

      return reply.send({ success: true, data: taxYears });
    }
  );

  // --------------------------------------------------------------------------
  // GET /tax/brackets - Get tax brackets (French defaults)
  // --------------------------------------------------------------------------
  app.get(
    '/brackets',
    async (request: FastifyRequest<{ Params: { workspaceId: string } }>, reply: FastifyReply) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      await checkPermission(userId, workspaceId, 'budget', 'read');

      const brackets = taxService.getTaxBrackets();

      return reply.send({ success: true, data: brackets });
    }
  );

  // --------------------------------------------------------------------------
  // GET /tax/:year - Get tax year summary
  // --------------------------------------------------------------------------
  app.get(
    '/:year',
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; year: string } }>,
      reply: FastifyReply
    ) => {
      const params = yearParamsSchema.parse(request.params);
      const userId = request.user!.sub;

      await checkPermission(userId, params.workspaceId, 'budget', 'read');

      const summary = await taxService.getSummary(params.workspaceId, params.year);

      return reply.send({ success: true, data: summary });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /tax/:year - Update tax year
  // --------------------------------------------------------------------------
  app.patch(
    '/:year',
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string; year: string };
        Body: z.infer<typeof updateTaxYearSchema>;
      }>,
      reply: FastifyReply
    ) => {
      const params = yearParamsSchema.parse(request.params);
      const userId = request.user!.sub;

      await checkPermission(userId, params.workspaceId, 'budget', 'update');

      const input = updateTaxYearSchema.parse(request.body);

      // Get or create year first
      const taxYear = await taxService.getOrCreateYear(params.workspaceId, params.year);

      const updated = await taxService.update(params.workspaceId, taxYear.id, input);

      // Audit log
      await auditService.log({
        workspaceId: params.workspaceId,
        userId,
        action: 'tax_year.update',
        entityType: 'tax_year',
        entityId: taxYear.id,
        newValue: input,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.send({ success: true, data: updated });
    }
  );

  // --------------------------------------------------------------------------
  // GET /tax/:year/deductions - List deductions for a year
  // --------------------------------------------------------------------------
  app.get(
    '/:year/deductions',
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; year: string } }>,
      reply: FastifyReply
    ) => {
      const params = yearParamsSchema.parse(request.params);
      const userId = request.user!.sub;

      await checkPermission(userId, params.workspaceId, 'budget', 'read');

      const taxYear = await taxService.getOrCreateYear(params.workspaceId, params.year);
      const deductions = await taxService.listDeductions(params.workspaceId, taxYear.id);

      return reply.send({ success: true, data: deductions });
    }
  );

  // --------------------------------------------------------------------------
  // POST /tax/:year/deductions - Add deduction
  // --------------------------------------------------------------------------
  app.post(
    '/:year/deductions',
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string; year: string };
        Body: z.infer<typeof createDeductionSchema>;
      }>,
      reply: FastifyReply
    ) => {
      const params = yearParamsSchema.parse(request.params);
      const userId = request.user!.sub;

      await checkPermission(userId, params.workspaceId, 'budget', 'create');

      const input = createDeductionSchema.parse(request.body);

      const taxYear = await taxService.getOrCreateYear(params.workspaceId, params.year);
      const deduction = await taxService.addDeduction(params.workspaceId, taxYear.id, input);

      // Audit log
      await auditService.log({
        workspaceId: params.workspaceId,
        userId,
        action: 'tax_deduction.create',
        entityType: 'tax_deduction',
        entityId: deduction.id,
        newValue: { category: deduction.category, amount: deduction.amount },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.status(201).send({ success: true, data: deduction });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /tax/:year/deductions/:dedId - Remove deduction
  // --------------------------------------------------------------------------
  app.delete(
    '/:year/deductions/:dedId',
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string; year: string; dedId: string };
      }>,
      reply: FastifyReply
    ) => {
      const params = deductionParamsSchema.parse(request.params);
      const userId = request.user!.sub;

      await checkPermission(userId, params.workspaceId, 'budget', 'delete');

      const taxYear = await taxService.getOrCreateYear(params.workspaceId, params.year);
      await taxService.removeDeduction(params.workspaceId, taxYear.id, params.dedId);

      // Audit log
      await auditService.log({
        workspaceId: params.workspaceId,
        userId,
        action: 'tax_deduction.delete',
        entityType: 'tax_deduction',
        entityId: params.dedId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.status(204).send();
    }
  );

  // --------------------------------------------------------------------------
  // POST /tax/:year/calculate - Recalculate tax estimates
  // --------------------------------------------------------------------------
  app.post(
    '/:year/calculate',
    async (
      request: FastifyRequest<{ Params: { workspaceId: string; year: string } }>,
      reply: FastifyReply
    ) => {
      const params = yearParamsSchema.parse(request.params);
      const userId = request.user!.sub;

      await checkPermission(userId, params.workspaceId, 'budget', 'update');

      const taxYear = await taxService.getOrCreateYear(params.workspaceId, params.year);
      await taxService.recalculate(taxYear.id, params.workspaceId);

      // Audit log
      await auditService.log({
        workspaceId: params.workspaceId,
        userId,
        action: 'tax_year.calculate',
        entityType: 'tax_year',
        entityId: taxYear.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      // Return updated summary
      const summary = await taxService.getSummary(params.workspaceId, params.year);

      return reply.send({ success: true, data: summary });
    }
  );

  // --------------------------------------------------------------------------
  // POST /tax/:year/file - Mark tax year as filed
  // --------------------------------------------------------------------------
  app.post(
    '/:year/file',
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string; year: string };
        Body: { actualTax?: number };
      }>,
      reply: FastifyReply
    ) => {
      const params = yearParamsSchema.parse(request.params);
      const userId = request.user!.sub;

      await checkPermission(userId, params.workspaceId, 'budget', 'update');

      const taxYear = await taxService.getOrCreateYear(params.workspaceId, params.year);
      const actualTax = (request.body as { actualTax?: number })?.actualTax;
      const filed = await taxService.fileTax(params.workspaceId, taxYear.id, actualTax);

      // Audit log
      await auditService.log({
        workspaceId: params.workspaceId,
        userId,
        action: 'tax_year.file',
        entityType: 'tax_year',
        entityId: taxYear.id,
        newValue: { status: 'filed', actualTax },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.send({ success: true, data: filed });
    }
  );
}

export default taxRoutes;
