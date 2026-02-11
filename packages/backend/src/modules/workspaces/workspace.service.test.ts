// ============================================================================
// WORKSPACE SERVICE TESTS - Finance Hub
// Tests for workspace.service.ts and membership.service.ts
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkspaceType, MembershipRole, Workspace, Membership } from '@prisma/client';

// Mock error handler first (to avoid Sentry import issue)
vi.mock('@/core/middleware/errorHandler.js', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(resource: string, id?: string) {
      super(id ? `${resource} with ID ${id} not found` : `${resource} not found`);
      this.name = 'NotFoundError';
    }
  },
  ConflictError: class ConflictError extends Error {
    constructor(entityOrMessage: string, field?: string, value?: string) {
      const message = field && value
        ? `${entityOrMessage} with ${field} "${value}" already exists`
        : entityOrMessage;
      super(message);
      this.name = 'ConflictError';
    }
  },
  ForbiddenError: class ForbiddenError extends Error {
    constructor(message = 'Access denied') {
      super(message);
      this.name = 'ForbiddenError';
    }
  },
  ValidationError: class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  },
}));

// Mock Prisma client
vi.mock('@/core/database/client.js', () => ({
  prisma: {
    workspace: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    membership: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    account: {
      count: vi.fn(),
    },
    transaction: {
      count: vi.fn(),
    },
    document: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock shared constants
vi.mock('@finance-hub/shared', () => ({
  WORKSPACE: {
    DEFAULTS: {
      FISCAL_YEAR_START: 1,
      DATE_FORMAT: 'yyyy-MM-dd',
      DECIMAL_SEPARATOR: '.',
    },
    LIMITS: {
      MAX_MEMBERS_PERSONAL: 1,
      MAX_MEMBERS_FAMILY: 10,
      MAX_MEMBERS_FLATSHARE: 20,
      MAX_MEMBERS_COMPANY: 50,
    },
  },
}));

import { prisma } from '@/core/database/client.js';
import { workspaceService } from './workspace.service.js';
import { membershipService } from './membership.service.js';

// Helper to create mock workspace data
const createMockWorkspace = (overrides = {}): Workspace => ({
  id: 'workspace-123',
  name: 'Test Workspace',
  type: 'personal' as WorkspaceType,
  currency: 'EUR',
  ownerId: 'user-123',
  settings: {
    fiscalYearStart: 1,
    dateFormat: 'yyyy-MM-dd',
    decimalSeparator: '.',
    enableProMode: false,
    enableInvestMode: false,
  },
  deletedAt: null,
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
  ...overrides,
});

const createMockMembership = (overrides = {}): Membership => ({
  id: 'membership-123',
  workspaceId: 'workspace-123',
  userId: 'user-123',
  role: 'owner' as MembershipRole,
  spendingLimit: null,
  approvalRequired: false,
  visibleCategories: [],
  settings: {},
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
  ...overrides,
});

// ============================================================================
// WORKSPACE SERVICE TESTS
// ============================================================================

describe('WorkspaceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // CREATE
  // ============================================================================

  describe('create', () => {
    it('should create a workspace with owner membership and default categories', async () => {
      const userId = 'user-123';
      const input = {
        name: 'My Workspace',
        type: 'personal' as const,
        currency: 'EUR',
      };

      const mockWorkspace = createMockWorkspace({ name: input.name });

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          workspace: {
            create: vi.fn().mockResolvedValue(mockWorkspace),
          },
          membership: {
            create: vi.fn().mockResolvedValue(createMockMembership()),
          },
          category: {
            createMany: vi.fn().mockResolvedValue({ count: 17 }),
          },
        };
        return callback(tx);
      });

      const result = await workspaceService.create(userId, input);

      expect(result).toMatchObject({
        id: 'workspace-123',
        name: 'My Workspace',
        type: 'personal',
      });
    });

    it('should use EUR as default currency', async () => {
      const userId = 'user-123';
      const input = {
        name: 'My Workspace',
        type: 'personal' as const,
        currency: 'EUR',
      };

      const mockWorkspace = createMockWorkspace({ currency: 'EUR' });

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          workspace: {
            create: vi.fn().mockResolvedValue(mockWorkspace),
          },
          membership: {
            create: vi.fn(),
          },
          category: {
            createMany: vi.fn().mockResolvedValue({ count: 17 }),
          },
        };
        return callback(tx);
      });

      const result = await workspaceService.create(userId, input);

      expect(result.currency).toBe('EUR');
    });

    it('should use provided currency', async () => {
      const userId = 'user-123';
      const input = {
        name: 'US Workspace',
        type: 'personal' as const,
        currency: 'USD',
      };

      const mockWorkspace = createMockWorkspace({ currency: 'USD' });

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          workspace: {
            create: vi.fn().mockResolvedValue(mockWorkspace),
          },
          membership: {
            create: vi.fn(),
          },
          category: {
            createMany: vi.fn().mockResolvedValue({ count: 17 }),
          },
        };
        return callback(tx);
      });

      const result = await workspaceService.create(userId, input);

      expect(result.currency).toBe('USD');
    });

    it('should create workspace with default settings', async () => {
      const userId = 'user-123';
      const input = {
        name: 'New Workspace',
        type: 'family' as const,
        currency: 'EUR',
      };

      const mockWorkspace = createMockWorkspace({
        type: 'family',
        settings: {
          fiscalYearStart: 1,
          dateFormat: 'yyyy-MM-dd',
          decimalSeparator: '.',
          enableProMode: false,
          enableInvestMode: false,
        },
      });

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          workspace: {
            create: vi.fn().mockResolvedValue(mockWorkspace),
          },
          membership: {
            create: vi.fn(),
          },
          category: {
            createMany: vi.fn().mockResolvedValue({ count: 17 }),
          },
        };
        return callback(tx);
      });

      const result = await workspaceService.create(userId, input);

      expect(result.settings).toMatchObject({
        fiscalYearStart: 1,
        enableProMode: false,
      });
    });

    it('should create default categories with isSystem flag', async () => {
      const userId = 'user-123';
      const input = {
        name: 'My Workspace',
        type: 'personal' as const,
        currency: 'EUR',
      };

      const mockWorkspace = createMockWorkspace({ name: input.name });
      const categoryCreateManyMock = vi.fn().mockResolvedValue({ count: 17 });

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          workspace: {
            create: vi.fn().mockResolvedValue(mockWorkspace),
          },
          membership: {
            create: vi.fn().mockResolvedValue(createMockMembership()),
          },
          category: {
            createMany: categoryCreateManyMock,
          },
        };
        return callback(tx);
      });

      await workspaceService.create(userId, input);

      expect(categoryCreateManyMock).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            workspaceId: mockWorkspace.id,
            name: 'Alimentation',
            type: 'expense',
            icon: expect.any(String),
            color: expect.any(String),
            isSystem: true,
          }),
          expect.objectContaining({
            workspaceId: mockWorkspace.id,
            name: 'Salaire',
            type: 'income',
            icon: expect.any(String),
            color: expect.any(String),
            isSystem: true,
          }),
        ]),
      });
    });
  });

  // ============================================================================
  // GET BY ID
  // ============================================================================

  describe('getById', () => {
    it('should return workspace by id', async () => {
      const mockWorkspace = createMockWorkspace();

      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(mockWorkspace);

      const result = await workspaceService.getById('workspace-123');

      expect(result).toMatchObject({
        id: 'workspace-123',
        name: 'Test Workspace',
      });

      expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: 'workspace-123', deletedAt: null },
      });
    });

    it('should return null for non-existent workspace', async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

      const result = await workspaceService.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should not return deleted workspace', async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

      const result = await workspaceService.getById('deleted-workspace');

      expect(result).toBeNull();
      expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
        where: expect.objectContaining({ deletedAt: null }),
      });
    });
  });

  // ============================================================================
  // GET WITH ROLE
  // ============================================================================

  describe('getWithRole', () => {
    it('should return workspace with user role and member count', async () => {
      const mockMembership = {
        ...createMockMembership(),
        workspace: createMockWorkspace(),
      };

      vi.mocked(prisma.membership.findUnique).mockResolvedValue(mockMembership as any);
      vi.mocked(prisma.membership.count).mockResolvedValue(3);

      const result = await workspaceService.getWithRole('workspace-123', 'user-123');

      expect(result).toMatchObject({
        id: 'workspace-123',
        role: 'owner',
        memberCount: 3,
      });
    });

    it('should return null if user is not a member', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

      const result = await workspaceService.getWithRole('workspace-123', 'non-member');

      expect(result).toBeNull();
    });

    it('should return null for deleted workspace', async () => {
      const mockMembership = {
        ...createMockMembership(),
        workspace: createMockWorkspace({ deletedAt: new Date() }),
      };

      vi.mocked(prisma.membership.findUnique).mockResolvedValue(mockMembership as any);

      const result = await workspaceService.getWithRole('workspace-123', 'user-123');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // LIST FOR USER
  // ============================================================================

  describe('listForUser', () => {
    it('should return all workspaces for a user', async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue([
        {
          ...createMockMembership({ role: 'owner' }),
          workspaceId: 'ws-1',
          workspace: createMockWorkspace({ id: 'ws-1', name: 'Personal' }),
        },
        {
          ...createMockMembership({ id: 'mem-2', role: 'member' }),
          workspaceId: 'ws-2',
          workspace: createMockWorkspace({ id: 'ws-2', name: 'Family', type: 'family' as WorkspaceType }),
        },
      ] as any);

      vi.mocked(prisma.membership.count)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(5);

      const result = await workspaceService.listForUser('user-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'ws-1',
        name: 'Personal',
        role: 'owner',
        memberCount: 1,
      });
      expect(result[1]).toMatchObject({
        id: 'ws-2',
        name: 'Family',
        role: 'member',
        memberCount: 5,
      });
    });

    it('should exclude deleted workspaces', async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue([
        {
          ...createMockMembership(),
          workspace: createMockWorkspace({ deletedAt: new Date() }), // Deleted
        },
        {
          ...createMockMembership({ id: 'mem-2' }),
          workspaceId: 'ws-2',
          workspace: createMockWorkspace({ id: 'ws-2', name: 'Active' }),
        },
      ] as any);

      vi.mocked(prisma.membership.count).mockResolvedValue(1);

      const result = await workspaceService.listForUser('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Active');
    });

    it('should return empty array if user has no workspaces', async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue([]);

      const result = await workspaceService.listForUser('user-without-workspaces');

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // UPDATE
  // ============================================================================

  describe('update', () => {
    it('should update workspace name', async () => {
      const mockWorkspace = createMockWorkspace();

      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(mockWorkspace);
      vi.mocked(prisma.workspace.update).mockResolvedValue({
        ...mockWorkspace,
        name: 'Updated Name',
      });

      const result = await workspaceService.update('workspace-123', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: 'workspace-123' },
        data: expect.objectContaining({ name: 'Updated Name' }),
      });
    });

    it('should update workspace currency', async () => {
      const mockWorkspace = createMockWorkspace();

      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(mockWorkspace);
      vi.mocked(prisma.workspace.update).mockResolvedValue({
        ...mockWorkspace,
        currency: 'USD',
      });

      const result = await workspaceService.update('workspace-123', { currency: 'USD' });

      expect(result.currency).toBe('USD');
    });

    it('should merge settings on update', async () => {
      const mockWorkspace = createMockWorkspace();

      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(mockWorkspace);
      vi.mocked(prisma.workspace.update).mockResolvedValue({
        ...mockWorkspace,
        settings: {
          ...mockWorkspace.settings as object,
          enableProMode: true,
        },
      });

      const result = await workspaceService.update('workspace-123', {
        settings: { enableProMode: true },
      });

      expect(result.settings).toMatchObject({ enableProMode: true });
    });

    it('should throw NotFoundError for non-existent workspace', async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

      await expect(
        workspaceService.update('nonexistent', { name: 'New Name' })
      ).rejects.toThrow();
    });

    it('should throw NotFoundError for deleted workspace', async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        createMockWorkspace({ deletedAt: new Date() })
      );

      await expect(
        workspaceService.update('deleted-ws', { name: 'New Name' })
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // DELETE
  // ============================================================================

  describe('delete', () => {
    it('should soft delete workspace', async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(createMockWorkspace());

      await workspaceService.delete('workspace-123');

      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: 'workspace-123' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundError for non-existent workspace', async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

      await expect(workspaceService.delete('nonexistent')).rejects.toThrow();
    });
  });

  // ============================================================================
  // CAN ADD MEMBER
  // ============================================================================

  describe('canAddMember', () => {
    it('should return true if under member limit for personal workspace', async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
        ...createMockWorkspace({ type: 'personal' as WorkspaceType }),
        _count: { memberships: 0 },
      } as any);

      const result = await workspaceService.canAddMember('workspace-123');

      expect(result).toBe(true);
    });

    it('should return false if at member limit for personal workspace', async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
        ...createMockWorkspace({ type: 'personal' as WorkspaceType }),
        _count: { memberships: 1 },
      } as any);

      const result = await workspaceService.canAddMember('workspace-123');

      expect(result).toBe(false);
    });

    it('should return true if under limit for family workspace', async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
        ...createMockWorkspace({ type: 'family' as WorkspaceType }),
        _count: { memberships: 5 },
      } as any);

      const result = await workspaceService.canAddMember('workspace-123');

      expect(result).toBe(true);
    });

    it('should return false if at limit for family workspace', async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
        ...createMockWorkspace({ type: 'family' as WorkspaceType }),
        _count: { memberships: 10 },
      } as any);

      const result = await workspaceService.canAddMember('workspace-123');

      expect(result).toBe(false);
    });

    it('should return false for non-existent workspace', async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

      const result = await workspaceService.canAddMember('nonexistent');

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // GET STATS
  // ============================================================================

  describe('getStats', () => {
    it('should return workspace statistics', async () => {
      vi.mocked(prisma.account.count).mockResolvedValue(3);
      vi.mocked(prisma.transaction.count).mockResolvedValue(150);
      vi.mocked(prisma.document.count).mockResolvedValue(25);

      const result = await workspaceService.getStats('workspace-123');

      expect(result).toEqual({
        accounts: 3,
        transactions: 150,
        documents: 25,
      });

      expect(prisma.account.count).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-123', deletedAt: null },
      });
    });

    it('should return zero counts for empty workspace', async () => {
      vi.mocked(prisma.account.count).mockResolvedValue(0);
      vi.mocked(prisma.transaction.count).mockResolvedValue(0);
      vi.mocked(prisma.document.count).mockResolvedValue(0);

      const result = await workspaceService.getStats('empty-workspace');

      expect(result).toEqual({
        accounts: 0,
        transactions: 0,
        documents: 0,
      });
    });
  });
});

