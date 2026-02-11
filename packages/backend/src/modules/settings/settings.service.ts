// ============================================================================
// SETTINGS SERVICE - Finance Hub
// User and workspace settings management
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { Prisma } from '@prisma/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface UserPreferences {
  // Notification preferences
  notifications: {
    email: {
      enabled: boolean;
      budgetAlerts: boolean;
      importComplete: boolean;
      securityAlerts: boolean;
      weeklyDigest: boolean;
    };
    push: {
      enabled: boolean;
      budgetAlerts: boolean;
      priceAlerts: boolean;
      billReminders: boolean;
    };
  };
  // Display preferences
  display: {
    compactMode: boolean;
    showBalance: boolean;
    defaultCurrency: string;
    dateFormat: string; // 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'
    numberFormat: string; // 'fr-FR', 'en-US'
    startOfWeek: number; // 0 = Sunday, 1 = Monday
  };
  // Dashboard preferences
  dashboard: {
    defaultPeriod: 'month' | 'quarter' | 'year';
    showNetWorth: boolean;
    showBudgets: boolean;
    showRecentTransactions: boolean;
    showUpcomingBills: boolean;
  };
  // Privacy preferences
  privacy: {
    hideAmountsOnHover: boolean;
    sessionTimeout: number; // minutes
    lockOnInactivity: boolean;
    inactivityTimeout: number; // minutes
  };
}

export interface WorkspaceSettings {
  // General settings
  general: {
    defaultAccountId?: string;
    defaultCategoryId?: string;
    fiscalYearStart: number; // 1-12
  };
  // Feature toggles
  features: {
    proMode: boolean;
    investMode: boolean;
    budgets: boolean;
    tags: boolean;
    rules: boolean;
    documents: boolean;
  };
  // Import settings
  import: {
    defaultDateFormat: string;
    defaultDelimiter: string;
    autoApplyRules: boolean;
    duplicateDetection: boolean;
  };
  // Pro mode settings
  pro: {
    companyName?: string;
    companyAddress?: string;
    companySiret?: string;
    companyVat?: string;
    defaultPaymentTerms: number; // days
    defaultQuoteValidity: number; // days
    invoicePrefix: string;
    quotePrefix: string;
    logoUrl?: string;
    bankDetails?: string;
    legalNotice?: string;
  };
}

// Default preferences
const DEFAULT_USER_PREFERENCES: UserPreferences = {
  notifications: {
    email: {
      enabled: true,
      budgetAlerts: true,
      importComplete: true,
      securityAlerts: true,
      weeklyDigest: false,
    },
    push: {
      enabled: true,
      budgetAlerts: true,
      priceAlerts: true,
      billReminders: true,
    },
  },
  display: {
    compactMode: false,
    showBalance: true,
    defaultCurrency: 'EUR',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'fr-FR',
    startOfWeek: 1,
  },
  dashboard: {
    defaultPeriod: 'month',
    showNetWorth: true,
    showBudgets: true,
    showRecentTransactions: true,
    showUpcomingBills: true,
  },
  privacy: {
    hideAmountsOnHover: false,
    sessionTimeout: 60,
    lockOnInactivity: true,
    inactivityTimeout: 5,
  },
};

const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  general: {
    fiscalYearStart: 1,
  },
  features: {
    proMode: false,
    investMode: false,
    budgets: true,
    tags: true,
    rules: true,
    documents: true,
  },
  import: {
    defaultDateFormat: 'DD/MM/YYYY',
    defaultDelimiter: ';',
    autoApplyRules: true,
    duplicateDetection: true,
  },
  pro: {
    defaultPaymentTerms: 30,
    defaultQuoteValidity: 30,
    invoicePrefix: 'FAC',
    quotePrefix: 'DEV',
  },
};

// ----------------------------------------------------------------------------
// Settings Service
// ----------------------------------------------------------------------------

