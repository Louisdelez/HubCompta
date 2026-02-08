// ============================================================================
// INVOICE SERVICE - Finance Hub
// Invoice (Facture) management for Pro mode
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { InvoiceCreateInput, InvoicePayInput } from '@finance-hub/shared';
import type { InvoiceStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { NotFoundError } from '@/core/middleware/errorHandler.js';
import { calculateDocumentTotals } from './vat.utils.js';
import { quoteService } from './quote.service.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface InvoiceFilters {
  status?: InvoiceStatus;
  contactId?: string;
  from?: Date;
  to?: Date;
  overdue?: boolean;
}

export interface InvoiceWithDetails {
  id: string;
  workspaceId: string;
  contactId: string;
  quoteId: string | null;
  number: string;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  subtotal: Decimal;
  vatAmount: Decimal;
  total: Decimal;
  paidAmount: Decimal;
  paidAt: Date | null;
  notes: string | null;
  linkedTransactionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  contact: {
    id: string;
    name: string;
    email: string | null;
    address: string | null;
    siret: string | null;
    vatNumber: string | null;
  };
  lines: Array<{
    id: string;
    description: string;
    quantity: Decimal;
    unitPrice: Decimal;
    vatRate: Decimal;
    total: Decimal;
  }>;
  quote?: {
    id: string;
    number: string;
  } | null;
}

export interface InvoiceStats {
  totalDraft: number;
  totalSent: number;
  totalPaid: number;
  totalOverdue: number;
  amountDraft: number;
  amountSent: number;
  amountPaid: number;
  amountOverdue: number;
}

// ----------------------------------------------------------------------------
// Service
// ----------------------------------------------------------------------------

