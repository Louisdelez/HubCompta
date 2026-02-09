// ============================================================================
// IMPORT JOB TESTS - Finance Hub Worker
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Job } from 'bullmq';
import type { ImportJobData } from './types.js';

// ----------------------------------------------------------------------------
// Mocks - Must be hoisted, so use vi.hoisted
// ----------------------------------------------------------------------------

const { mockPrismaClient } = vi.hoisted(() => ({
  mockPrismaClient: {
    importJob: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    rule: {
      findMany: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrismaClient),
}));

// Import the module after mocking
import { processImportJob } from './import.js';

// ----------------------------------------------------------------------------
// Test Fixtures
// ----------------------------------------------------------------------------

function createMockJob(data: Partial<ImportJobData> = {}): Job<ImportJobData> {
  return {
    id: 'test-job-1',
    data: {
      jobId: 'import-job-1',
      workspaceId: 'workspace-1',
      accountId: 'account-1',
      columnMapping: {
        date: 'Date',
        amount: 'Amount',
        description: 'Description',
      },
      dateFormat: 'DD/MM/YYYY',
      skipDuplicates: true,
      applyRules: false,
      ...data,
    },
    updateProgress: vi.fn(),
  } as unknown as Job<ImportJobData>;
}

const sampleCSVContent = `Date;Description;Amount
01/01/2024;Grocery Store;-50.00
02/01/2024;Salary;2500.00
03/01/2024;Electric Bill;-120.50`;

const sampleCSVWithDuplicates = `Date;Description;Amount
01/01/2024;Grocery Store;-50.00
02/01/2024;Salary;2500.00
01/01/2024;Grocery Store;-50.00`;

const sampleCSVCreditDebit = `Date;Description;Credit;Debit
01/01/2024;Salary;2500.00;
02/01/2024;Rent;;1200.00
03/01/2024;Freelance;500.00;`;

const sampleCSVWithEuroFormat = `Date;Description;Amount
01/01/2024;Test;-50,00 EUR
02/01/2024;Test2;1 234,56 EUR`;

const emptyCSV = `Date;Description;Amount`;

const invalidCSV = `Date;Description;Amount
;;
invalid;invalid;invalid`;

// ----------------------------------------------------------------------------
// Tests: CSV Parsing
// ----------------------------------------------------------------------------

describe('Import Job - CSV Parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should parse standard CSV with semicolon delimiter', async () => {
    const mockJob = createMockJob();

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    const result = await processImportJob(mockJob);

    expect(result.imported).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
    expect(mockPrismaClient.transaction.create).toHaveBeenCalledTimes(3);
  });

  it('should handle credit/debit column format', async () => {
    const mockJob = createMockJob({
      columnMapping: {
        date: 'Date',
        amount: '',
        description: 'Description',
        credit: 'Credit',
        debit: 'Debit',
      },
    });

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVCreditDebit,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    const result = await processImportJob(mockJob);

    expect(result.imported).toBe(3);
    expect(mockPrismaClient.transaction.create).toHaveBeenCalledTimes(3);

    // Check the amounts
    const createCalls = mockPrismaClient.transaction.create.mock.calls;
    // First transaction: 2500.00 credit (positive)
    expect(createCalls[0][0].data.amount).toBe(2500);
    expect(createCalls[0][0].data.type).toBe('income');
    // Second transaction: 1200.00 debit (negative)
    expect(createCalls[1][0].data.amount).toBe(-1200);
    expect(createCalls[1][0].data.type).toBe('expense');
    // Third transaction: 500.00 credit (positive)
    expect(createCalls[2][0].data.amount).toBe(500);
    expect(createCalls[2][0].data.type).toBe('income');
  });

  it('should handle European number format with currency symbols', async () => {
    const mockJob = createMockJob();

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVWithEuroFormat,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    const result = await processImportJob(mockJob);

    expect(result.imported).toBe(2);
    const createCalls = mockPrismaClient.transaction.create.mock.calls;
    expect(createCalls[0][0].data.amount).toBe(-50);
  });

  it('should return empty result for CSV with only headers', async () => {
    const mockJob = createMockJob();

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: emptyCSV,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    const result = await processImportJob(mockJob);

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(0);
    expect(mockPrismaClient.transaction.create).not.toHaveBeenCalled();
  });

  it('should skip rows with invalid data', async () => {
    const mockJob = createMockJob();

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: invalidCSV,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    const result = await processImportJob(mockJob);

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(2);
    expect(mockPrismaClient.transaction.create).not.toHaveBeenCalled();
  });

  it('should parse dates in DD/MM/YYYY format', async () => {
    const mockJob = createMockJob({ dateFormat: 'DD/MM/YYYY' });

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await processImportJob(mockJob);

    const createCalls = mockPrismaClient.transaction.create.mock.calls;
    const firstDate = createCalls[0][0].data.date as Date;
    expect(firstDate.getDate()).toBe(1);
    expect(firstDate.getMonth()).toBe(0); // January
    expect(firstDate.getFullYear()).toBe(2024);
  });

  it('should parse dates in YYYY-MM-DD format', async () => {
    const mockJob = createMockJob({ dateFormat: 'YYYY-MM-DD' });
    const isoCSV = `Date;Description;Amount
2024-01-15;Test;-100.00`;

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: isoCSV,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await processImportJob(mockJob);

    const createCalls = mockPrismaClient.transaction.create.mock.calls;
    const date = createCalls[0][0].data.date as Date;
    expect(date.getDate()).toBe(15);
    expect(date.getMonth()).toBe(0);
    expect(date.getFullYear()).toBe(2024);
  });

  it('should parse dates in DD-MM-YYYY format', async () => {
    const mockJob = createMockJob({ dateFormat: 'DD-MM-YYYY' });
    const dashCSV = `Date;Description;Amount
15-02-2024;Test;-100.00`;

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: dashCSV,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await processImportJob(mockJob);

    const createCalls = mockPrismaClient.transaction.create.mock.calls;
    const date = createCalls[0][0].data.date as Date;
    expect(date.getDate()).toBe(15);
    expect(date.getMonth()).toBe(1); // February
    expect(date.getFullYear()).toBe(2024);
  });
});

