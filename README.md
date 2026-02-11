# HubCompta

<p align="center">
  <img src="docs/assets/logo.png" alt="HubCompta Logo" width="120" />
</p>

<p align="center">
  <strong>Self-hosted financial management platform for individuals, families, and small businesses</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

<p align="center">
  <a href="https://github.com/Louisdelez/HubCompta/actions/workflows/ci.yml"><img src="https://github.com/Louisdelez/HubCompta/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://codecov.io/gh/Louisdelez/HubCompta"><img src="https://codecov.io/gh/Louisdelez/HubCompta/branch/main/graph/badge.svg" alt="codecov" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" />
</p>

---

## Overview

HubCompta is a comprehensive, self-hosted financial management solution designed to run on your own infrastructure (NAS, VPS, or home server). It provides complete control over your financial data with no subscription fees or cloud dependencies.

### Why HubCompta?

- **Privacy First**: Your financial data stays on your servers
- **No Subscription**: One-time setup, no recurring costs
- **Full Control**: Open source, fully customizable
- **Multi-User**: Perfect for families or small teams
- **Offline Ready**: PWA with offline support

---

## Features

### Core Financial Management
- **Multi-Account Tracking**: Bank accounts, cash, savings, investments
- **Transaction Management**: Income, expenses, transfers with categorization
- **Budget Tracking**: Set budgets per category with real-time alerts
- **Document Storage**: Attach receipts and invoices to transactions

### Import & Export
- **CSV Import**: Auto-detect bank formats, duplicate detection
- **Smart Rules**: Auto-categorize transactions based on patterns
- **Data Export**: CSV, JSON, and HTML reports
- **Full Backup**: Complete workspace backup and restore

### Pro Mode (for Freelancers)
- **Contact Management**: Clients and suppliers database
- **Quote Generation**: Create and send professional quotes
- **Invoice Management**: Convert quotes to invoices, track payments
- **VAT Calculation**: Automatic tax calculations

### Investment Tracking
- **Portfolio Dashboard**: Track stocks, ETFs, crypto
- **Market Data**: Real-time prices from Yahoo Finance & CoinGecko
- **Performance Metrics**: PRU calculation, gains/losses
- **Allocation Charts**: Visualize your portfolio distribution

### Multi-Currency
- **Multiple Currencies**: EUR, USD, GBP, CHF, and more
- **Auto Exchange Rates**: Daily updates from ECB
- **Unified Totals**: See all accounts in your preferred currency

### Advanced Features
- **Global Search**: Find anything with Cmd/Ctrl+K
- **Saved Filters**: Save complex search filters
- **Recurring Transactions**: Automate regular transactions
- **Notifications**: Budget alerts, payment reminders

### Security
- **MFA Authentication**: TOTP and WebAuthn support
- **Session Management**: Device tracking, session lock
- **Role-Based Access**: Owner, Admin, Member, Viewer roles
- **Audit Logs**: Track all sensitive actions

---

## Quick Start

### Prerequisites

- Docker 24+ and Docker Compose 2.20+
- Domain name (for HTTPS) or localhost for development
- 2GB RAM minimum, 10GB disk space

### Development Setup

```bash
# Clone the repository
git clone https://github.com/Louisdelez/HubCompta.git
cd HubCompta

# Start infrastructure (PostgreSQL, Redis, MinIO)
cd docker
docker compose -f docker-compose.dev.yml up -d

# Install dependencies
cd ..
pnpm install

# Setup environment
cp .env.example .env
# Edit .env with your settings

# Generate Prisma client and run migrations
cd packages/backend
npx prisma generate
npx prisma migrate dev

# Start development servers
cd ../..
pnpm dev
```

Access the application at `http://localhost:5173`

### Production Deployment

```bash
# Clone and configure
git clone https://github.com/Louisdelez/HubCompta.git
cd HubCompta/docker

# Configure environment
cp .env.example .env
nano .env  # Edit with your settings

# Deploy
docker compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

See [Deployment Guide](docs/deployment.md) for detailed instructions.

---

## Tech Stack

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Fastify 4.x
- **Database**: PostgreSQL 16 + Prisma ORM
- **Cache**: Redis 7
- **Queue**: BullMQ
- **Storage**: S3-compatible (MinIO)

### Frontend
- **Framework**: React 18
- **Build**: Vite 5
- **Styling**: Tailwind CSS 3
- **State**: TanStack Query v5 + Zustand
- **Router**: React Router 6

### Infrastructure
- **Reverse Proxy**: Traefik 3 with auto HTTPS
- **Containers**: Docker & Docker Compose
- **CI/CD**: GitHub Actions (optional)

---

## Project Structure

```
HubCompta/
├── docker/                 # Docker configurations
│   ├── config/            # Nginx, Traefik configs
│   ├── Dockerfile.*       # Multi-stage Dockerfiles
│   └── docker-compose.*   # Compose files
├── packages/
│   ├── backend/           # Fastify API server
│   │   ├── prisma/       # Database schema & migrations
│   │   └── src/
│   │       ├── api/      # Route handlers
│   │       ├── core/     # Middleware, auth, queue
│   │       └── modules/  # Business logic
│   ├── frontend/          # React SPA
│   │   └── src/
│   │       ├── components/  # Reusable UI
│   │       ├── features/    # Feature modules
│   │       ├── hooks/       # Custom hooks
│   │       └── lib/         # Utilities
│   ├── worker/            # Background job processor
│   └── shared/            # Shared types & validation
├── scripts/               # Utility scripts
├── specs/                 # Specifications & docs
└── docs/                  # Documentation
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Deployment Guide](docs/deployment.md) | Production deployment instructions |
| [API Reference](docs/api.md) | REST API documentation |
| [Configuration](docs/configuration.md) | Environment variables & settings |
| [Architecture](docs/architecture.md) | System design & decisions |
| [Contributing](CONTRIBUTING.md) | How to contribute |

---

## Screenshots

<p align="center">
  <img src="docs/assets/screenshot-dashboard.png" alt="Dashboard" width="45%" />
  <img src="docs/assets/screenshot-transactions.png" alt="Transactions" width="45%" />
</p>

<p align="center">
  <img src="docs/assets/screenshot-budgets.png" alt="Budgets" width="45%" />
  <img src="docs/assets/screenshot-reports.png" alt="Reports" width="45%" />
</p>

---

## Roadmap

- [x] Core transaction management
- [x] Multi-user workspaces
- [x] Budget tracking
- [x] Document management
- [x] CSV import
- [x] Pro mode (invoicing)
- [x] Investment tracking
- [x] Multi-currency
- [x] Advanced search
- [x] Docker deployment
- [ ] Mobile app (React Native)
- [ ] Bank sync (Open Banking)
- [ ] AI categorization
- [ ] Crypto wallet integration

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/HubCompta.git

# Create a branch
git checkout -b feature/amazing-feature

# Make your changes and commit
git commit -m "feat: add amazing feature"

# Push and create a PR
git push origin feature/amazing-feature
```

---

## Support

- **Issues**: [GitHub Issues](https://github.com/Louisdelez/HubCompta/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Louisdelez/HubCompta/discussions)

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/Louisdelez">Louis Delez</a>
</p>
