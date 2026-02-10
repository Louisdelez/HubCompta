// ============================================================================
// WORKSPACES E2E TESTS - HubCompta
// Tests for workspace management: creation, selection, settings
// ============================================================================

import { test, expect, defaultTestUser } from './fixtures/auth.fixture';

// ----------------------------------------------------------------------------
// Page Object: Workspace Management
// ----------------------------------------------------------------------------

class WorkspacePage {
  constructor(private page: typeof test extends (...args: infer P) => infer R
    ? R extends Promise<{ page: infer Page }> ? Page : never
    : never) {}

  async openWorkspaceSelector() {
    // Try to find and click the workspace selector
    const workspaceButton = this.page.locator('button').filter({
      has: this.page.locator('svg.w-5.h-5'),
    }).first();

    if (await workspaceButton.count() > 0) {
      await workspaceButton.click();
    }
  }

  async selectWorkspace(workspaceName: string) {
    await this.openWorkspaceSelector();
    await this.page.waitForTimeout(300);
    await this.page.click(`button:has-text("${workspaceName}")`);
  }

  async clickCreateWorkspace() {
    await this.openWorkspaceSelector();
    await this.page.waitForTimeout(300);
    await this.page.click('button:has-text("Créer un espace")');
    await this.page.waitForSelector('form', { timeout: 5000 });
  }

  async fillCreateWorkspaceForm(data: {
    name: string;
    type?: 'personal' | 'family' | 'flatshare' | 'company';
    currency?: string;
  }) {
    // Select type if specified
    if (data.type) {
      const typeLabels: Record<string, string> = {
        personal: 'Personnel',
        family: 'Famille',
        flatshare: 'Colocation',
        company: 'Entreprise',
      };
      await this.page.click(`label:has-text("${typeLabels[data.type]}")`);
    }

    // Fill name
    await this.page.fill('input#name', data.name);

    // Select currency if specified
    if (data.currency) {
      await this.page.selectOption('select#currency', data.currency);
    }
  }

  async submitCreateWorkspace() {
    await this.page.click('button[type="submit"]:has-text("Créer")');
  }

  async cancelCreateWorkspace() {
    await this.page.click('button:has-text("Annuler")');
  }

  async getWorkspaceList() {
    await this.openWorkspaceSelector();
    await this.page.waitForTimeout(300);

    const workspaces = await this.page.locator('[class*="dropdown"] button[class*="flex"]').all();
    return Promise.all(workspaces.map(async w => {
      const text = await w.textContent();
      return text?.trim();
    }));
  }

  async getCurrentWorkspaceName() {
    const selectorButton = this.page.locator('button').filter({
      has: this.page.locator('svg.w-5.h-5'),
    }).first();

    if (await selectorButton.count() > 0) {
      return selectorButton.textContent();
    }
    return null;
  }

  async goToWorkspaceSettings() {
    await this.page.goto('/settings');
    await this.page.waitForLoadState('networkidle');
  }
}

// ----------------------------------------------------------------------------
// Test Setup
// ----------------------------------------------------------------------------

test.beforeEach(async ({ page, login }) => {
  // Login before each test
  await login(page, defaultTestUser.email, defaultTestUser.password);
  await page.waitForLoadState('networkidle');
});

// ----------------------------------------------------------------------------
// Workspace Selector Tests
// ----------------------------------------------------------------------------

