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
// OpenAPI Schemas
// ----------------------------------------------------------------------------

const workspaceParamsSchema = {
  type: 'object' as const,
  required: ['workspaceId'],
  properties: {
    workspaceId: { type: 'string' as const, format: 'uuid', description: 'Workspace ID' },
  },
};

const connectionParamsSchema = {
  type: 'object' as const,
  required: ['workspaceId', 'connectionId'],
  properties: {
    workspaceId: { type: 'string' as const, format: 'uuid', description: 'Workspace ID' },
    connectionId: { type: 'string' as const, format: 'uuid', description: 'Bank connection ID' },
  },
};

const bankAccountParamsSchema = {
  type: 'object' as const,
  required: ['workspaceId', 'bankAccountId'],
  properties: {
    workspaceId: { type: 'string' as const, format: 'uuid', description: 'Workspace ID' },
    bankAccountId: { type: 'string' as const, format: 'uuid', description: 'Bank account ID' },
  },
};

const institutionSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    name: { type: 'string' as const },
    bic: { type: 'string' as const, nullable: true },
    logo: { type: 'string' as const, format: 'uri', nullable: true },
    countries: { type: 'array' as const, items: { type: 'string' as const } },
  },
};

const bankAccountSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const, format: 'uuid' },
    externalId: { type: 'string' as const },
    iban: { type: 'string' as const, nullable: true },
    name: { type: 'string' as const },
    ownerName: { type: 'string' as const, nullable: true },
    currency: { type: 'string' as const },
    balance: { type: 'number' as const, nullable: true },
    linkedAccountId: { type: 'string' as const, format: 'uuid', nullable: true },
    lastSyncedAt: { type: 'string' as const, format: 'date-time', nullable: true },
  },
};

const bankConnectionSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const, format: 'uuid' },
    workspaceId: { type: 'string' as const, format: 'uuid' },
    institutionId: { type: 'string' as const },
    institutionName: { type: 'string' as const },
    institutionLogo: { type: 'string' as const, format: 'uri', nullable: true },
    provider: { type: 'string' as const, enum: ['nordigen', 'tink', 'plaid', 'truelayer'] },
    status: { type: 'string' as const, enum: ['pending', 'active', 'expired', 'error'] },
    lastSyncedAt: { type: 'string' as const, format: 'date-time', nullable: true },
    expiresAt: { type: 'string' as const, format: 'date-time', nullable: true },
    accounts: { type: 'array' as const, items: bankAccountSchema },
    createdAt: { type: 'string' as const, format: 'date-time' },
    updatedAt: { type: 'string' as const, format: 'date-time' },
  },
};

const syncResultSchema = {
  type: 'object' as const,
  properties: {
    bankAccountId: { type: 'string' as const, format: 'uuid' },
    transactionsImported: { type: 'integer' as const },
    transactionsSkipped: { type: 'integer' as const },
    errors: { type: 'array' as const, items: { type: 'string' as const } },
  },
};

const successResponseSchema = (dataSchema: object) => ({
  type: 'object' as const,
  properties: {
    success: { type: 'boolean' as const, enum: [true] },
    data: dataSchema,
  },
});