// ============================================================================
// MEMBERSHIP SERVICE TESTS
// ============================================================================

describe('MembershipService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // GET
  // ============================================================================

  describe('get', () => {
    it('should return membership for workspace and user', async () => {
      const mockMembership = createMockMembership();

      vi.mocked(prisma.membership.findUnique).mockResolvedValue(mockMembership);

      const result = await membershipService.get('workspace-123', 'user-123');

      expect(result).toMatchObject({
        id: 'membership-123',
        role: 'owner',
      });

      expect(prisma.membership.findUnique).toHaveBeenCalledWith({
        where: {
          workspaceId_userId: { workspaceId: 'workspace-123', userId: 'user-123' },
        },
      });
    });

    it('should return null if membership not found', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

      const result = await membershipService.get('workspace-123', 'non-member');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // IS MEMBER
  // ============================================================================

  describe('isMember', () => {
    it('should return true if user is a member', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(createMockMembership());

      const result = await membershipService.isMember('workspace-123', 'user-123');

      expect(result).toBe(true);
    });

    it('should return false if user is not a member', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

      const result = await membershipService.isMember('workspace-123', 'non-member');

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // GET ROLE
  // ============================================================================

  describe('getRole', () => {
    it('should return user role in workspace', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(
        createMockMembership({ role: 'admin' as MembershipRole })
      );

      const result = await membershipService.getRole('workspace-123', 'user-123');

      expect(result).toBe('admin');
    });

    it('should return null if not a member', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

      const result = await membershipService.getRole('workspace-123', 'non-member');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // LIST MEMBERS
  // ============================================================================

  describe('listMembers', () => {
    it('should return all members with user info', async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue([
        {
          ...createMockMembership({ role: 'owner' as MembershipRole }),
          user: { id: 'user-1', email: 'owner@example.com', displayName: 'Owner' },
        },
        {
          ...createMockMembership({ id: 'mem-2', userId: 'user-2', role: 'member' as MembershipRole }),
          user: { id: 'user-2', email: 'member@example.com', displayName: 'Member' },
        },
      ] as any);

      const result = await membershipService.listMembers('workspace-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        userId: 'user-123',
        email: 'owner@example.com',
        displayName: 'Owner',
        role: 'owner',
      });
    });

    it('should order by role and creation date', async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue([]);

      await membershipService.listMembers('workspace-123');

      expect(prisma.membership.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-123' },
        include: expect.any(Object),
        orderBy: [
          { role: 'asc' },
          { createdAt: 'asc' },
        ],
      });
    });
  });

  // ============================================================================
  // ADD MEMBER
  // ============================================================================

  describe('addMember', () => {
    it('should add a new member successfully', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
        ...createMockWorkspace({ type: 'family' as WorkspaceType }),
        _count: { memberships: 3 },
      } as any);

      const mockMembership = createMockMembership({
        userId: 'new-user',
        role: 'member' as MembershipRole,
      });
      vi.mocked(prisma.membership.create).mockResolvedValue(mockMembership);

      const result = await membershipService.addMember('workspace-123', 'new-user', 'member');

      expect(result.userId).toBe('new-user');
      expect(result.role).toBe('member');
    });

    it('should throw ConflictError if user is already a member', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(createMockMembership());

      await expect(
        membershipService.addMember('workspace-123', 'existing-user', 'member')
      ).rejects.toThrow('User is already a member');
    });

    it('should throw ForbiddenError if workspace is at member limit', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
        ...createMockWorkspace({ type: 'personal' as WorkspaceType }),
        _count: { memberships: 1 },
      } as any);

      await expect(
        membershipService.addMember('workspace-123', 'new-user', 'member')
      ).rejects.toThrow('member limit');
    });

    it('should throw ValidationError if trying to add as owner', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
        ...createMockWorkspace({ type: 'family' as WorkspaceType }),
        _count: { memberships: 1 },
      } as any);

      await expect(
        membershipService.addMember('workspace-123', 'new-user', 'owner')
      ).rejects.toThrow('Cannot add member as owner');
    });
  });

  // ============================================================================
  // UPDATE ROLE
  // ============================================================================

  describe('updateRole', () => {
    it('should update member role successfully', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({
        ...createMockMembership({ role: 'member' as MembershipRole }),
        workspace: createMockWorkspace(),
      } as any);

      vi.mocked(prisma.membership.update).mockResolvedValue(
        createMockMembership({ role: 'admin' as MembershipRole })
      );

      const result = await membershipService.updateRole(
        'workspace-123',
        'membership-123',
        'admin',
        'owner-user'
      );

      expect(result.role).toBe('admin');
    });

    it('should throw NotFoundError if membership not found', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

      await expect(
        membershipService.updateRole('workspace-123', 'nonexistent', 'admin', 'owner')
      ).rejects.toThrow();
    });

    it('should throw ForbiddenError when trying to change owner role', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({
        ...createMockMembership({ role: 'owner' as MembershipRole }),
        workspace: createMockWorkspace(),
      } as any);

      await expect(
        membershipService.updateRole('workspace-123', 'membership-123', 'admin', 'user')
      ).rejects.toThrow('Cannot change owner role');
    });

    it('should throw ValidationError when trying to set role to owner', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({
        ...createMockMembership({ role: 'admin' as MembershipRole }),
        workspace: createMockWorkspace(),
      } as any);

      await expect(
        membershipService.updateRole('workspace-123', 'membership-123', 'owner', 'owner-user')
      ).rejects.toThrow('Cannot change role to owner');
    });

    it('should throw ForbiddenError when non-owner tries to change own role', async () => {
      const membership = {
        ...createMockMembership({ userId: 'actor-user', role: 'admin' as MembershipRole }),
        workspace: createMockWorkspace(),
      };

      vi.mocked(prisma.membership.findUnique)
        .mockResolvedValueOnce(membership as any) // First call for target membership
        .mockResolvedValueOnce({ ...membership, role: 'admin' } as any); // Actor's membership

      await expect(
        membershipService.updateRole('workspace-123', 'membership-123', 'member', 'actor-user')
      ).rejects.toThrow('Cannot change your own role');
    });
  });

  // ============================================================================
  // REMOVE MEMBER
  // ============================================================================

  describe('removeMember', () => {
    it('should remove member successfully', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(
        createMockMembership({ userId: 'other-user', role: 'member' as MembershipRole })
      );

      // Actor is owner
      vi.mocked(prisma.membership.findUnique).mockResolvedValueOnce(
        createMockMembership({ userId: 'other-user', role: 'member' as MembershipRole })
      );

      await membershipService.removeMember('workspace-123', 'membership-123', 'other-user');

      expect(prisma.membership.delete).toHaveBeenCalledWith({
        where: { id: 'membership-123' },
      });
    });

    it('should throw NotFoundError if membership not found', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

      await expect(
        membershipService.removeMember('workspace-123', 'nonexistent', 'owner')
      ).rejects.toThrow();
    });

    it('should throw ForbiddenError when trying to remove owner', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(
        createMockMembership({ role: 'owner' as MembershipRole })
      );

      await expect(
        membershipService.removeMember('workspace-123', 'owner-membership', 'user')
      ).rejects.toThrow('Cannot remove workspace owner');
    });

    it('should allow member to leave (remove themselves)', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(
        createMockMembership({ userId: 'leaving-user', role: 'member' as MembershipRole })
      );

      await membershipService.removeMember('workspace-123', 'membership-123', 'leaving-user');

      expect(prisma.membership.delete).toHaveBeenCalled();
    });

    it('should throw ForbiddenError if non-owner tries to remove others', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(
        createMockMembership({ userId: 'target-user', role: 'member' as MembershipRole })
      );

      // Mock getRole to return 'member' for actor
      vi.mocked(prisma.membership.findUnique)
        .mockResolvedValueOnce(createMockMembership({ userId: 'target-user', role: 'member' as MembershipRole }))
        .mockResolvedValueOnce(createMockMembership({ userId: 'actor-user', role: 'member' as MembershipRole }));

      await expect(
        membershipService.removeMember('workspace-123', 'membership-123', 'actor-user')
      ).rejects.toThrow('Only owner can remove members');
    });
  });

  // ============================================================================
  // TRANSFER OWNERSHIP
  // ============================================================================

  describe('transferOwnership', () => {
    it('should transfer ownership successfully', async () => {
      const currentOwnerMembership = createMockMembership({
        id: 'current-owner-mem',
        userId: 'current-owner',
        role: 'owner' as MembershipRole,
      });

      const newOwnerMembership = createMockMembership({
        id: 'new-owner-mem',
        userId: 'new-owner',
        role: 'admin' as MembershipRole,
      });

      vi.mocked(prisma.membership.findUnique)
        .mockResolvedValueOnce(currentOwnerMembership)
        .mockResolvedValueOnce(newOwnerMembership);

      vi.mocked(prisma.$transaction).mockResolvedValue(undefined);

      await membershipService.transferOwnership('workspace-123', 'new-owner', 'current-owner');

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw ForbiddenError if current user is not owner', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(
        createMockMembership({ role: 'admin' as MembershipRole })
      );

      await expect(
        membershipService.transferOwnership('workspace-123', 'new-owner', 'non-owner')
      ).rejects.toThrow('Only owner can transfer ownership');
    });

    it('should throw NotFoundError if new owner is not a member', async () => {
      vi.mocked(prisma.membership.findUnique)
        .mockResolvedValueOnce(createMockMembership({ role: 'owner' as MembershipRole }))
        .mockResolvedValueOnce(null);

      await expect(
        membershipService.transferOwnership('workspace-123', 'non-member', 'owner')
      ).rejects.toThrow();
    });
  });
});
