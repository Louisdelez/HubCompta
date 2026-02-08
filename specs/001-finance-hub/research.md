# Research: Finance Hub

**Branch**: `001-finance-hub` | **Date**: 2026-02-08

## Technology Stack Decisions

### Backend Framework: Fastify

**Decision**: Fastify 4.x with TypeScript

**Rationale**:
- Fastest Node.js web framework (benchmarks show 2-3x faster than Express)
- First-class TypeScript support with schema-based validation
- Built-in JSON schema validation aligns with OpenAPI contract-first approach
- Plugin architecture supports modular design (Constitution II)
- Excellent PostgreSQL and Redis integration

**Alternatives Considered**:
| Framework | Pros | Cons | Why Rejected |
|-----------|------|------|--------------|
| Express | Mature, huge ecosystem | Slower, callback-based, weaker types | Performance, type safety |
| NestJS | Full framework, decorators | Heavy, opinionated, slower | Over-engineering for scope |
| Hono | Very fast, edge-ready | Newer, smaller ecosystem | Ecosystem maturity |

### ORM: Prisma

**Decision**: Prisma 5.x

**Rationale**:
- Type-safe queries generated from schema
- Excellent migration system with rollback support (Constitution IX)
- Good PostgreSQL support including JSON fields
- Schema-first approach matches data-model.md workflow
- Built-in connection pooling

**Alternatives Considered**:
| ORM | Pros | Cons | Why Rejected |
|-----|------|------|--------------|
| Drizzle | Lighter, SQL-like | Newer, less tooling | Migration ecosystem |
| TypeORM | Decorators, mature | Performance issues, complex | Query performance |
| Knex | Raw SQL, flexible | No type generation | Type safety |

### Frontend: React + Vite

**Decision**: React 18 + Vite 5 + TanStack Query

**Rationale**:
- React 18 concurrent features for responsive UI (<200ms)
- Vite provides fast HMR and optimized builds
- TanStack Query handles caching, background refetch, offline support
- Large ecosystem for PWA, accessibility, i18n
- Tailwind CSS for rapid mobile-first styling

**Alternatives Considered**:
| Framework | Pros | Cons | Why Rejected |
|-----------|------|------|--------------|
| Next.js | SSR, file routing | Server-required, heavier | Self-host complexity |
| Vue 3 | Simpler, good DX | Smaller ecosystem | Ecosystem size |
| SolidJS | Faster, fine-grained | Smaller ecosystem | Ecosystem maturity |

### Authentication: Multi-layered Approach

**Decision**: Custom auth with Passport.js strategies

**Rationale**:
- Full control over MFA flow (Constitution IV requirement)
- Passport.js provides TOTP and WebAuthn strategies
- jose library for JWT handling (stateless API auth)
- Redis for session storage with configurable TTL
- Custom lock/unlock flow for vault-style security

**Implementation Details**:
- Email/password with Argon2id hashing
- TOTP via otpauth library (RFC 6238)
- WebAuthn via @simplewebauthn packages
- JWT access tokens (15 min) + refresh tokens (7 days)
- Session lock separate from logout (configurable 5-30 min)

**Alternatives Considered**:
| Solution | Pros | Cons | Why Rejected |
|----------|------|------|--------------|
| Auth0 | Full-featured | Cloud dependency | Constitution I (self-host) |
| Keycloak | Self-hosted | Heavy, Java-based | Resource overhead on NAS |
| Lucia | Lightweight | Less WebAuthn support | MFA requirements |

### E2EE Vault: Client-side Encryption

**Decision**: libsodium-wrappers + client-side key management

**Rationale**:
- Constitution IV requires server-incapable-of-decryption for vault
- libsodium provides audited, well-tested crypto primitives
- XChaCha20-Poly1305 for symmetric encryption
- X25519 for key exchange (sharing vault access)
- Argon2id for master password derivation

