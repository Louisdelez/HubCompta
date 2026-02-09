// ============================================================================
// SEARCH SERVICE - Finance Hub
// Global search with PostgreSQL full-text search support
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { Prisma } from '@prisma/client';
import { logger } from '@/core/middleware/logger.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface SearchQuery {
  query: string;
  workspaceId: string;
  userId?: string;
  types?: SearchResultType[];
  limit?: number;
  offset?: number;
  filters?: SearchFilters;
}

export interface SearchFilters {
  dateFrom?: Date;
  dateTo?: Date;
  categoryIds?: string[];
  accountIds?: string[];
  amountMin?: number;
  amountMax?: number;
  contactType?: 'client' | 'supplier';
  documentStatus?: 'inbox' | 'linked' | 'archived';
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
  rank?: number;
  metadata?: Record<string, unknown>;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  types: SearchResultType[];
  facets?: SearchFacets;
}

export interface SearchFacets {
  types: { type: SearchResultType; count: number }[];
  accounts?: { id: string; name: string; count: number }[];
  categories?: { id: string; name: string; count: number }[];
  dateRange?: { min: Date; max: Date };
  amountRange?: { min: number; max: number };
}

export interface FacetedSearchResponse extends SearchResponse {
  facets: SearchFacets;
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

export interface SearchSuggestion {
  term: string;
  count: number;
  type: 'recent' | 'popular';
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Convert search query to PostgreSQL tsquery format
 * Supports prefix matching and OR operators
 */
function toTsQuery(query: string): string {
  // Escape special characters and prepare for tsquery
  const sanitized = query
    .replace(/[<>:*&|!()]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `${term}:*`) // Prefix matching
    .join(' | '); // OR operator for flexibility

  return sanitized || '';
}

/**
 * Convert search query to AND-based tsquery for stricter matching
 * Can be used for more precise search when needed
 */
function _toStrictTsQuery(query: string): string {
  const sanitized = query
    .replace(/[<>:*&|!()]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `${term}:*`)
    .join(' & ');

  return sanitized || '';
}

// ----------------------------------------------------------------------------
// Search Service
// ----------------------------------------------------------------------------

export const searchService = {
  /**
   * Global full-text search across all entity types
   */
  async globalSearch(params: SearchQuery): Promise<SearchResponse> {
    const { query, workspaceId, userId, types, limit = 20, offset = 0, filters } = params;

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

    // Search transactions with full-text
    if (searchTypes.includes('transaction')) {
      searchPromises.push(
        this.fullTextSearchTransactions(query, workspaceId, limit, filters).then((r) => {
          results.push(...r.results);
          total += r.total;
        })
      );
    }

    // Search documents with full-text
    if (searchTypes.includes('document')) {
      searchPromises.push(
        this.fullTextSearchDocuments(query, workspaceId, limit, filters).then((r) => {
          results.push(...r.results);
          total += r.total;
        })
      );
    }

    // Search contacts with full-text
    if (searchTypes.includes('contact')) {
      searchPromises.push(
        this.fullTextSearchContacts(query, workspaceId, limit, filters).then((r) => {
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

    // Sort by relevance rank, then by date
    results.sort((a, b) => {
      // First sort by rank (higher is better)
      const rankDiff = (b.rank ?? 0) - (a.rank ?? 0);
      if (rankDiff !== 0) return rankDiff;

      // Then by date (more recent first)
      if (a.date && b.date) {
        return b.date.getTime() - a.date.getTime();
      }
      return 0;
    });

    // Apply pagination
    const paginatedResults = results.slice(offset, offset + limit);

    // Record search in history if userId is provided
    if (userId) {
      await this.recordSearch(workspaceId, userId, query, total, searchTypes);
    }

    return {
      results: paginatedResults,
      total,
      query,
      types: searchTypes,
    };
  },

  /**
   * Faceted search with filter options and aggregations
   */
  async facetedSearch(params: SearchQuery): Promise<FacetedSearchResponse> {
    const { query, workspaceId, userId, types, filters } = params;

    // Get base search results
    const baseResults = await this.globalSearch(params);

    // Calculate facets
    const facets = await this.calculateFacets(query, workspaceId, types, filters);

    // Record search in history
    if (userId) {
      await this.recordSearch(workspaceId, userId, query, baseResults.total, types ?? []);
    }

    return {
      ...baseResults,
      facets,
    };
  },

  /**
   * Calculate search facets for filtering
   */
  async calculateFacets(
    query: string,
    workspaceId: string,
    types?: SearchResultType[],
    _filters?: SearchFilters
  ): Promise<SearchFacets> {
    const tsquery = toTsQuery(query);
    const searchTypes = types ?? ['transaction', 'document', 'contact'];

    // Type facets - count results per type
    const typeFacets: { type: SearchResultType; count: number }[] = [];

    if (searchTypes.includes('transaction') && tsquery) {
      const transactionCount = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM transactions t
        WHERE t.workspace_id = ${workspaceId}::uuid
          AND t.deleted_at IS NULL
          AND t.search_vector @@ to_tsquery('french', ${tsquery})
      `;
      typeFacets.push({ type: 'transaction', count: Number(transactionCount[0]?.count ?? 0) });
    }

    if (searchTypes.includes('document') && tsquery) {
      const documentCount = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM documents d
        WHERE d.workspace_id = ${workspaceId}::uuid
          AND d.deleted_at IS NULL
          AND d.search_vector @@ to_tsquery('french', ${tsquery})
      `;
      typeFacets.push({ type: 'document', count: Number(documentCount[0]?.count ?? 0) });
    }

    if (searchTypes.includes('contact') && tsquery) {
      const contactCount = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM contacts c
        WHERE c.workspace_id = ${workspaceId}::uuid
          AND c.deleted_at IS NULL
          AND c.search_vector @@ to_tsquery('french', ${tsquery})
      `;
      typeFacets.push({ type: 'contact', count: Number(contactCount[0]?.count ?? 0) });
    }

    // Account facets for transactions
    let accountFacets: { id: string; name: string; count: number }[] = [];
    if (searchTypes.includes('transaction') && tsquery) {
      const accounts = await prisma.$queryRaw<{ id: string; name: string; count: bigint }[]>`
        SELECT a.id, a.name, COUNT(*) as count
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        WHERE t.workspace_id = ${workspaceId}::uuid
          AND t.deleted_at IS NULL
          AND t.search_vector @@ to_tsquery('french', ${tsquery})
        GROUP BY a.id, a.name
        ORDER BY count DESC
        LIMIT 10
      `;
      accountFacets = accounts.map((a) => ({ id: a.id, name: a.name, count: Number(a.count) }));
    }

    // Category facets for transactions
    let categoryFacets: { id: string; name: string; count: number }[] = [];
    if (searchTypes.includes('transaction') && tsquery) {
      const categories = await prisma.$queryRaw<{ id: string; name: string; count: bigint }[]>`
        SELECT c.id, c.name, COUNT(*) as count
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.workspace_id = ${workspaceId}::uuid
          AND t.deleted_at IS NULL
          AND t.search_vector @@ to_tsquery('french', ${tsquery})
        GROUP BY c.id, c.name
        ORDER BY count DESC
        LIMIT 10
      `;
      categoryFacets = categories.map((c) => ({ id: c.id, name: c.name, count: Number(c.count) }));
    }

    // Date range for transactions
    let dateRange: { min: Date; max: Date } | undefined;
    if (searchTypes.includes('transaction') && tsquery) {
      const dates = await prisma.$queryRaw<[{ min_date: Date | null; max_date: Date | null }]>`
        SELECT MIN(date) as min_date, MAX(date) as max_date
        FROM transactions t
        WHERE t.workspace_id = ${workspaceId}::uuid
          AND t.deleted_at IS NULL
          AND t.search_vector @@ to_tsquery('french', ${tsquery})
      `;
      if (dates[0]?.min_date && dates[0]?.max_date) {
        dateRange = { min: dates[0].min_date, max: dates[0].max_date };
      }
    }

    // Amount range for transactions
    let amountRange: { min: number; max: number } | undefined;
    if (searchTypes.includes('transaction') && tsquery) {
      const amounts = await prisma.$queryRaw<[{ min_amount: string | null; max_amount: string | null }]>`
        SELECT MIN(ABS(amount)) as min_amount, MAX(ABS(amount)) as max_amount
        FROM transactions t
        WHERE t.workspace_id = ${workspaceId}::uuid
          AND t.deleted_at IS NULL
          AND t.search_vector @@ to_tsquery('french', ${tsquery})
      `;
      if (amounts[0]?.min_amount && amounts[0]?.max_amount) {
        amountRange = {
          min: parseFloat(amounts[0].min_amount),
          max: parseFloat(amounts[0].max_amount),
        };
      }
    }

    return {
      types: typeFacets,
      accounts: accountFacets.length > 0 ? accountFacets : undefined,
      categories: categoryFacets.length > 0 ? categoryFacets : undefined,
      dateRange,
      amountRange,
    };
  },

  /**
   * Full-text search on transactions using PostgreSQL tsvector
   */
  async fullTextSearchTransactions(
    query: string,
    workspaceId: string,
    limit: number,
    filters?: SearchFilters
  ): Promise<{ results: SearchResult[]; total: number }> {
    const tsquery = toTsQuery(query);

    if (!tsquery) {
      return this.searchTransactions(query, workspaceId, limit);
    }

    // Build filter conditions
    let filterConditions = '';
    const filterParams: unknown[] = [];

    if (filters?.dateFrom) {
      filterConditions += ` AND t.date >= $${filterParams.length + 3}`;
      filterParams.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      filterConditions += ` AND t.date <= $${filterParams.length + 3}`;
      filterParams.push(filters.dateTo);
    }
    if (filters?.categoryIds && filters.categoryIds.length > 0) {
      filterConditions += ` AND t.category_id = ANY($${filterParams.length + 3}::uuid[])`;
      filterParams.push(filters.categoryIds);
    }
    if (filters?.accountIds && filters.accountIds.length > 0) {
      filterConditions += ` AND t.account_id = ANY($${filterParams.length + 3}::uuid[])`;
      filterParams.push(filters.accountIds);
    }
    if (filters?.amountMin !== undefined) {
      filterConditions += ` AND ABS(t.amount) >= $${filterParams.length + 3}`;
      filterParams.push(filters.amountMin);
    }
    if (filters?.amountMax !== undefined) {
      filterConditions += ` AND ABS(t.amount) <= $${filterParams.length + 3}`;
      filterParams.push(filters.amountMax);
    }

    // Full-text search with ranking
    const transactions = await prisma.$queryRawUnsafe<
      {
        id: string;
        description: string;
        notes: string | null;
        date: Date;
        amount: string;
        currency: string;
        type: string;
        account_name: string;
        category_name: string | null;
        category_icon: string | null;
        rank: number;
      }[]
    >(
      `
      SELECT
        t.id,
        t.description,
        t.notes,
        t.date,
        t.amount::text,
        t.currency,
        t.type,
        a.name as account_name,
        c.name as category_name,
        c.icon as category_icon,
        ts_rank(t.search_vector, to_tsquery('french', $1)) as rank
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.workspace_id = $2::uuid
        AND t.deleted_at IS NULL
        AND t.search_vector @@ to_tsquery('french', $1)
        ${filterConditions}
      ORDER BY rank DESC, t.date DESC
      LIMIT $${filterParams.length + 3}
      `,
      tsquery,
      workspaceId,
      ...filterParams,
      limit
    );

    // Get total count
    const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `
      SELECT COUNT(*) as count
      FROM transactions t
      WHERE t.workspace_id = $2::uuid
        AND t.deleted_at IS NULL
        AND t.search_vector @@ to_tsquery('french', $1)
        ${filterConditions}
      `,
      tsquery,
      workspaceId,
      ...filterParams
    );

    return {
      results: transactions.map((t) => ({
        id: t.id,
        type: 'transaction' as const,
        title: t.description,
        subtitle: t.account_name,
        description: t.category_name ?? undefined,
        date: t.date,
        amount: parseFloat(t.amount),
        currency: t.currency,
        icon: t.category_icon ?? (t.type === 'expense' ? '📤' : t.type === 'income' ? '📥' : '🔄'),
        rank: t.rank,
        metadata: {
          transactionType: t.type,
        },
      })),
      total: Number(countResult[0]?.count ?? 0),
    };
  },

  /**
   * Full-text search on documents using PostgreSQL tsvector
   */
  async fullTextSearchDocuments(
    query: string,
    workspaceId: string,
    limit: number,
    filters?: SearchFilters
  ): Promise<{ results: SearchResult[]; total: number }> {
    const tsquery = toTsQuery(query);

    if (!tsquery) {
      return this.searchDocuments(query, workspaceId, limit);
    }

    // Note: filters.documentStatus could be used with $queryRawUnsafe for dynamic filtering
    // For now, we use the simpler tagged template approach
    const _documentStatus = filters?.documentStatus;

    // Full-text search with ranking
    const documents = await prisma.$queryRaw<
      {
        id: string;
        filename: string;
        mime_type: string;
        status: string;
        size: number;
        created_at: Date;
        rank: number;
      }[]
    >`
      SELECT
        d.id,
        d.filename,
        d.mime_type,
        d.status,
        d.size,
        d.created_at,
        ts_rank(d.search_vector, to_tsquery('french', ${tsquery})) as rank
      FROM documents d
      WHERE d.workspace_id = ${workspaceId}::uuid
        AND d.deleted_at IS NULL
        AND d.search_vector @@ to_tsquery('french', ${tsquery})
      ORDER BY rank DESC, d.created_at DESC
      LIMIT ${limit}
    `;

    // Get total count
    const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM documents d
      WHERE d.workspace_id = ${workspaceId}::uuid
        AND d.deleted_at IS NULL
        AND d.search_vector @@ to_tsquery('french', ${tsquery})
    `;

    return {
      results: documents.map((d) => ({
        id: d.id,
        type: 'document' as const,
        title: d.filename,
        subtitle: d.mime_type,
        date: d.created_at,
        icon: '📄',
        rank: d.rank,
        metadata: {
          status: d.status,
          size: d.size,
        },
      })),
      total: Number(countResult[0]?.count ?? 0),
    };
  },

  /**
   * Full-text search on contacts using PostgreSQL tsvector
   */
  async fullTextSearchContacts(
    query: string,
    workspaceId: string,
    limit: number,
    filters?: SearchFilters
  ): Promise<{ results: SearchResult[]; total: number }> {
    const tsquery = toTsQuery(query);

    if (!tsquery) {
      return this.searchContacts(query, workspaceId, limit);
    }

    // Note: filters.contactType could be used with $queryRawUnsafe for dynamic filtering
    // For now, we use the simpler tagged template approach
    const _contactType = filters?.contactType;

    // Full-text search with ranking
    const contacts = await prisma.$queryRaw<
      {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        company: string | null;
        type: string;
        created_at: Date;
        rank: number;
      }[]
    >`
      SELECT
        c.id,
        c.name,
        c.email,
        c.phone,
        c.company,
        c.type,
        c.created_at,
        ts_rank(c.search_vector, to_tsquery('french', ${tsquery})) as rank
      FROM contacts c
      WHERE c.workspace_id = ${workspaceId}::uuid
        AND c.deleted_at IS NULL
        AND c.search_vector @@ to_tsquery('french', ${tsquery})
      ORDER BY rank DESC, c.name ASC
      LIMIT ${limit}
    `;

    // Get total count
    const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM contacts c
      WHERE c.workspace_id = ${workspaceId}::uuid
        AND c.deleted_at IS NULL
        AND c.search_vector @@ to_tsquery('french', ${tsquery})
    `;

    return {
      results: contacts.map((c) => ({
        id: c.id,
        type: 'contact' as const,
        title: c.name,
        subtitle: c.email ?? c.company ?? undefined,
        description: c.type,
        date: c.created_at,
        icon: c.type === 'client' ? '👤' : '🏢',
        rank: c.rank,
        metadata: {
          contactType: c.type,
          phone: c.phone,
          company: c.company,
        },
      })),
      total: Number(countResult[0]?.count ?? 0),
    };
  },

  /**
   * Fallback search for transactions (LIKE-based)
   */
  async searchTransactions(
    query: string,
    workspaceId: string,
    limit: number
  ): Promise<{ results: SearchResult[]; total: number }> {
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
   * Fallback search for documents (LIKE-based)
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
          OR: [
            { filename: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.document.count({
        where: {
          workspaceId,
          deletedAt: null,
          OR: [
            { filename: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
          ],
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
   * Fallback search for contacts (LIKE-based)
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
            { company: { contains: query, mode: 'insensitive' } },
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
            { company: { contains: query, mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    return {
      results: contacts.map((c) => ({
        id: c.id,
        type: 'contact' as const,
        title: c.name,
        subtitle: c.email ?? c.company ?? undefined,
        description: c.type,
        date: c.createdAt,
        icon: c.type === 'client' ? '👤' : '🏢',
        metadata: {
          contactType: c.type,
          phone: c.phone,
          company: c.company,
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

    // Use full-text search if query is provided
    if (query && query.length >= 2) {
      const tsquery = toTsQuery(query);
      if (tsquery) {
        // Use raw query for full-text search
        const ftResults = await this.fullTextSearchTransactions(query, workspaceId, pageSize, {
          dateFrom,
          dateTo,
          categoryIds,
          accountIds,
          amountMin,
          amountMax,
        });

        // If we have full-text results, use those IDs
        if (ftResults.results.length > 0) {
          where.id = { in: ftResults.results.map((r) => r.id) };
        } else {
          // Fallback to LIKE search
          where.OR = [
            { description: { contains: query, mode: 'insensitive' } },
            { notes: { contains: query, mode: 'insensitive' } },
          ];
        }
      } else {
        where.OR = [
          { description: { contains: query, mode: 'insensitive' } },
          { notes: { contains: query, mode: 'insensitive' } },
        ];
      }
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

  /**
   * Record a search query in history
   */
  async recordSearch(
    workspaceId: string,
    userId: string,
    query: string,
    resultCount: number,
    types: SearchResultType[]
  ): Promise<void> {
    try {
      // Record in search history
      await prisma.searchHistory.create({
        data: {
          workspaceId,
          userId,
          query: query.toLowerCase().trim(),
          resultCount,
          types: types,
        },
      });

      // Update search terms for suggestions
      const terms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 2);

      for (const term of terms) {
        await prisma.searchTerm.upsert({
          where: {
            workspaceId_term: {
              workspaceId,
              term,
            },
          },
          update: {
            count: { increment: 1 },
            lastUsedAt: new Date(),
          },
          create: {
            workspaceId,
            term,
            count: 1,
          },
        });
      }
    } catch (error) {
      // Don't fail the search if recording fails
      logger.error({ error }, 'Failed to record search');
    }
  },

  /**
   * Get search suggestions based on history and popular terms
   */
  async getSuggestions(
    workspaceId: string,
    userId: string,
    prefix: string,
    limit: number = 10
  ): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];
    const prefixLower = prefix.toLowerCase().trim();

    if (prefixLower.length < 1) {
      // Return recent searches if no prefix
      const recentSearches = await prisma.searchHistory.findMany({
        where: {
          workspaceId,
          userId,
        },
        distinct: ['query'],
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return recentSearches.map((s) => ({
        term: s.query,
        count: 1,
        type: 'recent' as const,
      }));
    }

    // Get recent user searches matching prefix
    const recentSearches = await prisma.searchHistory.findMany({
      where: {
        workspaceId,
        userId,
        query: { startsWith: prefixLower },
      },
      distinct: ['query'],
      orderBy: { createdAt: 'desc' },
      take: Math.floor(limit / 2),
    });

    for (const search of recentSearches) {
      suggestions.push({
        term: search.query,
        count: 1,
        type: 'recent',
      });
    }

    // Get popular terms matching prefix
    const popularTerms = await prisma.searchTerm.findMany({
      where: {
        workspaceId,
        term: { startsWith: prefixLower },
      },
      orderBy: { count: 'desc' },
      take: limit - suggestions.length,
    });

    for (const term of popularTerms) {
      // Avoid duplicates
      if (!suggestions.find((s) => s.term === term.term)) {
        suggestions.push({
          term: term.term,
          count: term.count,
          type: 'popular',
        });
      }
    }

    return suggestions.slice(0, limit);
  },

  /**
   * Get autocomplete suggestions from entity data
   */
  async getAutocompleteSuggestions(
    workspaceId: string,
    prefix: string,
    types: SearchResultType[] = ['transaction', 'contact', 'account'],
    limit: number = 5
  ): Promise<{ type: SearchResultType; suggestions: string[] }[]> {
    const results: { type: SearchResultType; suggestions: string[] }[] = [];
    const prefixLower = prefix.toLowerCase().trim();

    if (prefixLower.length < 2) {
      return results;
    }

    // Get transaction description suggestions
    if (types.includes('transaction')) {
      const transactions = await prisma.transaction.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          description: { startsWith: prefix, mode: 'insensitive' },
        },
        select: { description: true },
        distinct: ['description'],
        take: limit,
      });

      if (transactions.length > 0) {
        results.push({
          type: 'transaction',
          suggestions: transactions.map((t) => t.description),
        });
      }
    }

    // Get contact name suggestions
    if (types.includes('contact')) {
      const contacts = await prisma.contact.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          OR: [
            { name: { startsWith: prefix, mode: 'insensitive' } },
            { company: { startsWith: prefix, mode: 'insensitive' } },
          ],
        },
        select: { name: true, company: true },
        take: limit,
      });

      if (contacts.length > 0) {
        const contactSuggestions = contacts.flatMap((c) => {
          const suggestions = [c.name];
          if (c.company && c.company.toLowerCase().startsWith(prefixLower)) {
            suggestions.push(c.company);
          }
          return suggestions;
        });

        results.push({
          type: 'contact',
          suggestions: [...new Set(contactSuggestions)].slice(0, limit),
        });
      }
    }

    // Get account name suggestions
    if (types.includes('account')) {
      const accounts = await prisma.account.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          name: { startsWith: prefix, mode: 'insensitive' },
        },
        select: { name: true },
        take: limit,
      });

      if (accounts.length > 0) {
        results.push({
          type: 'account',
          suggestions: accounts.map((a) => a.name),
        });
      }
    }

    return results;
  },

  /**
   * Clear search history for a user
   */
  async clearSearchHistory(workspaceId: string, userId: string): Promise<void> {
    await prisma.searchHistory.deleteMany({
      where: {
        workspaceId,
        userId,
      },
    });
  },
};

export default searchService;
