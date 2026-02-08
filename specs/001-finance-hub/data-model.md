# Data Model: Finance Hub

**Branch**: `001-finance-hub` | **Date**: 2026-02-08

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AUTHENTICATION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐     ┌────────────┐     ┌───────────┐     ┌──────────────┐     │
│  │  User   │────<│ Membership │>────│ Workspace │     │    Device    │     │
│  └─────────┘     └────────────┘     └───────────┘     └──────────────┘     │
│       │                │                  │                   │             │
│       │                │                  │                   │             │
│       └────────────────┼──────────────────┼───────────────────┘             │
│                        │                  │                                  │
│  ┌─────────┐     ┌─────┴─────┐     ┌──────┴──────┐     ┌──────────────┐    │
│  │   MFA   │     │   Role    │     │  AuditLog   │     │   Session    │    │
│  └─────────┘     └───────────┘     └─────────────┘     └──────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              CORE FINANCE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────┐     ┌─────────────┐     ┌──────────┐     ┌───────────┐      │
│  │  Account  │────<│ Transaction │>────│ Category │     │    Tag    │      │
│  └───────────┘     └─────────────┘     └──────────┘     └───────────┘      │
│       │                  │                  │                               │
│       │                  │                  │                               │
│       │            ┌─────┴─────┐      ┌─────┴─────┐                         │
│       │            │  Document │      │   Budget  │                         │
│       │            └───────────┘      └───────────┘                         │
│       │                                                                      │
│  ┌────┴────┐     ┌─────────────┐     ┌──────────────┐                       │
│  │ Transfer│     │    Rule     │     │  Recurrence  │                       │
│  └─────────┘     └─────────────┘     └──────────────┘                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              MODE PRO (V1)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐     ┌─────────────┐     ┌──────────────┐                       │
│  │ Contact │────<│   Invoice   │>────│ InvoiceLine  │                       │
│  └─────────┘     └─────────────┘     └──────────────┘                       │
│       │                │                                                     │
│       │          ┌─────┴─────┐                                              │
│       └─────────<│   Quote   │                                              │
│                  └───────────┘                                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              INVEST (V2)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐     ┌─────────────┐     ┌──────────────┐                       │
│  │  Asset  │────<│  Position   │>────│   Holding    │                       │
│  └─────────┘     └─────────────┘     └──────────────┘                       │
│       │                │                                                     │
│       │          ┌─────┴─────┐     ┌──────────────┐                         │
│       └─────────<│ InvestTx  │     │  Watchlist   │                         │
│                  └───────────┘     └──────────────┘                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Entities

### User

Primary identity for authentication. Exists globally across workspaces.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| email | String | UNIQUE, NOT NULL | Login email |
| passwordHash | String | NOT NULL | Argon2id hash |
| displayName | String | NOT NULL | Display name |
| avatarUrl | String? | | Profile picture URL |
| locale | String | DEFAULT 'fr' | Preferred language |
| timezone | String | DEFAULT 'Europe/Paris' | User timezone |
| createdAt | DateTime | NOT NULL | Creation timestamp |
| updatedAt | DateTime | NOT NULL | Last update |
| lastLoginAt | DateTime? | | Last successful login |

### MFA

Multi-factor authentication methods per user.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| userId | UUID | FK → User | Owner |
| type | Enum | NOT NULL | 'totp' or 'webauthn' |
| name | String | NOT NULL | User-friendly name |
| secret | String? | | TOTP secret (encrypted) |
| credentialId | String? | | WebAuthn credential ID |
| publicKey | String? | | WebAuthn public key |
| counter | Int? | | WebAuthn counter |
| isEnabled | Boolean | DEFAULT true | Active status |
| createdAt | DateTime | NOT NULL | Creation timestamp |
| lastUsedAt | DateTime? | | Last use timestamp |

### Device

