# Architecture

System architecture and design decisions for HubCompta.

## Overview

HubCompta is a monorepo containing four main packages:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Load Balancer                            │
│                       (Traefik + HTTPS)                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌───────────────┐                     ┌───────────────┐
│   Frontend    │                     │    Backend    │
│  (React SPA)  │ ◄─────────────────► │   (Fastify)   │
│    Nginx      │      REST API       │               │
└───────────────┘                     └───────┬───────┘
                                              │
                          ┌───────────────────┼───────────────────┐
                          │                   │                   │
                          ▼                   ▼                   ▼
                    ┌──────────┐       ┌──────────┐       ┌──────────┐
                    │PostgreSQL│       │  Redis   │       │  MinIO   │
                    │    DB    │       │  Cache   │       │ Storage  │
                    └──────────┘       └────┬─────┘       └──────────┘
                                            │
                                            ▼
                                    ┌───────────────┐
                                    │    Worker     │
                                    │   (BullMQ)    │
                                    └───────────────┘
```

## Package Structure

### `packages/backend`

Fastify-based REST API server.

```
backend/
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── migrations/        # SQL migrations
│   └── seed.ts           # Default data
├── src/
│   ├── api/
│   │   └── routes/       # HTTP route handlers
│   ├── core/
│   │   ├── auth/         # Authentication guards
│   │   ├── crypto/       # JWT, password hashing
│   │   ├── database/     # Prisma, Redis clients
│   │   ├── middleware/   # CORS, helmet, rate limit
│   │   ├── queue/        # BullMQ setup
│   │   └── storage/      # S3/MinIO client
│   ├── modules/
│   │   ├── accounts/     # Account management
│   │   ├── auth/         # MFA, sessions, devices
│   │   ├── budgets/      # Budget tracking
│   │   ├── categories/   # Categories, tags
│   │   ├── currency/     # Multi-currency
│   │   ├── documents/    # File storage
│   │   ├── export/       # Data export
│   │   ├── import/       # CSV import
│   │   ├── invest/       # Investments
│   │   ├── notifications/# Alerts
│   │   ├── pro/          # Invoicing
│   │   ├── recurrences/  # Recurring transactions
│   │   ├── reports/      # Reporting
│   │   ├── rules/        # Auto-categorization
│   │   ├── search/       # Search engine
│   │   ├── settings/     # User settings
│   │   ├── transactions/ # Transaction CRUD
│   │   ├── users/        # User management
│   │   └── workspaces/   # Multi-tenancy
│   ├── app.ts            # Fastify app setup
│   └── index.ts          # Entry point
└── tsconfig.json
```

### `packages/frontend`

React SPA with Vite.

```
frontend/
├── public/
│   └── manifest.json     # PWA manifest
├── src/
│   ├── components/
│   │   ├── layout/       # App layout, sidebar
│   │   └── ui/           # Reusable components
│   ├── features/
│   │   ├── auth/         # Login, MFA
│   │   ├── accounts/     # Account management
│   │   ├── budgets/      # Budget tracking
│   │   ├── currency/     # Currency conversion
│   │   ├── dashboard/    # Main dashboard
│   │   ├── documents/    # Document management
│   │   ├── export/       # Export dialogs
│   │   ├── import/       # Import wizard
│   │   ├── invest/       # Portfolio
│   │   ├── notifications/# Alert settings
│   │   ├── pro/          # Invoicing
│   │   ├── recurrences/  # Recurring transactions
│   │   ├── reports/      # Report generation
│   │   ├── rules/        # Auto-categorization
│   │   ├── search/       # Global search
│   │   ├── settings/     # User settings
│   │   ├── transactions/ # Transaction management
│   │   └── workspaces/   # Workspace management
│   ├── hooks/            # Custom React hooks
│   ├── lib/
│   │   ├── api/          # API client
│   │   ├── pwa/          # Service worker
│   │   └── storage/      # IndexedDB
│   ├── stores/           # Zustand stores
│   ├── App.tsx           # Main router
│   └── main.tsx          # Entry point
├── tailwind.config.js
└── vite.config.ts
```

### `packages/worker`

BullMQ background job processor.

```
worker/
├── src/
│   ├── jobs/
│   │   ├── alerts.ts       # Process alert rules
│   │   ├── backup.ts       # Database backup
│   │   ├── cleanup.ts      # Data cleanup
│   │   ├── exchange-rates.ts # Fetch ECB rates
│   │   ├── import.ts       # CSV import
│   │   ├── marketdata.ts   # Stock prices
│   │   ├── pro-status.ts   # Invoice reminders
│   │   ├── recurrences.ts  # Generate recurring tx
│   │   ├── registry.ts     # Job registration
│   │   └── types.ts        # Job type definitions
│   ├── lib/
│   │   ├── prisma.ts       # Database client
│   │   └── storage.ts      # Storage client
│   └── index.ts            # Entry point
└── tsconfig.json
```

### `packages/shared`

Shared types and utilities.

```
shared/
├── src/
│   ├── constants/        # Shared constants
│   ├── types/            # TypeScript types
│   └── validation/       # Zod schemas
└── tsconfig.json
```

---

## Database Design

### Entity Relationship

```
User 1──────────* Membership *───────────1 Workspace
  │                                          │
  │                                          │
  │              ┌───────────────────────────┼───────────────────────────┐
  │              │                           │                           │
  │              ▼                           ▼                           ▼
  │         Account *───────────────* Transaction *──────────────* Document
  │              │                           │
  │              │                           │
  │              │                           ├──────────────* Category
  │              │                           │
  │              │                           └──────────────* Tag
  │              │
  │              └─────────────────────* Recurrence
  │
  └───────────────────────────────────────* Device
