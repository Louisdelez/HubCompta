// ============================================================================
// POSITION ROUTES - Finance Hub
// Investment position management
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { positionService } from '@/modules/invest/position.service.js';
import { assetService } from '@/modules/invest/asset.service.js';
import { auditService, AUDIT_ACTIONS } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';
import { positionCreateSchema, investTransactionCreateSchema } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export function positionRoutes(app: FastifyInstance): void {
  // Apply auth guard and workspace context to all routes
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // --------------------------------------------------------------------------
  // GET /positions - List positions
  // --------------------------------------------------------------------------
  app.get<{
    Params: { workspaceId: string };
    Querystring: { accountId?: string };
  }>(
    '/',
    { preHandler: [requirePermission('transaction:read')] },
    async (request, reply) => {
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
  app.get<{ Params: { workspaceId: string; id: string } }>(
    '/:id',
    { preHandler: [requirePermission('transaction:read')] },
    async (request, reply) => {
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
  app.post<{ Params: { workspaceId: string } }>(
    '/',
    { preHandler: [requirePermission('transaction:create')] },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const input = positionCreateSchema.parse(request.body);

      // Get or create asset (by ID or symbol)
      let asset;
      if (input.assetId) {
        asset = await assetService.getById(input.assetId);
      } else if (input.assetSymbol) {
        asset = await assetService.getOrCreate(input.assetSymbol, input.assetType);
      }

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
  app.post<{ Params: { workspaceId: string; id: string } }>(
    '/:id/transactions',
    { preHandler: [requirePermission('transaction:create')] },
    async (request, reply) => {
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
  app.get<{ Params: { workspaceId: string; id: string } }>(
    '/:id/transactions',
    { preHandler: [requirePermission('transaction:read')] },
    async (request, reply) => {
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
  app.delete<{ Params: { workspaceId: string; id: string } }>(
    '/:id',
    { preHandler: [requirePermission('transaction:delete')] },
    async (request, reply) => {
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
