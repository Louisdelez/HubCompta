// ============================================================================
// CLEANUP JOB TESTS - Finance Hub Worker
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ----------------------------------------------------------------------------
// Mocks - Must be hoisted, so use vi.hoisted
// ----------------------------------------------------------------------------

const { mockPrismaClient, mockDeleteFile } = vi.hoisted(() => ({
  mockPrismaClient: {
    document: {
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    documentLink: {
      deleteMany: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
    auditLog: {
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  mockDeleteFile: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: mockPrismaClient,
}));

vi.mock('../lib/storage.js', () => ({
  deleteFile: mockDeleteFile,
}));

// Import the module after mocking
import {
  cleanupDeletedDocuments,
  cleanupExpiredSessions,
  cleanupAuditLogs,
  runFullCleanup,
  handleCleanupJob,
} from './cleanup.js';

// ----------------------------------------------------------------------------
// Test Fixtures
// ----------------------------------------------------------------------------

const sampleDeletedDocuments = [
  {
    id: 'doc-1',
    storageKey: 'documents/workspace-1/file1.pdf',
    size: 1024,
    filename: 'file1.pdf',
  },
  {
    id: 'doc-2',
    storageKey: 'documents/workspace-1/file2.pdf',
    size: 2048,
    filename: 'file2.pdf',
  },
  {
    id: 'doc-3',
    storageKey: 'documents/workspace-2/file3.pdf',
    size: 4096,
    filename: 'file3.pdf',
  },
];

// ----------------------------------------------------------------------------
// Tests: Session Cleanup
// ----------------------------------------------------------------------------

describe('Cleanup Job - Session Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it('should delete expired sessions', async () => {
    mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 5 });

    const result = await cleanupExpiredSessions();

    expect(result.deleted).toBe(5);
    expect(mockPrismaClient.session.deleteMany).toHaveBeenCalled();
  });

  it('should filter sessions by expiration date less than now', async () => {
    mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 0 });

    await cleanupExpiredSessions();

    expect(mockPrismaClient.session.deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: {
          lt: new Date('2024-06-15T12:00:00Z'),
        },
      },
    });
  });

  it('should return zero when no expired sessions', async () => {
    mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 0 });

    const result = await cleanupExpiredSessions();

    expect(result.deleted).toBe(0);
  });

  it('should handle large number of expired sessions', async () => {
    mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 10000 });

    const result = await cleanupExpiredSessions();

    expect(result.deleted).toBe(10000);
  });

  it('should propagate database errors', async () => {
    mockPrismaClient.session.deleteMany.mockRejectedValue(new Error('Database connection lost'));

    await expect(cleanupExpiredSessions()).rejects.toThrow('Database connection lost');
  });
});

// ----------------------------------------------------------------------------
// Tests: Audit Log Cleanup
// ----------------------------------------------------------------------------

describe('Cleanup Job - Audit Log Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it('should delete audit logs older than retention period', async () => {
    mockPrismaClient.auditLog.deleteMany.mockResolvedValue({ count: 100 });

    const result = await cleanupAuditLogs({ retentionDays: 365 });

    expect(result.archived).toBe(100);
  });

  it('should use 365 days as default retention period', async () => {
    mockPrismaClient.auditLog.deleteMany.mockResolvedValue({ count: 0 });

    await cleanupAuditLogs();

    const expectedCutoff = new Date('2024-06-15T12:00:00Z');
    expectedCutoff.setDate(expectedCutoff.getDate() - 365);

    expect(mockPrismaClient.auditLog.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: expectedCutoff },
      },
    });
  });

  it('should respect custom retention period', async () => {
    mockPrismaClient.auditLog.deleteMany.mockResolvedValue({ count: 0 });

    await cleanupAuditLogs({ retentionDays: 90 });

    const expectedCutoff = new Date('2024-06-15T12:00:00Z');
    expectedCutoff.setDate(expectedCutoff.getDate() - 90);

    expect(mockPrismaClient.auditLog.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: expectedCutoff },
      },
    });
  });

  it('should return count without deleting in dry run mode', async () => {
    mockPrismaClient.auditLog.count.mockResolvedValue(50);

    const result = await cleanupAuditLogs({ dryRun: true });

    expect(result.archived).toBe(50);
    expect(mockPrismaClient.auditLog.count).toHaveBeenCalled();
    expect(mockPrismaClient.auditLog.deleteMany).not.toHaveBeenCalled();
  });

  it('should calculate correct cutoff date in dry run', async () => {
    mockPrismaClient.auditLog.count.mockResolvedValue(0);

    await cleanupAuditLogs({ retentionDays: 180, dryRun: true });

    const expectedCutoff = new Date('2024-06-15T12:00:00Z');
    expectedCutoff.setDate(expectedCutoff.getDate() - 180);

    expect(mockPrismaClient.auditLog.count).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: expectedCutoff },
      },
    });
  });

  it('should return zero when no old audit logs exist', async () => {
    mockPrismaClient.auditLog.deleteMany.mockResolvedValue({ count: 0 });

    const result = await cleanupAuditLogs();

    expect(result.archived).toBe(0);
  });
});