Registered devices for session management.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| userId | UUID | FK → User | Owner |
| name | String | NOT NULL | Device name (auto or manual) |
| userAgent | String | NOT NULL | Browser/OS info |
| fingerprint | String | NOT NULL | Device fingerprint hash |
| lastIp | String | NOT NULL | Last known IP |
| isTrusted | Boolean | DEFAULT false | Trusted device flag |
| createdAt | DateTime | NOT NULL | First seen |
| lastSeenAt | DateTime | NOT NULL | Last activity |

### Session

Active user sessions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| userId | UUID | FK → User | Owner |
| deviceId | UUID | FK → Device | Device |
| token | String | UNIQUE | Session token (hashed) |
| refreshToken | String | UNIQUE | Refresh token (hashed) |
| isLocked | Boolean | DEFAULT false | Lock state (inactivity) |
| lockedAt | DateTime? | | Lock timestamp |
| expiresAt | DateTime | NOT NULL | Session expiry |
| createdAt | DateTime | NOT NULL | Creation timestamp |

### Workspace

Isolated data container (multi-tenant).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| name | String | NOT NULL | Workspace name |
| type | Enum | NOT NULL | 'personal', 'family', 'flatshare', 'company' |
| currency | String | DEFAULT 'EUR' | Default currency |
| fiscalYearStart | Int | DEFAULT 1 | Month (1-12) |
| logo | String? | | Workspace logo URL |
| settings | JSON | DEFAULT {} | Workspace-specific settings |
| createdAt | DateTime | NOT NULL | Creation timestamp |
| updatedAt | DateTime | NOT NULL | Last update |
| deletedAt | DateTime? | | Soft delete timestamp |

### Membership

User-Workspace relationship with role.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| userId | UUID | FK → User | User |
| workspaceId | UUID | FK → Workspace | Workspace |
| role | Enum | NOT NULL | 'owner', 'admin', 'accountant', 'member', 'readonly' |
| permissions | JSON | DEFAULT {} | Fine-grained overrides |
| joinedAt | DateTime | NOT NULL | Join timestamp |
| invitedBy | UUID? | FK → User | Inviter |

**Unique constraint**: (userId, workspaceId)

### Account

Financial account (bank, cash, savings, investment).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| workspaceId | UUID | FK → Workspace | Owner workspace |
| name | String | NOT NULL | Account name |
| type | Enum | NOT NULL | 'checking', 'savings', 'cash', 'credit', 'investment', 'loan' |
| currency | String | NOT NULL | Account currency |
| initialBalance | Decimal | DEFAULT 0 | Opening balance |
| currentBalance | Decimal | DEFAULT 0 | Computed balance |
| institution | String? | | Bank/institution name |
| accountNumber | String? | | Last 4 digits (masked) |
| color | String? | | Display color |
| icon | String? | | Display icon |
| isActive | Boolean | DEFAULT true | Active status |
| sortOrder | Int | DEFAULT 0 | Display order |
| createdAt | DateTime | NOT NULL | Creation timestamp |
| updatedAt | DateTime | NOT NULL | Last update |

### Transaction

Core financial transaction (ledger entry).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| workspaceId | UUID | FK → Workspace | Owner workspace |
| accountId | UUID | FK → Account | Source account |
| type | Enum | NOT NULL | 'expense', 'income', 'transfer' |
| amount | Decimal | NOT NULL | Transaction amount |
| currency | String | NOT NULL | Transaction currency |
| exchangeRate | Decimal? | | FX rate if different from account |
| date | Date | NOT NULL | Transaction date |
| description | String | NOT NULL | Description/payee |
| notes | String? | | Additional notes |
| categoryId | UUID? | FK → Category | Category |
| status | Enum | DEFAULT 'uncleared' | 'uncleared', 'cleared', 'reconciled' |
| isRecurring | Boolean | DEFAULT false | From recurrence |
| recurrenceId | UUID? | FK → Recurrence | Source recurrence |
| importId | UUID? | | Import batch ID |
| importHash | String? | | Duplicate detection hash |
| createdAt | DateTime | NOT NULL | Creation timestamp |
| updatedAt | DateTime | NOT NULL | Last update |
| createdBy | UUID | FK → User | Creator |

