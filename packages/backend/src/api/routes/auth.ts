// ============================================================================
// AUTH ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { userService } from '@/modules/users/user.service.js';
import { mfaService } from '@/modules/auth/mfa.service.js';
import { sessionService } from '@/modules/auth/session.service.js';
import { deviceService } from '@/modules/auth/device.service.js';
import { auditService } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { signMfaTempToken, verifyMfaTempToken } from '@/core/crypto/jwt.js';
import { verifyPassword } from '@/core/crypto/password.js';
import { redisClient, REDIS_KEYS, incrementWithExpiry } from '@/core/database/redis.js';
import {
  UnauthorizedError,
  ValidationError,
  RateLimitError,
  SessionLockedError,
} from '@/core/middleware/errorHandler.js';
import {
  registerSchema,
  loginSchema,
  mfaVerifySchema,
  mfaSetupSchema,
  totpVerifySchema,
} from '@finance-hub/shared';
import { AUTH } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Rate Limiting Helpers
// ----------------------------------------------------------------------------

async function checkLoginRateLimit(email: string, ip: string): Promise<void> {
  const key = REDIS_KEYS.loginAttempts(email);
  const attempts = await incrementWithExpiry(key, AUTH.RATE_LIMIT.LOCKOUT_MINUTES * 60);

  if (attempts > AUTH.RATE_LIMIT.LOGIN_ATTEMPTS) {
    // Set lockout
    await redisClient.setex(
      REDIS_KEYS.accountLockout(email),
      AUTH.RATE_LIMIT.LOCKOUT_MINUTES * 60,
      '1'
    );
    throw new RateLimitError(AUTH.RATE_LIMIT.LOCKOUT_MINUTES * 60);
  }
}

async function isAccountLocked(email: string): Promise<boolean> {
  const locked = await redisClient.get(REDIS_KEYS.accountLockout(email));
  return locked !== null;
}

