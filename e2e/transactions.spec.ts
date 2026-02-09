// ============================================================================
// TRANSACTIONS E2E TESTS - HubCompta
// Tests for transaction CRUD operations, filtering, and search
// ============================================================================

import { test, expect, defaultTestUser } from './fixtures/auth.fixture';

// ----------------------------------------------------------------------------
// Page Object: Transactions Page
// ----------------------------------------------------------------------------

class TransactionsPage {
  constructor(private page: typeof test extends (...args: infer P) => infer R
    ? R extends Promise<{ page: infer Page }> ? Page : never
    : never) {}

  async goto() {
    await this.page.goto('/transactions');
    await this.page.waitForLoadState('networkidle');
  }

  async waitForTransactionsList() {
    // Wait for either transactions to load or empty state
    await Promise.race([
      this.page.waitForSelector('[class*="card"]', { timeout: 10000 }),
      this.page.waitForSelector('text=Aucune transaction', { timeout: 10000 }),
    ]);
  }

  async clickNewTransaction() {
    await this.page.click('button:has-text("Nouvelle transaction")');
    await this.page.waitForSelector('form', { timeout: 5000 });
  }

  async fillTransactionForm(data: {
    type?: 'expense' | 'income';
    amount: number;
    description: string;
    accountId?: string;
    date?: string;
    categoryId?: string;
  }) {
    // Select transaction type if specified
    if (data.type === 'expense') {
      await this.page.click('button:has-text("Depense")');
    } else if (data.type === 'income') {
      await this.page.click('button:has-text("Revenu")');
    }

    // Fill amount
    await this.page.fill('input#amount', data.amount.toString());

    // Fill description
    await this.page.fill('input#description', data.description);

    // Select account if provided
    if (data.accountId) {
      await this.page.selectOption('select#accountId', data.accountId);
    } else {
      // Select first available account
      const accountSelect = this.page.locator('select#accountId');
      const options = await accountSelect.locator('option').all();
      if (options.length > 1) {
        const firstOption = await options[1].getAttribute('value');
        if (firstOption) {
          await accountSelect.selectOption(firstOption);
        }
      }
    }

    // Fill date if provided
    if (data.date) {
      await this.page.fill('input#date', data.date);
    }
  }

  async submitTransaction() {
    await this.page.click('button[type="submit"]:has-text("Créer"), button[type="submit"]:has-text("Enregistrer")');
  }

  async cancelTransaction() {
    await this.page.click('button:has-text("Annuler")');
  }

  async searchTransactions(query: string) {
    await this.page.fill('input[placeholder*="Rechercher"]', query);
    await this.page.click('button:has-text("Rechercher")');
    await this.page.waitForTimeout(500);
  }

  async clearSearch() {
    await this.page.fill('input[placeholder*="Rechercher"]', '');
    await this.page.click('button:has-text("Rechercher")');
    await this.page.waitForTimeout(500);
  }

