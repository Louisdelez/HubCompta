# Tasks: Finance Hub

**Input**: Design documents from `/specs/001-finance-hub/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api.yaml, research.md

**Tests**: Not explicitly requested in spec. Tests are excluded from task list.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**: `packages/backend/src/`, `packages/frontend/src/`, `packages/worker/src/`
- **Shared**: `packages/shared/`
- **Docker**: `docker/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, monorepo structure, and tooling

- [X] T001 Create monorepo structure with packages/backend, packages/frontend, packages/worker, packages/shared directories
- [X] T002 Initialize root package.json with pnpm workspaces configuration
- [X] T003 [P] Configure TypeScript 5.x with strict mode in tsconfig.json (root + per-package)
- [X] T004 [P] Configure ESLint with TypeScript rules in .eslintrc.cjs
- [X] T005 [P] Configure Prettier in .prettierrc
- [X] T006 [P] Create docker/docker-compose.yml with PostgreSQL, Redis, MinIO services
- [X] T007 [P] Create docker/docker-compose.dev.yml for development environment
- [X] T008 Initialize packages/backend with Fastify dependencies in packages/backend/package.json
- [X] T009 Initialize packages/frontend with React 18 + Vite + Tailwind in packages/frontend/package.json
- [X] T010 Initialize packages/worker with BullMQ in packages/worker/package.json
- [X] T011 [P] Create packages/shared/types/index.ts with shared type exports
- [X] T012 [P] Create packages/shared/constants/index.ts with shared constants
- [X] T013 [P] Create packages/shared/validation/index.ts with Zod schema exports

**Checkpoint**: Monorepo ready with all packages initialized

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Database & Core

- [X] T014 Create Prisma schema with User, MFA, Device, Session entities in packages/backend/prisma/schema.prisma
- [X] T015 Add Workspace, Membership entities to packages/backend/prisma/schema.prisma
- [X] T016 Add Account, Transaction, Category, Tag, Budget entities to packages/backend/prisma/schema.prisma
- [X] T017 Add Document, DocumentLink, Rule, Recurrence entities to packages/backend/prisma/schema.prisma
- [X] T018 Add AuditLog entity to packages/backend/prisma/schema.prisma
- [X] T019 Run initial Prisma migration in packages/backend/prisma/migrations/ (run: npx prisma migrate dev)
- [X] T020 Create Prisma client singleton in packages/backend/src/core/database/client.ts

### Core Services

- [X] T021 [P] Implement Argon2id password hashing in packages/backend/src/core/crypto/password.ts
- [X] T022 [P] Implement JWT token utilities (sign, verify, refresh) in packages/backend/src/core/crypto/jwt.ts
- [X] T023 [P] Create Redis client singleton in packages/backend/src/core/database/redis.ts
- [X] T024 [P] Implement S3 storage adapter for MinIO in packages/backend/src/core/storage/s3.ts
- [X] T025 Implement BullMQ queue setup in packages/backend/src/core/queue/index.ts

### API Framework

- [X] T026 Create Fastify app entry with plugins in packages/backend/src/app.ts
- [X] T027 Implement error handling middleware in packages/backend/src/core/middleware/errorHandler.ts
- [X] T028 Implement request logging middleware in packages/backend/src/core/middleware/logger.ts
- [X] T029 Implement workspace context middleware in packages/backend/src/core/middleware/workspaceContext.ts
- [X] T030 Create route registration helper in packages/backend/src/api/routes/index.ts

### Frontend Framework

- [X] T031 Create Vite config with PWA plugin in packages/frontend/vite.config.ts
- [X] T032 Create Tailwind config in packages/frontend/tailwind.config.js
- [X] T033 Create main React entry in packages/frontend/src/main.tsx
- [X] T034 Create API client with TanStack Query in packages/frontend/src/lib/api/client.ts
- [X] T035 Create auth context provider in packages/frontend/src/features/auth/AuthProvider.tsx
- [X] T036 Create base layout component in packages/frontend/src/components/layout/AppLayout.tsx
- [X] T037 [P] Create PWA manifest in packages/frontend/public/manifest.json
- [X] T038 [P] Create service worker registration in packages/frontend/src/lib/pwa/register.ts

### Worker Framework

- [X] T039 Create worker entry with BullMQ connection in packages/worker/src/index.ts
- [X] T040 Create job processor registry in packages/worker/src/jobs/registry.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 4 - Authentification securisee (Priority: P1)

**Goal**: Secure authentication with mandatory MFA, session management, and device tracking

**Independent Test**: User can register, configure TOTP MFA, login with 2FA, and manage sessions

**Note**: Authentication is implemented first because all other user stories depend on it

### Backend Implementation

