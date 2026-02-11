// ============================================================================
// ACCOUNT SERVICE TESTS - Finance Hub
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Account, AccountType, Prisma } from '@prisma/client';

// Mock error handler first (to avoid Sentry import issue)
vi.mock('@/core/middleware/errorHandler.js', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(resource: string, id?: string) {
      super(id ? `${resource} with ID ${id} not found` : `${resource} not found`);
      this.name = 'NotFoundError';
    }
  },
  ConflictError: class ConflictError extends Error {
    constructor(entity: string, field: string, value: string) {
      super(`${entity} with ${field} "${value}" already exists`);
      this.name = 'ConflictError';
    }
  },
}));

// Mock cache service
vi.mock('@/core/cache/index.js', () => ({
  cacheService: {
    getOrSet: vi.fn((key: string, fn: () => Promise<unknown>) => fn()),
    invalidateWorkspaceCache: vi.fn(),
  },
  CACHE_KEYS: {
    workspaceAccounts: (id: string) => `workspace:${id}:accounts`,
  },
  CACHE_TTL: {
    ACCOUNTS: 300,
  },
}));

// Mock Prisma client
vi.mock('@/core/database/client.js', () => ({
  prisma: {
    account: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      aggregate: vi.fn(),
    },
  },
}));

import { prisma } from '@/core/database/client.js';
import { cacheService } from '@/core/cache/index.js';
import { accountService } from './account.service.js';

