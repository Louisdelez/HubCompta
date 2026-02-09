// ============================================================================
// DATABASE SEED - Finance Hub
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
// Seed Function
// ----------------------------------------------------------------------------

async function seedDefaultCategories(workspaceId: string) {
  console.log(`Seeding default categories for workspace ${workspaceId}...`);

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

    if (category.children) {
      for (const child of category.children) {
        await prisma.category.create({
          data: {
            workspaceId,
            name: child.name,
            type: 'expense',
            icon: child.icon,
            color: category.color,
            parentId: parent.id,
          },
        });
      }
    }
  }

  // Seed income categories
  for (const category of DEFAULT_INCOME_CATEGORIES) {
    await prisma.category.create({
      data: {
        workspaceId,
        name: category.name,
        type: 'income',
        icon: category.icon,
        color: category.color,
      },
    });
  }

  console.log('Default categories seeded successfully.');
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

async function main() {
  console.log('Starting database seed...');

  // If a workspace ID is provided as an argument, seed that workspace
  const workspaceId = process.argv[2];

  if (workspaceId) {
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
    console.log('No workspace ID provided. To seed a workspace, run:');
    console.log('  npx prisma db seed -- <workspace-id>');
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
