// ============================================================================
// QUOTE SERVICE - Finance Hub
// Quote (Devis) management for Pro mode
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { QuoteCreateInput } from '@finance-hub/shared';
import type { QuoteStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { NotFoundError } from '@/core/middleware/errorHandler.js';
import { calculateDocumentTotals, DEFAULT_VAT_RATE } from './vat.utils.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface QuoteFilters {
  status?: QuoteStatus;
  contactId?: string;
  from?: Date;
  to?: Date;
}

export interface QuoteWithDetails {
  id: string;
  workspaceId: string;
  contactId: string;
  number: string;
  status: QuoteStatus;
  issueDate: Date;
  validUntil: Date;
  subtotal: Decimal;
  vatAmount: Decimal;
  total: Decimal;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  contact: {
    id: string;
    name: string;
    email: string | null;
    address: string | null;
  };
  lines: Array<{
    id: string;
    description: string;
    quantity: Decimal;
    unitPrice: Decimal;
    vatRate: Decimal;
    total: Decimal;
  }>;
  _count?: {
    invoices: number;
  };
}

// ----------------------------------------------------------------------------
// Service
// ----------------------------------------------------------------------------

class QuoteService {
  /**
   * List quotes for a workspace
   */
  async list(workspaceId: string, filters: QuoteFilters = {}): Promise<QuoteWithDetails[]> {
    const where: Prisma.QuoteWhereInput = {
      workspaceId,
      deletedAt: null,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.contactId) {
      where.contactId = filters.contactId;
    }

    if (filters.from || filters.to) {
      where.issueDate = {};
      if (filters.from) where.issueDate.gte = filters.from;
      if (filters.to) where.issueDate.lte = filters.to;
    }

    const quotes = await prisma.quote.findMany({
      where,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            address: true,
          },
        },
        lines: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            invoices: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { issueDate: 'desc' },
    });

    return quotes;
  }

  /**
   * Get quote by ID
   */
  async getById(workspaceId: string, id: string): Promise<QuoteWithDetails | null> {
    const quote = await prisma.quote.findFirst({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            address: true,
          },
        },
        lines: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            invoices: { where: { deletedAt: null } },
          },
        },
      },
    });

    return quote;
  }

  /**
   * Create a new quote
   */
  async create(workspaceId: string, input: QuoteCreateInput): Promise<QuoteWithDetails> {
    // Verify contact exists
    const contact = await prisma.contact.findFirst({
      where: {
        id: input.contactId,
        workspaceId,
        deletedAt: null,
        type: 'client',
      },
    });

    if (!contact) {
      throw new NotFoundError('Client non trouvé');
    }

    // Generate quote number
    const number = await this.generateNumber(workspaceId, 'quote');

    // Calculate totals
    const totals = calculateDocumentTotals(input.lines);

    // Create quote with lines
    const quote = await prisma.quote.create({
      data: {
        workspaceId,
        contactId: input.contactId,
        number,
        status: 'draft',
        issueDate: new Date(),
        validUntil: input.validUntil,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        total: totals.total,
        notes: input.notes,
        lines: {
          create: input.lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            vatRate: line.vatRate,
            total: new Decimal(line.quantity)
              .mul(line.unitPrice)
              .mul(new Decimal(1).add(new Decimal(line.vatRate).div(100))),
          })),
        },
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            address: true,
          },
        },
        lines: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            invoices: { where: { deletedAt: null } },
          },
        },
      },
    });

    return quote;
  }

  /**
   * Update quote lines and recalculate totals
   */
  async updateLines(
    workspaceId: string,
    id: string,
    lines: QuoteCreateInput['lines']
  ): Promise<QuoteWithDetails> {
    const existing = await prisma.quote.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundError('Devis non trouvé');
    }

    if (existing.status !== 'draft') {
      throw new Error('Seuls les devis en brouillon peuvent être modifiés');
    }

    // Calculate new totals
    const totals = calculateDocumentTotals(lines);

    // Update quote and replace lines
    const quote = await prisma.$transaction(async (tx) => {
      // Delete existing lines
      await tx.invoiceLine.deleteMany({
        where: { quoteId: id },
      });

      // Update quote with new lines
      return tx.quote.update({
        where: { id },
        data: {
          subtotal: totals.subtotal,
          vatAmount: totals.vatAmount,
          total: totals.total,
          lines: {
            create: lines.map((line) => ({
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              vatRate: line.vatRate,
              total: new Decimal(line.quantity)
                .mul(line.unitPrice)
                .mul(new Decimal(1).add(new Decimal(line.vatRate).div(100))),
            })),
          },
        },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              email: true,
              address: true,
            },
          },
          lines: {
            orderBy: { createdAt: 'asc' },
          },
          _count: {
            select: {
              invoices: { where: { deletedAt: null } },
            },
          },
        },
      });
    });

    return quote;
  }

  /**
   * Update quote status
   */
  async updateStatus(
    workspaceId: string,
    id: string,
    status: QuoteStatus
  ): Promise<QuoteWithDetails> {
    const existing = await prisma.quote.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundError('Devis non trouvé');
    }

    // Validate status transitions
    const validTransitions: Record<QuoteStatus, QuoteStatus[]> = {
      draft: ['sent'],
      sent: ['accepted', 'rejected', 'expired'],
      accepted: [],
      rejected: [],
      expired: [],
    };

    if (!validTransitions[existing.status].includes(status)) {
      throw new Error(`Transition de statut invalide: ${existing.status} -> ${status}`);
    }

    const quote = await prisma.quote.update({
      where: { id },
      data: { status },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            address: true,
          },
        },
        lines: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            invoices: { where: { deletedAt: null } },
          },
        },
      },
    });

    return quote;
  }

  /**
   * Soft delete a quote
   */
  async delete(workspaceId: string, id: string): Promise<void> {
    const existing = await prisma.quote.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        _count: {
          select: {
            invoices: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError('Devis non trouvé');
    }

    if (existing._count.invoices > 0) {
      throw new Error('Impossible de supprimer ce devis car il a des factures associées');
    }

    await prisma.quote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Duplicate a quote
   */
  async duplicate(workspaceId: string, id: string): Promise<QuoteWithDetails> {
    const original = await this.getById(workspaceId, id);

    if (!original) {
      throw new NotFoundError('Devis non trouvé');
    }

    // Generate new number
    const number = await this.generateNumber(workspaceId, 'quote');

    // Set validity to 30 days from now
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const quote = await prisma.quote.create({
      data: {
        workspaceId,
        contactId: original.contactId,
        number,
        status: 'draft',
        issueDate: new Date(),
        validUntil,
        subtotal: original.subtotal,
        vatAmount: original.vatAmount,
        total: original.total,
        notes: original.notes,
        lines: {
          create: original.lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            vatRate: line.vatRate,
            total: line.total,
          })),
        },
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            address: true,
          },
        },
        lines: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            invoices: { where: { deletedAt: null } },
          },
        },
      },
    });

    return quote;
  }

  /**
   * Check and update expired quotes
   */
  async updateExpiredQuotes(workspaceId: string): Promise<number> {
    const result = await prisma.quote.updateMany({
      where: {
        workspaceId,
        status: 'sent',
        validUntil: { lt: new Date() },
        deletedAt: null,
      },
      data: { status: 'expired' },
    });

    return result.count;
  }

  /**
   * Generate unique document number
   * Format: DEV-YYYY-NNNN for quotes, FAC-YYYY-NNNN for invoices
   */
  async generateNumber(workspaceId: string, type: 'quote' | 'invoice'): Promise<string> {
    const prefix = type === 'quote' ? 'DEV' : 'FAC';
    const year = new Date().getFullYear();

    // Get the last number for this year
    const lastDoc = type === 'quote'
      ? await prisma.quote.findFirst({
          where: {
            workspaceId,
            number: { startsWith: `${prefix}-${year}-` },
          },
          orderBy: { number: 'desc' },
        })
      : await prisma.invoice.findFirst({
          where: {
            workspaceId,
            number: { startsWith: `${prefix}-${year}-` },
          },
          orderBy: { number: 'desc' },
        });

    let nextNumber = 1;
    if (lastDoc) {
      const parts = lastDoc.number.split('-');
      const lastNumber = parseInt(parts[2] ?? '0', 10);
      nextNumber = lastNumber + 1;
    }

    return `${prefix}-${year}-${String(nextNumber).padStart(4, '0')}`;
  }
}

export const quoteService = new QuoteService();
