// ============================================================================
// NOTIFICATIONS MODULE EXPORTS - Finance Hub
// ============================================================================

export { notificationService } from './notification.service.js';
export { alertService } from './alert.service.js';
export type {
  CreateNotificationInput,
  NotificationFilters,
  PaginationParams,
} from './notification.service.js';
export type {
  CreateAlertRuleInput,
  AlertConfig,
  BudgetThresholdConfig,
  PriceAlertConfig,
  PriceChangeConfig,
  LowBalanceConfig,
  LargeTransactionConfig,
  RecurringReminderConfig,
} from './alert.service.js';
