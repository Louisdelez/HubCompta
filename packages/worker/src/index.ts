// ============================================================================
// WORKER ENTRY POINT - Finance Hub
// ============================================================================

import { startWorker, gracefulShutdown } from './jobs/registry.js';

function main(): void {
  console.info('Starting Finance Hub Worker...');

  try {
    startWorker();
    console.info('Worker started successfully');
  } catch (error) {
    console.error('Failed to start worker:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.info('Received SIGTERM, shutting down gracefully...');
  void gracefulShutdown().then(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.info('Received SIGINT, shutting down gracefully...');
  void gracefulShutdown().then(() => process.exit(0));
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

// Start the worker
main();
