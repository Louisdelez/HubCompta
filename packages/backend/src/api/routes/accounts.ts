// ============================================================================
// ACCOUNT ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { accountService } from '@/modules/accounts/account.service.js';
import { balanceService } from '@/modules/accounts/balance.service.js';
import { auditService, AUDIT_ACTIONS } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';
import { accountCreateSchema, accountUpdateSchema } from '@finance-hub/shared';
import type { AccountType } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WorkspaceParams {
  workspaceId: string;
}

interface AccountParams extends WorkspaceParams {
  accountId: string;
}

interface AccountQuery {
  type?: AccountType;
  includeArchived?: boolean;
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export function accountRoutes(app: FastifyInstance): void {
  // Apply auth guard and workspace context to all routes
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/accounts - List accounts
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams; Querystring: AccountQuery }>(
    '/',
    { preHandler: requirePermission('account:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { type, includeArchived } = request.query;

      const accounts = await accountService.list(workspaceId, {
        type,
        includeArchived: includeArchived === true,
      });

      return reply.send({
        success: true,
        data: accounts,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/accounts - Create account
  // --------------------------------------------------------------------------
  app.post<{ Params: WorkspaceParams }>(
    '/',
    { preHandler: requirePermission('account:create') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const input = accountCreateSchema.parse(request.body);

      const account = await accountService.create(workspaceId, input);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.ACCOUNT_CREATED,
        entityType: 'account',
        entityId: account.id,
        changes: { name: account.name, type: account.type },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        success: true,
        data: account,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/accounts/balance - Get total balance
  // --------------------------------------------------------------------------
  app.get<{ Params: WorkspaceParams }>(
    '/balance',
    { preHandler: requirePermission('account:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const [total, byType, netWorth] = await Promise.all([
        accountService.getTotalBalance(workspaceId),
        accountService.getBalanceByType(workspaceId),
        balanceService.getNetWorth(workspaceId),
      ]);

      return reply.send({
        success: true,
        data: {
          total,
          byType,
          netWorth,
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /workspaces/:workspaceId/accounts/:accountId - Get account
  // --------------------------------------------------------------------------
  app.get<{ Params: AccountParams }>(
    '/:accountId',
    { preHandler: requirePermission('account:read') },
    async (request, reply) => {
      const { workspaceId, accountId } = request.params;

      const account = await accountService.getWithBalance(workspaceId, accountId);

      if (!account) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Account not found' },
        });
      }

      return reply.send({
        success: true,
        data: account,
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /workspaces/:workspaceId/accounts/:accountId - Update account
  // --------------------------------------------------------------------------
  app.patch<{ Params: AccountParams }>(
    '/:accountId',
    { preHandler: requirePermission('account:update') },
    async (request, reply) => {
      const { workspaceId, accountId } = request.params;
      const input = accountUpdateSchema.parse(request.body);

      const account = await accountService.update(workspaceId, accountId, input);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.ACCOUNT_UPDATED,
        entityType: 'account',
        entityId: accountId,
        changes: input,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: account,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/accounts/:accountId/archive - Archive account
  // --------------------------------------------------------------------------
  app.post<{ Params: AccountParams }>(
    '/:accountId/archive',
    { preHandler: requirePermission('account:update') },
    async (request, reply) => {
      const { workspaceId, accountId } = request.params;

      const account = await accountService.archive(workspaceId, accountId);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.ACCOUNT_ARCHIVED,
        entityType: 'account',
        entityId: accountId,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: account,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /workspaces/:workspaceId/accounts/:accountId/unarchive - Unarchive account
  // --------------------------------------------------------------------------
  app.post<{ Params: AccountParams }>(
    '/:accountId/unarchive',
    { preHandler: requirePermission('account:update') },
    async (request, reply) => {
      const { workspaceId, accountId } = request.params;

      const account = await accountService.unarchive(workspaceId, accountId);

      return reply.send({
        success: true,
        data: account,
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /workspaces/:workspaceId/accounts/:accountId - Delete account
  // --------------------------------------------------------------------------
  app.delete<{ Params: AccountParams }>(
    '/:accountId',
    { preHandler: requirePermission('account:delete') },
    async (request, reply) => {
      const { workspaceId, accountId } = request.params;

      await accountService.delete(workspaceId, accountId);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: AUDIT_ACTIONS.ACCOUNT_DELETED,
        entityType: 'account',
        entityId: accountId,
        ipAddress: request.ip,
        severity: 'warning',
      });

      return reply.send({
        success: true,
        data: { message: 'Account deleted' },
      });
    }
  );
}

export default accountRoutes;