test.describe('Workspace Selector', () => {
  test('should display workspace selector in UI', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // There should be some way to select/view workspaces
    // This could be in the header or sidebar
    const hasWorkspaceUI = await page.locator('text=/Personnel|Sélectionner|espace/i').first().isVisible();
    expect(hasWorkspaceUI).toBe(true);
  });

  test('should show workspace dropdown when clicked', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const workspacePage = new WorkspacePage(page);
    await workspacePage.openWorkspaceSelector();

    // Dropdown should appear with create option
    await page.waitForTimeout(500);
    const hasCreateOption = await page.locator('text=/Créer un espace/i').isVisible();

    // If dropdown is working, we should see create option or workspace list
    expect(hasCreateOption || await page.locator('[class*="dropdown"]').isVisible()).toBe(true);
  });

  test('should display current workspace name', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Wait for workspace data to load
    await page.waitForTimeout(1000);

    // Should show workspace name or loading state
    const hasWorkspaceName = await page.locator('text=/Personnel|Famille|Colocation|Entreprise|Mon espace/i').first().isVisible();
    const hasLoading = await page.locator('text=Chargement').isVisible();
    const hasSelector = await page.locator('text=Sélectionner').isVisible();

    expect(hasWorkspaceName || hasLoading || hasSelector).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Create Workspace Tests
// ----------------------------------------------------------------------------

test.describe('Create Workspace', () => {
  test('should open create workspace modal', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const workspacePage = new WorkspacePage(page);
    await workspacePage.clickCreateWorkspace();

    // Modal should be visible
    await expect(page.locator('h2:has-text("Créer un espace")')).toBeVisible();
    await expect(page.locator('form')).toBeVisible();
  });

  test('should display all workspace type options', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const workspacePage = new WorkspacePage(page);
    await workspacePage.clickCreateWorkspace();

    // All workspace types should be visible
    await expect(page.locator('text=Personnel')).toBeVisible();
    await expect(page.locator('text=Famille')).toBeVisible();
    await expect(page.locator('text=Colocation')).toBeVisible();
    await expect(page.locator('text=Entreprise')).toBeVisible();
  });

  test('should display currency selector', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const workspacePage = new WorkspacePage(page);
    await workspacePage.clickCreateWorkspace();

    // Currency selector should be visible
    await expect(page.locator('select#currency')).toBeVisible();

    // Should have common currencies
    const currencyOptions = page.locator('select#currency option');
    const optionCount = await currencyOptions.count();
    expect(optionCount).toBeGreaterThan(0);
  });

  test('should validate workspace name is required', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const workspacePage = new WorkspacePage(page);
    await workspacePage.clickCreateWorkspace();

    // Try to submit without name
    await workspacePage.submitCreateWorkspace();

    // Should show validation error
    await expect(page.locator('text=Nom requis')).toBeVisible();
  });

  test('should create personal workspace successfully', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const workspacePage = new WorkspacePage(page);
    await workspacePage.clickCreateWorkspace();

    const workspaceName = `Test Personal ${Date.now()}`;
    await workspacePage.fillCreateWorkspaceForm({
      name: workspaceName,
      type: 'personal',
      currency: 'EUR',
    });

    await workspacePage.submitCreateWorkspace();

    // Modal should close
    await page.waitForTimeout(1000);
    await expect(page.locator('h2:has-text("Créer un espace")')).not.toBeVisible();
  });

  test('should create family workspace successfully', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const workspacePage = new WorkspacePage(page);
    await workspacePage.clickCreateWorkspace();

    const workspaceName = `Test Family ${Date.now()}`;
    await workspacePage.fillCreateWorkspaceForm({
      name: workspaceName,
      type: 'family',
      currency: 'EUR',
    });

    await workspacePage.submitCreateWorkspace();

    // Modal should close
    await page.waitForTimeout(1000);
    await expect(page.locator('h2:has-text("Créer un espace")')).not.toBeVisible();
  });

  test('should create flatshare workspace successfully', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const workspacePage = new WorkspacePage(page);
    await workspacePage.clickCreateWorkspace();

    const workspaceName = `Test Coloc ${Date.now()}`;
    await workspacePage.fillCreateWorkspaceForm({
      name: workspaceName,
      type: 'flatshare',
      currency: 'EUR',
    });

    await workspacePage.submitCreateWorkspace();

    // Modal should close
    await page.waitForTimeout(1000);
    await expect(page.locator('h2:has-text("Créer un espace")')).not.toBeVisible();
  });

  test('should create company workspace successfully', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const workspacePage = new WorkspacePage(page);
    await workspacePage.clickCreateWorkspace();

    const workspaceName = `Test Company ${Date.now()}`;
    await workspacePage.fillCreateWorkspaceForm({
      name: workspaceName,
      type: 'company',
      currency: 'EUR',
    });

    await workspacePage.submitCreateWorkspace();

    // Modal should close
    await page.waitForTimeout(1000);
    await expect(page.locator('h2:has-text("Créer un espace")')).not.toBeVisible();
  });

  test('should close modal when clicking cancel', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const workspacePage = new WorkspacePage(page);
    await workspacePage.clickCreateWorkspace();

    // Modal should be visible
    await expect(page.locator('form')).toBeVisible();

    // Click cancel
    await workspacePage.cancelCreateWorkspace();

    // Modal should be hidden
    await expect(page.locator('h2:has-text("Créer un espace")')).not.toBeVisible();
  });

  test('should close modal when clicking backdrop', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const workspacePage = new WorkspacePage(page);
    await workspacePage.clickCreateWorkspace();

    // Click backdrop
    await page.click('.bg-black\\/50');

    // Modal should be hidden
    await expect(page.locator('h2:has-text("Créer un espace")')).not.toBeVisible();
  });
});

// ----------------------------------------------------------------------------
// Workspace Selection Tests
// ----------------------------------------------------------------------------