- [X] T041 [US4] Create User service with CRUD operations in packages/backend/src/modules/users/user.service.ts
- [X] T042 [US4] Create MFA service with TOTP/WebAuthn support in packages/backend/src/modules/auth/mfa.service.ts
- [X] T043 [US4] Create Session service with lock/unlock in packages/backend/src/modules/auth/session.service.ts
- [X] T044 [US4] Create Device service for device tracking in packages/backend/src/modules/auth/device.service.ts
- [X] T045 [US4] Implement auth guard middleware in packages/backend/src/core/auth/authGuard.ts
- [X] T046 [US4] Implement step-up auth middleware in packages/backend/src/core/auth/stepUpGuard.ts
- [X] T047 [US4] Create POST /auth/register endpoint in packages/backend/src/api/routes/auth.ts
- [X] T048 [US4] Create POST /auth/login endpoint in packages/backend/src/api/routes/auth.ts
- [X] T049 [US4] Create POST /auth/mfa/verify endpoint in packages/backend/src/api/routes/auth.ts
- [X] T050 [US4] Create POST /auth/mfa/setup endpoint in packages/backend/src/api/routes/auth.ts
- [X] T051 [US4] Create POST /auth/refresh endpoint in packages/backend/src/api/routes/auth.ts
- [X] T052 [US4] Create POST /auth/logout endpoint in packages/backend/src/api/routes/auth.ts
- [X] T053 [US4] Create POST /auth/lock and POST /auth/unlock endpoints in packages/backend/src/api/routes/auth.ts
- [X] T054 [US4] Create GET /user/devices and DELETE /user/devices/:id endpoints in packages/backend/src/api/routes/user.ts
- [X] T055 [US4] Implement AuditLog service for security events in packages/backend/src/modules/audit/audit.service.ts

### Frontend Implementation

- [X] T056 [US4] Create login form component in packages/frontend/src/features/auth/LoginForm.tsx
- [X] T057 [US4] Create registration form component in packages/frontend/src/features/auth/RegisterForm.tsx
- [X] T058 [US4] Create MFA setup flow component in packages/frontend/src/features/auth/MfaSetup.tsx
- [X] T059 [US4] Create MFA verification component in packages/frontend/src/features/auth/MfaVerify.tsx
- [X] T060 [US4] Create session lock screen in packages/frontend/src/features/auth/LockScreen.tsx
- [X] T061 [US4] Create device management page in packages/frontend/src/features/settings/DevicesPage.tsx
- [X] T062 [US4] Implement auth store with session state in packages/frontend/src/stores/authStore.ts
- [X] T063 [US4] Implement inactivity lock timer hook in packages/frontend/src/hooks/useInactivityLock.ts

**Checkpoint**: Users can register, setup MFA, login, and manage sessions

---

## Phase 4: User Story 3 - Gestion multi-utilisateurs et workspaces (Priority: P1)

**Goal**: Multi-tenant workspace system with RBAC and data isolation

**Independent Test**: Multiple users can create/join workspaces, each with isolated data and role-based access

### Backend Implementation

- [X] T064 [US3] Create Workspace service in packages/backend/src/modules/workspaces/workspace.service.ts
- [X] T065 [US3] Create Membership service with RBAC in packages/backend/src/modules/workspaces/membership.service.ts
- [X] T066 [US3] Create invitation service in packages/backend/src/modules/workspaces/invitation.service.ts
- [X] T067 [US3] Implement RBAC permission checking in packages/backend/src/core/auth/rbac.ts
- [X] T068 [US3] Create GET/POST /workspaces endpoints in packages/backend/src/api/routes/workspaces.ts
- [X] T069 [US3] Create GET /workspaces/:id endpoint in packages/backend/src/api/routes/workspaces.ts
- [X] T070 [US3] Create POST /workspaces/:id/invite endpoint in packages/backend/src/api/routes/workspaces.ts
- [X] T071 [US3] Create GET /workspaces/:id/members endpoint in packages/backend/src/api/routes/workspaces.ts
- [X] T072 [US3] Create PATCH /workspaces/:id/members/:memberId endpoint in packages/backend/src/api/routes/workspaces.ts
- [X] T073 [US3] Create DELETE /workspaces/:id/members/:memberId endpoint in packages/backend/src/api/routes/workspaces.ts

### Frontend Implementation

- [X] T074 [US3] Create workspace selector component in packages/frontend/src/features/workspaces/WorkspaceSelector.tsx
- [X] T075 [US3] Create workspace creation modal in packages/frontend/src/features/workspaces/CreateWorkspaceModal.tsx
- [X] T076 [US3] Create workspace settings page in packages/frontend/src/features/workspaces/WorkspaceSettings.tsx
- [X] T077 [US3] Create member management page in packages/frontend/src/features/workspaces/MembersPage.tsx
- [X] T078 [US3] Create invitation flow in packages/frontend/src/features/workspaces/InviteMember.tsx
- [X] T079 [US3] Implement workspace store in packages/frontend/src/stores/workspaceStore.ts

**Checkpoint**: Multi-tenant workspace system functional with RBAC

---

## Phase 5: User Story 1 - Gestion des transactions quotidiennes (Priority: P1) - MVP

