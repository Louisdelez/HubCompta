// ============================================================================
// S3/MINIO STORAGE ADAPTER - Finance Hub
// ============================================================================

import { Client as MinioClient } from 'minio';
import { createHash, randomUUID } from 'crypto';

// Configuration from environment
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT ?? '9000', 10);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY;
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY;
const MINIO_BUCKET = process.env.MINIO_BUCKET ?? 'documents';
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';

if (!MINIO_ACCESS_KEY || !MINIO_SECRET_KEY) {
  throw new Error('MINIO_ACCESS_KEY and MINIO_SECRET_KEY are required');
}

// Create MinIO client singleton
let minioClient: MinioClient | null = null;

export function getStorageClient(): MinioClient {
  if (!minioClient) {
    minioClient = new MinioClient({
      endPoint: MINIO_ENDPOINT,
      port: MINIO_PORT,
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY!,
      secretKey: MINIO_SECRET_KEY!,
    });
  }
  return minioClient;
}

export const storageClient = getStorageClient();

// ----------------------------------------------------------------------------
// Bucket Management
// ----------------------------------------------------------------------------

/**
 * Ensure the documents bucket exists
 */
export async function ensureBucket(): Promise<void> {
  const exists = await storageClient.bucketExists(MINIO_BUCKET);
  if (!exists) {
    await storageClient.makeBucket(MINIO_BUCKET);
    console.info(`Created bucket: ${MINIO_BUCKET}`);
  }
}

// ----------------------------------------------------------------------------
// File Operations
// ----------------------------------------------------------------------------

export interface UploadResult {
  storageKey: string;
  hash: string;
  size: number;
}

/**
 * Generate a unique storage key for a file
 * Format: {workspaceId}/{year}/{month}/{uuid}-{filename}
 */
export function generateStorageKey(
  workspaceId: string,
  filename: string,
  isVault = false
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const uuid = randomUUID();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const prefix = isVault ? 'vault' : 'docs';

  return `${prefix}/${workspaceId}/${year}/${month}/${uuid}-${sanitizedFilename}`;
}

/**
 * Upload a file to storage
 */
export async function uploadFile(
  storageKey: string,
  buffer: Buffer,
  mimeType: string
): Promise<UploadResult> {
  // Calculate hash for deduplication
  const hash = createHash('sha256').update(buffer).digest('hex');

  await storageClient.putObject(MINIO_BUCKET, storageKey, buffer, buffer.length, {
    'Content-Type': mimeType,
    'x-amz-meta-hash': hash,
  });

  return {
    storageKey,
    hash,
    size: buffer.length,
  };
}

/**
 * Download a file from storage
 */
export async function downloadFile(storageKey: string): Promise<Buffer> {
  const stream = await storageClient.getObject(MINIO_BUCKET, storageKey);
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Delete a file from storage
 */
export async function deleteFile(storageKey: string): Promise<void> {
  await storageClient.removeObject(MINIO_BUCKET, storageKey);
}

/**
 * Check if a file exists
 */
export async function fileExists(storageKey: string): Promise<boolean> {
  try {
    await storageClient.statObject(MINIO_BUCKET, storageKey);
    return true;
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// Presigned URLs
// ----------------------------------------------------------------------------

/**
 * Generate a presigned URL for file upload
 * @param storageKey - Target storage key
 * @param expirySeconds - URL validity period (default: 5 minutes)
 */
export async function getPresignedUploadUrl(
  storageKey: string,
  expirySeconds = 300
): Promise<string> {
  return storageClient.presignedPutObject(MINIO_BUCKET, storageKey, expirySeconds);
}

/**
 * Generate a presigned URL for file download
 * @param storageKey - Source storage key
 * @param expirySeconds - URL validity period (default: 1 hour)
 * @param filename - Suggested download filename
 */
export async function getPresignedDownloadUrl(
  storageKey: string,
  expirySeconds = 3600,
  filename?: string
): Promise<string> {
  const headers: Record<string, string> = {};
  if (filename) {
    headers['response-content-disposition'] = `attachment; filename="${filename}"`;
  }
  return storageClient.presignedGetObject(MINIO_BUCKET, storageKey, expirySeconds, headers);
}

// ----------------------------------------------------------------------------
// Initialization
// ----------------------------------------------------------------------------

/**
 * Initialize storage (ensure bucket exists)
 */
export async function initStorage(): Promise<void> {
  await ensureBucket();
  console.info('Storage initialized');
}