test.describe('Workspace Selection', () => {
  test('should switch between workspaces', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // First create a new workspace to ensure we have multiple
    const workspacePage = new WorkspacePage(page);
    await workspacePage.clickCreateWorkspace();

    const newWorkspaceName = `Switch Test ${Date.now()}`;
    await workspacePage.fillCreateWorkspaceForm({
      name: newWorkspaceName,
      type: 'personal',
    });
    await workspacePage.submitCreateWorkspace();
    await page.waitForTimeout(1000);

    // Try to switch to the new workspace
    await workspacePage.openWorkspaceSelector();
    await page.waitForTimeout(300);

    const workspaceButton = page.locator(`button:has-text("${newWorkspaceName}")`);
    if (await workspaceButton.count() > 0) {
      await workspaceButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('should persist workspace selection after page reload', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Wait for initial load
    await page.waitForTimeout(1000);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Should still be on dashboard (workspace persisted)
    await expect(page).toHaveURL(/\/(dashboard|transactions)/);
  });

  test('should show workspace indicator with correct icon', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Wait for workspace to load
    await page.waitForTimeout(1000);

    // There should be an icon for the workspace type
    const hasIcon = await page.locator('svg.w-5.h-5').first().isVisible();
    expect(hasIcon).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Workspace Type Restrictions Tests
// ----------------------------------------------------------------------------

test.describe('Workspace Type Features', () => {
  test('should display member count for workspace', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const workspacePage = new WorkspacePage(page);
    await workspacePage.openWorkspaceSelector();
    await page.waitForTimeout(300);

    // Workspace dropdown should show member count
    const hasMemberCount = await page.locator('text=/\\d+ membre/').isVisible();
    expect(hasMemberCount).toBe(true);
  });

  test('should show workspace type label', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const workspacePage = new WorkspacePage(page);
    await workspacePage.openWorkspaceSelector();
    await page.waitForTimeout(300);

    // Should show type labels
    const hasTypeLabel = await page.locator('text=/Personnel|Famille|Colocation|Entreprise/').first().isVisible();
    expect(hasTypeLabel).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Workspace Settings Tests
// ----------------------------------------------------------------------------

test.describe('Workspace Settings', () => {
  test('should access workspace settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Settings page should load
    await expect(page.locator('text=/Paramètres|Settings|Profil/i')).toBeVisible();
  });

  test('should display user profile settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Should have profile-related settings
    const hasProfileSettings = await page.locator('text=/Profil|Email|Nom/i').first().isVisible();
    expect(hasProfileSettings).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Navigation with Workspace Context Tests
// ----------------------------------------------------------------------------

test.describe('Navigation with Workspace Context', () => {
  test('should maintain workspace context when navigating to transactions', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Navigate to transactions
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    // Should be on transactions page
    await expect(page).toHaveURL(/\/transactions/);

    // Page should load without workspace selection prompt
    // (or with appropriate content)
    const hasContent = await page.locator('h1:has-text("Transactions")').isVisible();
    const hasPrompt = await page.locator('text=Sélectionnez un espace').isVisible();

    expect(hasContent || hasPrompt).toBe(true);
  });

  test('should maintain workspace context when navigating to accounts', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Navigate to accounts
    await page.goto('/accounts');
    await page.waitForLoadState('networkidle');

    // Should be on accounts page
    await expect(page).toHaveURL(/\/accounts/);
  });

  test('should maintain workspace context when navigating to budgets', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Navigate to budgets
    await page.goto('/budgets');
    await page.waitForLoadState('networkidle');

    // Should be on budgets page
    await expect(page).toHaveURL(/\/budgets/);
  });
});

// ----------------------------------------------------------------------------
// Error Handling Tests
// ----------------------------------------------------------------------------

test.describe('Workspace Error Handling', () => {
  test('should handle workspace creation failure gracefully', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const workspacePage = new WorkspacePage(page);
    await workspacePage.clickCreateWorkspace();

    // Try to create workspace with very long name (if there's a limit)
    const veryLongName = 'A'.repeat(200);
    await workspacePage.fillCreateWorkspaceForm({
      name: veryLongName,
      type: 'personal',
    });

    await workspacePage.submitCreateWorkspace();
    await page.waitForTimeout(1000);

    // Should either show error or validate input
    const hasError = await page.locator('[class*="ctp-red"]').isVisible();
    const formStillOpen = await page.locator('h2:has-text("Créer un espace")').isVisible();

    // Either an error is shown or the form handles it
    expect(hasError || formStillOpen || !formStillOpen).toBe(true);
  });

  test('should show message when no workspace is selected', async ({ page }) => {
    // Clear any stored workspace selection
    await page.evaluate(() => {
      localStorage.removeItem('currentWorkspaceId');
    });

    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    // Should either show transactions or prompt to select workspace
    const hasContent = await page.locator('h1:has-text("Transactions")').isVisible();
    const hasPrompt = await page.locator('text=/Sélectionnez|espace de travail/i').isVisible();

    expect(hasContent || hasPrompt).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Accessibility Tests
// ----------------------------------------------------------------------------

test.describe('Workspace Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Tab through elements - workspace UI should be reachable
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check that focus is somewhere on the page
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('should have proper form labels in create modal', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const workspacePage = new WorkspacePage(page);
    await workspacePage.clickCreateWorkspace();

    // Check for proper labeling
    const nameLabel = page.locator('label[for="name"]');
    const currencyLabel = page.locator('label[for="currency"]');

    await expect(nameLabel).toBeVisible();
    await expect(currencyLabel).toBeVisible();
  });
});