**Goal**: Core transaction management with accounts, categories, tags, and monthly summary

**Independent Test**: User can create accounts, add/categorize transactions, view monthly summary

### Backend Implementation

- [X] T080 [US1] Create Account service in packages/backend/src/modules/accounts/account.service.ts
- [X] T081 [US1] Create Transaction service in packages/backend/src/modules/transactions/transaction.service.ts
- [X] T082 [US1] Create Category service with hierarchy in packages/backend/src/modules/categories/category.service.ts
- [X] T083 [US1] Create Tag service in packages/backend/src/modules/categories/tag.service.ts
- [X] T084 [US1] Create Transfer service for account transfers in packages/backend/src/modules/transactions/transfer.service.ts
- [X] T085 [US1] Implement balance calculation logic in packages/backend/src/modules/accounts/balance.service.ts
- [X] T086 [US1] Create GET/POST /workspaces/:id/accounts endpoints in packages/backend/src/api/routes/accounts.ts
- [X] T087 [US1] Create GET/PATCH/DELETE /workspaces/:id/accounts/:accountId endpoints in packages/backend/src/api/routes/accounts.ts
- [X] T088 [US1] Create GET/POST /workspaces/:id/transactions endpoints in packages/backend/src/api/routes/transactions.ts
- [X] T089 [US1] Create GET/PATCH/DELETE /workspaces/:id/transactions/:id endpoints in packages/backend/src/api/routes/transactions.ts
- [X] T090 [US1] Create GET/POST /workspaces/:id/categories endpoints in packages/backend/src/api/routes/categories.ts
- [X] T091 [US1] Create GET/POST /workspaces/:id/tags endpoints in packages/backend/src/api/routes/tags.ts
- [X] T092 [US1] Create GET /workspaces/:id/reports/summary endpoint in packages/backend/src/api/routes/reports.ts
- [X] T093 [US1] Seed default categories in packages/backend/prisma/seed.ts

### Frontend Implementation

- [X] T094 [US1] Create dashboard page with summary in packages/frontend/src/features/dashboard/DashboardPage.tsx
- [X] T095 [US1] Create account list component in packages/frontend/src/features/accounts/AccountList.tsx
- [X] T096 [US1] Create account form component in packages/frontend/src/features/accounts/AccountForm.tsx
- [X] T097 [US1] Create transaction list with filters in packages/frontend/src/features/transactions/TransactionList.tsx
- [X] T098 [US1] Create transaction form modal in packages/frontend/src/features/transactions/TransactionForm.tsx
- [X] T099 [US1] Create category selector component in packages/frontend/src/features/transactions/CategorySelector.tsx
- [X] T100 [US1] Create tag input component in packages/frontend/src/features/transactions/TagInput.tsx
- [X] T101 [US1] Create monthly summary component in packages/frontend/src/features/dashboard/MonthlySummary.tsx
- [X] T102 [US1] Create category breakdown chart in packages/frontend/src/features/dashboard/CategoryChart.tsx
- [X] T103 [US1] Implement FAB "+" button for quick add in packages/frontend/src/components/ui/FloatingActionButton.tsx

**Checkpoint**: MVP complete - users can manage accounts, transactions, and view summaries

---

## Phase 6: User Story 2 - Import de donnees bancaires (Priority: P1)

**Goal**: CSV import with auto-detection, duplicate handling, and rule-based categorization

**Independent Test**: User can import bank CSV, map columns, detect duplicates, apply categorization rules

### Backend Implementation

- [X] T104 [US2] Create CSV parser with format detection in packages/backend/src/modules/import/csv.parser.ts
- [X] T105 [US2] Create import service with duplicate detection in packages/backend/src/modules/import/import.service.ts
- [X] T106 [US2] Create Rule service for auto-categorization in packages/backend/src/modules/rules/rule.service.ts
- [X] T107 [US2] Create import job processor in packages/worker/src/jobs/import.ts
- [X] T108 [US2] Create POST /workspaces/:id/import/preview endpoint in packages/backend/src/api/routes/import.ts
- [X] T109 [US2] Create POST /workspaces/:id/import/execute endpoint in packages/backend/src/api/routes/import.ts
- [X] T110 [US2] Create GET /workspaces/:id/import/:jobId endpoint in packages/backend/src/api/routes/import.ts
- [X] T111 [US2] Create GET/POST /workspaces/:id/rules endpoints in packages/backend/src/api/routes/rules.ts

### Frontend Implementation

- [X] T112 [US2] Create import wizard component in packages/frontend/src/features/import/ImportWizard.tsx
- [X] T113 [US2] Create file upload step in packages/frontend/src/features/import/FileUploadStep.tsx
- [X] T114 [US2] Create column mapping step in packages/frontend/src/features/import/ColumnMappingStep.tsx
- [X] T115 [US2] Create preview/confirm step in packages/frontend/src/features/import/PreviewStep.tsx
- [X] T116 [US2] Create import progress indicator in packages/frontend/src/features/import/ImportProgress.tsx
- [X] T117 [US2] Create rules management page in packages/frontend/src/features/rules/RulesPage.tsx
- [X] T118 [US2] Create rule editor component in packages/frontend/src/features/rules/RuleEditor.tsx

