// ============================================================================
// I18N TYPES - Finance Hub
// TypeScript interfaces for internationalization
// ============================================================================

// ----------------------------------------------------------------------------
// Language Codes
// ----------------------------------------------------------------------------

export type LanguageCode = 'en' | 'fr' | 'de' | 'es' | 'it' | 'pt' | 'nl' | 'pl' | 'ro' | 'ru';

export const SUPPORTED_LANGUAGES: readonly LanguageCode[] = [
  'en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'pl', 'ro', 'ru'
] as const;

export const DEFAULT_LANGUAGE: LanguageCode = 'en';
export const FALLBACK_LANGUAGE: LanguageCode = 'en';

// ----------------------------------------------------------------------------
// Language Metadata
// ----------------------------------------------------------------------------

export interface LanguageMetadata {
  code: LanguageCode;
  name: string;           // English name
  nativeName: string;     // Native name
  direction: 'ltr' | 'rtl';
  region: 'western' | 'eastern' | 'northern' | 'southern';
  flag: string;           // Flag emoji
  dateFormat: string;     // Default date format
  numberFormat: {
    decimal: string;
    thousands: string;
  };
}

// ----------------------------------------------------------------------------
// Namespace Types
// ----------------------------------------------------------------------------

export type TranslationNamespace =
  | 'common'
  | 'errors'
  | 'notifications'
  | 'email'
  | 'achievements'
  | 'features';

export const TRANSLATION_NAMESPACES: readonly TranslationNamespace[] = [
  'common',
  'errors',
  'notifications',
  'email',
  'achievements',
  'features',
] as const;

// ----------------------------------------------------------------------------
// Translation Key Types
// ----------------------------------------------------------------------------

// Common namespace keys
export interface CommonTranslations {
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  create: string;
  add: string;
  close: string;
  confirm: string;
  back: string;
  next: string;
  previous: string;
  search: string;
  filter: string;
  export: string;
  import: string;
  loading: string;
  noData: string;
  error: string;
  success: string;
  warning: string;
  info: string;
  yes: string;
  no: string;
  all: string;
  none: string;
  select: string;
  reset: string;
  apply: string;
  refresh: string;
  view: string;
  download: string;
  upload: string;
  submit: string;
  actions: string;
  status: string;
  date: string;
  amount: string;
  description: string;
  name: string;
  type: string;
  category: string;
  total: string;
  balance: string;
  from: string;
  to: string;
  or: string;
  and: string;
  of: string;
  day: string;
  days: string;
  week: string;
  weeks: string;
  month: string;
  months: string;
  year: string;
  years: string;
  hour: string;
  hours: string;
  minute: string;
  minutes: string;
}

// Error namespace keys
export interface ErrorTranslations {
  generic: string;
  network: string;
  unauthorized: string;
  forbidden: string;
  notFound: string;
  serverError: string;
  validation: string;
  required: string;
  invalidEmail: string;
  invalidPassword: string;
  passwordMismatch: string;
  minLength: string;
  maxLength: string;
  invalidFormat: string;
  alreadyExists: string;
  notAllowed: string;
  expired: string;
  tooManyRequests: string;
  sessionLocked: string;
  mfaRequired: string;
  invalidToken: string;
  internalError: string;
  resourceNotFound: string;
  conflictError: string;
}

// Notification namespace keys
export interface NotificationTranslations {
  title: string;
  markAllRead: string;
  noNotifications: string;
  viewAll: string;
  budgetExceeded: string;
  budgetWarning: string;
  importComplete: string;
  importCompleteWithErrors: string;
  exportReady: string;
  invoiceOverdue: string;
  invoicePaid: string;
  quoteAccepted: string;
  quoteExpiring: string;
  priceAlert: string;
  billReminder: string;
  unusualSpending: string;
  weeklySummary: string;
  monthlyReport: string;
  lowBalance: string;
  billUpcoming: string;
  achievementUnlocked: string;
  levelUp: string;
}

