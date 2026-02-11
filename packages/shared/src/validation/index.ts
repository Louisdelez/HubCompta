// ============================================================================
// SHARED VALIDATION SCHEMAS - Finance Hub (Zod)
// ============================================================================

import { z } from 'zod';
import { AUTH, WORKSPACE, ACCOUNT, TRANSACTION, BUDGET, DOCUMENT, PRO, INVEST, LOAN } from '../constants/index.js';

// ----------------------------------------------------------------------------
// Base Schemas
// ----------------------------------------------------------------------------

export const uuidSchema = z.string().uuid();

// Helper for optional date fields that accepts null, undefined, or empty string
const optionalDateSchema = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : val),
  z.coerce.date().nullable()
).optional();

// Helper for optional hex color fields
const optionalColorSchema = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : val),
  z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable()
).optional();

// Helper for optional UUID fields
const optionalUuidSchema = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : val),
  z.string().uuid().nullable()
).optional();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const dateRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
}).refine((data) => data.from <= data.to, {
  message: 'Start date must be before or equal to end date',
});

// ----------------------------------------------------------------------------
// Auth Schemas
// ----------------------------------------------------------------------------

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

export const passwordSchema = z
  .string()
  .min(AUTH.PASSWORD.MIN_LENGTH, `Password must be at least ${AUTH.PASSWORD.MIN_LENGTH} characters`)
  .max(AUTH.PASSWORD.MAX_LENGTH, `Password must be at most ${AUTH.PASSWORD.MAX_LENGTH} characters`)
  .regex(passwordRegex, 'Password must contain uppercase, lowercase, number, and special character');

export const emailSchema = z.string().email('Invalid email address').toLowerCase().trim();

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().min(2).max(100).trim(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  deviceFingerprint: z.string().min(1),
  deviceName: z.string().min(1).max(100),
});

export const mfaVerifySchema = z.object({
  tempToken: z.string().min(1),
  code: z.string().length(AUTH.MFA.TOTP_DIGITS),
  type: z.enum(['totp', 'webauthn']),
});

export const mfaSetupSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['totp', 'webauthn']),
});

export const totpVerifySchema = z.object({
  code: z.string().length(AUTH.MFA.TOTP_DIGITS),
  secret: z.string().min(1),
});

// ----------------------------------------------------------------------------
// User Schemas
// ----------------------------------------------------------------------------

export const userUpdateSchema = z.object({
  displayName: z.string().min(2).max(100).trim().optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
});

// ----------------------------------------------------------------------------
// Workspace Schemas
// ----------------------------------------------------------------------------

export const workspaceTypeSchema = z.enum(WORKSPACE.TYPES);

export const workspaceCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  type: workspaceTypeSchema,
  currency: z.string().length(3).toUpperCase().default('EUR'),
});

export const workspaceUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  settings: z.object({
    fiscalYearStart: z.number().int().min(1).max(12).optional(),
    dateFormat: z.string().optional(),
    decimalSeparator: z.enum(['.', ',']).optional(),
    enableProMode: z.boolean().optional(),
    enableInvestMode: z.boolean().optional(),
  }).optional(),
});

export const memberRoleSchema = z.enum(['owner', 'admin', 'accountant', 'member', 'family_member', 'readonly']);

export const memberInviteSchema = z.object({
  email: emailSchema,
  role: memberRoleSchema.refine((role) => role !== 'owner', {
    message: 'Cannot invite as owner',
  }),
});

export const memberUpdateSchema = z.object({
  role: memberRoleSchema.refine((role) => role !== 'owner', {
    message: 'Cannot change role to owner',
  }),
});

// Family invite schema with spending controls
export const familyInviteSchema = z.object({
  email: emailSchema,
  displayName: z.string().min(1).max(100).trim().optional(),
  role: memberRoleSchema.refine((role) => role !== 'owner', {
    message: 'Cannot invite as owner',
  }),
  spendingLimit: z.number().positive().optional().nullable(),
  approvalRequired: z.boolean().optional(),
  visibleCategories: z.array(z.string().uuid()).optional(),
});

// Member family settings update schema
export const memberFamilySettingsSchema = z.object({
  spendingLimit: z.number().positive().optional().nullable(),
  approvalRequired: z.boolean().optional(),
  visibleCategories: z.array(z.string().uuid()).optional(),
});

// ----------------------------------------------------------------------------
// Account Schemas
// ----------------------------------------------------------------------------

export const accountTypeSchema = z.enum(ACCOUNT.TYPES);