class InvoiceService {
  /**
   * List invoices for a workspace
   */
  async list(workspaceId: string, filters: InvoiceFilters = {}): Promise<InvoiceWithDetails[]> {
    const where: Prisma.InvoiceWhereInput = {
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

    if (filters.overdue) {
      where.status = 'overdue';
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            address: true,
            siret: true,
            vatNumber: true,
          },
        },
        lines: {
          orderBy: { createdAt: 'asc' },
        },
        quote: {
          select: {
            id: true,
            number: true,
          },
        },
      },
      orderBy: { issueDate: 'desc' },
    });

    return invoices;
  }

  /**
   * Get invoice by ID
   */
  async getById(workspaceId: string, id: string): Promise<InvoiceWithDetails | null> {
    const invoice = await prisma.invoice.findFirst({
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
            siret: true,
            vatNumber: true,
          },
        },
        lines: {
          orderBy: { createdAt: 'asc' },
        },
        quote: {
          select: {
            id: true,
            number: true,
          },
        },
      },
    });

    return invoice;
  }

  /**
   * Create a new invoice
   */
  async create(workspaceId: string, input: InvoiceCreateInput): Promise<InvoiceWithDetails> {
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

    // If created from a quote, get the quote data
    let quoteLines = input.lines;
    if (input.quoteId) {
      const quote = await prisma.quote.findFirst({
        where: {
          id: input.quoteId,
          workspaceId,
          deletedAt: null,
          status: 'accepted',
        },
        include: { lines: true },
      });

      if (!quote) {
        throw new NotFoundError('Devis accepté non trouvé');
      }

      // Use quote lines if no lines provided
      if (!input.lines.length) {
        quoteLines = quote.lines.map((line) => ({
          description: line.description,
          quantity: line.quantity.toNumber(),
          unitPrice: line.unitPrice.toNumber(),
          vatRate: line.vatRate.toNumber(),
        }));
      }
    }

    // Generate invoice number
    const number = await quoteService.generateNumber(workspaceId, 'invoice');

    // Calculate totals
    const totals = calculateDocumentTotals(quoteLines);

    // Create invoice with lines
    const invoice = await prisma.invoice.create({
      data: {
        workspaceId,
        contactId: input.contactId,
        quoteId: input.quoteId,
        number,
        status: 'draft',
        issueDate: new Date(),
        dueDate: input.dueDate,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        total: totals.total,
        paidAmount: 0,
        notes: input.notes,
        lines: {
          create: quoteLines.map((line) => ({
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
            siret: true,
            vatNumber: true,
          },
        },
        lines: {
          orderBy: { createdAt: 'asc' },
        },
        quote: {
          select: {
            id: true,
            number: true,
          },
        },
      },
    });

    return invoice;
  }

  /**
   * Create invoice from accepted quote
   */
  async createFromQuote(
    workspaceId: string,
    quoteId: string,
    dueDate: Date
  ): Promise<InvoiceWithDetails> {
    const quote = await prisma.quote.findFirst({
      where: {
        id: quoteId,
        workspaceId,
        deletedAt: null,
      },
      include: { lines: true },
    });

    if (!quote) {
      throw new NotFoundError('Devis non trouvé');
    }

    if (quote.status !== 'accepted') {
      throw new Error('Seuls les devis acceptés peuvent être convertis en facture');
    }

    // Check if an invoice already exists for this quote
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        quoteId,
        deletedAt: null,
      },
    });

    if (existingInvoice) {
      throw new Error('Une facture existe déjà pour ce devis');
    }

    return this.create(workspaceId, {
      contactId: quote.contactId,
      quoteId: quote.id,
      dueDate,
      lines: quote.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity.toNumber(),
        unitPrice: line.unitPrice.toNumber(),
        vatRate: line.vatRate.toNumber(),
      })),
      notes: quote.notes,
    });
  }

  /**
   * Update invoice lines (only for draft)
   */
  async updateLines(
    workspaceId: string,
    id: string,
    lines: InvoiceCreateInput['lines']
  ): Promise<InvoiceWithDetails> {
    const existing = await prisma.invoice.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundError('Facture non trouvée');
    }

    if (existing.status !== 'draft') {
      throw new Error('Seules les factures en brouillon peuvent être modifiées');
    }

    // Calculate new totals
    const totals = calculateDocumentTotals(lines);

    // Update invoice and replace lines
    const invoice = await prisma.$transaction(async (tx) => {
      // Delete existing lines
      await tx.invoiceLine.deleteMany({
        where: { invoiceId: id },
      });

      // Update invoice with new lines
      return tx.invoice.update({
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
              siret: true,
              vatNumber: true,
            },
          },
          lines: {
            orderBy: { createdAt: 'asc' },
          },
          quote: {
            select: {
              id: true,
              number: true,
            },
          },
        },
      });
    });

    return invoice;
  }

  /**
   * Send invoice (change status from draft to sent)
   */
  async send(workspaceId: string, id: string): Promise<InvoiceWithDetails> {
    const existing = await prisma.invoice.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundError('Facture non trouvée');
    }

    if (existing.status !== 'draft') {
      throw new Error('Seules les factures en brouillon peuvent être envoyées');
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: { status: 'sent' },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            address: true,
            siret: true,
            vatNumber: true,
          },
        },
        lines: {
          orderBy: { createdAt: 'asc' },
        },
        quote: {
          select: {
            id: true,
            number: true,
          },
        },
      },
    });

    return invoice;
  }

  /**
   * Record payment for an invoice
   */
  async recordPayment(
    workspaceId: string,
    id: string,
    input: InvoicePayInput
  ): Promise<InvoiceWithDetails> {
    const existing = await prisma.invoice.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundError('Facture non trouvée');
    }

    if (existing.status === 'draft' || existing.status === 'cancelled') {
      throw new Error('Cette facture ne peut pas recevoir de paiement');
    }

    const newPaidAmount = existing.paidAmount.add(new Decimal(input.amount));
    const isPaidInFull = newPaidAmount.gte(existing.total);

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        paidAmount: newPaidAmount,
        paidAt: isPaidInFull ? (input.paidAt || new Date()) : null,
        status: isPaidInFull ? 'paid' : existing.status,
        linkedTransactionId: input.linkedTransactionId,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            address: true,
            siret: true,
            vatNumber: true,
          },
        },
        lines: {
          orderBy: { createdAt: 'asc' },
        },
        quote: {
          select: {
            id: true,
            number: true,
          },
        },
      },
    });

    return invoice;
  }

  /**
   * Cancel an invoice
   */
  async cancel(workspaceId: string, id: string): Promise<InvoiceWithDetails> {
    const existing = await prisma.invoice.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundError('Facture non trouvée');
    }

    if (existing.status === 'paid') {
      throw new Error('Les factures payées ne peuvent pas être annulées');
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: { status: 'cancelled' },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            address: true,
            siret: true,
            vatNumber: true,
          },
        },
        lines: {
          orderBy: { createdAt: 'asc' },
        },
        quote: {
          select: {
            id: true,
            number: true,
          },
        },
      },
    });

    return invoice;
  }

  /**
   * Soft delete a draft invoice
   */
  async delete(workspaceId: string, id: string): Promise<void> {
    const existing = await prisma.invoice.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundError('Facture non trouvée');
    }

    if (existing.status !== 'draft') {
      throw new Error('Seules les factures en brouillon peuvent être supprimées');
    }

    await prisma.invoice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Duplicate an invoice
   */
  async duplicate(workspaceId: string, id: string): Promise<InvoiceWithDetails> {
    const original = await this.getById(workspaceId, id);

    if (!original) {
      throw new NotFoundError('Facture non trouvée');
    }

    // Generate new number
    const number = await quoteService.generateNumber(workspaceId, 'invoice');

    // Set due date to 30 days from now
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const invoice = await prisma.invoice.create({
      data: {
        workspaceId,
        contactId: original.contactId,
        number,
        status: 'draft',
        issueDate: new Date(),
        dueDate,
        subtotal: original.subtotal,
        vatAmount: original.vatAmount,
        total: original.total,
        paidAmount: 0,
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
            siret: true,
            vatNumber: true,
          },
        },
        lines: {
          orderBy: { createdAt: 'asc' },
        },
        quote: {
          select: {
            id: true,
            number: true,
          },
        },
      },
    });

    return invoice;
  }

  /**
   * Update overdue invoices
   */
  async updateOverdueInvoices(workspaceId: string): Promise<number> {
    const result = await prisma.invoice.updateMany({
      where: {
        workspaceId,
        status: 'sent',
        dueDate: { lt: new Date() },
        deletedAt: null,
      },
      data: { status: 'overdue' },
    });

    return result.count;
  }

  /**
   * Get invoice statistics for a workspace
   */
  async getStats(workspaceId: string): Promise<InvoiceStats> {
    const [draft, sent, paid, overdue] = await Promise.all([
      prisma.invoice.aggregate({
        where: { workspaceId, status: 'draft', deletedAt: null },
        _count: true,
        _sum: { total: true },
      }),
      prisma.invoice.aggregate({
        where: { workspaceId, status: 'sent', deletedAt: null },
        _count: true,
        _sum: { total: true },
      }),
      prisma.invoice.aggregate({
        where: { workspaceId, status: 'paid', deletedAt: null },
        _count: true,
        _sum: { total: true },
      }),
      prisma.invoice.aggregate({
        where: { workspaceId, status: 'overdue', deletedAt: null },
        _count: true,
        _sum: { total: true },
      }),
    ]);

    return {
      totalDraft: draft._count,
      totalSent: sent._count,
      totalPaid: paid._count,
      totalOverdue: overdue._count,
      amountDraft: draft._sum.total?.toNumber() || 0,
      amountSent: sent._sum.total?.toNumber() || 0,
      amountPaid: paid._sum.total?.toNumber() || 0,
      amountOverdue: overdue._sum.total?.toNumber() || 0,
    };
  }

  /**
   * Get recent invoices
   */
  async getRecent(workspaceId: string, limit = 5): Promise<InvoiceWithDetails[]> {
    const invoices = await prisma.invoice.findMany({
      where: {
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
            siret: true,
            vatNumber: true,
          },
        },
        lines: {
          orderBy: { createdAt: 'asc' },
        },
        quote: {
          select: {
            id: true,
            number: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return invoices;
  }
}

export const invoiceService = new InvoiceService();
