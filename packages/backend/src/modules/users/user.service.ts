// ============================================================================
// USER SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { hashPassword, verifyPassword, needsRehash } from '@/core/crypto/password.js';
import { ConflictError, NotFoundError, ValidationError } from '@/core/middleware/errorHandler.js';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '@/core/cache/index.js';
import type { User } from '@prisma/client';
import type { RegisterInput, UserUpdateInput } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type SafeUser = Omit<User, 'passwordHash'>;

function toSafeUser(user: User): SafeUser {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

// ----------------------------------------------------------------------------
// User Service
// ----------------------------------------------------------------------------

export const userService = {
  /**
   * Create a new user
   */
  async create(input: RegisterInput): Promise<SafeUser> {
    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictError('Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        displayName: input.displayName,
        passwordHash,
        // First user becomes instance admin
        isInstanceAdmin: (await prisma.user.count()) === 0,
      },
    });

    return toSafeUser(user);
  },

  /**
   * Find user by ID (with caching)
   */
  async findById(id: string): Promise<SafeUser | null> {
    return cacheService.getOrSet(
      CACHE_KEYS.userProfile(id),
      async () => {
        const user = await prisma.user.findUnique({
          where: { id },
        });
        return user ? toSafeUser(user) : null;
      },
      CACHE_TTL.USER_PROFILE
    );
  },

  /**
   * Find user by email
   */
  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  },

  /**
   * Get user by ID (throws if not found)
   */
  async getById(id: string): Promise<SafeUser> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundError('User', id);
    }
    return user;
  },

  /**
   * Update user profile (invalidates cache)
   */
  async update(id: string, input: UserUpdateInput): Promise<SafeUser> {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(input.displayName && { displayName: input.displayName }),
        ...(input.locale && { locale: input.locale }),
        ...(input.timezone && { timezone: input.timezone }),
      },
    });

    // Invalidate user cache on update
    await cacheService.invalidateUserCache(id);

    return toSafeUser(user);
  },

  /**
   * Verify user password
   */
  async verifyPassword(user: User, password: string): Promise<boolean> {
    const isValid = await verifyPassword(user.passwordHash, password);

    // Rehash if needed (parameters changed)
    if (isValid && needsRehash(user.passwordHash)) {
      const newHash = await hashPassword(password);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });
    }

    return isValid;
  },

  /**
   * Change user password
   */
  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundError('User', id);
    }

    // Verify current password
    const isValid = await verifyPassword(user.passwordHash, currentPassword);
    if (!isValid) {
      throw new ValidationError('Current password is incorrect');
    }

    // Hash and update new password
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id },
      data: { passwordHash: newHash },
    });
  },

  /**
   * Check if user has MFA enabled
   */
  async hasMfaEnabled(userId: string): Promise<boolean> {
    const count = await prisma.mFA.count({
      where: {
        userId,
        isEnabled: true,
      },
    });
    return count > 0;
  },

  /**
   * Get user's enabled MFA methods
   */
  async getMfaMethods(userId: string): Promise<Array<{ id: string; type: string; name: string }>> {
    const methods = await prisma.mFA.findMany({
      where: {
        userId,
        isEnabled: true,
      },
      select: {
        id: true,
        type: true,
        name: true,
      },
    });
    return methods;
  },
};

export default userService;
