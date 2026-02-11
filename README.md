# HubCompta

<p align="center">
  <img src="docs/assets/logo.png" alt="HubCompta Logo" width="120" />
</p>

<p align="center">
  <strong>Plateforme de gestion financiere auto-hebergeable pour particuliers, familles et petites entreprises</strong>
</p>

<p align="center">
  <a href="#fonctionnalites">Fonctionnalites</a> •
  <a href="#demarrage-rapide">Demarrage rapide</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#contribuer">Contribuer</a> •
  <a href="#licence">Licence</a>
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

## Presentation

HubCompta est une solution complete de gestion financiere auto-hebergee, concue pour fonctionner sur votre propre infrastructure (NAS, VPS ou serveur domestique). Elle offre un controle total sur vos donnees financieres sans frais d'abonnement ni dependance au cloud.

### Pourquoi HubCompta ?

- **Confidentialite** : Vos donnees financieres restent sur vos serveurs
- **Sans abonnement** : Installation unique, pas de couts recurrents
- **Controle total** : Open source, entierement personnalisable
- **Multi-utilisateurs** : Ideal pour les familles ou petites equipes
- **Mode hors-ligne** : PWA avec support offline

---

## Fonctionnalites

### Gestion financiere de base
- **Multi-comptes** : Comptes bancaires, especes, epargne, investissements
- **Gestion des transactions** : Revenus, depenses, virements avec categorisation
- **Suivi des budgets** : Definir des budgets par categorie avec alertes en temps reel
- **Stockage de documents** : Joindre justificatifs et factures aux transactions

### Import et export
- **Import CSV** : Detection automatique des formats bancaires, detection des doublons
- **Regles intelligentes** : Categorisation automatique basee sur des motifs
- **Export des donnees** : CSV, JSON et rapports HTML
- **Sauvegarde complete** : Sauvegarde et restauration de l'espace de travail

### Mode Pro (pour independants)
- **Gestion des contacts** : Base de donnees clients et fournisseurs
- **Generation de devis** : Creer et envoyer des devis professionnels
- **Gestion des factures** : Conversion devis en factures, suivi des paiements
- **Calcul TVA** : Calculs fiscaux automatiques

### Suivi des investissements
- **Tableau de bord portefeuille** : Suivre actions, ETF, crypto
- **Donnees de marche** : Prix en temps reel via Yahoo Finance et CoinGecko
- **Metriques de performance** : Calcul PRU, plus/moins-values
- **Graphiques d'allocation** : Visualiser la repartition du portefeuille

### Multi-devises
- **Plusieurs devises** : EUR, USD, GBP, CHF, et plus
- **Taux de change automatiques** : Mise a jour quotidienne depuis la BCE
- **Totaux unifies** : Voir tous les comptes dans votre devise preferee

### Fonctionnalites avancees
- **Recherche globale** : Trouver n'importe quoi avec Cmd/Ctrl+K
- **Filtres sauvegardes** : Enregistrer des filtres de recherche complexes
- **Transactions recurrentes** : Automatiser les transactions regulieres
- **Notifications** : Alertes budget, rappels de paiement

### Securite
- **Authentification MFA** : Support TOTP et WebAuthn
- **Gestion des sessions** : Suivi des appareils, verrouillage de session
- **Acces base sur les roles** : Roles Proprietaire, Admin, Membre, Lecteur
- **Journaux d'audit** : Tracer toutes les actions sensibles

---

## Captures d'ecran

<p align="center">
  <img src="docs/assets/screenshot-dashboard.png" alt="Tableau de bord" width="45%" />
  <img src="docs/assets/screenshot-transactions.png" alt="Transactions" width="45%" />
</p>

<p align="center">
  <img src="docs/assets/screenshot-budgets.png" alt="Budgets" width="45%" />
  <img src="docs/assets/screenshot-reports.png" alt="Rapports" width="45%" />
</p>

---

## Stack technique

### Backend
| Composant | Technologie |
|-----------|-------------|
| Runtime | Node.js 20 LTS |
| Framework | Fastify 5.x |
| Base de donnees | PostgreSQL 16 + Prisma ORM |
| Cache | Redis 7 |
| Queue | BullMQ |
| Stockage | Compatible S3 (MinIO) |

### Frontend
| Composant | Technologie |
|-----------|-------------|
| Framework | React 18 |
| Build | Vite 5 |
| Styles | Tailwind CSS 3 |
| Etat | TanStack Query v5 + Zustand |
| Routeur | React Router 6 |

### Infrastructure
| Composant | Technologie |
|-----------|-------------|
| Reverse Proxy | Traefik 3 avec HTTPS automatique |
| Conteneurs | Docker et Docker Compose |
| CI/CD | GitHub Actions (optionnel) |

---

## Demarrage rapide

### Prerequis

- Docker 24+ et Docker Compose 2.20+
- Nom de domaine (pour HTTPS) ou localhost pour le developpement
- Minimum 2 Go RAM, 10 Go d'espace disque

### Installation pour le developpement