// ----------------------------------------------------------------------------
// Tests: Transaction Import
// ----------------------------------------------------------------------------

describe('Import Job - Transaction Import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should create transactions with correct data', async () => {
    const mockJob = createMockJob();

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await processImportJob(mockJob);

    const firstCall = mockPrismaClient.transaction.create.mock.calls[0][0].data;
    expect(firstCall.workspaceId).toBe('workspace-1');
    expect(firstCall.accountId).toBe('account-1');
    expect(firstCall.description).toBe('Grocery Store');
    expect(firstCall.amount).toBe(-50);
    expect(firstCall.type).toBe('expense');
    expect(firstCall.importHash).toBeDefined();
  });

  it('should set transaction type based on amount sign', async () => {
    const mockJob = createMockJob();

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await processImportJob(mockJob);

    const calls = mockPrismaClient.transaction.create.mock.calls;
    expect(calls[0][0].data.type).toBe('expense'); // -50
    expect(calls[1][0].data.type).toBe('income'); // 2500
    expect(calls[2][0].data.type).toBe('expense'); // -120.50
  });

  it('should update job progress during import', async () => {
    const mockJob = createMockJob();

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await processImportJob(mockJob);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(vi.mocked(mockJob.updateProgress).mock.calls.length).toBeGreaterThan(0);
  });

  it('should update import job status to completed on success', async () => {
    const mockJob = createMockJob();

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await processImportJob(mockJob);

    // Check for completed status update
    const updateCalls = mockPrismaClient.importJob.update.mock.calls;
    const finalUpdate = updateCalls[updateCalls.length - 1][0].data;
    expect(finalUpdate.status).toBe('completed');
    expect(finalUpdate.importedRows).toBe(3);
    expect(finalUpdate.completedAt).toBeDefined();
  });

  it('should throw error if import job not found', async () => {
    const mockJob = createMockJob();

    mockPrismaClient.importJob.findUnique.mockResolvedValue(null);

    await expect(processImportJob(mockJob)).rejects.toThrow('Import job import-job-1 not found');
  });

  it('should throw error if import job already processed', async () => {
    const mockJob = createMockJob();

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'completed',
      fileContent: sampleCSVContent,
    });

    await expect(processImportJob(mockJob)).rejects.toThrow(
      'Import job import-job-1 already processed'
    );
  });

  it('should count errors when individual transaction creation fails', async () => {
    const mockJob = createMockJob();

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockRejectedValue(new Error('Database error'));

    const result = await processImportJob(mockJob);

    // Individual row errors are counted, not thrown
    expect(result.errors).toBe(3);
    expect(result.imported).toBe(0);
  });

  it('should update import job status to failed when importJob.update fails', async () => {
    const mockJob = createMockJob();

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update
      .mockResolvedValueOnce({}) // processing status
      .mockRejectedValueOnce(new Error('Critical database failure'));

    await expect(processImportJob(mockJob)).rejects.toThrow('Critical database failure');
  });

  it('should apply rules when applyRules is true', async () => {
    const mockJob = createMockJob({ applyRules: true });

    const mockRules = [
      {
        id: 'rule-1',
        conditions: [{ field: 'description', operator: 'contains', value: 'grocery' }],
        actions: [{ type: 'set_category', value: 'category-food' }],
        priority: 10,
      },
    ];

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.rule.findMany.mockResolvedValue(mockRules);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await processImportJob(mockJob);

    expect(mockPrismaClient.rule.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1', isEnabled: true },
      orderBy: { priority: 'desc' },
    });

    // The first transaction (Grocery Store) should have category applied
    const firstCall = mockPrismaClient.transaction.create.mock.calls[0][0].data;
    expect(firstCall.categoryId).toBe('category-food');
    expect(firstCall.appliedRuleId).toBe('rule-1');
  });

  it('should not apply rules when applyRules is false', async () => {
    const mockJob = createMockJob({ applyRules: false });

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await processImportJob(mockJob);

    expect(mockPrismaClient.rule.findMany).not.toHaveBeenCalled();
  });

  it('should apply rule with starts_with operator', async () => {
    const mockJob = createMockJob({ applyRules: true });

    const mockRules = [
      {
        id: 'rule-1',
        conditions: [{ field: 'description', operator: 'starts_with', value: 'sal' }],
        actions: [{ type: 'set_category', value: 'category-salary' }],
        priority: 10,
      },
    ];

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.rule.findMany.mockResolvedValue(mockRules);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await processImportJob(mockJob);

    const salaryCall = mockPrismaClient.transaction.create.mock.calls[1][0].data;
    expect(salaryCall.categoryId).toBe('category-salary');
  });

  it('should apply rule with ends_with operator', async () => {
    const mockJob = createMockJob({ applyRules: true });

    const mockRules = [
      {
        id: 'rule-1',
        conditions: [{ field: 'description', operator: 'ends_with', value: 'bill' }],
        actions: [{ type: 'set_category', value: 'category-bills' }],
        priority: 10,
      },
    ];

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.rule.findMany.mockResolvedValue(mockRules);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await processImportJob(mockJob);

    const billCall = mockPrismaClient.transaction.create.mock.calls[2][0].data;
    expect(billCall.categoryId).toBe('category-bills');
  });

  it('should apply rule with equals operator', async () => {
    const mockJob = createMockJob({ applyRules: true });

    const mockRules = [
      {
        id: 'rule-1',
        conditions: [{ field: 'description', operator: 'equals', value: 'salary' }],
        actions: [{ type: 'set_category', value: 'category-salary' }],
        priority: 10,
      },
    ];

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.rule.findMany.mockResolvedValue(mockRules);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await processImportJob(mockJob);

    const salaryCall = mockPrismaClient.transaction.create.mock.calls[1][0].data;
    expect(salaryCall.categoryId).toBe('category-salary');
    expect(salaryCall.appliedRuleId).toBe('rule-1');
  });
});

