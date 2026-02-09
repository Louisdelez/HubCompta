// ============================================================================
// WEBSOCKET TYPES - Finance Hub
// TypeScript types for WebSocket messages and events
// ============================================================================

// ----------------------------------------------------------------------------
// Event Types
// ----------------------------------------------------------------------------

export type WebSocketEventType =
  | 'notification'
  | 'transaction_created'
  | 'transaction_updated'
  | 'transaction_deleted'
  | 'balance_updated'
  | 'budget_alert'
  | 'import_complete'
  | 'export_ready'
  | 'price_alert'
  | 'connection_ack'
  | 'error'
  | 'pong';

// ----------------------------------------------------------------------------
// Client Message Types (messages FROM client)
// ----------------------------------------------------------------------------

export interface ClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping';
  channel?: string;
  workspaceId?: string;
}

// ----------------------------------------------------------------------------
// Server Message Types (messages TO client)
// ----------------------------------------------------------------------------

export interface ServerMessage<T = unknown> {
  type: WebSocketEventType;
  payload: T;
  timestamp: string;
}

// ----------------------------------------------------------------------------
// Notification Payload
// ----------------------------------------------------------------------------

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string;
  workspaceId?: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Transaction Event Payloads
// ----------------------------------------------------------------------------

export interface TransactionCreatedPayload {
  id: string;
  workspaceId: string;
  accountId: string;
  amount: number;
  type: string;
  description: string | null;
  categoryId: string | null;
  date: string;
}

export interface TransactionUpdatedPayload {
  id: string;
  workspaceId: string;
  changes: Record<string, unknown>;
}

export interface TransactionDeletedPayload {
  id: string;
  workspaceId: string;
  accountId: string;
}

// ----------------------------------------------------------------------------
// Balance Update Payload
// ----------------------------------------------------------------------------

export interface BalanceUpdatedPayload {
  workspaceId: string;
  accountId: string;
  balance: number;
  previousBalance: number;
}

// ----------------------------------------------------------------------------
// Budget Alert Payload
// ----------------------------------------------------------------------------

export interface BudgetAlertPayload {
  workspaceId: string;
  budgetId: string;
  budgetName: string;
  categoryName: string;
  percentUsed: number;
  isExceeded: boolean;
}

// ----------------------------------------------------------------------------
// Import Complete Payload
// ----------------------------------------------------------------------------

export interface ImportCompletePayload {
  workspaceId: string;
  imported: number;
  skipped: number;
  errors: number;
}

// ----------------------------------------------------------------------------
// Export Ready Payload
// ----------------------------------------------------------------------------

export interface ExportReadyPayload {
  workspaceId: string;
  type: string;
  filename: string;
  downloadUrl?: string;
}

// ----------------------------------------------------------------------------
// Price Alert Payload
// ----------------------------------------------------------------------------

export interface PriceAlertPayload {
  workspaceId: string;
  assetSymbol: string;
  assetName: string;
  currentPrice: number;
  targetPrice: number;
  direction: 'above' | 'below';
}

// ----------------------------------------------------------------------------
// Connection Acknowledgment Payload
// ----------------------------------------------------------------------------

export interface ConnectionAckPayload {
  connectionId: string;
  userId: string;
  subscribedWorkspaces: string[];
}

// ----------------------------------------------------------------------------
// Error Payload
// ----------------------------------------------------------------------------

export interface ErrorPayload {
  code: string;
  message: string;
}

// ----------------------------------------------------------------------------
// Connection Info (internal tracking)
// ----------------------------------------------------------------------------

export interface ConnectionInfo {
  connectionId: string;
  userId: string;
  subscribedWorkspaces: Set<string>;
  connectedAt: Date;
  lastPingAt: Date;
}
