// ============================================================================
// SECURITY HEADERS MIDDLEWARE - Finance Hub
// HTTP Security Headers using Helmet-like configuration
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

interface SecurityHeadersConfig {
  // Content Security Policy
  contentSecurityPolicy: {
    enabled: boolean;
    directives: Record<string, string[]>;
  };
  // HTTP Strict Transport Security
  hsts: {
    enabled: boolean;
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  // X-Frame-Options
  frameguard: {
    enabled: boolean;
    action: 'DENY' | 'SAMEORIGIN';
  };
  // X-Content-Type-Options
  noSniff: boolean;
  // X-XSS-Protection (deprecated but still useful for older browsers)
  xssFilter: boolean;
  // Referrer-Policy
  referrerPolicy: {
    enabled: boolean;
    policy: string;
  };
  // Permissions-Policy (formerly Feature-Policy)
  permissionsPolicy: {
    enabled: boolean;
    features: Record<string, string[]>;
  };
  // Cross-Origin policies
  crossOrigin: {
    embedderPolicy: boolean;
    openerPolicy: string;
    resourcePolicy: string;
  };
  // X-Download-Options
  ieNoOpen: boolean;
  // X-DNS-Prefetch-Control
  dnsPrefetchControl: boolean;
  // X-Permitted-Cross-Domain-Policies
  crossDomainPolicy: string;
}

const DEFAULT_CONFIG: SecurityHeadersConfig = {
  contentSecurityPolicy: {
    enabled: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Needed for Vite HMR in dev
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': ["'self'", 'wss:', 'https:'],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-ancestors': ["'self'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'upgrade-insecure-requests': [],
    },
  },
  hsts: {
    enabled: true,
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    enabled: true,
    action: 'DENY',
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: {
    enabled: true,
    policy: 'strict-origin-when-cross-origin',
  },
  permissionsPolicy: {
    enabled: true,
    features: {
      accelerometer: [],
      camera: [],
      geolocation: [],
      gyroscope: [],
      magnetometer: [],
      microphone: [],
      payment: [],
      usb: [],
    },
  },
  crossOrigin: {
    embedderPolicy: false, // Disable for now, can break external resources
    openerPolicy: 'same-origin',
    resourcePolicy: 'same-origin',
  },
  ieNoOpen: true,
  dnsPrefetchControl: false,
  crossDomainPolicy: 'none',
};

// ----------------------------------------------------------------------------
// Header Builders
// ----------------------------------------------------------------------------

function buildCSPHeader(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) {
        return key;
      }
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
}

function buildHSTSHeader(config: SecurityHeadersConfig['hsts']): string {
  let header = `max-age=${config.maxAge}`;
  if (config.includeSubDomains) {
    header += '; includeSubDomains';
  }
  if (config.preload) {
    header += '; preload';
  }
  return header;
}

function buildPermissionsPolicyHeader(features: Record<string, string[]>): string {
  return Object.entries(features)
    .map(([feature, allowlist]) => {
      if (allowlist.length === 0) {
        return `${feature}=()`;
      }
      return `${feature}=(${allowlist.join(' ')})`;
    })
    .join(', ');
}

// ----------------------------------------------------------------------------
// Middleware
// ----------------------------------------------------------------------------

function createSecurityHeadersMiddleware(config: SecurityHeadersConfig) {
  return function securityHeaders(
    _request: FastifyRequest,
    reply: FastifyReply
  ): void {
    // Content-Security-Policy
    if (config.contentSecurityPolicy.enabled) {
      const cspHeader = buildCSPHeader(config.contentSecurityPolicy.directives);
      reply.header('Content-Security-Policy', cspHeader);
    }

    // Strict-Transport-Security (HSTS)
    // Only set in production with HTTPS
    if (config.hsts.enabled && process.env.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', buildHSTSHeader(config.hsts));
    }

    // X-Frame-Options
    if (config.frameguard.enabled) {
      reply.header('X-Frame-Options', config.frameguard.action);
    }

    // X-Content-Type-Options
    if (config.noSniff) {
      reply.header('X-Content-Type-Options', 'nosniff');
    }

    // X-XSS-Protection
    if (config.xssFilter) {
      reply.header('X-XSS-Protection', '1; mode=block');
    }

    // Referrer-Policy
    if (config.referrerPolicy.enabled) {
      reply.header('Referrer-Policy', config.referrerPolicy.policy);
    }

    // Permissions-Policy
    if (config.permissionsPolicy.enabled) {
      const ppHeader = buildPermissionsPolicyHeader(config.permissionsPolicy.features);
      reply.header('Permissions-Policy', ppHeader);
    }

    // Cross-Origin-Embedder-Policy
    if (config.crossOrigin.embedderPolicy) {
      reply.header('Cross-Origin-Embedder-Policy', 'require-corp');
    }

    // Cross-Origin-Opener-Policy
    if (config.crossOrigin.openerPolicy) {
      reply.header('Cross-Origin-Opener-Policy', config.crossOrigin.openerPolicy);
    }

    // Cross-Origin-Resource-Policy
    if (config.crossOrigin.resourcePolicy) {
      reply.header('Cross-Origin-Resource-Policy', config.crossOrigin.resourcePolicy);
    }

    // X-Download-Options
    if (config.ieNoOpen) {
      reply.header('X-Download-Options', 'noopen');
    }

    // X-DNS-Prefetch-Control
    reply.header('X-DNS-Prefetch-Control', config.dnsPrefetchControl ? 'on' : 'off');

    // X-Permitted-Cross-Domain-Policies
    if (config.crossDomainPolicy) {
      reply.header('X-Permitted-Cross-Domain-Policies', config.crossDomainPolicy);
    }
  };
}

// ----------------------------------------------------------------------------
// Plugin Registration
// ----------------------------------------------------------------------------

export function registerSecurityHeaders(
  app: FastifyInstance,
  customConfig?: Partial<SecurityHeadersConfig>
): void {
  const config = mergeConfig(DEFAULT_CONFIG, customConfig);
  const middleware = createSecurityHeadersMiddleware(config);

  app.addHook('onSend', middleware);
}

// Deep merge configuration
function mergeConfig(
  defaults: SecurityHeadersConfig,
  custom?: Partial<SecurityHeadersConfig>
): SecurityHeadersConfig {
  if (!custom) return defaults;

  return {
    contentSecurityPolicy: {
      ...defaults.contentSecurityPolicy,
      ...custom.contentSecurityPolicy,
      directives: {
        ...defaults.contentSecurityPolicy.directives,
        ...custom.contentSecurityPolicy?.directives,
      },
    },
    hsts: { ...defaults.hsts, ...custom.hsts },
    frameguard: { ...defaults.frameguard, ...custom.frameguard },
    noSniff: custom.noSniff ?? defaults.noSniff,
    xssFilter: custom.xssFilter ?? defaults.xssFilter,
    referrerPolicy: { ...defaults.referrerPolicy, ...custom.referrerPolicy },
    permissionsPolicy: {
      ...defaults.permissionsPolicy,
      ...custom.permissionsPolicy,
      features: {
        ...defaults.permissionsPolicy.features,
        ...custom.permissionsPolicy?.features,
      },
    },
    crossOrigin: { ...defaults.crossOrigin, ...custom.crossOrigin },
    ieNoOpen: custom.ieNoOpen ?? defaults.ieNoOpen,
    dnsPrefetchControl: custom.dnsPrefetchControl ?? defaults.dnsPrefetchControl,
    crossDomainPolicy: custom.crossDomainPolicy ?? defaults.crossDomainPolicy,
  };
}

// ----------------------------------------------------------------------------
// Development-friendly Configuration
// ----------------------------------------------------------------------------

export function getDevConfig(): Partial<SecurityHeadersConfig> {
  return {
    contentSecurityPolicy: {
      enabled: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Vite HMR
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:', 'https:', 'http:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'", 'ws:', 'wss:', 'http:', 'https:'], // Dev server websocket
        'media-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'self'"],
      },
    },
    hsts: {
      enabled: false, // Disable in dev
      maxAge: 0,
      includeSubDomains: false,
      preload: false,
    },
  };
}

// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

export { DEFAULT_CONFIG as SECURITY_HEADERS_CONFIG };
export type { SecurityHeadersConfig };
export default registerSecurityHeaders;
