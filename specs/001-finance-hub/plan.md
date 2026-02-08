# Implementation Plan: Finance Hub

**Branch**: `001-finance-hub` | **Date**: 2026-02-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-finance-hub/spec.md`

## Summary

Finance Hub is a self-hosted financial management platform for individuals, families, and small businesses. It centralizes personal finance tracking, document management, budgeting, basic invoicing, and investment portfolio tracking with password-manager-grade security. The application is deployed via Docker on NAS/home servers with a mobile-first PWA interface.

**Core technical approach**:
- Monorepo with TypeScript throughout (frontend + backend)
- PostgreSQL for ledger-first transactional data with strict workspace isolation
- Redis for sessions, caching, and job queues
- PWA frontend with offline-first patterns
- E2EE vault using client-side encryption with Argon2id KDF

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) for both frontend and backend
**Primary Dependencies**:
- Backend: Node.js 20 LTS, Fastify (API), Prisma (ORM), BullMQ (jobs)
- Frontend: React 18, Vite, TanStack Query, Tailwind CSS
- Auth: Passport.js with TOTP/WebAuthn, jose (JWT)
- Crypto: libsodium-wrappers (E2EE), argon2 (KDF)

**Storage**: PostgreSQL 16 (primary), Redis 7 (cache/sessions/jobs), S3-compatible (documents)
**Testing**: Vitest (unit/integration), Playwright (E2E)
**Target Platform**: Docker containers on Linux (NAS: Synology, QNAP, Unraid, generic)
**Project Type**: Web application (monorepo with backend + frontend + worker)

**Performance Goals**:
- UI interactions < 200ms perceived latency
- API p95 < 300ms (excluding imports/OCR)
- Support 10 concurrent users on consumer NAS hardware

**Constraints**:
- 100% self-hosted, no mandatory cloud dependencies
- MFA required for all users
- All data scoped by workspace_id (multi-tenant isolation)
- OWASP ASVS L2 baseline, L3 for vault/auth

**Scale/Scope**:
- 10 concurrent users per instance
- 100,000+ transactions per workspace
- 1-5 GB documents per user/year

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Produit Hub Central | PASS | Finance + Docs + Pro + Invest modules defined; no ERP/broker features |
| II. Conception Modulaire | PASS | 7 modules with clear dependency graph; can be enabled/disabled |
| III. Simplicite en Priorite | PASS | Simple mode default, advanced features behind toggle |
| IV. Securite Best-Possible | PASS | MFA mandatory, Argon2id, E2EE vault, OWASP ASVS L2 |
| V. Multi-Utilisateurs & Workspaces | PASS | 4 workspace types, RBAC, strict isolation via workspace_id |
| VI. Exactitude Comptable | PASS | Ledger-first design, immutable transaction history |
| VII. UX Mobile-First | PASS | PWA, touch-friendly, WCAG 2.1 AA target |
| VIII. Import & Documents | PASS | CSV import, document inbox, rules engine |
| IX. Performance & Fiabilite | PASS | <200ms UI, <300ms API p95, async workers |
| X. Deploiement Docker | PASS | docker-compose with all services defined |

**All gates passed. Proceeding to Phase 0.**

## Project Structure

### Documentation (this feature)

```text
specs/001-finance-hub/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
│   ├── api.yaml         # Main API contract
│   └── events.md        # Domain events
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/           # Authentication, sessions, MFA
│   │   │   ├── users/          # User management
│   │   │   ├── workspaces/     # Workspace & membership
│   │   │   ├── accounts/       # Financial accounts
│   │   │   ├── transactions/   # Transaction ledger
│   │   │   ├── categories/     # Categories & tags
│   │   │   ├── budgets/        # Budget tracking
│   │   │   ├── documents/      # Document storage
│   │   │   ├── rules/          # Automation rules
│   │   │   ├── import/         # CSV/OFX import
│   │   │   ├── pro/            # Invoicing (V1)
│   │   │   ├── invest/         # Investments (V2)
│   │   │   └── reports/        # Reporting & exports
│   │   ├── core/
│   │   │   ├── database/       # Prisma client, migrations
│   │   │   ├── auth/           # Auth middleware, guards
│   │   │   ├── crypto/         # E2EE, Argon2id utilities
│   │   │   ├── queue/          # BullMQ setup
│   │   │   └── storage/        # S3 adapter
│   │   ├── api/
│   │   │   └── routes/         # Fastify route handlers
│   │   └── app.ts              # Application entry
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── tests/
│       ├── unit/
│       └── integration/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/             # Design system components
│   │   │   ├── forms/          # Form components
│   │   │   └── layout/         # Layout components
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── transactions/
│   │   │   ├── budgets/
│   │   │   ├── documents/
│   │   │   ├── settings/
│   │   │   └── workspaces/
│   │   ├── lib/
│   │   │   ├── api/            # API client
│   │   │   ├── crypto/         # Client-side E2EE
│   │   │   └── storage/        # IndexedDB, localStorage
│   │   ├── hooks/
│   │   ├── stores/
│   │   └── main.tsx
│   ├── public/
│   │   └── manifest.json       # PWA manifest
│   └── tests/
│       ├── unit/
│       └── e2e/
│
├── worker/
│   ├── src/
│   │   ├── jobs/
│   │   │   ├── import.ts       # CSV import processor
│   │   │   ├── marketdata.ts   # Market data fetcher
│   │   │   ├── backup.ts       # Backup jobs
│   │   │   └── cleanup.ts      # Cleanup jobs
│   │   └── index.ts
│   └── tests/
│
└── shared/
    ├── types/                  # Shared TypeScript types
    ├── constants/              # Shared constants
    └── validation/             # Zod schemas

docker/
├── docker-compose.yml
├── docker-compose.dev.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── Dockerfile.worker
└── config/
    ├── traefik/
    └── postgres/

tests/
└── e2e/                        # Cross-package E2E tests
```

**Structure Decision**: Monorepo with `packages/` layout chosen for:
- Shared types between frontend/backend
- Unified tooling (TypeScript, ESLint, Prettier)
- Atomic deployments via Docker Compose
- Clear separation of concerns (backend API, frontend PWA, worker jobs)

## Complexity Tracking

> No Constitution violations requiring justification.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Monorepo | 3 packages (backend, frontend, worker) | Shared types, unified CI, modular deployment |
| ORM | Prisma | Type-safe queries, migrations, good PostgreSQL support |
| API | Fastify | Performance, TypeScript-first, plugin ecosystem |
| Frontend | React + Vite | Modern tooling, PWA support, ecosystem |
| Job Queue | BullMQ | Redis-based, reliable, good monitoring |
