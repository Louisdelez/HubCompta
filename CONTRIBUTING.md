# Contributing to HubCompta

Thank you for your interest in contributing to HubCompta! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

---

## Code of Conduct

This project follows a simple code of conduct:

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Assume good intentions

---

## Getting Started

### Prerequisites

- Node.js 20 LTS or later
- pnpm 8.x or later
- Docker and Docker Compose
- Git

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/HubCompta.git
cd HubCompta
```

3. Add the upstream remote:

```bash
git remote add upstream https://github.com/Louisdelez/HubCompta.git
```

---

## Development Setup

### 1. Start Infrastructure

```bash
cd docker
docker compose -f docker-compose.dev.yml up -d
cd ..
```

This starts PostgreSQL, Redis, and MinIO.

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your local settings
```

### 4. Setup Database

```bash
cd packages/backend
npx prisma generate
npx prisma migrate dev
cd ../..
```

### 5. Start Development Servers

```bash
pnpm dev
```

This starts:
- Backend API at `http://localhost:3001`
- Frontend at `http://localhost:5173`
- Worker process

---

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-dark-mode` - New features
- `fix/login-validation` - Bug fixes
- `docs/api-examples` - Documentation
- `refactor/auth-module` - Code refactoring
- `chore/update-deps` - Maintenance tasks

### Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

Examples:

```bash
feat(auth): add WebAuthn support
fix(transactions): correct balance calculation
docs(api): add rate limiting examples
```

---

## Pull Request Process

### 1. Create a Branch

```bash
git checkout -b feature/your-feature
```

### 2. Make Changes

- Write clean, readable code
- Add tests for new functionality
- Update documentation if needed

### 3. Test Your Changes

```bash
# Run linting
pnpm lint

# Run type checking
pnpm typecheck

# Run tests
pnpm test
```

### 4. Commit and Push

```bash
git add .
git commit -m "feat(scope): your changes"
git push origin feature/your-feature
```

### 5. Open a Pull Request

- Go to GitHub and create a PR
- Fill in the PR template
- Link related issues
- Wait for review

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests pass locally
- [ ] Documentation updated (if applicable)
- [ ] No console.log or debug code
- [ ] Commits are clean and atomic

---

## Coding Standards

### TypeScript

- Use strict mode
- Prefer `const` over `let`
- Use explicit types for function parameters and returns
- Avoid `any` type

```typescript
// Good
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Avoid
function calculateTotal(items: any): any {
  return items.reduce((sum: any, item: any) => sum + item.price, 0);
}
```

### React

- Use functional components with hooks
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use TypeScript for props

```tsx
// Good
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick}>
      {label}
    </button>
  );
}
```

### API Routes

- Use RESTful conventions
- Validate input with Zod schemas
- Return consistent response formats
- Handle errors gracefully

```typescript
// Good
fastify.post<{ Body: CreateTransactionInput }>('/transactions', {
  schema: { body: createTransactionSchema },
  handler: async (request, reply) => {
    const transaction = await transactionService.create(request.body);
    return reply.status(201).send({ data: transaction });
  },
});
```

### Database

- Use Prisma migrations for schema changes
- Write efficient queries
- Use transactions for multi-step operations
- Add indexes for frequently queried fields

---

## Testing

### Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter backend test
pnpm --filter frontend test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

### Writing Tests

- Test behavior, not implementation
- Use descriptive test names
- Mock external dependencies
- Aim for meaningful coverage

```typescript
describe('TransactionService', () => {
  describe('create', () => {
    it('should create a transaction with valid input', async () => {
      const input = {
        amount: 100,
        type: 'expense',
        description: 'Test transaction',
      };

      const result = await transactionService.create(input);

      expect(result.amount).toBe(100);
      expect(result.type).toBe('expense');
    });

    it('should throw error for negative amount', async () => {
      const input = { amount: -100, type: 'expense' };

      await expect(transactionService.create(input))
        .rejects.toThrow('Amount must be positive');
    });
  });
});
```

---

## Documentation

### Code Comments

- Comment complex logic
- Use JSDoc for public APIs
- Keep comments up to date

```typescript
/**
 * Calculates the running balance for a list of transactions.
 *
 * @param transactions - Sorted list of transactions (oldest first)
 * @param initialBalance - Starting balance
 * @returns Transactions with running balance attached
 */
function calculateRunningBalance(
  transactions: Transaction[],
  initialBalance: number
): TransactionWithBalance[] {
  // ...
}
```

### README Updates

If your change affects:
- Installation process
- Configuration options
- API endpoints
- Features

Please update the relevant documentation.

---

## Questions?

- Open a [GitHub Discussion](https://github.com/Louisdelez/HubCompta/discussions)
- Check existing [Issues](https://github.com/Louisdelez/HubCompta/issues)

Thank you for contributing!
