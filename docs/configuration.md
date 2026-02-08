# Configuration Guide

Complete configuration reference for HubCompta.

## Environment Variables

### Core Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment (`development`, `production`) |
| `PORT` | No | `3001` | Backend server port |
| `HOST` | No | `0.0.0.0` | Server host binding |
| `APP_URL` | Yes | - | Full application URL |
| `LOG_LEVEL` | No | `info` | Log level (`debug`, `info`, `warn`, `error`) |

### Database (PostgreSQL)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `DB_USER` | No | `hubcompta` | Database user |
| `DB_PASSWORD` | Yes | - | Database password |
| `DB_NAME` | No | `hubcompta` | Database name |
| `DB_HOST` | No | `localhost` | Database host |
| `DB_PORT` | No | `5432` | Database port |

Connection string format:
```
postgresql://user:password@host:port/database?schema=public
```

### Redis

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | Yes | - | Redis connection string |
| `REDIS_PASSWORD` | Yes (prod) | - | Redis password |

Connection string format:
```
redis://:password@host:port
```

### Object Storage (S3/MinIO)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MINIO_ENDPOINT` | No | `localhost` | Storage endpoint |
| `MINIO_PORT` | No | `9000` | Storage port |
| `MINIO_ACCESS_KEY` | Yes | - | Access key |
| `MINIO_SECRET_KEY` | Yes | - | Secret key |
| `MINIO_BUCKET` | No | `documents` | Default bucket |
| `MINIO_USE_SSL` | No | `false` | Use HTTPS |

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | - | JWT signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | - | Refresh token secret |
| `JWT_EXPIRES_IN` | No | `1h` | Access token expiry |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token expiry |
| `MFA_ISSUER` | No | `HubCompta` | MFA issuer name |
| `SESSION_LOCK_MINUTES` | No | `10` | Inactivity lock timeout |
| `SESSION_EXPIRY_HOURS` | No | `24` | Session expiry |

### Security

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CORS_ORIGINS` | No | `APP_URL` | Allowed CORS origins (comma-separated) |
| `RATE_LIMIT_MAX` | No | `100` | Max requests per minute |
| `ENCRYPTION_KEY` | No | - | Data encryption key |

### SSL/TLS (Traefik)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DOMAIN` | Yes | - | Your domain name |
| `ACME_EMAIL` | Yes | - | Let's Encrypt email |

### Backup

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BACKUP_BUCKET` | No | `hubcompta-backups` | Backup storage bucket |
| `BACKUP_RETENTION_DAYS` | No | `7` | Days to keep backups |

### Email (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | No | - | SMTP server host |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | - | SMTP username |
| `SMTP_PASSWORD` | No | - | SMTP password |
| `SMTP_FROM` | No | - | From email address |
| `SMTP_SECURE` | No | `false` | Use TLS |

### External APIs (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ECB_API_URL` | No | (ECB URL) | Exchange rate API |
| `YAHOO_FINANCE_KEY` | No | - | Yahoo Finance API key |
| `COINGECKO_API_KEY` | No | - | CoinGecko API key |

---

## Development Configuration

### `.env` Example

```env
# Application
NODE_ENV=development
PORT=3001
APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/finance_hub?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# Storage
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=documents

# Auth
JWT_SECRET=development_secret_at_least_32_characters_long
JWT_REFRESH_SECRET=development_refresh_secret_32_chars

# Optional
LOG_LEVEL=debug
```

### Vite Configuration (Frontend)

```env
VITE_API_URL=http://localhost:3001/api/v1
VITE_APP_NAME=HubCompta Dev
```

---

## Production Configuration

### Docker `.env`

```env
# Domain
DOMAIN=hubcompta.example.com
APP_NAME=HubCompta

# Timezone
TZ=Europe/Paris

# Database
DB_USER=hubcompta
DB_PASSWORD=<generate with: openssl rand -base64 32>
DB_NAME=hubcompta

# Redis
REDIS_PASSWORD=<generate with: openssl rand -base64 32>

# JWT (min 64 characters)
JWT_SECRET=<generate with: openssl rand -base64 64>
JWT_REFRESH_SECRET=<generate with: openssl rand -base64 64>

# Object Storage
MINIO_ACCESS_KEY=hubcompta
MINIO_SECRET_KEY=<generate with: openssl rand -base64 32>
S3_BUCKET=hubcompta

# SSL
ACME_EMAIL=admin@example.com

# Backup
BACKUP_RETENTION_DAYS=30
```

---

## Feature Flags

Configure features via environment or settings:

| Flag | Default | Description |
|------|---------|-------------|
| `ENABLE_PRO_MODE` | `true` | Enable invoicing features |
| `ENABLE_INVESTMENTS` | `true` | Enable investment tracking |
| `ENABLE_MULTI_CURRENCY` | `true` | Enable multi-currency |
| `ENABLE_RECURRENCES` | `true` | Enable recurring transactions |
| `ENABLE_MFA` | `true` | Require MFA setup |
| `ALLOW_REGISTRATION` | `true` | Allow new user registration |

---

## Workspace Settings

Configurable per-workspace:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `currency` | string | `EUR` | Default currency |
| `fiscalYearStart` | number | `1` | Fiscal year start month |
| `dateFormat` | string | `DD/MM/YYYY` | Date display format |
| `numberFormat` | string | `fr-FR` | Number formatting locale |
| `timezone` | string | `Europe/Paris` | Workspace timezone |

---

## User Settings

Configurable per-user:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `theme` | string | `system` | UI theme (light/dark/system) |
| `language` | string | `fr` | UI language |
| `emailNotifications` | boolean | `true` | Receive email notifications |
| `desktopNotifications` | boolean | `true` | Browser notifications |
| `quickAddDefault` | string | `expense` | Default transaction type |

---

## Alert Configuration

Configure alerts via API or settings page:

```json
{
  "budgetThreshold": {
    "enabled": true,
    "percentage": 80
  },
  "lowBalance": {
    "enabled": true,
    "threshold": 100
  },
  "invoiceOverdue": {
    "enabled": true,
    "daysBefore": 3
  },
  "recurringFailed": {
    "enabled": true
  }
}
```

---

## Logging Configuration

### Log Levels

| Level | Description |
|-------|-------------|
| `debug` | Detailed debugging information |
| `info` | General operational information |
| `warn` | Warning messages |
| `error` | Error conditions |

### Production Logging

Logs are JSON-formatted in production:

```json
{
  "level": "info",
  "time": 1704067200000,
  "msg": "Request completed",
  "reqId": "uuid",
  "method": "GET",
  "url": "/api/v1/user",
  "statusCode": 200,
  "responseTime": 42
}
```

### Development Logging

Pretty-printed with colors:

```
[14:30:00] INFO: Request completed
    reqId: "uuid"
    method: "GET"
    url: "/api/v1/user"
    statusCode: 200
    responseTime: 42ms
```
