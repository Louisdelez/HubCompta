import { Client as MinioClient } from 'minio';
export declare function getStorageClient(): MinioClient;
export declare const storageClient: MinioClient;
/**
 * Ensure the documents bucket exists
 */
export declare function ensureBucket(): Promise<void>;
export interface UploadResult {
    storageKey: string;
    hash: string;
    size: number;
}
/**
 * Generate a unique storage key for a file
 * Format: {workspaceId}/{year}/{month}/{uuid}-{filename}
 */
export declare function generateStorageKey(workspaceId: string, filename: string, isVault?: boolean): string;
/**
 * Upload a file to storage
 */
export declare function uploadFile(storageKey: string, buffer: Buffer, mimeType: string): Promise<UploadResult>;
/**
 * Download a file from storage
 */
export declare function downloadFile(storageKey: string): Promise<Buffer>;
/**
 * Delete a file from storage
 */
export declare function deleteFile(storageKey: string): Promise<void>;
/**
 * Check if a file exists
 */
export declare function fileExists(storageKey: string): Promise<boolean>;
/**
 * Generate a presigned URL for file upload
 * @param storageKey - Target storage key
 * @param expirySeconds - URL validity period (default: 5 minutes)
 */
export declare function getPresignedUploadUrl(storageKey: string, expirySeconds?: number): Promise<string>;
/**
 * Generate a presigned URL for file download
 * @param storageKey - Source storage key
 * @param expirySeconds - URL validity period (default: 1 hour)
 * @param filename - Suggested download filename
 */
export declare function getPresignedDownloadUrl(storageKey: string, expirySeconds?: number, filename?: string): Promise<string>;
/**
 * Initialize storage (ensure bucket exists)
 */
export declare function initStorage(): Promise<void>;
//# sourceMappingURL=s3.d.ts.map