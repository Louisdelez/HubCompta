// ============================================================================
// WEBSOCKET SERVER - Finance Hub
// WebSocket server setup, connection management, and broadcasting
// ============================================================================

import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { randomUUID } from 'crypto';
import { verifyAccessToken, type AccessTokenPayload } from '@/core/crypto/jwt.js';
import { membershipService } from '@/modules/workspaces/membership.service.js';
import { handleMessage, sendConnectionAck, sendError, sendMessage } from './handlers.js';
import type {
  ConnectionInfo,
  ServerMessage,
  NotificationPayload,
  WebSocketEventType,
} from './types.js';
import { logger } from '@/core/middleware/logger.js';

// ----------------------------------------------------------------------------
// Connection Store
// ----------------------------------------------------------------------------

// Map of userId -> Set of sockets
const userConnections = new Map<string, Set<WebSocket>>();

// Map of socket -> ConnectionInfo
const connectionInfoMap = new WeakMap<WebSocket, ConnectionInfo>();

// Map of workspaceId -> Set of sockets
const workspaceConnections = new Map<string, Set<WebSocket>>();

// ----------------------------------------------------------------------------
// Connection Management
// ----------------------------------------------------------------------------

function addConnection(socket: WebSocket, userId: string): ConnectionInfo {
  const connectionId = randomUUID();
  const connectionInfo: ConnectionInfo = {
    connectionId,
    userId,
    subscribedWorkspaces: new Set(),
    connectedAt: new Date(),
    lastPingAt: new Date(),
  };

  // Store connection info
  connectionInfoMap.set(socket, connectionInfo);

  // Add to user connections
  let userSockets = userConnections.get(userId);
  if (!userSockets) {
    userSockets = new Set();
    userConnections.set(userId, userSockets);
  }
  userSockets.add(socket);

  return connectionInfo;
}

function removeConnection(socket: WebSocket): void {
  const info = connectionInfoMap.get(socket);
  if (!info) return;

  // Remove from user connections
  const userSockets = userConnections.get(info.userId);
  if (userSockets) {
    userSockets.delete(socket);
    if (userSockets.size === 0) {
      userConnections.delete(info.userId);
    }
  }

  // Remove from workspace connections
  for (const workspaceId of info.subscribedWorkspaces) {
    const workspaceSockets = workspaceConnections.get(workspaceId);
    if (workspaceSockets) {
      workspaceSockets.delete(socket);
      if (workspaceSockets.size === 0) {
        workspaceConnections.delete(workspaceId);
      }
    }
  }
}

function subscribeToWorkspace(socket: WebSocket, workspaceId: string): void {
  const info = connectionInfoMap.get(socket);
  if (!info) return;

  info.subscribedWorkspaces.add(workspaceId);

  let workspaceSockets = workspaceConnections.get(workspaceId);
  if (!workspaceSockets) {
    workspaceSockets = new Set();
    workspaceConnections.set(workspaceId, workspaceSockets);
  }
  workspaceSockets.add(socket);
}

function unsubscribeFromWorkspace(socket: WebSocket, workspaceId: string): void {
  const info = connectionInfoMap.get(socket);
  if (!info) return;

  info.subscribedWorkspaces.delete(workspaceId);

  const workspaceSockets = workspaceConnections.get(workspaceId);
  if (workspaceSockets) {
    workspaceSockets.delete(socket);
    if (workspaceSockets.size === 0) {
      workspaceConnections.delete(workspaceId);
    }
  }
}

// ----------------------------------------------------------------------------
// Authentication Helper
// ----------------------------------------------------------------------------