const errorResponseSchema = {
  type: 'object' as const,
  properties: {
    success: { type: 'boolean' as const, enum: [false] },
    error: {
      type: 'object' as const,
      properties: {
        message: { type: 'string' as const },
        code: { type: 'string' as const },
      },
    },
  },
};

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
    {
      preHandler: requirePermission('account:read'),
      schema: {
        summary: 'List available institutions',
        description: 'Retrieve a list of available banking institutions for a specific country.',
        tags: ['Banking'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        querystring: {
          type: 'object' as const,
          properties: {
            country: { type: 'string' as const, default: 'FR', description: 'ISO 3166-1 alpha-2 country code' },
            provider: { type: 'string' as const, enum: ['nordigen', 'tink', 'plaid', 'truelayer'], default: 'nordigen' },
          },
        },
        response: {
          200: successResponseSchema({ type: 'array' as const, items: institutionSchema }),
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('account:read'),
      schema: {
        summary: 'Search institutions',
        description: 'Search for banking institutions by name.',
        tags: ['Banking'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        querystring: {
          type: 'object' as const,
          required: ['q'],
          properties: {
            q: { type: 'string' as const, minLength: 2, description: 'Search query' },
            country: { type: 'string' as const, description: 'ISO 3166-1 alpha-2 country code' },
          },
        },
        response: {
          200: successResponseSchema({ type: 'array' as const, items: institutionSchema }),
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('account:read'),
      schema: {
        summary: 'List bank connections',
        description: 'Retrieve all bank connections for a workspace.',
        tags: ['Banking'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        response: {
          200: successResponseSchema({ type: 'array' as const, items: bankConnectionSchema }),
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('account:create'),
      schema: {
        summary: 'Initiate bank connection',
        description: 'Start the OAuth flow to connect a bank account. Returns a redirect URL for user authorization.',
        tags: ['Banking'],
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        body: {
          type: 'object' as const,
          required: ['institutionId', 'institutionName'],
          properties: {
            institutionId: { type: 'string' as const, description: 'Institution identifier from the institutions list' },
            institutionName: { type: 'string' as const, description: 'Display name of the institution' },
            institutionLogo: { type: 'string' as const, format: 'uri', nullable: true, description: 'Logo URL' },
            provider: { type: 'string' as const, enum: ['nordigen', 'tink', 'plaid', 'truelayer'], default: 'nordigen' },
          },
        },
        response: {
          200: successResponseSchema({
            type: 'object' as const,
            properties: {
              connectionId: { type: 'string' as const, format: 'uuid' },
              redirectUrl: { type: 'string' as const, format: 'uri', description: 'URL to redirect user for authorization' },
            },
          }),
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('account:create'),
      schema: {
        summary: 'Complete bank connection',
        description: 'Complete the OAuth flow after user authorization. Fetches bank accounts and activates the connection.',
        tags: ['Banking'],
        security: [{ bearerAuth: [] }],
        params: connectionParamsSchema,
        response: {
          200: successResponseSchema(bankConnectionSchema),
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('account:read'),
      schema: {
        summary: 'Get connection details',
        description: 'Retrieve detailed information about a specific bank connection including all linked accounts.',
        tags: ['Banking'],
        security: [{ bearerAuth: [] }],
        params: connectionParamsSchema,
        response: {
          200: successResponseSchema(bankConnectionSchema),
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('transaction:create'),
      schema: {
        summary: 'Sync transactions',
        description: 'Synchronize transactions from the bank. Optionally sync a specific account or from a specific date.',
        tags: ['Banking'],
        security: [{ bearerAuth: [] }],
        params: connectionParamsSchema,
        body: {
          type: 'object' as const,
          properties: {
            bankAccountId: { type: 'string' as const, format: 'uuid', description: 'Sync only this account' },
            fromDate: { type: 'string' as const, format: 'date-time', description: 'Sync transactions from this date' },
          },
        },
        response: {
          200: successResponseSchema({ type: 'array' as const, items: syncResultSchema }),
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('account:update'),
      schema: {
        summary: 'Link bank account',
        description: 'Link a bank account to an existing application account for transaction synchronization.',
        tags: ['Banking'],
        security: [{ bearerAuth: [] }],
        params: bankAccountParamsSchema,
        body: {
          type: 'object' as const,
          required: ['linkedAccountId'],
          properties: {
            linkedAccountId: { type: 'string' as const, format: 'uuid', description: 'Application account ID to link' },
          },
        },
        response: {
          200: successResponseSchema({
            type: 'object' as const,
            properties: {
              message: { type: 'string' as const },
            },
          }),
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('account:delete'),
      schema: {
        summary: 'Disconnect bank',
        description: 'Disconnect a bank connection. The connection will be marked as inactive but data is preserved.',
        tags: ['Banking'],
        security: [{ bearerAuth: [] }],
        params: connectionParamsSchema,
        response: {
          200: successResponseSchema({
            type: 'object' as const,
            properties: {
              message: { type: 'string' as const },
            },
          }),
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
    {
      preHandler: requirePermission('account:delete'),
      schema: {
        summary: 'Delete connection',
        description: 'Permanently delete a bank connection and all associated data.',
        tags: ['Banking'],
        security: [{ bearerAuth: [] }],
        params: connectionParamsSchema,
        response: {
          200: successResponseSchema({
            type: 'object' as const,
            properties: {
              message: { type: 'string' as const },
            },
          }),
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
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
