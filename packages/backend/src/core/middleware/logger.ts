// ============================================================================
// REQUEST LOGGING MIDDLEWARE - Finance Hub
// ============================================================================

import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Request logging hook
 * Logs incoming requests with relevant metadata
 */
export function requestLogger(
  request: FastifyRequest,
  _reply: FastifyReply
): void {
  // Skip logging for health checks and static assets
  if (
    request.url === '/health' ||
    request.url.startsWith('/docs') ||
    request.url.startsWith('/static')
  ) {
    return;
  }

  // Extract user ID if authenticated
  const userId = (request.user as { sub?: string })?.sub;

  // Extract workspace ID from header
  const workspaceId = request.headers['x-workspace-id'] as string | undefined;

  request.log.info({
    msg: 'incoming request',
    method: request.method,
    url: request.url,
    userId,
    workspaceId,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
  });
}

/**
 * Response logging hook factory
 * Returns a hook that logs response details
 */
export function createResponseLogger() {
  return function responseLogger(
    request: FastifyRequest,
    reply: FastifyReply
  ): void {
    // Skip logging for health checks
    if (request.url === '/health') {
      return;
    }

    const responseTime = reply.elapsedTime;

    request.log.info({
      msg: 'request completed',
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: `${responseTime.toFixed(2)}ms`,
    });
  };
}

// ----------------------------------------------------------------------------
// Request ID Generation
// ----------------------------------------------------------------------------

/**
 * Generate a unique request ID
 * Uses UUID v7 format for time-ordered IDs
 */
export function generateRequestId(): string {
  // Simple implementation - in production, use uuid v7
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}
