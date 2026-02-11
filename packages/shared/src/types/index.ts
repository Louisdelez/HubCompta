// ============================================================================
// SHARED TYPES - Finance Hub
// ============================================================================

// ----------------------------------------------------------------------------
// Base Types
// ----------------------------------------------------------------------------

export type UUID = string;

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

export interface SoftDeletable {
  deletedAt: Date | null;
}

// ----------------------------------------------------------------------------
// User & Authentication Types
// ----------------------------------------------------------------------------

export interface User extends Timestamps {
  id: UUID;
  email: string;
  displayName: string;
  passwordHash: string;
  locale: string;
  timezone: string;
  isInstanceAdmin: boolean;
}

export type MFAType = 'totp' | 'webauthn';

export interface MFA extends Timestamps {
  id: UUID;
  userId: UUID;
  type: MFAType;
  name: string;
  secret: string;
  isEnabled: boolean;
  usedAt: Date | null;
}

export interface Device extends Timestamps {
  id: UUID;
  userId: UUID;
  fingerprint: string;
  name: string;
  lastUsedAt: Date;
  isTrusted: boolean;
}

export interface Session extends Timestamps {
  id: UUID;
  userId: UUID;
  deviceId: UUID;
  tokenHash: string;
  isLocked: boolean;
  lockedAt: Date | null;
  expiresAt: Date;
}

// ----------------------------------------------------------------------------
// Workspace & Membership Types
// ----------------------------------------------------------------------------

export type WorkspaceType = 'personal' | 'family' | 'flatshare' | 'company';

export interface Workspace extends Timestamps, SoftDeletable {
  id: UUID;
  name: string;
  type: WorkspaceType;
  currency: string;
  ownerId: UUID;
  settings: WorkspaceSettings;
}

export interface WorkspaceSettings {
  fiscalYearStart: number; // Month 1-12
  dateFormat: string;
  decimalSeparator: '.' | ',';
  enableProMode: boolean;
  enableInvestMode: boolean;
}

export type MembershipRole = 'owner' | 'admin' | 'accountant' | 'member' | 'family_member' | 'readonly';

export interface Membership extends Timestamps {
  id: UUID;
  workspaceId: UUID;
  userId: UUID;
  role: MembershipRole;
  // Family sharing fields
  spendingLimit: number | null;
  approvalRequired: boolean;
  visibleCategories: string[];
}

// ----------------------------------------------------------------------------
// Account & Transaction Types
// ----------------------------------------------------------------------------

export type AccountType = 'checking' | 'savings' | 'credit_card' | 'cash' | 'investment' | 'loan';

export interface Account extends Timestamps, SoftDeletable {
  id: UUID;
  workspaceId: UUID;
  name: string;
  type: AccountType;
  currency: string;
  balance: number;
  icon: string | null;
  color: string | null;
  isArchived: boolean;
}

export type TransactionType = 'expense' | 'income' | 'transfer';
export type TransactionStatus = 'pending' | 'cleared' | 'reconciled';

export interface Transaction extends Timestamps, SoftDeletable {
  id: UUID;
  workspaceId: UUID;
  accountId: UUID;
  type: TransactionType;
  amount: number;
  currency: string;
  date: Date;
  description: string;
  notes: string | null;
  categoryId: UUID | null;
  status: TransactionStatus;
  isRecurring: boolean;
  recurrenceId: UUID | null;
  importHash: string | null;
  transferPairId: UUID | null;
}

// ----------------------------------------------------------------------------
// Category & Tag Types
// ----------------------------------------------------------------------------

export type CategoryType = 'expense' | 'income';

export interface Category extends Timestamps {
  id: UUID;
  workspaceId: UUID;
  parentId: UUID | null;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  isSystem: boolean;
}

export interface Tag extends Timestamps {
  id: UUID;
  workspaceId: UUID;
  name: string;
  color: string | null;
}

// ----------------------------------------------------------------------------
// Budget Types
// ----------------------------------------------------------------------------

export type BudgetPeriod = 'monthly' | 'yearly';

export interface Budget extends Timestamps {
  id: UUID;
  workspaceId: UUID;
  categoryId: UUID;
  name: string;
  amount: number;
  period: BudgetPeriod;
  alertThreshold: number; // Percentage 0-100
  startDate: Date;
  endDate: Date | null;
}

// ----------------------------------------------------------------------------
// Document Types
// ----------------------------------------------------------------------------

export type DocumentStatus = 'inbox' | 'linked' | 'archived';

