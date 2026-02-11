// ============================================================================
// DATABASE SEED - Finance Hub
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/core/crypto/password.js';
import { subDays, subMonths, startOfMonth, addDays } from 'date-fns';

const prisma = new PrismaClient();

// ----------------------------------------------------------------------------
// Demo Data Constants
// ----------------------------------------------------------------------------

const DEMO_USER_EMAIL = 'demo@example.com';
const DEMO_USER_PASSWORD = 'demo123';
const DEMO_WORKSPACE_NAME = 'Mon Budget Personnel';

// ----------------------------------------------------------------------------
// Default Categories
// ----------------------------------------------------------------------------

const DEFAULT_EXPENSE_CATEGORIES = [
  // Housing
  { name: 'Logement', icon: '🏠', color: '#8B5CF6', children: [
    { name: 'Loyer', icon: '🔑' },
    { name: 'Charges', icon: '💡' },
    { name: 'Assurance habitation', icon: '🏠' },
    { name: 'Taxe habitation', icon: '📋' },
    { name: 'Entretien', icon: '🔧' },
  ]},

  // Food
  { name: 'Alimentation', icon: '🍽️', color: '#F59E0B', children: [
    { name: 'Courses', icon: '🛒' },
    { name: 'Restaurants', icon: '🍴' },
    { name: 'Livraison', icon: '🛵' },
  ]},

  // Transport
  { name: 'Transport', icon: '🚗', color: '#3B82F6', children: [
    { name: 'Carburant', icon: '⛽' },
    { name: 'Transport en commun', icon: '🚇' },
    { name: 'Entretien véhicule', icon: '🔧' },
    { name: 'Assurance auto', icon: '🚗' },
    { name: 'Péages', icon: '🛣️' },
    { name: 'Stationnement', icon: '🅿️' },
  ]},

  // Health
  { name: 'Santé', icon: '💊', color: '#EF4444', children: [
    { name: 'Médecin', icon: '👨‍⚕️' },
    { name: 'Pharmacie', icon: '💊' },
    { name: 'Mutuelle', icon: '🏥' },
    { name: 'Optique', icon: '👓' },
    { name: 'Dentiste', icon: '🦷' },
  ]},

  // Leisure
  { name: 'Loisirs', icon: '🎮', color: '#EC4899', children: [
    { name: 'Sorties', icon: '🎉' },
    { name: 'Sport', icon: '⚽' },
    { name: 'Culture', icon: '🎭' },
    { name: 'Vacances', icon: '✈️' },
    { name: 'Abonnements', icon: '📺' },
  ]},

  // Shopping
  { name: 'Shopping', icon: '🛍️', color: '#06B6D4', children: [
    { name: 'Vêtements', icon: '👔' },
    { name: 'High-tech', icon: '📱' },
    { name: 'Maison', icon: '🪴' },
    { name: 'Cadeaux', icon: '🎁' },
  ]},

  // Services
  { name: 'Services', icon: '📱', color: '#6366F1', children: [
    { name: 'Téléphone', icon: '📱' },
    { name: 'Internet', icon: '🌐' },
    { name: 'Banque', icon: '🏦' },
    { name: 'Services en ligne', icon: '💻' },
  ]},

  // Education
  { name: 'Éducation', icon: '📚', color: '#10B981', children: [
    { name: 'Scolarité', icon: '🎓' },
    { name: 'Formation', icon: '📖' },
    { name: 'Livres', icon: '📚' },
  ]},

  // Family
  { name: 'Famille', icon: '👨‍👩‍👧‍👦', color: '#F97316', children: [
    { name: 'Enfants', icon: '👶' },
    { name: 'Garde d\'enfants', icon: '🧸' },
    { name: 'Animaux', icon: '🐕' },
  ]},

  // Other
  { name: 'Divers', icon: '📦', color: '#64748B', children: [
    { name: 'Impôts', icon: '📋' },
    { name: 'Dons', icon: '❤️' },
    { name: 'Frais bancaires', icon: '💳' },
  ]},
];