function authenticateConnection(request: FastifyRequest): AccessTokenPayload | null {
  // Try to get token from query parameter first (WebSocket connections)
  const url = new URL(request.url, `http://${request.headers.host}`);
  const tokenFromQuery = url.searchParams.get('token');

  // Try Authorization header as fallback
  const authHeader = request.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  const token = tokenFromQuery ?? tokenFromHeader;

  if (!token) {
    return null;
  }

  try {
    return verifyAccessToken(token) as AccessTokenPayload;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// WebSocket Route Handler
// ----------------------------------------------------------------------------

async function websocketHandler(
  socket: WebSocket,
  request: FastifyRequest
): Promise<void> {
  // Authenticate connection
  const tokenPayload = authenticateConnection(request);

  if (!tokenPayload) {
    sendError(socket, 'UNAUTHORIZED', 'Invalid or missing authentication token');
    socket.close(4001, 'Unauthorized');
    return;
  }

  const userId = tokenPayload.sub;

  // Register connection
  const connectionInfo = addConnection(socket, userId);

  // Send connection acknowledgment
  sendConnectionAck(socket, connectionInfo);

  // Handle incoming messages
  socket.on('message', async (rawMessage: Buffer | string) => {
    const message = typeof rawMessage === 'string' ? rawMessage : rawMessage.toString();
    const info = connectionInfoMap.get(socket);
    if (!info) return;

    await handleMessage(socket, info, message);

    // Handle workspace subscription/unsubscription side effects
    const parsed = JSON.parse(message) as { type: string; workspaceId?: string };
    if (parsed.type === 'subscribe' && parsed.workspaceId) {
      const isMember = await membershipService.isMember(parsed.workspaceId, userId);
      if (isMember) {
        subscribeToWorkspace(socket, parsed.workspaceId);
      }
    } else if (parsed.type === 'unsubscribe' && parsed.workspaceId) {
      unsubscribeFromWorkspace(socket, parsed.workspaceId);
    }
  });

  // Handle close
  socket.on('close', () => {
    removeConnection(socket);
  });

  // Handle errors
  socket.on('error', (error: Error) => {
    logger.error({ userId, error: error.message }, 'WebSocket error');
    removeConnection(socket);
  });
}

// ----------------------------------------------------------------------------
// Register WebSocket Plugin
// ----------------------------------------------------------------------------

export async function registerWebSocket(app: FastifyInstance): Promise<void> {
  // Register websocket plugin (dynamically import to handle module resolution)
  const websocketPlugin = await import('@fastify/websocket');
  await app.register(websocketPlugin.default, {
    options: {
      maxPayload: 1048576, // 1MB max message size
    },
  });

  // Register WebSocket route
  app.get('/ws', { websocket: true }, websocketHandler);
}

// ----------------------------------------------------------------------------
// Broadcasting Functions
// ----------------------------------------------------------------------------

/**
 * Broadcast a message to a specific user (all their connections)
 */
export function broadcastToUser<T>(
  userId: string,
  eventType: WebSocketEventType,
  payload: T
): void {
  const sockets = userConnections.get(userId);
  if (!sockets) return;

  const message: ServerMessage<T> = {
    type: eventType,
    payload,
    timestamp: new Date().toISOString(),
  };

  for (const socket of sockets) {
    sendMessage(socket, message);
  }
}

/**
 * Broadcast a message to all members of a workspace
 */
export function broadcastToWorkspace<T>(
  workspaceId: string,
  eventType: WebSocketEventType,
  payload: T
): void {
  const sockets = workspaceConnections.get(workspaceId);
  if (!sockets) return;

  const message: ServerMessage<T> = {
    type: eventType,
    payload,
    timestamp: new Date().toISOString(),
  };

  for (const socket of sockets) {
    sendMessage(socket, message);
  }
}

/**
 * Broadcast a notification to a specific user
 */
export function broadcastNotification(
  userId: string,
  notification: NotificationPayload
): void {
  broadcastToUser(userId, 'notification', notification);
}

/**
 * Broadcast that a transaction was created
 */
export function broadcastTransactionCreated(
  workspaceId: string,
  transaction: {
    id: string;
    accountId: string;
    amount: number;
    type: string;
    description: string | null;
    categoryId: string | null;
    date: Date;
  }
): void {
  broadcastToWorkspace(workspaceId, 'transaction_created', {
    id: transaction.id,
    workspaceId,
    accountId: transaction.accountId,
    amount: transaction.amount,
    type: transaction.type,
    description: transaction.description,
    categoryId: transaction.categoryId,
    date: transaction.date.toISOString(),
  });
}

/**
 * Broadcast that account balance was updated
 */
export function broadcastBalanceUpdated(
  workspaceId: string,
  accountId: string,
  balance: number,
  previousBalance: number
): void {
  broadcastToWorkspace(workspaceId, 'balance_updated', {
    workspaceId,
    accountId,
    balance,
    previousBalance,
  });
}

// ----------------------------------------------------------------------------
// Connection Stats (for monitoring)
// ----------------------------------------------------------------------------

export function getConnectionStats(): {
  totalConnections: number;
  uniqueUsers: number;
  workspaces: number;
} {
  let totalConnections = 0;
  for (const sockets of userConnections.values()) {
    totalConnections += sockets.size;
  }

  return {
    totalConnections,
    uniqueUsers: userConnections.size,
    workspaces: workspaceConnections.size,
  };
}

// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

export * from './types.js';
export * from './handlers.js';
