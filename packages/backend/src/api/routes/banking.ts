// ============================================================================
// BANKING ROUTES - Finance Hub
// Bank connection and synchronization (Open Banking)
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { bankConnectionService } from '@/modules/banking/bank-connection.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { workspaceContextMiddleware, requirePermission } from '@/core/middleware/workspaceContext.js';
import { auditService } from '@/modules/audit/audit.service.js';

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------

const initiateConnectionSchema = z.object({
  institutionId: z.string().min(1),
  institutionName: z.string().min(1),
  institutionLogo: z.string().url().nullable().optional(),
  provider: z.enum(['nordigen', 'tink', 'plaid', 'truelayer']).optional().default('nordigen'),
});

const linkAccountSchema = z.object({
  linkedAccountId: z.string().uuid(),
});

const syncOptionsSchema = z.object({
  bankAccountId: z.string().optional(),
  fromDate: z.coerce.date().optional(),
});

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export function bankingRoutes(app: FastifyInstance): void {
  // Apply auth guard and workspace context
  app.addHook('preHandler', authGuard);
  app.addHook('preHandler', workspaceContextMiddleware);

  // --------------------------------------------------------------------------
  // GET /banking/institutions - List available institutions
  // --------------------------------------------------------------------------
  app.get<{
    Params: { workspaceId: string };
    Querystring: { country?: string; provider?: string };
  }>(
    '/institutions',
    { preHandler: requirePermission('account:read') },
    async (request, reply) => {
      const country = request.query.country ?? 'FR';
      const provider = (request.query.provider ?? 'nordigen') as 'nordigen';

      const institutions = await bankConnectionService.getInstitutions(country, provider);

      return reply.send({
        success: true,
        data: institutions,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /banking/institutions/search - Search institutions
  // --------------------------------------------------------------------------
  app.get<{
    Params: { workspaceId: string };
    Querystring: { q: string; country?: string };
  }>(
    '/institutions/search',
    { preHandler: requirePermission('account:read') },
    async (request, reply) => {
      const { q, country } = request.query;

      const institutions = await bankConnectionService.searchInstitutions(q, country);

      return reply.send({
        success: true,
        data: institutions,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /banking/connections - List bank connections
  // --------------------------------------------------------------------------
  app.get<{ Params: { workspaceId: string } }>(
    '/connections',
    { preHandler: requirePermission('account:read') },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const connections = await bankConnectionService.listConnections(workspaceId);

      return reply.send({
        success: true,
        data: connections,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /banking/connections/initiate - Start bank connection
  // --------------------------------------------------------------------------
  app.post<{
    Params: { workspaceId: string };
    Body: z.infer<typeof initiateConnectionSchema>;
  }>(
    '/connections/initiate',
    { preHandler: requirePermission('account:create') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;
      const input = initiateConnectionSchema.parse(request.body);

      // Build redirect URI
      const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
      const redirectUri = `${baseUrl}/banking/callback`;

      const result = await bankConnectionService.initiateConnection(
        workspaceId,
        userId,
        input.institutionId,
        input.institutionName,
        input.institutionLogo ?? null,
        redirectUri,
        input.provider
      );

      await auditService.log({
        userId,
        workspaceId,
        action: 'banking.connection.initiated',
        changes: { institutionId: input.institutionId, institutionName: input.institutionName },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /banking/connections/:connectionId/complete - Complete OAuth callback
  // --------------------------------------------------------------------------
  app.post<{
    Params: { workspaceId: string; connectionId: string };
  }>(
    '/connections/:connectionId/complete',
    { preHandler: requirePermission('account:create') },
    async (request, reply) => {
      const { workspaceId, connectionId } = request.params;

      const connection = await bankConnectionService.completeConnection(connectionId);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: 'banking.connection.completed',
        entityType: 'bank_connection',
        entityId: connectionId,
        changes: {
          institutionName: connection.institutionName,
          accountCount: connection.accounts.length,
        },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: connection,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /banking/connections/:connectionId - Get connection details
  // --------------------------------------------------------------------------
  app.get<{
    Params: { workspaceId: string; connectionId: string };
  }>(
    '/connections/:connectionId',
    { preHandler: requirePermission('account:read') },
    async (request, reply) => {
      const { workspaceId, connectionId } = request.params;

      const connection = await bankConnectionService.getConnection(workspaceId, connectionId);

      return reply.send({
        success: true,
        data: connection,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /banking/connections/:connectionId/sync - Sync transactions
  // --------------------------------------------------------------------------
  app.post<{
    Params: { workspaceId: string; connectionId: string };
    Body: z.infer<typeof syncOptionsSchema>;
  }>(
    '/connections/:connectionId/sync',
    { preHandler: requirePermission('transaction:create') },
    async (request, reply) => {
      const { workspaceId, connectionId } = request.params;
      const options = syncOptionsSchema.parse(request.body);

      const results = await bankConnectionService.syncTransactions(
        workspaceId,
        connectionId,
        options.bankAccountId,
        options.fromDate
      );

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: 'banking.sync',
        entityType: 'bank_connection',
        entityId: connectionId,
        changes: {
          imported: results.reduce((sum, r) => sum + r.transactionsImported, 0),
          skipped: results.reduce((sum, r) => sum + r.transactionsSkipped, 0),
        },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: results,
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /banking/accounts/:bankAccountId/link - Link bank account to app account
  // --------------------------------------------------------------------------
  app.post<{
    Params: { workspaceId: string; bankAccountId: string };
    Body: z.infer<typeof linkAccountSchema>;
  }>(
    '/accounts/:bankAccountId/link',
    { preHandler: requirePermission('account:update') },
    async (request, reply) => {
      const { workspaceId, bankAccountId } = request.params;
      const input = linkAccountSchema.parse(request.body);

      await bankConnectionService.linkAccount(
        workspaceId,
        bankAccountId,
        input.linkedAccountId
      );

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: 'banking.account.linked',
        entityType: 'bank_account',
        entityId: bankAccountId,
        changes: { linkedAccountId: input.linkedAccountId },
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        data: { message: 'Account linked successfully' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /banking/connections/:connectionId/disconnect - Disconnect bank
  // --------------------------------------------------------------------------
  app.post<{
    Params: { workspaceId: string; connectionId: string };
  }>(
    '/connections/:connectionId/disconnect',
    { preHandler: requirePermission('account:delete') },
    async (request, reply) => {
      const { workspaceId, connectionId } = request.params;

      await bankConnectionService.disconnect(workspaceId, connectionId);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: 'banking.connection.disconnected',
        entityType: 'bank_connection',
        entityId: connectionId,
        ipAddress: request.ip,
        severity: 'warning',
      });

      return reply.send({
        success: true,
        data: { message: 'Bank disconnected' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /banking/connections/:connectionId - Delete connection
  // --------------------------------------------------------------------------
  app.delete<{
    Params: { workspaceId: string; connectionId: string };
  }>(
    '/connections/:connectionId',
    { preHandler: requirePermission('account:delete') },
    async (request, reply) => {
      const { workspaceId, connectionId } = request.params;

      await bankConnectionService.delete(workspaceId, connectionId);

      await auditService.log({
        userId: request.user!.sub,
        workspaceId,
        action: 'banking.connection.deleted',
        entityType: 'bank_connection',
        entityId: connectionId,
        ipAddress: request.ip,
        severity: 'warning',
      });

      return reply.send({
        success: true,
        data: { message: 'Connection deleted' },
      });
    }
  );
}

export default bankingRoutes;
