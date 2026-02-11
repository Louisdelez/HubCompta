// ============================================================================
// SETTINGS ROUTES - Finance Hub
// User and workspace settings management
// ============================================================================

import type { FastifyPluginAsync } from 'fastify';
import { settingsService, type UserPreferences, type WorkspaceSettings } from '@/modules/settings/index.js';
import { auditService, AUDIT_ACTIONS } from '@/modules/audit/audit.service.js';
import { authGuard } from '@/core/auth/authGuard.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface UserProfileUpdate {
  displayName?: string;
  country?: string;
  locale?: string;
  timezone?: string;
  theme?: string;
}

interface PreferencesUpdate {
  notifications?: {
    email?: {
      enabled?: boolean;
      budgetAlerts?: boolean;
      importComplete?: boolean;
      securityAlerts?: boolean;
      weeklyDigest?: boolean;
    };
    push?: {
      enabled?: boolean;
      budgetAlerts?: boolean;
      priceAlerts?: boolean;
      billReminders?: boolean;
    };
  };
  display?: {
    compactMode?: boolean;
    showBalance?: boolean;
    defaultCurrency?: string;
    dateFormat?: string;
    numberFormat?: string;
    startOfWeek?: number;
  };
  dashboard?: {
    defaultPeriod?: 'month' | 'quarter' | 'year';
    showNetWorth?: boolean;
    showBudgets?: boolean;
    showRecentTransactions?: boolean;
    showUpcomingBills?: boolean;
  };
  privacy?: {
    hideAmountsOnHover?: boolean;
    sessionTimeout?: number;
    lockOnInactivity?: boolean;
    inactivityTimeout?: number;
  };
}

interface WorkspaceSettingsUpdate {
  general?: {
    defaultAccountId?: string;
    defaultCategoryId?: string;
    fiscalYearStart?: number;
  };
  features?: {
    proMode?: boolean;
    investMode?: boolean;
    budgets?: boolean;
    tags?: boolean;
    rules?: boolean;
    documents?: boolean;
  };
  import?: {
    defaultDateFormat?: string;
    defaultDelimiter?: string;
    autoApplyRules?: boolean;
    duplicateDetection?: boolean;
  };
  pro?: {
    companyName?: string;
    companyAddress?: string;
    companySiret?: string;
    companyVat?: string;
    defaultPaymentTerms?: number;
    defaultQuoteValidity?: number;
    invoicePrefix?: string;
    quotePrefix?: string;
    logoUrl?: string;
    bankDetails?: string;
    legalNotice?: string;
  };
}

interface WorkspaceUpdate {
  name?: string;
  currency?: string;
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply auth guard to all routes
  fastify.addHook('preHandler', authGuard);

  // ==========================================================================
  // User Profile
  // ==========================================================================

  /**
   * Get current user profile
   */
  fastify.get('/profile', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifié' });
    }

    const profile = await settingsService.getUserProfile(userId);
    if (!profile) {
      return reply.status(404).send({ error: 'Utilisateur non trouvé' });
    }

