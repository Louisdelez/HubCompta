// ============================================================================
// NOTIFICATION CHANNELS ROUTES - Finance Hub
// Multi-channel notification management API
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  notificationChannelService,
  notificationDispatcherService,
  whatsappService,
  smsService,
  discordService,
} from '@/modules/notifications/index.js';
import {
  NOTIFICATION_TYPES,
  type ChannelType,
} from '@/modules/notifications/channel.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { logger } from '@/core/middleware/logger.js';

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------

const channelTypeSchema = z.enum(['email', 'whatsapp', 'sms', 'discord']);

const createChannelSchema = z.object({
  channelType: channelTypeSchema,
  email: z.string().email().optional(),
  whatsappPhone: z.string().min(10).max(20).optional(),
  smsPhone: z.string().min(10).max(20).optional(),
  discordWebhookUrl: z.string().url().optional(),
  enabledTypes: z.array(z.string()).optional(),
});

const updateChannelSchema = z.object({
  email: z.string().email().optional(),
  whatsappPhone: z.string().min(10).max(20).optional(),
  smsPhone: z.string().min(10).max(20).optional(),
  discordWebhookUrl: z.string().url().optional(),
  enabledTypes: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const verifyChannelSchema = z.object({
  code: z.string().length(6),
});

const setPreferencesSchema = z.object({
  enabledTypes: z.array(z.string()),
});

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ChannelParams {
  channelId: string;
}

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------

function maskPhone(phone: string): string {
  if (phone.length <= 6) return phone;
  return phone.slice(0, 4) + '****' + phone.slice(-2);
}

// ----------------------------------------------------------------------------
// Route Registration
// ----------------------------------------------------------------------------

export async function notificationChannelRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes
  app.addHook('preHandler', authGuard);

  // --------------------------------------------------------------------------
  // GET / - List all channels
  // --------------------------------------------------------------------------
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.sub;

    const channels = await notificationChannelService.getChannels(userId);

    // Remove sensitive data
    const sanitizedChannels = channels.map((channel) => ({
      id: channel.id,
      channelType: channel.channelType,
      email: channel.email,
      emailVerified: channel.emailVerified,
      whatsappPhone: channel.whatsappPhone ? maskPhone(channel.whatsappPhone) : null,
      whatsappVerified: channel.whatsappVerified,
      smsPhone: channel.smsPhone ? maskPhone(channel.smsPhone) : null,
      smsVerified: channel.smsVerified,
      discordWebhookUrl: channel.discordWebhookUrl ? '***configured***' : null,
      discordVerified: channel.discordVerified,
      enabledTypes: channel.enabledTypes,
      isActive: channel.isActive,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
    }));

    return reply.send({ success: true, data: sanitizedChannels });
  });

  // --------------------------------------------------------------------------
  // GET /types - Get available notification types
  // --------------------------------------------------------------------------
  app.get('/types', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Group notification types by category
    const categorizedTypes = {
      alerts: [
        { type: 'budget_alert', label: 'Alerte budget depasse', description: 'Quand un budget est depasse' },
        { type: 'budget_warning', label: 'Avertissement budget', description: 'Quand un budget approche de sa limite' },
        { type: 'low_balance_warning', label: 'Solde bas', description: 'Quand un compte passe sous un seuil' },
        { type: 'unusual_spending', label: 'Depense inhabituelle', description: 'Quand une depense anormale est detectee' },
        { type: 'price_alert', label: 'Alerte prix', description: 'Quand un actif atteint un prix cible' },
      ],
      reminders: [
        { type: 'bill_reminder', label: 'Rappel de facture', description: 'Rappel avant echeance' },
        { type: 'bill_upcoming', label: 'Factures a venir', description: 'Factures dues dans les 7 prochains jours' },
        { type: 'invoice_overdue', label: 'Facture en retard', description: 'Facture client non payee' },
        { type: 'quote_expiring', label: 'Devis expirant', description: 'Devis bientot expire' },
      ],
      reports: [
        { type: 'weekly_summary', label: 'Resume hebdomadaire', description: 'Synthese de la semaine' },
        { type: 'monthly_report', label: 'Rapport mensuel', description: 'Rapport complet du mois' },
      ],
      savings: [
        { type: 'savings_milestone', label: 'Objectif atteint', description: 'Quand un palier est atteint (25%, 50%, 75%, 100%)' },
        { type: 'savings_off_track', label: 'Objectif en retard', description: 'Quand vous etes en retard sur un objectif' },
        { type: 'goal_achieved', label: 'Objectif complete', description: "Quand un objectif d'epargne est atteint" },
      ],
      activity: [
        { type: 'import_complete', label: 'Import termine', description: 'Quand un import est termine' },
        { type: 'export_ready', label: 'Export pret', description: 'Quand un export est disponible' },
        { type: 'invoice_paid', label: 'Facture payee', description: 'Quand une facture est marquee payee' },
        { type: 'quote_accepted', label: 'Devis accepte', description: 'Quand un devis est accepte' },
        { type: 'recurring_processed', label: 'Recurrence traitee', description: 'Quand une transaction recurrente est creee' },
      ],
      system: [
        { type: 'system', label: 'Systeme', description: 'Notifications systeme importantes' },
      ],
    };

    return reply.send({ success: true, data: categorizedTypes });
  });

  // --------------------------------------------------------------------------
  // GET /:channelId - Get specific channel
  // --------------------------------------------------------------------------
  app.get<{ Params: ChannelParams }>(
    '/:channelId',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { channelId } = request.params;

      const channel = await notificationChannelService.getChannel(channelId, userId);

      if (!channel) {
        return reply.status(404).send({ success: false, error: { message: 'Channel not found' } });
      }

      return reply.send({
        success: true,
        data: {
          id: channel.id,
          channelType: channel.channelType,
          email: channel.email,
          emailVerified: channel.emailVerified,
          whatsappPhone: channel.whatsappPhone ? maskPhone(channel.whatsappPhone) : null,
          whatsappVerified: channel.whatsappVerified,
          smsPhone: channel.smsPhone ? maskPhone(channel.smsPhone) : null,
          smsVerified: channel.smsVerified,
          discordWebhookUrl: channel.discordWebhookUrl ? '***configured***' : null,
          discordVerified: channel.discordVerified,
          enabledTypes: channel.enabledTypes,
          isActive: channel.isActive,
          createdAt: channel.createdAt,
          updatedAt: channel.updatedAt,
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST / - Add channel
  // --------------------------------------------------------------------------
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.sub;
    const body = createChannelSchema.parse(request.body);

    // Validate Discord webhook URL if provided
    if (body.channelType === 'discord' && body.discordWebhookUrl) {
      const isValid = await discordService.validateWebhookUrl(body.discordWebhookUrl);
      if (!isValid) {
        return reply.status(400).send({ success: false, error: { message: 'Invalid Discord webhook URL' } });
      }
    }

    // Validate WhatsApp phone if provided
    if (body.channelType === 'whatsapp' && body.whatsappPhone) {
      if (!whatsappService.isValidPhoneNumber(body.whatsappPhone)) {
        return reply.status(400).send({ success: false, error: { message: 'Invalid phone number format' } });
      }
    }

    // Validate SMS phone if provided
    if (body.channelType === 'sms' && body.smsPhone) {
      if (!smsService.isValidPhoneNumber(body.smsPhone)) {
        return reply.status(400).send({ success: false, error: { message: 'Invalid phone number format' } });
      }
    }

    try {
      const channel = await notificationChannelService.addChannel({
        userId,
        channelType: body.channelType as ChannelType,
        email: body.email,
        whatsappPhone: body.whatsappPhone,
        smsPhone: body.smsPhone,
        discordWebhookUrl: body.discordWebhookUrl,
        enabledTypes: body.enabledTypes,
      });

      logger.info({ userId, channelType: body.channelType }, 'Notification channel added');

      return reply.status(201).send({
        success: true,
        data: {
          id: channel.id,
          channelType: channel.channelType,
          isActive: channel.isActive,
          message: 'Channel created. Please verify to activate.',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create channel';
      return reply.status(400).send({ success: false, error: { message } });
    }
  });

  // --------------------------------------------------------------------------
  // PATCH /:channelId - Update channel
  // --------------------------------------------------------------------------
  app.patch<{ Params: ChannelParams }>(
    '/:channelId',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { channelId } = request.params;
      const body = updateChannelSchema.parse(request.body);

      // Validate Discord webhook URL if provided
      if (body.discordWebhookUrl) {
        const isValid = await discordService.validateWebhookUrl(body.discordWebhookUrl);
        if (!isValid) {
          return reply.status(400).send({ success: false, error: { message: 'Invalid Discord webhook URL' } });
        }
      }

      // Validate WhatsApp phone if provided
      if (body.whatsappPhone) {
        if (!whatsappService.isValidPhoneNumber(body.whatsappPhone)) {
          return reply.status(400).send({ success: false, error: { message: 'Invalid phone number format' } });
        }
      }

      // Validate SMS phone if provided
      if (body.smsPhone) {
        if (!smsService.isValidPhoneNumber(body.smsPhone)) {
          return reply.status(400).send({ success: false, error: { message: 'Invalid phone number format' } });
        }
      }

      try {
        const channel = await notificationChannelService.updateChannel(channelId, userId, body);

        return reply.send({
          success: true,
          data: {
            id: channel.id,
            channelType: channel.channelType,
            isActive: channel.isActive,
            emailVerified: channel.emailVerified,
            whatsappVerified: channel.whatsappVerified,
            smsVerified: channel.smsVerified,
            discordVerified: channel.discordVerified,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update channel';
        return reply.status(400).send({ success: false, error: { message } });
      }
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /:channelId - Delete channel
  // --------------------------------------------------------------------------
  app.delete<{ Params: ChannelParams }>(
    '/:channelId',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { channelId } = request.params;

      try {
        await notificationChannelService.removeChannel(channelId, userId);
        return reply.status(204).send();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete channel';
        return reply.status(400).send({ success: false, error: { message } });
      }
    }
  );

  // --------------------------------------------------------------------------
  // POST /:channelId/send-verification - Send verification code
  // --------------------------------------------------------------------------
  app.post<{ Params: ChannelParams }>(
    '/:channelId/send-verification',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { channelId } = request.params;

      const channel = await notificationChannelService.getChannel(channelId, userId);
      if (!channel) {
        return reply.status(404).send({ success: false, error: { message: 'Channel not found' } });
      }

      // Generate verification code
      const code = await notificationChannelService.sendVerification(channelId, userId);

      // Determine target for verification
      let target: string;
      switch (channel.channelType) {
        case 'email':
          target = channel.email!;
          break;
        case 'whatsapp':
          target = channel.whatsappPhone!;
          break;
        case 'sms':
          target = channel.smsPhone!;
          break;
        case 'discord':
          target = channel.discordWebhookUrl!;
          break;
        default:
          return reply.status(400).send({ success: false, error: { message: 'Unknown channel type' } });
      }

      // Send verification code
      const result = await notificationDispatcherService.sendVerificationToChannel(
        channel.channelType as ChannelType,
        target,
        code
      );

      if (!result.success) {
        return reply.status(500).send({ success: false, error: { message: result.error ?? 'Failed to send verification code' } });
      }

      logger.info({ userId, channelType: channel.channelType }, 'Verification code sent');

      return reply.send({
        success: true,
        data: {
          message: 'Verification code sent',
          expiresIn: '15 minutes',
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // POST /:channelId/verify - Verify channel with code
  // --------------------------------------------------------------------------
  app.post<{ Params: ChannelParams }>(
    '/:channelId/verify',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { channelId } = request.params;
      const { code } = verifyChannelSchema.parse(request.body);

      const result = await notificationChannelService.verifyChannel(channelId, userId, code);

      if (!result.success) {
        return reply.status(400).send({ success: false, error: { message: result.error } });
      }

      logger.info({ userId, channelId }, 'Channel verified');

      return reply.send({ success: true, data: { message: 'Channel verified and activated' } });
    }
  );

  // --------------------------------------------------------------------------
  // GET /:channelId/preferences - Get channel preferences
  // --------------------------------------------------------------------------
  app.get<{ Params: ChannelParams }>(
    '/:channelId/preferences',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { channelId } = request.params;

      const channel = await notificationChannelService.getChannel(channelId, userId);
      if (!channel) {
        return reply.status(404).send({ success: false, error: { message: 'Channel not found' } });
      }

      return reply.send({
        success: true,
        data: {
          enabledTypes: channel.enabledTypes,
          availableTypes: NOTIFICATION_TYPES,
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // PUT /:channelId/preferences - Update channel preferences
  // --------------------------------------------------------------------------
  app.put<{ Params: ChannelParams }>(
    '/:channelId/preferences',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { channelId } = request.params;
      const { enabledTypes } = setPreferencesSchema.parse(request.body);

      try {
        const validTypes = await notificationChannelService.setEnabledTypes(channelId, userId, enabledTypes);

        return reply.send({
          success: true,
          data: {
            enabledTypes: validTypes,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update preferences';
        return reply.status(400).send({ success: false, error: { message } });
      }
    }
  );

  // --------------------------------------------------------------------------
  // POST /:channelId/test - Send test notification
  // --------------------------------------------------------------------------
  app.post<{ Params: ChannelParams }>(
    '/:channelId/test',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { channelId } = request.params;

      const channel = await notificationChannelService.getChannel(channelId, userId);
      if (!channel) {
        return reply.status(404).send({ success: false, error: { message: 'Channel not found' } });
      }

      if (!channel.isActive) {
        return reply.status(400).send({ success: false, error: { message: 'Channel must be verified and active to send test' } });
      }

      // Send test based on channel type
      let result: { success: boolean; error?: string };

      switch (channel.channelType) {
        case 'discord':
          result = await discordService.sendTestMessage(channel.discordWebhookUrl!);
          break;

        case 'whatsapp':
          result = await whatsappService.sendMessage(
            channel.whatsappPhone!,
            '🔔 *Test HubCompta*\n\nCeci est un message de test. Votre canal WhatsApp est correctement configure.'
          );
          break;

        case 'sms':
          result = await smsService.sendMessage(
            channel.smsPhone!,
            'HubCompta: Test reussi! Votre canal SMS est correctement configure.'
          );
          break;

        case 'email':
          result = await notificationDispatcherService.sendVerificationToChannel(
            'email',
            channel.email!,
            'TEST'
          );
          break;

        default:
          return reply.status(400).send({ success: false, error: { message: 'Unknown channel type' } });
      }

      if (!result.success) {
        return reply.status(500).send({ success: false, error: { message: result.error ?? 'Failed to send test message' } });
      }

      return reply.send({ success: true, data: { message: 'Test message sent' } });
    }
  );
}

export default notificationChannelRoutes;