export const accountCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  type: accountTypeSchema,
  currency: z.string().length(3).toUpperCase().default('EUR'),
  initialBalance: z.number().default(0),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const accountUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  icon: z.string().max(10).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  isArchived: z.boolean().optional(),
});

// ----------------------------------------------------------------------------
// Transaction Schemas
// ----------------------------------------------------------------------------

export const transactionTypeSchema = z.enum(TRANSACTION.TYPES);
export const transactionStatusSchema = z.enum(TRANSACTION.STATUSES);

export const transactionCreateSchema = z.object({
  accountId: uuidSchema,
  type: transactionTypeSchema,
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3).toUpperCase().default('EUR'),
  date: z.coerce.date(),
  description: z.string().min(1).max(500).trim(),
  notes: z.string().max(2000).optional().nullable(),
  categoryId: uuidSchema.optional().nullable(),
  tagIds: z.array(uuidSchema).optional(),
  status: transactionStatusSchema.default('pending'),
});

export const transactionUpdateSchema = z.object({
  type: transactionTypeSchema.optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  date: z.coerce.date().optional(),
  description: z.string().min(1).max(500).trim().optional(),
  notes: z.string().max(2000).optional().nullable(),
  categoryId: uuidSchema.optional().nullable(),
  tagIds: z.array(uuidSchema).optional(),
  status: transactionStatusSchema.optional(),
});

export const transferCreateSchema = z.object({
  fromAccountId: uuidSchema,
  toAccountId: uuidSchema,
  amount: z.number().positive('Amount must be positive'),
  date: z.coerce.date(),
  description: z.string().min(1).max(500).trim().optional(),
  notes: z.string().max(2000).optional().nullable(),
}).refine((data) => data.fromAccountId !== data.toAccountId, {
  message: 'Cannot transfer to the same account',
  path: ['toAccountId'],
});

export const transactionQuerySchema = paginationSchema.extend({
  accountId: uuidSchema.optional(),
  categoryId: uuidSchema.optional(),
  type: transactionTypeSchema.optional(),
  status: transactionStatusSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().max(100).optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
});

// ----------------------------------------------------------------------------
// Category & Tag Schemas
// ----------------------------------------------------------------------------

export const categoryTypeSchema = z.enum(['expense', 'income']);

export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  type: categoryTypeSchema,
  parentId: uuidSchema.optional().nullable(),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const categoryUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  parentId: uuidSchema.optional().nullable(),
  icon: z.string().max(10).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
});

export const tagCreateSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const tagUpdateSchema = z.object({
  name: z.string().min(1).max(50).trim().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
});

// ----------------------------------------------------------------------------
// Budget Schemas
// ----------------------------------------------------------------------------

export const budgetPeriodSchema = z.enum(BUDGET.PERIODS);

export const budgetCreateSchema = z.object({
  categoryId: uuidSchema,
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive('Amount must be positive'),
  period: budgetPeriodSchema,
  alertThreshold: z.number().int().min(0).max(100).default(BUDGET.DEFAULT_ALERT_THRESHOLD),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
});

export const budgetUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  alertThreshold: z.number().int().min(0).max(100).optional(),
  endDate: z.coerce.date().optional().nullable(),
});

// ----------------------------------------------------------------------------
// Document Schemas
// ----------------------------------------------------------------------------

export const documentStatusSchema = z.enum(DOCUMENT.STATUSES);

export const documentUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum(DOCUMENT.ALLOWED_TYPES),
  size: z.number().int().positive().max(DOCUMENT.MAX_SIZE),
  isVault: z.boolean().default(false),
});

export const documentLinkSchema = z.object({
  transactionId: uuidSchema,
});

export const documentQuerySchema = paginationSchema.extend({
  status: documentStatusSchema.optional(),
  isVault: z.coerce.boolean().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// ----------------------------------------------------------------------------
// Import Schemas
// ----------------------------------------------------------------------------

export const importPreviewSchema = z.object({
  accountId: uuidSchema,
  columnMapping: z.record(z.string()),
  dateFormat: z.string().optional(),
  skipFirstRow: z.boolean().default(true),
});

export const importExecuteSchema = z.object({
  accountId: uuidSchema,
  columnMapping: z.record(z.string()),
  dateFormat: z.string().optional(),
  skipFirstRow: z.boolean().default(true),
  applyRules: z.boolean().default(true),
});

// ----------------------------------------------------------------------------
// Rule Schemas
// ----------------------------------------------------------------------------

export const ruleOperatorSchema = z.enum(['contains', 'equals', 'starts_with', 'ends_with', 'regex']);

export const ruleConditionSchema = z.object({
  field: z.enum(['description', 'amount', 'date']),
  operator: ruleOperatorSchema,
  value: z.string().min(1),
});

export const ruleActionSchema = z.object({
  type: z.enum(['set_category', 'add_tag', 'set_notes']),
  value: z.string().min(1),
});

export const ruleCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  priority: z.number().int().min(0).default(0),
  conditions: z.array(ruleConditionSchema).min(1),
  actions: z.array(ruleActionSchema).min(1),
  isEnabled: z.boolean().default(true),
});

