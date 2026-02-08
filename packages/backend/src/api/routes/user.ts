// ============================================================================
// USER ROUTES - Finance Hub
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { userService } from '@/modules/users/user.service.js';
import { deviceService } from '@/modules/auth/device.service.js';
import { mfaService } from '@/modules/auth/mfa.service.js';
import { sessionService } from '@/modules/auth/session.service.js';
import { auditService } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { stepUpGuard, handleStepUpVerify } from '@/core/auth/stepUpGuard.js';
import { userUpdateSchema, passwordChangeSchema } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth guard to all routes
  app.addHook('preHandler', authGuard);

  // --------------------------------------------------------------------------
  // GET /user/me - Get current user profile
  // --------------------------------------------------------------------------
  app.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await userService.getById(request.user!.sub);

    return reply.send({
      success: true,
      data: user,
    });
  });

  // --------------------------------------------------------------------------
  // PATCH /user/me - Update current user profile
  // --------------------------------------------------------------------------
  app.patch('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = userUpdateSchema.parse(request.body);
    const user = await userService.update(request.user!.sub, input);

    await auditService.log({
      userId: request.user!.sub,
      action: 'user.updated',
      changes: input,
      ipAddress: request.ip,
    });

    return reply.send({
      success: true,
      data: user,
    });
  });

  // --------------------------------------------------------------------------
  // POST /user/password - Change password
  // --------------------------------------------------------------------------
  app.post('/password', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = passwordChangeSchema.parse(request.body);

    await userService.changePassword(
      request.user!.sub,
      input.currentPassword,
      input.newPassword
    );

    await auditService.log({
      userId: request.user!.sub,
      action: 'auth.password.changed',
      ipAddress: request.ip,
      severity: 'warning',
    });

    return reply.send({
      success: true,
      data: { message: 'Password changed successfully' },
    });
  });

  // --------------------------------------------------------------------------
  // GET /user/devices - List user devices
  // --------------------------------------------------------------------------
  app.get('/devices', async (request: FastifyRequest, reply: FastifyReply) => {
    const devices = await deviceService.getUserDevices(request.user!.sub);

    return reply.send({
      success: true,
      data: devices,
    });
  });

  // --------------------------------------------------------------------------
  // DELETE /user/devices/:id - Revoke a device
  // --------------------------------------------------------------------------
  app.delete(
    '/devices/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const userId = request.user!.sub;

      // Get device info before deletion for audit
      const devices = await deviceService.getUserDevices(userId);
      const device = devices.find((d) => d.id === id);

      await deviceService.revoke(id, userId);

      if (device) {
        await auditService.logDeviceRevoked(
          userId,
          id,
          device.name,
          request.ip
        );
      }

      return reply.send({
        success: true,
        data: { message: 'Device revoked' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /user/devices/:id/trust - Trust a device
  // --------------------------------------------------------------------------
  app.patch(
    '/devices/:id/trust',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      await deviceService.trust(id, request.user!.sub);

      return reply.send({
        success: true,
        data: { message: 'Device trusted' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /user/devices/:id/untrust - Untrust a device
  // --------------------------------------------------------------------------
  app.patch(
    '/devices/:id/untrust',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      await deviceService.untrust(id, request.user!.sub);

      return reply.send({
        success: true,
        data: { message: 'Device untrusted' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /user/devices/:id/rename - Rename a device
  // --------------------------------------------------------------------------
  app.patch(
    '/devices/:id/rename',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { name: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { name } = request.body;

      await deviceService.rename(id, request.user!.sub, name);

      return reply.send({
        success: true,
        data: { message: 'Device renamed' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /user/sessions - List active sessions
  // --------------------------------------------------------------------------
  app.get('/sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessions = await sessionService.getUserSessions(request.user!.sub);

    // Mark current session
    const currentSessionId = (request as unknown as { sessionId?: string }).sessionId;
    const sessionsWithCurrent = sessions.map((session) => ({
      ...session,
      isCurrent: session.id === currentSessionId,
    }));

    return reply.send({
      success: true,
      data: sessionsWithCurrent,
    });
  });

  // --------------------------------------------------------------------------
  // DELETE /user/sessions/:id - Revoke a specific session
  // --------------------------------------------------------------------------
  app.delete<{ Params: { id: string } }>(
    '/sessions/:id',
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.sub;

      await sessionService.revoke(id, userId);

      await auditService.logLogout(userId, id, 'revoked', request.ip);

      return reply.send({
        success: true,
        data: { message: 'Session revoked' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /user/sessions/revoke-all - Revoke all other sessions
  // --------------------------------------------------------------------------
  app.post('/sessions/revoke-all', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.sub;
    const currentSessionId = (request as unknown as { sessionId?: string }).sessionId;

    await sessionService.revokeAllExcept(userId, currentSessionId);

    await auditService.log({
      userId,
      action: 'auth.sessions.revoked_all',
      ipAddress: request.ip,
      severity: 'warning',
    });

    return reply.send({
      success: true,
      data: { message: 'All other sessions revoked' },
    });
  });

  // --------------------------------------------------------------------------
  // GET /user/mfa - List MFA methods
  // --------------------------------------------------------------------------
  app.get('/mfa', async (request: FastifyRequest, reply: FastifyReply) => {
    const methods = await mfaService.getMethods(request.user!.sub);

    return reply.send({
      success: true,
      data: methods,
    });
  });

  // --------------------------------------------------------------------------
  // DELETE /user/mfa/:id - Remove MFA method (requires step-up)
  // --------------------------------------------------------------------------
  app.delete<{ Params: { id: string } }>(
    '/mfa/:id',
    { preHandler: [stepUpGuard('remove_mfa')] },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.sub;

      // Get MFA info before deletion for audit
      const methods = await mfaService.getMethods(userId);
      const method = methods.find((m) => m.id === id);

      await mfaService.remove(id, userId);

      if (method) {
        await auditService.logMfaRemoved(
          userId,
          id,
          method.type,
          method.name,
          request.ip
        );
      }

      return reply.send({
        success: true,
        data: { message: 'MFA method removed' },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /user/mfa/:id/backup-codes - Regenerate backup codes
  // --------------------------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/mfa/:id/backup-codes',
    { preHandler: [stepUpGuard('security_settings')] },
    async (request, reply) => {
      const { id } = request.params;
      const backupCodes = await mfaService.regenerateBackupCodes(id, request.user!.sub);

      return reply.send({
        success: true,
        data: { backupCodes },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /user/step-up - Verify step-up authentication
  // --------------------------------------------------------------------------
  app.post('/step-up', async (request: FastifyRequest, reply: FastifyReply) => {
    const { password, action } = request.body as { password: string; action: string };

    const result = await handleStepUpVerify(
      request.user!.sub,
      password,
      action as any // Will be validated in handler
    );

    await auditService.logSensitiveAction(
      request.user!.sub,
      action,
      result.success,
      request.ip
    );

    return reply.send({
      success: true,
      data: result,
    });
  });

  // --------------------------------------------------------------------------
  // GET /user/security-events - Get recent security events
  // --------------------------------------------------------------------------
  app.get('/security-events', async (request: FastifyRequest, reply: FastifyReply) => {
    const events = await auditService.getSecurityEvents(request.user!.sub);

    return reply.send({
      success: true,
      data: events,
    });
  });
}

export default userRoutes;
