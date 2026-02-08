// ============================================================================
// CATEGORY SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError, ConflictError } from '@/core/middleware/errorHandler.js';
import type { Category, CategoryType } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface CategoryCreateInput {
  name: string;
  type: CategoryType;
  icon?: string;
  color?: string;
  parentId?: string;
}

export interface CategoryUpdateInput {
  name?: string;
  icon?: string;
  color?: string;
  parentId?: string | null;
}

export interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
  transactionCount?: number;
}

// ----------------------------------------------------------------------------
// Category Service
// ----------------------------------------------------------------------------

export const categoryService = {
  /**
   * Create a new category
   */
  async create(workspaceId: string, input: CategoryCreateInput): Promise<Category> {
    // Check for duplicate category name in workspace
    const existing = await prisma.category.findFirst({
      where: {
        workspaceId,
        name: input.name,
        type: input.type,
      },
    });

    if (existing) {
      throw new ConflictError('category', 'name', input.name);
    }

    // Verify parent category if provided
    if (input.parentId) {
      const parent = await prisma.category.findFirst({
        where: {
          id: input.parentId,
          workspaceId,
        },
      });

      if (!parent) {
        throw new NotFoundError('Parent category', input.parentId);
      }

      // Parent must be same type
      if (parent.type !== input.type) {
        throw new ConflictError('category', 'type', 'Parent category must be same type');
      }
    }

    return prisma.category.create({
      data: {
        workspaceId,
        name: input.name,
        type: input.type,
        icon: input.icon,
        color: input.color,
        parentId: input.parentId,
      },
    });
  },

  /**
   * Get category by ID
   */
  async getById(workspaceId: string, categoryId: string): Promise<Category | null> {
    return prisma.category.findFirst({
      where: {
        id: categoryId,
        workspaceId,
      },
    });
  },

  /**
   * List categories with hierarchy
   */
  async list(workspaceId: string, type?: CategoryType): Promise<CategoryWithChildren[]> {
    const where: { workspaceId: string; type?: CategoryType } = { workspaceId };
    if (type) where.type = type;

    const categories = await prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    // Get transaction counts
    const transactionCounts = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        workspaceId,
        deletedAt: null,
        categoryId: { not: null },
      },
      _count: true,
    });

    const countMap = new Map(
      transactionCounts.map((tc) => [tc.categoryId, tc._count])
    );

    // Build hierarchy
    const buildTree = (parentId: string | null): CategoryWithChildren[] => {
      return categories
        .filter((c) => c.parentId === parentId)
        .map((c) => ({
          ...c,
          children: buildTree(c.id),
          transactionCount: countMap.get(c.id) ?? 0,
        }));
    };

    return buildTree(null);
  },

  /**
   * List flat categories (no hierarchy)
   */
  async listFlat(
    workspaceId: string,
    type?: CategoryType
  ): Promise<(Category & { transactionCount: number })[]> {
    const where: { workspaceId: string; type?: CategoryType } = { workspaceId };
    if (type) where.type = type;

    const categories = await prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    // Get transaction counts
    const transactionCounts = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        workspaceId,
        deletedAt: null,
        categoryId: { not: null },
      },
      _count: true,
    });

    const countMap = new Map(
      transactionCounts.map((tc) => [tc.categoryId, tc._count])
    );

    return categories.map((c) => ({
      ...c,
      transactionCount: countMap.get(c.id) ?? 0,
    }));
  },

  /**
   * Update category
   */
  async update(
    workspaceId: string,
    categoryId: string,
    input: CategoryUpdateInput
  ): Promise<Category> {
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        workspaceId,
      },
    });

    if (!category) {
      throw new NotFoundError('Category', categoryId);
    }

    // Check name uniqueness if changing name
    if (input.name && input.name !== category.name) {
      const existing = await prisma.category.findFirst({
        where: {
          workspaceId,
          name: input.name,
          type: category.type,
          id: { not: categoryId },
        },
      });

      if (existing) {
        throw new ConflictError('category', 'name', input.name);
      }
    }

    // Verify parent category if changing
    if (input.parentId) {
      // Cannot be its own parent
      if (input.parentId === categoryId) {
        throw new ConflictError('category', 'parentId', 'Cannot be its own parent');
      }

      const parent = await prisma.category.findFirst({
        where: {
          id: input.parentId,
          workspaceId,
        },
      });

      if (!parent) {
        throw new NotFoundError('Parent category', input.parentId);
      }

      // Cannot create circular references
      const descendants = await this.getDescendants(categoryId);
      if (descendants.includes(input.parentId)) {
        throw new ConflictError('category', 'parentId', 'Circular reference detected');
      }
    }

    return prisma.category.update({
      where: { id: categoryId },
      data: input,
    });
  },

  /**
   * Delete category
   */
  async delete(workspaceId: string, categoryId: string): Promise<void> {
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        workspaceId,
      },
      include: {
        _count: { select: { transactions: true, children: true } },
      },
    });

    if (!category) {
      throw new NotFoundError('Category', categoryId);
    }

    // Cannot delete if has children
    if (category._count.children > 0) {
      throw new ConflictError('category', 'children', 'Category has subcategories');
    }

    // If has transactions, just unset the category
    if (category._count.transactions > 0) {
      await prisma.$transaction([
        prisma.transaction.updateMany({
          where: { categoryId },
          data: { categoryId: null },
        }),
        prisma.category.delete({
          where: { id: categoryId },
        }),
      ]);
      return;
    }

    await prisma.category.delete({
      where: { id: categoryId },
    });
  },

  /**
   * Get all descendant category IDs
   */
  async getDescendants(categoryId: string): Promise<string[]> {
    const children = await prisma.category.findMany({
      where: { parentId: categoryId },
      select: { id: true },
    });

    const descendants: string[] = [];

    for (const child of children) {
      descendants.push(child.id);
      const childDescendants = await this.getDescendants(child.id);
      descendants.push(...childDescendants);
    }

    return descendants;
  },

  /**
   * Merge category into another
   */
  async merge(
    workspaceId: string,
    sourceCategoryId: string,
    targetCategoryId: string
  ): Promise<void> {
    const [source, target] = await Promise.all([
      prisma.category.findFirst({
        where: { id: sourceCategoryId, workspaceId },
      }),
      prisma.category.findFirst({
        where: { id: targetCategoryId, workspaceId },
      }),
    ]);

    if (!source) throw new NotFoundError('Source category', sourceCategoryId);
    if (!target) throw new NotFoundError('Target category', targetCategoryId);

    if (source.type !== target.type) {
      throw new ConflictError('category', 'type', 'Categories must be same type');
    }

    await prisma.$transaction([
      // Move all transactions to target
      prisma.transaction.updateMany({
        where: { categoryId: sourceCategoryId },
        data: { categoryId: targetCategoryId },
      }),
      // Move all children to target
      prisma.category.updateMany({
        where: { parentId: sourceCategoryId },
        data: { parentId: targetCategoryId },
      }),
      // Move all rules to target
      prisma.rule.updateMany({
        where: { categoryId: sourceCategoryId },
        data: { categoryId: targetCategoryId },
      }),
      // Delete source
      prisma.category.delete({
        where: { id: sourceCategoryId },
      }),
    ]);
  },
};

export default categoryService;
