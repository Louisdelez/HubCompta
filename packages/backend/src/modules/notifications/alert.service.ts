// ============================================================================
// ALERT RULES SERVICE - Finance Hub
// Manage automated alert rules
// ============================================================================

import { prisma } from '@/core/database/client.js';
import type { AlertRuleType, Prisma } from '@prisma/client';
import { notificationService } from './notification.service.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface BudgetThresholdConfig {
  budgetId: string;
  thresholdPercent: number; // e.g., 80 for 80%
  notifyOnExceed: boolean;
}

export interface PriceAlertConfig {
  assetId: string;
  assetSymbol: string;
  targetPrice: number;
  direction: 'above' | 'below';
}

export interface PriceChangeConfig {
  assetId: string;
  assetSymbol: string;
  changePercent: number; // e.g., 5 for 5%
  period: 'day' | 'week';
}

export interface LowBalanceConfig {
  accountId: string;
  threshold: number;
}

export interface LargeTransactionConfig {
  threshold: number;
  type: 'income' | 'expense' | 'both';
}

export interface RecurringReminderConfig {
  recurrenceId: string;
  daysBefore: number;
}

export type AlertConfig =
  | BudgetThresholdConfig
  | PriceAlertConfig
  | PriceChangeConfig
  | LowBalanceConfig
  | LargeTransactionConfig
  | RecurringReminderConfig;

export interface CreateAlertRuleInput {
  userId: string;
  workspaceId?: string;
  type: AlertRuleType;
  name: string;
  config: AlertConfig;
}

// ----------------------------------------------------------------------------
// Alert Rules Service
// ----------------------------------------------------------------------------