    return { data: profile };
  });

  /**
   * Update current user profile
   */
  fastify.patch<{ Body: UserProfileUpdate }>('/profile', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifié' });
    }

    const { displayName, country, locale, timezone, theme } = request.body;

    const profile = await settingsService.updateUserProfile(userId, {
      displayName,
      country,
      locale,
      timezone,
      theme,
    });

    await auditService.log({
      userId,
      action: AUDIT_ACTIONS.USER_UPDATED,
      entityType: 'user',
      entityId: userId,
      changes: { displayName, country, locale, timezone, theme },
      ipAddress: request.ip,
    });

    return { data: profile };
  });

  // ==========================================================================
  // User Preferences
  // ==========================================================================

  /**
   * Get user preferences
   */
  fastify.get('/preferences', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifié' });
    }

    const preferences = await settingsService.getUserPreferences(userId);
    return { data: preferences };
  });

  /**
   * Update user preferences
   */
  fastify.patch<{ Body: PreferencesUpdate }>('/preferences', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifié' });
    }

    const preferences = await settingsService.updateUserPreferences(userId, request.body as unknown as Partial<UserPreferences>);

    await auditService.log({
      userId,
      action: AUDIT_ACTIONS.USER_UPDATED,
      entityType: 'user_preferences',
      entityId: userId,
      changes: request.body as unknown as Record<string, unknown>,
      ipAddress: request.ip,
    });

    return { data: preferences };
  });

  /**
   * Reset user preferences to defaults
   */
  fastify.post('/preferences/reset', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifié' });
    }

    const preferences = await settingsService.resetUserPreferences(userId);

    await auditService.log({
      userId,
      action: AUDIT_ACTIONS.USER_UPDATED,
      entityType: 'user_preferences',
      entityId: userId,
      changes: { action: 'reset_to_defaults' },
      ipAddress: request.ip,
    });

    return { data: preferences };
  });

  // ==========================================================================
  // Workspace Settings
  // ==========================================================================

  /**
   * Get workspace details
   */
  fastify.get<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId',
    async (request, reply) => {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Non authentifié' });
      }

      const { workspaceId } = request.params;
      const workspace = await settingsService.getWorkspaceDetails(workspaceId);

      if (!workspace) {
        return reply.status(404).send({ error: 'Workspace non trouvé' });
      }

      return { data: workspace };
    }
  );

  /**
   * Update workspace general info
   */
  fastify.patch<{ Params: { workspaceId: string }; Body: WorkspaceUpdate }>(
    '/workspaces/:workspaceId',
    async (request, reply) => {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Non authentifié' });
      }

      const { workspaceId } = request.params;
      const { name, currency } = request.body;

      const workspace = await settingsService.updateWorkspace(workspaceId, {
        name,
        currency,
      });

      await auditService.log({
        userId,
        workspaceId,
        action: AUDIT_ACTIONS.WORKSPACE_UPDATED,
        entityType: 'workspace',
        entityId: workspaceId,
        changes: { name, currency },
        ipAddress: request.ip,
      });

      return { data: workspace };
    }
  );

  /**
   * Get workspace settings
   */
  fastify.get<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/settings',
    async (request, reply) => {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Non authentifié' });
      }

      const { workspaceId } = request.params;
      const settings = await settingsService.getWorkspaceSettings(workspaceId);

      return { data: settings };
    }
  );

  /**
   * Update workspace settings
   */
  fastify.patch<{ Params: { workspaceId: string }; Body: WorkspaceSettingsUpdate }>(
    '/workspaces/:workspaceId/settings',
    async (request, reply) => {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Non authentifié' });
      }

      const { workspaceId } = request.params;
      const settings = await settingsService.updateWorkspaceSettings(workspaceId, request.body as unknown as Partial<WorkspaceSettings>);

      await auditService.log({
        userId,
        workspaceId,
        action: AUDIT_ACTIONS.WORKSPACE_UPDATED,
        entityType: 'workspace_settings',
        entityId: workspaceId,
        changes: request.body as unknown as Record<string, unknown>,
        ipAddress: request.ip,
      });

      return { data: settings };
    }
  );

  /**
   * Reset workspace settings to defaults
   */
  fastify.post<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/settings/reset',
    async (request, reply) => {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.status(401).send({ error: 'Non authentifié' });
      }

      const { workspaceId } = request.params;
      const settings = await settingsService.resetWorkspaceSettings(workspaceId);

      await auditService.log({
        userId,
        workspaceId,
        action: AUDIT_ACTIONS.WORKSPACE_UPDATED,
        entityType: 'workspace_settings',
        entityId: workspaceId,
        changes: { action: 'reset_to_defaults' },
        ipAddress: request.ip,
      });

      return { data: settings };
    }
  );

  // ==========================================================================
  // Data Management (GDPR)
  // ==========================================================================

  /**
   * Get user data summary
   */
  fastify.get('/data/summary', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifié' });
    }

    const summary = await settingsService.getUserDataSummary(userId);
    return { data: summary };
  });

  /**
   * Export all user data (GDPR)
   */
  fastify.get('/data/export', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifié' });
    }

    const data = await settingsService.exportUserData(userId);

    await auditService.log({
      userId,
      action: AUDIT_ACTIONS.EXPORT_REQUESTED,
      entityType: 'user_data',
      entityId: userId,
      changes: { type: 'full_export' },
      ipAddress: request.ip,
      severity: 'warning',
    });

    reply.header('Content-Type', 'application/json');
    reply.header(
      'Content-Disposition',
      `attachment; filename="hubcompta-export-${new Date().toISOString().split('T')[0]}.json"`
    );

    return data;
  });

  /**
   * Delete user account (GDPR)
   */
  fastify.delete('/data/account', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Non authentifié' });
    }

    // Log before deletion
    await auditService.log({
      userId,
      action: 'user.account.deleted',
      entityType: 'user',
      entityId: userId,
      ipAddress: request.ip,
      severity: 'critical',
    });

    await settingsService.deleteUserAccount(userId);

    return { success: true, message: 'Compte supprimé avec succès' };
  });
};

export default settingsRoutes;
