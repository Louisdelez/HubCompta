// ============================================================================
// PAGE OBJECTS - E2E Test Page Objects
// Encapsulates page interactions for cleaner tests
// ============================================================================

import { Page, Locator, expect } from '@playwright/test';

// ----------------------------------------------------------------------------
// Base Page
// ----------------------------------------------------------------------------

export abstract class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async getTitle(): Promise<string | null> {
    return this.page.title();
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `screenshots/${name}.png` });
  }
}

// ----------------------------------------------------------------------------
// Navigation Component
// ----------------------------------------------------------------------------

export class NavigationComponent {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigateTo(route: string) {
    await this.page.goto(route);
    await this.page.waitForLoadState('networkidle');
  }

  async clickNavLink(text: string) {
    await this.page.click(`nav a:has-text("${text}")`);
    await this.page.waitForLoadState('networkidle');
  }

  async isActive(text: string): Promise<boolean> {
    const link = this.page.locator(`nav a:has-text("${text}")`);
    const classes = await link.getAttribute('class');
    return classes?.includes('active') ?? false;
  }
}

// ----------------------------------------------------------------------------
// Login Page
// ----------------------------------------------------------------------------

export class LoginPage extends BasePage {
  private emailInput: Locator;
  private passwordInput: Locator;
  private submitButton: Locator;
  private errorMessage: Locator;
  private registerLink: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('[class*="ctp-red"]').first();
    this.registerLink = page.locator('a[href="/register"]');
  }

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForSelector('form');
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async submit() {
    await this.submitButton.click();
  }

  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  async getError(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return this.errorMessage.textContent();
    }
    return null;
  }

  async goToRegister() {
    await this.registerLink.click();
    await this.page.waitForURL('**/register');
  }

  async expectOnLoginPage() {
    await expect(this.page).toHaveURL(/\/login/);
  }
}

// ----------------------------------------------------------------------------
// Register Page
// ----------------------------------------------------------------------------

export class RegisterPage extends BasePage {
  private displayNameInput: Locator;
  private emailInput: Locator;
  private passwordInput: Locator;
  private confirmPasswordInput: Locator;
  private submitButton: Locator;
  private errorMessage: Locator;
  private successMessage: Locator;
  private loginLink: Locator;

  constructor(page: Page) {
    super(page);
    this.displayNameInput = page.locator('input#displayName');
    this.emailInput = page.locator('input#email');
    this.passwordInput = page.locator('input#password');
    this.confirmPasswordInput = page.locator('input#confirmPassword');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('[class*="ctp-red"]').first();
    this.successMessage = page.locator('text=Compte cree');
    this.loginLink = page.locator('a[href="/login"]');
  }

  async goto() {
    await this.page.goto('/register');
    await this.page.waitForSelector('form');
  }

  async fillDisplayName(name: string) {
    await this.displayNameInput.fill(name);
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async fillConfirmPassword(password: string) {
    await this.confirmPasswordInput.fill(password);
  }

  async submit() {
    await this.submitButton.click();
  }

  async register(displayName: string, email: string, password: string) {
    await this.fillDisplayName(displayName);
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.fillConfirmPassword(password);
    await this.submit();
  }

  async getError(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return this.errorMessage.textContent();
    }
    return null;
  }

  async isSuccess(): Promise<boolean> {
    return this.successMessage.isVisible();
  }

  async goToLogin() {
    await this.loginLink.click();
    await this.page.waitForURL('**/login');
  }
}

// ----------------------------------------------------------------------------
// Dashboard Page
// ----------------------------------------------------------------------------

export class DashboardPage extends BasePage {
  private heading: Locator;
  private summaryCards: Locator;
  private recentTransactions: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator('h1').first();
    this.summaryCards = page.locator('[class*="card"]');
    this.recentTransactions = page.locator('[data-testid="recent-transactions"]').or(
      page.locator('text=Transactions récentes').locator('..')
    );
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.waitForPageLoad();
  }

  async getHeadingText(): Promise<string | null> {
    return this.heading.textContent();
  }

  async getSummaryCardCount(): Promise<number> {
    return this.summaryCards.count();
  }

  async expectOnDashboard() {
    await expect(this.page).toHaveURL(/\/dashboard/);
  }
}

// ----------------------------------------------------------------------------
// Transactions Page
// ----------------------------------------------------------------------------

