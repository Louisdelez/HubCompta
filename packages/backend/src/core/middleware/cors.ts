// ============================================================================
// CORS MIDDLEWARE - Finance Hub
// Cross-Origin Resource Sharing configuration
// ============================================================================

import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

interface CorsConfig {
  // Allowed origins (can be string, regex, or function)
  origins: string[];
  // Allowed HTTP methods
  methods: string[];
  // Allowed headers
  allowedHeaders: string[];
  // Headers exposed to the client
  exposedHeaders: string[];
  // Allow credentials (cookies, authorization headers)
  credentials: boolean;
  // Max age for preflight cache (in seconds)
  maxAge: number;
  // Enable preflight caching
  preflightContinue: boolean;
  // Success status for OPTIONS requests
  optionsSuccessStatus: number;
}

// Default configuration
const DEFAULT_CONFIG: CorsConfig = {
  origins: [
    'http://localhost:5173', // Vite dev server
    'http://localhost:3000', // Alternative dev port
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Workspace-Id',
    'X-Device-Fingerprint',
    'X-Request-Id',
    'X-Retry-After-Refresh',
    'Accept',
    'Origin',
    'Cache-Control',
    'Pragma',
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Request-Id',
    'Content-Disposition',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// Production origins (configured via environment)
function getProductionOrigins(): string[] {
  const origins: string[] = [];

  // Primary app URL
  if (process.env.APP_URL) {
    origins.push(process.env.APP_URL);
  }

  // Additional allowed origins (comma-separated)
  if (process.env.CORS_ORIGINS) {
    const additional = process.env.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    origins.push(...additional);
  }

  return origins;
}

// Get all allowed origins based on environment
function getAllowedOrigins(): string[] {
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    const prodOrigins = getProductionOrigins();
    if (prodOrigins.length === 0) {
      console.warn(
        'WARNING: No CORS origins configured for production. Set APP_URL or CORS_ORIGINS.'
      );
    }
    return prodOrigins;
  }

  // In development, allow default origins plus any configured ones
  return [...DEFAULT_CONFIG.origins, ...getProductionOrigins()];
}

// ----------------------------------------------------------------------------
// Origin Validator
// ----------------------------------------------------------------------------

function createOriginValidator(allowedOrigins: string[]) {
  // Create regex patterns for wildcard origins
  const patterns = allowedOrigins.map((origin) => {
    if (origin.includes('*')) {
      // Convert wildcard to regex
      const escaped = origin
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      return new RegExp(`^${escaped}$`);
    }
    return origin;
  });

  return (origin: string | undefined): boolean => {
    // Allow requests with no origin (same-origin or non-browser)
    if (!origin) {
      return true;
    }

    // Check against patterns
    return patterns.some((pattern) => {
      if (typeof pattern === 'string') {
        return pattern === origin;
      }
      return pattern.test(origin);
    });
  };
}

// ----------------------------------------------------------------------------
// Plugin Registration
// ----------------------------------------------------------------------------

export async function registerCors(
  app: FastifyInstance,
  customConfig?: Partial<CorsConfig>
): Promise<void> {
  const config = { ...DEFAULT_CONFIG, ...customConfig };
  const allowedOrigins = getAllowedOrigins();
  const validateOrigin = createOriginValidator(allowedOrigins);

  await app.register(cors, {
    origin: (origin, callback) => {
      // Allow the request if origin is valid
      if (validateOrigin(origin)) {
        callback(null, true);
      } else {
        // Log blocked origins in development for debugging
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`CORS blocked origin: ${origin}`);
        }
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    methods: config.methods,
    allowedHeaders: config.allowedHeaders,
    exposedHeaders: config.exposedHeaders,
    credentials: config.credentials,
    maxAge: config.maxAge,
    preflightContinue: config.preflightContinue,
    optionsSuccessStatus: config.optionsSuccessStatus,
  });

  // Log configured origins
  if (process.env.NODE_ENV !== 'production') {
    console.log('CORS allowed origins:', allowedOrigins);
  }
}

// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

export { DEFAULT_CONFIG as CORS_CONFIG };
export default registerCors;
