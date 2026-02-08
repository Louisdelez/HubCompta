// ============================================================================
// DOCUMENT SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError, ConflictError } from '@/core/middleware/errorHandler.js';
import {
  generateStorageKey,
  uploadFile,
  deleteFile,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
} from '@/core/storage/s3.js';
import type { Document, DocumentStatus, Prisma } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface DocumentCreateInput {
  filename: string;
  mimeType: string;
  size: number;
  hash: string;
  storageKey: string;
  isVault?: boolean;
  encryptedKey?: string;
}

export interface DocumentWithLinks extends Omit<Document, 'size'> {
  size: number | bigint;
  uploader: { id: string; email: string; displayName: string | null };
  links: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    transactionId: string;
    documentId: string;
    transaction: {
      id: string;
      description: string;
      amount: { toNumber: () => number } | number;
      date: Date;
    };
  }[];
}

export interface DocumentFilters {
  status?: DocumentStatus;
  mimeType?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  isVault?: boolean;
  unlinkedOnly?: boolean;
}

export interface DocumentListOptions {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'filename' | 'size';
  sortOrder?: 'asc' | 'desc';
}

export interface UploadUrlResult {
  uploadUrl: string;
  storageKey: string;
  documentId: string;
  expiresIn: number;
}

// ----------------------------------------------------------------------------
// Document Service
// ----------------------------------------------------------------------------