export interface Document extends Timestamps, SoftDeletable {
  id: UUID;
  workspaceId: UUID;
  uploaderId: UUID;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  hash: string;
  status: DocumentStatus;
  isVault: boolean;
  encryptedKey: string | null;
}

export interface DocumentLink extends Timestamps {
  id: UUID;
  documentId: UUID;
  transactionId: UUID;
}

// ----------------------------------------------------------------------------
// Rule Types
// ----------------------------------------------------------------------------

export type RuleOperator = 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex';

export interface RuleCondition {
  field: 'description' | 'amount' | 'date';
  operator: RuleOperator;
  value: string;
}

export interface RuleAction {
  type: 'set_category' | 'add_tag' | 'set_notes';
  value: string;
}

export interface Rule extends Timestamps {
  id: UUID;
  workspaceId: UUID;
  name: string;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  isEnabled: boolean;
}

// ----------------------------------------------------------------------------
// Import Types
// ----------------------------------------------------------------------------

export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ImportJob extends Timestamps {
  id: UUID;
  workspaceId: UUID;
  accountId: UUID;
  userId: UUID;
  filename: string;
  status: ImportStatus;
  totalRows: number;
  processedRows: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  columnMapping: Record<string, string>;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  message: string;
}

// ----------------------------------------------------------------------------
// Pro Mode Types
// ----------------------------------------------------------------------------

export type ContactType = 'client' | 'supplier';

export interface Contact extends Timestamps, SoftDeletable {
  id: UUID;
  workspaceId: UUID;
  type: ContactType;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  siret: string | null;
  vatNumber: string | null;
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface Quote extends Timestamps, SoftDeletable {
  id: UUID;
  workspaceId: UUID;
  contactId: UUID;
  number: string;
  status: QuoteStatus;
  issueDate: Date;
  validUntil: Date;
  subtotal: number;
  vatAmount: number;
  total: number;
  notes: string | null;
}

export interface Invoice extends Timestamps, SoftDeletable {
  id: UUID;
  workspaceId: UUID;
  contactId: UUID;
  quoteId: UUID | null;
  number: string;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  subtotal: number;
  vatAmount: number;
  total: number;
  paidAmount: number;
  paidAt: Date | null;
  notes: string | null;
  linkedTransactionId: UUID | null;
}

export interface InvoiceLine extends Timestamps {
  id: UUID;
  invoiceId: UUID | null;
  quoteId: UUID | null;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  total: number;
}

// ----------------------------------------------------------------------------
// Investment Types
// ----------------------------------------------------------------------------

export type AssetType = 'stock' | 'etf' | 'crypto' | 'bond' | 'real_estate' | 'other';

export interface Asset extends Timestamps {
  id: UUID;
  symbol: string;
  name: string;
  type: AssetType;
  currency: string;
  exchange: string | null;
  lastPrice: number | null;
  lastPriceAt: Date | null;
}

export interface Position extends Timestamps {
  id: UUID;
  workspaceId: UUID;
  accountId: UUID;
  assetId: UUID;
  quantity: number;
  averageCost: number;
  realizedGain: number;
}

export type InvestTransactionType = 'buy' | 'sell' | 'dividend' | 'split';

export interface InvestTransaction extends Timestamps {
  id: UUID;
  positionId: UUID;
  type: InvestTransactionType;
  quantity: number;
  price: number;
  fees: number;
  date: Date;
  notes: string | null;
}

export interface Watchlist extends Timestamps {
  id: UUID;
  workspaceId: UUID;
  name: string;
}

export interface WatchlistItem extends Timestamps {
  id: UUID;
  watchlistId: UUID;
  assetId: UUID;
  alertAbove: number | null;
  alertBelow: number | null;
}

// ----------------------------------------------------------------------------
// Audit Log Types
// ----------------------------------------------------------------------------

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditLog extends Timestamps {
  id: UUID;
  userId: UUID | null;
  workspaceId: UUID | null;
  action: string;
  entityType: string | null;
  entityId: UUID | null;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  severity: AuditSeverity;
}

// ----------------------------------------------------------------------------
// API Response Types
// ----------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// Auth Types
// ----------------------------------------------------------------------------

export interface LoginRequest {
  email: string;
  password: string;
  deviceFingerprint: string;
  deviceName: string;
}

export interface LoginResponse {
  requiresMfa: boolean;
  mfaMethods?: MFAType[];
  tempToken?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface MfaVerifyRequest {
  tempToken: string;
  code: string;
  type: MFAType;
}

export interface TokenPayload {
  sub: UUID;
  email: string;
  deviceId: UUID;
  workspaceId?: UUID;
  role?: MembershipRole;
  iat: number;
  exp: number;
}
