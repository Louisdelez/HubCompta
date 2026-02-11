// ============================================================================
// NOTIFICATIONS MODULE EXPORTS - Finance Hub
// ============================================================================

export { notificationService } from './notification.service.js';
export { alertService } from './alert.service.js';
export { smartAlertService } from './smart-alert.service.js';
export { summaryService } from './summary.service.js';
export { insightsService } from './insights.service.js';
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
export type {
  AnomalyDetectionResult,
  SpendingSummary,
} from './smart-alert.service.js';
export type {
  WeeklySummary,
  MonthlySummary,
} from './summary.service.js';
export type {
  Insight,
  InsightType,
  InsightSeverity,
} from './insights.service.js';