### TransactionTag

Many-to-many relation for transaction tags.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| transactionId | UUID | FK → Transaction | Transaction |
| tagId | UUID | FK → Tag | Tag |

**Primary key**: (transactionId, tagId)

### Transfer

Links two transactions for account transfers.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| workspaceId | UUID | FK → Workspace | Owner workspace |
| fromTransactionId | UUID | FK → Transaction | Source (expense) |
| toTransactionId | UUID | FK → Transaction | Destination (income) |
| createdAt | DateTime | NOT NULL | Creation timestamp |

### Category

Transaction category (hierarchical).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| workspaceId | UUID | FK → Workspace | Owner workspace |
| parentId | UUID? | FK → Category | Parent category |
| name | String | NOT NULL | Category name |
| type | Enum | NOT NULL | 'expense', 'income', 'both' |
| icon | String? | | Display icon |
| color | String? | | Display color |
| isSystem | Boolean | DEFAULT false | Pre-defined category |
| sortOrder | Int | DEFAULT 0 | Display order |
| createdAt | DateTime | NOT NULL | Creation timestamp |

### Tag

Free-form transaction labels.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| workspaceId | UUID | FK → Workspace | Owner workspace |
| name | String | NOT NULL | Tag name |
| color | String? | | Display color |
| createdAt | DateTime | NOT NULL | Creation timestamp |

**Unique constraint**: (workspaceId, name)

### Budget

Budget envelope per category/period.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| workspaceId | UUID | FK → Workspace | Owner workspace |
| categoryId | UUID | FK → Category | Target category |
| name | String | NOT NULL | Budget name |
| amount | Decimal | NOT NULL | Budget amount |
| period | Enum | NOT NULL | 'monthly', 'yearly' |
| startDate | Date | NOT NULL | Start date |
| endDate | Date? | | End date (null = ongoing) |
| rollover | Boolean | DEFAULT false | Carry unused to next period |
| alertThreshold | Int | DEFAULT 80 | Alert at % |
| createdAt | DateTime | NOT NULL | Creation timestamp |
| updatedAt | DateTime | NOT NULL | Last update |

### Document

Uploaded file (receipt, invoice, contract).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| workspaceId | UUID | FK → Workspace | Owner workspace |
| filename | String | NOT NULL | Original filename |
| mimeType | String | NOT NULL | File MIME type |
| size | Int | NOT NULL | File size in bytes |
| storageKey | String | NOT NULL | S3 object key |
| contentHash | String | NOT NULL | SHA-256 for dedup |
| status | Enum | DEFAULT 'inbox' | 'inbox', 'linked', 'archived' |
| isVault | Boolean | DEFAULT false | Stored in E2EE vault |
| vaultKey | String? | | Encrypted DEK (if vault) |
| metadata | JSON | DEFAULT {} | Extracted metadata |
| createdAt | DateTime | NOT NULL | Creation timestamp |
| uploadedBy | UUID | FK → User | Uploader |

### DocumentLink

Many-to-many relation for document-transaction links.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| documentId | UUID | FK → Document | Document |
| transactionId | UUID | FK → Transaction | Transaction |
| createdAt | DateTime | NOT NULL | Link timestamp |

**Primary key**: (documentId, transactionId)

### Rule

Automation rule for categorization.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| workspaceId | UUID | FK → Workspace | Owner workspace |
| name | String | NOT NULL | Rule name |
| conditions | JSON | NOT NULL | Match conditions |
| actions | JSON | NOT NULL | Actions to apply |
| priority | Int | DEFAULT 0 | Evaluation order |
| isEnabled | Boolean | DEFAULT true | Active status |
| matchCount | Int | DEFAULT 0 | Times matched |
| createdAt | DateTime | NOT NULL | Creation timestamp |
| updatedAt | DateTime | NOT NULL | Last update |

