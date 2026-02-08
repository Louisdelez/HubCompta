// ============================================================================
// JWT UTILITIES - Finance Hub
// ============================================================================

import { createSigner, createVerifier, createDecoder } from 'fast-jwt';
import type { TokenPayload } from '@finance-hub/shared';
import { AUTH } from '@finance-hub/shared';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters long');
}

// Create JWT utilities
const accessSigner = createSigner({
  key: JWT_SECRET,
  expiresIn: AUTH.TOKEN_EXPIRY.ACCESS * 1000, // Convert to ms
  algorithm: 'HS256',
});

const refreshSigner = createSigner({
  key: JWT_SECRET,
  expiresIn: AUTH.TOKEN_EXPIRY.REFRESH * 1000,
  algorithm: 'HS256',
});

const mfaTempSigner = createSigner({
  key: JWT_SECRET,
  expiresIn: AUTH.TOKEN_EXPIRY.MFA_TEMP * 1000,
  algorithm: 'HS256',
});

const verifier = createVerifier({
  key: JWT_SECRET,
  algorithms: ['HS256'],
  cache: true,
  cacheTTL: 60000, // 1 minute cache
});

const decoder = createDecoder();

// ----------------------------------------------------------------------------
// Token Generation
// ----------------------------------------------------------------------------

export interface AccessTokenPayload {
  sub: string; // User ID
  email: string;
  deviceId: string;
  workspaceId?: string;
  role?: string;
}

export interface RefreshTokenPayload {
  sub: string;
  deviceId: string;
  sessionId: string;
}

export interface MfaTempTokenPayload {
  sub: string;
  email: string;
  deviceId: string;
  mfaRequired: boolean;
}

/**
 * Sign an access token
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  return accessSigner(payload);
}

/**
 * Sign a refresh token
 */
export function signRefreshToken(payload: RefreshTokenPayload): string {
  return refreshSigner(payload);
}

/**
 * Sign a temporary MFA token (valid for 5 minutes)
 */
export function signMfaTempToken(payload: MfaTempTokenPayload): string {
  return mfaTempSigner(payload);
}

// ----------------------------------------------------------------------------
// Token Verification
// ----------------------------------------------------------------------------

/**
 * Verify and decode a token
 * @throws Error if token is invalid or expired
 */
export function verifyToken<T>(token: string): T {
  return verifier(token) as T;
}

/**
 * Decode a token without verification (for debugging)
 */
export function decodeToken<T>(token: string): T | null {
  try {
    return decoder(token) as T;
  } catch {
    return null;
  }
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token: string): TokenPayload {
  return verifyToken<TokenPayload>(token);
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return verifyToken<RefreshTokenPayload>(token);
}

/**
 * Verify a temporary MFA token
 */
export function verifyMfaTempToken(token: string): MfaTempTokenPayload {
  return verifyToken<MfaTempTokenPayload>(token);
}

// ----------------------------------------------------------------------------
// Token Hashing (for storage)
// ----------------------------------------------------------------------------

import { createHash } from 'crypto';

/**
 * Hash a token for storage (used for refresh tokens)
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
