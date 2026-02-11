// ============================================================================
// SHARED CONSTANTS - Finance Hub
// ============================================================================

// ----------------------------------------------------------------------------
// Authentication & Security
// ----------------------------------------------------------------------------

export const AUTH = {
  /** Token expiry times in seconds */
  TOKEN_EXPIRY: {
    ACCESS: 15 * 60, // 15 minutes
    REFRESH: 7 * 24 * 60 * 60, // 7 days
    MFA_TEMP: 5 * 60, // 5 minutes
  },

  /** Session settings */
  SESSION: {
    LOCK_TIMEOUT_MINUTES: 10,
    MAX_DEVICES_PER_USER: 10,
  },

  /** Password requirements */
  PASSWORD: {
    MIN_LENGTH: 12,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: true,
  },

  /** Rate limiting */
  RATE_LIMIT: {
    LOGIN_ATTEMPTS: 5,
    LOCKOUT_MINUTES: 15,
    MFA_ATTEMPTS: 3,
  },

  /** MFA settings */
  MFA: {
    TOTP_DIGITS: 6,
    TOTP_PERIOD: 30,
    TOTP_ALGORITHM: 'SHA1' as const,
    BACKUP_CODES_COUNT: 10,
  },
} as const;

// ----------------------------------------------------------------------------
// Workspace & Permissions
// ----------------------------------------------------------------------------

export const WORKSPACE = {
  /** Workspace types */
  TYPES: ['personal', 'family', 'flatshare', 'company'] as const,

  /** Default settings */
  DEFAULTS: {
    FISCAL_YEAR_START: 1, // January
    DATE_FORMAT: 'yyyy-MM-dd',
    DECIMAL_SEPARATOR: '.' as const,
  },

  /** Limits */
  LIMITS: {
    MAX_MEMBERS_PERSONAL: 1,
    MAX_MEMBERS_FAMILY: 10,
    MAX_MEMBERS_FLATSHARE: 20,
    MAX_MEMBERS_COMPANY: 50,
  },
} as const;

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  ACCOUNTANT: 'accountant',
  MEMBER: 'member',
  FAMILY_MEMBER: 'family_member',
  READONLY: 'readonly',
} as const;

/** Role hierarchy (higher index = more permissions) */
export const ROLE_HIERARCHY = [
  ROLES.READONLY,
  ROLES.FAMILY_MEMBER,
  ROLES.MEMBER,
  ROLES.ACCOUNTANT,
  ROLES.ADMIN,
  ROLES.OWNER,
] as const;

/** Permissions by role */
export const PERMISSIONS = {
  // Transaction permissions
  'transaction:read': [ROLES.READONLY, ROLES.FAMILY_MEMBER, ROLES.MEMBER, ROLES.ACCOUNTANT, ROLES.ADMIN, ROLES.OWNER],
  'transaction:create': [ROLES.FAMILY_MEMBER, ROLES.MEMBER, ROLES.ACCOUNTANT, ROLES.ADMIN, ROLES.OWNER],
  'transaction:update': [ROLES.ACCOUNTANT, ROLES.ADMIN, ROLES.OWNER],
  'transaction:delete': [ROLES.ADMIN, ROLES.OWNER],

  // Account permissions
  'account:read': [ROLES.READONLY, ROLES.FAMILY_MEMBER, ROLES.MEMBER, ROLES.ACCOUNTANT, ROLES.ADMIN, ROLES.OWNER],
  'account:create': [ROLES.ADMIN, ROLES.OWNER],
  'account:update': [ROLES.ADMIN, ROLES.OWNER],
  'account:delete': [ROLES.OWNER],

  // Budget permissions
  'budget:read': [ROLES.READONLY, ROLES.FAMILY_MEMBER, ROLES.MEMBER, ROLES.ACCOUNTANT, ROLES.ADMIN, ROLES.OWNER],
  'budget:create': [ROLES.ACCOUNTANT, ROLES.ADMIN, ROLES.OWNER],
  'budget:update': [ROLES.ACCOUNTANT, ROLES.ADMIN, ROLES.OWNER],
  'budget:delete': [ROLES.ADMIN, ROLES.OWNER],

  // Document permissions
  'document:read': [ROLES.READONLY, ROLES.FAMILY_MEMBER, ROLES.MEMBER, ROLES.ACCOUNTANT, ROLES.ADMIN, ROLES.OWNER],
  'document:upload': [ROLES.FAMILY_MEMBER, ROLES.MEMBER, ROLES.ACCOUNTANT, ROLES.ADMIN, ROLES.OWNER],
  'document:delete': [ROLES.ADMIN, ROLES.OWNER],

  // Import permissions
  'import:execute': [ROLES.ACCOUNTANT, ROLES.ADMIN, ROLES.OWNER],

  // Rule permissions
  'rule:read': [ROLES.READONLY, ROLES.FAMILY_MEMBER, ROLES.MEMBER, ROLES.ACCOUNTANT, ROLES.ADMIN, ROLES.OWNER],
  'rule:manage': [ROLES.ACCOUNTANT, ROLES.ADMIN, ROLES.OWNER],

  // Member permissions
  'member:read': [ROLES.READONLY, ROLES.FAMILY_MEMBER, ROLES.MEMBER, ROLES.ACCOUNTANT, ROLES.ADMIN, ROLES.OWNER],
  'member:invite': [ROLES.ADMIN, ROLES.OWNER],
  'member:update': [ROLES.ADMIN, ROLES.OWNER],
  'member:remove': [ROLES.OWNER],

  // Workspace permissions
  'workspace:read': [ROLES.READONLY, ROLES.FAMILY_MEMBER, ROLES.MEMBER, ROLES.ACCOUNTANT, ROLES.ADMIN, ROLES.OWNER],
  'workspace:update': [ROLES.ADMIN, ROLES.OWNER],
  'workspace:delete': [ROLES.OWNER],

  // Pro mode permissions
  'pro:read': [ROLES.READONLY, ROLES.FAMILY_MEMBER, ROLES.MEMBER, ROLES.ACCOUNTANT, ROLES.ADMIN, ROLES.OWNER],
  'pro:manage': [ROLES.ACCOUNTANT, ROLES.ADMIN, ROLES.OWNER],

  // Export permissions (requires step-up auth)
  'export:execute': [ROLES.ACCOUNTANT, ROLES.ADMIN, ROLES.OWNER],
} as const;