export const ruleUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  priority: z.number().int().min(0).optional(),
  conditions: z.array(ruleConditionSchema).min(1).optional(),
  actions: z.array(ruleActionSchema).min(1).optional(),
  isEnabled: z.boolean().optional(),
});

// ----------------------------------------------------------------------------
// Pro Mode Schemas
// ----------------------------------------------------------------------------

export const contactTypeSchema = z.enum(PRO.CONTACT_TYPES);

export const contactCreateSchema = z.object({
  type: contactTypeSchema,
  name: z.string().min(1).max(200).trim(),
  email: emailSchema.optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  siret: z.string().length(14).optional().nullable(),
  vatNumber: z.string().max(20).optional().nullable(),
});

export const contactUpdateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  email: emailSchema.optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  siret: z.string().length(14).optional().nullable(),
  vatNumber: z.string().max(20).optional().nullable(),
});

export const invoiceLineSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unitPrice: z.number(),
  vatRate: z.number().min(0).max(100),
});

export const quoteCreateSchema = z.object({
  contactId: uuidSchema,
  validUntil: z.coerce.date(),
  lines: z.array(invoiceLineSchema).min(1),
  notes: z.string().max(2000).optional().nullable(),
});

export const invoiceCreateSchema = z.object({
  contactId: uuidSchema,
  quoteId: uuidSchema.optional().nullable(),
  dueDate: z.coerce.date(),
  lines: z.array(invoiceLineSchema).min(1),
  notes: z.string().max(2000).optional().nullable(),
});

export const invoicePaySchema = z.object({
  amount: z.number().positive(),
  paidAt: z.coerce.date().default(() => new Date()),
  linkedTransactionId: uuidSchema.optional().nullable(),
});

// ----------------------------------------------------------------------------
// Investment Schemas
// ----------------------------------------------------------------------------

export const assetTypeSchema = z.enum(INVEST.ASSET_TYPES);
export const investTransactionTypeSchema = z.enum(INVEST.TRANSACTION_TYPES);

export const assetSearchSchema = z.object({
  query: z.string().min(1).max(100),
  type: assetTypeSchema.optional(),
});

export const positionCreateSchema = z.object({
  accountId: uuidSchema,
  assetId: uuidSchema.optional(),
  assetSymbol: z.string().min(1).max(20).optional(),
  assetType: assetTypeSchema.optional(),
  quantity: z.number().positive(),
  price: z.number().positive(),
  fees: z.number().min(0).default(0),
  date: z.coerce.date(),
}).refine(
  (data) => data.assetId || data.assetSymbol,
  { message: 'Either assetId or assetSymbol is required' }
);

export const investTransactionCreateSchema = z.object({
  type: investTransactionTypeSchema,
  quantity: z.number().positive(),
  price: z.number().positive(),
  fees: z.number().min(0).default(0),
  date: z.coerce.date(),
  notes: z.string().max(500).optional().nullable(),
});

// ----------------------------------------------------------------------------
// Report & Export Schemas
// ----------------------------------------------------------------------------

export const reportQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  accountIds: z.array(uuidSchema).optional(),
  categoryIds: z.array(uuidSchema).optional(),
});

export const exportRequestSchema = z.object({
  format: z.enum(['csv', 'pdf']),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  accountIds: z.array(uuidSchema).optional(),
  includeDocuments: z.boolean().default(false),
});

// ----------------------------------------------------------------------------
// Loan Schemas
// ----------------------------------------------------------------------------

export const loanTypeSchema = z.enum(LOAN.TYPES);