**Conditions schema**:
```json
{
  "operator": "and" | "or",
  "rules": [
    { "field": "description", "op": "contains", "value": "Amazon" },
    { "field": "amount", "op": "gt", "value": 50 }
  ]
}
```

**Actions schema**:
```json
{
  "setCategory": "uuid",
  "addTags": ["uuid"],
  "setNotes": "string"
}
```

### Recurrence

Recurring transaction template.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| workspaceId | UUID | FK → Workspace | Owner workspace |
| accountId | UUID | FK → Account | Account |
| type | Enum | NOT NULL | 'expense', 'income' |
| amount | Decimal | NOT NULL | Amount |
| currency | String | NOT NULL | Currency |
| description | String | NOT NULL | Description |
| categoryId | UUID? | FK → Category | Category |
| frequency | Enum | NOT NULL | 'daily', 'weekly', 'monthly', 'yearly' |
| interval | Int | DEFAULT 1 | Every N periods |
| dayOfMonth | Int? | | For monthly (1-31) |
| dayOfWeek | Int? | | For weekly (0-6) |
| startDate | Date | NOT NULL | First occurrence |
| endDate | Date? | | Last occurrence |
| nextDate | Date | NOT NULL | Next scheduled date |
| lastGeneratedAt | DateTime? | | Last generation |
| isEnabled | Boolean | DEFAULT true | Active status |
| createdAt | DateTime | NOT NULL | Creation timestamp |

### AuditLog

Immutable audit trail.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| timestamp | DateTime | NOT NULL | Event time |
| userId | UUID? | FK → User | Actor (null for system) |
| workspaceId | UUID? | FK → Workspace | Context workspace |
| action | String | NOT NULL | Action type |
| resource | String | NOT NULL | Resource type |
| resourceId | UUID? | | Resource ID |
| ipAddress | String | NOT NULL | Client IP |
| userAgent | String | NOT NULL | Client UA |
| deviceId | UUID? | FK → Device | Device |
| details | JSON | DEFAULT {} | Additional context |
| severity | Enum | DEFAULT 'info' | 'info', 'warning', 'critical' |

## Pro Module Entities (V1)

### Contact

Client or supplier.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| workspaceId | UUID | FK → Workspace | Owner workspace |
| type | Enum | NOT NULL | 'client', 'supplier', 'both' |
| name | String | NOT NULL | Company/person name |
| email | String? | | Email address |
| phone | String? | | Phone number |
| address | JSON? | | Structured address |
| vatNumber | String? | | VAT/SIRET number |
| notes | String? | | Notes |
| createdAt | DateTime | NOT NULL | Creation timestamp |
| updatedAt | DateTime | NOT NULL | Last update |

### Quote

Commercial quote.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| workspaceId | UUID | FK → Workspace | Owner workspace |
| contactId | UUID | FK → Contact | Client |
| number | String | NOT NULL | Quote number |
| date | Date | NOT NULL | Quote date |
| validUntil | Date | NOT NULL | Expiry date |
| status | Enum | DEFAULT 'draft' | 'draft', 'sent', 'accepted', 'rejected', 'expired' |
| subtotal | Decimal | NOT NULL | Subtotal HT |
| vatAmount | Decimal | NOT NULL | VAT amount |
| total | Decimal | NOT NULL | Total TTC |
| notes | String? | | Quote notes |
| terms | String? | | Terms and conditions |
| convertedToInvoiceId | UUID? | FK → Invoice | Resulting invoice |
| createdAt | DateTime | NOT NULL | Creation timestamp |
| updatedAt | DateTime | NOT NULL | Last update |

### Invoice