async function clearLoginAttempts(email: string): Promise<void> {
  await redisClient.del(REDIS_KEYS.loginAttempts(email));
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // --------------------------------------------------------------------------
  // POST /auth/register - Create new user account
  // --------------------------------------------------------------------------
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = registerSchema.parse(request.body);

    const user = await userService.create(input);

    await auditService.log({
      userId: user.id,
      action: 'user.created',
      changes: { email: user.email, displayName: user.displayName },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      success: true,
      data: {
        user,
        message: 'Account created. Please configure MFA to continue.',
        requiresMfaSetup: true,
      },
    });
  });

  // --------------------------------------------------------------------------
  // POST /auth/login - Authenticate user
  // --------------------------------------------------------------------------
  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = loginSchema.parse(request.body);
    const { email, password, deviceFingerprint, deviceName } = input;

    // Check lockout
    if (await isAccountLocked(email)) {
      await auditService.logLoginFailed(email, 'account_locked', 0, request.ip);
      throw new RateLimitError(AUTH.RATE_LIMIT.LOCKOUT_MINUTES * 60);
    }

    // Check rate limit
    await checkLoginRateLimit(email, request.ip);

    // Find user
    const user = await userService.findByEmail(email);
    if (!user) {
      await auditService.logLoginFailed(email, 'invalid_credentials', 1, request.ip);
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password
    const isValid = await userService.verifyPassword(user, password);
    if (!isValid) {
      await auditService.logLoginFailed(email, 'invalid_credentials', 1, request.ip);
      throw new UnauthorizedError('Invalid email or password');
    }

    // Clear rate limit on successful password
    await clearLoginAttempts(email);

    // Check if MFA is enabled
    const hasMfa = await userService.hasMfaEnabled(user.id);

    if (hasMfa) {
      // Get MFA methods
      const mfaMethods = await userService.getMfaMethods(user.id);

      // Generate temp token for MFA flow
      const tempToken = signMfaTempToken({
        sub: user.id,
        email: user.email,
        deviceId: deviceFingerprint,
        mfaRequired: true,
      });

      return reply.send({
        success: true,
        data: {
          requiresMfa: true,
          mfaMethods: mfaMethods.map((m) => m.type),
          tempToken,
        },
      });
    }

    // No MFA - this shouldn't happen in production (MFA is mandatory)
    // But for initial setup, we allow it
    const { device, isNew } = await deviceService.findOrCreate(
      user.id,
      deviceFingerprint,
      deviceName
    );

    const tokens = await sessionService.create(user.id, device.id, user.email);

    await auditService.logLoginSuccess(
      user.id,
      device.id,
      deviceName,
      isNew,
      request.ip,
      request.headers['user-agent']
    );

    return reply.send({
      success: true,
      data: {
        requiresMfa: false,
        ...tokens,
        user: await userService.findById(user.id),
      },
    });
  });

  // --------------------------------------------------------------------------
  // POST /auth/mfa/verify - Verify MFA code
  // --------------------------------------------------------------------------
  app.post('/mfa/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = mfaVerifySchema.parse(request.body);
    const { tempToken, code, type } = input;

    // Verify temp token
    let tokenPayload;
    try {
      tokenPayload = verifyMfaTempToken(tempToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired MFA token');
    }

    // Verify MFA code
    let isValid = false;

    if (type === 'totp') {
      isValid = await mfaService.verifyTotp(tokenPayload.sub, code);
    } else {
      // WebAuthn verification would go here
      throw new ValidationError('WebAuthn not yet implemented');
    }

    if (!isValid) {
      await auditService.logLoginFailed(
        tokenPayload.email,
        'mfa_failed',
        1,
        request.ip
      );
      throw new UnauthorizedError('Invalid MFA code');
    }

    // Create device and session
    const { device, isNew } = await deviceService.findOrCreate(
      tokenPayload.sub,
      tokenPayload.deviceId,
      'Unknown Device' // Device name from original login request
    );

    const tokens = await sessionService.create(
      tokenPayload.sub,
      device.id,
      tokenPayload.email
    );

    await auditService.logLoginSuccess(
      tokenPayload.sub,
      device.id,
      device.name,
      isNew,
      request.ip,
      request.headers['user-agent']
    );

    return reply.send({
      success: true,
      data: {
        ...tokens,
        user: await userService.findById(tokenPayload.sub),
      },
    });
  });

  // --------------------------------------------------------------------------
  // POST /auth/mfa/setup - Initialize MFA setup
  // --------------------------------------------------------------------------
  app.post(
    '/mfa/setup',
    { preHandler: [authGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const input = mfaSetupSchema.parse(request.body);
      const userId = request.user!.sub;

      if (input.type === 'totp') {
        const result = await mfaService.initTotpSetup(userId, input.name);

        return reply.send({
          success: true,
          data: {
            mfaId: result.mfaId,
            qrCodeUrl: result.qrCodeUrl,
            secret: result.secret, // Show for manual entry
            backupCodes: result.backupCodes,
          },
        });
      }

      throw new ValidationError('Unsupported MFA type');
    }
  );

  // --------------------------------------------------------------------------
  // POST /auth/mfa/setup/verify - Verify and enable MFA
  // --------------------------------------------------------------------------
  app.post(
    '/mfa/setup/verify',
    { preHandler: [authGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { mfaId, code } = totpVerifySchema.parse(request.body) as {
        mfaId: string;
        code: string;
        secret: string;
      };

      await mfaService.verifyAndEnableTotp(mfaId, code);

      await auditService.logMfaSetup(
        request.user!.sub,
        mfaId,
        'totp',
        'TOTP Authenticator',
        request.ip
      );

      return reply.send({
        success: true,
        data: { message: 'MFA enabled successfully' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /auth/refresh - Refresh access token
  // --------------------------------------------------------------------------
  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    if (!refreshToken) {
      throw new ValidationError('Refresh token required');
    }

    const tokens = await sessionService.refresh(refreshToken);

    return reply.send({
      success: true,
      data: tokens,
    });
  });

  // --------------------------------------------------------------------------
  // POST /auth/logout - End session
  // --------------------------------------------------------------------------
  app.post(
    '/logout',
    { preHandler: [authGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Get session from refresh token if available
      const { refreshToken } = request.body as { refreshToken?: string };

      if (refreshToken) {
        try {
          const payload = verifyMfaTempToken(refreshToken);
          await sessionService.revoke(payload.sub);
        } catch {
          // Ignore invalid tokens
        }
      }

      await auditService.logLogout(
        request.user!.sub,
        'session',
        'manual',
        request.ip
      );

      return reply.send({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /auth/lock - Lock session
  // --------------------------------------------------------------------------
  app.post(
    '/lock',
    { preHandler: [authGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Note: In a full implementation, we'd track session ID
      await auditService.logSessionLocked(
        request.user!.sub,
        'session',
        'manual',
        request.ip
      );

      return reply.send({
        success: true,
        data: { message: 'Session locked' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /auth/unlock - Unlock session
  // --------------------------------------------------------------------------
  app.post(
    '/unlock',
    { preHandler: [authGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { password } = request.body as { password: string };

      if (!password) {
        throw new ValidationError('Password required');
      }

      // Verify password
      const user = await userService.findByEmail(request.user!.email);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      const isValid = await verifyPassword(user.passwordHash, password);
      if (!isValid) {
        throw new UnauthorizedError('Invalid password');
      }

      await auditService.logSessionUnlocked(
        request.user!.sub,
        'session',
        request.ip
      );

      return reply.send({
        success: true,
        data: { message: 'Session unlocked' },
      });
    }
  );
}

export default authRoutes;