```bash
# Cloner le repository
git clone https://github.com/Louisdelez/HubCompta.git
cd HubCompta

# Demarrer l'infrastructure (PostgreSQL, Redis, MinIO)
cd docker
docker compose -f docker-compose.dev.yml up -d

# Installer les dependances
cd ..
pnpm install

# Configurer l'environnement
cp .env.example .env
# Editer .env avec vos parametres

# Generer le client Prisma et executer les migrations
cd packages/backend
npx prisma generate
npx prisma migrate dev

# Demarrer les serveurs de developpement
cd ../..
pnpm dev
```

Acceder a l'application sur `http://localhost:5173`

### Deploiement en production

```bash
# Cloner et configurer
git clone https://github.com/Louisdelez/HubCompta.git
cd HubCompta/docker

# Configurer l'environnement
cp .env.example .env
nano .env  # Editer avec vos parametres

# Deployer
docker compose -f docker-compose.prod.yml up -d --build

# Executer les migrations
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

Voir [Guide de deploiement](docs/DEPLOYMENT.md) pour les instructions detaillees.

---

## Variables d'environnement

### Variables requises

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL de connexion PostgreSQL |
| `REDIS_URL` | URL de connexion Redis |
| `JWT_SECRET` | Secret pour les tokens JWT (min 32 caracteres) |
| `JWT_REFRESH_SECRET` | Secret pour les refresh tokens |
| `MINIO_ACCESS_KEY` | Cle d'acces MinIO |
| `MINIO_SECRET_KEY` | Cle secrete MinIO |
| `APP_URL` | URL de l'application |

### Variables optionnelles

| Variable | Defaut | Description |
|----------|--------|-------------|
| `NODE_ENV` | `development` | Environnement d'execution |
| `PORT` | `3001` | Port du serveur backend |
| `LOG_LEVEL` | `info` | Niveau de log |
| `TZ` | `Europe/Paris` | Fuseau horaire |

Voir [Configuration](docs/configuration.md) pour la liste complete.

---

## Documentation API

L'API REST est documentee avec Swagger/OpenAPI.

- **Developpement** : http://localhost:3001/documentation
- **Production** : https://votre-domaine.com/documentation

Voir [Reference API](docs/api.md) pour la documentation complete.

---

## Structure du projet

```
HubCompta/
├── docker/                 # Configurations Docker
│   ├── config/            # Configs Nginx, Traefik
│   ├── Dockerfile.*       # Dockerfiles multi-stages
│   └── docker-compose.*   # Fichiers Compose
├── packages/
│   ├── backend/           # Serveur API Fastify
│   │   ├── prisma/       # Schema et migrations
│   │   └── src/
│   │       ├── api/      # Gestionnaires de routes
│   │       ├── core/     # Middleware, auth, queue
│   │       └── modules/  # Logique metier
│   ├── frontend/          # SPA React
│   │   └── src/
│   │       ├── components/  # UI reutilisable
│   │       ├── features/    # Modules fonctionnels
│   │       ├── hooks/       # Hooks personnalises
│   │       └── lib/         # Utilitaires
│   ├── worker/            # Processeur de jobs en arriere-plan
│   └── shared/            # Types et validation partages
├── scripts/               # Scripts utilitaires
├── specs/                 # Specifications et docs
└── docs/                  # Documentation
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Guide de deploiement](docs/DEPLOYMENT.md) | Instructions de deploiement en production |
| [Reference API](docs/api.md) | Documentation de l'API REST |
| [Configuration](docs/configuration.md) | Variables d'environnement et parametres |
| [Architecture](docs/architecture.md) | Conception systeme et decisions |
| [Contribuer](docs/CONTRIBUTING.md) | Comment contribuer |

---

## Feuille de route

- [x] Gestion des transactions de base
- [x] Espaces de travail multi-utilisateurs
- [x] Suivi des budgets
- [x] Gestion des documents
- [x] Import CSV
- [x] Mode Pro (facturation)
- [x] Suivi des investissements
- [x] Multi-devises
- [x] Recherche avancee
- [x] Deploiement Docker
- [ ] Application mobile (React Native)
- [ ] Synchronisation bancaire (Open Banking)
- [ ] Categorisation IA
- [ ] Integration portefeuilles crypto

---

## Contribuer

Les contributions sont les bienvenues ! Veuillez lire notre [Guide de contribution](docs/CONTRIBUTING.md) pour plus de details.

```bash
# Fork et clone
git clone https://github.com/VOTRE_NOM/HubCompta.git

# Creer une branche
git checkout -b feature/fonctionnalite-geniale

# Faire vos modifications et commit
git commit -m "feat: ajouter fonctionnalite geniale"

# Push et creer une PR
git push origin feature/fonctionnalite-geniale
```

---

## Support

- **Issues** : [GitHub Issues](https://github.com/Louisdelez/HubCompta/issues)
- **Discussions** : [GitHub Discussions](https://github.com/Louisdelez/HubCompta/discussions)

---

## Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour plus de details.

---

<p align="center">
  Fait avec soin par <a href="https://github.com/Louisdelez">Louis Delez</a>
</p>