Commercial invoice.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| workspaceId | UUID | FK → Workspace | Owner workspace |
| contactId | UUID | FK → Contact | Client |
| quoteId | UUID? | FK → Quote | Source quote |
| number | String | NOT NULL | Invoice number |
| date | Date | NOT NULL | Invoice date |
| dueDate | Date | NOT NULL | Payment due date |
| status | Enum | DEFAULT 'draft' | 'draft', 'sent', 'paid', 'overdue', 'cancelled' |
| subtotal | Decimal | NOT NULL | Subtotal HT |
| vatAmount | Decimal | NOT NULL | VAT amount |
| total | Decimal | NOT NULL | Total TTC |
| paidAmount | Decimal | DEFAULT 0 | Amount paid |
| notes | String? | | Invoice notes |
| terms | String? | | Payment terms |
| transactionId | UUID? | FK → Transaction | Linked payment |
| createdAt | DateTime | NOT NULL | Creation timestamp |
| updatedAt | DateTime | NOT NULL | Last update |

### InvoiceLine

Line item on quote or invoice.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| invoiceId | UUID? | FK → Invoice | Parent invoice |
| quoteId | UUID? | FK → Quote | Parent quote |
| description | String | NOT NULL | Line description |
| quantity | Decimal | NOT NULL | Quantity |
| unitPrice | Decimal | NOT NULL | Unit price HT |
| vatRate | Decimal | NOT NULL | VAT rate (0.20 = 20%) |
| total | Decimal | NOT NULL | Line total HT |
| sortOrder | Int | DEFAULT 0 | Display order |

**Check constraint**: invoiceId XOR quoteId (exactly one must be set)

## Invest Module Entities (V2)

### Asset

Tradable instrument definition.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| symbol | String | NOT NULL | Ticker symbol |
| name | String | NOT NULL | Full name |
| type | Enum | NOT NULL | 'stock', 'etf', 'crypto', 'commodity', 'bond' |
| currency | String | NOT NULL | Quote currency |
| exchange | String? | | Exchange (NYSE, NASDAQ, etc.) |
| isin | String? | | ISIN code |
| provider | String | NOT NULL | Data provider |
| providerId | String | NOT NULL | Provider-specific ID |
| lastPrice | Decimal? | | Last known price |
| lastPriceAt | DateTime? | | Price timestamp |
| createdAt | DateTime | NOT NULL | Creation timestamp |
| updatedAt | DateTime | NOT NULL | Last update |

**Unique constraint**: (symbol, provider)

### Position

Holding in an investment account.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| workspaceId | UUID | FK → Workspace | Owner workspace |
| accountId | UUID | FK → Account | Investment account |
| assetId | UUID | FK → Asset | Asset |
| quantity | Decimal | NOT NULL | Current quantity held |
| averageCost | Decimal | NOT NULL | PRU (average cost basis) |
| totalCost | Decimal | NOT NULL | Total invested |
| currentValue | Decimal? | | Current market value |
| unrealizedPL | Decimal? | | Unrealized P&L |
| realizedPL | Decimal | DEFAULT 0 | Realized P&L |
| createdAt | DateTime | NOT NULL | Creation timestamp |
| updatedAt | DateTime | NOT NULL | Last update |

**Unique constraint**: (accountId, assetId)

### InvestTransaction

Investment transaction (buy, sell, dividend).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| workspaceId | UUID | FK → Workspace | Owner workspace |
| positionId | UUID | FK → Position | Position |
| type | Enum | NOT NULL | 'buy', 'sell', 'dividend', 'split', 'fee' |
| date | Date | NOT NULL | Transaction date |
| quantity | Decimal | NOT NULL | Quantity |
| price | Decimal | NOT NULL | Price per unit |
| fees | Decimal | DEFAULT 0 | Transaction fees |
| total | Decimal | NOT NULL | Total amount |
| notes | String? | | Notes |
| transactionId | UUID? | FK → Transaction | Linked cash transaction |
| createdAt | DateTime | NOT NULL | Creation timestamp |

### Watchlist

User's watched assets.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| workspaceId | UUID | FK → Workspace | Owner workspace |
| name | String | NOT NULL | Watchlist name |
| createdAt | DateTime | NOT NULL | Creation timestamp |

### WatchlistItem