export const settingsService = {
  // ==========================================================================
  // User Settings
  // ==========================================================================

  /**
   * Get user preferences with defaults
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const stored = (user?.preferences ?? {}) as Partial<UserPreferences>;
    return this.mergePreferences(stored, DEFAULT_USER_PREFERENCES);
  },

  /**
   * Update user preferences (partial update)
   */
  async updateUserPreferences(
    userId: string,
    updates: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    const current = await this.getUserPreferences(userId);
    const merged = this.mergePreferences(updates, current);

    await prisma.user.update({
      where: { id: userId },
      data: { preferences: merged as unknown as Prisma.JsonObject },
    });

    return merged;
  },

  /**
   * Get user profile settings
   */
  async getUserProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        country: true,
        locale: true,
        timezone: true,
        theme: true,
        createdAt: true,
      },
    });

    return user;
  },

  /**
   * Update user profile
   */
  updateUserProfile(
    userId: string,
    data: {
      displayName?: string;
      country?: string;
      locale?: string;
      timezone?: string;
      theme?: string;
    }
  ) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        displayName: true,
        country: true,
        locale: true,
        timezone: true,
        theme: true,
      },
    });
  },

  /**
   * Reset user preferences to defaults
   */
  async resetUserPreferences(userId: string): Promise<UserPreferences> {
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: DEFAULT_USER_PREFERENCES as unknown as Prisma.JsonObject },
    });

    return DEFAULT_USER_PREFERENCES;
  },

  // ==========================================================================
  // Workspace Settings
  // ==========================================================================

  /**
   * Get workspace settings with defaults
   */
  async getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const stored = (workspace?.settings ?? {}) as Partial<WorkspaceSettings>;
    return this.mergeWorkspaceSettings(stored, DEFAULT_WORKSPACE_SETTINGS);
  },

  /**
   * Update workspace settings (partial update)
   */
  async updateWorkspaceSettings(
    workspaceId: string,
    updates: Partial<WorkspaceSettings>
  ): Promise<WorkspaceSettings> {
    const current = await this.getWorkspaceSettings(workspaceId);
    const merged = this.mergeWorkspaceSettings(updates, current);

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { settings: merged as unknown as Prisma.JsonObject },
    });

    return merged;
  },

  /**
   * Get workspace details for settings page
   */
  getWorkspaceDetails(workspaceId: string) {
    return prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        type: true,
        currency: true,
        settings: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        _count: {
          select: {
            accounts: true,
            transactions: true,
            categories: true,
            memberships: true,
          },
        },
      },
    });
  },

  /**
   * Update workspace general info
   */
  updateWorkspace(
    workspaceId: string,
    data: {
      name?: string;
      currency?: string;
    }
  ) {
    return prisma.workspace.update({
      where: { id: workspaceId },
      data,
    });
  },

  /**
   * Reset workspace settings to defaults
   */
  async resetWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings> {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { settings: DEFAULT_WORKSPACE_SETTINGS as unknown as Prisma.JsonObject },
    });

    return DEFAULT_WORKSPACE_SETTINGS;
  },

  // ==========================================================================
  // Data Management
  // ==========================================================================

  /**
   * Get user data summary for export
   */
  async getUserDataSummary(userId: string) {
    const [
      user,
      workspaces,
      devices,
      sessions,
      mfaMethods,
      alertRules,
      notifications,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          displayName: true,
          locale: true,
          timezone: true,
          createdAt: true,
        },
      }),
      prisma.workspace.count({ where: { ownerId: userId } }),
      prisma.device.count({ where: { userId } }),
      prisma.session.count({ where: { userId } }),
      prisma.mFA.count({ where: { userId } }),
      prisma.alertRule.count({ where: { userId } }),
      prisma.notification.count({ where: { userId } }),
    ]);

    return {
      user,
      counts: {
        workspaces,
        devices,
        sessions,
        mfaMethods,
        alertRules,
        notifications,
      },
    };
  },

  /**
   * Export all user data (GDPR compliance)
   */
  async exportUserData(userId: string) {
    const [user, workspaces, devices, alertRules, notifications] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          displayName: true,
          locale: true,
          timezone: true,
          theme: true,
          preferences: true,
          createdAt: true,
        },
      }),
      prisma.workspace.findMany({
        where: { ownerId: userId },
        include: {
          accounts: {
            include: {
              transactions: true,
            },
          },
          categories: true,
          budgets: true,
          contacts: true,
          quotes: true,
          invoices: true,
        },
      }),
      prisma.device.findMany({
        where: { userId },
        select: {
          name: true,
          fingerprint: true,
          isTrusted: true,
          lastUsedAt: true,
          createdAt: true,
        },
      }),
      prisma.alertRule.findMany({
        where: { userId },
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      user,
      workspaces,
      devices,
      alertRules,
      notifications,
    };
  },

  /**
   * Delete user account and all associated data
   */
  async deleteUserAccount(userId: string) {
    // This will cascade delete due to relations
    // But we need to handle some things manually

    // First, delete workspaces owned by user (cascades to transactions, etc.)
    await prisma.workspace.deleteMany({
      where: { ownerId: userId },
    });

    // Remove user from workspaces they're members of
    await prisma.membership.deleteMany({
      where: { userId },
    });

    // Delete user (cascades to devices, sessions, MFA, notifications, alerts)
    await prisma.user.delete({
      where: { id: userId },
    });

    return { deleted: true };
  },

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Merge user preferences with defaults
   */
  mergePreferences(stored: Partial<UserPreferences>, defaults: UserPreferences): UserPreferences {
    return {
      notifications: {
        email: { ...defaults.notifications.email, ...stored.notifications?.email },
        push: { ...defaults.notifications.push, ...stored.notifications?.push },
      },
      display: { ...defaults.display, ...stored.display },
      dashboard: { ...defaults.dashboard, ...stored.dashboard },
      privacy: { ...defaults.privacy, ...stored.privacy },
    };
  },

  /**
   * Merge workspace settings with defaults
   */
  mergeWorkspaceSettings(stored: Partial<WorkspaceSettings>, defaults: WorkspaceSettings): WorkspaceSettings {
    return {
      general: { ...defaults.general, ...stored.general },
      features: { ...defaults.features, ...stored.features },
      import: { ...defaults.import, ...stored.import },
      pro: { ...defaults.pro, ...stored.pro },
    };
  },
};

export default settingsService;