// Email namespace keys
export interface EmailTranslations {
  greeting: string;
  footer: string;
  footerIgnore: string;
  welcome: {
    subject: string;
    title: string;
    intro: string;
    features: {
      tracking: string;
      budgets: string;
      reports: string;
      invoicing: string;
    };
    cta: string;
    closing: string;
  };
  passwordReset: {
    subject: string;
    title: string;
    intro: string;
    cta: string;
    expiry: string;
    ignoreNote: string;
  };
  invoiceOverdue: {
    subject: string;
    title: string;
    intro: string;
    invoiceNumber: string;
    client: string;
    amount: string;
    dueDate: string;
    cta: string;
    recommendation: string;
  };
  budgetAlert: {
    subject: string;
    subjectExceeded: string;
    titleExceeded: string;
    titleWarning: string;
    messageExceeded: string;
    messageWarning: string;
    budget: string;
    category: string;
    spent: string;
    limit: string;
    usage: string;
    cta: string;
  };
  exportReady: {
    subject: string;
    title: string;
    intro: string;
    exportType: string;
    filename: string;
    expiresAt: string;
    cta: string;
    expiryNote: string;
  };
  weeklySummary: {
    subject: string;
    title: string;
    intro: string;
    income: string;
    expenses: string;
    balance: string;
    topCategories: string;
    budgetAlerts: string;
    cta: string;
  };
}

// Achievement namespace keys
export interface AchievementTranslations {
  title: string;
  secretAchievement: string;
  unlocked: string;
  progress: string;
  xpReward: string;
  level: string;
  levelUp: string;
  congratulations: string;
  categories: {
    onboarding: string;
    transactions: string;
    budgeting: string;
    savings: string;
    streaks: string;
    milestones: string;
  };
  achievements: {
    first_steps: { name: string; description: string };
    first_budget: { name: string; description: string };
    first_goal: { name: string; description: string };
    account_setup: { name: string; description: string };
    tracker_10: { name: string; description: string };
    tracker_50: { name: string; description: string };
    tracker_100: { name: string; description: string };
    tracker_500: { name: string; description: string };
    categorizer: { name: string; description: string };
    budget_keeper: { name: string; description: string };
    budget_master_3: { name: string; description: string };
    budget_master_6: { name: string; description: string };
    multi_budget: { name: string; description: string };
    saver_first: { name: string; description: string };
    saver_half: { name: string; description: string };
    saver_complete: { name: string; description: string };
    saver_3_goals: { name: string; description: string };
    saver_1000: { name: string; description: string };
    saver_10000: { name: string; description: string };
    streak_7: { name: string; description: string };
    streak_30: { name: string; description: string };
    streak_100: { name: string; description: string };
    streak_365: { name: string; description: string };
    night_owl: { name: string; description: string };
    early_bird: { name: string; description: string };
    perfect_month: { name: string; description: string };
  };
}

