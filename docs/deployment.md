# Deployment Guide

This guide covers deploying HubCompta in production.

## Table of Contents

- [Requirements](#requirements)
- [Quick Deploy](#quick-deploy)
- [Configuration](#configuration)
- [SSL/HTTPS](#sslhttps)
- [Backup & Recovery](#backup--recovery)
- [Monitoring](#monitoring)
- [Updating](#updating)
- [Troubleshooting](#troubleshooting)

---

## Requirements

### Hardware
- **CPU**: 2 cores minimum (4 recommended)
- **RAM**: 2GB minimum (4GB recommended)
- **Storage**: 10GB minimum (depends on document storage needs)

### Software
- Docker 24.0+
- Docker Compose 2.20+
- Domain name with DNS access (for HTTPS)

### Tested Platforms
- Ubuntu 22.04 LTS
- Debian 12
- Synology DSM 7.x
- QNAP QTS 5.x
- Raspberry Pi 4 (ARM64)

---

## Quick Deploy

### 1. Clone the Repository

```bash
git clone https://github.com/Louisdelez/HubCompta.git
cd HubCompta/docker
```

### 2. Configure Environment

```bash
# Copy example configuration
cp .env.example .env

# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')
MINIO_SECRET_KEY=$(openssl rand -base64 32 | tr -d '\n')

# Edit configuration
nano .env
```

### 3. Configure DNS

Point your domain to your server:

```
hubcompta.example.com  →  YOUR_SERVER_IP
```

### 4. Deploy

```bash
# Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### 5. Initialize Database

```bash
# Run migrations
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# (Optional) Seed default data
docker compose -f docker-compose.prod.yml exec backend npx prisma db seed
```

### 6. Verify Installation

```bash
# Check health
curl https://your-domain.com/health

# Expected response
{"status":"ok","version":"1.0.0","uptime":123}
```

---

## Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DOMAIN` | Your domain name | `hubcompta.example.com` |
| `DB_PASSWORD` | PostgreSQL password | `(generated)` |
| `REDIS_PASSWORD` | Redis password | `(generated)` |
| `JWT_SECRET` | JWT signing secret (64+ chars) | `(generated)` |
| `JWT_REFRESH_SECRET` | Refresh token secret | `(generated)` |
| `MINIO_SECRET_KEY` | Object storage password | `(generated)` |
| `ACME_EMAIL` | Email for Let's Encrypt | `admin@example.com` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TZ` | `Europe/Paris` | Timezone |
| `DB_USER` | `hubcompta` | Database username |
| `DB_NAME` | `hubcompta` | Database name |
| `BACKUP_RETENTION_DAYS` | `7` | Days to keep backups |

### Full Example

```env
# Domain
DOMAIN=hubcompta.example.com
APP_NAME=HubCompta

# Database
DB_USER=hubcompta
DB_PASSWORD=your_secure_password_here
DB_NAME=hubcompta

# Redis
REDIS_PASSWORD=your_redis_password_here

# JWT (generate with: openssl rand -base64 64)
JWT_SECRET=your_jwt_secret_at_least_64_characters_long_here
JWT_REFRESH_SECRET=your_refresh_secret_at_least_64_characters_here

# Object Storage
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=your_minio_password_here
S3_BUCKET=hubcompta

# SSL (Let's Encrypt)
ACME_EMAIL=your-email@example.com

# Timezone
TZ=Europe/Paris

# Backup
BACKUP_RETENTION_DAYS=7
```

---

## SSL/HTTPS

### Automatic (Let's Encrypt)

SSL is automatically configured via Traefik. Ensure:

1. Domain points to your server
2. Ports 80 and 443 are open
3. `ACME_EMAIL` is set in `.env`

Certificates are automatically renewed before expiration.

### Custom Certificates

To use your own certificates:

1. Place certificates in `docker/config/traefik/certs/`:
   ```
   certs/
   ├── cert.pem
   └── key.pem
   ```

2. Update `docker/config/traefik/traefik.yml`:
   ```yaml
   tls:
     certificates:
       - certFile: /etc/traefik/certs/cert.pem
         keyFile: /etc/traefik/certs/key.pem
   ```

3. Restart Traefik:
   ```bash
   docker compose -f docker-compose.prod.yml restart traefik
   ```

---

## Backup & Recovery

### Automatic Backups

Backups run automatically every 24 hours. Files are stored in `docker/backups/`.

### Manual Backup

```bash
# Trigger backup
docker compose -f docker-compose.prod.yml exec backup /backup.sh

# List backups
ls -la backups/
```

### Restore from Backup

```bash
# Stop application
docker compose -f docker-compose.prod.yml stop backend worker

# Restore database
gunzip -c backups/hubcompta_2024-01-15.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U hubcompta -d hubcompta

# Restart
docker compose -f docker-compose.prod.yml start backend worker
```

Or use the restore script:

```bash
../scripts/restore.sh backups/hubcompta_2024-01-15.sql.gz
```

---

## Monitoring

### Health Endpoints

| Endpoint | Description |
|----------|-------------|
| `/health` | Basic health check |
| `/health/live` | Liveness probe |
| `/health/ready` | Readiness probe |
| `/health/db` | Database status |
| `/health/redis` | Redis status |
| `/health/storage` | Storage status |
| `/health/metrics` | Process metrics |

### Example Monitoring Script

```bash
#!/bin/bash
HEALTH=$(curl -s https://your-domain.com/health/full)
STATUS=$(echo $HEALTH | jq -r '.status')

if [ "$STATUS" != "healthy" ]; then
  echo "ALERT: HubCompta is $STATUS"
  # Send notification
fi
```

### Docker Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100 backend
```

---

## Updating

### Standard Update

```bash
cd HubCompta

# Pull latest changes
git pull origin main

# Rebuild and restart
cd docker
docker compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### Zero-Downtime Update

```bash
# Build new images
docker compose -f docker-compose.prod.yml build

# Update one service at a time
docker compose -f docker-compose.prod.yml up -d --no-deps backend
docker compose -f docker-compose.prod.yml up -d --no-deps worker
docker compose -f docker-compose.prod.yml up -d --no-deps frontend
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs backend

# Common issues:
# - Database not ready: Wait for postgres healthcheck
# - Missing env vars: Check .env file
# - Port conflict: Check if ports 80/443 are in use
```

### Database Connection Failed

```bash
# Check postgres is running
docker compose -f docker-compose.prod.yml ps postgres

# Check connection
docker compose -f docker-compose.prod.yml exec postgres pg_isready

# Check logs
docker compose -f docker-compose.prod.yml logs postgres
```

### SSL Certificate Issues

```bash
# Check Traefik logs
docker compose -f docker-compose.prod.yml logs traefik

# Common issues:
# - DNS not propagated: Wait or check DNS
# - Rate limited: Use staging server first
# - Port 80 blocked: Required for HTTP challenge
```

### Reset Everything

```bash
# Stop all services
docker compose -f docker-compose.prod.yml down

# Remove volumes (WARNING: Deletes all data!)
docker compose -f docker-compose.prod.yml down -v

# Rebuild from scratch
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Security Recommendations

1. **Firewall**: Only expose ports 80 and 443
2. **Updates**: Keep Docker and host OS updated
3. **Secrets**: Use strong, unique passwords
4. **Backups**: Store backups off-site
5. **Monitoring**: Set up health check alerts
6. **Fail2ban**: Consider adding brute-force protection

```bash
# Example UFW rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## Support

- **Issues**: [GitHub Issues](https://github.com/Louisdelez/HubCompta/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Louisdelez/HubCompta/discussions)