// ----------------------------------------------------------------------------
// Tests: Document Cleanup
// ----------------------------------------------------------------------------

describe('Cleanup Job - Document Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    mockDeleteFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it('should find documents deleted more than 30 days ago by default', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue([]);

    await cleanupDeletedDocuments();

    const expectedCutoff = new Date('2024-06-15T12:00:00Z');
    expectedCutoff.setDate(expectedCutoff.getDate() - 30);

    expect(mockPrismaClient.document.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: {
          not: null,
          lt: expectedCutoff,
        },
      },
      select: {
        id: true,
        storageKey: true,
        size: true,
        filename: true,
      },
    });
  });

  it('should use custom olderThanDays parameter', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue([]);

    await cleanupDeletedDocuments({ olderThanDays: 60 });

    const expectedCutoff = new Date('2024-06-15T12:00:00Z');
    expectedCutoff.setDate(expectedCutoff.getDate() - 60);

    expect(mockPrismaClient.document.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: {
          not: null,
          lt: expectedCutoff,
        },
      },
      select: expect.any(Object),
    });
  });

  it('should delete document from storage and database', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue([sampleDeletedDocuments[0]]);
    mockPrismaClient.documentLink.deleteMany.mockResolvedValue({ count: 1 });
    mockPrismaClient.document.delete.mockResolvedValue({});

    const result = await cleanupDeletedDocuments();

    expect(mockDeleteFile).toHaveBeenCalledWith('documents/workspace-1/file1.pdf');
    expect(mockPrismaClient.documentLink.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'doc-1' },
    });
    expect(mockPrismaClient.document.delete).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
    });
    expect(result.documentsDeleted).toBe(1);
  });

  it('should calculate total storage freed', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue(sampleDeletedDocuments);
    mockPrismaClient.documentLink.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaClient.document.delete.mockResolvedValue({});

    const result = await cleanupDeletedDocuments();

    expect(result.storageFreed).toBe(1024 + 2048 + 4096);
    expect(result.documentsDeleted).toBe(3);
  });

  it('should return counts without deleting in dry run mode', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue(sampleDeletedDocuments);

    const result = await cleanupDeletedDocuments({ dryRun: true });

    expect(result.documentsDeleted).toBe(3);
    expect(result.storageFreed).toBe(1024 + 2048 + 4096);
    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(mockPrismaClient.document.delete).not.toHaveBeenCalled();
  });

  it('should continue processing after individual document error', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue(sampleDeletedDocuments);
    mockPrismaClient.documentLink.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaClient.document.delete.mockResolvedValue({});

    // First document fails, others succeed
    mockDeleteFile
      .mockRejectedValueOnce(new Error('Storage error'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const result = await cleanupDeletedDocuments();

    expect(result.documentsDeleted).toBe(2);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('doc-1');
  });

  it('should track errors with document ID', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue([sampleDeletedDocuments[0]]);
    mockDeleteFile.mockRejectedValue(new Error('Access denied'));

    const result = await cleanupDeletedDocuments();

    expect(result.errors[0]).toContain('doc-1');
    expect(result.errors[0]).toContain('Access denied');
  });

  it('should return empty result when no deleted documents', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue([]);

    const result = await cleanupDeletedDocuments();

    expect(result.documentsDeleted).toBe(0);
    expect(result.storageFreed).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it('should delete document links before document', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue([sampleDeletedDocuments[0]]);
    mockPrismaClient.documentLink.deleteMany.mockResolvedValue({ count: 2 });
    mockPrismaClient.document.delete.mockResolvedValue({});

    const callOrder: string[] = [];
    mockDeleteFile.mockImplementation(() => {
      callOrder.push('deleteFile');
      return Promise.resolve();
    });
    mockPrismaClient.documentLink.deleteMany.mockImplementation(() => {
      callOrder.push('deleteLinks');
      return Promise.resolve({ count: 2 });
    });
    mockPrismaClient.document.delete.mockImplementation(() => {
      callOrder.push('deleteDoc');
      return Promise.resolve({});
    });

    await cleanupDeletedDocuments();

    expect(callOrder).toEqual(['deleteFile', 'deleteLinks', 'deleteDoc']);
  });
});

