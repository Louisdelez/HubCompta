# Guide de contribution

Merci de votre interet pour contribuer a HubCompta ! Ce guide vous aidera a demarrer.

---

## Table des matieres

- [Installation de l'environnement](#installation-de-lenvironnement)
- [Structure du projet](#structure-du-projet)
- [Standards de code](#standards-de-code)
- [Processus de contribution](#processus-de-contribution)
- [Tests](#tests)
- [Commits et Pull Requests](#commits-et-pull-requests)

---

## Installation de l'environnement

### Prerequis

- **Node.js** 20+ ([nvm](https://github.com/nvm-sh/nvm) recommande)
- **pnpm** 9+ (`npm install -g pnpm`)
- **Docker** et Docker Compose
- **Git**

### Installation

```bash
# Cloner le repository
git clone https://github.com/Louisdelez/HubCompta.git
cd HubCompta

# Installer les dependances
pnpm install

# Copier la configuration
cp packages/backend/.env.example packages/backend/.env

# Lancer les services (PostgreSQL, Redis, MinIO)
docker compose up -d

# Initialiser la base de donnees
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Lancer en mode developpement
pnpm dev
```

### Services disponibles

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Application React |
| Backend | http://localhost:3001 | API Fastify |
| Swagger | http://localhost:3001/documentation | Documentation API |
| PostgreSQL | localhost:5432 | Base de donnees |
| Redis | localhost:6379 | Cache et queues |
| MinIO | http://localhost:9001 | Console stockage |

---

## Structure du projet

```
HubCompta/
├── packages/
│   ├── backend/           # API Fastify
│   │   ├── prisma/        # Schema et migrations
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── api/       # Routes HTTP
│   │       │   └── routes/
│   │       ├── core/      # Services de base
│   │       │   ├── auth/
│   │       │   ├── crypto/
│   │       │   ├── database/
│   │       │   ├── middleware/
│   │       │   ├── queue/
│   │       │   └── storage/
│   │       └── modules/   # Modules metier
│   │           ├── accounts/
│   │           ├── transactions/
│   │           ├── budgets/
│   │           └── ...
│   ├── frontend/          # SPA React
│   │   └── src/
│   │       ├── components/
│   │       │   ├── ui/    # Composants reutilisables
│   │       │   └── layout/
│   │       ├── features/  # Fonctionnalites
│   │       │   ├── auth/
│   │       │   ├── dashboard/
│   │       │   └── ...
│   │       ├── hooks/     # Hooks personnalises
│   │       ├── lib/       # Utilitaires
│   │       └── stores/    # Zustand stores
│   ├── worker/            # Jobs BullMQ
│   └── shared/            # Types partages
├── docker/                # Configuration Docker
├── docs/                  # Documentation
└── tests/                 # Tests E2E
```

---

## Standards de code

### TypeScript

- Mode strict active (`"strict": true`)
- Pas de `any` explicite sauf cas exceptionnels documentes
- Interfaces pour les donnees, types pour les unions
- Export nomme prefere aux exports par defaut

```typescript
// Bien
export interface Transaction {
  id: string;
  amount: number;
  date: Date;
}

export type TransactionType = 'income' | 'expense' | 'transfer';

// A eviter
export default class TransactionService { }
```

### React

- Composants fonctionnels avec hooks
- Props typees avec interfaces
- Separation logique/presentation quand pertinent

```typescript
// Bien
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
```

### Backend (Fastify)

- Routes groupees par module
- Validation Zod sur toutes les entrees
- Gestion d'erreur centralisee

```typescript
// Route type
fastify.post<{
  Body: CreateTransactionInput;
  Params: { workspaceId: string };
}>(
  '/workspaces/:workspaceId/transactions',
  {
    schema: {
      body: createTransactionSchema,
      params: workspaceParamsSchema,
    },
    preHandler: [authenticate, requireWorkspaceMember],
  },
  async (request, reply) => {
    const transaction = await transactionService.create(
      request.params.workspaceId,
      request.body,
      request.user.id
    );
    return reply.status(201).send({ data: transaction });
  }
);
```

### Formatage

Le projet utilise Prettier et ESLint.

```bash
# Verifier le formatage
pnpm format:check
pnpm lint

# Corriger automatiquement
pnpm format
pnpm lint:fix
```

---

## Processus de contribution

### 1. Choisir une issue

- Consultez les [issues ouvertes](https://github.com/Louisdelez/HubCompta/issues)
- Les issues marquees `good first issue` sont ideales pour debuter
- Commentez l'issue pour signaler que vous y travaillez

### 2. Creer une branche

```bash
# A partir de main
git checkout main
git pull origin main

# Creer une branche
git checkout -b feature/nom-de-la-feature
# ou
git checkout -b fix/description-du-bug
```

Conventions de nommage :
- `feature/` : Nouvelles fonctionnalites
- `fix/` : Corrections de bugs
- `docs/` : Documentation
- `refactor/` : Refactoring sans changement fonctionnel

### 3. Developper

- Ecrivez des tests pour les nouvelles fonctionnalites
- Suivez les standards de code
- Commitez regulierement avec des messages clairs

### 4. Tester

```bash
# Tests unitaires
pnpm test

# Tests E2E
pnpm test:e2e

# Verifications
pnpm typecheck
pnpm lint
```

### 5. Soumettre une Pull Request

- Remplissez le template de PR
- Liez l'issue associee
- Attendez la review

---

## Tests

### Tests unitaires

Chaque package a ses propres tests avec Vitest.

```bash
# Tous les tests
pnpm test

# Tests d'un package
pnpm --filter @finance-hub/backend test

# Mode watch
pnpm --filter @finance-hub/backend test:watch

# Couverture
pnpm --filter @finance-hub/backend test:coverage
```

Structure des tests :
```
src/
├── modules/
│   └── transactions/
│       ├── transactions.service.ts
│       └── transactions.service.test.ts  # Test a cote du fichier
```

### Tests E2E

Les tests end-to-end utilisent Playwright.

```bash
# Lancer les tests
pnpm test:e2e

# Mode UI
pnpm test:e2e:ui

# Un navigateur specifique
pnpm test:e2e:chromium
```

### Exigences de tests

- Toute nouvelle fonctionnalite doit avoir des tests unitaires
- Les corrections de bugs doivent inclure un test de non-regression
- La couverture de code ne doit pas diminuer

### Ecrire des tests

```typescript
// Test unitaire (Vitest)
import { describe, it, expect, beforeEach } from 'vitest';
import { TransactionService } from './transactions.service';

describe('TransactionService', () => {
  let service: TransactionService;

  beforeEach(() => {
    service = new TransactionService(mockPrisma, mockRedis);
  });

  it('should create a transaction', async () => {
    const result = await service.create(workspaceId, {
      amount: 100,
      type: 'expense',
      description: 'Test',
    });

    expect(result).toBeDefined();
    expect(result.amount).toBe(100);
  });
});
```

```typescript
// Test E2E (Playwright)
import { test, expect } from '@playwright/test';

test('user can create a transaction', async ({ page }) => {
  await page.goto('/dashboard');

  await page.click('[data-testid="new-transaction"]');
  await page.fill('[name="amount"]', '100');
  await page.fill('[name="description"]', 'Test transaction');
  await page.click('[type="submit"]');

  await expect(page.locator('.transaction-list')).toContainText('Test transaction');
});
```

---

## Commits et Pull Requests

### Format des commits

Utilisez le format [Conventional Commits](https://www.conventionalcommits.org/) :

```
type(scope): description

[body optionnel]

[footer optionnel]
```

Types :
- `feat` : Nouvelle fonctionnalite
- `fix` : Correction de bug
- `docs` : Documentation
- `style` : Formatage (pas de changement de code)
- `refactor` : Refactoring
- `test` : Ajout de tests
- `chore` : Maintenance

Exemples :
```bash
git commit -m "feat(transactions): add recurring transaction support"
git commit -m "fix(auth): handle expired refresh token correctly"
git commit -m "docs(readme): update installation instructions"
```

### Pull Requests

Template de PR :

```markdown
## Description

Breve description des changements.

## Type de changement

- [ ] Bug fix
- [ ] Nouvelle fonctionnalite
- [ ] Breaking change
- [ ] Documentation

## Issue liee

Fixes #123

## Checklist

- [ ] Tests ajoutes/mis a jour
- [ ] Documentation mise a jour
- [ ] Pas de warnings TypeScript
- [ ] Lint passe
```

### Criteres de review

- Au moins une approbation requise
- Les tests CI doivent passer
- Pas de conflits avec main
- Code conforme aux standards

---

## Questions ?

- Ouvrez une [Discussion](https://github.com/Louisdelez/HubCompta/discussions)
- Consultez les issues existantes

Merci de contribuer a HubCompta !
