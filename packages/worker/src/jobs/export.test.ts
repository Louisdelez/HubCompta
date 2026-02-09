// ============================================================================
// EXPORT JOB TESTS - Finance Hub Worker
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExportJobData } from './types.js';

// ----------------------------------------------------------------------------
// Mocks - Must be hoisted, so use vi.hoisted
// ----------------------------------------------------------------------------

const { mockPrismaClient, mockUploadFile } = vi.hoisted(() => ({
  mockPrismaClient: {
    transaction: {
      findMany: vi.fn(),
    },
  },
  mockUploadFile: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: mockPrismaClient,
}));

vi.mock('../lib/storage.js', () => ({
  uploadFile: mockUploadFile,
}));

// Import the module after mocking
import { handleExportJob } from './export.js';

// ----------------------------------------------------------------------------
// Test Fixtures
// ----------------------------------------------------------------------------

const sampleTransactions = [
  {
    id: 'tx-1',
    date: new Date('2024-01-01'),
    description: 'Grocery Store',
    amount: -50.0,
    type: 'expense',
    account: { name: 'Checking Account' },
    category: { name: 'Food' },
  },
  {
    id: 'tx-2',
    date: new Date('2024-01-02'),
    description: 'Salary',
    amount: 2500.0,
    type: 'income',
    account: { name: 'Checking Account' },
    category: { name: 'Income' },
  },
  {
    id: 'tx-3',
    date: new Date('2024-01-03'),
    description: 'Electric Bill',
    amount: -120.5,
    type: 'expense',
    account: { name: 'Savings Account' },
    category: null,
  },
];

function createExportJobData(overrides: Partial<ExportJobData> = {}): ExportJobData {
  return {
    exportId: 'export-1',
    workspaceId: 'workspace-1',
    userId: 'user-1',
    format: 'csv',
    includeDocuments: false,
    ...overrides,
  };
}

// ----------------------------------------------------------------------------
// Tests: CSV Generation
// ----------------------------------------------------------------------------

describe('Export Job - CSV Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should generate CSV with correct headers', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue(sampleTransactions);

    await handleExportJob(createExportJobData());

    const uploadCall = mockUploadFile.mock.calls[0];
    const content = uploadCall[1].toString('utf-8');
    const headers = content.split('\n')[0];

    expect(headers).toBe('Date;Description;Montant;Type;Compte;Catégorie');
  });

  it('should format transaction data correctly in CSV', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([sampleTransactions[0]]);

    await handleExportJob(createExportJobData());

    const uploadCall = mockUploadFile.mock.calls[0];
    const content = uploadCall[1].toString('utf-8');
    const lines = content.split('\n');

    expect(lines[1]).toContain('2024-01-01');
    expect(lines[1]).toContain('Grocery Store');
    expect(lines[1]).toContain('-50.00');
    expect(lines[1]).toContain('expense');
    expect(lines[1]).toContain('Checking Account');
    expect(lines[1]).toContain('Food');
  });

  it('should escape quotes in description', async () => {
    const transactionWithQuotes = [
      {
        id: 'tx-1',
        date: new Date('2024-01-01'),
        description: 'Store "Name"',
        amount: -50.0,
        type: 'expense',
        account: { name: 'Checking' },
        category: { name: 'Shopping' },
      },
    ];

    mockPrismaClient.transaction.findMany.mockResolvedValue(transactionWithQuotes);

    await handleExportJob(createExportJobData());

    const uploadCall = mockUploadFile.mock.calls[0];
    const content = uploadCall[1].toString('utf-8');

    expect(content).toContain('Store ""Name""');
  });

  it('should handle transactions without category', async () => {
    const transactionNoCategory = [
      {
        id: 'tx-1',
        date: new Date('2024-01-01'),
        description: 'Test',
        amount: -50.0,
        type: 'expense',
        account: { name: 'Checking' },
        category: null,
      },
    ];

    mockPrismaClient.transaction.findMany.mockResolvedValue(transactionNoCategory);

    await handleExportJob(createExportJobData());

    const uploadCall = mockUploadFile.mock.calls[0];
    const content = uploadCall[1].toString('utf-8');
    const lines = content.split('\n');

    // Last field should be empty for category
    expect(lines[1].endsWith('""')).toBe(true);
  });

  it('should generate empty CSV with headers for no transactions', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    await handleExportJob(createExportJobData());

    const uploadCall = mockUploadFile.mock.calls[0];
    const content = uploadCall[1].toString('utf-8');
    const lines = content.split('\n').filter((l: string) => l.trim());

    expect(lines.length).toBe(1); // Only headers
    expect(lines[0]).toContain('Date;Description');
  });

  it('should format amounts with two decimal places', async () => {
    const transactionWithDecimals = [
      {
        id: 'tx-1',
        date: new Date('2024-01-01'),
        description: 'Test',
        amount: -50.1,
        type: 'expense',
        account: { name: 'Checking' },
        category: { name: 'Test' },
      },
    ];

    mockPrismaClient.transaction.findMany.mockResolvedValue(transactionWithDecimals);

    await handleExportJob(createExportJobData());

    const uploadCall = mockUploadFile.mock.calls[0];
    const content = uploadCall[1].toString('utf-8');

    expect(content).toContain('-50.10');
  });

  it('should generate JSON when format is not csv', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue(sampleTransactions);

    await handleExportJob(
      createExportJobData({ format: 'pdf' })
    );

    const uploadCall = mockUploadFile.mock.calls[0];
    expect(uploadCall[0]).toContain('.json');
    expect(uploadCall[2]).toBe('application/json');

    const content = uploadCall[1].toString('utf-8');
    const parsed = JSON.parse(content);
    expect(parsed).toHaveLength(3);
  });

  it('should set correct mime type for CSV', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    await handleExportJob(createExportJobData({ format: 'csv' }));

    const uploadCall = mockUploadFile.mock.calls[0];
    expect(uploadCall[2]).toBe('text/csv');
  });

  it('should use correct filename for CSV export', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    await handleExportJob(createExportJobData({ exportId: 'my-export-123' }));

    const uploadCall = mockUploadFile.mock.calls[0];
    expect(uploadCall[0]).toContain('export_my-export-123.csv');
  });
});