**Checkpoint**: CSV import functional with duplicate detection and auto-categorization

---

## Phase 7: User Story 6 - Budgets et suivi des depenses (Priority: P2)

**Goal**: Budget creation and real-time tracking with alerts

**Independent Test**: User can create budget per category, see progress, receive threshold alerts

### Backend Implementation

- [X] T119 [US6] Create Budget service with spending calculation in packages/backend/src/modules/budgets/budget.service.ts
- [X] T120 [US6] Create budget alert logic in packages/backend/src/modules/budgets/alert.service.ts
- [X] T121 [US6] Create GET/POST /workspaces/:id/budgets endpoints in packages/backend/src/api/routes/budgets.ts
- [X] T122 [US6] Create GET/PATCH/DELETE /workspaces/:id/budgets/:id endpoints in packages/backend/src/api/routes/budgets.ts

### Frontend Implementation

- [X] T123 [US6] Create budgets page in packages/frontend/src/features/budgets/BudgetsPage.tsx
- [X] T124 [US6] Create budget card with progress in packages/frontend/src/features/budgets/BudgetCard.tsx
- [X] T125 [US6] Create budget form modal in packages/frontend/src/features/budgets/BudgetForm.tsx
- [X] T126 [US6] Create budget history chart in packages/frontend/src/features/budgets/BudgetHistory.tsx
- [X] T127 [US6] Integrate budget alerts in dashboard in packages/frontend/src/features/dashboard/BudgetAlerts.tsx

**Checkpoint**: Budget tracking functional with real-time progress and alerts

---

## Phase 8: User Story 5 - Gestion des documents et justificatifs (Priority: P2)

**Goal**: Document upload, inbox management, and transaction linking

**Independent Test**: User can upload document, find in inbox, link to transaction

### Backend Implementation

- [X] T128 [US5] Create Document service with upload handling in packages/backend/src/modules/documents/document.service.ts
- [X] T129 [US5] Create document hash duplicate detection in packages/backend/src/modules/documents/duplicate.service.ts
- [X] T130 [US5] Create presigned URL generation in packages/backend/src/modules/documents/upload.service.ts
- [X] T131 [US5] Create POST /workspaces/:id/documents/upload-url endpoint in packages/backend/src/api/routes/documents.ts
- [X] T132 [US5] Create GET /workspaces/:id/documents endpoint in packages/backend/src/api/routes/documents.ts
- [X] T133 [US5] Create POST /workspaces/:id/documents/:id/link endpoint in packages/backend/src/api/routes/documents.ts
- [X] T134 [US5] Create DELETE /workspaces/:id/documents/:id/link/:txId endpoint in packages/backend/src/api/routes/documents.ts
- [X] T135 [US5] Create document cleanup job in packages/worker/src/jobs/cleanup.ts

### Frontend Implementation

- [X] T136 [US5] Create documents page with inbox filter in packages/frontend/src/features/documents/DocumentsPage.tsx
- [X] T137 [US5] Create document upload component in packages/frontend/src/features/documents/DocumentUpload.tsx
- [X] T138 [US5] Create document card component in packages/frontend/src/features/documents/DocumentCard.tsx
- [X] T139 [US5] Create document viewer modal in packages/frontend/src/features/documents/DocumentViewer.tsx
- [X] T140 [US5] Create link to transaction modal in packages/frontend/src/features/documents/LinkToTransaction.tsx
- [X] T141 [US5] Add document attachment to transaction form in packages/frontend/src/features/transactions/TransactionForm.tsx

**Checkpoint**: Document management functional with upload, inbox, and linking

---

## Phase 9: User Story 3 Extension - Settlement colocation (Priority: P1)

**Goal**: Calculate "who owes whom" for flatshare workspaces

**Independent Test**: Flatshare members can see balanced settlement calculation

### Backend Implementation

- [X] T142 [US3] Create Settlement service in packages/backend/src/modules/workspaces/settlement.service.ts
- [X] T143 [US3] Create GET /workspaces/:id/settlement endpoint in packages/backend/src/api/routes/workspaces.ts

### Frontend Implementation

- [X] T144 [US3] Create settlement page in packages/frontend/src/features/workspaces/SettlementPage.tsx
- [X] T145 [US3] Create balance visualization in packages/frontend/src/features/workspaces/BalanceChart.tsx
- [X] T146 [US3] Create transfer suggestions component in packages/frontend/src/features/workspaces/TransferSuggestions.tsx

**Checkpoint**: Flatshare settlement calculation functional

---

## Phase 10: User Story 7 - Mode Pro - Facturation basique (Priority: P3)

**Goal**: Client/supplier management, quotes, and invoices for auto-entrepreneurs

