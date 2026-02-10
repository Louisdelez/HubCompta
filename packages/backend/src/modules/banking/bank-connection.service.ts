// ============================================================================
// BANK CONNECTION SERVICE - Finance Hub
// Manages bank connections and synchronization
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError, ConflictError } from '@/core/middleware/errorHandler.js';
import { logger } from '@/core/middleware/logger.js';
import type { BankProvider, BankConnectionStatus } from '@prisma/client';

// Simple token encoding (use proper encryption in production)
function encrypt(value: string): string {
  return Buffer.from(value).toString('base64');
}

function decrypt(value: string): string {
  return Buffer.from(value, 'base64').toString('utf-8');
}
import type { IBankProvider, BankTransaction } from './providers/provider.interface.js';
import { createNordigenProvider } from './providers/nordigen.provider.js';
import { mlCategorizationService } from '../categorization/ml-categorization.service.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface BankConnectionWithAccounts {
  id: string;
  provider: BankProvider;
  institutionId: string;
  institutionName: string;
  institutionLogo: string | null;
  status: BankConnectionStatus;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  consentExpiresAt: Date | null;
  accounts: Array<{
    id: string;
    name: string;
    iban: string | null;
    balance: number;
    currency: string;
    type: string;
    linkedAccountId: string | null;
    lastSyncAt: Date | null;
  }>;
}

export interface SyncResult {
  accountId: string;
  transactionsImported: number;
  transactionsSkipped: number;
  newBalance: number;
  errors: string[];
}

// ----------------------------------------------------------------------------
// Provider Factory
// ----------------------------------------------------------------------------

function getProvider(providerName: BankProvider): IBankProvider {
  switch (providerName) {
    case 'nordigen':
      return createNordigenProvider();
    default:
      throw new Error(`Unsupported bank provider: ${providerName}`);
  }
}

// ----------------------------------------------------------------------------
// Bank Connection Service
// ----------------------------------------------------------------------------