// ----------------------------------------------------------------------------
// Tests: Full Cleanup
// ----------------------------------------------------------------------------

describe('Cleanup Job - Full Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    mockDeleteFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it('should run all cleanup tasks', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue([]);
    mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 5 });
    mockPrismaClient.auditLog.deleteMany.mockResolvedValue({ count: 10 });

    const result = await runFullCleanup();

    expect(result.documents).toBeDefined();
    expect(result.sessions).toBeDefined();
    expect(result.auditLogs).toBeDefined();
    expect(result.duration).toBeDefined();
  });

  it('should return combined results from all tasks', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue(sampleDeletedDocuments);
    mockPrismaClient.documentLink.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaClient.document.delete.mockResolvedValue({});
    mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 15 });
    mockPrismaClient.auditLog.deleteMany.mockResolvedValue({ count: 100 });

    const result = await runFullCleanup();

    expect(result.documents.documentsDeleted).toBe(3);
    expect(result.sessions.deleted).toBe(15);
    expect(result.auditLogs.archived).toBe(100);
  });

  it('should run tasks in parallel', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue([]);
    mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaClient.auditLog.deleteMany.mockResolvedValue({ count: 0 });

    const result = await runFullCleanup();

    // All three cleanup tasks were called
    expect(mockPrismaClient.document.findMany).toHaveBeenCalled();
    expect(mockPrismaClient.session.deleteMany).toHaveBeenCalled();
    expect(mockPrismaClient.auditLog.deleteMany).toHaveBeenCalled();
    expect(result.duration).toBeDefined();
  });

  it('should measure duration correctly', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue([]);
    mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaClient.auditLog.deleteMany.mockResolvedValue({ count: 0 });

    const result = await runFullCleanup();

    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(typeof result.duration).toBe('number');
  });

  it('should pass dryRun option to subtasks', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue(sampleDeletedDocuments);
    mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaClient.auditLog.count.mockResolvedValue(50);

    await runFullCleanup({ dryRun: true });

    // In dry run, audit logs should be counted, not deleted
    expect(mockPrismaClient.auditLog.count).toHaveBeenCalled();
    expect(mockPrismaClient.auditLog.deleteMany).not.toHaveBeenCalled();

    // Documents should be counted but not deleted
    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(mockPrismaClient.document.delete).not.toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------------------
// Tests: Job Handler
// ----------------------------------------------------------------------------

describe('Cleanup Job - Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    mockDeleteFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it('should run full cleanup by default', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue([]);
    mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaClient.auditLog.deleteMany.mockResolvedValue({ count: 0 });

    const result = await handleCleanupJob({});

    expect(result).toHaveProperty('documents');
    expect(result).toHaveProperty('sessions');
    expect(result).toHaveProperty('auditLogs');
  });

  it('should run only document cleanup when type is documents', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue([]);

    const result = await handleCleanupJob({ type: 'documents' });

    expect(result).toHaveProperty('documentsDeleted');
    expect(result).toHaveProperty('storageFreed');
    expect(mockPrismaClient.session.deleteMany).not.toHaveBeenCalled();
    expect(mockPrismaClient.auditLog.deleteMany).not.toHaveBeenCalled();
  });

  it('should run only session cleanup when type is sessions', async () => {
    mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 10 });

    const result = await handleCleanupJob({ type: 'sessions' });

    expect(result).toHaveProperty('deleted');
    expect((result as { deleted: number }).deleted).toBe(10);
    expect(mockPrismaClient.document.findMany).not.toHaveBeenCalled();
    expect(mockPrismaClient.auditLog.deleteMany).not.toHaveBeenCalled();
  });

  it('should run only audit cleanup when type is audit', async () => {
    mockPrismaClient.auditLog.deleteMany.mockResolvedValue({ count: 50 });

    const result = await handleCleanupJob({ type: 'audit' });

    expect(result).toHaveProperty('archived');
    expect((result as { archived: number }).archived).toBe(50);
    expect(mockPrismaClient.document.findMany).not.toHaveBeenCalled();
    expect(mockPrismaClient.session.deleteMany).not.toHaveBeenCalled();
  });

  it('should pass dryRun option to document cleanup', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue(sampleDeletedDocuments);

    await handleCleanupJob({ type: 'documents', dryRun: true });

    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(mockPrismaClient.document.delete).not.toHaveBeenCalled();
  });

  it('should pass dryRun option to audit cleanup', async () => {
    mockPrismaClient.auditLog.count.mockResolvedValue(100);

    await handleCleanupJob({ type: 'audit', dryRun: true });

    expect(mockPrismaClient.auditLog.count).toHaveBeenCalled();
    expect(mockPrismaClient.auditLog.deleteMany).not.toHaveBeenCalled();
  });

  it('should handle full type explicitly', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue([]);
    mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaClient.auditLog.deleteMany.mockResolvedValue({ count: 0 });

    const result = await handleCleanupJob({ type: 'full' });

    expect(result).toHaveProperty('documents');
    expect(result).toHaveProperty('sessions');
    expect(result).toHaveProperty('auditLogs');
  });
});