```

### Multi-Tenancy

Each workspace is completely isolated:

- All queries filter by `workspaceId`
- Row-level security enforced at application layer
- Separate storage paths per workspace

### Key Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts |
| `workspaces` | Tenant containers |
| `memberships` | User-workspace relationships |
| `accounts` | Financial accounts |
| `transactions` | Financial transactions |
| `categories` | Transaction categories |
| `tags` | Transaction tags |
| `budgets` | Budget tracking |
| `documents` | File metadata |
| `rules` | Auto-categorization rules |
| `recurrences` | Recurring transactions |
| `contacts` | Pro mode contacts |
| `quotes` | Pro mode quotes |
| `invoices` | Pro mode invoices |
| `positions` | Investment positions |
| `audit_logs` | Security audit trail |

---

## Authentication Flow

```
┌────────┐          ┌────────┐          ┌────────┐
│ Client │          │  API   │          │ Redis  │
└───┬────┘          └───┬────┘          └───┬────┘
    │                   │                   │
    │  POST /auth/login │                   │
    │──────────────────►│                   │
    │                   │                   │
    │                   │ Verify password   │
    │                   │ (Argon2id)        │
    │                   │                   │
    │  {pendingMfa}     │                   │
    │◄──────────────────│                   │
    │                   │                   │
    │ POST /auth/mfa/verify                 │
    │──────────────────►│                   │
    │                   │                   │
    │                   │ Verify TOTP       │
    │                   │                   │
    │                   │ Create session    │
    │                   │──────────────────►│
    │                   │                   │
    │  {accessToken,    │                   │
    │   refreshToken}   │                   │
    │◄──────────────────│                   │
    │                   │                   │
```

### Token Strategy

- **Access Token**: 1 hour, stored in memory
- **Refresh Token**: 7 days, stored in httpOnly cookie
- **Session Lock**: After 10 min inactivity

---

## API Design

### REST Conventions

- Resources are nouns: `/workspaces/:id/transactions`
- HTTP methods: GET (read), POST (create), PATCH (update), DELETE (remove)
- Pagination: `?page=1&limit=50`
- Filtering: `?type=expense&dateFrom=2024-01-01`
- Sorting: `?sort=-date` (prefix `-` for descending)

### Response Format

Success:
```json
{
  "data": { ... },
  "pagination": { "page": 1, "total": 100 }
}
```

Error:
```json
{
  "error": "ValidationError",
  "message": "Invalid input",
  "statusCode": 400
}
```

### Rate Limiting

```
┌─────────────────────────────────────────┐
│                Request                   │
└─────────────────────┬───────────────────┘
                      │
                      ▼
            ┌─────────────────┐
            │  Rate Limiter   │
            │    (Redis)      │
            └────────┬────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
   ┌──────────┐           ┌──────────┐
   │  Under   │           │   Over   │
   │  Limit   │           │  Limit   │
   └────┬─────┘           └────┬─────┘
        │                      │
        ▼                      ▼
   ┌──────────┐           ┌──────────┐
   │  Process │           │   429    │
   │  Request │           │ Response │
   └──────────┘           └──────────┘
