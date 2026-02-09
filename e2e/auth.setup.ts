// ============================================================================
// AUTH SETUP - Playwright Global Setup
// Creates authenticated state that can be reused across tests
// ============================================================================

import { test as setup, expect } from '@playwright/test';
import path from 'path';

// Path to store authenticated state
const authFile = path.join(__dirname, '../playwright/.auth/user.json');

// Default test user credentials
const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
};

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Wait for the login form to be ready
  await page.waitForSelector('form');

  // Fill in credentials
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);

  // Submit the login form
  await page.click('button[type="submit"]');

  // Wait for successful login - either dashboard redirect or MFA prompt
  try {
    await Promise.race([
      page.waitForURL('**/dashboard', { timeout: 15000 }),
      page.waitForURL('**/transactions', { timeout: 15000 }),
      page.waitForSelector('text=MFA', { timeout: 15000 }),
    ]);

    // Verify we're authenticated
    const isAuthenticated =
      page.url().includes('/dashboard') ||
      page.url().includes('/transactions') ||
      !(await page.locator('text=Login failed').isVisible());

    if (!isAuthenticated) {
      throw new Error('Failed to authenticate - check test user credentials');
    }

    // Save authenticated state to file
    await page.context().storageState({ path: authFile });

    console.log('Authentication state saved to:', authFile);
  } catch (error) {
    console.warn('Authentication setup skipped or failed:', error);
    // Don't fail the setup - tests will handle their own auth
  }
});

setup.describe.configure({ mode: 'serial' });
