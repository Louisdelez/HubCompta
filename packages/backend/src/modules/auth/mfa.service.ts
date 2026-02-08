// ============================================================================
// MFA SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError, ValidationError } from '@/core/middleware/errorHandler.js';
import * as OTPAuth from 'otpauth';
import { randomBytes } from 'crypto';
import type { MFA, MFAType } from '@prisma/client';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const MFA_ISSUER = process.env.MFA_ISSUER ?? 'Finance Hub';
const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30;
const BACKUP_CODES_COUNT = 10;

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface TotpSetupResult {
  mfaId: string;
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface MfaMethod {
  id: string;
  type: MFAType;
  name: string;
  createdAt: Date;
}

// ----------------------------------------------------------------------------
// TOTP Helpers
// ----------------------------------------------------------------------------

function generateSecret(): string {
  // Generate a 20-byte (160-bit) secret as recommended
  return randomBytes(20).toString('base64');
}

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
    // Generate 8-character alphanumeric codes
    const code = randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
  }
  return codes;
}

function createTotp(secret: string, email: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: MFA_ISSUER,
    label: email,
    algorithm: 'SHA1',
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase64(secret),
  });
}

// ----------------------------------------------------------------------------
// MFA Service
// ----------------------------------------------------------------------------

export const mfaService = {
  /**
   * Initialize TOTP setup (returns secret and QR code)
   */
  async initTotpSetup(userId: string, name: string): Promise<TotpSetupResult> {
    // Get user email for TOTP label
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    // Generate secret
    const secret = generateSecret();
    const backupCodes = generateBackupCodes();

    // Create TOTP instance
    const totp = createTotp(secret, user.email);

    // Generate QR code URL
    const qrCodeUrl = totp.toString();

    // Store pending MFA (not enabled until verified)
    const mfa = await prisma.mFA.create({
      data: {
        userId,
        type: 'totp',
        name,
        secret: JSON.stringify({ secret, backupCodes }), // Store encrypted in production
        isEnabled: false,
      },
    });

    return {
      mfaId: mfa.id,
      secret,
      qrCodeUrl,
      backupCodes,
    };
  },

  /**
   * Verify TOTP code and enable MFA
   */
  async verifyAndEnableTotp(mfaId: string, code: string): Promise<void> {
    const mfa = await prisma.mFA.findUnique({
      where: { id: mfaId },
      include: { user: { select: { email: true } } },
    });

    if (!mfa) {
      throw new NotFoundError('MFA', mfaId);
    }

    if (mfa.isEnabled) {
      throw new ValidationError('MFA is already enabled');
    }

    // Parse stored secret
    const { secret } = JSON.parse(mfa.secret) as { secret: string; backupCodes: string[] };

    // Create TOTP and verify
    const totp = createTotp(secret, mfa.user.email);
    const isValid = totp.validate({ token: code, window: 1 }) !== null;

    if (!isValid) {
      throw new ValidationError('Invalid verification code');
    }

    // Enable MFA
    await prisma.mFA.update({
      where: { id: mfaId },
      data: { isEnabled: true },
    });
  },

  /**
   * Verify TOTP code for login
   */
  async verifyTotp(userId: string, code: string): Promise<boolean> {
    // Get user's enabled TOTP methods
    const mfaMethods = await prisma.mFA.findMany({
      where: {
        userId,
        type: 'totp',
        isEnabled: true,
      },
      include: { user: { select: { email: true } } },
    });

    if (mfaMethods.length === 0) {
      throw new ValidationError('No TOTP method configured');
    }

    // Try each method (user might have multiple)
    for (const mfa of mfaMethods) {
      const { secret, backupCodes } = JSON.parse(mfa.secret) as {
        secret: string;
        backupCodes: string[];
      };

      // Check if it's a backup code
      const normalizedCode = code.toUpperCase().replace(/-/g, '');
      const backupIndex = backupCodes.findIndex(
        (bc) => bc.replace(/-/g, '') === normalizedCode
      );

      if (backupIndex !== -1) {
        // Remove used backup code
        backupCodes.splice(backupIndex, 1);
        await prisma.mFA.update({
          where: { id: mfa.id },
          data: {
            secret: JSON.stringify({ secret, backupCodes }),
            usedAt: new Date(),
          },
        });
        return true;
      }

      // Verify TOTP
      const totp = createTotp(secret, mfa.user.email);
      const isValid = totp.validate({ token: code, window: 1 }) !== null;

      if (isValid) {
        // Update last used
        await prisma.mFA.update({
          where: { id: mfa.id },
          data: { usedAt: new Date() },
        });
        return true;
      }
    }

    return false;
  },

  /**
   * Get user's MFA methods
   */
  async getMethods(userId: string): Promise<MfaMethod[]> {
    const methods = await prisma.mFA.findMany({
      where: {
        userId,
        isEnabled: true,
      },
      select: {
        id: true,
        type: true,
        name: true,
        createdAt: true,
      },
    });

    return methods;
  },

  /**
   * Remove MFA method
   */
  async remove(mfaId: string, userId: string): Promise<void> {
    const mfa = await prisma.mFA.findFirst({
      where: {
        id: mfaId,
        userId,
      },
    });

    if (!mfa) {
      throw new NotFoundError('MFA', mfaId);
    }

    // Check if this is the last MFA method
    const count = await prisma.mFA.count({
      where: {
        userId,
        isEnabled: true,
      },
    });

    if (count <= 1) {
      throw new ValidationError('Cannot remove last MFA method. MFA is required.');
    }

    await prisma.mFA.delete({
      where: { id: mfaId },
    });
  },

  /**
   * Generate new backup codes
   */
  async regenerateBackupCodes(mfaId: string, userId: string): Promise<string[]> {
    const mfa = await prisma.mFA.findFirst({
      where: {
        id: mfaId,
        userId,
        type: 'totp',
        isEnabled: true,
      },
    });

    if (!mfa) {
      throw new NotFoundError('MFA', mfaId);
    }

    const { secret } = JSON.parse(mfa.secret) as { secret: string };
    const backupCodes = generateBackupCodes();

    await prisma.mFA.update({
      where: { id: mfaId },
      data: {
        secret: JSON.stringify({ secret, backupCodes }),
      },
    });

    return backupCodes;
  },
};

export default mfaService;