**Key Management Flow**:
1. Master password → Argon2id → Master Key (never leaves client)
2. Master Key encrypts → Vault DEK (Data Encryption Key)
3. Vault DEK stored encrypted on server
4. All vault items encrypted with Vault DEK client-side

**Alternatives Considered**:
| Library | Pros | Cons | Why Rejected |
|---------|------|------|--------------|
| Web Crypto API | Native, fast | Limited algorithms | No Argon2id |
| TweetNaCl | Minimal | No Argon2id | Missing KDF |
| OpenPGP.js | Standard format | Heavy, complex | Over-engineering |

### Job Queue: BullMQ

**Decision**: BullMQ 4.x with Redis

**Rationale**:
- Redis already required for sessions/cache
- Reliable job processing with retries and backoff
- Built-in rate limiting (for market data API quotas)
- Good monitoring via Bull Board
- Supports scheduled jobs (recurring imports, backups)

**Job Types**:
- `import.csv`: Process CSV imports asynchronously
- `import.ofx`: Process OFX/QIF imports
- `marketdata.fetch`: Fetch stock/crypto prices (rate-limited)
- `backup.create`: Create encrypted backups
- `cleanup.documents`: Remove orphaned documents

### Document Storage: S3-compatible

**Decision**: MinIO for self-hosted, S3 API compatibility

**Rationale**:
- S3 API is industry standard, allows migration
- MinIO runs in Docker, no external dependency
- Supports server-side encryption at rest
- Efficient for large binary files (documents)
- Presigned URLs for secure direct uploads

**Alternatives Considered**:
| Solution | Pros | Cons | Why Rejected |
|----------|------|------|--------------|
| Local filesystem | Simple | Backup complexity, no CDN | Scaling, backup |
| PostgreSQL BLOB | Single system | Performance on large files | Query performance |

### CSV Import: Robust Parsing

**Decision**: PapaParse + custom mapping engine

**Rationale**:
- PapaParse handles edge cases (quotes, escapes, encodings)
- Auto-detect separator (comma, semicolon, tab)
- Streaming for large files (>100k rows)
- Custom mapping engine for bank-specific formats

**Duplicate Detection**:
- SHA-256 hash of (date + amount + description normalized)
- Fuzzy matching option for slight variations
- User confirmation before import

### Market Data: Multi-provider Strategy

**Decision**: Pluggable provider system with caching

**Providers (prioritized)**:
1. **Yahoo Finance** (unofficial API): Free, covers stocks/ETF/crypto
2. **Alpha Vantage**: Free tier (500 req/day), reliable
3. **CoinGecko**: Free tier, crypto-focused
4. **ECB/exchangerate.host**: Free FX rates

**Caching Strategy**:
- Redis cache with 1-hour TTL for quotes
- Background refresh via BullMQ scheduled jobs
- Graceful degradation: show stale data with timestamp
- Respect rate limits with exponential backoff

## Security Patterns

### Multi-tenant Isolation

**Implementation**:
```sql
-- Every table has workspace_id
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  ...
);

-- Row-Level Security (optional, defense-in-depth)
CREATE POLICY workspace_isolation ON transactions
  USING (workspace_id = current_setting('app.workspace_id')::uuid);
```

**Application Layer**:
- Middleware extracts workspace_id from JWT
- All queries include workspace_id filter via Prisma middleware
- IDOR protection: verify resource.workspace_id matches request

### RBAC Implementation

**Roles Table**:
```typescript
enum Role {
  OWNER = 'owner',      // Full control, can delete workspace
  ADMIN = 'admin',      // All except delete workspace
  ACCOUNTANT = 'accountant', // Transactions, reports, imports
  MEMBER = 'member',    // View, create transactions
  READONLY = 'readonly' // View only
}
```

