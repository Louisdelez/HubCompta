// ============================================================================
// SEARCH API ROUTES - Finance Hub
// Full-text search with PostgreSQL support
// ============================================================================

import { FastifyPluginAsync } from 'fastify';
import { searchService, TransactionFilters, SearchFilters, SearchResultType } from '../../modules/search/index.js';
import { authGuard } from '../../core/auth/authGuard.js';
import { prisma } from '../../core/database/client.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface GlobalSearchQuery {
  q: string;
  types?: string;
  limit?: string;
  offset?: string;
  // Filters
  dateFrom?: string;
  dateTo?: string;
  categoryIds?: string;
  accountIds?: string;
  amountMin?: string;
  amountMax?: string;
}

interface FacetedSearchQuery extends GlobalSearchQuery {
  facets?: string; // 'true' to include facets
}

interface TransactionSearchQuery {
  query?: string;
  accountIds?: string;
  categoryIds?: string;
  tagIds?: string;
  types?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: string;
  amountMax?: string;
  status?: string;
  hasDocuments?: string;
  isRecurring?: string;
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface SaveFilterBody {
  name: string;
  filters: TransactionFilters;
  isDefault?: boolean;
}

interface SuggestionsQuery {
  prefix?: string;
  limit?: string;
}

interface AutocompleteQuery {
  prefix: string;
  types?: string;
  limit?: string;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function parseSearchFilters(query: GlobalSearchQuery): SearchFilters {
  const filters: SearchFilters = {};

  if (query.dateFrom) {
    filters.dateFrom = new Date(query.dateFrom);
  }
  if (query.dateTo) {
    filters.dateTo = new Date(query.dateTo);
  }
  if (query.categoryIds) {
    filters.categoryIds = query.categoryIds.split(',');
  }
  if (query.accountIds) {
    filters.accountIds = query.accountIds.split(',');
  }
  if (query.amountMin) {
    filters.amountMin = parseFloat(query.amountMin);
  }
  if (query.amountMax) {
    filters.amountMax = parseFloat(query.amountMax);
  }

  return filters;
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await
export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  // -------------------------------------------------------------------------
  // Global search across all entities
  // -------------------------------------------------------------------------
  fastify.get<{
    Querystring: GlobalSearchQuery;
  }>('/search', {
    preHandler: [authGuard],
    schema: {
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 1 },
          types: { type: 'string', description: 'Comma-separated list of types: transaction,document,contact,invoice,quote,account,recurrence' },
          limit: { type: 'string' },
          offset: { type: 'string' },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
          categoryIds: { type: 'string' },
          accountIds: { type: 'string' },
          amountMin: { type: 'string' },
          amountMax: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { q, types, limit, offset } = request.query;
    const user = request.user!;

    // Get user's default workspace
    const membership = await prisma.membership.findFirst({
      where: { userId: user.sub },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership) {
      return reply.status(400).send({ error: 'No workspace found' });
    }

    const filters = parseSearchFilters(request.query);

    const results = await searchService.globalSearch({
      query: q,
      workspaceId: membership.workspaceId,
      userId: user.sub,
      types: types?.split(',') as SearchResultType[] | undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      filters,
    });

    return {
      query: results.query,
      results: results.results,
      total: results.total,
      types: results.types,
    };
  });

  // -------------------------------------------------------------------------
  // Workspace-scoped global search
  // -------------------------------------------------------------------------
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: FacetedSearchQuery;
  }>('/workspaces/:workspaceId/search', {
    preHandler: [authGuard],
    schema: {
      params: {
        type: 'object',
        required: ['workspaceId'],
        properties: {
          workspaceId: { type: 'string', format: 'uuid' },
        },
      },
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 1 },
          types: { type: 'string' },
          limit: { type: 'string' },
          offset: { type: 'string' },
          facets: { type: 'string', enum: ['true', 'false'] },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
          categoryIds: { type: 'string' },
          accountIds: { type: 'string' },
          amountMin: { type: 'string' },
          amountMax: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { workspaceId } = request.params;
    const { q, types, limit, offset, facets } = request.query;
    const user = request.user!;

    const filters = parseSearchFilters(request.query);

    // Use faceted search if requested
    if (facets === 'true') {
      const results = await searchService.facetedSearch({
        query: q,
        workspaceId,
        userId: user.sub,
        types: types?.split(',') as SearchResultType[] | undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
        filters,
      });

      return {
        query: results.query,
        results: results.results,
        total: results.total,
        types: results.types,
        facets: results.facets,
      };
    }

    const results = await searchService.globalSearch({
      query: q,
      workspaceId,
      userId: user.sub,
      types: types?.split(',') as SearchResultType[] | undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      filters,
    });

    return {
      query: results.query,
      results: results.results,
      total: results.total,
      types: results.types,
    };
  });

  // -------------------------------------------------------------------------
  // Search suggestions (based on history and popular terms)
  // -------------------------------------------------------------------------
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: SuggestionsQuery;
  }>('/workspaces/:workspaceId/search/suggestions', {
    preHandler: [authGuard],
    schema: {
      params: {
        type: 'object',
        required: ['workspaceId'],
        properties: {
          workspaceId: { type: 'string', format: 'uuid' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          prefix: { type: 'string' },
          limit: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { workspaceId } = request.params;
    const { prefix = '', limit = '10' } = request.query;
    const user = request.user!;

    const suggestions = await searchService.getSuggestions(
      workspaceId,
      user.sub,
      prefix,
      parseInt(limit, 10)
    );

    return { suggestions };
  });

  // -------------------------------------------------------------------------
  // Autocomplete suggestions from entity data
  // -------------------------------------------------------------------------
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: AutocompleteQuery;
  }>('/workspaces/:workspaceId/search/autocomplete', {
    preHandler: [authGuard],
    schema: {
      params: {
        type: 'object',
        required: ['workspaceId'],
        properties: {
          workspaceId: { type: 'string', format: 'uuid' },
        },
      },
      querystring: {
        type: 'object',
        required: ['prefix'],
        properties: {
          prefix: { type: 'string', minLength: 2 },
          types: { type: 'string', description: 'Comma-separated: transaction,contact,account' },
          limit: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { workspaceId } = request.params;
    const { prefix, types, limit = '5' } = request.query;

    const suggestions = await searchService.getAutocompleteSuggestions(
      workspaceId,
      prefix,
      types?.split(',') as SearchResultType[] | undefined,
      parseInt(limit, 10)
    );

    return { suggestions };
  });

  // -------------------------------------------------------------------------
  // Clear search history
  // -------------------------------------------------------------------------
  fastify.delete<{
    Params: { workspaceId: string };
  }>('/workspaces/:workspaceId/search/history', {
    preHandler: [authGuard],
    schema: {
      params: {
        type: 'object',
        required: ['workspaceId'],
        properties: {
          workspaceId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    const { workspaceId } = request.params;
    const user = request.user!;

    await searchService.clearSearchHistory(workspaceId, user.sub);

    return reply.status(204).send();
  });

  // -------------------------------------------------------------------------
  // Advanced transaction search with filters
  // -------------------------------------------------------------------------
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: TransactionSearchQuery;
  }>('/workspaces/:workspaceId/transactions/search', {
    preHandler: [authGuard],
    schema: {
      params: {
        type: 'object',
        required: ['workspaceId'],
        properties: {
          workspaceId: { type: 'string', format: 'uuid' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          accountIds: { type: 'string' },
          categoryIds: { type: 'string' },
          tagIds: { type: 'string' },
          types: { type: 'string' },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
          amountMin: { type: 'string' },
          amountMax: { type: 'string' },
          status: { type: 'string' },
          hasDocuments: { type: 'string', enum: ['true', 'false'] },
          isRecurring: { type: 'string', enum: ['true', 'false'] },
          page: { type: 'string' },
          pageSize: { type: 'string' },
          sortBy: { type: 'string', enum: ['date', 'amount', 'description'] },
          sortOrder: { type: 'string', enum: ['asc', 'desc'] },
        },
      },
    },
  }, async (request) => {
    const { workspaceId } = request.params;
    const query = request.query;

    const filters: TransactionFilters = {
      workspaceId,
      query: query.query,
      accountIds: query.accountIds?.split(','),
      categoryIds: query.categoryIds?.split(','),
      tagIds: query.tagIds?.split(','),
      types: query.types?.split(',') as ('expense' | 'income' | 'transfer')[] | undefined,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      amountMin: query.amountMin ? parseFloat(query.amountMin) : undefined,
      amountMax: query.amountMax ? parseFloat(query.amountMax) : undefined,
      status: query.status?.split(',') as ('pending' | 'cleared' | 'reconciled')[] | undefined,
      hasDocuments: query.hasDocuments === 'true' ? true : query.hasDocuments === 'false' ? false : undefined,
      isRecurring: query.isRecurring === 'true' ? true : query.isRecurring === 'false' ? false : undefined,
      page: query.page ? parseInt(query.page, 10) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : undefined,
      sortBy: query.sortBy as 'date' | 'amount' | 'description' | undefined,
      sortOrder: query.sortOrder as 'asc' | 'desc' | undefined,
    };

    const results = await searchService.searchTransactionsAdvanced(filters);

    // Transform to expected frontend format
    return {
      transactions: results.data,
      total: results.meta.total,
      page: results.meta.page,
      pageSize: results.meta.pageSize,
      totalPages: results.meta.totalPages,
      totals: {
        income: results.totals.income,
        expense: results.totals.expense,
        net: results.totals.income - results.totals.expense,
        count: results.totals.count,
      },
    };
  });

  // -------------------------------------------------------------------------
  // Get saved filters
  // -------------------------------------------------------------------------
  fastify.get<{
    Params: { workspaceId: string };
  }>('/workspaces/:workspaceId/filters', {
    preHandler: [authGuard],
    schema: {
      params: {
        type: 'object',
        required: ['workspaceId'],
        properties: {
          workspaceId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request) => {
    const { workspaceId } = request.params;
    const user = request.user!;

    const filters = await prisma.savedFilter.findMany({
      where: {
        workspaceId,
        userId: user.sub,
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
    });

    return filters.map((f) => ({
      ...f,
      filters: JSON.parse(f.filters),
    }));
  });

  // -------------------------------------------------------------------------
  // Save a filter
  // -------------------------------------------------------------------------
  fastify.post<{
    Params: { workspaceId: string };
    Body: SaveFilterBody;
  }>('/workspaces/:workspaceId/filters', {
    preHandler: [authGuard],
    schema: {
      params: {
        type: 'object',
        required: ['workspaceId'],
        properties: {
          workspaceId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['name', 'filters'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          filters: { type: 'object' },
          isDefault: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const { workspaceId } = request.params;
    const { name, filters, isDefault } = request.body;
    const user = request.user!;

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.savedFilter.updateMany({
        where: {
          workspaceId,
          userId: user.sub,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const savedFilter = await prisma.savedFilter.create({
      data: {
        workspaceId,
        userId: user.sub,
        name,
        filters: JSON.stringify(filters),
        isDefault: isDefault ?? false,
      },
    });

    return reply.status(201).send({
      ...savedFilter,
      filters: JSON.parse(savedFilter.filters),
    });
  });

  // -------------------------------------------------------------------------
  // Update a saved filter
  // -------------------------------------------------------------------------
  fastify.patch<{
    Params: { workspaceId: string; filterId: string };
    Body: Partial<SaveFilterBody>;
  }>('/workspaces/:workspaceId/filters/:filterId', {
    preHandler: [authGuard],
    schema: {
      params: {
        type: 'object',
        required: ['workspaceId', 'filterId'],
        properties: {
          workspaceId: { type: 'string', format: 'uuid' },
          filterId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          filters: { type: 'object' },
          isDefault: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const { workspaceId, filterId } = request.params;
    const { name, filters, isDefault } = request.body;
    const user = request.user!;

    const existing = await prisma.savedFilter.findFirst({
      where: {
        id: filterId,
        workspaceId,
        userId: user.sub,
      },
    });

    if (!existing) {
      return reply.status(404).send({ error: 'Filter not found' });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.savedFilter.updateMany({
        where: {
          workspaceId,
          userId: user.sub,
          isDefault: true,
          id: { not: filterId },
        },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.savedFilter.update({
      where: { id: filterId },
      data: {
        ...(name && { name }),
        ...(filters && { filters: JSON.stringify(filters) }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    return {
      ...updated,
      filters: JSON.parse(updated.filters),
    };
  });

  // -------------------------------------------------------------------------
  // Delete a saved filter
  // -------------------------------------------------------------------------
  fastify.delete<{
    Params: { workspaceId: string; filterId: string };
  }>('/workspaces/:workspaceId/filters/:filterId', {
    preHandler: [authGuard],
    schema: {
      params: {
        type: 'object',
        required: ['workspaceId', 'filterId'],
        properties: {
          workspaceId: { type: 'string', format: 'uuid' },
          filterId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    const { workspaceId, filterId } = request.params;
    const user = request.user!;

    const existing = await prisma.savedFilter.findFirst({
      where: {
        id: filterId,
        workspaceId,
        userId: user.sub,
      },
    });

    if (!existing) {
      return reply.status(404).send({ error: 'Filter not found' });
    }

    await prisma.savedFilter.delete({
      where: { id: filterId },
    });

    return reply.status(204).send();
  });
};

export default searchRoutes;
