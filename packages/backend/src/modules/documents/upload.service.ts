// ============================================================================
// DOCUMENT UPLOAD SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import {
  generateStorageKey,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  deleteFile,
  fileExists,
} from '@/core/storage/s3.js';
import { duplicateService } from './duplicate.service.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface UploadRequest {
  filename: string;
  mimeType: string;
  size: number;
  isVault?: boolean;
}

export interface UploadSession {
  sessionId: string;
  uploadUrl: string;
  storageKey: string;
  expiresAt: Date;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ConfirmUploadInput {
  sessionId: string;
  hash: string;
  encryptedKey?: string;
}

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// Max file size (10MB for regular, 50MB for vault)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VAULT_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Upload session expiry
const UPLOAD_SESSION_EXPIRY = 10 * 60 * 1000; // 10 minutes

// ----------------------------------------------------------------------------
// In-memory session store (would use Redis in production)
// ----------------------------------------------------------------------------

const uploadSessions = new Map<string, UploadSession & {
  workspaceId: string;
  userId: string;
  isVault: boolean;
}>();

// Cleanup expired sessions periodically
setInterval(() => {
  const now = new Date();
  for (const [sessionId, session] of uploadSessions.entries()) {
    if (session.expiresAt < now) {
      uploadSessions.delete(sessionId);
    }
  }
}, 60 * 1000); // Every minute

// ----------------------------------------------------------------------------
// Upload Service
// ----------------------------------------------------------------------------

export const uploadService = {
  /**
   * Validate upload request
   */
  validateRequest(request: UploadRequest): { valid: boolean; error?: string } {
    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(request.mimeType)) {
      return {
        valid: false,
        error: `Type de fichier non autorisé: ${request.mimeType}`,
      };
    }

    // Check file size
    const maxSize = request.isVault ? MAX_VAULT_FILE_SIZE : MAX_FILE_SIZE;
    if (request.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      return {
        valid: false,
        error: `Fichier trop volumineux (max ${maxMB}MB)`,
      };
    }

    // Check filename
    if (!request.filename || request.filename.length > 255) {
      return {
        valid: false,
        error: 'Nom de fichier invalide',
      };
    }

    return { valid: true };
  },

  /**
   * Create an upload session with presigned URL
   */
  async createUploadSession(
    workspaceId: string,
    userId: string,
    request: UploadRequest
  ): Promise<UploadSession> {
    // Validate request
    const validation = this.validateRequest(request);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Generate storage key and session ID
    const storageKey = generateStorageKey(workspaceId, request.filename, request.isVault);
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + UPLOAD_SESSION_EXPIRY);

    // Get presigned upload URL
    const uploadUrl = await getPresignedUploadUrl(storageKey, 600); // 10 minutes

    // Store session
    const session: UploadSession & { workspaceId: string; userId: string; isVault: boolean } = {
      sessionId,
      uploadUrl,
      storageKey,
      expiresAt,
      filename: request.filename,
      mimeType: request.mimeType,
      size: request.size,
      workspaceId,
      userId,
      isVault: request.isVault ?? false,
    };

    uploadSessions.set(sessionId, session);

    return {
      sessionId,
      uploadUrl,
      storageKey,
      expiresAt,
      filename: request.filename,
      mimeType: request.mimeType,
      size: request.size,
    };
  },

  /**
   * Confirm upload and create document record
   */
  async confirmUpload(input: ConfirmUploadInput): Promise<{
    documentId: string;
    isDuplicate: boolean;
    existingDocumentId?: string;
  }> {
    const session = uploadSessions.get(input.sessionId);

    if (!session) {
      throw new Error('Session d\'upload expirée ou invalide');
    }

    if (session.expiresAt < new Date()) {
      uploadSessions.delete(input.sessionId);
      throw new Error('Session d\'upload expirée');
    }

    // Verify file was uploaded
    const exists = await fileExists(session.storageKey);
    if (!exists) {
      throw new Error('Fichier non trouvé - l\'upload a-t-il réussi?');
    }

    // Check for duplicate
    const duplicateCheck = await duplicateService.checkByHash(session.workspaceId, input.hash);

    if (duplicateCheck.isDuplicate) {
      // Delete the uploaded file since it's a duplicate
      await deleteFile(session.storageKey);
      uploadSessions.delete(input.sessionId);

      return {
        documentId: duplicateCheck.existingDocument!.id,
        isDuplicate: true,
        existingDocumentId: duplicateCheck.existingDocument!.id,
      };
    }

    // Create document record
    const document = await prisma.document.create({
      data: {
        workspaceId: session.workspaceId,
        uploaderId: session.userId,
        filename: session.filename,
        mimeType: session.mimeType,
        size: session.size,
        storageKey: session.storageKey,
        hash: input.hash,
        status: 'inbox',
        isVault: session.isVault,
        encryptedKey: input.encryptedKey,
      },
    });

    // Cleanup session
    uploadSessions.delete(input.sessionId);

    return {
      documentId: document.id,
      isDuplicate: false,
    };
  },

  /**
   * Cancel upload session and cleanup
   */
  async cancelUpload(sessionId: string): Promise<void> {
    const session = uploadSessions.get(sessionId);

    if (session) {
      // Try to delete any uploaded file
      try {
        await deleteFile(session.storageKey);
      } catch {
        // Ignore if file doesn't exist
      }

      uploadSessions.delete(sessionId);
    }
  },

  /**
   * Get a presigned download URL for a document
   */
  getDownloadUrl(
    storageKey: string,
    filename: string,
    expirySeconds = 3600
  ): Promise<string> {
    return getPresignedDownloadUrl(storageKey, expirySeconds, filename);
  },

  /**
   * Get active upload sessions count (for monitoring)
   */
  getActiveSessionsCount(): number {
    return uploadSessions.size;
  },

  /**
   * Get allowed MIME types
   */
  getAllowedMimeTypes(): string[] {
    return [...ALLOWED_MIME_TYPES];
  },

  /**
   * Get max file size
   */
  getMaxFileSize(isVault = false): number {
    return isVault ? MAX_VAULT_FILE_SIZE : MAX_FILE_SIZE;
  },
};

export default uploadService;