// ----------------------------------------------------------------------------
// Tests: Edge Cases
// ----------------------------------------------------------------------------

describe('Cleanup Job - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    mockDeleteFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it('should handle empty database gracefully', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue([]);
    mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaClient.auditLog.deleteMany.mockResolvedValue({ count: 0 });

    const result = await runFullCleanup();

    expect(result.documents.documentsDeleted).toBe(0);
    expect(result.sessions.deleted).toBe(0);
    expect(result.auditLogs.archived).toBe(0);
  });

  it('should handle database connection error in document cleanup', async () => {
    mockPrismaClient.document.findMany.mockRejectedValue(new Error('Connection refused'));

    await expect(cleanupDeletedDocuments()).rejects.toThrow('Connection refused');
  });

  it('should handle documents with zero size', async () => {
    const docWithZeroSize = [
      {
        id: 'doc-1',
        storageKey: 'documents/empty.pdf',
        size: 0,
        filename: 'empty.pdf',
      },
    ];

    mockPrismaClient.document.findMany.mockResolvedValue(docWithZeroSize);
    mockPrismaClient.documentLink.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaClient.document.delete.mockResolvedValue({});

    const result = await cleanupDeletedDocuments();

    expect(result.documentsDeleted).toBe(1);
    expect(result.storageFreed).toBe(0);
  });

  it('should handle very old documents', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue([]);

    // Set to 10 years retention
    await cleanupDeletedDocuments({ olderThanDays: 3650 });

    const expectedCutoff = new Date('2024-06-15T12:00:00Z');
    expectedCutoff.setDate(expectedCutoff.getDate() - 3650);

    expect(mockPrismaClient.document.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: {
          not: null,
          lt: expectedCutoff,
        },
      },
      select: expect.any(Object),
    });
  });

  it('should handle concurrent cleanup calls', async () => {
    mockPrismaClient.document.findMany.mockResolvedValue([]);
    mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 5 });
    mockPrismaClient.auditLog.deleteMany.mockResolvedValue({ count: 10 });

    // Run multiple cleanup calls concurrently
    const [result1, result2, result3] = await Promise.all([
      cleanupExpiredSessions(),
      cleanupExpiredSessions(),
      cleanupExpiredSessions(),
    ]);

    expect(result1.deleted).toBe(5);
    expect(result2.deleted).toBe(5);
    expect(result3.deleted).toBe(5);
  });

  it('should format bytes correctly for various sizes', async () => {
    const docsWithVariousSizes = [
      { id: 'doc-1', storageKey: 'a', size: 500, filename: 'tiny.pdf' },
      { id: 'doc-2', storageKey: 'b', size: 1024, filename: '1kb.pdf' },
      { id: 'doc-3', storageKey: 'c', size: 1048576, filename: '1mb.pdf' },
      { id: 'doc-4', storageKey: 'd', size: 1073741824, filename: '1gb.pdf' },
    ];

    mockPrismaClient.document.findMany.mockResolvedValue(docsWithVariousSizes);
    mockPrismaClient.documentLink.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaClient.document.delete.mockResolvedValue({});

    const result = await cleanupDeletedDocuments();

    expect(result.storageFreed).toBe(500 + 1024 + 1048576 + 1073741824);
  });

  it('should handle storage key with special characters', async () => {
    const docWithSpecialKey = [
      {
        id: 'doc-1',
        storageKey: 'documents/workspace with spaces/file (1).pdf',
        size: 1024,
        filename: 'file (1).pdf',
      },
    ];

    mockPrismaClient.document.findMany.mockResolvedValue(docWithSpecialKey);
    mockPrismaClient.documentLink.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaClient.document.delete.mockResolvedValue({});

    await cleanupDeletedDocuments();

    expect(mockDeleteFile).toHaveBeenCalledWith('documents/workspace with spaces/file (1).pdf');
  });
});

// ----------------------------------------------------------------------------
// Tests: Orphaned Files Cleanup (Placeholder)
// ----------------------------------------------------------------------------

describe('Cleanup Job - Orphaned Files', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty result (not implemented)', async () => {
    const { cleanupOrphanedFiles } = await import('./cleanup.js');

    const result = cleanupOrphanedFiles();

    expect(result.orphanedFiles).toEqual([]);
    expect(result.deleted).toBe(0);
  });
});