**Permission Matrix**:
| Action | Owner | Admin | Accountant | Member | Read-only |
|--------|-------|-------|------------|--------|-----------|
| Delete workspace | Yes | No | No | No | No |
| Manage members | Yes | Yes | No | No | No |
| Export data | Yes | Yes | Yes | No | No |
| Create transactions | Yes | Yes | Yes | Yes | No |
| View transactions | Yes | Yes | Yes | Yes | Yes |
| Manage budgets | Yes | Yes | Yes | No | No |
| Upload documents | Yes | Yes | Yes | Yes | No |

### Audit Logging

**Events Logged**:
- Authentication (login, logout, MFA setup, failed attempts)
- Authorization (permission changes, role assignments)
- Data access (exports, sensitive views)
- Data modification (create, update, delete on sensitive entities)
- Security events (device added, session revoked)

**Log Format**:
```typescript
interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  workspaceId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  ipAddress: string;
  userAgent: string;
  deviceId: string;
  details: Record<string, unknown>;
}
```

## Performance Optimizations

### Database Indexes

```sql
-- Transaction queries (most frequent)
CREATE INDEX idx_transactions_workspace_date
  ON transactions(workspace_id, date DESC);
CREATE INDEX idx_transactions_workspace_category
  ON transactions(workspace_id, category_id);

-- Budget calculations
CREATE INDEX idx_transactions_workspace_category_date
  ON transactions(workspace_id, category_id, date);

-- Document search
CREATE INDEX idx_documents_workspace_inbox
  ON documents(workspace_id, status) WHERE status = 'inbox';
```

### Query Optimization

- Pagination with cursor-based approach (not offset)
- Aggregations computed in SQL, not application
- Materialized views for monthly summaries (refreshed nightly)
- Connection pooling via PgBouncer in Docker

### Frontend Performance

- Code splitting by route (lazy loading)
- Service Worker for offline support
- IndexedDB for draft transactions
- Optimistic updates with TanStack Query
- Virtualized lists for large transaction sets

## Deployment Architecture

### Docker Compose Services

```yaml
services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  minio:
    image: minio/minio
    command: server /data
    volumes:
      - minio_data:/data

  backend:
    build: ./packages/backend
    depends_on: [postgres, redis, minio]

  worker:
    build: ./packages/worker
    depends_on: [postgres, redis]

  frontend:
    build: ./packages/frontend

  traefik:
    image: traefik:v3.0
    ports:
      - "80:80"
      - "443:443"
```

### Resource Requirements (NAS)

| Service | RAM (min) | RAM (recommended) | CPU |
|---------|-----------|-------------------|-----|
| PostgreSQL | 256 MB | 512 MB | 0.5 core |
| Redis | 64 MB | 128 MB | 0.25 core |
| MinIO | 128 MB | 256 MB | 0.25 core |
| Backend | 256 MB | 512 MB | 1 core |
| Worker | 128 MB | 256 MB | 0.5 core |
| Frontend | 64 MB | 128 MB | 0.25 core |
| **Total** | **896 MB** | **1.8 GB** | **2.75 cores** |

Suitable for: Synology DS220+, QNAP TS-253D, or any x86 NAS with 4GB+ RAM.

## Risk Mitigations

### Risk: E2EE Key Loss

**Mitigation**:
- Clear warning during vault setup: "If you lose your master password, data is unrecoverable"
- Optional: encrypted recovery key (print/store separately)
- No server-side recovery mechanism (by design)

### Risk: Market Data Provider Changes

**Mitigation**:
- Pluggable provider architecture
- Multiple fallback providers configured
- Manual entry always available
- Cache persists through provider outages

### Risk: Large CSV Import Failures

**Mitigation**:
- Streaming parser (not full file in memory)
- Transactional import (all-or-nothing)
- Progress reporting via WebSocket
- Resume capability for interrupted imports

### Risk: NAS Resource Constraints

**Mitigation**:
- Aggressive query optimization
- Background job rate limiting
- Memory limits in Docker Compose
- Health checks and auto-restart