export class TransactionsPage extends BasePage {
  private heading: Locator;
  private newTransactionButton: Locator;
  private searchInput: Locator;
  private searchButton: Locator;
  private transactionList: Locator;
  private emptyState: Locator;
  private transactionForm: Locator;
  private formModal: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator('h1:has-text("Transactions")');
    this.newTransactionButton = page.locator('button:has-text("Nouvelle transaction")');
    this.searchInput = page.locator('input[placeholder*="Rechercher"]');
    this.searchButton = page.locator('button:has-text("Rechercher")');
    this.transactionList = page.locator('[class*="card"]');
    this.emptyState = page.locator('text=Aucune transaction');
    this.transactionForm = page.locator('form');
    this.formModal = page.locator('.fixed.inset-0');
  }

  async goto() {
    await this.page.goto('/transactions');
    await this.waitForPageLoad();
  }

  async openNewTransactionForm() {
    await this.newTransactionButton.click();
    await this.page.waitForSelector('form', { timeout: 5000 });
  }

  async searchTransactions(query: string) {
    await this.searchInput.fill(query);
    await this.searchButton.click();
    await this.page.waitForTimeout(500);
  }

  async clearSearch() {
    await this.searchInput.fill('');
    await this.searchButton.click();
    await this.page.waitForTimeout(500);
  }

  async selectTransactionType(type: 'expense' | 'income') {
    const buttonText = type === 'expense' ? 'Depense' : 'Revenu';
    await this.page.click(`button:has-text("${buttonText}")`);
  }

  async fillAmount(amount: number) {
    await this.page.fill('input#amount', amount.toString());
  }

  async fillDescription(description: string) {
    await this.page.fill('input#description', description);
  }

  async selectFirstAccount() {
    const accountSelect = this.page.locator('select#accountId');
    const options = await accountSelect.locator('option').all();
    if (options.length > 1) {
      const firstOption = await options[1].getAttribute('value');
      if (firstOption) {
        await accountSelect.selectOption(firstOption);
      }
    }
  }

  async submitTransaction() {
    await this.page.click('button[type="submit"]:has-text("Créer"), button[type="submit"]:has-text("Enregistrer")');
  }

  async cancelTransaction() {
    await this.page.click('button:has-text("Annuler")');
  }

  async clickTransaction(description: string) {
    await this.page.click(`[class*="card"]:has-text("${description}")`);
    await this.page.waitForSelector('form', { timeout: 5000 });
  }

  async deleteCurrentTransaction() {
    this.page.on('dialog', dialog => dialog.accept());
    await this.page.click('button:has-text("Supprimer")');
  }

  async getTransactionCount(): Promise<number> {
    const countText = await this.page.locator('text=/\\d+ transactions?/').textContent();
    const match = countText?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async isTransactionVisible(description: string): Promise<boolean> {
    return this.page.locator(`text=${description}`).isVisible();
  }

  async expectOnTransactionsPage() {
    await expect(this.page).toHaveURL(/\/transactions/);
  }
}

// ----------------------------------------------------------------------------
// Workspace Selector Component
// ----------------------------------------------------------------------------

export class WorkspaceSelectorComponent {
  private page: Page;
  private selectorButton: Locator;
  private dropdown: Locator;
  private createButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.selectorButton = page.locator('button').filter({
      has: page.locator('svg.w-5.h-5'),
    }).first();
    this.dropdown = page.locator('[class*="dropdown"], .absolute.left-0.right-0');
    this.createButton = page.locator('button:has-text("Créer un espace")');
  }

  async open() {
    if (await this.selectorButton.count() > 0) {
      await this.selectorButton.click();
      await this.page.waitForTimeout(300);
    }
  }

  async close() {
    await this.page.keyboard.press('Escape');
  }

  async selectWorkspace(name: string) {
    await this.open();
    await this.page.click(`button:has-text("${name}")`);
  }

  async clickCreate() {
    await this.open();
    await this.createButton.click();
    await this.page.waitForSelector('form', { timeout: 5000 });
  }

  async getCurrentWorkspaceName(): Promise<string | null> {
    if (await this.selectorButton.count() > 0) {
      return this.selectorButton.textContent();
    }
    return null;
  }
}

// ----------------------------------------------------------------------------
// Create Workspace Modal
// ----------------------------------------------------------------------------

export class CreateWorkspaceModal {
  private page: Page;
  private modal: Locator;
  private nameInput: Locator;
  private currencySelect: Locator;
  private submitButton: Locator;
  private cancelButton: Locator;
  private errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator('.fixed.inset-0');
    this.nameInput = page.locator('input#name');
    this.currencySelect = page.locator('select#currency');
    this.submitButton = page.locator('button[type="submit"]:has-text("Créer")');
    this.cancelButton = page.locator('button:has-text("Annuler")');
    this.errorMessage = page.locator('[class*="ctp-red"]').first();
  }

  async selectType(type: 'personal' | 'family' | 'flatshare' | 'company') {
    const typeLabels: Record<string, string> = {
      personal: 'Personnel',
      family: 'Famille',
      flatshare: 'Colocation',
      company: 'Entreprise',
    };
    await this.page.click(`label:has-text("${typeLabels[type]}")`);
  }

  async fillName(name: string) {
    await this.nameInput.fill(name);
  }

  async selectCurrency(currency: string) {
    await this.currencySelect.selectOption(currency);
  }

  async submit() {
    await this.submitButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }

  async createWorkspace(name: string, type: 'personal' | 'family' | 'flatshare' | 'company' = 'personal', currency = 'EUR') {
    await this.selectType(type);
    await this.fillName(name);
    await this.selectCurrency(currency);
    await this.submit();
  }

  async getError(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return this.errorMessage.textContent();
    }
    return null;
  }

  async isOpen(): Promise<boolean> {
    return this.page.locator('h2:has-text("Créer un espace")').isVisible();
  }
}
