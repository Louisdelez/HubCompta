// ============================================================================
// SEARCH API ROUTES - Finance Hub
// ============================================================================

import { FastifyPluginAsync } from 'fastify';
import { searchService, TransactionFilters } from '../../modules/search/index.js';
import { authGuard } from '../../core/auth/authGuard.js';
import { prisma } from '../../core/database/client.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface GlobalSearchQuery {
  q: string;
  types?: string;
  limit?: string;
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

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  // Global search across all entities
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
          types: { type: 'string' },
          limit: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { q, types, limit } = request.query;
    const user = request.user!;

    // Get user's default workspace
    const membership = await prisma.membership.findFirst({
      where: { userId: user.sub },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership) {
      return reply.status(400).send({ error: 'No workspace found' });
    }

    const results = await searchService.globalSearch({
      query: q,
      workspaceId: membership.workspaceId,
      types: types?.split(',') as any,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return {
      query: results.query,
      results: results.results,
      totalCount: results.total,
    };
  });

  // Workspace-scoped global search
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: GlobalSearchQuery;
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
        },
      },
    },
  }, async (request) => {
    const { workspaceId } = request.params;
    const { q, types, limit } = request.query;

    const results = await searchService.globalSearch({
      query: q,
      workspaceId,
      types: types?.split(',') as any,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return {
      query: results.query,
      results: results.results,
      totalCount: results.total,
    };
  });

  // Advanced transaction search
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
      types: query.types?.split(',') as any,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      amountMin: query.amountMin ? parseFloat(query.amountMin) : undefined,
      amountMax: query.amountMax ? parseFloat(query.amountMax) : undefined,
      status: query.status ? [query.status as any] : undefined,
      hasDocuments: query.hasDocuments === 'true' ? true : query.hasDocuments === 'false' ? false : undefined,
      isRecurring: query.isRecurring === 'true' ? true : query.isRecurring === 'false' ? false : undefined,
      page: query.page ? parseInt(query.page, 10) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : undefined,
      sortBy: query.sortBy as any,
      sortOrder: query.sortOrder as any,
    };

    const results = await searchService.searchTransactionsAdvanced(filters);

    // Transform to expected frontend format
    return {
      transactions: results.data,
      total: results.meta.total,
      page: results.meta.page,
      pageSize: results.meta.pageSize,
      totals: {
        income: results.totals.income,
        expense: results.totals.expense,
        net: results.totals.income - results.totals.expense,
        count: results.totals.count,
      },
    };
  });

  // Get saved filters
  fastify.get<{
    Params: { workspaceId: string };
  }>('/workspaces/:workspaceId/filters', {
    preHandler: [authGuard],
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

  // Save a filter
  fastify.post<{
    Params: { workspaceId: string };
    Body: SaveFilterBody;
  }>('/workspaces/:workspaceId/filters', {
    preHandler: [authGuard],
    schema: {
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

  // Update a saved filter
  fastify.patch<{
    Params: { workspaceId: string; filterId: string };
    Body: Partial<SaveFilterBody>;
  }>('/workspaces/:workspaceId/filters/:filterId', {
    preHandler: [authGuard],
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

  // Delete a saved filter
  fastify.delete<{
    Params: { workspaceId: string; filterId: string };
  }>('/workspaces/:workspaceId/filters/:filterId', {
    preHandler: [authGuard],
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
