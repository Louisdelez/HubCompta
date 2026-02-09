// ============================================================================
// CONTACT SERVICE - Finance Hub
// Client & Supplier management for Pro mode
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { ContactCreateInput, ContactUpdateInput } from '@finance-hub/shared';
import type { ContactType, Prisma } from '@prisma/client';
import { NotFoundError } from '@/core/middleware/errorHandler.js';
import { validateSiret, validateFrenchVatNumber } from './vat.utils.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface ContactFilters {
  type?: ContactType;
  search?: string;
}

export interface ContactWithStats {
  id: string;
  workspaceId: string;
  type: ContactType;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  siret: string | null;
  vatNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    quotes: number;
    invoices: number;
  };
  totalInvoiced?: number;
  totalPaid?: number;
}

// ----------------------------------------------------------------------------
// Service
// ----------------------------------------------------------------------------

class ContactService {
  /**
   * List contacts for a workspace
   */
  async list(
    workspaceId: string,
    filters: ContactFilters = {}
  ): Promise<ContactWithStats[]> {
    const where: Prisma.ContactWhereInput = {
      workspaceId,
      deletedAt: null,
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { siret: { contains: filters.search } },
      ];
    }

    const contacts = await prisma.contact.findMany({
      where,
      include: {
        _count: {
          select: {
            quotes: true,
            invoices: { where: { deletedAt: null } },
          },
        },
        invoices: {
          where: { deletedAt: null },
          select: {
            total: true,
            paidAmount: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return contacts.map((contact) => {
      const totalInvoiced = contact.invoices.reduce(
        (sum, inv) => sum + inv.total.toNumber(),
        0
      );
      const totalPaid = contact.invoices.reduce(
        (sum, inv) => sum + inv.paidAmount.toNumber(),
        0
      );

      const { invoices: _, ...rest } = contact;
      return {
        ...rest,
        totalInvoiced,
        totalPaid,
      };
    });
  }

  /**
   * Get contact by ID
   */
  async getById(workspaceId: string, id: string): Promise<ContactWithStats | null> {
    const contact = await prisma.contact.findFirst({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            quotes: true,
            invoices: { where: { deletedAt: null } },
          },
        },
        invoices: {
          where: { deletedAt: null },
          select: {
            total: true,
            paidAmount: true,
          },
        },
      },
    });

    if (!contact) return null;

    const totalInvoiced = contact.invoices.reduce(
      (sum, inv) => sum + inv.total.toNumber(),
      0
    );
    const totalPaid = contact.invoices.reduce(
      (sum, inv) => sum + inv.paidAmount.toNumber(),
      0
    );

    const { invoices: _, ...rest } = contact;
    return {
      ...rest,
      totalInvoiced,
      totalPaid,
    };
  }

  /**
   * Create a new contact
   */
  create(workspaceId: string, input: ContactCreateInput) {
    // Validate SIRET if provided
    if (input.siret && !validateSiret(input.siret)) {
      throw new Error('Numéro SIRET invalide');
    }

    // Validate VAT number if provided
    if (input.vatNumber && !validateFrenchVatNumber(input.vatNumber)) {
      throw new Error('Numéro de TVA intracommunautaire invalide');
    }

    return prisma.contact.create({
      data: {
        workspaceId,
        type: input.type,
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
        siret: input.siret,
        vatNumber: input.vatNumber,
      },
      include: {
        _count: {
          select: {
            quotes: true,
            invoices: true,
          },
        },
      },
    });
  }

  /**
   * Update a contact
   */
  async update(workspaceId: string, id: string, input: ContactUpdateInput) {
    const existing = await prisma.contact.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundError('Contact non trouvé');
    }

    // Validate SIRET if provided
    if (input.siret && !validateSiret(input.siret)) {
      throw new Error('Numéro SIRET invalide');
    }

    // Validate VAT number if provided
    if (input.vatNumber && !validateFrenchVatNumber(input.vatNumber)) {
      throw new Error('Numéro de TVA intracommunautaire invalide');
    }

    return prisma.contact.update({
      where: { id },
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
        siret: input.siret,
        vatNumber: input.vatNumber,
      },
      include: {
        _count: {
          select: {
            quotes: true,
            invoices: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete a contact
   */
  async delete(workspaceId: string, id: string): Promise<void> {
    const existing = await prisma.contact.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        _count: {
          select: {
            quotes: { where: { deletedAt: null } },
            invoices: { where: { deletedAt: null, status: { not: 'cancelled' } } },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError('Contact non trouvé');
    }

    // Check for active quotes/invoices
    if (existing._count.quotes > 0 || existing._count.invoices > 0) {
      throw new Error(
        'Impossible de supprimer ce contact car il a des devis ou factures actifs'
      );
    }

    await prisma.contact.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Get contact statistics
   */
  async getStats(workspaceId: string) {
    const [clientCount, supplierCount, recentActivity] = await Promise.all([
      prisma.contact.count({
        where: { workspaceId, type: 'client', deletedAt: null },
      }),
      prisma.contact.count({
        where: { workspaceId, type: 'supplier', deletedAt: null },
      }),
      prisma.invoice.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          status: { in: ['sent', 'overdue'] },
        },
        select: {
          id: true,
          number: true,
          total: true,
          dueDate: true,
          contact: {
            select: { name: true },
          },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
    ]);

    return {
      clientCount,
      supplierCount,
      totalContacts: clientCount + supplierCount,
      pendingInvoices: recentActivity,
    };
  }
}

export const contactService = new ContactService();
