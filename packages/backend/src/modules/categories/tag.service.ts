// ============================================================================
// TAG SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError, ConflictError } from '@/core/middleware/errorHandler.js';
import type { Tag } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface TagCreateInput {
  name: string;
  color?: string;
}

export interface TagUpdateInput {
  name?: string;
  color?: string | null;
}

export interface TagWithUsage extends Tag {
  usageCount: number;
}

// ----------------------------------------------------------------------------
// Tag Service
// ----------------------------------------------------------------------------

export const tagService = {
  /**
   * Create a new tag
   */
  async create(workspaceId: string, input: TagCreateInput): Promise<Tag> {
    // Check for duplicate tag name in workspace
    const existing = await prisma.tag.findFirst({
      where: {
        workspaceId,
        name: { equals: input.name, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictError('tag', 'name', input.name);
    }

    return prisma.tag.create({
      data: {
        workspaceId,
        name: input.name,
        color: input.color,
      },
    });
  },

  /**
   * Get tag by ID
   */
  getById(workspaceId: string, tagId: string): Promise<Tag | null> {
    return prisma.tag.findFirst({
      where: {
        id: tagId,
        workspaceId,
      },
    });
  },

  /**
   * Find or create tag by name
   */
  async findOrCreate(workspaceId: string, name: string, color?: string): Promise<Tag> {
    const existing = await prisma.tag.findFirst({
      where: {
        workspaceId,
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (existing) return existing;

    return prisma.tag.create({
      data: {
        workspaceId,
        name,
        color,
      },
    });
  },

  /**
   * List tags with usage counts
   */
  async list(workspaceId: string): Promise<TagWithUsage[]> {
    const tags = await prisma.tag.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });

    // Get usage counts
    const usageCounts = await prisma.transactionTag.groupBy({
      by: ['tagId'],
      where: {
        tag: { workspaceId },
        transaction: { deletedAt: null },
      },
      _count: true,
    });

    const countMap = new Map(
      usageCounts.map((uc) => [uc.tagId, uc._count])
    );

    return tags.map((t) => ({
      ...t,
      usageCount: countMap.get(t.id) ?? 0,
    }));
  },

  /**
   * Search tags by name
   */
  search(workspaceId: string, query: string, limit = 10): Promise<Tag[]> {
    return prisma.tag.findMany({
      where: {
        workspaceId,
        name: { contains: query, mode: 'insensitive' },
      },
      orderBy: { name: 'asc' },
      take: limit,
    });
  },

  /**
   * Get popular tags (most used)
   */
  async getPopular(workspaceId: string, limit = 10): Promise<TagWithUsage[]> {
    // Get tags with usage counts
    const tagUsage = await prisma.transactionTag.groupBy({
      by: ['tagId'],
      where: {
        tag: { workspaceId },
        transaction: { deletedAt: null },
      },
      _count: true,
      orderBy: {
        _count: { tagId: 'desc' },
      },
      take: limit,
    });

    const tagIds = tagUsage.map((tu) => tu.tagId);

    const tags = await prisma.tag.findMany({
      where: { id: { in: tagIds } },
    });

    const countMap = new Map(
      tagUsage.map((tu) => [tu.tagId, tu._count])
    );

    // Maintain order by usage
    return tagIds
      .map((id) => {
        const tag = tags.find((t) => t.id === id);
        if (!tag) return null;
        return {
          ...tag,
          usageCount: countMap.get(id) ?? 0,
        };
      })
      .filter((t): t is TagWithUsage => t !== null);
  },

  /**
   * Update tag
   */
  async update(
    workspaceId: string,
    tagId: string,
    input: TagUpdateInput
  ): Promise<Tag> {
    const tag = await prisma.tag.findFirst({
      where: {
        id: tagId,
        workspaceId,
      },
    });

    if (!tag) {
      throw new NotFoundError('Tag', tagId);
    }

    // Check name uniqueness if changing name
    if (input.name && input.name.toLowerCase() !== tag.name.toLowerCase()) {
      const existing = await prisma.tag.findFirst({
        where: {
          workspaceId,
          name: { equals: input.name, mode: 'insensitive' },
          id: { not: tagId },
        },
      });

      if (existing) {
        throw new ConflictError('tag', 'name', input.name);
      }
    }

    return prisma.tag.update({
      where: { id: tagId },
      data: input,
    });
  },

  /**
   * Delete tag
   */
  async delete(workspaceId: string, tagId: string): Promise<void> {
    const tag = await prisma.tag.findFirst({
      where: {
        id: tagId,
        workspaceId,
      },
    });

    if (!tag) {
      throw new NotFoundError('Tag', tagId);
    }

    // Delete tag and all associations
    await prisma.$transaction([
      prisma.transactionTag.deleteMany({
        where: { tagId },
      }),
      prisma.tag.delete({
        where: { id: tagId },
      }),
    ]);
  },

  /**
   * Merge tag into another
   */
  async merge(
    workspaceId: string,
    sourceTagId: string,
    targetTagId: string
  ): Promise<void> {
    const [source, target] = await Promise.all([
      prisma.tag.findFirst({
        where: { id: sourceTagId, workspaceId },
      }),
      prisma.tag.findFirst({
        where: { id: targetTagId, workspaceId },
      }),
    ]);

    if (!source) throw new NotFoundError('Source tag', sourceTagId);
    if (!target) throw new NotFoundError('Target tag', targetTagId);

    await prisma.$transaction(async (tx) => {
      // Get all transactions with source tag
      const sourceAssociations = await tx.transactionTag.findMany({
        where: { tagId: sourceTagId },
      });

      // Move associations to target (avoiding duplicates)
      for (const assoc of sourceAssociations) {
        // Check if target already has this transaction
        const exists = await tx.transactionTag.findUnique({
          where: {
            transactionId_tagId: {
              transactionId: assoc.transactionId,
              tagId: targetTagId,
            },
          },
        });

        if (!exists) {
          await tx.transactionTag.create({
            data: {
              transactionId: assoc.transactionId,
              tagId: targetTagId,
            },
          });
        }
      }

      // Delete source associations and tag
      await tx.transactionTag.deleteMany({
        where: { tagId: sourceTagId },
      });

      await tx.tag.delete({
        where: { id: sourceTagId },
      });
    });
  },
};

export default tagService;
