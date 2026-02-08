// ============================================================================
// DOCUMENT DUPLICATE SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { createHash } from 'crypto';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingDocument?: {
    id: string;
    filename: string;
    createdAt: Date;
    status: string;
  };
}

export interface SimilarDocument {
  id: string;
  filename: string;
  similarity: number;
  createdAt: Date;
}

// ----------------------------------------------------------------------------
// Duplicate Service
// ----------------------------------------------------------------------------

export const duplicateService = {
  /**
   * Calculate SHA-256 hash of file content
   */
  calculateHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  },

  /**
   * Check if a document with the same hash exists
   */
  async checkByHash(
    workspaceId: string,
    hash: string
  ): Promise<DuplicateCheckResult> {
    const existing = await prisma.document.findFirst({
      where: {
        workspaceId,
        hash,
        deletedAt: null,
      },
      select: {
        id: true,
        filename: true,
        createdAt: true,
        status: true,
      },
    });

    if (existing) {
      return {
        isDuplicate: true,
        existingDocument: existing,
      };
    }

    return { isDuplicate: false };
  },

  /**
   * Check if a document with the same hash exists (from buffer)
   */
  async checkByContent(
    workspaceId: string,
    buffer: Buffer
  ): Promise<DuplicateCheckResult> {
    const hash = this.calculateHash(buffer);
    return this.checkByHash(workspaceId, hash);
  },

  /**
   * Find documents with similar filenames
   * Uses trigram similarity for fuzzy matching
   */
  async findSimilarByFilename(
    workspaceId: string,
    filename: string,
    threshold = 0.5
  ): Promise<SimilarDocument[]> {
    // Simple similarity check based on common patterns
    // For more advanced similarity, would use pg_trgm extension
    const baseName = filename
      .toLowerCase()
      .replace(/\.[^.]+$/, '') // Remove extension
      .replace(/[_-]/g, ' ')   // Normalize separators
      .trim();

    const documents = await prisma.document.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
      select: {
        id: true,
        filename: true,
        createdAt: true,
      },
    });

    const similar: SimilarDocument[] = [];

    for (const doc of documents) {
      const docBaseName = doc.filename
        .toLowerCase()
        .replace(/\.[^.]+$/, '')
        .replace(/[_-]/g, ' ')
        .trim();

      const similarity = this.calculateSimilarity(baseName, docBaseName);

      if (similarity >= threshold) {
        similar.push({
          id: doc.id,
          filename: doc.filename,
          similarity,
          createdAt: doc.createdAt,
        });
      }
    }

    return similar.sort((a, b) => b.similarity - a.similarity);
  },

  /**
   * Calculate string similarity using Levenshtein distance
   */
  calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (!str1.length || !str2.length) return 0;

    const matrix: number[][] = [];

    for (let i = 0; i <= str1.length; i++) {
      matrix[i] = [i];
    }

    const row0 = matrix[0];
    if (!row0) return 0;
    for (let j = 0; j <= str2.length; j++) {
      row0[j] = j;
    }

    for (let i = 1; i <= str1.length; i++) {
      for (let j = 1; j <= str2.length; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        const prevRow = matrix[i - 1];
        const currRow = matrix[i];
        if (!prevRow || !currRow) continue;
        const del = prevRow[j];
        const ins = currRow[j - 1];
        const sub = prevRow[j - 1];
        if (del !== undefined && ins !== undefined && sub !== undefined) {
          currRow[j] = Math.min(del + 1, ins + 1, sub + cost);
        }
      }
    }

    const lastRow = matrix[str1.length];
    const distance = lastRow?.[str2.length] ?? 0;
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - distance / maxLength;
  },

  /**
   * Find potential duplicate receipts based on metadata
   * (same amount, similar date, similar filename patterns)
   */
  async findPotentialReceiptDuplicates(
    workspaceId: string,
    options: {
      amount?: number;
      date?: Date;
      filename?: string;
    }
  ): Promise<SimilarDocument[]> {
    const { filename } = options;

    if (!filename) {
      return [];
    }

    // Extract potential amount from filename (e.g., "receipt_45.99_amazon.pdf")
    const amountMatch = filename.match(/(\d+[.,]\d{2})/);
    const matchedAmount = amountMatch?.[1];
    const filenameAmount = matchedAmount ? parseFloat(matchedAmount.replace(',', '.')) : null;

    // Find documents with similar patterns
    const documents = await prisma.document.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        mimeType: { startsWith: 'application/pdf' },
      },
      select: {
        id: true,
        filename: true,
        createdAt: true,
      },
    });

    const potentialDuplicates: SimilarDocument[] = [];

    for (const doc of documents) {
      let score = 0;

      // Check filename similarity
      const filenameSimilarity = this.calculateSimilarity(
        filename.toLowerCase(),
        doc.filename.toLowerCase()
      );
      score += filenameSimilarity * 0.5;

      // Check amount in filename
      if (filenameAmount) {
        const docAmountMatch = doc.filename.match(/(\d+[.,]\d{2})/);
        const docMatchedAmount = docAmountMatch?.[1];
        if (docMatchedAmount) {
          const docAmount = parseFloat(docMatchedAmount.replace(',', '.'));
          if (Math.abs(docAmount - filenameAmount) < 0.01) {
            score += 0.3;
          }
        }
      }

      // Minimum threshold
      if (score >= 0.4) {
        potentialDuplicates.push({
          id: doc.id,
          filename: doc.filename,
          similarity: score,
          createdAt: doc.createdAt,
        });
      }
    }

    return potentialDuplicates.sort((a, b) => b.similarity - a.similarity);
  },
};

export default duplicateService;
