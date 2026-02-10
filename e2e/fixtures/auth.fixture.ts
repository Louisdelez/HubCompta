// ============================================================================
// AUTH FIXTURE - E2E Test Helpers
// Provides authenticated page and login utilities
// ============================================================================

import { test as base, Page, expect } from '@playwright/test';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface TestUser {
  email: string;
  password: string;
  displayName: string;
}

interface AuthFixtures {
  authenticatedPage: Page;
  testUser: TestUser;
  login: (page: Page, email: string, password: string) => Promise<void>;
  register: (page: Page, user: TestUser) => Promise<void>;
  logout: (page: Page) => Promise<void>;
}

// ----------------------------------------------------------------------------
// Test User Data
// ----------------------------------------------------------------------------

// Generate unique test user to avoid conflicts
const generateTestUser = (): TestUser => ({
  email: `test.${Date.now()}@example.com`,
  password: 'TestPassword123!',
  displayName: `Test User ${Date.now()}`,
});

// Default test user for seeded database
export const defaultTestUser: TestUser = {
  email: 'test@example.com',
  password: 'TestPassword123!',
  displayName: 'Test User',
};

// ----------------------------------------------------------------------------
// Auth Helpers
// ----------------------------------------------------------------------------

/**
 * Login helper - fills the login form and submits
 */
async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');

  // Wait for the login form to be visible
  await page.waitForSelector('form');

  // Fill in credentials
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  // Submit the form
  await page.click('button[type="submit"]');

  // Wait for navigation to dashboard or error
  await Promise.race([
    page.waitForURL('**/dashboard', { timeout: 10000 }),
    page.waitForSelector('[class*="ctp-red"]', { timeout: 10000 }),
  ]);
}

/**
 * Register helper - fills the registration form and submits
 */
async function register(page: Page, user: TestUser): Promise<void> {
  await page.goto('/register');

  // Wait for the registration form to be visible
  await page.waitForSelector('form');

  // Fill in registration data
  await page.fill('input#displayName', user.displayName);
  await page.fill('input#email', user.email);
  await page.fill('input#password', user.password);
  await page.fill('input#confirmPassword', user.password);

  // Submit the form
  await page.click('button[type="submit"]');

  // Wait for success message or redirect
  await Promise.race([
    page.waitForURL('**/login', { timeout: 15000 }),
    page.waitForSelector('text=Compte cree', { timeout: 15000 }),
    page.waitForSelector('[class*="ctp-red"]', { timeout: 15000 }),
  ]);
}

/**
 * Logout helper - clicks the logout button
 */
async function logout(page: Page): Promise<void> {
  // Look for user menu or settings menu that contains logout
  const userMenuButton = page.locator('[data-testid="user-menu"]').or(
    page.locator('button:has-text("Deconnexion")')
  ).or(
    page.locator('[aria-label="User menu"]')
  );

  // If there's a menu button, click it first
  if (await userMenuButton.count() > 0) {
    await userMenuButton.first().click();
    await page.waitForTimeout(300); // Wait for menu animation
  }

  // Click logout button
  const logoutButton = page.locator('button:has-text("Déconnexion")').or(
    page.locator('button:has-text("Se déconnecter")').or(
      page.locator('[data-testid="logout-button"]')
    )
  );

  if (await logoutButton.count() > 0) {
    await logoutButton.first().click();
    await page.waitForURL('**/login', { timeout: 10000 });
  }
}

// ----------------------------------------------------------------------------
// Extended Test with Auth Fixtures
// ----------------------------------------------------------------------------

export const test = base.extend<AuthFixtures>({
  // Generate a unique test user for each test
  testUser: async (_, use) => {
    const user = generateTestUser();
    await use(user);
  },

  // Provide helper functions
  login: async (_, use) => {
    await use(login);
  },

  register: async (_, use) => {
    await use(register);
  },

  logout: async (_, use) => {
    await use(logout);
  },

  // Authenticated page - logs in before test
  authenticatedPage: async ({ page }, use) => {
    // Use default test user for authenticated page
    await login(page, defaultTestUser.email, defaultTestUser.password);

    // Verify we're on a protected page
    await expect(page).toHaveURL(/\/(dashboard|transactions|accounts)/);

    await use(page);
  },
});

export { expect };

// ----------------------------------------------------------------------------
// Page Object: Login Page
// ----------------------------------------------------------------------------

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForSelector('form');
  }

  async fillEmail(email: string) {
    await this.page.fill('input[type="email"]', email);
  }

  async fillPassword(password: string) {
    await this.page.fill('input[type="password"]', password);
  }

  async submit() {
    await this.page.click('button[type="submit"]');
  }

  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  async getErrorMessage() {
    const errorElement = this.page.locator('[class*="ctp-red"]').first();
    if (await errorElement.count() > 0) {
      return errorElement.textContent();
    }
    return null;
  }

  isOnLoginPage(): boolean {
    return this.page.url().includes('/login');
  }

  async goToRegister() {
    await this.page.click('a[href="/register"]');
    await this.page.waitForURL('**/register');
  }
}

// ----------------------------------------------------------------------------
// Page Object: Register Page
// ----------------------------------------------------------------------------

export class RegisterPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/register');
    await this.page.waitForSelector('form');
  }

  async fillDisplayName(name: string) {
    await this.page.fill('input#displayName', name);
  }

  async fillEmail(email: string) {
    await this.page.fill('input#email', email);
  }

  async fillPassword(password: string) {
    await this.page.fill('input#password', password);
  }

  async fillConfirmPassword(password: string) {
    await this.page.fill('input#confirmPassword', password);
  }

  async submit() {
    await this.page.click('button[type="submit"]');
  }

  async register(user: TestUser) {
    await this.fillDisplayName(user.displayName);
    await this.fillEmail(user.email);
    await this.fillPassword(user.password);
    await this.fillConfirmPassword(user.password);
    await this.submit();
  }

  async getErrorMessage() {
    const errorElement = this.page.locator('[class*="ctp-red"]').first();
    if (await errorElement.count() > 0) {
      return errorElement.textContent();
    }
    return null;
  }

  async isSuccess() {
    return (await this.page.locator('text=Compte cree').count()) > 0;
  }

  async goToLogin() {
    await this.page.click('a[href="/login"]');
    await this.page.waitForURL('**/login');
  }
}

// ----------------------------------------------------------------------------
// Page Object: Dashboard Page
// ----------------------------------------------------------------------------

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard');
  }

  async waitForLoad() {
    // Wait for dashboard content to load
    await this.page.waitForSelector('h1', { timeout: 10000 });
  }

  isOnDashboard(): boolean {
    return this.page.url().includes('/dashboard');
  }

  async getWelcomeMessage() {
    const heading = this.page.locator('h1').first();
    return heading.textContent();
  }
}