// ----------------------------------------------------------------------------
// Account & Transaction
// ----------------------------------------------------------------------------

export const ACCOUNT = {
  TYPES: ['checking', 'savings', 'credit_card', 'cash', 'investment', 'loan'] as const,

  /** Default colors for account types */
  DEFAULT_COLORS: {
    checking: '#3B82F6', // Blue
    savings: '#10B981', // Green
    credit_card: '#EF4444', // Red
    cash: '#F59E0B', // Amber
    investment: '#8B5CF6', // Purple
    loan: '#6B7280', // Gray
  },
} as const;

export const TRANSACTION = {
  TYPES: ['expense', 'income', 'transfer'] as const,
  STATUSES: ['pending', 'cleared', 'reconciled'] as const,
} as const;

// ----------------------------------------------------------------------------
// Budget
// ----------------------------------------------------------------------------

export const BUDGET = {
  PERIODS: ['monthly', 'yearly'] as const,

  /** Default alert threshold percentage */
  DEFAULT_ALERT_THRESHOLD: 80,

  /** Alert thresholds */
  THRESHOLDS: {
    WARNING: 80,
    DANGER: 100,
  },
} as const;

// ----------------------------------------------------------------------------
// Document
// ----------------------------------------------------------------------------

export const DOCUMENT = {
  /** Allowed MIME types */
  ALLOWED_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
  ] as const,

  /** Maximum file size in bytes (10MB) */
  MAX_SIZE: 10 * 1024 * 1024,

  /** Statuses */
  STATUSES: ['inbox', 'linked', 'archived'] as const,
} as const;

// ----------------------------------------------------------------------------
// Import
// ----------------------------------------------------------------------------

export const IMPORT = {
  /** Maximum rows per import */
  MAX_ROWS: 10000,

  /** Supported formats */
  FORMATS: ['csv', 'ofx'] as const,

  /** Common CSV delimiters to try */
  DELIMITERS: [',', ';', '\t'] as const,

  /** Common date formats to try */
  DATE_FORMATS: [
    'yyyy-MM-dd',
    'dd/MM/yyyy',
    'MM/dd/yyyy',
    'dd-MM-yyyy',
    'dd.MM.yyyy',
  ] as const,

  /** Required columns */
  REQUIRED_COLUMNS: ['date', 'amount', 'description'] as const,
} as const;

// ----------------------------------------------------------------------------
// Pro Mode
// ----------------------------------------------------------------------------