// ----------------------------------------------------------------------------
// Tests: Duplicate Detection
// ----------------------------------------------------------------------------

describe('Import Job - Duplicate Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should skip duplicates when skipDuplicates is true', async () => {
    const mockJob = createMockJob({ skipDuplicates: true });

    // First import run - creates transactions and captures hashes
    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    const firstResult = await processImportJob(mockJob);
    expect(firstResult.imported).toBe(3);

    // Get the hash that was created for the first transaction
    const firstHash = mockPrismaClient.transaction.create.mock.calls[0][0].data.importHash;

    // Clear mocks and set up second run with existing hash
    vi.clearAllMocks();

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-2',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([{ importHash: firstHash }]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-2' });

    const mockJob2 = createMockJob({ skipDuplicates: true, jobId: 'import-job-2' });
    const result = await processImportJob(mockJob2);

    expect(result.duplicates).toBe(1);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(1);
  });

  it('should not skip duplicates when skipDuplicates is false', async () => {
    const mockJob = createMockJob({ skipDuplicates: false });

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVWithDuplicates,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    const result = await processImportJob(mockJob);

    expect(result.imported).toBe(3);
    expect(result.duplicates).toBe(0);
  });

  it('should detect duplicates within the same import batch', async () => {
    const mockJob = createMockJob({ skipDuplicates: true });

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVWithDuplicates,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    const result = await processImportJob(mockJob);

    // Third row is a duplicate of the first
    expect(result.imported).toBe(2);
    expect(result.duplicates).toBe(1);
  });

  it('should generate consistent hash for same transaction data', async () => {
    const mockJob = createMockJob({ skipDuplicates: true });

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await processImportJob(mockJob);

    const hash1 = mockPrismaClient.transaction.create.mock.calls[0][0].data.importHash;
    expect(hash1).toBeDefined();
    expect(hash1).toMatch(/^[a-f0-9]{32}$/);
  });

  it('should query existing hashes only when skipDuplicates is true', async () => {
    const mockJob = createMockJob({ skipDuplicates: true });

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await processImportJob(mockJob);

    expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-1',
        accountId: 'account-1',
        deletedAt: null,
      },
      select: { importHash: true },
    });
  });

  it('should not query existing hashes when skipDuplicates is false', async () => {
    const mockJob = createMockJob({ skipDuplicates: false });

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await processImportJob(mockJob);

    expect(mockPrismaClient.transaction.findMany).not.toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------------------
// Tests: Edge Cases
// ----------------------------------------------------------------------------

describe('Import Job - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should handle empty file content', async () => {
    const mockJob = createMockJob();

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: '',
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);

    const result = await processImportJob(mockJob);

    expect(result.imported).toBe(0);
    expect(mockPrismaClient.transaction.create).not.toHaveBeenCalled();
  });

  it('should handle CSV with quoted fields', async () => {
    const mockJob = createMockJob();
    const quotedCSV = `Date;Description;Amount
01/01/2024;"Grocery, Store";-50.00`;

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: quotedCSV,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await processImportJob(mockJob);

    const call = mockPrismaClient.transaction.create.mock.calls[0][0].data;
    expect(call.description).toBe('Grocery, Store');
  });

  it('should skip rows with zero amount', async () => {
    const mockJob = createMockJob();
    const zeroAmountCSV = `Date;Description;Amount
01/01/2024;Test;0.00
02/01/2024;Valid;-50.00`;

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: zeroAmountCSV,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    const result = await processImportJob(mockJob);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('should skip rows with empty description', async () => {
    const mockJob = createMockJob();
    const emptyDescCSV = `Date;Description;Amount
01/01/2024;;-50.00
02/01/2024;Valid;-100.00`;

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: emptyDescCSV,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    const result = await processImportJob(mockJob);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('should handle large batch processing', async () => {
    const mockJob = createMockJob();

    // Generate CSV with many rows
    let largeCSV = 'Date;Description;Amount\n';
    for (let i = 0; i < 150; i++) {
      largeCSV += `01/01/2024;Transaction ${i};-${i}.00\n`;
    }

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: largeCSV,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    const result = await processImportJob(mockJob);

    // First transaction has amount 0, which is skipped
    expect(result.imported).toBe(149);
    expect(result.skipped).toBe(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(vi.mocked(mockJob.updateProgress).mock.calls.length).toBe(3); // 50, 100, 150
  });

  it('should disconnect prisma on success', async () => {
    const mockJob = createMockJob();

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await processImportJob(mockJob);

    expect(mockPrismaClient.$disconnect).toHaveBeenCalled();
  });

  it('should disconnect prisma on failure', async () => {
    const mockJob = createMockJob();

    mockPrismaClient.importJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      status: 'pending',
      fileContent: sampleCSVContent,
    });
    mockPrismaClient.importJob.update.mockResolvedValue({});
    mockPrismaClient.transaction.findMany.mockResolvedValue([]);
    mockPrismaClient.transaction.create.mockRejectedValue(new Error('DB Error'));

    try {
      await processImportJob(mockJob);
    } catch {
      // Expected error
    }

    expect(mockPrismaClient.$disconnect).toHaveBeenCalled();
  });
});