Asset in a watchlist.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| watchlistId | UUID | FK → Watchlist | Watchlist |
| assetId | UUID | FK → Asset | Asset |
| addedAt | DateTime | NOT NULL | When added |

**Primary key**: (watchlistId, assetId)

## State Transitions

### Transaction Status

```
┌──────────┐     clear      ┌─────────┐    reconcile   ┌────────────┐
│ uncleared│ ─────────────> │ cleared │ ─────────────> │ reconciled │
└──────────┘                └─────────┘                └────────────┘
     │                           │
     │         unclear           │
     └───────────────────────────┘
```

### Document Status

```
┌───────┐     link       ┌────────┐    archive     ┌──────────┐
│ inbox │ ────────────>  │ linked │ ─────────────> │ archived │
└───────┘                └────────┘                └──────────┘
     │                        │
     │       unlink           │
     │<───────────────────────┘
```

### Invoice Status

```
┌───────┐     send      ┌──────┐     pay       ┌──────┐
│ draft │ ───────────>  │ sent │ ───────────>  │ paid │
└───────┘               └──────┘               └──────┘
     │                      │
     │       overdue        │
     │                 ┌────┴────┐
     │                 │ overdue │
     │                 └─────────┘
     │
     │       cancel
     └─────────────────────────────────────────────>┌───────────┐
                                                    │ cancelled │
                                                    └───────────┘
```

### Quote Status

```
┌───────┐     send      ┌──────┐     accept    ┌──────────┐
│ draft │ ───────────>  │ sent │ ───────────>  │ accepted │ ──> Invoice
└───────┘               └──────┘               └──────────┘
                            │
                            │     reject
                            └─────────────>┌──────────┐
                            │              │ rejected │
                            │              └──────────┘
                            │     expire
                            └─────────────>┌─────────┐
                                           │ expired │
                                           └─────────┘
```

## Validation Rules

### Transaction

- `amount` must be > 0
- `date` cannot be in the future (except scheduled)
- `accountId` must belong to same `workspaceId`
- `categoryId` must belong to same `workspaceId`
- For transfers: two transactions linked via `Transfer` entity

### Budget

- `amount` must be > 0
- `alertThreshold` must be 0-100
- `startDate` <= `endDate` (if endDate set)
- `categoryId` must belong to same `workspaceId`

### Document

- `size` must be <= 20 MB (20,971,520 bytes)
- `mimeType` must be in allowed list (image/*, application/pdf)
- `contentHash` used for duplicate detection

### Invoice/Quote

- `number` must be unique within workspace
- `dueDate` >= `date`
- `total` = `subtotal` + `vatAmount`
- Line items must sum to `subtotal`

## Indexes Strategy

```sql
-- Multi-tenant isolation (all queries)
CREATE INDEX idx_transactions_workspace ON transactions(workspace_id);
CREATE INDEX idx_accounts_workspace ON accounts(workspace_id);
CREATE INDEX idx_documents_workspace ON documents(workspace_id);

-- Transaction queries (most frequent)
CREATE INDEX idx_tx_ws_date ON transactions(workspace_id, date DESC);
CREATE INDEX idx_tx_ws_account ON transactions(workspace_id, account_id);
CREATE INDEX idx_tx_ws_category ON transactions(workspace_id, category_id);
CREATE INDEX idx_tx_import_hash ON transactions(workspace_id, import_hash);

-- Budget calculations
CREATE INDEX idx_tx_budget ON transactions(workspace_id, category_id, date);

-- Document inbox
CREATE INDEX idx_doc_inbox ON documents(workspace_id, status)
  WHERE status = 'inbox';

-- Audit log queries
CREATE INDEX idx_audit_user ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_ws ON audit_logs(workspace_id, timestamp DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource, resource_id);

-- Session management
CREATE INDEX idx_session_user ON sessions(user_id);
CREATE INDEX idx_session_expires ON sessions(expires_at);

-- Investment positions
CREATE INDEX idx_position_ws ON positions(workspace_id);
CREATE INDEX idx_position_account ON positions(account_id);
```
