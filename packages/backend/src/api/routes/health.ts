// ============================================================================
// HEALTH CHECK ROUTES - Finance Hub
// Monitoring and health check endpoints
// ============================================================================

import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@/core/database/client.js';
import { redisClient } from '@/core/database/redis.js';
import { storageClient } from '@/core/storage/s3.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
    storage: ComponentHealth;
  };
}

interface ComponentHealth {
  status: 'up' | 'down';
  latency?: number;
  message?: string;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const APP_VERSION = process.env.npm_package_version || '1.0.0';
const startTime = Date.now();

// ----------------------------------------------------------------------------
// Health Check Functions
// ----------------------------------------------------------------------------

async function checkDatabase(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'up',
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

async function checkRedis(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    await redisClient.ping();
    return {
      status: 'up',
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Redis connection failed',
    };
  }
}

async function checkStorage(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const bucket = process.env.MINIO_BUCKET ?? 'documents';
    await storageClient.bucketExists(bucket);
    return {
      status: 'up',
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Storage connection failed',
    };
  }
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /health - Basic health check
   * Returns 200 if the server is running
   */
  fastify.get('/', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    });
  });

  /**
   * GET /health/live - Kubernetes liveness probe
   * Returns 200 if the process is alive
   */
  fastify.get('/live', async (_request, reply) => {
    return reply.send({ status: 'alive' });
  });

  /**
   * GET /health/ready - Kubernetes readiness probe
   * Returns 200 only if all dependencies are healthy
   */
  fastify.get('/ready', async (_request, reply) => {
    const [database, redis, storage] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkStorage(),
    ]);

    const allUp = database.status === 'up' && redis.status === 'up' && storage.status === 'up';

    if (!allUp) {
      return reply.status(503).send({
        status: 'not_ready',
        checks: { database, redis, storage },
      });
    }

    return reply.send({
      status: 'ready',
      checks: { database, redis, storage },
    });
  });

  /**
   * GET /health/full - Detailed health status
   * Returns full health information for monitoring dashboards
   */
  fastify.get('/full', async (_request, reply) => {
    const [database, redis, storage] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkStorage(),
    ]);

    const checks = { database, redis, storage };
    const allUp = Object.values(checks).every((c) => c.status === 'up');
    const anyDown = Object.values(checks).some((c) => c.status === 'down');

    let status: HealthStatus['status'] = 'healthy';
    if (anyDown) {
      status = 'unhealthy';
    } else if (!allUp) {
      status = 'degraded';
    }

    const response: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      checks,
    };

    const statusCode = status === 'unhealthy' ? 503 : 200;
    return reply.status(statusCode).send(response);
  });

  /**
   * GET /health/db - Database-specific health check
   */
  fastify.get('/db', async (_request, reply) => {
    const health = await checkDatabase();
    const statusCode = health.status === 'up' ? 200 : 503;
    return reply.status(statusCode).send(health);
  });

  /**
   * GET /health/redis - Redis-specific health check
   */
  fastify.get('/redis', async (_request, reply) => {
    const health = await checkRedis();
    const statusCode = health.status === 'up' ? 200 : 503;
    return reply.status(statusCode).send(health);
  });

  /**
   * GET /health/storage - Storage-specific health check
   */
  fastify.get('/storage', async (_request, reply) => {
    const health = await checkStorage();
    const statusCode = health.status === 'up' ? 200 : 503;
    return reply.status(statusCode).send(health);
  });

  /**
   * GET /health/metrics - Basic metrics for monitoring
   */
  fastify.get('/metrics', async (_request, reply) => {
    const memoryUsage = process.memoryUsage();

    return reply.send({
      timestamp: new Date().toISOString(),
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
        },
        cpu: process.cpuUsage(),
      },
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    });
  });
};

export { healthRoutes };
export default healthRoutes;