const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salaire', icon: '💰', color: '#10B981' },
  { name: 'Primes', icon: '🎉', color: '#22C55E' },
  { name: 'Freelance', icon: '💼', color: '#14B8A6' },
  { name: 'Remboursements', icon: '💸', color: '#0EA5E9' },
  { name: 'Allocations', icon: '🏛️', color: '#6366F1' },
  { name: 'Investissements', icon: '📈', color: '#8B5CF6' },
  { name: 'Location', icon: '🏠', color: '#A855F7' },
  { name: 'Ventes', icon: '🏷️', color: '#EC4899' },
  { name: 'Autres revenus', icon: '💵', color: '#64748B' },
];

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function randomAmount(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// ----------------------------------------------------------------------------
// Seed Functions
// ----------------------------------------------------------------------------

async function seedDefaultCategories(workspaceId: string) {
  console.log(`  Seeding default categories for workspace ${workspaceId}...`);

  const createdCategories: Record<string, string> = {};

  // Seed expense categories
  for (const category of DEFAULT_EXPENSE_CATEGORIES) {
    const parent = await prisma.category.create({
      data: {
        workspaceId,
        name: category.name,
        type: 'expense',
        icon: category.icon,
        color: category.color,
      },
    });

    createdCategories[category.name] = parent.id;

    if (category.children) {
      for (const child of category.children) {
        const childCat = await prisma.category.create({
          data: {
            workspaceId,
            name: child.name,
            type: 'expense',
            icon: child.icon,
            color: category.color,
            parentId: parent.id,
          },
        });
        createdCategories[child.name] = childCat.id;
      }
    }
  }

  // Seed income categories
  for (const category of DEFAULT_INCOME_CATEGORIES) {
    const cat = await prisma.category.create({
      data: {
        workspaceId,
        name: category.name,
        type: 'income',
        icon: category.icon,
        color: category.color,
      },
    });
    createdCategories[category.name] = cat.id;
  }

  console.log('  Default categories seeded successfully.');
  return createdCategories;
}

async function seedDemoData() {
  console.log('Seeding demo data...');

  // Check if demo user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    include: {
      ownedWorkspaces: true,
    },
  });

  if (existingUser) {
    console.log('Demo user already exists. Checking for workspace...');

    const existingWorkspace = existingUser.ownedWorkspaces.find(
      (w) => w.name === DEMO_WORKSPACE_NAME && w.deletedAt === null
    );

    if (existingWorkspace) {
      console.log('Demo workspace already exists. Skipping demo data seed.');
      return;
    }
  }

  // Create demo user if not exists
  let demoUser = existingUser;
  if (!demoUser) {
    console.log('  Creating demo user...');
    const passwordHash = await hashPassword(DEMO_USER_PASSWORD);

    demoUser = await prisma.user.create({
      data: {
        email: DEMO_USER_EMAIL,
        displayName: 'Demo User',
        passwordHash,
        locale: 'fr-FR',
        timezone: 'Europe/Paris',
        theme: 'system',
      },
      include: {
        ownedWorkspaces: true,
      },
    });
    console.log(`  Demo user created: ${demoUser.email}`);
  }

  // Create demo workspace
  console.log('  Creating demo workspace...');
  const demoWorkspace = await prisma.workspace.create({
    data: {
      name: DEMO_WORKSPACE_NAME,
      type: 'personal',
      currency: 'EUR',
      ownerId: demoUser.id,
    },
  });
  console.log(`  Demo workspace created: ${demoWorkspace.name}`);

  // Create membership for owner
  await prisma.membership.create({
    data: {
      workspaceId: demoWorkspace.id,
      userId: demoUser.id,
      role: 'owner',
    },
  });

  // Seed categories and get their IDs
  const categoryIds = await seedDefaultCategories(demoWorkspace.id);

  // Create demo accounts
  console.log('  Creating demo accounts...');
  const checkingAccount = await prisma.account.create({
    data: {
      workspaceId: demoWorkspace.id,
      name: 'Compte Courant',
      type: 'checking',
      currency: 'EUR',
      balance: 2500,
      icon: '🏦',
      color: '#3B82F6',
    },
  });

  const savingsAccount = await prisma.account.create({
    data: {
      workspaceId: demoWorkspace.id,
      name: 'Livret A',
      type: 'savings',
      currency: 'EUR',
      balance: 5000,
      icon: '💰',
      color: '#10B981',
    },
  });

  const creditCardAccount = await prisma.account.create({
    data: {
      workspaceId: demoWorkspace.id,
      name: 'Carte Crédit',
      type: 'credit_card',
      currency: 'EUR',
      balance: -450,
      icon: '💳',
      color: '#EF4444',
    },
  });

  console.log('  Demo accounts created.');

  // Create demo transactions for the last 3 months
  console.log('  Creating demo transactions...');
  const today = new Date();
  const _threeMonthsAgo = subMonths(today, 3);

  const transactions: Array<{
    workspaceId: string;
    accountId: string;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    date: Date;
    description: string;
    categoryId: string;
    status: 'cleared' | 'pending' | 'reconciled';
  }> = [];

  // Monthly recurring transactions for the last 3 months
  for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
    const monthStart = startOfMonth(subMonths(today, monthOffset));

    // Salary - 28th or last day of month
    transactions.push({
      workspaceId: demoWorkspace.id,
      accountId: checkingAccount.id,
      type: 'income',
      amount: 2800,
      date: addDays(monthStart, 27), // ~28th
      description: 'Virement Salaire - ACME Corp',
      categoryId: categoryIds['Salaire'],
      status: 'cleared',
    });

    // Rent - 5th of month
    transactions.push({
      workspaceId: demoWorkspace.id,
      accountId: checkingAccount.id,
      type: 'expense',
      amount: -950,
      date: addDays(monthStart, 4), // 5th
      description: 'Prélèvement Loyer - Agence Immobilière',
      categoryId: categoryIds['Loyer'],
      status: 'cleared',
    });

    // Transport subscription - 1st of month
    transactions.push({
      workspaceId: demoWorkspace.id,
      accountId: checkingAccount.id,
      type: 'expense',
      amount: -75,
      date: monthStart,
      description: 'Prélèvement Navigo - RATP',
      categoryId: categoryIds['Transport en commun'],
      status: 'cleared',
    });

    // Groceries - several per month
    const groceryCount = 4 + Math.floor(Math.random() * 3); // 4-6 per month
    for (let i = 0; i < groceryCount; i++) {
      const groceryDate = randomDate(monthStart, addDays(monthStart, 28));
      transactions.push({
        workspaceId: demoWorkspace.id,
        accountId: checkingAccount.id,
        type: 'expense',
        amount: -randomAmount(50, 150),
        date: groceryDate,
        description: ['Carrefour', 'Monoprix', 'Lidl', 'Auchan'][Math.floor(Math.random() * 4)],
        categoryId: categoryIds['Courses'],
        status: 'cleared',
      });
    }

    // Entertainment - 1-3 per month
    const entertainmentCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < entertainmentCount; i++) {
      const entDate = randomDate(monthStart, addDays(monthStart, 28));
      const entType = Math.random();
      if (entType < 0.4) {
        transactions.push({
          workspaceId: demoWorkspace.id,
          accountId: checkingAccount.id,
          type: 'expense',
          amount: -randomAmount(50, 100),
          date: entDate,
          description: ['Cinéma UGC', 'Bar Le Comptoir', 'Restaurant Le Petit Bistro'][Math.floor(Math.random() * 3)],
          categoryId: categoryIds['Sorties'],
          status: 'cleared',
        });
      } else if (entType < 0.7) {
        transactions.push({
          workspaceId: demoWorkspace.id,
          accountId: checkingAccount.id,
          type: 'expense',
          amount: -randomAmount(15, 40),
          date: entDate,
          description: 'Netflix / Spotify / Amazon Prime',
          categoryId: categoryIds['Abonnements'],
          status: 'cleared',
        });
      } else {
        transactions.push({
          workspaceId: demoWorkspace.id,
          accountId: checkingAccount.id,
          type: 'expense',
          amount: -randomAmount(30, 80),
          date: entDate,
          description: 'Salle de Sport - Basic Fit',
          categoryId: categoryIds['Sport'],
          status: 'cleared',
        });
      }
    }

    // Health expenses - occasional
    if (Math.random() > 0.5) {
      transactions.push({
        workspaceId: demoWorkspace.id,
        accountId: checkingAccount.id,
        type: 'expense',
        amount: -randomAmount(25, 80),
        date: randomDate(monthStart, addDays(monthStart, 28)),
        description: 'Pharmacie du Centre',
        categoryId: categoryIds['Pharmacie'],
        status: 'cleared',
      });
    }
  }

  // Add some credit card transactions
  transactions.push({
    workspaceId: demoWorkspace.id,
    accountId: creditCardAccount.id,
    type: 'expense',
    amount: -randomAmount(50, 150),
    date: subDays(today, 5),
    description: 'Amazon - Achat en ligne',
    categoryId: categoryIds['High-tech'],
    status: 'cleared',
  });

  transactions.push({
    workspaceId: demoWorkspace.id,
    accountId: creditCardAccount.id,
    type: 'expense',
    amount: -randomAmount(80, 200),
    date: subDays(today, 10),
    description: 'Zara - Vêtements',
    categoryId: categoryIds['Vêtements'],
    status: 'cleared',
  });

  // Insert all transactions
  for (const tx of transactions) {
    await prisma.transaction.create({
      data: tx,
    });
  }
  console.log(`  ${transactions.length} demo transactions created.`);

  // Create demo budgets
  console.log('  Creating demo budgets...');
  const budgetStartDate = startOfMonth(today);

  await prisma.budget.createMany({
    data: [
      {
        workspaceId: demoWorkspace.id,
        categoryId: categoryIds['Alimentation'],
        name: 'Budget Alimentation',
        amount: 400,
        period: 'monthly',
        alertThreshold: 80,
        startDate: budgetStartDate,
      },
      {
        workspaceId: demoWorkspace.id,
        categoryId: categoryIds['Transport'],
        name: 'Budget Transport',
        amount: 100,
        period: 'monthly',
        alertThreshold: 80,
        startDate: budgetStartDate,
      },
      {
        workspaceId: demoWorkspace.id,
        categoryId: categoryIds['Loisirs'],
        name: 'Budget Loisirs',
        amount: 200,
        period: 'monthly',
        alertThreshold: 80,
        startDate: budgetStartDate,
      },
    ],
  });
  console.log('  Demo budgets created.');

  // Create demo savings goal
  console.log('  Creating demo savings goal...');
  await prisma.savingsGoal.create({
    data: {
      workspaceId: demoWorkspace.id,
      accountId: savingsAccount.id,
      name: 'Vacances été',
      targetAmount: 2000,
      currentAmount: 800,
      currency: 'EUR',
      targetDate: addDays(today, 180), // ~6 months from now
      icon: '✈️',
      color: '#F59E0B',
      notes: 'Objectif vacances en Italie',
    },
  });

  // Add some contributions to the savings goal
  const savingsGoal = await prisma.savingsGoal.findFirst({
    where: { workspaceId: demoWorkspace.id, name: 'Vacances été' },
  });

  if (savingsGoal) {
    const contributions = [
      { amount: 200, date: subMonths(today, 3), notes: 'Premier versement' },
      { amount: 200, date: subMonths(today, 2), notes: 'Versement mensuel' },
      { amount: 200, date: subMonths(today, 1), notes: 'Versement mensuel' },
      { amount: 200, date: subDays(today, 5), notes: 'Versement mensuel' },
    ];

    for (const contrib of contributions) {
      await prisma.savingsContribution.create({
        data: {
          savingsGoalId: savingsGoal.id,
          amount: contrib.amount,
          date: contrib.date,
          notes: contrib.notes,
        },
      });
    }
  }
  console.log('  Demo savings goal created.');

  console.log('');
  console.log('========================================');
  console.log('Demo data seeded successfully!');
  console.log('========================================');
  console.log('');
  console.log('Login credentials:');
  console.log(`  Email: ${DEMO_USER_EMAIL}`);
  console.log(`  Password: ${DEMO_USER_PASSWORD}`);
  console.log('');
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

async function main() {
  console.log('Starting database seed...');
  console.log('');

  // If a workspace ID is provided as an argument, seed only categories for that workspace
  const workspaceId = process.argv[2];

  if (workspaceId && workspaceId !== '--demo') {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      console.error(`Workspace ${workspaceId} not found.`);
      process.exit(1);
    }

    // Check if workspace already has categories
    const existingCategories = await prisma.category.count({
      where: { workspaceId },
    });

    if (existingCategories > 0) {
      console.log('Workspace already has categories. Skipping seed.');
      return;
    }

    await seedDefaultCategories(workspaceId);
  } else {
    // Seed demo data by default
    await seedDemoData();
  }

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// Export for use in workspace creation
export { seedDefaultCategories, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES };
