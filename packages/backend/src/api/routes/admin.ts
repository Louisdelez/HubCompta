// ============================================================================
// ADMIN API ROUTES - Finance Hub
// Instance administration endpoints
// ============================================================================

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../core/database/client.js';
import { redisClient } from '../../core/database/redis.js';
import { storageClient } from '../../core/storage/s3.js';
import { getBackupQueue } from '../../core/queue/index.js';
import { authGuard } from '../../core/auth/authGuard.js';
import { logger } from '../../core/middleware/logger.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface BackupRequest {
  type?: 'full' | 'incremental' | 'workspace';
  workspaceId?: string;
  retention?: number;
}

interface RestorePreviewRequest {
  backupPath: string;
}

// ----------------------------------------------------------------------------
// Admin Guard Middleware
// ----------------------------------------------------------------------------

async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Check if user is authenticated
  if (!request.user?.sub) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  // Check if user is instance admin
  const user = await prisma.user.findUnique({
    where: { id: request.user?.sub },
    select: { isInstanceAdmin: true },
  });

  if (!user?.isInstanceAdmin) {
    return reply.status(403).send({ error: 'Admin access required' });
  }
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply authentication and admin check to all routes
  fastify.addHook('preHandler', authGuard);
  fastify.addHook('preHandler', requireAdmin);

  // --------------------------------------------------------------------------
  // Backup Endpoints
  // --------------------------------------------------------------------------

  /**
   * POST /admin/backup - Trigger a backup
   */
  fastify.post<{ Body: BackupRequest }>('/backup', async (request, reply) => {
    const { type = 'full', workspaceId, retention = 30 } = request.body ?? {};

    // Validate workspace exists if specified
    if (workspaceId) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });

      if (!workspace) {
        return reply.status(404).send({ error: 'Workspace not found' });
      }
    }

    // Add backup job to queue
    const backupQueue = getBackupQueue();
    const job = await backupQueue.add('backup', {
      type,
      workspaceId,
      retention,
      triggeredBy: request.user?.sub,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });

    return {
      success: true,
      data: {
        message: 'Backup job queued',
        jobId: job.id,
        type,
        workspaceId,
      },
    };
  });

  /**
   * GET /admin/backup/status/:jobId - Get backup job status
   */
  fastify.get<{ Params: { jobId: string } }>('/backup/status/:jobId', async (request, reply) => {
    const { jobId } = request.params;

    const backupQueue = getBackupQueue();
    const job = await backupQueue.getJob(jobId);

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    const state = await job.getState();
    const progress = job.progress;

    return {
      success: true,
      data: {
        id: job.id,
        state,
        progress,
        jobData: job.data,
        result: job.returnvalue,
        failedReason: job.failedReason,
        createdAt: new Date(job.timestamp).toISOString(),
        processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      },
    };
  });

  /**
   * GET /admin/backup/list - List available backups
   */
  fastify.get<{
    Querystring: { limit?: string; prefix?: string };
  }>('/backup/list', async (request, reply) => {
    const limit = parseInt(request.query.limit ?? '50', 10);
    const prefix = request.query.prefix ?? '';

    const BACKUP_BUCKET = process.env.BACKUP_BUCKET ?? 'hubcompta-backups';

    try {
      // Check if bucket exists
      const bucketExists = await storageClient.bucketExists(BACKUP_BUCKET);
      if (!bucketExists) {
        return { success: true, data: { backups: [], total: 0 } };
      }

      const backups: Array<{
        path: string;
        size: number;
        lastModified: Date;
        type: string;
      }> = [];

      const objectsStream = storageClient.listObjects(BACKUP_BUCKET, prefix, true);

      for await (const obj of objectsStream) {
        // Only include .json.gz files (not .meta.json)
        if (obj.name.endsWith('.json.gz')) {
          backups.push({
            path: obj.name,
            size: obj.size,
            lastModified: obj.lastModified,
            type: obj.name.includes('/workspaces/') ? 'workspace' : 'full',
          });

          if (backups.length >= limit) break;
        }
      }

      // Sort by date descending
      backups.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

      return {
        success: true,
        data: {
          backups,
          total: backups.length,
        },
      };
    } catch (error) {
      logger.error({ error }, 'Error listing backups');
      return reply.status(500).send({ error: 'Failed to list backups' });
    }
  });

  /**
   * POST /admin/backup/restore/preview - Preview restore from backup
   */
  fastify.post<{ Body: RestorePreviewRequest }>('/backup/restore/preview', async (request, reply) => {
    const { backupPath } = request.body;

    const BACKUP_BUCKET = process.env.BACKUP_BUCKET ?? 'hubcompta-backups';

    try {
      // Get metadata file
      const metadataPath = backupPath.replace('.json.gz', '.meta.json');
      const metadataStream = await storageClient.getObject(BACKUP_BUCKET, metadataPath);

      const chunks: Buffer[] = [];
      for await (const chunk of metadataStream) {
        chunks.push(chunk);
      }

      const metadata = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

      return {
        success: true,
        data: {
          valid: true,
          metadata,
          warning: 'Restore will overwrite existing data. This action cannot be undone.',
        },
      };
    } catch (error) {
      logger.error({ error }, 'Error previewing backup');
      return reply.status(400).send({
        error: 'Failed to read backup metadata',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // --------------------------------------------------------------------------
  // System Stats
  // --------------------------------------------------------------------------

  /**
   * GET /admin/stats - Get system statistics
   */
  fastify.get('/stats', async () => {
    const [
      userCount,
      workspaceCount,
      transactionCount,
      documentCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.workspace.count(),
      prisma.transaction.count(),
      prisma.document.count(),
    ]);

    // Get Redis info
    const redisInfo = await redisClient.info('memory');
    const memoryMatch = redisInfo.match(/used_memory_human:(\S+)/);

    return {
      success: true,
      data: {
        database: {
          users: userCount,
          workspaces: workspaceCount,
          transactions: transactionCount,
          documents: documentCount,
        },
        redis: {
          memoryUsed: memoryMatch ? memoryMatch[1] : 'unknown',
          connected: true,
        },
        system: {
          nodeVersion: process.version,
          uptime: process.uptime(),
          memory: {
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          },
        },
      },
    };
  });

  // --------------------------------------------------------------------------
  // User Management
  // --------------------------------------------------------------------------

  /**
   * GET /admin/users - List all users
   */
  fastify.get<{
    Querystring: { page?: string; limit?: string; search?: string };
  }>('/users', async (request) => {
    const page = parseInt(request.query.page ?? '1', 10);
    const limit = Math.min(parseInt(request.query.limit ?? '50', 10), 100);
    const search = request.query.search;
    const skip = (page - 1) * limit;

    const where = search ? {
      OR: [
        { email: { contains: search, mode: 'insensitive' as const } },
        { displayName: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          displayName: true,
          isInstanceAdmin: true,
          createdAt: true,
          _count: {
            select: {
              memberships: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  });

  /**
   * PATCH /admin/users/:userId - Update user admin status
   */
  fastify.patch<{
    Params: { userId: string };
    Body: { isInstanceAdmin?: boolean };
  }>('/users/:userId', async (request, reply) => {
    const { userId } = request.params;
    const { isInstanceAdmin } = request.body;

    // Prevent self-demotion
    if (userId === request.user?.sub && isInstanceAdmin === false) {
      return reply.status(400).send({ error: 'Cannot remove admin from yourself' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isInstanceAdmin },
      select: {
        id: true,
        email: true,
        displayName: true,
        isInstanceAdmin: true,
      },
    });

    // Log action
    await prisma.auditLog.create({
      data: {
        userId: request.user?.sub,
        action: isInstanceAdmin ? 'admin.grant' : 'admin.revoke',
        entityType: 'user',
        entityId: userId,
        changes: { targetEmail: user.email },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? '',
      },
    });

    return { success: true, data: user };
  });

  // --------------------------------------------------------------------------
  // Audit Logs
  // --------------------------------------------------------------------------

  /**
   * GET /admin/audit-logs - Get audit logs
   */
  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      action?: string;
      userId?: string;
      entity?: string;
    };
  }>('/audit-logs', async (request) => {
    const page = parseInt(request.query.page ?? '1', 10);
    const limit = Math.min(parseInt(request.query.limit ?? '100', 10), 500);
    const skip = (page - 1) * limit;

    const where: {
      action?: { contains: string };
      userId?: string;
      entity?: string;
    } = {};

    if (request.query.action) {
      where.action = { contains: request.query.action };
    }
    if (request.query.userId) {
      where.userId = request.query.userId;
    }
    if (request.query.entity) {
      where.entity = request.query.entity;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  });

  // --------------------------------------------------------------------------
  // Cache Management
  // --------------------------------------------------------------------------

  /**
   * POST /admin/cache/clear - Clear Redis cache
   */
  fastify.post<{ Body: { pattern?: string } }>('/cache/clear', async (request, reply) => {
    const { pattern } = request.body ?? {};

    try {
      if (pattern) {
        // Clear keys matching pattern
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
        return { success: true, data: { cleared: keys.length, pattern } };
      } else {
        // Clear all cache keys (not session data)
        const cacheKeys = await redisClient.keys('cache:*');
        const rateLimitKeys = await redisClient.keys('ratelimit:*');
        const allKeys = [...cacheKeys, ...rateLimitKeys];

        if (allKeys.length > 0) {
          await redisClient.del(...allKeys);
        }

        return { success: true, data: { cleared: allKeys.length } };
      }
    } catch (error) {
      logger.error({ error }, 'Error clearing cache');
      return reply.status(500).send({ error: 'Failed to clear cache' });
    }
  });
};

export default adminRoutes;
