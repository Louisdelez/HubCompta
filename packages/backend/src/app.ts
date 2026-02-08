// ============================================================================
// FASTIFY APPLICATION ENTRY - Finance Hub
// ============================================================================

import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

import { errorHandler } from './core/middleware/errorHandler.js';
import { requestLogger } from './core/middleware/logger.js';
import { registerRoutes } from './api/routes/index.js';
import { initStorage } from './core/storage/s3.js';
import { prisma } from './core/database/client.js';
import { redisClient } from './core/database/redis.js';
import { setupScheduledJobs, closeQueues } from './core/queue/index.js';

// ----------------------------------------------------------------------------
// Application Factory
// ----------------------------------------------------------------------------

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
    trustProxy: true,
  });

  // ----------------------------------------------------------------------------
  // Global Error Handler
  // ----------------------------------------------------------------------------
  app.setErrorHandler(errorHandler);

  // ----------------------------------------------------------------------------
  // Request Logging Hook
  // ----------------------------------------------------------------------------
  app.addHook('onRequest', requestLogger);

  // ----------------------------------------------------------------------------
  // Security Plugins
  // ----------------------------------------------------------------------------

  // CORS
  await app.register(fastifyCors, {
    origin: process.env.APP_URL ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id'],
  });

  // Security Headers
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
      },
    },
  });

  // Cookie support
  await app.register(fastifyCookie, {
    secret: process.env.JWT_SECRET,
    parseOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    },
  });

  // Rate limiting
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis: redisClient,
    keyGenerator: (request) => {
      // Use user ID if authenticated, otherwise IP
      return (request.user as { sub?: string })?.sub ?? request.ip;
    },
  });

  // ----------------------------------------------------------------------------
  // API Documentation
  // ----------------------------------------------------------------------------

  if (process.env.NODE_ENV !== 'production') {
    await app.register(fastifySwagger, {
      openapi: {
        info: {
          title: 'Finance Hub API',
          description: 'Self-hosted financial management platform API',
          version: '1.0.0',
        },
        servers: [
          {
            url: process.env.APP_URL ?? 'http://localhost:3001',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
    });

    await app.register(fastifySwaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
    });
  }

  // ----------------------------------------------------------------------------
  // Register Routes
  // ----------------------------------------------------------------------------
  await registerRoutes(app);

  // ----------------------------------------------------------------------------
  // Health Check (basic)
  // ----------------------------------------------------------------------------
  app.get('/health', async () => {
    return { status: 'ok', version: '1.0.0' };
  });

  return app;
}

// ----------------------------------------------------------------------------
// Start Server
// ----------------------------------------------------------------------------

export async function startServer(): Promise<void> {
  try {
    // Initialize storage
    await initStorage();

    // Setup scheduled jobs (BullMQ repeatable jobs)
    await setupScheduledJobs();

    // Build application
    const app = await buildApp();

    // Get port from environment
    const port = parseInt(process.env.APP_PORT ?? '3001', 10);
    const host = process.env.HOST ?? '0.0.0.0';

    // Start listening
    await app.listen({ port, host });

    console.info(`Server running at http://${host}:${port}`);
    console.info(`API docs available at http://${host}:${port}/docs`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// ----------------------------------------------------------------------------
// Graceful Shutdown
// ----------------------------------------------------------------------------

async function shutdown(): Promise<void> {
  console.info('Shutting down gracefully...');

  try {
    await closeQueues();
    await prisma.$disconnect();
    await redisClient.quit();
    console.info('Cleanup complete');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
