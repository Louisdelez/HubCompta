# Quickstart: Finance Hub

**Branch**: `001-finance-hub` | **Date**: 2026-02-08

## Prerequisites

- Docker 24+ and Docker Compose v2
- 2GB RAM minimum (4GB recommended)
- 10GB disk space
- Modern web browser (Chrome 90+, Firefox 90+, Safari 15+)

## Quick Deploy (Production)

### 1. Clone and Configure

```bash
# Clone repository
git clone https://github.com/your-org/finance-hub.git
cd finance-hub

# Copy environment template
cp .env.example .env
```

### 2. Generate Secrets

```bash
# Generate secure secrets
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)" >> .env
echo "REDIS_PASSWORD=$(openssl rand -base64 24)" >> .env
```

### 3. Configure Domain (Optional)

Edit `.env` for your domain:

```bash
# For local access only
APP_URL=http://localhost:3000

# For remote access with HTTPS
APP_URL=https://finance.yourdomain.com
ACME_EMAIL=admin@yourdomain.com
```

### 4. Start Services

```bash
# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### 5. Access Application

Open `http://localhost:3000` (or your configured domain).

First user to register becomes the instance admin.

## Development Setup

### 1. Prerequisites

- Node.js 20 LTS
- pnpm 8+
- Docker (for PostgreSQL, Redis, MinIO)
- Git

### 2. Clone and Install

```bash
# Clone repository
git clone https://github.com/your-org/finance-hub.git
cd finance-hub

# Install dependencies
pnpm install
```

### 3. Start Infrastructure

```bash
# Start development databases
docker compose -f docker/docker-compose.dev.yml up -d

# Verify services
docker compose -f docker/docker-compose.dev.yml ps
```

### 4. Configure Environment

```bash
# Copy dev environment
cp .env.example .env.local

# Default dev settings (edit as needed)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/finance_hub"
REDIS_URL="redis://localhost:6379"
MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
```

### 5. Initialize Database

```bash
# Run migrations
pnpm --filter backend prisma migrate dev

# Seed development data (optional)
pnpm --filter backend prisma db seed
```

### 6. Start Development Servers

```bash
# Start all packages in dev mode
pnpm dev

# Or start individually
pnpm --filter backend dev    # API on :3001
pnpm --filter frontend dev   # Frontend on :3000
pnpm --filter worker dev     # Worker
```

### 7. Access Development

- Frontend: http://localhost:3000
- API: http://localhost:3001
- API Docs: http://localhost:3001/docs
- MinIO Console: http://localhost:9001

## Verification Checklist

After deployment, verify these work:

### Authentication

- [ ] Register new user with email/password
- [ ] Configure TOTP MFA (scan QR code)
- [ ] Login with MFA verification
- [ ] Session lock after inactivity (10 min default)
- [ ] Unlock with password

### Workspace

- [ ] Create personal workspace on first login
- [ ] Switch between workspaces (if multiple)
- [ ] Invite member to workspace (for shared workspaces)

### Core Finance

- [ ] Create bank account
- [ ] Add manual transaction
- [ ] Categorize transaction
- [ ] View monthly summary

### Import

- [ ] Upload CSV file
- [ ] Map columns
- [ ] Preview import
- [ ] Execute import
- [ ] Verify duplicate detection

### Documents

- [ ] Upload receipt photo
- [ ] Link document to transaction
- [ ] View document in inbox

### Budgets

- [ ] Create monthly budget for category
- [ ] View budget progress
- [ ] Verify alert at 80% threshold

## Common Issues

### Database Connection Failed

```
Error: Can't reach database server
```

**Solution**: Verify PostgreSQL is running:
```bash
docker compose ps postgres
docker compose logs postgres
```

### Redis Connection Failed

```
Error: Redis connection refused
```

**Solution**: Verify Redis is running:
```bash
docker compose ps redis
docker compose logs redis
```

### Port Already in Use

```
Error: Port 3000 is already in use
```

**Solution**: Change port in `.env`:
```bash
APP_PORT=3001
```

### MFA Setup Failed

```
Error: TOTP verification failed
```

**Solution**: Ensure server time is synchronized:
```bash
# On host machine
timedatectl status
# If NTP is not active
sudo timedatectl set-ntp true
```

### File Upload Failed

```
Error: Failed to upload document
```

**Solution**: Verify MinIO is running and accessible:
```bash
docker compose ps minio
docker compose logs minio
```

## NAS-Specific Instructions

### Synology DSM

1. Install Docker via Package Center
2. Create shared folder for data: `/volume1/docker/finance-hub`
3. Upload `docker-compose.yml` to folder
4. Edit volume paths:
   ```yaml
   volumes:
     postgres_data: /volume1/docker/finance-hub/postgres
     redis_data: /volume1/docker/finance-hub/redis
     minio_data: /volume1/docker/finance-hub/minio
   ```
5. Run via SSH or Container Manager

### QNAP QTS

1. Install Container Station
2. Create folder: `/share/Container/finance-hub`
3. Import docker-compose.yml
4. Adjust volume paths for QNAP structure
5. Deploy via Container Station UI

### Unraid

1. Install Docker Compose plugin
2. Create folder: `/mnt/user/appdata/finance-hub`
3. Add stack in Docker tab
4. Configure paths in stack

## Backup & Restore

### Create Backup

```bash
# Stop services (optional, for consistency)
docker compose stop backend worker

# Backup PostgreSQL
docker compose exec postgres pg_dump -U postgres finance_hub > backup.sql

# Backup MinIO data
docker compose exec minio mc mirror /data /backup

# Restart services
docker compose start backend worker
```

### Restore Backup

```bash
# Stop services
docker compose stop backend worker

# Restore PostgreSQL
docker compose exec -T postgres psql -U postgres finance_hub < backup.sql

# Restore MinIO
docker compose exec minio mc mirror /backup /data

# Restart services
docker compose start backend worker
```

## Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `REDIS_URL` | Redis connection string | - | Yes |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `ENCRYPTION_KEY` | Application encryption key | - | Yes |
| `APP_URL` | Public URL of the application | http://localhost:3000 | Yes |
| `APP_PORT` | HTTP port | 3000 | No |
| `MFA_ISSUER` | TOTP issuer name | Finance Hub | No |
| `SESSION_LOCK_MINUTES` | Auto-lock timeout | 10 | No |
| `SESSION_EXPIRY_HOURS` | Session duration | 24 | No |
| `MINIO_ENDPOINT` | MinIO/S3 endpoint | minio | No |
| `MINIO_PORT` | MinIO port | 9000 | No |
| `MINIO_ACCESS_KEY` | MinIO access key | - | Yes |
| `MINIO_SECRET_KEY` | MinIO secret key | - | Yes |
| `MINIO_BUCKET` | Document bucket name | documents | No |
| `LOG_LEVEL` | Logging level | info | No |
| `NODE_ENV` | Environment | production | No |

## Health Checks

### API Health

```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","version":"1.0.0"}
```

### Database Health

```bash
curl http://localhost:3001/health/db
# Expected: {"status":"ok","latency_ms":5}
```

### Redis Health

```bash
curl http://localhost:3001/health/redis
# Expected: {"status":"ok","latency_ms":1}
```

### Storage Health

```bash
curl http://localhost:3001/health/storage
# Expected: {"status":"ok","bucket":"documents"}
```