**Independent Test**: User can create client, generate quote, convert to invoice, mark as paid

### Database Extension

- [X] T147 [US7] Add Contact, Quote, Invoice, InvoiceLine entities to packages/backend/prisma/schema.prisma
- [ ] T148 [US7] Run Prisma migration for Pro entities

### Backend Implementation

- [X] T149 [US7] Create Contact service in packages/backend/src/modules/pro/contact.service.ts
- [X] T150 [US7] Create Quote service in packages/backend/src/modules/pro/quote.service.ts
- [X] T151 [US7] Create Invoice service with numbering in packages/backend/src/modules/pro/invoice.service.ts
- [X] T152 [US7] Create VAT calculation utilities in packages/backend/src/modules/pro/vat.utils.ts
- [X] T153 [US7] Create GET/POST /workspaces/:id/contacts endpoints in packages/backend/src/api/routes/contacts.ts
- [X] T154 [US7] Create GET/POST /workspaces/:id/quotes endpoints in packages/backend/src/api/routes/quotes.ts
- [X] T155 [US7] Create POST /workspaces/:id/quotes/:id/convert endpoint in packages/backend/src/api/routes/quotes.ts
- [X] T156 [US7] Create GET/POST /workspaces/:id/invoices endpoints in packages/backend/src/api/routes/invoices.ts
- [X] T157 [US7] Create PATCH /workspaces/:id/invoices/:id/pay endpoint in packages/backend/src/api/routes/invoices.ts

### Frontend Implementation

- [X] T158 [US7] Create contacts page in packages/frontend/src/features/pro/ContactsPage.tsx
- [X] T159 [US7] Create contact form in packages/frontend/src/features/pro/ContactForm.tsx
- [X] T160 [US7] Create quotes page in packages/frontend/src/features/pro/QuotesPage.tsx
- [X] T161 [US7] Create quote editor in packages/frontend/src/features/pro/QuoteForm.tsx
- [X] T162 [US7] Create invoices page in packages/frontend/src/features/pro/InvoicesPage.tsx
- [X] T163 [US7] Create invoice editor in packages/frontend/src/features/pro/InvoiceForm.tsx
- [X] T164 [US7] Create invoice PDF preview in packages/frontend/src/features/pro/InvoicePdf.tsx

**Checkpoint**: Pro mode functional with contacts, quotes, and invoices

---

## Phase 11: User Story 8 - Suivi des investissements (Priority: P3)

**Goal**: Investment portfolio tracking with market data integration

**Independent Test**: User can add positions, see current valuation and performance

### Database Extension

- [X] T165 [US8] Add Asset, Position, InvestTransaction, Watchlist entities to packages/backend/prisma/schema.prisma
- [ ] T166 [US8] Run Prisma migration for Invest entities

### Backend Implementation

- [X] T167 [US8] Create Asset service with provider integration in packages/backend/src/modules/invest/asset.service.ts
- [X] T168 [US8] Create Position service with PRU calculation in packages/backend/src/modules/invest/position.service.ts
- [X] T169 [US8] Create market data fetcher job in packages/worker/src/jobs/marketdata.ts
- [X] T170 [US8] Create Yahoo Finance provider in packages/backend/src/modules/invest/providers/yahoo.ts
- [X] T171 [US8] Create CoinGecko provider in packages/backend/src/modules/invest/providers/coingecko.ts
- [X] T172 [US8] Create GET /assets/search endpoint in packages/backend/src/api/routes/assets.ts
- [X] T173 [US8] Create GET/POST /workspaces/:id/positions endpoints in packages/backend/src/api/routes/positions.ts
- [X] T174 [US8] Create POST /workspaces/:id/positions/:id/transactions endpoint in packages/backend/src/api/routes/positions.ts
- [X] T175 [US8] Create GET /workspaces/:id/portfolio/summary endpoint in packages/backend/src/api/routes/portfolio.ts

### Frontend Implementation

- [X] T176 [US8] Create portfolio dashboard in packages/frontend/src/features/invest/PortfolioPage.tsx
- [X] T177 [US8] Create position list in packages/frontend/src/features/invest/PositionList.tsx
- [X] T178 [US8] Create add position form in packages/frontend/src/features/invest/AddPositionModal.tsx
- [X] T179 [US8] Create asset search component in packages/frontend/src/features/invest/AssetSearch.tsx
- [X] T180 [US8] Create allocation pie chart in packages/frontend/src/features/invest/AllocationChart.tsx
- [X] T181 [US8] Create position detail view in packages/frontend/src/features/invest/PositionDetail.tsx
- [X] T182 [US8] Create performance chart in packages/frontend/src/features/invest/PerformanceChart.tsx

**Checkpoint**: Investment tracking functional with market data

---

## Phase 12: User Story 9 - Reporting et exports (Priority: P3)

**Goal**: Generate reports and export data in various formats

**Independent Test**: User can generate monthly PDF report and export CSV

### Backend Implementation

