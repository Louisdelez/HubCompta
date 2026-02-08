# API Reference

HubCompta REST API documentation.

## Base URL

```
Production: https://your-domain.com/api/v1
Development: http://localhost:3001/api/v1
```

## Authentication

All protected endpoints require a Bearer token:

```bash
curl -H "Authorization: Bearer <token>" https://api.example.com/api/v1/user
```

### Obtain Token

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

Response:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 3600,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "John Doe"
  }
}
```

### Refresh Token

```bash
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJ..."
}
```

---

## Endpoints

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/live` | Liveness probe |
| GET | `/health/ready` | Readiness probe |
| GET | `/health/db` | Database health |
| GET | `/health/redis` | Redis health |
| GET | `/health/storage` | Storage health |
| GET | `/health/metrics` | Process metrics |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login |
| POST | `/auth/logout` | Logout |
| POST | `/auth/refresh` | Refresh token |
| POST | `/auth/mfa/setup` | Setup MFA |
| POST | `/auth/mfa/verify` | Verify MFA code |
| POST | `/auth/lock` | Lock session |
| POST | `/auth/unlock` | Unlock session |

### User

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/user` | Get current user |
| PATCH | `/user` | Update profile |
| GET | `/user/devices` | List devices |
| DELETE | `/user/devices/:id` | Remove device |

### Workspaces

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces` | List workspaces |
| POST | `/workspaces` | Create workspace |
| GET | `/workspaces/:id` | Get workspace |
| PATCH | `/workspaces/:id` | Update workspace |
| DELETE | `/workspaces/:id` | Delete workspace |
| GET | `/workspaces/:id/members` | List members |
| POST | `/workspaces/:id/invite` | Invite member |
| PATCH | `/workspaces/:id/members/:memberId` | Update member role |
| DELETE | `/workspaces/:id/members/:memberId` | Remove member |
| GET | `/workspaces/:id/settlement` | Get settlement |

### Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:id/accounts` | List accounts |
| POST | `/workspaces/:id/accounts` | Create account |
| GET | `/workspaces/:id/accounts/:accountId` | Get account |
| PATCH | `/workspaces/:id/accounts/:accountId` | Update account |
| DELETE | `/workspaces/:id/accounts/:accountId` | Delete account |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:id/transactions` | List transactions |
| POST | `/workspaces/:id/transactions` | Create transaction |
| GET | `/workspaces/:id/transactions/:txId` | Get transaction |
| PATCH | `/workspaces/:id/transactions/:txId` | Update transaction |
| DELETE | `/workspaces/:id/transactions/:txId` | Delete transaction |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50) |
| `accountId` | uuid | Filter by account |
| `categoryId` | uuid | Filter by category |
| `type` | string | Filter by type (income/expense/transfer) |
| `dateFrom` | date | Start date (ISO 8601) |
| `dateTo` | date | End date (ISO 8601) |
| `search` | string | Search in description |

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:id/categories` | List categories |
| POST | `/workspaces/:id/categories` | Create category |
| PATCH | `/workspaces/:id/categories/:catId` | Update category |
| DELETE | `/workspaces/:id/categories/:catId` | Delete category |

### Tags

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:id/tags` | List tags |
| POST | `/workspaces/:id/tags` | Create tag |
| DELETE | `/workspaces/:id/tags/:tagId` | Delete tag |

### Budgets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:id/budgets` | List budgets |
| POST | `/workspaces/:id/budgets` | Create budget |
| GET | `/workspaces/:id/budgets/:budgetId` | Get budget with progress |
| PATCH | `/workspaces/:id/budgets/:budgetId` | Update budget |
| DELETE | `/workspaces/:id/budgets/:budgetId` | Delete budget |

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:id/documents` | List documents |
| POST | `/workspaces/:id/documents/upload-url` | Get presigned upload URL |
| GET | `/workspaces/:id/documents/:docId` | Get document |
| DELETE | `/workspaces/:id/documents/:docId` | Delete document |
| POST | `/workspaces/:id/documents/:docId/link` | Link to transaction |
| DELETE | `/workspaces/:id/documents/:docId/link/:txId` | Unlink from transaction |

### Import

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/workspaces/:id/import/preview` | Preview CSV import |
| POST | `/workspaces/:id/import/execute` | Execute import |
| GET | `/workspaces/:id/import/:jobId` | Get import status |

