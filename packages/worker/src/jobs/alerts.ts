// ============================================================================
// ALERTS JOB - Finance Hub Worker
// Evaluate alert rules and create notifications
// ============================================================================

import { prisma } from '../lib/prisma.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface AlertsJobData {
  workspaceId?: string; // If provided, only evaluate alerts for this workspace
  alertTypes?: string[]; // If provided, only evaluate these alert types
}

export interface AlertsJobResult {
  budgetAlerts: number;
  priceAlerts: number;
  balanceAlerts: number;
  recurringReminders: number;
  duration: number;
}

// ----------------------------------------------------------------------------
// Alert Evaluation Functions
// ----------------------------------------------------------------------------

async function evaluateBudgetAlerts(workspaceId?: string): Promise<number> {
  let triggered = 0;

  const rules = await prisma.alertRule.findMany({
    where: {
      type: 'budget_threshold',
      isEnabled: true,
      ...(workspaceId && { workspaceId }),
    },
  });

  for (const rule of rules) {
    try {
      const config = rule.config as { budgetId: string; thresholdPercent: number; notifyOnExceed: boolean };

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

      const totalSpent = Math.abs(spending._sum.amount || 0);
      const percentUsed = (totalSpent / budget.amount) * 100;

      const isExceeded = percentUsed >= 100;
      const isWarning = percentUsed >= config.thresholdPercent && percentUsed < 100;

      // Check if we should notify
      const lastTriggered = rule.lastTriggeredAt;
      const now_ts = new Date();
      const shouldNotify =
        !lastTriggered || now_ts.getTime() - lastTriggered.getTime() > 24 * 60 * 60 * 1000;

      if ((isExceeded && config.notifyOnExceed) || isWarning) {
        if (shouldNotify) {
          await prisma.notification.create({
            data: {
              userId: rule.userId,
              workspaceId: rule.workspaceId,
              type: isExceeded ? 'budget_alert' : 'budget_warning',
              title: isExceeded
                ? `Budget "${budget.name || budget.category.name}" dépassé`
                : `Budget "${budget.name || budget.category.name}" bientôt atteint`,
              message: isExceeded
                ? `Le budget pour "${budget.category.name}" a été dépassé (${percentUsed.toFixed(0)}% utilisé).`
                : `Le budget pour "${budget.category.name}" est à ${percentUsed.toFixed(0)}% de sa limite.`,
              data: {
                budgetId: budget.id,
                categoryName: budget.category.name,
                percentUsed,
              },
            },
          });

          await prisma.alertRule.update({
            where: { id: rule.id },
            data: { lastTriggeredAt: new Date() },
          });

          triggered++;
        }
      }
    } catch (error) {
      console.error(`Error evaluating budget alert ${rule.id}:`, error);
    }
  }

  return triggered;
}

async function evaluatePriceAlerts(): Promise<number> {
  let triggered = 0;

  const rules = await prisma.alertRule.findMany({
    where: {
      type: { in: ['price_above', 'price_below'] },
      isEnabled: true,
    },
  });

  for (const rule of rules) {
    try {
      const config = rule.config as { assetId: string; assetSymbol: string; targetPrice: number; direction: string };

      const asset = await prisma.asset.findUnique({
        where: { id: config.assetId },
      });

      if (!asset || !asset.lastPrice) continue;

      const currentPrice = asset.lastPrice;
      let shouldTrigger = false;

      if (rule.type === 'price_above' && currentPrice >= config.targetPrice) {
        shouldTrigger = true;
      } else if (rule.type === 'price_below' && currentPrice <= config.targetPrice) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        const direction = rule.type === 'price_above' ? 'au-dessus de' : 'en-dessous de';

        await prisma.notification.create({
          data: {
            userId: rule.userId,
            workspaceId: rule.workspaceId,
            type: 'price_alert',
            title: `Alerte prix: ${config.assetSymbol}`,
            message: `${asset.name} est passé ${direction} ${config.targetPrice.toFixed(2)} € (actuellement ${currentPrice.toFixed(2)} €).`,
            data: {
              assetId: config.assetId,
              assetSymbol: config.assetSymbol,
              currentPrice,
              targetPrice: config.targetPrice,
            },
          },
        });

        // Disable the rule after triggering (one-time alert)
        await prisma.alertRule.update({
          where: { id: rule.id },
          data: { isEnabled: false, lastTriggeredAt: new Date() },
        });

        triggered++;
      }
    } catch (error) {
      console.error(`Error evaluating price alert ${rule.id}:`, error);
    }
  }

  return triggered;
}