- [X] T183 [US9] Create Report service with aggregations in packages/backend/src/modules/reports/report.service.ts
- [X] T184 [US9] Create PDF generation service in packages/backend/src/modules/reports/pdf.service.ts
- [X] T185 [US9] Create CSV export service in packages/backend/src/modules/reports/export.service.ts
- [X] T186 [US9] Create export job processor in packages/worker/src/jobs/export.ts
- [X] T187 [US9] Create GET /workspaces/:id/reports/net-worth endpoint in packages/backend/src/api/routes/reports.ts
- [X] T188 [US9] Create POST /workspaces/:id/export endpoint in packages/backend/src/api/routes/export.ts
- [X] T189 [US9] Create GET /workspaces/:id/export/:jobId endpoint in packages/backend/src/api/routes/export.ts

### Frontend Implementation

- [X] T190 [US9] Create reports page in packages/frontend/src/features/reports/ReportsPage.tsx
- [X] T191 [US9] Create net worth chart in packages/frontend/src/features/reports/NetWorthChart.tsx
- [X] T192 [US9] Create export modal in packages/frontend/src/features/reports/ExportModal.tsx
- [X] T193 [US9] Create report date range selector in packages/frontend/src/features/reports/DateRangeSelector.tsx

**Checkpoint**: Reporting and exports functional

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Docker & Deployment

- [X] T194 [P] Create Dockerfile.backend in docker/Dockerfile.backend
- [X] T195 [P] Create Dockerfile.frontend in docker/Dockerfile.frontend
- [X] T196 [P] Create Dockerfile.worker in docker/Dockerfile.worker
- [X] T197 Create Traefik configuration in docker/config/traefik/
- [X] T198 Create production docker-compose.yml with all services in docker/docker-compose.prod.yml

### Backup & Recovery

- [X] T199 Create backup job in packages/worker/src/jobs/backup.ts
- [X] T200 Create POST /admin/backup endpoint in packages/backend/src/api/routes/admin.ts
- [X] T201 Create backup restore script in scripts/restore.sh

### Health & Monitoring

- [X] T202 [P] Create GET /health endpoint in packages/backend/src/api/routes/health.ts
- [X] T203 [P] Create GET /health/db endpoint in packages/backend/src/api/routes/health.ts
- [X] T204 [P] Create GET /health/redis endpoint in packages/backend/src/api/routes/health.ts
- [X] T205 [P] Create GET /health/storage endpoint in packages/backend/src/api/routes/health.ts

### PWA & Offline

- [X] T206 Configure service worker for offline caching in packages/frontend/src/lib/pwa/sw.ts
- [X] T207 Implement IndexedDB for draft transactions in packages/frontend/src/lib/storage/indexedDb.ts

### Security Hardening

- [X] T208 Add rate limiting middleware in packages/backend/src/core/middleware/rateLimit.ts
- [X] T209 Add CORS configuration in packages/backend/src/core/middleware/cors.ts
- [X] T210 Add Helmet security headers in packages/backend/src/core/middleware/helmet.ts

### Final Validation

- [X] T211 Run quickstart.md deployment validation (see docker/README.md)
- [X] T212 Verify all API endpoints match contracts/api.yaml (see scripts/verify-api.sh)
- [ ] T213 Performance testing on NAS-equivalent hardware (manual testing required)

---

## Phase 14: Notifications & Alerts

**Goal**: Real-time notification system with configurable alerts

**Independent Test**: User receives alerts for budget thresholds, invoice due dates, and recurring transactions

### Backend Implementation

- [X] T214 Create notification service in packages/backend/src/modules/notifications/notification.service.ts
- [X] T215 Create alert rules service in packages/backend/src/modules/notifications/alert.service.ts
- [X] T216 Create notification API routes in packages/backend/src/api/routes/notifications.ts

### Frontend Implementation

- [X] T217 Create notification center in packages/frontend/src/features/notifications/NotificationCenter.tsx
- [X] T218 Create alert settings page in packages/frontend/src/features/notifications/AlertSettings.tsx
- [X] T219 Create notification toast component in packages/frontend/src/features/notifications/NotificationToast.tsx
- [X] T220 Integrate notifications in header in packages/frontend/src/components/layout/AppLayout.tsx

**Checkpoint**: Notification system functional with configurable alerts

---

## Phase 15: UI/UX Polish

**Goal**: Improved user experience with animations, loading states, and responsive design

**Independent Test**: Application is fully responsive and provides smooth user feedback

### Frontend Implementation

- [X] T221 Create loading skeleton components in packages/frontend/src/components/ui/Skeleton.tsx
- [X] T222 Add page transitions and animations
- [X] T223 Improve mobile responsiveness across all pages
- [X] T224 Create empty state components in packages/frontend/src/components/ui/EmptyState.tsx
- [X] T225 Add keyboard shortcuts for common actions

**Checkpoint**: UI polished with improved user experience

---

## Phase 16: Recurring Transactions