export const loanCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  type: loanTypeSchema,
  principalAmount: z.number().positive('Principal amount must be positive'),
  interestRate: z.number().min(0).max(100).optional().nullable(),
  currency: z.string().length(3).toUpperCase().default('EUR'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  counterparty: z.string().max(200).trim().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const loanUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  interestRate: z.number().min(0).max(100).optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  counterparty: z.string().max(200).trim().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const loanPaymentCreateSchema = z.object({
  amount: z.number().positive('Payment amount must be positive'),
  principal: z.number().min(0),
  interest: z.number().min(0),
  date: z.coerce.date(),
  notes: z.string().max(500).optional().nullable(),
}).refine(
  (data) => Math.abs(data.principal + data.interest - data.amount) < 0.01,
  { message: 'Principal + Interest must equal Amount' }
);

export const loanQuerySchema = paginationSchema.extend({
  type: loanTypeSchema.optional(),
  includeDeleted: z.coerce.boolean().optional(),
});

// ----------------------------------------------------------------------------
// Savings Goals Schemas
// ----------------------------------------------------------------------------

export const savingsGoalCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  targetAmount: z.number().positive('Target amount must be positive'),
  currency: z.string().length(3).toUpperCase().default('EUR'),
  targetDate: optionalDateSchema,
  icon: z.string().max(10).optional().nullable(),
  color: optionalColorSchema,
  accountId: optionalUuidSchema,
});

export const savingsGoalUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  targetAmount: z.number().positive('Target amount must be positive').optional(),
  targetDate: optionalDateSchema,
  icon: z.string().max(10).optional().nullable(),
  color: optionalColorSchema,
  accountId: optionalUuidSchema,
});

export const savingsContributionCreateSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  date: z.coerce.date(),
  notes: z.string().max(500).optional().nullable(),
  transactionId: z.string().uuid().optional().nullable(),
});

export const savingsGoalQuerySchema = paginationSchema.extend({
  includeDeleted: z.coerce.boolean().optional(),
  includeCompleted: z.coerce.boolean().optional(),
});

// ----------------------------------------------------------------------------
// Type Exports (inferred from schemas)
// ----------------------------------------------------------------------------

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
export type MfaSetupInput = z.infer<typeof mfaSetupSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;
export type WorkspaceUpdateInput = z.infer<typeof workspaceUpdateSchema>;
export type MemberInviteInput = z.infer<typeof memberInviteSchema>;
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;
export type FamilyInviteInput = z.infer<typeof familyInviteSchema>;
export type MemberFamilySettingsInput = z.infer<typeof memberFamilySettingsSchema>;

export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;

export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
export type TransferCreateInput = z.infer<typeof transferCreateSchema>;
export type TransactionQueryInput = z.infer<typeof transactionQuerySchema>;

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type TagCreateInput = z.infer<typeof tagCreateSchema>;
export type TagUpdateInput = z.infer<typeof tagUpdateSchema>;

export type BudgetCreateInput = z.infer<typeof budgetCreateSchema>;
export type BudgetUpdateInput = z.infer<typeof budgetUpdateSchema>;

export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type DocumentLinkInput = z.infer<typeof documentLinkSchema>;
export type DocumentQueryInput = z.infer<typeof documentQuerySchema>;

export type ImportPreviewInput = z.infer<typeof importPreviewSchema>;
export type ImportExecuteInput = z.infer<typeof importExecuteSchema>;

export type RuleCreateInput = z.infer<typeof ruleCreateSchema>;
export type RuleUpdateInput = z.infer<typeof ruleUpdateSchema>;

export type ContactCreateInput = z.infer<typeof contactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;
export type QuoteCreateInput = z.infer<typeof quoteCreateSchema>;
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export type InvoicePayInput = z.infer<typeof invoicePaySchema>;

export type AssetSearchInput = z.infer<typeof assetSearchSchema>;
export type PositionCreateInput = z.infer<typeof positionCreateSchema>;
export type InvestTransactionCreateInput = z.infer<typeof investTransactionCreateSchema>;

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
export type ExportRequestInput = z.infer<typeof exportRequestSchema>;

export type LoanCreateInput = z.infer<typeof loanCreateSchema>;
export type LoanUpdateInput = z.infer<typeof loanUpdateSchema>;
export type LoanPaymentCreateInput = z.infer<typeof loanPaymentCreateSchema>;
export type LoanQueryInput = z.infer<typeof loanQuerySchema>;

export type SavingsGoalCreateInput = z.infer<typeof savingsGoalCreateSchema>;
export type SavingsGoalUpdateInput = z.infer<typeof savingsGoalUpdateSchema>;
export type SavingsContributionCreateInput = z.infer<typeof savingsContributionCreateSchema>;
export type SavingsGoalQueryInput = z.infer<typeof savingsGoalQuerySchema>;

// Aliases for backwards compatibility
export { transferCreateSchema as transferSchema };