// Features namespace (frontend specific)
export interface FeatureTranslations {
  navigation: {
    dashboard: string;
    transactions: string;
    accounts: string;
    budgets: string;
    savings: string;
    loans: string;
    investments: string;
    netWorth: string;
    documents: string;
    banking: string;
    recurrences: string;
    scheduled: string;
    bills: string;
    settlement: string;
    forecast: string;
    tax: string;
    import: string;
    export: string;
    rules: string;
    ai: string;
    reports: string;
    currencies: string;
    search: string;
    achievements: string;
    activity: string;
    settings: string;
    administration: string;
    logout: string;
    skipToMain: string;
  };
  auth: {
    login: string;
    register: string;
    logout: string;
    email: string;
    password: string;
    confirmPassword: string;
    forgotPassword: string;
    resetPassword: string;
    rememberMe: string;
    signIn: string;
    signUp: string;
    createAccount: string;
    alreadyHaveAccount: string;
    dontHaveAccount: string;
    displayName: string;
    authenticating: string;
  };
  dashboard: {
    title: string;
    welcome: string;
    overview: string;
    recentTransactions: string;
    upcomingBills: string;
    budgetStatus: string;
    netWorth: string;
    monthlyIncome: string;
    monthlyExpenses: string;
    savings: string;
    thisMonth: string;
    lastMonth: string;
    thisYear: string;
    customRange: string;
    income: string;
    expenses: string;
    noUpcomingBills: string;
    viewAll: string;
  };
  transactions: {
    title: string;
    newTransaction: string;
    addTransaction: string;
    editTransaction: string;
    deleteTransaction: string;
    transactionDetails: string;
    income: string;
    expense: string;
    transfer: string;
    date: string;
    amount: string;
    category: string;
    account: string;
    payee: string;
    notes: string;
    tags: string;
    recurring: string;
    pending: string;
    cleared: string;
    reconciled: string;
    filterByAccount: string;
    filterByCategory: string;
    filterByDate: string;
    noTransactions: string;
    confirmDelete: string;
  };
  accounts: {
    title: string;
    newAccount: string;
    addAccount: string;
    editAccount: string;
    deleteAccount: string;
    accountDetails: string;
    accountName: string;
    accountType: string;
    initialBalance: string;
    currentBalance: string;
    currency: string;
    checking: string;
    savings: string;
    creditCard: string;
    cash: string;
    investment: string;
    loan: string;
    asset: string;
    liability: string;
    institution: string;
    accountNumber: string;
    noAccounts: string;
    confirmDelete: string;
    totalBalance: string;
  };
  budgets: {
    title: string;
    newBudget: string;
    addBudget: string;
    editBudget: string;
    deleteBudget: string;
    budgetName: string;
    budgetAmount: string;
    spent: string;
    remaining: string;
    overBudget: string;
    onTrack: string;
    period: string;
    monthly: string;
    weekly: string;
    yearly: string;
    categories: string;
    noBudgets: string;
    progress: string;
    percentUsed: string;
  };
  settings: {
    title: string;
    manageAccount: string;
    backToDashboard: string;
    profile: {
      title: string;
      description: string;
    };
    display: {
      title: string;
      description: string;
      theme: string;
      themeDescription: string;
      activeTheme: string;
      automatic: string;
      systemTheme: string;
      compactMode: string;
      compactModeDescription: string;
      showBalance: string;
      showBalanceDescription: string;
      defaultCurrency: string;
      dateFormat: string;
      numberFormat: string;
      startOfWeek: string;
      monday: string;
      sunday: string;
    };
    notifications: {
      title: string;
      description: string;
    };
    security: {
      title: string;
      description: string;
    };
    audit: {
      title: string;
      description: string;
    };
    data: {
      title: string;
      description: string;
    };
    privacy: {
      title: string;
      description: string;
      hideAmounts: string;
      hideAmountsDescription: string;
      lockOnInactivity: string;
      lockOnInactivityDescription: string;
      inactivityTimeout: string;
      sessionTimeout: string;
    };
    help: {
      title: string;
      description: string;
    };
    language: {
      title: string;
      description: string;
      select: string;
      current: string;
    };
    workspace: {
      title: string;
      description: string;
      manage: string;
    };
  };
  workspace: {
    title: string;
    create: string;
    select: string;
    switch: string;
    members: string;
    settings: string;
    noWorkspace: string;
  };
  confirmation: {
    delete: string;
    unsavedChanges: string;
    logout: string;
  };
  time: {
    today: string;
    yesterday: string;
    tomorrow: string;
    thisWeek: string;
    lastWeek: string;
    thisMonth: string;
    lastMonth: string;
    thisYear: string;
    lastYear: string;
  };
  notFoundPage: {
    title: string;
    message: string;
  };
}

// ----------------------------------------------------------------------------
// Complete Translation Structure
// ----------------------------------------------------------------------------

export interface Translations {
  common: CommonTranslations;
  errors: ErrorTranslations;
  notifications: NotificationTranslations;
  email: EmailTranslations;
  achievements: AchievementTranslations;
  features: FeatureTranslations;
}

// ----------------------------------------------------------------------------
// Translation Function Types
// ----------------------------------------------------------------------------

export type TranslateFunction = (
  key: string,
  options?: Record<string, string | number>
) => string;

export interface I18nContext {
  t: TranslateFunction;
  locale: LanguageCode;
  changeLocale: (locale: LanguageCode) => Promise<void>;
}
