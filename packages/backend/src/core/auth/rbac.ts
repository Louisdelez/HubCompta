// ============================================================================
// RBAC (Role-Based Access Control) - Finance Hub
// ============================================================================

import { PERMISSIONS, ROLE_HIERARCHY } from '@finance-hub/shared';
import type { MembershipRole } from '@prisma/client';
import { prisma } from '@/core/database/client.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type Permission = keyof typeof PERMISSIONS;

// ----------------------------------------------------------------------------
// Role Helpers
// ----------------------------------------------------------------------------

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: MembershipRole, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission] as readonly string[];
  return allowedRoles.includes(role);
}

/**
 * Check if a user has permission for a specific action in a workspace
 * @throws Error if user doesn't have permission
 */
export async function checkPermission(
  userId: string,
  workspaceId: string,
  resource: string,
  action: string
): Promise<void> {
  // Get user's membership in this workspace
  const membership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: {
        userId,
        workspaceId,
      },
    },
  });

  if (!membership) {
    throw new Error('Not a member of this workspace');
  }

  // Build permission key
  const permissionKey = `${resource}:${action}` as Permission;

  // Check if this permission exists
  if (!(permissionKey in PERMISSIONS)) {
    // If permission doesn't exist, default to checking basic resource access
    const readPermission = `${resource}:read` as Permission;
    if (readPermission in PERMISSIONS && !hasPermission(membership.role, readPermission)) {
      throw new Error(`Insufficient permissions for ${resource}:${action}`);
    }
    return;
  }

  if (!hasPermission(membership.role, permissionKey)) {
    throw new Error(`Insufficient permissions for ${resource}:${action}`);
  }
}

/**
 * Check if role1 is at least as privileged as role2
 */
export function isRoleAtLeast(role: MembershipRole, minimumRole: MembershipRole): boolean {
  const roleIndex = ROLE_HIERARCHY.indexOf(role as (typeof ROLE_HIERARCHY)[number]);
  const minIndex = ROLE_HIERARCHY.indexOf(minimumRole as (typeof ROLE_HIERARCHY)[number]);
  return roleIndex >= minIndex;
}

/**
 * Check if role1 is more privileged than role2
 */
export function isRoleHigher(role1: MembershipRole, role2: MembershipRole): boolean {
  const index1 = ROLE_HIERARCHY.indexOf(role1 as (typeof ROLE_HIERARCHY)[number]);
  const index2 = ROLE_HIERARCHY.indexOf(role2 as (typeof ROLE_HIERARCHY)[number]);
  return index1 > index2;
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: MembershipRole): Permission[] {
  const permissions: Permission[] = [];

  for (const [permission, roles] of Object.entries(PERMISSIONS)) {
    if ((roles as readonly string[]).includes(role)) {
      permissions.push(permission as Permission);
    }
  }

  return permissions;
}

/**
 * Get the highest role that has a permission
 */
export function getMinimumRoleForPermission(permission: Permission): MembershipRole {
  const roles = PERMISSIONS[permission] as readonly string[];

  // Find the lowest role in hierarchy that has this permission
  for (const role of ROLE_HIERARCHY) {
    if (roles.includes(role)) {
      return role as MembershipRole;
    }
  }

  return 'owner'; // Default to owner if not found
}

// ----------------------------------------------------------------------------
// Permission Descriptions
// ----------------------------------------------------------------------------

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  // Transaction permissions
  'transaction:read': 'Voir les transactions',
  'transaction:create': 'Créer des transactions',
  'transaction:update': 'Modifier les transactions',
  'transaction:delete': 'Supprimer des transactions',

  // Account permissions
  'account:read': 'Voir les comptes',
  'account:create': 'Créer des comptes',
  'account:update': 'Modifier les comptes',
  'account:delete': 'Supprimer des comptes',

  // Budget permissions
  'budget:read': 'Voir les budgets',
  'budget:create': 'Créer des budgets',
  'budget:update': 'Modifier les budgets',
  'budget:delete': 'Supprimer des budgets',

  // Document permissions
  'document:read': 'Voir les documents',
  'document:upload': 'Télécharger des documents',
  'document:delete': 'Supprimer des documents',

  // Import permissions
  'import:execute': 'Importer des données',

  // Rule permissions
  'rule:read': 'Voir les règles',
  'rule:manage': 'Gérer les règles',

  // Member permissions
  'member:read': 'Voir les membres',
  'member:invite': 'Inviter des membres',
  'member:update': 'Modifier les rôles',
  'member:remove': 'Retirer des membres',

  // Workspace permissions
  'workspace:read': 'Voir l\'espace de travail',
  'workspace:update': 'Modifier l\'espace de travail',
  'workspace:delete': 'Supprimer l\'espace de travail',

  // Pro mode permissions
  'pro:read': 'Voir le mode Pro',
  'pro:manage': 'Gérer le mode Pro',

  // Export permissions
  'export:execute': 'Exporter des données',
};

// ----------------------------------------------------------------------------
// Role Descriptions
// ----------------------------------------------------------------------------

export const ROLE_DESCRIPTIONS: Record<MembershipRole, { name: string; description: string }> = {
  owner: {
    name: 'Propriétaire',
    description: 'Accès complet, peut supprimer l\'espace de travail',
  },
  admin: {
    name: 'Administrateur',
    description: 'Gère les membres et les paramètres',
  },
  accountant: {
    name: 'Comptable',
    description: 'Gère les transactions, budgets et imports',
  },
  member: {
    name: 'Membre',
    description: 'Peut ajouter des transactions et documents',
  },
  readonly: {
    name: 'Lecture seule',
    description: 'Consultation uniquement',
  },
};
