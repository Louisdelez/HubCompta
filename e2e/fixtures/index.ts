// ============================================================================
// E2E TEST FIXTURES INDEX
// Central export for all test fixtures and utilities
// ============================================================================

export * from './auth.fixture';

// Re-export Playwright test utilities
export { test as baseTest, expect } from '@playwright/test';
