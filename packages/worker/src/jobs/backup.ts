// ============================================================================
// BACKUP JOB - Finance Hub
// Automated database and storage backup
// ============================================================================

import { Job } from 'bullmq';
import { prisma } from '../lib/prisma.js';
import { getStorageClient } from '../lib/storage.js';
import { createGzip } from 'zlib';
import { Readable } from 'stream';

// Get storage client singleton
const storageClient = getStorageClient();

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface BackupJobData {
  type: 'full' | 'incremental' | 'workspace';
  workspaceId?: string;
  triggeredBy?: string;
  retention?: number; // Days to keep backup
}

export interface BackupJobResult {
  success: boolean;
  backupId: string;
  size: number;
  duration: number;
  includedWorkspaces: number;
  includedTables: string[];
  storagePath: string;
}

interface BackupMetadata {
  id: string;
  type: 'full' | 'incremental' | 'workspace';
  createdAt: string;
  version: string;
  workspaceId: string | undefined;
  tables: string[];
  counts: Record<string, number>;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const BACKUP_BUCKET = process.env.BACKUP_BUCKET ?? 'hubcompta-backups';
const BACKUP_VERSION = '1.0';

// Tables to backup in order (respecting foreign key constraints)
const BACKUP_TABLES = [
  'users',
  'workspaces',
  'memberships',
  'accounts',
  'categories',
  'tags',
  'transactions',
  'transactionTags',
  'budgets',
  'documents',
  'documentLinks',
  'rules',
  'recurrences',
  'contacts',
  'quotes',
  'quoteLines',
  'invoices',
  'invoiceLines',
  'assets',
  'positions',
  'investTransactions',
  'notifications',
  'auditLogs',
];

// ----------------------------------------------------------------------------
// Backup Functions
// ----------------------------------------------------------------------------

async function getTableData(tableName: string, workspaceId?: string): Promise<unknown[]> {
  // @ts-ignore - Dynamic table access
  const model = prisma[tableName];

  if (!model) {
    console.warn(`Table ${tableName} not found in Prisma client`);
    return [];
  }

  try {
    // If workspace-scoped backup, filter by workspaceId
    if (workspaceId) {
      // Check if table has workspaceId column
      const hasWorkspaceId = [
        'accounts', 'categories', 'tags', 'transactions', 'budgets',
        'documents', 'rules', 'recurrences', 'contacts', 'quotes',
        'invoices', 'assets', 'positions', 'notifications',
      ].includes(tableName);

      if (hasWorkspaceId) {
        return await model.findMany({
          where: { workspaceId },
        });
      }

      // For memberships, filter by workspace
      if (tableName === 'memberships') {
        return await model.findMany({
          where: { workspaceId },
        });
      }

      // For workspace table, get only the specific workspace
      if (tableName === 'workspaces') {
        const workspace = await model.findUnique({
          where: { id: workspaceId },
        });
        return workspace ? [workspace] : [];
      }
    }

    // Full backup - get all data
    return await model.findMany();
  } catch (error) {
    console.error(`Error fetching ${tableName}:`, error);
    return [];
  }
}

async function createBackupData(
  _type: 'full' | 'incremental' | 'workspace',
  workspaceId?: string
): Promise<{ data: Record<string, unknown[]>; counts: Record<string, number> }> {
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const tableName of BACKUP_TABLES) {
    try {
      const tableData = await getTableData(tableName, workspaceId);
      data[tableName] = tableData;
      counts[tableName] = tableData.length;
    } catch (error) {
      console.error(`Failed to backup table ${tableName}:`, error);
      data[tableName] = [];
      counts[tableName] = 0;
    }
  }

  return { data, counts };
}

function compressData(data: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const gzip = createGzip({ level: 9 });
    const stream = Readable.from([data]);

    stream
      .pipe(gzip)
      .on('data', (chunk: Buffer) => chunks.push(chunk))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);
  });
}

