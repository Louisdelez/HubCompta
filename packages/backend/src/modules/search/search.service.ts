// ============================================================================
// SEARCH SERVICE - Finance Hub
// Global search across all entities
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { Prisma } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface SearchQuery {
  query: string;
  workspaceId: string;
  types?: SearchResultType[];
  limit?: number;
  offset?: number;
}

export type SearchResultType =
  | 'transaction'
  | 'document'
  | 'contact'
  | 'invoice'
  | 'quote'
  | 'account'
  | 'category'
  | 'recurrence';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  description?: string;
  date?: Date;
  amount?: number;
  currency?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  types: SearchResultType[];
}

export interface TransactionFilters {
  workspaceId: string;
  query?: string;
  accountIds?: string[];
  categoryIds?: string[];
  tagIds?: string[];
  types?: ('expense' | 'income' | 'transfer')[];
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
  status?: ('pending' | 'cleared' | 'reconciled')[];
  hasDocuments?: boolean;
  isRecurring?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'date' | 'amount' | 'description';
  sortOrder?: 'asc' | 'desc';
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: Omit<TransactionFilters, 'workspaceId' | 'page' | 'pageSize'>;
  isDefault: boolean;
  createdAt: Date;
}

// ----------------------------------------------------------------------------
// Search Service
// ----------------------------------------------------------------------------