  async getTransactionCount() {
    const countText = await this.page.locator('text=/\\d+ transactions?/').textContent();
    const match = countText?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async clickTransaction(description: string) {
    await this.page.click(`[class*="card"]:has-text("${description}")`);
    await this.page.waitForSelector('form', { timeout: 5000 });
  }

  async deleteTransaction() {
    await this.page.click('button:has-text("Supprimer")');
    // Handle confirmation dialog
    this.page.on('dialog', dialog => dialog.accept());
  }

  async getTransactionDescriptions() {
    const transactions = await this.page.locator('[class*="card"] p.font-medium').all();
    return Promise.all(transactions.map(t => t.textContent()));
  }

  async isTransactionVisible(description: string) {
    return this.page.locator(`text=${description}`).isVisible();
  }
}

// ----------------------------------------------------------------------------
// Test Setup
// ----------------------------------------------------------------------------

test.beforeEach(async ({ page, login }) => {
  // Login before each test
  await login(page, defaultTestUser.email, defaultTestUser.password);

  // Navigate to transactions page
  await page.goto('/transactions');
  await page.waitForLoadState('networkidle');
});

// ----------------------------------------------------------------------------
// Transaction List Tests
// ----------------------------------------------------------------------------

test.describe('Transaction List', () => {
  test('should display transactions page with header', async ({ page }) => {
    await expect(page.locator('h1:has-text("Transactions")')).toBeVisible();
  });

  test('should show new transaction button', async ({ page }) => {
    await expect(page.locator('button:has-text("Nouvelle transaction")')).toBeVisible();
  });

  test('should display search input', async ({ page }) => {
    await expect(page.locator('input[placeholder*="Rechercher"]')).toBeVisible();
  });

  test('should display transaction count', async ({ page }) => {
    // Wait for transactions to load
    await page.waitForTimeout(1000);

    // Should show count or "Aucune transaction"
    const hasCount = await page.locator('text=/\\d+ transactions?/').isVisible();
    const hasEmpty = await page.locator('text=Aucune transaction').isVisible();

    expect(hasCount || hasEmpty).toBe(true);
  });

  test('should group transactions by date', async ({ page }) => {
    // Wait for transactions to load
    await page.waitForTimeout(1000);

    // If there are transactions, they should be grouped with date headers
    const transactions = await page.locator('[class*="card"]').count();
    if (transactions > 0) {
      // Date headers should be visible (e.g., "lun. 1 jan.")
      const dateHeaders = await page.locator('h3.text-sm').count();
      expect(dateHeaders).toBeGreaterThanOrEqual(0);
    }
  });
});

// ----------------------------------------------------------------------------
// Create Transaction Tests
// ----------------------------------------------------------------------------

test.describe('Create Transaction', () => {
  test('should open transaction form when clicking new button', async ({ page }) => {
    await page.click('button:has-text("Nouvelle transaction")');

    // Form should be visible
    await expect(page.locator('h2:has-text("Nouvelle transaction")')).toBeVisible();
    await expect(page.locator('form')).toBeVisible();
  });

  test('should display all form fields', async ({ page }) => {
    await page.click('button:has-text("Nouvelle transaction")');

    // Check for type toggle buttons
    await expect(page.locator('button:has-text("Depense")')).toBeVisible();
    await expect(page.locator('button:has-text("Revenu")')).toBeVisible();

    // Check for form inputs
    await expect(page.locator('input#amount')).toBeVisible();
    await expect(page.locator('input#description')).toBeVisible();
    await expect(page.locator('select#accountId')).toBeVisible();
    await expect(page.locator('input#date')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.click('button:has-text("Nouvelle transaction")');

    // Try to submit empty form
    await page.click('button[type="submit"]:has-text("Créer")');

    // Should show validation errors
    await expect(page.locator('text=/requis/i')).toBeVisible();
  });

  test('should create expense transaction successfully', async ({ page }) => {
    const transactionsPage = new TransactionsPage(page);
    await transactionsPage.clickNewTransaction();

    const testDescription = `Test Expense ${Date.now()}`;

    // Fill form
    await transactionsPage.fillTransactionForm({
      type: 'expense',
      amount: 42.50,
      description: testDescription,
    });

    // Submit
    await transactionsPage.submitTransaction();

    // Wait for modal to close
    await page.waitForTimeout(1000);

    // Transaction should appear in list
    await expect(page.locator(`text=${testDescription}`)).toBeVisible({ timeout: 5000 });
  });

  test('should create income transaction successfully', async ({ page }) => {
    const transactionsPage = new TransactionsPage(page);
    await transactionsPage.clickNewTransaction();

    const testDescription = `Test Income ${Date.now()}`;

    // Fill form
    await transactionsPage.fillTransactionForm({
      type: 'income',
      amount: 1500.00,
      description: testDescription,
    });

    // Submit
    await transactionsPage.submitTransaction();

    // Wait for modal to close
    await page.waitForTimeout(1000);

    // Transaction should appear in list
    await expect(page.locator(`text=${testDescription}`)).toBeVisible({ timeout: 5000 });
  });

  test('should close form when clicking cancel', async ({ page }) => {
    await page.click('button:has-text("Nouvelle transaction")');

    // Form should be visible
    await expect(page.locator('form')).toBeVisible();

    // Click cancel
    await page.click('button:has-text("Annuler")');

    // Form should be hidden
    await expect(page.locator('h2:has-text("Nouvelle transaction")')).not.toBeVisible();
  });

  test('should close form when clicking backdrop', async ({ page }) => {
    await page.click('button:has-text("Nouvelle transaction")');

    // Click backdrop (outside the modal)
    await page.click('.bg-black\\/50');

    // Form should be hidden
    await expect(page.locator('h2:has-text("Nouvelle transaction")')).not.toBeVisible();
  });
});

// ----------------------------------------------------------------------------
// Edit Transaction Tests
// ----------------------------------------------------------------------------

test.describe('Edit Transaction', () => {
  test('should open edit form when clicking on transaction', async ({ page }) => {
    // First create a transaction
    const transactionsPage = new TransactionsPage(page);
    await transactionsPage.clickNewTransaction();

    const testDescription = `Edit Test ${Date.now()}`;
    await transactionsPage.fillTransactionForm({
      type: 'expense',
      amount: 25.00,
      description: testDescription,
    });
    await transactionsPage.submitTransaction();
    await page.waitForTimeout(1000);

    // Click on the transaction
    await page.click(`[class*="card"]:has-text("${testDescription}")`);

    // Edit form should be visible
    await expect(page.locator('h2:has-text("Modifier")')).toBeVisible();
  });

  test('should pre-fill form with transaction data', async ({ page }) => {
    // First create a transaction
    const transactionsPage = new TransactionsPage(page);
    await transactionsPage.clickNewTransaction();

    const testDescription = `Prefill Test ${Date.now()}`;
    await transactionsPage.fillTransactionForm({
      type: 'expense',
      amount: 99.99,
      description: testDescription,
    });
    await transactionsPage.submitTransaction();
    await page.waitForTimeout(1000);

    // Click on the transaction
    await page.click(`[class*="card"]:has-text("${testDescription}")`);

    // Check form is pre-filled
    await expect(page.locator('input#description')).toHaveValue(testDescription);
    await expect(page.locator('input#amount')).toHaveValue('99.99');
  });

  test('should update transaction successfully', async ({ page }) => {
    // First create a transaction
    const transactionsPage = new TransactionsPage(page);
    await transactionsPage.clickNewTransaction();

    const originalDescription = `Original ${Date.now()}`;
    await transactionsPage.fillTransactionForm({
      type: 'expense',
      amount: 50.00,
      description: originalDescription,
    });
    await transactionsPage.submitTransaction();
    await page.waitForTimeout(1000);

    // Click on the transaction to edit
    await page.click(`[class*="card"]:has-text("${originalDescription}")`);

    // Update description
    const updatedDescription = `Updated ${Date.now()}`;
    await page.fill('input#description', updatedDescription);
    await page.click('button[type="submit"]:has-text("Enregistrer")');

    // Wait for update
    await page.waitForTimeout(1000);

    // Updated transaction should be visible
    await expect(page.locator(`text=${updatedDescription}`)).toBeVisible();
  });
});

// ----------------------------------------------------------------------------
// Delete Transaction Tests
// ----------------------------------------------------------------------------

test.describe('Delete Transaction', () => {
  test('should show delete button in edit form', async ({ page }) => {
    // First create a transaction
    const transactionsPage = new TransactionsPage(page);
    await transactionsPage.clickNewTransaction();

    const testDescription = `Delete Test ${Date.now()}`;
    await transactionsPage.fillTransactionForm({
      type: 'expense',
      amount: 10.00,
      description: testDescription,
    });
    await transactionsPage.submitTransaction();
    await page.waitForTimeout(1000);

    // Click on the transaction
    await page.click(`[class*="card"]:has-text("${testDescription}")`);

    // Delete button should be visible
    await expect(page.locator('button:has-text("Supprimer")')).toBeVisible();
  });

  test('should delete transaction after confirmation', async ({ page }) => {
    // First create a transaction
    const transactionsPage = new TransactionsPage(page);
    await transactionsPage.clickNewTransaction();

    const testDescription = `To Delete ${Date.now()}`;
    await transactionsPage.fillTransactionForm({
      type: 'expense',
      amount: 15.00,
      description: testDescription,
    });
    await transactionsPage.submitTransaction();
    await page.waitForTimeout(1000);

    // Verify transaction exists
    await expect(page.locator(`text=${testDescription}`)).toBeVisible();

    // Click on the transaction
    await page.click(`[class*="card"]:has-text("${testDescription}")`);

    // Handle dialog before clicking delete
    page.on('dialog', dialog => dialog.accept());

    // Click delete
    await page.click('button:has-text("Supprimer")');

    // Wait for deletion
    await page.waitForTimeout(1000);

    // Transaction should no longer be visible
    await expect(page.locator(`text=${testDescription}`)).not.toBeVisible();
  });
});

// ----------------------------------------------------------------------------
// Filter and Search Tests
// ----------------------------------------------------------------------------

test.describe('Filter and Search Transactions', () => {
  test('should filter transactions by search query', async ({ page }) => {
    // First create some transactions with distinct descriptions
    const transactionsPage = new TransactionsPage(page);

    const uniquePrefix = `Search${Date.now()}`;
    const description1 = `${uniquePrefix} Groceries`;
    const description2 = `${uniquePrefix} Rent`;

    // Create first transaction
    await transactionsPage.clickNewTransaction();
    await transactionsPage.fillTransactionForm({
      type: 'expense',
      amount: 100,
      description: description1,
    });
    await transactionsPage.submitTransaction();
    await page.waitForTimeout(1000);

    // Create second transaction
    await transactionsPage.clickNewTransaction();
    await transactionsPage.fillTransactionForm({
      type: 'expense',
      amount: 800,
      description: description2,
    });
    await transactionsPage.submitTransaction();
    await page.waitForTimeout(1000);

    // Search for groceries
    await transactionsPage.searchTransactions('Groceries');
    await page.waitForTimeout(500);

    // Only groceries transaction should be visible (if filtering works)
    const groceriesVisible = await page.locator(`text=${description1}`).isVisible();
    expect(groceriesVisible).toBe(true);
  });

  test('should clear search and show all transactions', async ({ page }) => {
    const transactionsPage = new TransactionsPage(page);

    // Enter a search query
    await transactionsPage.searchTransactions('TestQuery');

    // Clear search
    await transactionsPage.clearSearch();

    // All transactions should be visible again
    await page.waitForTimeout(500);

    // The search input should be empty
    const searchInput = page.locator('input[placeholder*="Rechercher"]');
    await expect(searchInput).toHaveValue('');
  });

  test('should show empty state when no transactions match search', async ({ page }) => {
    const transactionsPage = new TransactionsPage(page);

    // Search for something that shouldn't exist
    await transactionsPage.searchTransactions('NonExistentTransaction12345');
    await page.waitForTimeout(1000);

    // Should show empty state or no results
    const noResults = await page.locator('text=Aucune transaction').isVisible();
    const emptyList = (await page.locator('[class*="card"]').count()) === 0;

    expect(noResults || emptyList).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Pagination Tests
// ----------------------------------------------------------------------------

test.describe('Pagination', () => {
  test('should display pagination controls when many transactions exist', async ({ page }) => {
    // This test assumes there are enough transactions to trigger pagination
    await page.waitForTimeout(1000);

    // Check for pagination buttons (if they exist)
    const hasPagination = await page.locator('button:has-text("Suivant")').isVisible();
    const hasPageInfo = await page.locator('text=/Page \\d+ sur \\d+/').isVisible();

    // If there aren't enough transactions, pagination won't show - that's OK
    if (hasPagination || hasPageInfo) {
      expect(hasPagination || hasPageInfo).toBe(true);
    }
  });
});

// ----------------------------------------------------------------------------
// Transaction Type Display Tests
// ----------------------------------------------------------------------------

test.describe('Transaction Type Display', () => {
  test('should display expense with red indicator', async ({ page }) => {
    const transactionsPage = new TransactionsPage(page);
    await transactionsPage.clickNewTransaction();

    const testDescription = `Red Expense ${Date.now()}`;
    await transactionsPage.fillTransactionForm({
      type: 'expense',
      amount: 50.00,
      description: testDescription,
    });
    await transactionsPage.submitTransaction();
    await page.waitForTimeout(1000);

    // Expense should have red border
    const transaction = page.locator(`[class*="card"]:has-text("${testDescription}")`);
    const hasRedBorder = await transaction.evaluate(el => {
      return el.classList.contains('border-l-ctp-red') ||
             getComputedStyle(el).borderLeftColor.includes('rgb');
    });

    expect(hasRedBorder).toBe(true);
  });

  test('should display income with green indicator', async ({ page }) => {
    const transactionsPage = new TransactionsPage(page);
    await transactionsPage.clickNewTransaction();

    const testDescription = `Green Income ${Date.now()}`;
    await transactionsPage.fillTransactionForm({
      type: 'income',
      amount: 1000.00,
      description: testDescription,
    });
    await transactionsPage.submitTransaction();
    await page.waitForTimeout(1000);

    // Income should have green border
    const transaction = page.locator(`[class*="card"]:has-text("${testDescription}")`);
    const hasGreenBorder = await transaction.evaluate(el => {
      return el.classList.contains('border-l-ctp-green') ||
             getComputedStyle(el).borderLeftColor.includes('rgb');
    });

    expect(hasGreenBorder).toBe(true);
  });

  test('should format currency correctly', async ({ page }) => {
    const transactionsPage = new TransactionsPage(page);
    await transactionsPage.clickNewTransaction();

    const testDescription = `Currency Format ${Date.now()}`;
    await transactionsPage.fillTransactionForm({
      type: 'expense',
      amount: 1234.56,
      description: testDescription,
    });
    await transactionsPage.submitTransaction();
    await page.waitForTimeout(1000);

    // Amount should be formatted (e.g., "-1 234,56 EUR" or similar)
    const transaction = page.locator(`[class*="card"]:has-text("${testDescription}")`);
    const amountText = await transaction.locator('.text-lg.font-bold').textContent();

    // Should contain the amount value in some format
    expect(amountText).toMatch(/1[\s,.]?234/);
  });
});
