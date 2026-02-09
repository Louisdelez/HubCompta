// ============================================================================
// WEBSOCKET HANDLERS - Finance Hub
// Message handlers for different WebSocket event types
// ============================================================================

import type { WebSocket } from '@fastify/websocket';
import type {
  ClientMessage,
  ServerMessage,
  ConnectionInfo,
  ConnectionAckPayload,
  ErrorPayload,
} from './types.js';
import { membershipService } from '@/modules/workspaces/membership.service.js';

// ----------------------------------------------------------------------------
// Send Helper
// ----------------------------------------------------------------------------

export function sendMessage<T>(socket: WebSocket, message: ServerMessage<T>): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

export function sendError(socket: WebSocket, code: string, message: string): void {
  sendMessage<ErrorPayload>(socket, {
    type: 'error',
    payload: { code, message },
    timestamp: new Date().toISOString(),
  });
}

// ----------------------------------------------------------------------------
// Message Handler
// ----------------------------------------------------------------------------

export async function handleMessage(
  socket: WebSocket,
  connection: ConnectionInfo,
  rawMessage: string
): Promise<void> {
  let message: ClientMessage;

  try {
    message = JSON.parse(rawMessage) as ClientMessage;
  } catch {
    sendError(socket, 'INVALID_JSON', 'Invalid JSON message');
    return;
  }

  switch (message.type) {
    case 'ping':
      handlePing(socket, connection);
      break;

    case 'subscribe':
      await handleSubscribe(socket, connection, message);
      break;

    case 'unsubscribe':
      handleUnsubscribe(socket, connection, message);
      break;

    default:
      sendError(socket, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${(message as { type: string }).type}`);
  }
}

// ----------------------------------------------------------------------------
// Ping Handler
// ----------------------------------------------------------------------------

function handlePing(socket: WebSocket, connection: ConnectionInfo): void {
  connection.lastPingAt = new Date();

  sendMessage(socket, {
    type: 'pong',
    payload: { timestamp: connection.lastPingAt.toISOString() },
    timestamp: new Date().toISOString(),
  });
}

// ----------------------------------------------------------------------------
// Subscribe Handler
// ----------------------------------------------------------------------------

async function handleSubscribe(
  socket: WebSocket,
  connection: ConnectionInfo,
  message: ClientMessage
): Promise<void> {
  const { workspaceId } = message;

  if (!workspaceId) {
    sendError(socket, 'MISSING_WORKSPACE_ID', 'workspaceId is required for subscription');
    return;
  }

  // Verify user has access to workspace
  const isMember = await membershipService.isMember(workspaceId, connection.userId);

  if (!isMember) {
    sendError(socket, 'FORBIDDEN', 'You do not have access to this workspace');
    return;
  }

  // Add workspace to subscriptions
  connection.subscribedWorkspaces.add(workspaceId);

  sendMessage<ConnectionAckPayload>(socket, {
    type: 'connection_ack',
    payload: {
      connectionId: connection.connectionId,
      userId: connection.userId,
      subscribedWorkspaces: Array.from(connection.subscribedWorkspaces),
    },
    timestamp: new Date().toISOString(),
  });
}

// ----------------------------------------------------------------------------
// Unsubscribe Handler
// ----------------------------------------------------------------------------

function handleUnsubscribe(
  _socket: WebSocket,
  connection: ConnectionInfo,
  message: ClientMessage
): void {
  const { workspaceId } = message;

  if (workspaceId) {
    connection.subscribedWorkspaces.delete(workspaceId);
  }
}

// ----------------------------------------------------------------------------
// Connection Ack on Initial Connect
// ----------------------------------------------------------------------------

export function sendConnectionAck(socket: WebSocket, connection: ConnectionInfo): void {
  sendMessage<ConnectionAckPayload>(socket, {
    type: 'connection_ack',
    payload: {
      connectionId: connection.connectionId,
      userId: connection.userId,
      subscribedWorkspaces: Array.from(connection.subscribedWorkspaces),
    },
    timestamp: new Date().toISOString(),
  });
}