// ----------------------------------------------------------------------------
// Tests: Data Filtering
// ----------------------------------------------------------------------------

describe('Export Job - Data Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should filter transactions by workspace', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    await handleExportJob(createExportJobData({ workspaceId: 'workspace-123' }));

    expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-123',
          deletedAt: null,
        }),
      })
    );
  });

  it('should filter transactions by date range', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    await handleExportJob(
      createExportJobData({
        dateRange: {
          from: '2024-01-01',
          to: '2024-01-31',
        },
      })
    );

    expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-01-31'),
          },
        }),
      })
    );
  });

  it('should filter transactions by account IDs', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    await handleExportJob(
      createExportJobData({
        accountIds: ['account-1', 'account-2'],
      })
    );

    expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId: { in: ['account-1', 'account-2'] },
        }),
      })
    );
  });

  it('should combine date range and account filters', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    await handleExportJob(
      createExportJobData({
        dateRange: { from: '2024-01-01', to: '2024-01-31' },
        accountIds: ['account-1'],
      })
    );

    expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-01-31'),
          },
          accountId: { in: ['account-1'] },
        }),
      })
    );
  });

  it('should not apply date filter when dateRange is not provided', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    await handleExportJob(createExportJobData({}));

    const call = mockPrismaClient.transaction.findMany.mock.calls[0][0];
    expect(call.where.date).toBeUndefined();
  });

  it('should not apply account filter when accountIds is not provided', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    await handleExportJob(createExportJobData({}));

    const call = mockPrismaClient.transaction.findMany.mock.calls[0][0];
    expect(call.where.accountId).toBeUndefined();
  });

  it('should not apply account filter when accountIds is empty array', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    await handleExportJob(createExportJobData({ accountIds: [] }));

    const call = mockPrismaClient.transaction.findMany.mock.calls[0][0];
    expect(call.where.accountId).toBeUndefined();
  });

  it('should include account and category relations in query', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    await handleExportJob(createExportJobData());

    expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          account: { select: { name: true } },
          category: { select: { name: true } },
        },
      })
    );
  });

  it('should order transactions by date descending', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    await handleExportJob(createExportJobData());

    expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { date: 'desc' },
      })
    );
  });

  it('should exclude soft-deleted transactions', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    await handleExportJob(createExportJobData());

    expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
        }),
      })
    );
  });
});

// ----------------------------------------------------------------------------
// Tests: Export Result
// ----------------------------------------------------------------------------

describe('Export Job - Export Result', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return correct storage key', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    const result = await handleExportJob(
      createExportJobData({
        workspaceId: 'workspace-123',
        exportId: 'export-456',
      })
    );

    expect(result.storageKey).toBe('exports/workspace-123/export_export-456.csv');
  });

  it('should return correct filename', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    const result = await handleExportJob(createExportJobData({ exportId: 'test-export' }));

    expect(result.filename).toBe('export_test-export.csv');
  });

  it('should return file size', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue(sampleTransactions);

    const result = await handleExportJob(createExportJobData());

    expect(result.size).toBeGreaterThan(0);
  });

  it('should return expiration date 7 days in future', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    const beforeCall = new Date();
    const result = await handleExportJob(createExportJobData());
    const afterCall = new Date();

    const expiresAt = new Date(result.expiresAt);
    const sevenDaysFromBefore = new Date(beforeCall);
    sevenDaysFromBefore.setDate(sevenDaysFromBefore.getDate() + 7);

    const sevenDaysFromAfter = new Date(afterCall);
    sevenDaysFromAfter.setDate(sevenDaysFromAfter.getDate() + 7);

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(sevenDaysFromBefore.getTime() - 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(sevenDaysFromAfter.getTime() + 1000);
  });

  it('should upload file to correct storage path', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    await handleExportJob(
      createExportJobData({
        workspaceId: 'ws-1',
        exportId: 'exp-1',
        format: 'csv',
      })
    );

    expect(mockUploadFile).toHaveBeenCalledWith(
      'exports/ws-1/export_exp-1.csv',
      expect.any(Buffer),
      'text/csv'
    );
  });
});