export const PRO = {
  /** Contact types */
  CONTACT_TYPES: ['client', 'supplier'] as const,

  /** Quote statuses */
  QUOTE_STATUSES: ['draft', 'sent', 'accepted', 'rejected', 'expired'] as const,

  /** Invoice statuses */
  INVOICE_STATUSES: ['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const,

  /** Default payment terms in days */
  DEFAULT_PAYMENT_TERMS: 30,

  /** VAT rates by country */
  VAT_RATES_BY_COUNTRY: {
    FR: {
      STANDARD: 20,
      INTERMEDIATE: 10,
      REDUCED: 5.5,
      SUPER_REDUCED: 2.1,
      EXEMPT: 0,
    },
    CH: {
      STANDARD: 8.1,
      ACCOMMODATION: 3.8,
      REDUCED: 2.6,
      EXEMPT: 0,
    },
  } as const,

  /** VAT rates (France - legacy, use VAT_RATES_BY_COUNTRY instead) */
  VAT_RATES: {
    STANDARD: 20,
    INTERMEDIATE: 10,
    REDUCED: 5.5,
    SUPER_REDUCED: 2.1,
    EXEMPT: 0,
  } as const,

  /** Business ID types by country */
  BUSINESS_ID_TYPES: {
    FR: { name: 'SIRET', length: 14, pattern: /^\d{14}$/ },
    CH: { name: 'UID', length: 12, pattern: /^CHE[- ]?\d{3}[. ]?\d{3}[. ]?\d{3}$/i },
  } as const,
} as const;

// ----------------------------------------------------------------------------
// Investment
// ----------------------------------------------------------------------------

export const INVEST = {
  /** Asset types */
  ASSET_TYPES: ['stock', 'etf', 'crypto', 'bond', 'real_estate', 'other'] as const,

  /** Transaction types */
  TRANSACTION_TYPES: ['buy', 'sell', 'dividend', 'split'] as const,

  /** Market data update interval in minutes */
  UPDATE_INTERVAL_MINUTES: 15,

  /** Supported data providers */
  PROVIDERS: ['yahoo', 'coingecko'] as const,
} as const;

// ----------------------------------------------------------------------------
// Loans & Debt
// ----------------------------------------------------------------------------

export const LOAN = {
  /** Loan types */
  TYPES: ['debt', 'credit'] as const,
} as const;

// ----------------------------------------------------------------------------
// Currencies
// ----------------------------------------------------------------------------

export const CURRENCIES = {
  EUR: { code: 'EUR', symbol: '€', decimals: 2 },
  USD: { code: 'USD', symbol: '$', decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', decimals: 2 },
  CHF: { code: 'CHF', symbol: 'CHF', decimals: 2 },
  CAD: { code: 'CAD', symbol: 'C$', decimals: 2 },
  JPY: { code: 'JPY', symbol: '¥', decimals: 0 },
} as const;

export const DEFAULT_CURRENCY = 'EUR';

// ----------------------------------------------------------------------------
// Locales
// ----------------------------------------------------------------------------

export const SUPPORTED_LOCALES = [
  'fr-FR', 'fr-CH', 'de-CH', 'it-CH', // French & Swiss
  'en-US', 'en-GB', 'de-DE', 'es-ES', // International
] as const;

/** Default locale (can be overridden by user's country setting) */
export const DEFAULT_LOCALE = 'fr-FR';

/** Default timezone (can be overridden by user's country setting) */
export const DEFAULT_TIMEZONE = 'Europe/Paris';

/** Defaults by country */
export const COUNTRY_DEFAULTS = {
  FR: {
    locale: 'fr-FR',
    timezone: 'Europe/Paris',
    currency: 'EUR',
    dateFormat: 'DD/MM/YYYY',
  },
  CH: {
    locale: 'de-CH',
    timezone: 'Europe/Zurich',
    currency: 'CHF',
    dateFormat: 'DD.MM.YYYY',
  },
} as const;

// ----------------------------------------------------------------------------
// Pagination
// ----------------------------------------------------------------------------

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,
} as const;

// ----------------------------------------------------------------------------
// System Categories (seeded)
// ----------------------------------------------------------------------------

export const SYSTEM_CATEGORIES = {
  expense: [
    { name: 'Alimentation', icon: '🍔' },
    { name: 'Transport', icon: '🚗' },
    { name: 'Logement', icon: '🏠' },
    { name: 'Santé', icon: '🏥' },
    { name: 'Loisirs', icon: '🎮' },
    { name: 'Shopping', icon: '🛍️' },
    { name: 'Services', icon: '📱' },
    { name: 'Éducation', icon: '📚' },
    { name: 'Voyages', icon: '✈️' },
    { name: 'Autres dépenses', icon: '📦' },
  ],
  income: [
    { name: 'Salaire', icon: '💼' },
    { name: 'Freelance', icon: '💻' },
    { name: 'Investissements', icon: '📈' },
    { name: 'Allocations', icon: '🏛️' },
    { name: 'Remboursements', icon: '💰' },
    { name: 'Autres revenus', icon: '💵' },
  ],
} as const;
