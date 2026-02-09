// ============================================================================
// STORAGE CLIENT - Worker
// ============================================================================

import { Client as MinioClient } from 'minio';

// Configuration from environment
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT ?? '9000', 10);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? '';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? '';
const MINIO_BUCKET = process.env.MINIO_BUCKET ?? 'documents';
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';

// Create MinIO client singleton
let minioClient: MinioClient | null = null;

export function getStorageClient(): MinioClient {
  if (!minioClient) {
    minioClient = new MinioClient({
      endPoint: MINIO_ENDPOINT,
      port: MINIO_PORT,
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
    });
  }
  return minioClient;
}

/**
 * Delete a file from storage
 */
export async function deleteFile(storageKey: string): Promise<void> {
  const client = getStorageClient();
  await client.removeObject(MINIO_BUCKET, storageKey);
}

/**
 * Check if a file exists
 */
export async function fileExists(storageKey: string): Promise<boolean> {
  const client = getStorageClient();
  try {
    await client.statObject(MINIO_BUCKET, storageKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Upload a file to storage
 */
export async function uploadFile(
  storageKey: string,
  content: Buffer,
  contentType: string
): Promise<void> {
  const client = getStorageClient();
  await client.putObject(MINIO_BUCKET, storageKey, content, content.length, {
    'Content-Type': contentType,
  });
}

/**
 * Download a file from storage
 */
export async function downloadFile(storageKey: string): Promise<Buffer> {
  const client = getStorageClient();
  const stream = await client.getObject(MINIO_BUCKET, storageKey);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * List files in a prefix
 */
export async function listFiles(prefix: string): Promise<string[]> {
  const client = getStorageClient();
  const files: string[] = [];

  const stream = client.listObjects(MINIO_BUCKET, prefix, true);

  return new Promise((resolve, reject) => {
    stream.on('data', (obj) => {
      if (obj.name) {
        files.push(obj.name);
      }
    });
    stream.on('end', () => resolve(files));
    stream.on('error', reject);
  });
}

export default getStorageClient;