export const searchService = {
  /**
   * Global search across all entity types
   */
  async globalSearch(params: SearchQuery): Promise<SearchResponse> {
    const { query, workspaceId, types, limit = 20, offset = 0 } = params;

    if (!query || query.length < 2) {
      return { results: [], total: 0, query, types: types ?? [] };
    }

    const searchTypes = types ?? [
      'transaction',
      'document',
      'contact',
      'invoice',
      'quote',
      'account',
      'recurrence',
    ];

    const results: SearchResult[] = [];
    let total = 0;

    // Search in parallel for better performance
    const searchPromises: Promise<void>[] = [];

    // Search transactions
    if (searchTypes.includes('transaction')) {
      searchPromises.push(
        this.searchTransactions(query, workspaceId, limit).then((r) => {
          results.push(...r.results);
          total += r.total;
        })
      );
    }

    // Search documents
    if (searchTypes.includes('document')) {
      searchPromises.push(
        this.searchDocuments(query, workspaceId, limit).then((r) => {
          results.push(...r.results);
          total += r.total;
        })
      );
    }

    // Search contacts
    if (searchTypes.includes('contact')) {
      searchPromises.push(
        this.searchContacts(query, workspaceId, limit).then((r) => {
          results.push(...r.results);
          total += r.total;
        })
      );
    }

    // Search invoices
    if (searchTypes.includes('invoice')) {
      searchPromises.push(
        this.searchInvoices(query, workspaceId, limit).then((r) => {
          results.push(...r.results);
          total += r.total;
        })
      );
    }

    // Search quotes
    if (searchTypes.includes('quote')) {
      searchPromises.push(
        this.searchQuotes(query, workspaceId, limit).then((r) => {
          results.push(...r.results);
          total += r.total;
        })
      );
    }

    // Search accounts
    if (searchTypes.includes('account')) {
      searchPromises.push(
        this.searchAccounts(query, workspaceId, limit).then((r) => {
          results.push(...r.results);
          total += r.total;
        })
      );
    }

    // Search recurrences
    if (searchTypes.includes('recurrence')) {
      searchPromises.push(
        this.searchRecurrences(query, workspaceId, limit).then((r) => {
          results.push(...r.results);
          total += r.total;
        })
      );
    }

    await Promise.all(searchPromises);

    // Sort by relevance (date for now, could be improved with scoring)
    results.sort((a, b) => {
      if (a.date && b.date) {
        return b.date.getTime() - a.date.getTime();
      }
      return 0;
    });

    // Apply pagination
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      total,
      query,
      types: searchTypes,
    };
  },

  /**
   * Search transactions
   */
  async searchTransactions(
    query: string,
    workspaceId: string,
    limit: number
  ): Promise<{ results: SearchResult[]; total: number }> {
    const _searchPattern = `%${query}%`;

    const [transactions, count] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          OR: [
            { description: { contains: query, mode: 'insensitive' } },
            { notes: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          account: { select: { name: true } },
          category: { select: { name: true, icon: true } },
        },
        orderBy: { date: 'desc' },
        take: limit,
      }),
      prisma.transaction.count({
        where: {
          workspaceId,
          deletedAt: null,
          OR: [
            { description: { contains: query, mode: 'insensitive' } },
            { notes: { contains: query, mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    return {
      results: transactions.map((t) => ({
        id: t.id,
        type: 'transaction' as const,
        title: t.description,
        subtitle: t.account.name,
        description: t.category?.name,
        date: t.date,
        amount: Number(t.amount),
        currency: t.currency,
        icon: t.category?.icon ?? (t.type === 'expense' ? '📤' : t.type === 'income' ? '📥' : '🔄'),
        metadata: {
          transactionType: t.type,
        },
      })),
      total: count,
    };
  },

  /**
   * Search documents
   */
  async searchDocuments(
    query: string,
    workspaceId: string,
    limit: number
  ): Promise<{ results: SearchResult[]; total: number }> {
    const [documents, count] = await Promise.all([
      prisma.document.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          filename: { contains: query, mode: 'insensitive' },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.document.count({
        where: {
          workspaceId,
          deletedAt: null,
          filename: { contains: query, mode: 'insensitive' },
        },
      }),
    ]);

    return {
      results: documents.map((d) => ({
        id: d.id,
        type: 'document' as const,
        title: d.filename,
        subtitle: d.mimeType,
        date: d.createdAt,
        icon: '📄',
        metadata: {
          status: d.status,
          size: d.size,
        },
      })),
      total: count,
    };
  },

  /**
   * Search contacts
   */
  async searchContacts(
    query: string,
    workspaceId: string,
    limit: number
  ): Promise<{ results: SearchResult[]; total: number }> {
    const [contacts, count] = await Promise.all([
      prisma.contact.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { name: 'asc' },
        take: limit,
      }),
      prisma.contact.count({
        where: {
          workspaceId,
          deletedAt: null,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    return {
      results: contacts.map((c) => ({
        id: c.id,
        type: 'contact' as const,
        title: c.name,
        subtitle: c.email ?? undefined,
        description: c.type,
        date: c.createdAt,
        icon: c.type === 'client' ? '👤' : '🏢',
        metadata: {
          contactType: c.type,
          phone: c.phone,
        },
      })),
      total: count,
    };
  },

  /**
   * Search invoices
   */
  async searchInvoices(
    query: string,
    workspaceId: string,
    limit: number
  ): Promise<{ results: SearchResult[]; total: number }> {
    const [invoices, count] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          OR: [
            { number: { contains: query, mode: 'insensitive' } },
            { notes: { contains: query, mode: 'insensitive' } },
            { contact: { name: { contains: query, mode: 'insensitive' } } },
          ],
        },
        include: {
          contact: { select: { name: true } },
        },
        orderBy: { issueDate: 'desc' },
        take: limit,
      }),
      prisma.invoice.count({
        where: {
          workspaceId,
          deletedAt: null,
          OR: [
            { number: { contains: query, mode: 'insensitive' } },
            { notes: { contains: query, mode: 'insensitive' } },
            { contact: { name: { contains: query, mode: 'insensitive' } } },
          ],
        },
      }),
    ]);

    return {
      results: invoices.map((i) => ({
        id: i.id,
        type: 'invoice' as const,
        title: `Facture ${i.number}`,
        subtitle: i.contact.name,
        date: i.issueDate,
        amount: Number(i.total),
        icon: '📃',
        metadata: {
          status: i.status,
          dueDate: i.dueDate,
        },
      })),
      total: count,
    };
  },

  /**
   * Search quotes
   */
  async searchQuotes(
    query: string,
    workspaceId: string,
    limit: number
  ): Promise<{ results: SearchResult[]; total: number }> {
    const [quotes, count] = await Promise.all([
      prisma.quote.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          OR: [
            { number: { contains: query, mode: 'insensitive' } },
            { notes: { contains: query, mode: 'insensitive' } },
            { contact: { name: { contains: query, mode: 'insensitive' } } },
          ],
        },
        include: {
          contact: { select: { name: true } },
        },
        orderBy: { issueDate: 'desc' },
        take: limit,
      }),
      prisma.quote.count({
        where: {
          workspaceId,
          deletedAt: null,
          OR: [
            { number: { contains: query, mode: 'insensitive' } },
            { notes: { contains: query, mode: 'insensitive' } },
            { contact: { name: { contains: query, mode: 'insensitive' } } },
          ],
        },
      }),
    ]);

    return {
      results: quotes.map((q) => ({
        id: q.id,
        type: 'quote' as const,
        title: `Devis ${q.number}`,
        subtitle: q.contact.name,
        date: q.issueDate,
        amount: Number(q.total),
        icon: '📝',
        metadata: {
          status: q.status,
          validUntil: q.validUntil,
        },
      })),
      total: count,
    };
  },

  /**
   * Search accounts
   */
  async searchAccounts(
    query: string,
    workspaceId: string,
    limit: number
  ): Promise<{ results: SearchResult[]; total: number }> {
    const [accounts, count] = await Promise.all([
      prisma.account.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          name: { contains: query, mode: 'insensitive' },
        },
        orderBy: { name: 'asc' },
        take: limit,
      }),
      prisma.account.count({
        where: {
          workspaceId,
          deletedAt: null,
          name: { contains: query, mode: 'insensitive' },
        },
      }),
    ]);

    return {
      results: accounts.map((a) => ({
        id: a.id,
        type: 'account' as const,
        title: a.name,
        subtitle: a.type,
        amount: Number(a.balance),
        currency: a.currency,
        icon: a.icon ?? '🏦',
        metadata: {
          accountType: a.type,
          color: a.color,
        },
      })),
      total: count,
    };
  },

  /**
   * Search recurrences
   */
  async searchRecurrences(
    query: string,
    workspaceId: string,
    limit: number
  ): Promise<{ results: SearchResult[]; total: number }> {
    const [recurrences, count] = await Promise.all([
      prisma.recurrence.findMany({
        where: {
          workspaceId,
          name: { contains: query, mode: 'insensitive' },
        },
        orderBy: { name: 'asc' },
        take: limit,
      }),
      prisma.recurrence.count({
        where: {
          workspaceId,
          name: { contains: query, mode: 'insensitive' },
        },
      }),
    ]);

    return {
      results: recurrences.map((r) => ({
        id: r.id,
        type: 'recurrence' as const,
        title: r.name,
        subtitle: r.frequency,
        date: r.nextRunAt,
        icon: '🔄',
        metadata: {
          isActive: r.isActive,
          frequency: r.frequency,
          interval: r.interval,
        },
      })),
      total: count,
    };
  },

  /**
   * Advanced transaction search with filters
   */
  async searchTransactionsAdvanced(filters: TransactionFilters) {
    const {
      workspaceId,
      query,
      accountIds,
      categoryIds,
      tagIds,
      types,
      dateFrom,
      dateTo,
      amountMin,
      amountMax,
      status,
      hasDocuments,
      isRecurring,
      page = 1,
      pageSize = 50,
      sortBy = 'date',
      sortOrder = 'desc',
    } = filters;

    // Build where clause
    const where: Prisma.TransactionWhereInput = {
      workspaceId,
      deletedAt: null,
    };

    // Text search
    if (query && query.length >= 2) {
      where.OR = [
        { description: { contains: query, mode: 'insensitive' } },
        { notes: { contains: query, mode: 'insensitive' } },
      ];
    }

    // Account filter
    if (accountIds && accountIds.length > 0) {
      where.accountId = { in: accountIds };
    }

    // Category filter
    if (categoryIds && categoryIds.length > 0) {
      where.categoryId = { in: categoryIds };
    }

    // Tag filter
    if (tagIds && tagIds.length > 0) {
      where.tags = {
        some: {
          tagId: { in: tagIds },
        },
      };
    }

    // Type filter
    if (types && types.length > 0) {
      where.type = { in: types };
    }

    // Date range
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) {
        where.date.gte = dateFrom;
      }
      if (dateTo) {
        where.date.lte = dateTo;
      }
    }

    // Amount range
    if (amountMin !== undefined || amountMax !== undefined) {
      where.amount = {};
      if (amountMin !== undefined) {
        where.amount.gte = amountMin;
      }
      if (amountMax !== undefined) {
        where.amount.lte = amountMax;
      }
    }

    // Status filter
    if (status && status.length > 0) {
      where.status = { in: status };
    }

    // Has documents filter
    if (hasDocuments !== undefined) {
      if (hasDocuments) {
        where.documentLinks = { some: {} };
      } else {
        where.documentLinks = { none: {} };
      }
    }

    // Recurring filter
    if (isRecurring !== undefined) {
      where.isRecurring = isRecurring;
    }

    // Build order by
    const orderBy: Prisma.TransactionOrderByWithRelationInput = {};
    orderBy[sortBy] = sortOrder;

    // Execute query
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          account: { select: { id: true, name: true, currency: true } },
          category: { select: { id: true, name: true, icon: true, color: true } },
          tags: {
            include: {
              tag: { select: { id: true, name: true, color: true } },
            },
          },
          documentLinks: {
            include: {
              document: { select: { id: true, filename: true } },
            },
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.transaction.count({ where }),
    ]);

    // Calculate totals
    const totalsResult = await prisma.transaction.aggregate({
      where,
      _sum: { amount: true },
      _count: true,
    });

    const incomeTotal = await prisma.transaction.aggregate({
      where: { ...where, type: 'income' },
      _sum: { amount: true },
    });

    const expenseTotal = await prisma.transaction.aggregate({
      where: { ...where, type: 'expense' },
      _sum: { amount: true },
    });

    return {
      data: transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
        tags: t.tags.map((tt) => tt.tag),
        documents: t.documentLinks.map((dl) => dl.document),
      })),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      totals: {
        count: totalsResult._count,
        sum: Number(totalsResult._sum.amount ?? 0),
        income: Number(incomeTotal._sum.amount ?? 0),
        expense: Math.abs(Number(expenseTotal._sum.amount ?? 0)),
      },
    };
  },
};

export default searchService;
