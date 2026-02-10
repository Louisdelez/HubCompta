// ============================================================================
// FRONTEND LOGGER - Finance Hub
// Structured logging for frontend with environment-aware behavior
// ============================================================================

interface LogContext {
  [key: string]: unknown;
}

const isDev = import.meta.env.DEV;

/**
 * Structured logger for frontend
 * - In development: logs to console with formatting
 * - In production: only logs warnings and errors, could be sent to external service
 */
export const logger = {
  debug(message: string, context?: LogContext): void {
    if (isDev) {
      console.debug(`[DEBUG] ${message}`, context ?? '');
    }
  },

  info(message: string, context?: LogContext): void {
    if (isDev) {
      console.info(`[INFO] ${message}`, context ?? '');
    }
  },

  warn(message: string, context?: LogContext): void {
    console.warn(`[WARN] ${message}`, context ?? '');
  },

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    console.error(`[ERROR] ${message}`, error ?? '', context ?? '');
    // In production, could send to Sentry or other error tracking
  },
};

export default logger;
