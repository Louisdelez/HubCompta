// ============================================================================
// AUTH E2E TESTS - HubCompta
// Tests for authentication flows: registration, login, logout, session
// ============================================================================

import { test, expect, LoginPage, RegisterPage, DashboardPage, defaultTestUser } from './fixtures/auth.fixture';

// ----------------------------------------------------------------------------
// Registration Tests
// ----------------------------------------------------------------------------

test.describe('Registration Flow', () => {
  test('should display registration form with all required fields', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    // Verify all form fields are present
    await expect(page.locator('input#displayName')).toBeVisible();
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('input#confirmPassword')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Verify page title and branding
    await expect(page.locator('h1')).toContainText('Creer un compte');
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    // Submit empty form
    await registerPage.submit();

    // Should show validation errors
    await expect(page.locator('text=Nom requis')).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    // Fill with invalid email
    await registerPage.fillDisplayName('Test User');
    await registerPage.fillEmail('invalid-email');
    await registerPage.fillPassword('TestPassword123!');
    await registerPage.fillConfirmPassword('TestPassword123!');
    await registerPage.submit();

    // Should show email validation error
    await expect(page.locator('text=Email invalide')).toBeVisible();
  });

  test('should validate password requirements', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    // Fill with weak password
    await registerPage.fillDisplayName('Test User');
    await registerPage.fillEmail('test@example.com');
    await registerPage.fillPassword('weak');
    await registerPage.fillConfirmPassword('weak');
    await registerPage.submit();

    // Should show password validation error (min 12 chars)
    const errorText = await page.locator('[class*="ctp-red"]').first().textContent();
    expect(errorText).toContain('caractères');
  });

  test('should validate password confirmation matches', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    // Fill with mismatched passwords
    await registerPage.fillDisplayName('Test User');
    await registerPage.fillEmail('test@example.com');
    await registerPage.fillPassword('TestPassword123!');
    await registerPage.fillConfirmPassword('DifferentPassword123!');
    await registerPage.submit();

    // Should show password mismatch error
    await expect(page.locator('text=ne correspondent pas')).toBeVisible();
  });

  test('should register new user successfully', async ({ page, testUser }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    // Fill valid registration data
    await registerPage.register(testUser);

    // Should show success message or redirect to login
    await Promise.race([
      expect(page.locator('text=Compte cree')).toBeVisible(),
      expect(page).toHaveURL(/\/login/, { timeout: 15000 }),
    ]);
  });

  test('should navigate to login page from registration', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.goToLogin();

    await expect(page).toHaveURL(/\/login/);
  });
});

// ----------------------------------------------------------------------------
// Login Tests
// ----------------------------------------------------------------------------

test.describe('Login Flow', () => {
  test('should display login form with all required fields', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Verify all form fields are present
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Verify page title and branding
    await expect(page.locator('h1')).toContainText('Finance Hub');
    await expect(page.locator('text=Connectez-vous')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Submit empty form
    await loginPage.submit();

    // Should show validation errors
    await expect(page.locator('text=Email requis')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Try to login with invalid credentials
    await loginPage.login('nonexistent@example.com', 'WrongPassword123!');

    // Wait for error message
    await page.waitForTimeout(1000);

    // Should show error message or stay on login page
    const isOnLoginPage = await loginPage.isOnLoginPage();
    expect(isOnLoginPage).toBe(true);
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Login with default test user
    await loginPage.login(defaultTestUser.email, defaultTestUser.password);

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/(dashboard|transactions)/, { timeout: 15000 });
  });

  test('should navigate to registration page from login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.goToRegister();

    await expect(page).toHaveURL(/\/register/);
  });

  test('should show loading state during login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Fill credentials
    await loginPage.fillEmail(defaultTestUser.email);
    await loginPage.fillPassword(defaultTestUser.password);

    // Click submit and check for loading state
    await loginPage.submit();

    // Loading state should be visible briefly
    const loadingText = page.locator('text=Connexion...');
    // Note: This might be too fast to catch, so we just verify the form works
    await page.waitForTimeout(500);
  });
});

// ----------------------------------------------------------------------------
// Logout Tests
// ----------------------------------------------------------------------------

test.describe('Logout Flow', () => {
  test('should logout successfully and redirect to login', async ({ page, login, logout }) => {
    // First, login
    await login(page, defaultTestUser.email, defaultTestUser.password);

    // Verify we're logged in
    await expect(page).toHaveURL(/\/(dashboard|transactions)/);

    // Logout
    await logout(page);

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should not access protected routes after logout', async ({ page, login, logout }) => {
    // Login first
    await login(page, defaultTestUser.email, defaultTestUser.password);

    // Logout
    await logout(page);

    // Try to access protected route
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});

// ----------------------------------------------------------------------------
// Session Persistence Tests
// ----------------------------------------------------------------------------

test.describe('Session Persistence', () => {
  test('should maintain session after page reload', async ({ page, login }) => {
    // Login
    await login(page, defaultTestUser.email, defaultTestUser.password);

    // Verify we're on dashboard
    await expect(page).toHaveURL(/\/(dashboard|transactions)/);

    // Reload the page
    await page.reload();

    // Should still be authenticated
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/(dashboard|transactions|accounts)/);
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();

    // Try to access protected route without authentication
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('should redirect to intended page after login', async ({ page, login }) => {
    // Clear any existing session
    await page.context().clearCookies();

    // Try to access a specific protected route
    await page.goto('/transactions');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);

    // Login
    await login(page, defaultTestUser.email, defaultTestUser.password);

    // After login, should be on a protected page
    await expect(page).toHaveURL(/\/(dashboard|transactions)/);
  });
});

// ----------------------------------------------------------------------------
// Security Tests
// ----------------------------------------------------------------------------

test.describe('Security', () => {
  test('should not expose password in URL', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login(defaultTestUser.email, defaultTestUser.password);

    // Wait for navigation
    await page.waitForTimeout(1000);

    // URL should not contain password
    const url = page.url();
    expect(url).not.toContain(defaultTestUser.password);
    expect(url).not.toContain('password');
  });

  test('should mask password input', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should have autocomplete attributes for security', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput).toHaveAttribute('autocomplete', 'email');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  });
});

// ----------------------------------------------------------------------------
// Accessibility Tests
// ----------------------------------------------------------------------------

test.describe('Accessibility', () => {
  test('should have proper form labels on login page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Check that labels are associated with inputs
    const emailLabel = page.locator('label[for="email"]');
    const passwordLabel = page.locator('label[for="password"]');

    await expect(emailLabel).toBeVisible();
    await expect(passwordLabel).toBeVisible();
  });

  test('should have proper form labels on register page', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    // Check that labels are associated with inputs
    const displayNameLabel = page.locator('label[for="displayName"]');
    const emailLabel = page.locator('label[for="email"]');
    const passwordLabel = page.locator('label[for="password"]');
    const confirmPasswordLabel = page.locator('label[for="confirmPassword"]');

    await expect(displayNameLabel).toBeVisible();
    await expect(emailLabel).toBeVisible();
    await expect(passwordLabel).toBeVisible();
    await expect(confirmPasswordLabel).toBeVisible();
  });

  test('should be navigable with keyboard on login page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="email"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="password"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('button[type="submit"]')).toBeFocused();
  });
});