export const alertService = {
  // --------------------------------------------------------------------------
  // CRUD Operations
  // --------------------------------------------------------------------------

  create(input: CreateAlertRuleInput) {
    return prisma.alertRule.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        type: input.type,
        name: input.name,
        config: input.config as unknown as Prisma.JsonObject,
      },
    });
  },

  update(
    ruleId: string,
    userId: string,
    data: { name?: string; isEnabled?: boolean; config?: AlertConfig }
  ) {
    return prisma.alertRule.updateMany({
      where: { id: ruleId, userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
        ...(data.config && { config: data.config as unknown as Prisma.JsonObject }),
      },
    });
  },

  delete(ruleId: string, userId: string) {
    return prisma.alertRule.deleteMany({
      where: { id: ruleId, userId },
    });
  },

  getById(ruleId: string, userId: string) {
    return prisma.alertRule.findFirst({
      where: { id: ruleId, userId },
    });
  },

  listForUser(userId: string, workspaceId?: string) {
    return prisma.alertRule.findMany({
      where: {
        userId,
        ...(workspaceId && { workspaceId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  listByType(type: AlertRuleType, isEnabled: boolean = true) {
    return prisma.alertRule.findMany({
      where: { type, isEnabled },
    });
  },

  // --------------------------------------------------------------------------
  // Alert Evaluation
  // --------------------------------------------------------------------------

  /**
   * Check budget thresholds and create notifications
   */
  async evaluateBudgetAlerts(workspaceId: string) {
    const rules = await prisma.alertRule.findMany({
      where: {
        workspaceId,
        type: 'budget_threshold',
        isEnabled: true,
      },
    });

    for (const rule of rules) {
      const config = rule.config as unknown as BudgetThresholdConfig;

      // Get budget with spending
      const budget = await prisma.budget.findUnique({
        where: { id: config.budgetId },
        include: { category: true },
      });

      if (!budget) continue;

      // Calculate current spending
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      if (budget.period === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
      }

      const spending = await prisma.transaction.aggregate({
        where: {
          categoryId: budget.categoryId,
          date: { gte: startDate, lte: endDate },
          amount: { lt: 0 },
        },
        _sum: { amount: true },
      });

      const totalSpent = Math.abs(Number(spending._sum.amount) || 0);
      const percentUsed = (totalSpent / Number(budget.amount)) * 100;

      // Check if threshold is reached
      const isExceeded = percentUsed >= 100;
      const isWarning = percentUsed >= config.thresholdPercent && percentUsed < 100;

      const budgetInfo = {
        id: budget.id,
        name: budget.name || budget.category.name,
        categoryName: budget.category.name,
        amount: Number(budget.amount),
        spent: totalSpent,
      };

      if (isExceeded && config.notifyOnExceed) {
        await notificationService.notifyBudgetAlert(
          rule.userId,
          workspaceId,
          budgetInfo,
          percentUsed,
          true
        );

        // Update last triggered
        await prisma.alertRule.update({
          where: { id: rule.id },
          data: { lastTriggeredAt: new Date() },
        });
      } else if (isWarning) {
        // Only notify once per day for warnings
        const lastTriggered = rule.lastTriggeredAt;
        const alertNow = new Date();
        if (!lastTriggered || alertNow.getTime() - lastTriggered.getTime() > 24 * 60 * 60 * 1000) {
          await notificationService.notifyBudgetAlert(
            rule.userId,
            workspaceId,
            budgetInfo,
            percentUsed,
            false
          );

          await prisma.alertRule.update({
            where: { id: rule.id },
            data: { lastTriggeredAt: new Date() },
          });
        }
      }
    }
  },

  /**
   * Check price alerts for assets
   */
  async evaluatePriceAlerts() {
    const rules = await prisma.alertRule.findMany({
      where: {
        type: { in: ['price_above', 'price_below'] },
        isEnabled: true,
      },
    });

    for (const rule of rules) {
      const config = rule.config as unknown as PriceAlertConfig;

      const asset = await prisma.asset.findUnique({
        where: { id: config.assetId },
      });

      if (!asset || !asset.lastPrice) continue;

      const currentPrice = Number(asset.lastPrice);
      let shouldTrigger = false;

      if (rule.type === 'price_above' && currentPrice >= config.targetPrice) {
        shouldTrigger = true;
      } else if (rule.type === 'price_below' && currentPrice <= config.targetPrice) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        await notificationService.notifyPriceAlert(
          rule.userId,
          rule.workspaceId || '',
          {
            assetSymbol: config.assetSymbol,
            assetName: asset.name,
            currentPrice,
            targetPrice: config.targetPrice,
            direction: rule.type === 'price_above' ? 'above' : 'below',
          }
        );

        // Disable the rule after triggering (one-time alert)
        await prisma.alertRule.update({
          where: { id: rule.id },
          data: { isEnabled: false, lastTriggeredAt: new Date() },
        });
      }
    }
  },

  /**
   * Check low balance alerts
   */
  async evaluateLowBalanceAlerts() {
    const rules = await prisma.alertRule.findMany({
      where: {
        type: 'low_balance',
        isEnabled: true,
      },
    });

    for (const rule of rules) {
      const config = rule.config as unknown as LowBalanceConfig;

      const account = await prisma.account.findUnique({
        where: { id: config.accountId },
        include: { workspace: true },
      });

      if (!account) continue;

      const accountBalance = Number(account.balance);
      if (accountBalance < config.threshold) {
        // Only notify once per day
        const lastTriggered = rule.lastTriggeredAt;
        const now = new Date();
        if (!lastTriggered || now.getTime() - lastTriggered.getTime() > 24 * 60 * 60 * 1000) {
          await notificationService.create({
            userId: rule.userId,
            workspaceId: rule.workspaceId || undefined,
            type: 'budget_warning',
            title: `Solde bas: ${account.name}`,
            message: `Le solde de "${account.name}" (${accountBalance.toFixed(2)} €) est inférieur à ${config.threshold.toFixed(2)} €.`,
            data: { accountId: account.id },
          });

          await prisma.alertRule.update({
            where: { id: rule.id },
            data: { lastTriggeredAt: new Date() },
          });
        }
      }
    }
  },

  /**
   * Check for upcoming recurring transactions
   */
  async evaluateRecurringReminders() {
    const rules = await prisma.alertRule.findMany({
      where: {
        type: 'recurring_reminder',
        isEnabled: true,
      },
    });

    for (const rule of rules) {
      const config = rule.config as unknown as RecurringReminderConfig;

      const recurrence = await prisma.recurrence.findUnique({
        where: { id: config.recurrenceId },
      });

      if (!recurrence || !recurrence.nextRunAt) continue;

      const now = new Date();
      const daysUntil = Math.ceil(
        (recurrence.nextRunAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      const template = recurrence.template as Record<string, unknown> | null;
      const templateAmount = template?.amount as number | undefined;
      const templateDescription = template?.description as string | undefined;

      if (daysUntil <= config.daysBefore && daysUntil >= 0) {
        // Only notify once per occurrence
        const lastTriggered = rule.lastTriggeredAt;
        if (!lastTriggered || lastTriggered < recurrence.nextRunAt) {
          await notificationService.notifyBillReminder(
            rule.userId,
            rule.workspaceId || '',
            {
              description: templateDescription || recurrence.name || 'Transaction récurrente',
              amount: Math.abs(templateAmount || 0),
              dueDate: recurrence.nextRunAt,
              daysUntil,
            }
          );

          await prisma.alertRule.update({
            where: { id: rule.id },
            data: { lastTriggeredAt: new Date() },
          });
        }
      }
    }
  },

  // --------------------------------------------------------------------------
  // Convenience Methods for Creating Common Alerts
  // --------------------------------------------------------------------------

  async createBudgetAlert(
    userId: string,
    workspaceId: string,
    budgetId: string,
    thresholdPercent: number = 80
  ) {
    const budget = await prisma.budget.findUnique({
      where: { id: budgetId },
      include: { category: true },
    });

    if (!budget) throw new Error('Budget not found');

    return this.create({
      userId,
      workspaceId,
      type: 'budget_threshold',
      name: `Alerte budget: ${budget.category.name}`,
      config: {
        budgetId,
        thresholdPercent,
        notifyOnExceed: true,
      } as BudgetThresholdConfig,
    });
  },

  async createPriceAlert(
    userId: string,
    workspaceId: string,
    assetId: string,
    targetPrice: number,
    direction: 'above' | 'below'
  ) {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) throw new Error('Asset not found');

    return this.create({
      userId,
      workspaceId,
      type: direction === 'above' ? 'price_above' : 'price_below',
      name: `Alerte prix ${asset.symbol} ${direction === 'above' ? '>' : '<'} ${targetPrice}`,
      config: {
        assetId,
        assetSymbol: asset.symbol,
        targetPrice,
        direction,
      } as PriceAlertConfig,
    });
  },

  async createLowBalanceAlert(
    userId: string,
    workspaceId: string,
    accountId: string,
    threshold: number
  ) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) throw new Error('Account not found');

    return this.create({
      userId,
      workspaceId,
      type: 'low_balance',
      name: `Alerte solde bas: ${account.name}`,
      config: {
        accountId,
        threshold,
      } as LowBalanceConfig,
    });
  },
};

export default alertService;