async function uploadBackup(
  backupId: string,
  compressedData: Buffer,
  metadata: BackupMetadata
): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  const prefix = metadata.workspaceId
    ? `workspaces/${metadata.workspaceId}`
    : 'full';

  const path = `${prefix}/${year}/${month}/${day}/${backupId}.json.gz`;

  // Ensure bucket exists
  const bucketExists = await storageClient.bucketExists(BACKUP_BUCKET);
  if (!bucketExists) {
    await storageClient.makeBucket(BACKUP_BUCKET);
  }

  // Upload compressed backup
  await storageClient.putObject(
    BACKUP_BUCKET,
    path,
    compressedData,
    compressedData.length,
    {
      'Content-Type': 'application/gzip',
      'Content-Encoding': 'gzip',
      'x-amz-meta-backup-id': backupId,
      'x-amz-meta-backup-type': metadata.type,
      'x-amz-meta-backup-version': metadata.version,
      'x-amz-meta-created-at': metadata.createdAt,
    }
  );

  // Also upload metadata as separate JSON file
  const metadataPath = `${prefix}/${year}/${month}/${day}/${backupId}.meta.json`;
  const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2));

  await storageClient.putObject(
    BACKUP_BUCKET,
    metadataPath,
    metadataBuffer,
    metadataBuffer.length,
    {
      'Content-Type': 'application/json',
    }
  );

  return path;
}

async function cleanupOldBackups(retentionDays: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  let deletedCount = 0;

  try {
    const objectsStream = storageClient.listObjects(BACKUP_BUCKET, '', true);

    for await (const obj of objectsStream) {
      if (obj.lastModified && obj.lastModified < cutoffDate) {
        await storageClient.removeObject(BACKUP_BUCKET, obj.name);
        deletedCount++;
      }
    }
  } catch (error) {
    console.error('Error cleaning up old backups:', error);
  }

  return deletedCount;
}

// ----------------------------------------------------------------------------
// Job Processor
// ----------------------------------------------------------------------------

export async function processBackupJob(job: Job<BackupJobData>): Promise<BackupJobResult> {
  const startTime = Date.now();
  const { type, workspaceId, retention = 30 } = job.data;

  const backupId = `backup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  console.log(`[Backup] Starting ${type} backup: ${backupId}`);

  try {
    // Update job progress
    await job.updateProgress(10);

    // Collect data
    const { data, counts } = await createBackupData(type, workspaceId);
    await job.updateProgress(40);

    // Create metadata
    const metadata: BackupMetadata = {
      id: backupId,
      type,
      createdAt: new Date().toISOString(),
      version: BACKUP_VERSION,
      workspaceId,
      tables: BACKUP_TABLES.filter(t => (counts[t] ?? 0) > 0),
      counts,
    };

    // Create backup payload
    const backupPayload = {
      metadata,
      data,
    };

    const jsonData = JSON.stringify(backupPayload);
    await job.updateProgress(60);

    // Compress
    const compressedData = await compressData(jsonData);
    await job.updateProgress(80);

    // Upload to storage
    const storagePath = await uploadBackup(backupId, compressedData, metadata);
    await job.updateProgress(90);

    // Cleanup old backups
    const deletedBackups = await cleanupOldBackups(retention);
    console.log(`[Backup] Cleaned up ${deletedBackups} old backups`);

    await job.updateProgress(100);

    const duration = Date.now() - startTime;
    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

    console.log(`[Backup] Completed ${type} backup: ${backupId} (${totalRecords} records, ${compressedData.length} bytes, ${duration}ms)`);

    // Log to audit
    try {
      await prisma.auditLog.create({
        data: {
          userId: job.data.triggeredBy ?? 'system',
          action: 'backup.created',
          entityType: 'system',
          entityId: backupId,
          changes: {
            type,
            workspaceId,
            size: compressedData.length,
            duration,
            recordCount: totalRecords,
          },
          ipAddress: '127.0.0.1',
          userAgent: 'HubCompta Worker',
        },
      });
    } catch (auditError) {
      console.warn('[Backup] Failed to create audit log:', auditError);
    }

    return {
      success: true,
      backupId,
      size: compressedData.length,
      duration,
      includedWorkspaces: workspaceId ? 1 : counts.workspaces ?? 0,
      includedTables: metadata.tables,
      storagePath,
    };
  } catch (error) {
    console.error(`[Backup] Failed: ${error}`);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// Export
// ----------------------------------------------------------------------------

export default processBackupJob;
