// ============================================================================
// NOTIFICATIONS MODULE EXPORTS - Finance Hub
// ============================================================================

export { notificationService } from './notification.service.js';
export { alertService } from './alert.service.js';
export { smartAlertService } from './smart-alert.service.js';
export { summaryService } from './summary.service.js';
export { insightsService } from './insights.service.js';

// Multi-channel notification services
export { notificationChannelService } from './channel.service.js';
export { whatsappService } from './whatsapp.service.js';
export { smsService } from './sms.service.js';
export { discordService } from './discord.service.js';
export { notificationDispatcherService } from './dispatcher.service.js';
export { pushService } from './push.service.js';

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
export type {
  CreateChannelInput,
  UpdateChannelInput,
  ChannelVerificationResult,
} from './channel.service.js';
export type {
  WhatsAppMessage,
  WhatsAppSendResult,
} from './whatsapp.service.js';
export type {
  SMSSendResult,
} from './sms.service.js';
export type {
  DiscordEmbed,
  DiscordSendResult,
} from './discord.service.js';
export type {
  DeliveryReport,
  DispatchOptions,
} from './dispatcher.service.js';
export type {
  PushSubscriptionInput,
  PushNotificationPayload,
  PushSendResult,
} from './push.service.js';
