// ============================================================================
// CLEANUP JOB - Finance Hub Worker
// ============================================================================

import { prisma } from '../lib/prisma.js';
import { deleteFile } from '../lib/storage.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface CleanupResult {
  documentsDeleted: number;
  storageFreed: number;
  errors: string[];
}

interface CleanupOptions {
  dryRun?: boolean;
  olderThanDays?: number;
}

// ----------------------------------------------------------------------------
// Document Cleanup
// ----------------------------------------------------------------------------

/**
 * Clean up soft-deleted documents and their storage files
 */
export async function cleanupDeletedDocuments(
  options: CleanupOptions = {}
): Promise<CleanupResult> {
  const { dryRun = false, olderThanDays = 30 } = options;

  const result: CleanupResult = {
    documentsDeleted: 0,
    storageFreed: 0,
    errors: [],
  };

  // Find documents that were soft-deleted more than X days ago
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const deletedDocuments = await prisma.document.findMany({
    where: {
      deletedAt: {
        not: null,
        lt: cutoffDate,
      },
    },
    select: {
      id: true,
      storageKey: true,
      size: true,
      filename: true,
    },
  });

  console.log(`Found ${deletedDocuments.length} documents to cleanup`);

  if (dryRun) {
    console.log('Dry run mode - no changes will be made');
    return {
      documentsDeleted: deletedDocuments.length,
      storageFreed: deletedDocuments.reduce((sum, d) => sum + d.size, 0),
      errors: [],
    };
  }

  for (const doc of deletedDocuments) {
    try {
      // Delete from storage
      await deleteFile(doc.storageKey);

      // Delete document record and links
      await prisma.documentLink.deleteMany({
        where: { documentId: doc.id },
      });

      await prisma.document.delete({
        where: { id: doc.id },
      });

      result.documentsDeleted++;
      result.storageFreed += doc.size;

      console.log(`Deleted: ${doc.filename} (${formatBytes(doc.size)})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Failed to delete ${doc.id}: ${message}`);
      console.error(`Error deleting ${doc.filename}:`, message);
    }
  }

  return result;
}

// ----------------------------------------------------------------------------
// Orphaned Files Cleanup
// ----------------------------------------------------------------------------

/**
 * Find and optionally delete orphaned storage files
 * (files that exist in storage but not in database)
 */
export async function cleanupOrphanedFiles(
  _options: CleanupOptions = {}
): Promise<{ orphanedFiles: string[]; deleted: number }> {
  // dryRun option will be used when implementation is complete

  // This would require listing all files in storage and comparing
  // with database records. Implementation depends on storage provider.
  // For MinIO, we'd use listObjects.

  console.log('Orphaned file cleanup not yet implemented');

  return {
    orphanedFiles: [],
    deleted: 0,
  };
}

// ----------------------------------------------------------------------------
// Session Cleanup
// ----------------------------------------------------------------------------

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<{ deleted: number }> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  console.log(`Deleted ${result.count} expired sessions`);

  return { deleted: result.count };
}

// ----------------------------------------------------------------------------
// Audit Log Cleanup
// ----------------------------------------------------------------------------

/**
 * Archive old audit logs (older than retention period)
 */
export async function cleanupAuditLogs(
  options: { retentionDays?: number; dryRun?: boolean } = {}
): Promise<{ archived: number }> {
  const { retentionDays = 365, dryRun = false } = options;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  if (dryRun) {
    const count = await prisma.auditLog.count({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });
    console.log(`Would archive ${count} audit logs`);
    return { archived: count };
  }

  // In production, you might want to export these to cold storage
  // before deletion. For now, we just delete.
  const result = await prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  });

  console.log(`Archived ${result.count} audit logs`);

  return { archived: result.count };
}

// ----------------------------------------------------------------------------
// Main Cleanup Job
// ----------------------------------------------------------------------------

export interface FullCleanupResult {
  documents: CleanupResult;
  sessions: { deleted: number };
  auditLogs: { archived: number };
  duration: number;
}

/**
 * Run all cleanup tasks
 */
export async function runFullCleanup(
  options: CleanupOptions = {}
): Promise<FullCleanupResult> {
  const startTime = Date.now();

  console.log('Starting full cleanup...');

  const [documents, sessions, auditLogs] = await Promise.all([
    cleanupDeletedDocuments(options),
    cleanupExpiredSessions(),
    cleanupAuditLogs({ dryRun: options.dryRun ?? false }),
  ]);

  const duration = Date.now() - startTime;

  console.log(`Cleanup completed in ${duration}ms`);
  console.log(`  Documents: ${documents.documentsDeleted} deleted, ${formatBytes(documents.storageFreed)} freed`);
  console.log(`  Sessions: ${sessions.deleted} deleted`);
  console.log(`  Audit logs: ${auditLogs.archived} archived`);

  if (documents.errors.length > 0) {
    console.log(`  Errors: ${documents.errors.length}`);
  }

  return {
    documents,
    sessions,
    auditLogs,
    duration,
  };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// ----------------------------------------------------------------------------
// Job Handler for BullMQ
// ----------------------------------------------------------------------------

export async function handleCleanupJob(data: {
  type?: 'full' | 'documents' | 'sessions' | 'audit';
  dryRun?: boolean;
}): Promise<FullCleanupResult | CleanupResult | { deleted: number } | { archived: number }> {
  const { type = 'full', dryRun = false } = data;

  switch (type) {
    case 'documents':
      return cleanupDeletedDocuments({ dryRun });
    case 'sessions':
      return cleanupExpiredSessions();
    case 'audit':
      return cleanupAuditLogs({ dryRun });
    case 'full':
    default:
      return runFullCleanup({ dryRun });
  }
}

export default handleCleanupJob;