**Goal**: Automated recurring transaction management with flexible scheduling

**Independent Test**: User can create recurring transactions that auto-generate on schedule

### Backend Implementation

- [X] T226 Create recurrence service in packages/backend/src/modules/transactions/recurrence.service.ts
- [X] T227 Create recurrence generator job in packages/worker/src/jobs/recurrence.ts
- [X] T228 Create recurrence API routes in packages/backend/src/api/routes/recurrences.ts

### Frontend Implementation

- [X] T229 Create recurrences page in packages/frontend/src/features/recurrences/RecurrencesPage.tsx
- [X] T230 Create recurrence form in packages/frontend/src/features/recurrences/RecurrenceForm.tsx
- [X] T231 Create recurrence list component in packages/frontend/src/features/recurrences/RecurrenceList.tsx
- [X] T232 Add recurrence option to transaction form

**Checkpoint**: Recurring transactions functional with auto-generation

---

## Phase 17: Multi-Currency Support

**Goal**: Support for multiple currencies with automatic exchange rate updates

**Independent Test**: User can create accounts in different currencies and see unified totals

### Backend Implementation

- [X] T233 Create currency service in packages/backend/src/modules/currency/currency.service.ts
- [X] T234 Create exchange rate provider in packages/backend/src/modules/currency/exchangerate.provider.ts
- [X] T235 Create exchange rate update job in packages/worker/src/jobs/exchangerates.ts
- [X] T236 Create currency API routes in packages/backend/src/api/routes/currencies.ts

### Frontend Implementation

- [X] T237 Create currency selector component in packages/frontend/src/features/currency/CurrencySelector.tsx
- [X] T238 Create exchange rates page in packages/frontend/src/features/currency/ExchangeRatesPage.tsx
- [X] T239 Update account form for currency selection
- [X] T240 Add currency conversion display in dashboard

**Checkpoint**: Multi-currency support functional with automatic rate updates

---

## Phase 18: Advanced Search

**Goal**: Global search across all entities with advanced filtering and saved searches

**Independent Test**: User can search transactions, documents, contacts and save filter presets

### Backend Implementation

- [X] T241 Create search service in packages/backend/src/modules/search/search.service.ts
- [X] T242 Create saved filters service in packages/backend/src/modules/search/filters.service.ts
- [X] T243 Add SavedFilter model to Prisma schema
- [X] T244 Create search API routes in packages/backend/src/api/routes/search.ts

### Frontend Implementation

- [X] T245 Create global search bar in packages/frontend/src/features/search/GlobalSearchBar.tsx
- [X] T246 Create search results page in packages/frontend/src/features/search/SearchPage.tsx
- [X] T247 Create advanced filters component in packages/frontend/src/features/search/AdvancedFilters.tsx
- [X] T248 Create saved filters component in packages/frontend/src/features/search/SavedFilters.tsx
- [X] T249 Add Cmd/Ctrl+K keyboard shortcut for search

**Checkpoint**: Advanced search functional with saved filters

---

## Phase 19: Data Export & Backup

**Goal**: Complete data export and backup/restore functionality

**Independent Test**: User can export data in multiple formats and restore from backup

### Backend Implementation

- [X] T250 Create export service in packages/backend/src/modules/export/export.service.ts
- [X] T251 Create backup service with full workspace export
- [X] T252 Create report generator (monthly, yearly, category, account)
- [X] T253 Create export API routes in packages/backend/src/api/routes/export.ts

### Frontend Implementation

- [X] T254 Create export page in packages/frontend/src/features/export/ExportPage.tsx
- [X] T255 Create export dialog in packages/frontend/src/features/export/ExportDialog.tsx
- [X] T256 Create backup/restore card in packages/frontend/src/features/export/BackupRestoreCard.tsx
- [X] T257 Add export link to navigation sidebar

**Checkpoint**: Export and backup functionality complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately ✅
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories ✅
- **US4 Auth (Phase 3)**: Depends on Foundational - BLOCKS all other user stories ✅
- **US3 Workspaces (Phase 4)**: Depends on US4 Auth ✅
- **US1 Transactions (Phase 5)**: Depends on US3 Workspaces - MVP MILESTONE ✅
- **US2 Import (Phase 6)**: Depends on US1 Transactions ✅
- **US6 Budgets (Phase 7)**: Depends on US1 Transactions ✅
- **US5 Documents (Phase 8)**: Depends on US1 Transactions ✅
- **US3 Settlement (Phase 9)**: Depends on US3 Workspaces ✅
- **US7 Pro (Phase 10)**: Depends on US1 Transactions ✅
- **US8 Invest (Phase 11)**: Depends on US1 Transactions ✅
- **US9 Reports (Phase 12)**: Depends on US1 Transactions ✅
- **Notifications (Phase 14)**: Depends on core user stories ✅
- **UI/UX Polish (Phase 15)**: Depends on core user stories ✅
- **Recurring (Phase 16)**: Depends on US1 Transactions ✅
- **Multi-Currency (Phase 17)**: Depends on US1 Transactions ✅
- **Advanced Search (Phase 18)**: Depends on core entities ✅
- **Export/Backup (Phase 19)**: Depends on core entities ✅
- **Production Polish (Phase 13)**: Depends on all features - FINAL PHASE ✅

