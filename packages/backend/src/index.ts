// ============================================================================
// BACKEND ENTRY POINT - Finance Hub
// ============================================================================

import { startServer } from './app.js';
import { logger } from './core/middleware/logger.js';

// Start the server
startServer().catch((error) => {
  logger.fatal({ error }, 'Fatal error');
  process.exit(1);
});