// Helper to create mock account data
const createMockAccount = (overrides = {}): Account => ({
  id: 'account-123',
  workspaceId: 'workspace-123',
  name: 'Compte Courant',
  type: 'checking' as AccountType,
  currency: 'EUR',
  balance: { toNumber: () => 1000 } as Prisma.Decimal,
  color: '#4CAF50',
  icon: null,
  isArchived: false,
  deletedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

describe('AccountService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // CREATE
  // ============================================================================

  describe('create', () => {
    it('should create an account successfully', async () => {
      const workspaceId = 'workspace-123';
      const input = {
        name: 'New Account',
        type: 'checking' as AccountType,
        currency: 'EUR',
        initialBalance: 500,
        color: '#2196F3',
      };

      vi.mocked(prisma.account.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.account.create).mockResolvedValue(
        createMockAccount({
          name: input.name,
          type: input.type,
          balance: { toNumber: () => 500 } as Prisma.Decimal,
          color: input.color,
        })
      );

      const result = await accountService.create(workspaceId, input);

      expect(result.name).toBe('New Account');
      expect(prisma.account.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          name: input.name,
          type: input.type,
          currency: 'EUR',
          balance: 500,
          color: input.color,
          icon: undefined,
        },
      });
      expect(cacheService.invalidateWorkspaceCache).toHaveBeenCalledWith(workspaceId);
    });

    it('should throw ConflictError if account name already exists', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(createMockAccount());

      await expect(
        accountService.create('workspace-123', {
          name: 'Compte Courant',
          type: 'checking',
        })
      ).rejects.toThrow('already exists');
    });

    it('should use default currency EUR when not provided', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.account.create).mockResolvedValue(createMockAccount());

      await accountService.create('workspace-123', {
        name: 'Test Account',
        type: 'checking',
      });

      expect(prisma.account.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          currency: 'EUR',
        }),
      });
    });

    it('should use default balance of 0 when not provided', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.account.create).mockResolvedValue(createMockAccount());

      await accountService.create('workspace-123', {
        name: 'Test Account',
        type: 'checking',
      });

      expect(prisma.account.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          balance: 0,
        }),
      });
    });

    it('should create savings account type', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.account.create).mockResolvedValue(
        createMockAccount({ type: 'savings' as AccountType })
      );

      const result = await accountService.create('workspace-123', {
        name: 'Livret A',
        type: 'savings',
      });

      expect(result.type).toBe('savings');
    });
  });

  // ============================================================================
  // GET BY ID
  // ============================================================================

  describe('getById', () => {
    it('should return account if found', async () => {
      const mockAccount = createMockAccount();
      vi.mocked(prisma.account.findFirst).mockResolvedValue(mockAccount);

      const result = await accountService.getById('workspace-123', 'account-123');

      expect(result).toEqual(mockAccount);
      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'account-123',
          workspaceId: 'workspace-123',
          deletedAt: null,
        },
      });
    });

    it('should return null if account not found', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null);

      const result = await accountService.getById('workspace-123', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should not return deleted accounts', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null);

      await accountService.getById('workspace-123', 'deleted-account');

      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          deletedAt: null,
        }),
      });
    });
  });

  // ============================================================================
  // GET WITH BALANCE
  // ============================================================================

  describe('getWithBalance', () => {
    it('should return account with calculated balance', async () => {
      const mockAccount = createMockAccount();
      vi.mocked(prisma.account.findFirst).mockResolvedValue(mockAccount);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => 500 } as Prisma.Decimal },
        _count: 10,
      } as any);

      const result = await accountService.getWithBalance('workspace-123', 'account-123');

      expect(result).not.toBeNull();
      expect(result!.balance).toBe(1500); // initial 1000 + transactions 500
      expect(result!.transactionCount).toBe(10);
    });

    it('should return null if account not found', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null);

      const result = await accountService.getWithBalance('workspace-123', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should handle zero transaction sum', async () => {
      const mockAccount = createMockAccount();
      vi.mocked(prisma.account.findFirst).mockResolvedValue(mockAccount);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: null },
        _count: 0,
      } as any);

      const result = await accountService.getWithBalance('workspace-123', 'account-123');

      expect(result!.balance).toBe(1000);
      expect(result!.transactionCount).toBe(0);
    });

    it('should handle negative transaction sums', async () => {
      const mockAccount = createMockAccount();
      vi.mocked(prisma.account.findFirst).mockResolvedValue(mockAccount);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => -1500 } as Prisma.Decimal },
        _count: 15,
      } as any);

      const result = await accountService.getWithBalance('workspace-123', 'account-123');

      expect(result!.balance).toBe(-500); // initial 1000 - 1500
    });
  });

  // ============================================================================
  // LIST
  // ============================================================================

  describe('list', () => {
    it('should return all active accounts with balances', async () => {
      const mockAccounts = [
        createMockAccount({ id: 'acc-1', name: 'Checking' }),
        createMockAccount({ id: 'acc-2', name: 'Savings', type: 'savings' as AccountType }),
      ];

      vi.mocked(prisma.account.findMany).mockResolvedValue(mockAccounts);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => 100 } as Prisma.Decimal },
        _count: 5,
      } as any);

      const result = await accountService.list('workspace-123');

      expect(result).toHaveLength(2);
      expect(result[0]!.balance).toBe(1100);
      expect(result[0]!.transactionCount).toBe(5);
    });

    it('should filter by account type', async () => {
      vi.mocked(prisma.account.findMany).mockResolvedValue([]);

      await accountService.list('workspace-123', { type: 'checking' });

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          type: 'checking',
        }),
        orderBy: expect.any(Array),
      });
    });

    it('should exclude archived accounts by default', async () => {
      vi.mocked(prisma.account.findMany).mockResolvedValue([]);

      await accountService.list('workspace-123');

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          isArchived: false,
        }),
        orderBy: expect.any(Array),
      });
    });

    it('should include archived accounts when requested', async () => {
      vi.mocked(prisma.account.findMany).mockResolvedValue([]);

      await accountService.list('workspace-123', { includeArchived: true });

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: expect.not.objectContaining({
          isArchived: false,
        }),
        orderBy: expect.any(Array),
      });
    });

    it('should sort by type then name', async () => {
      vi.mocked(prisma.account.findMany).mockResolvedValue([]);

      await accountService.list('workspace-123');

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });
    });
  });

  // ============================================================================
  // UPDATE
  // ============================================================================

  describe('update', () => {
    it('should update account successfully', async () => {
      const mockAccount = createMockAccount();
      vi.mocked(prisma.account.findFirst)
        .mockResolvedValueOnce(mockAccount) // First call - find account to update
        .mockResolvedValueOnce(null); // Second call - check for duplicate name
      vi.mocked(prisma.account.update).mockResolvedValue({
        ...mockAccount,
        name: 'Updated Name',
      });

      const result = await accountService.update('workspace-123', 'account-123', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
      expect(cacheService.invalidateWorkspaceCache).toHaveBeenCalledWith('workspace-123');
    });

    it('should throw NotFoundError if account does not exist', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null);

      await expect(
        accountService.update('workspace-123', 'nonexistent', { name: 'New Name' })
      ).rejects.toThrow('not found');
    });

    it('should throw ConflictError if new name already exists', async () => {
      vi.mocked(prisma.account.findFirst)
        .mockResolvedValueOnce(createMockAccount()) // Account being updated
        .mockResolvedValueOnce(createMockAccount({ id: 'other-account' })); // Existing account with same name

      await expect(
        accountService.update('workspace-123', 'account-123', { name: 'Existing Name' })
      ).rejects.toThrow('already exists');
    });

    it('should allow updating color without name check', async () => {
      const mockAccount = createMockAccount();
      vi.mocked(prisma.account.findFirst).mockResolvedValueOnce(mockAccount);
      vi.mocked(prisma.account.update).mockResolvedValue({
        ...mockAccount,
        color: '#FF5722',
      });

      await accountService.update('workspace-123', 'account-123', { color: '#FF5722' });

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'account-123' },
        data: { color: '#FF5722' },
      });
    });
  });

  // ============================================================================
  // ARCHIVE / UNARCHIVE
  // ============================================================================

  describe('archive', () => {
    it('should archive account', async () => {
      const mockAccount = createMockAccount();
      vi.mocked(prisma.account.findFirst).mockResolvedValue(mockAccount);
      vi.mocked(prisma.account.update).mockResolvedValue({
        ...mockAccount,
        isArchived: true,
      });

      const result = await accountService.archive('workspace-123', 'account-123');

      expect(result.isArchived).toBe(true);
    });
  });

  describe('unarchive', () => {
    it('should unarchive account', async () => {
      const mockAccount = createMockAccount({ isArchived: true });
      vi.mocked(prisma.account.findFirst).mockResolvedValue(mockAccount);
      vi.mocked(prisma.account.update).mockResolvedValue({
        ...mockAccount,
        isArchived: false,
      });

      const result = await accountService.unarchive('workspace-123', 'account-123');

      expect(result.isArchived).toBe(false);
    });
  });

  // ============================================================================
  // DELETE
  // ============================================================================

  describe('delete', () => {
    it('should soft delete account with no transactions', async () => {
      const mockAccount = {
        ...createMockAccount(),
        _count: { transactions: 0 },
      };
      vi.mocked(prisma.account.findFirst).mockResolvedValue(mockAccount as any);

      await accountService.delete('workspace-123', 'account-123');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'account-123' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should archive account with transactions instead of deleting', async () => {
      const mockAccount = {
        ...createMockAccount(),
        _count: { transactions: 10 },
      };
      vi.mocked(prisma.account.findFirst).mockResolvedValue(mockAccount as any);

      await accountService.delete('workspace-123', 'account-123');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'account-123' },
        data: { isArchived: true },
      });
    });

    it('should throw NotFoundError if account does not exist', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null);

      await expect(accountService.delete('workspace-123', 'nonexistent')).rejects.toThrow(
        'not found'
      );
    });
  });

  // ============================================================================
  // GET TOTAL BALANCE
  // ============================================================================

  describe('getTotalBalance', () => {
    it('should return sum of all account balances', async () => {
      const mockAccounts = [
        createMockAccount({ id: 'acc-1' }),
        createMockAccount({ id: 'acc-2' }),
      ];

      vi.mocked(prisma.account.findMany).mockResolvedValue(mockAccounts);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => 500 } as Prisma.Decimal },
        _count: 5,
      } as any);

      const result = await accountService.getTotalBalance('workspace-123');

      expect(result).toBe(3000); // (1000 + 500) * 2
    });

    it('should return 0 for workspace with no accounts', async () => {
      vi.mocked(prisma.account.findMany).mockResolvedValue([]);

      const result = await accountService.getTotalBalance('workspace-123');

      expect(result).toBe(0);
    });
  });

  // ============================================================================
  // GET BALANCE BY TYPE
  // ============================================================================

  describe('getBalanceByType', () => {
    it('should return balances grouped by account type', async () => {
      const mockAccounts = [
        createMockAccount({ id: 'acc-1', type: 'checking' as AccountType }),
        createMockAccount({ id: 'acc-2', type: 'checking' as AccountType }),
        createMockAccount({ id: 'acc-3', type: 'savings' as AccountType }),
      ];

      vi.mocked(prisma.account.findMany).mockResolvedValue(mockAccounts);
      vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => 0 } as Prisma.Decimal },
        _count: 0,
      } as any);

      const result = await accountService.getBalanceByType('workspace-123');

      expect(result.checking).toBe(2000);
      expect(result.savings).toBe(1000);
    });
  });
});