// ----------------------------------------------------------------------------
// Tests: Edge Cases
// ----------------------------------------------------------------------------

describe('Export Job - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should handle large number of transactions', async () => {
    const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
      id: `tx-${i}`,
      date: new Date('2024-01-01'),
      description: `Transaction ${i}`,
      amount: -50.0 * (i + 1),
      type: 'expense',
      account: { name: 'Checking' },
      category: { name: 'Test' },
    }));

    mockPrismaClient.transaction.findMany.mockResolvedValue(largeDataset);

    const result = await handleExportJob(createExportJobData());

    expect(result.size).toBeGreaterThan(0);
    expect(mockUploadFile).toHaveBeenCalled();
  });

  it('should handle special characters in descriptions', async () => {
    const transactionsWithSpecialChars = [
      {
        id: 'tx-1',
        date: new Date('2024-01-01'),
        description: 'Test\nNew Line',
        amount: -50.0,
        type: 'expense',
        account: { name: 'Checking' },
        category: { name: 'Test' },
      },
      {
        id: 'tx-2',
        date: new Date('2024-01-01'),
        description: 'Test;Semicolon',
        amount: -50.0,
        type: 'expense',
        account: { name: 'Checking' },
        category: { name: 'Test' },
      },
    ];

    mockPrismaClient.transaction.findMany.mockResolvedValue(transactionsWithSpecialChars);

    await handleExportJob(createExportJobData());

    expect(mockUploadFile).toHaveBeenCalled();
  });

  it('should handle unicode characters', async () => {
    const transactionsWithUnicode = [
      {
        id: 'tx-1',
        date: new Date('2024-01-01'),
        description: 'Cafe - Paris',
        amount: -15.0,
        type: 'expense',
        account: { name: 'Credit Card' },
        category: { name: 'Restauration' },
      },
    ];

    mockPrismaClient.transaction.findMany.mockResolvedValue(transactionsWithUnicode);

    await handleExportJob(createExportJobData());

    const uploadCall = mockUploadFile.mock.calls[0];
    const content = uploadCall[1].toString('utf-8');

    expect(content).toContain('Cafe');
  });

  it('should handle transactions with Decimal amounts (Prisma)', async () => {
    const transactionsWithDecimal = [
      {
        id: 'tx-1',
        date: new Date('2024-01-01'),
        description: 'Test',
        // Prisma returns Decimal objects which have toString() method
        amount: { toString: () => '-123.45' },
        type: 'expense',
        account: { name: 'Checking' },
        category: { name: 'Test' },
      },
    ];

    mockPrismaClient.transaction.findMany.mockResolvedValue(transactionsWithDecimal);

    await handleExportJob(createExportJobData());

    expect(mockUploadFile).toHaveBeenCalled();
  });

  it('should handle upload failure gracefully', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue(sampleTransactions);
    mockUploadFile.mockRejectedValue(new Error('Storage unavailable'));

    await expect(handleExportJob(createExportJobData())).rejects.toThrow('Storage unavailable');
  });

  it('should handle database query failure gracefully', async () => {
    mockPrismaClient.transaction.findMany.mockRejectedValue(new Error('Database error'));

    await expect(handleExportJob(createExportJobData())).rejects.toThrow('Database error');
  });
});

// ----------------------------------------------------------------------------
// Tests: JSON Format
// ----------------------------------------------------------------------------

describe('Export Job - JSON Format', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should generate valid JSON structure', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue(sampleTransactions);

    await handleExportJob(createExportJobData({ format: 'pdf' }));

    const uploadCall = mockUploadFile.mock.calls[0];
    const content = uploadCall[1].toString('utf-8');

    const parsed = JSON.parse(content);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toHaveProperty('date');
    expect(parsed[0]).toHaveProperty('description');
    expect(parsed[0]).toHaveProperty('amount');
    expect(parsed[0]).toHaveProperty('type');
    expect(parsed[0]).toHaveProperty('account');
    expect(parsed[0]).toHaveProperty('category');
  });

  it('should format JSON with proper indentation', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([sampleTransactions[0]]);

    await handleExportJob(createExportJobData({ format: 'pdf' }));

    const uploadCall = mockUploadFile.mock.calls[0];
    const content = uploadCall[1].toString('utf-8');

    // Check for indentation (2 spaces)
    expect(content).toContain('  ');
    expect(content.split('\n').length).toBeGreaterThan(1);
  });

  it('should use .json extension for non-CSV format', async () => {
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    const result = await handleExportJob(
      createExportJobData({ format: 'pdf', exportId: 'test-123' })
    );

    expect(result.filename).toBe('export_test-123.json');
    expect(result.storageKey).toContain('.json');
  });
});