### User Story Dependencies

```
     ┌─────────────────────────────────────────────────────────────┐
     │                    Phase 1: Setup ✅                         │
     └─────────────────────────────────────────────────────────────┘
                                    │
     ┌─────────────────────────────────────────────────────────────┐
     │                Phase 2: Foundational ✅                      │
     └─────────────────────────────────────────────────────────────┘
                                    │
     ┌─────────────────────────────────────────────────────────────┐
     │            Phase 3: US4 - Authentication ✅                  │
     └─────────────────────────────────────────────────────────────┘
                                    │
     ┌─────────────────────────────────────────────────────────────┐
     │            Phase 4: US3 - Workspaces ✅                      │
     └─────────────────────────────────────────────────────────────┘
                                    │
     ┌─────────────────────────────────────────────────────────────┐
     │         Phase 5: US1 - Transactions - MVP ✅                 │
     └─────────────────────────────────────────────────────────────┘
           │                │                │                │
    ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐
    │ Phase 6 ✅  │  │ Phase 7 ✅  │  │ Phase 8 ✅  │  │ Phase 9 ✅  │
    │ US2 Import  │  │ US6 Budgets │  │ US5 Docs    │  │ US3 Settle  │
    └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
           │                │                │
    ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐
    │ Phase 10 ✅ │  │ Phase 11 ✅ │  │ Phase 12 ✅ │
    │  US7 Pro    │  │ US8 Invest  │  │ US9 Reports │
    └─────────────┘  └─────────────┘  └─────────────┘
                            │
     ┌──────────────────────┴──────────────────────────────────────┐
     │                                                              │
     │  Additional Features (Phases 14-19) ✅                       │
     │  ─────────────────────────────────────                       │
     │  • Phase 14: Notifications & Alerts                          │
     │  • Phase 15: UI/UX Polish                                    │
     │  • Phase 16: Recurring Transactions                          │
     │  • Phase 17: Multi-Currency Support                          │
     │  • Phase 18: Advanced Search                                 │
     │  • Phase 19: Data Export & Backup                            │
     └─────────────────────────────────────────────────────────────┘
                            │
     ┌─────────────────────────────────────────────────────────────┐
     │         Phase 13: Polish (Docker, Monitoring) ✅             │
     └─────────────────────────────────────────────────────────────┘
```

### Parallel Opportunities

**Within Phase 1 (Setup)**:
```bash
# These can run in parallel:
T003 [P] Configure TypeScript
T004 [P] Configure ESLint
T005 [P] Configure Prettier
T006 [P] Create docker-compose.yml
T007 [P] Create docker-compose.dev.yml
T011 [P] Create shared types
T012 [P] Create shared constants
T013 [P] Create shared validation
```

**Within Phase 2 (Foundational)**:
```bash
# After T014-T020 (database), these can run in parallel:
T021 [P] Argon2id hashing
T022 [P] JWT utilities
T023 [P] Redis client
T024 [P] S3 storage
T037 [P] PWA manifest
T038 [P] Service worker
```

**After Phase 5 (MVP)**:
```bash
# These story phases can run in parallel by different developers:
Phase 6: US2 Import
Phase 7: US6 Budgets
Phase 8: US5 Documents
Phase 9: US3 Settlement
```

---

## Implementation Strategy

### MVP First (Phases 1-5)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: US4 - Authentication
4. Complete Phase 4: US3 - Workspaces
5. Complete Phase 5: US1 - Transactions
6. **STOP and VALIDATE**: Deploy MVP, test independently

### Incremental Delivery

| Milestone | Phases | Value Delivered | Status |
|-----------|--------|-----------------|--------|
| MVP | 1-5 | Auth + Workspaces + Transactions | ✅ Complete |
| Core Complete | 6-9 | + Import + Budgets + Docs + Settlement | ✅ Complete |
| Pro Mode | 10 | + Invoicing for auto-entrepreneurs | ✅ Complete |
| Investment | 11 | + Portfolio tracking | ✅ Complete |
| Reports | 12 | + Exports and PDF reports | ✅ Complete |
| Polish | 13 | + Docker, backup, monitoring | ✅ Complete |
| Notifications | 14 | + Real-time alerts and notifications | ✅ Complete |
| UI/UX Polish | 15 | + Animations, loading states, responsive | ✅ Complete |
| Recurring | 16 | + Recurring transactions | ✅ Complete |
| Multi-Currency | 17 | + Currency support with exchange rates | ✅ Complete |
| Advanced Search | 18 | + Global search with saved filters | ✅ Complete |
| Export/Backup | 19 | + Data export and backup/restore | ✅ Complete |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