### Rules

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:id/rules` | List rules |
| POST | `/workspaces/:id/rules` | Create rule |
| PATCH | `/workspaces/:id/rules/:ruleId` | Update rule |
| DELETE | `/workspaces/:id/rules/:ruleId` | Delete rule |

### Recurrences

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:id/recurrences` | List recurrences |
| POST | `/workspaces/:id/recurrences` | Create recurrence |
| GET | `/workspaces/:id/recurrences/:recId` | Get recurrence |
| PATCH | `/workspaces/:id/recurrences/:recId` | Update recurrence |
| DELETE | `/workspaces/:id/recurrences/:recId` | Delete recurrence |
| POST | `/workspaces/:id/recurrences/:recId/execute` | Execute now |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:id/reports/summary` | Monthly summary |
| GET | `/workspaces/:id/reports/net-worth` | Net worth over time |
| GET | `/workspaces/:id/reports/category` | Spending by category |

### Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:id/export/transactions` | Export transactions |
| GET | `/workspaces/:id/export/accounts` | Export accounts |
| GET | `/workspaces/:id/export/backup` | Full backup |
| GET | `/workspaces/:id/export/report` | Generate report |
| GET | `/workspaces/:id/export/formats` | Available formats |
| POST | `/workspaces/:id/export/validate-backup` | Validate backup file |

### Pro Mode - Contacts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:id/contacts` | List contacts |
| POST | `/workspaces/:id/contacts` | Create contact |
| GET | `/workspaces/:id/contacts/:contactId` | Get contact |
| PATCH | `/workspaces/:id/contacts/:contactId` | Update contact |
| DELETE | `/workspaces/:id/contacts/:contactId` | Delete contact |

### Pro Mode - Quotes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:id/quotes` | List quotes |
| POST | `/workspaces/:id/quotes` | Create quote |
| GET | `/workspaces/:id/quotes/:quoteId` | Get quote |
| PATCH | `/workspaces/:id/quotes/:quoteId` | Update quote |
| DELETE | `/workspaces/:id/quotes/:quoteId` | Delete quote |
| POST | `/workspaces/:id/quotes/:quoteId/convert` | Convert to invoice |

### Pro Mode - Invoices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:id/invoices` | List invoices |
| POST | `/workspaces/:id/invoices` | Create invoice |
| GET | `/workspaces/:id/invoices/:invoiceId` | Get invoice |
| PATCH | `/workspaces/:id/invoices/:invoiceId` | Update invoice |
| DELETE | `/workspaces/:id/invoices/:invoiceId` | Delete invoice |
| PATCH | `/workspaces/:id/invoices/:invoiceId/pay` | Mark as paid |

### Investments - Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/assets/search` | Search assets |

### Investments - Positions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:id/positions` | List positions |
| POST | `/workspaces/:id/positions` | Create position |
| GET | `/workspaces/:id/positions/:posId` | Get position |
| DELETE | `/workspaces/:id/positions/:posId` | Delete position |
| POST | `/workspaces/:id/positions/:posId/transactions` | Add transaction |

### Investments - Portfolio

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/:id/portfolio/summary` | Portfolio summary |

### Currencies

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/currencies` | List currencies |
| GET | `/currencies/rates` | Get exchange rates |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search` | Global search |
| GET | `/workspaces/:id/search` | Workspace search |
| GET | `/workspaces/:id/transactions/search` | Advanced transaction search |
| GET | `/workspaces/:id/filters` | List saved filters |
| POST | `/workspaces/:id/filters` | Create saved filter |
| DELETE | `/workspaces/:id/filters/:filterId` | Delete saved filter |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List notifications |
| PATCH | `/notifications/:id/read` | Mark as read |
| POST | `/notifications/mark-all-read` | Mark all as read |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/settings` | Get user settings |
| PATCH | `/settings` | Update settings |
| GET | `/settings/alerts` | Get alert rules |
| PATCH | `/settings/alerts` | Update alert rules |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/stats` | System statistics |
| POST | `/admin/backup` | Trigger backup |
| GET | `/admin/backup/status/:jobId` | Backup job status |
| GET | `/admin/backup/list` | List backups |
| GET | `/admin/users` | List users |
| PATCH | `/admin/users/:userId` | Update user |
| GET | `/admin/audit-logs` | Get audit logs |
| POST | `/admin/cache/clear` | Clear cache |

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error type",
  "message": "Human-readable message",
  "statusCode": 400
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation error |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |

---

## Rate Limiting

| Category | Limit |
|----------|-------|
| API (general) | 100 req/min |
| Authentication | 20 req/15min |
| Login attempts | 5 req/15min (then 30min block) |
| File uploads | 50 req/hour |
| Exports | 10 req/hour |

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```

---

## Pagination

List endpoints support pagination:

```bash
GET /api/v1/workspaces/:id/transactions?page=2&limit=25
```

Response includes pagination info:

```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 25,
    "total": 150,
    "totalPages": 6
  }
}
```
