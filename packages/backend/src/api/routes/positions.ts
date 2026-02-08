// ============================================================================
// POSITION ROUTES - Finance Hub
// Investment position management
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { positionService } from '@/modules/invest/position.service.js';
import { assetService } from '@/modules/invest/asset.service.js';
import { auditService, AUDIT_ACTIONS } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';
import { positionCreateSchema, investTransactionCreateSchema } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export async function positionRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth guard and workspace context to all routes
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // --------------------------------------------------------------------------
  // GET /positions - List positions
  // --------------------------------------------------------------------------
  app.get(
    '/',
    { preHandler: [requirePermission('transaction:read')] },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Querystring: { accountId?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const { accountId } = request.query;

      const positions = await positionService.list(workspaceId, accountId);

      return reply.send({
        success: true,
        data: positions,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /positions/:id - Get position details
  // --------------------------------------------------------------------------
  app.get(
    '/:id',
    { preHandler: [requirePermission('transaction:read')] },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string; id: string };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;

      const position = await positionService.getById(workspaceId, id);

      if (!position) {
        return reply.status(404).send({
          success: false,
          error: 'Position non trouvée',
        });
      }

      return reply.send({
        success: true,
        data: position,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /positions - Create/open a position
  // --------------------------------------------------------------------------
  app.post(
    '/',
    { preHandler: [requirePermission('transaction:create')] },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const input = positionCreateSchema.parse(request.body);

      // Get or create asset
      const asset = await assetService.getOrCreate(input.assetId);
      if (!asset) {
        return reply.status(404).send({
          success: false,
          error: 'Asset non trouvé',
        });
      }

      const position = await positionService.openPosition(
        workspaceId,
        input.accountId,
        asset.symbol,
        input.quantity,
        input.price,
        input.date,
        input.fees
      );

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.POSITION_OPENED,
        entityType: 'position',
        entityId: position.id,
        changes: {
          symbol: position.asset.symbol,
          quantity: input.quantity,
          price: input.price,
        },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: position,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /positions/:id/transactions - Add transaction to position
  // --------------------------------------------------------------------------
  app.post(
    '/:id/transactions',
    { preHandler: [requirePermission('transaction:create')] },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string; id: string };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;
      const input = investTransactionCreateSchema.parse(request.body);

      const position = await positionService.addTransaction(workspaceId, id, {
        type: input.type,
        quantity: input.quantity,
        price: input.price,
        fees: input.fees,
        date: input.date,
        notes: input.notes ?? undefined,
      });

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.POSITION_TRANSACTION,
        entityType: 'position',
        entityId: id,
        changes: {
          type: input.type,
          quantity: input.quantity,
          price: input.price,
        },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: position,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /positions/:id/transactions - Get position transactions
  // --------------------------------------------------------------------------
  app.get(
    '/:id/transactions',
    { preHandler: [requirePermission('transaction:read')] },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string; id: string };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;

      const transactions = await positionService.getTransactions(workspaceId, id);

      return reply.send({
        success: true,
        data: transactions,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /positions/:id - Delete empty position
  // --------------------------------------------------------------------------
  app.delete(
    '/:id',
    { preHandler: [requirePermission('transaction:delete')] },
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string; id: string };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId, id } = request.params;

      await positionService.delete(workspaceId, id);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.POSITION_DELETED,
        entityType: 'position',
        entityId: id,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: { message: 'Position supprimée' },
      });
    }
  );
}

export default positionRoutes;