```

---

## Background Jobs

### Queue Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           Redis                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      BullMQ Queues                        │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │   │
│  │  │ import │ │ backup │ │ alerts │ │ market │ │recurrence│  │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                    ┌─────────┴─────────┐
                    │                   │
              ┌─────┴─────┐       ┌─────┴─────┐
              │  Backend  │       │  Worker   │
              │ (enqueue) │       │ (process) │
              └───────────┘       └───────────┘
```

### Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Recurrences | Every hour | Generate due transactions |
| Exchange rates | Daily 14:00 | Fetch ECB rates |
| Alerts | Every hour | Evaluate alert rules |
| Pro status | Every 6 hours | Update invoice status |
| Cleanup | Weekly | Remove orphaned data |

---

## Frontend State Management

### State Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Components                          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│    Zustand    │       │ TanStack Query│       │    Context    │
│   (UI State)  │       │ (Server State)│       │    (Auth)     │
└───────────────┘       └───────────────┘       └───────────────┘
        │                       │                       │
        │               ┌───────┴───────┐               │
        │               │               │               │
        │               ▼               ▼               │
        │        ┌──────────┐    ┌──────────┐          │
        │        │  Cache   │    │   API    │          │
        │        └──────────┘    └──────────┘          │
        │                               │              │
        └───────────────────────────────┴──────────────┘
                                │
                        ┌───────┴───────┐
                        │   IndexedDB   │
                        │  (Offline)    │
                        └───────────────┘
```

### Query Patterns

```typescript
// List with pagination
const { data, isLoading } = useQuery({
  queryKey: ['transactions', workspaceId, filters],
  queryFn: () => api.getTransactions(workspaceId, filters),
});

// Mutation with cache invalidation
const mutation = useMutation({
  mutationFn: api.createTransaction,
  onSuccess: () => {
    queryClient.invalidateQueries(['transactions']);
    queryClient.invalidateQueries(['accounts']); // Update balances
  },
});
```

---

## PWA & Offline

### Service Worker Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                        Request                                   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │    Service Worker     │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│  Static Files │       │   API Calls   │       │    Images     │
│  CacheFirst   │       │  NetworkFirst │       │ StaleWhile... │
└───────────────┘       └───────────────┘       └───────────────┘
```

### IndexedDB Schema

```javascript
{
  draftTransactions: {
    keyPath: 'id',
    indexes: ['by-workspace', 'by-created']
  },
  pendingOperations: {
    keyPath: 'id',
    indexes: ['by-type', 'by-created']
  },
  cachedData: {
    keyPath: 'key',
    indexes: ['by-type', 'by-expires']
  },
  preferences: {
    keyPath: 'key'
  }
}
```

---

## Security Measures

### Defense in Depth

1. **Network**: Traefik with HTTPS, rate limiting
2. **Application**: CORS, Helmet headers, input validation
3. **Authentication**: Argon2id, MFA, session management
4. **Authorization**: RBAC, workspace isolation
5. **Data**: Encrypted at rest (Prisma), encrypted in transit (TLS)
6. **Audit**: Comprehensive audit logging

### Security Headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: accelerometer=(), camera=(), geolocation=()...
Content-Security-Policy: default-src 'self'; ...
```

---

## Design Decisions

### Why Fastify?

- Fastest Node.js framework
- Schema-based validation
- Plugin architecture
- TypeScript support

### Why PostgreSQL?

- ACID compliance
- JSON support
- Full-text search
- Prisma compatibility

### Why BullMQ?

- Redis-backed reliability
- Job prioritization
- Repeatable jobs
- Progress tracking

### Why Monorepo?

- Shared types
- Atomic changes
- Simplified CI/CD
- Single versioning