export const bankConnectionService = {
  /**
   * Get available institutions for a country
   */
  async getInstitutions(
    countryCode: string = 'FR',
    provider: BankProvider = 'nordigen'
  ) {
    const bankProvider = getProvider(provider);
    return bankProvider.getInstitutions(countryCode);
  },

  /**
   * Search institutions
   */
  async searchInstitutions(
    query: string,
    countryCode?: string,
    provider: BankProvider = 'nordigen'
  ) {
    const bankProvider = getProvider(provider);
    return bankProvider.searchInstitutions(query, countryCode);
  },

  /**
   * Initiate bank connection (OAuth flow)
   */
  async initiateConnection(
    workspaceId: string,
    userId: string,
    institutionId: string,
    institutionName: string,
    institutionLogo: string | null,
    redirectUri: string,
    provider: BankProvider = 'nordigen'
  ): Promise<{ authUrl: string; connectionId: string }> {
    const bankProvider = getProvider(provider);

    // Check for existing connection to same institution
    const existing = await prisma.bankConnection.findFirst({
      where: {
        workspaceId,
        institutionId,
        status: { in: ['active', 'pending_auth'] },
      },
    });

    if (existing) {
      throw new ConflictError('A connection to this bank already exists');
    }

    // Create pending connection
    const connection = await prisma.bankConnection.create({
      data: {
        workspaceId,
        userId,
        provider,
        providerConnectionId: '', // Will be updated after auth
        institutionId,
        institutionName,
        institutionLogo,
        status: 'pending_auth',
      },
    });

    try {
      // Initiate OAuth
      const result = await bankProvider.initiateAuthorization(
        institutionId,
        redirectUri,
        connection.id
      );

      // Update connection with requisition ID
      await prisma.bankConnection.update({
        where: { id: connection.id },
        data: {
          providerConnectionId: result.requisitionId,
          consentExpiresAt: result.expiresAt,
        },
      });

      return {
        authUrl: result.authUrl,
        connectionId: connection.id,
      };
    } catch (error) {
      // Clean up on failure
      await prisma.bankConnection.delete({ where: { id: connection.id } });
      throw error;
    }
  },

  /**
   * Complete OAuth callback
   */
  async completeConnection(
    connectionId: string
  ): Promise<BankConnectionWithAccounts> {
    const connection = await prisma.bankConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundError('BankConnection', connectionId);
    }

    if (connection.status !== 'pending_auth') {
      throw new Error('Connection is not pending authorization');
    }

    const bankProvider = getProvider(connection.provider);

    try {
      // Complete authorization
      const tokens = await bankProvider.completeAuthorization(
        connection.providerConnectionId
      );

      // Get accounts
      const accounts = await bankProvider.getAccounts(
        connection.providerConnectionId,
        tokens.accessToken
      );

      // Update connection with tokens
      await prisma.bankConnection.update({
        where: { id: connectionId },
        data: {
          status: 'active',
          accessToken: encrypt(tokens.accessToken),
          refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
          consentExpiresAt: tokens.expiresAt,
          lastSyncAt: new Date(),
        },
      });

      // Create bank accounts
      for (const account of accounts) {
        await prisma.bankAccount.upsert({
          where: {
            connectionId_providerAccountId: {
              connectionId,
              providerAccountId: account.id,
            },
          },
          create: {
            connectionId,
            providerAccountId: account.id,
            name: account.name,
            iban: account.iban,
            balance: account.balance,
            availableBalance: account.availableBalance,
            currency: account.currency,
            type: account.type,
            lastSyncAt: new Date(),
          },
          update: {
            name: account.name,
            balance: account.balance,
            availableBalance: account.availableBalance,
            lastSyncAt: new Date(),
          },
        });
      }

      return this.getConnection(connection.workspaceId, connectionId);
    } catch (error) {
      // Mark connection as error
      await prisma.bankConnection.update({
        where: { id: connectionId },
        data: {
          status: 'error',
          lastSyncError: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  },

  /**
   * Get connection with accounts
   */
  async getConnection(
    workspaceId: string,
    connectionId: string
  ): Promise<BankConnectionWithAccounts> {
    const connection = await prisma.bankConnection.findFirst({
      where: { id: connectionId, workspaceId },
      include: {
        bankAccounts: {
          select: {
            id: true,
            name: true,
            iban: true,
            balance: true,
            currency: true,
            type: true,
            linkedAccountId: true,
            lastSyncAt: true,
          },
        },
      },
    });

    if (!connection) {
      throw new NotFoundError('BankConnection', connectionId);
    }

    return {
      id: connection.id,
      provider: connection.provider,
      institutionId: connection.institutionId,
      institutionName: connection.institutionName,
      institutionLogo: connection.institutionLogo,
      status: connection.status,
      lastSyncAt: connection.lastSyncAt,
      lastSyncError: connection.lastSyncError,
      consentExpiresAt: connection.consentExpiresAt,
      accounts: connection.bankAccounts.map((a) => ({
        ...a,
        balance: a.balance.toNumber(),
      })),
    };
  },

  /**
   * List all connections for workspace
   */
  async listConnections(workspaceId: string): Promise<BankConnectionWithAccounts[]> {
    const connections = await prisma.bankConnection.findMany({
      where: { workspaceId },
      include: {
        bankAccounts: {
          select: {
            id: true,
            name: true,
            iban: true,
            balance: true,
            currency: true,
            type: true,
            linkedAccountId: true,
            lastSyncAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return connections.map((c) => ({
      id: c.id,
      provider: c.provider,
      institutionId: c.institutionId,
      institutionName: c.institutionName,
      institutionLogo: c.institutionLogo,
      status: c.status,
      lastSyncAt: c.lastSyncAt,
      lastSyncError: c.lastSyncError,
      consentExpiresAt: c.consentExpiresAt,
      accounts: c.bankAccounts.map((a) => ({
        ...a,
        balance: a.balance.toNumber(),
      })),
    }));
  },

  /**
   * Link bank account to app account
   */
  async linkAccount(
    workspaceId: string,
    bankAccountId: string,
    linkedAccountId: string
  ): Promise<void> {
    // Verify bank account belongs to workspace
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId },
      include: { connection: true },
    });

    if (!bankAccount || bankAccount.connection.workspaceId !== workspaceId) {
      throw new NotFoundError('BankAccount', bankAccountId);
    }

    // Verify linked account belongs to workspace
    const account = await prisma.account.findFirst({
      where: { id: linkedAccountId, workspaceId, deletedAt: null },
    });

    if (!account) {
      throw new NotFoundError('Account', linkedAccountId);
    }

    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: { linkedAccountId },
    });
  },

  /**
   * Sync transactions from bank
   */
  async syncTransactions(
    workspaceId: string,
    connectionId: string,
    bankAccountId?: string,
    fromDate?: Date
  ): Promise<SyncResult[]> {
    const connection = await prisma.bankConnection.findFirst({
      where: { id: connectionId, workspaceId },
      include: { bankAccounts: true },
    });

    if (!connection) {
      throw new NotFoundError('BankConnection', connectionId);
    }

    if (connection.status !== 'active') {
      throw new Error('Bank connection is not active');
    }

    if (!connection.accessToken) {
      throw new Error('No access token available');
    }

    const accessToken = decrypt(connection.accessToken);
    const bankProvider = getProvider(connection.provider);
    const results: SyncResult[] = [];

    // Filter to specific account if provided
    const accountsToSync = bankAccountId
      ? connection.bankAccounts.filter((a) => a.id === bankAccountId)
      : connection.bankAccounts.filter((a) => a.linkedAccountId);

    for (const bankAccount of accountsToSync) {
      if (!bankAccount.linkedAccountId) {
        continue;
      }

      const result: SyncResult = {
        accountId: bankAccount.id,
        transactionsImported: 0,
        transactionsSkipped: 0,
        newBalance: 0,
        errors: [],
      };

      try {
        // Get transactions
        const syncFrom = fromDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const transactions = await bankProvider.getTransactions(
          bankAccount.providerAccountId,
          accessToken,
          syncFrom
        );

        // Import transactions
        for (const tx of transactions) {
          try {
            await this.importTransaction(
              workspaceId,
              bankAccount.linkedAccountId,
              tx
            );
            result.transactionsImported++;
          } catch (error) {
            if (error instanceof ConflictError) {
              result.transactionsSkipped++;
            } else {
              result.errors.push(
                `Transaction ${tx.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
              );
            }
          }
        }

        // Update balance
        const balance = await bankProvider.getBalance(
          bankAccount.providerAccountId,
          accessToken
        );

        await prisma.bankAccount.update({
          where: { id: bankAccount.id },
          data: {
            balance: balance.balance,
            availableBalance: balance.availableBalance,
            lastSyncAt: new Date(),
          },
        });

        result.newBalance = balance.balance;
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : 'Unknown error');
        logger.error({ bankAccountId: bankAccount.id, error }, 'Failed to sync bank account');
      }

      results.push(result);
    }

    // Update connection last sync
    await prisma.bankConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: null,
      },
    });

    return results;
  },

  /**
   * Import single transaction
   */
  async importTransaction(
    workspaceId: string,
    accountId: string,
    bankTx: BankTransaction
  ): Promise<void> {
    // Generate import hash for deduplication
    const importHash = `bank_${bankTx.accountId}_${bankTx.id}`;

    // Check for duplicate
    const existing = await prisma.transaction.findFirst({
      where: { workspaceId, importHash },
    });

    if (existing) {
      throw new ConflictError('Transaction already imported');
    }

    // Determine transaction type
    const type = bankTx.amount < 0 ? 'expense' : 'income';

    // Try to auto-categorize
    let categoryId: string | null = null;
    try {
      const prediction = await mlCategorizationService.predict(
        workspaceId,
        bankTx.description,
        bankTx.amount,
        bankTx.date
      );
      if (prediction && prediction.confidence >= 0.8) {
        categoryId = prediction.categoryId;
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to auto-categorize transaction');
    }

    // Create transaction
    await prisma.transaction.create({
      data: {
        workspaceId,
        accountId,
        type,
        amount: bankTx.amount,
        currency: bankTx.currency,
        date: bankTx.date,
        description: bankTx.description,
        categoryId,
        status: 'cleared',
        importHash,
      },
    });
  },

  /**
   * Disconnect bank connection
   */
  async disconnect(workspaceId: string, connectionId: string): Promise<void> {
    const connection = await prisma.bankConnection.findFirst({
      where: { id: connectionId, workspaceId },
    });

    if (!connection) {
      throw new NotFoundError('BankConnection', connectionId);
    }

    try {
      if (connection.accessToken && connection.status === 'active') {
        const accessToken = decrypt(connection.accessToken);
        const bankProvider = getProvider(connection.provider);
        await bankProvider.revokeAccess(connection.providerConnectionId, accessToken);
      }
    } catch (error) {
      logger.warn({ connectionId, error }, 'Failed to revoke bank access');
    }

    // Update status
    await prisma.bankConnection.update({
      where: { id: connectionId },
      data: {
        status: 'disconnected',
        accessToken: null,
        refreshToken: null,
      },
    });
  },

  /**
   * Delete connection and all linked data
   */
  async delete(workspaceId: string, connectionId: string): Promise<void> {
    const connection = await prisma.bankConnection.findFirst({
      where: { id: connectionId, workspaceId },
    });

    if (!connection) {
      throw new NotFoundError('BankConnection', connectionId);
    }

    // Disconnect first
    if (connection.status === 'active') {
      await this.disconnect(workspaceId, connectionId);
    }

    // Delete connection (cascades to bank accounts)
    await prisma.bankConnection.delete({
      where: { id: connectionId },
    });
  },
};

export default bankConnectionService;