async function evaluateLowBalanceAlerts(): Promise<number> {
  let triggered = 0;

  const rules = await prisma.alertRule.findMany({
    where: {
      type: 'low_balance',
      isEnabled: true,
    },
  });

  for (const rule of rules) {
    try {
      const config = rule.config as { accountId: string; threshold: number };

      const account = await prisma.account.findUnique({
        where: { id: config.accountId },
      });

      if (!account) continue;

      if (account.balance < config.threshold) {
        // Only notify once per day
        const lastTriggered = rule.lastTriggeredAt;
        const now = new Date();
        if (!lastTriggered || now.getTime() - lastTriggered.getTime() > 24 * 60 * 60 * 1000) {
          await prisma.notification.create({
            data: {
              userId: rule.userId,
              workspaceId: rule.workspaceId,
              type: 'budget_warning',
              title: `Solde bas: ${account.name}`,
              message: `Le solde de "${account.name}" (${account.balance.toFixed(2)} €) est inférieur à ${config.threshold.toFixed(2)} €.`,
              data: { accountId: account.id, currentBalance: account.balance },
            },
          });

          await prisma.alertRule.update({
            where: { id: rule.id },
            data: { lastTriggeredAt: new Date() },
          });

          triggered++;
        }
      }
    } catch (error) {
      console.error(`Error evaluating low balance alert ${rule.id}:`, error);
    }
  }

  return triggered;
}

async function evaluateRecurringReminders(): Promise<number> {
  let triggered = 0;

  const rules = await prisma.alertRule.findMany({
    where: {
      type: 'recurring_reminder',
      isEnabled: true,
    },
  });

  for (const rule of rules) {
    try {
      const config = rule.config as { recurrenceId: string; daysBefore: number };

      const recurrence = await prisma.recurrence.findUnique({
        where: { id: config.recurrenceId },
      });

      if (!recurrence || !recurrence.nextOccurrence) continue;

      const now = new Date();
      const daysUntil = Math.ceil(
        (recurrence.nextOccurrence.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      if (daysUntil <= config.daysBefore && daysUntil >= 0) {
        // Only notify once per occurrence
        const lastTriggered = rule.lastTriggeredAt;
        if (!lastTriggered || lastTriggered < recurrence.nextOccurrence) {
          await prisma.notification.create({
            data: {
              userId: rule.userId,
              workspaceId: rule.workspaceId,
              type: 'bill_reminder',
              title: 'Rappel de paiement',
              message: `"${recurrence.description || 'Transaction récurrente'}" (${Math.abs(recurrence.amount).toFixed(2)} €) est dû dans ${daysUntil} jour(s).`,
              data: {
                recurrenceId: recurrence.id,
                amount: Math.abs(recurrence.amount),
                dueDate: recurrence.nextOccurrence.toISOString(),
                daysUntil,
              },
            },
          });

          await prisma.alertRule.update({
            where: { id: rule.id },
            data: { lastTriggeredAt: new Date() },
          });

          triggered++;
        }
      }
    } catch (error) {
      console.error(`Error evaluating recurring reminder ${rule.id}:`, error);
    }
  }

  return triggered;
}

// ----------------------------------------------------------------------------
// Main Job Handler
// ----------------------------------------------------------------------------

export async function handleAlertsJob(data: AlertsJobData): Promise<AlertsJobResult> {
  const startTime = Date.now();
  const { alertTypes } = data;

  console.log('Starting alerts evaluation...');

  let budgetAlerts = 0;
  let priceAlerts = 0;
  let balanceAlerts = 0;
  let recurringReminders = 0;

  // Evaluate each type of alert
  if (!alertTypes || alertTypes.includes('budget_threshold')) {
    budgetAlerts = await evaluateBudgetAlerts(data.workspaceId);
    console.log(`  Budget alerts triggered: ${budgetAlerts}`);
  }

  if (!alertTypes || alertTypes.includes('price_above') || alertTypes.includes('price_below')) {
    priceAlerts = await evaluatePriceAlerts();
    console.log(`  Price alerts triggered: ${priceAlerts}`);
  }

  if (!alertTypes || alertTypes.includes('low_balance')) {
    balanceAlerts = await evaluateLowBalanceAlerts();
    console.log(`  Low balance alerts triggered: ${balanceAlerts}`);
  }

  if (!alertTypes || alertTypes.includes('recurring_reminder')) {
    recurringReminders = await evaluateRecurringReminders();
    console.log(`  Recurring reminders triggered: ${recurringReminders}`);
  }

  const duration = Date.now() - startTime;

  console.log(`Alerts evaluation completed in ${duration}ms`);
  console.log(`  Total notifications created: ${budgetAlerts + priceAlerts + balanceAlerts + recurringReminders}`);

  return {
    budgetAlerts,
    priceAlerts,
    balanceAlerts,
    recurringReminders,
    duration,
  };
}

export default handleAlertsJob;