export const documentService = {
  /**
   * Request an upload URL for a new document
   */
  async requestUploadUrl(
    workspaceId: string,
    userId: string,
    filename: string,
    mimeType: string,
    size: number,
    isVault = false
  ): Promise<UploadUrlResult> {
    // Generate storage key
    const storageKey = generateStorageKey(workspaceId, filename, isVault);

    // Create pending document record
    const document = await prisma.document.create({
      data: {
        workspaceId,
        uploaderId: userId,
        filename,
        mimeType,
        size,
        storageKey,
        hash: '', // Will be set after upload confirmation
        status: 'inbox',
        isVault,
      },
    });

    // Generate presigned upload URL (5 minutes)
    const uploadUrl = await getPresignedUploadUrl(storageKey, 300);

    return {
      uploadUrl,
      storageKey,
      documentId: document.id,
      expiresIn: 300,
    };
  },

  /**
   * Confirm upload completion and set hash
   */
  async confirmUpload(
    workspaceId: string,
    documentId: string,
    hash: string
  ): Promise<Document> {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new NotFoundError('Document', documentId);
    }

    // Check for duplicate hash
    const duplicate = await prisma.document.findFirst({
      where: {
        workspaceId,
        hash,
        id: { not: documentId },
        deletedAt: null,
      },
    });

    if (duplicate) {
      // Delete the new upload and return existing
      await prisma.document.delete({ where: { id: documentId } });
      throw new ConflictError(`Ce document existe déjà (${duplicate.filename})`);
    }

    return prisma.document.update({
      where: { id: documentId },
      data: { hash },
    });
  },

  /**
   * Upload a document directly (for small files)
   */
  async uploadDirect(
    workspaceId: string,
    userId: string,
    filename: string,
    mimeType: string,
    buffer: Buffer,
    isVault = false,
    encryptedKey?: string
  ): Promise<Document> {
    const storageKey = generateStorageKey(workspaceId, filename, isVault);

    // Upload to storage
    const { hash, size } = await uploadFile(storageKey, buffer, mimeType);

    // Check for duplicate
    const duplicate = await prisma.document.findFirst({
      where: {
        workspaceId,
        hash,
        deletedAt: null,
      },
    });

    if (duplicate) {
      // Delete the uploaded file and return existing
      await deleteFile(storageKey);
      throw new ConflictError(`Ce document existe déjà (${duplicate.filename})`);
    }

    return prisma.document.create({
      data: {
        workspaceId,
        uploaderId: userId,
        filename,
        mimeType,
        size,
        storageKey,
        hash,
        status: 'inbox',
        isVault,
        encryptedKey,
      },
    });
  },

  /**
   * Get document by ID
   */
  async getById(workspaceId: string, documentId: string): Promise<DocumentWithLinks | null> {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        workspaceId,
        deletedAt: null,
      },
      include: {
        uploader: {
          select: { id: true, email: true, displayName: true },
        },
        links: {
          include: {
            transaction: {
              select: { id: true, description: true, amount: true, date: true },
            },
          },
        },
      },
    });

    return document;
  },

  /**
   * List documents with filters and pagination
   */
  async list(
    workspaceId: string,
    filters: DocumentFilters = {},
    options: DocumentListOptions = {}
  ): Promise<{ documents: DocumentWithLinks[]; total: number }> {
    const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    const where: Prisma.DocumentWhereInput = {
      workspaceId,
      deletedAt: null,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.mimeType) {
      where.mimeType = { startsWith: filters.mimeType };
    }

    if (filters.search) {
      where.filename = { contains: filters.search, mode: 'insensitive' };
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    if (filters.isVault !== undefined) {
      where.isVault = filters.isVault;
    }

    if (filters.unlinkedOnly) {
      where.links = { none: {} };
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          uploader: {
            select: { id: true, email: true, displayName: true },
          },
          links: {
            include: {
              transaction: {
                select: { id: true, description: true, amount: true, date: true },
              },
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.document.count({ where }),
    ]);

    return { documents, total };
  },

  /**
   * Get download URL for a document
   */
  async getDownloadUrl(
    workspaceId: string,
    documentId: string
  ): Promise<{ url: string; filename: string }> {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new NotFoundError('Document', documentId);
    }

    const url = await getPresignedDownloadUrl(document.storageKey, 3600, document.filename);

    return { url, filename: document.filename };
  },

  /**
   * Link document to transaction
   */
  async linkToTransaction(
    workspaceId: string,
    documentId: string,
    transactionId: string
  ): Promise<void> {
    // Verify document exists
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new NotFoundError('Document', documentId);
    }

    // Verify transaction exists
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction', transactionId);
    }

    // Create link (upsert to handle duplicates)
    await prisma.documentLink.upsert({
      where: {
        documentId_transactionId: { documentId, transactionId },
      },
      create: { documentId, transactionId },
      update: {},
    });

    // Update document status if it was in inbox
    if (document.status === 'inbox') {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'linked' },
      });
    }
  },

  /**
   * Unlink document from transaction
   */
  async unlinkFromTransaction(
    workspaceId: string,
    documentId: string,
    transactionId: string
  ): Promise<void> {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new NotFoundError('Document', documentId);
    }

    await prisma.documentLink.deleteMany({
      where: { documentId, transactionId },
    });

    // Check if document has any remaining links
    const remainingLinks = await prisma.documentLink.count({
      where: { documentId },
    });

    // Update status if no links remain
    if (remainingLinks === 0 && document.status === 'linked') {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'inbox' },
      });
    }
  },

  /**
   * Archive document
   */
  async archive(workspaceId: string, documentId: string): Promise<Document> {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new NotFoundError('Document', documentId);
    }

    return prisma.document.update({
      where: { id: documentId },
      data: { status: 'archived' },
    });
  },

  /**
   * Soft delete document
   */
  async delete(workspaceId: string, documentId: string): Promise<void> {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new NotFoundError('Document', documentId);
    }

    // Soft delete - actual file cleanup done by worker job
    await prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });
  },

  /**
   * Get inbox count (unlinked documents)
   */
  async getInboxCount(workspaceId: string): Promise<number> {
    return prisma.document.count({
      where: {
        workspaceId,
        status: 'inbox',
        deletedAt: null,
      },
    });
  },

  /**
   * Get documents for a transaction
   */
  async getByTransaction(
    workspaceId: string,
    transactionId: string
  ): Promise<Document[]> {
    const links = await prisma.documentLink.findMany({
      where: { transactionId },
      include: {
        document: true,
      },
    });

    return links
      .filter((link) => link.document.workspaceId === workspaceId && !link.document.deletedAt)
      .map((link) => link.document);
  },
};

export default documentService;
