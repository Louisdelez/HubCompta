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
import { requestLogger, logger } from './core/middleware/logger.js';
import { registerRoutes } from './api/routes/index.js';
import { initStorage } from './core/storage/s3.js';
import { prisma } from './core/database/client.js';
import { redisClient } from './core/database/redis.js';
import { setupScheduledJobs, closeQueues } from './core/queue/index.js';
import { initializeWorkers, shutdownWorkers } from './core/queue/workers.js';
import { initSentry } from './core/monitoring/sentry.js';
import { registerWebSocket } from './core/websocket/index.js';

// ----------------------------------------------------------------------------
// Initialize Sentry (must be early in startup)
// ----------------------------------------------------------------------------
initSentry();

// ----------------------------------------------------------------------------
// CORS Configuration Helper
// ----------------------------------------------------------------------------

function getCorsOrigins(): string[] {
  const origins: string[] = [];

  // Add APP_URL if set
  if (process.env.APP_URL) {
    origins.push(process.env.APP_URL);
  }

  // Add CORS_ORIGINS (comma-separated list)
  if (process.env.CORS_ORIGINS) {
    const additional = process.env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    origins.push(...additional);
  }

  // In development, add default localhost origins if none configured
  if (process.env.NODE_ENV !== 'production' && origins.length === 0) {
    origins.push(
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000'
    );
  }

  return origins;
}

// ----------------------------------------------------------------------------
// Application Factory
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// Body Size Limits Configuration
// ----------------------------------------------------------------------------

const BODY_LIMIT_DEFAULT = 1024 * 1024; // 1MB default
const BODY_LIMIT_UPLOAD = 10 * 1024 * 1024; // 10MB for file uploads

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
    bodyLimit: BODY_LIMIT_DEFAULT,
  });

  // Export body limits for use in route handlers that need higher limits
  app.decorate('bodyLimits', {
    default: BODY_LIMIT_DEFAULT,
    upload: BODY_LIMIT_UPLOAD,
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

  // CORS - Get origins from environment variables
  const corsOrigins = getCorsOrigins();
  await app.register(fastifyCors, {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id', 'X-Device-Fingerprint', 'X-Request-Id'],
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
  // WebSocket Support
  // ----------------------------------------------------------------------------
  await registerWebSocket(app);

  // ----------------------------------------------------------------------------
  // Register Routes
  // ----------------------------------------------------------------------------
  await registerRoutes(app);

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

    // Initialize queue workers
    initializeWorkers();

    // Build application
    const app = await buildApp();

    // Get port from environment
    const port = parseInt(process.env.APP_PORT ?? '3001', 10);
    const host = process.env.HOST ?? '0.0.0.0';

    // Start listening
    await app.listen({ port, host });

    logger.info({ host, port }, `Server running at http://${host}:${port}`);
    logger.info({ host, port }, `API docs available at http://${host}:${port}/docs`);
  } catch (error) {
    console.error('Failed to start server:', error);
    logger.error({ error, message: (error as Error).message, stack: (error as Error).stack }, 'Failed to start server');
    process.exit(1);
  }
}

// ----------------------------------------------------------------------------
// Graceful Shutdown
// ----------------------------------------------------------------------------

async function shutdown(): Promise<void> {
  logger.info('Shutting down gracefully...');

  try {
    await shutdownWorkers();
    await closeQueues();
    await prisma.$disconnect();
    await redisClient.quit();
    logger.info('Cleanup complete');
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
  }

  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
