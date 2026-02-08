// ============================================================================
// BACKEND ENTRY POINT - Finance Hub
// ============================================================================

import { startServer } from './app.js';

// Start the server
startServer().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
