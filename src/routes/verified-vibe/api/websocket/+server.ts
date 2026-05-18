/**
 * WebSocket Endpoint for Real-Time Messaging
 *
 * Handles WebSocket connections for real-time message delivery,
 * typing indicators, online status, and read receipts.
 */

import type { RequestHandler } from './$types';

// Store active WebSocket connections
interface WebSocketConnection {
  ws: WebSocket;
  userId: string;
  conversationIds: Set<string>;
  lastActivity: Date;
}

const connections = new Map<string, WebSocketConnection>();
const conversationSubscribers = new Map<string, Set<string>>();

/**
 * Handle WebSocket upgrade
 */
export const GET: RequestHandler = async ({ request }) => {
  // Check if this is a WebSocket upgrade request
  const upgrade = request.headers.get('upgrade');
  if (upgrade !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  // In a real implementation, you would use a WebSocket library
  // For now, we'll return a 501 Not Implemented
  // This is because SvelteKit doesn't have built-in WebSocket support
  // You would need to use a separate WebSocket server or a library like ws

  return new Response('WebSocket support requires a separate server implementation', {
    status: 501
  });
};

/**
 * Handle WebSocket messages
 *
 * Message types:
 * - subscribe-messages: Subscribe to messages in a conversation
 * - unsubscribe-messages: Unsubscribe from messages
 * - send-message: Send a message
 * - typing: Publish typing indicator
 * - subscribe-typing: Subscribe to typing indicators
 * - unsubscribe-typing: Unsubscribe from typing
 * - online-status: Publish online status
 * - subscribe-online-status: Subscribe to online status
 * - unsubscribe-online-status: Unsubscribe from online status
 * - read-receipt: Publish read receipt
 * - subscribe-read-receipts: Subscribe to read receipts
 * - unsubscribe-read-receipts: Unsubscribe from read receipts
 * - reaction: Publish message reaction
 * - subscribe-reactions: Subscribe to reactions
 * - unsubscribe-reactions: Unsubscribe from reactions
 * - ping: Heartbeat message
 */

/**
 * Handle incoming WebSocket message
 */
function handleMessage(connectionId: string, message: any): void {
  const connection = connections.get(connectionId);
  if (!connection) return;

  const { type, conversationId, userId, data } = message;

  switch (type) {
    case 'subscribe-messages':
      handleSubscribeMessages(connectionId, conversationId);
      break;

    case 'unsubscribe-messages':
      handleUnsubscribeMessages(connectionId, conversationId);
      break;

    case 'send-message':
      handleSendMessage(connectionId, conversationId, userId, data);
      break;

    case 'typing':
      handleTyping(connectionId, conversationId, userId, data);
      break;

    case 'subscribe-typing':
      handleSubscribeTyping(connectionId, conversationId);
      break;

    case 'unsubscribe-typing':
      handleUnsubscribeTyping(connectionId, conversationId);
      break;

    case 'online-status':
      handleOnlineStatus(connectionId, userId, data);
      break;

    case 'subscribe-online-status':
      handleSubscribeOnlineStatus(connectionId, conversationId, data);
      break;

    case 'unsubscribe-online-status':
      handleUnsubscribeOnlineStatus(connectionId, conversationId);
      break;

    case 'read-receipt':
      handleReadReceipt(connectionId, conversationId, userId, data);
      break;

    case 'subscribe-read-receipts':
      handleSubscribeReadReceipts(connectionId, conversationId);
      break;

    case 'unsubscribe-read-receipts':
      handleUnsubscribeReadReceipts(connectionId, conversationId);
      break;

    case 'reaction':
      handleReaction(connectionId, conversationId, userId, data);
      break;

    case 'subscribe-reactions':
      handleSubscribeReactions(connectionId, conversationId);
      break;

    case 'unsubscribe-reactions':
      handleUnsubscribeReactions(connectionId, conversationId);
      break;

    case 'ping':
      // Respond with pong
      connection.ws.send(JSON.stringify({ type: 'pong' }));
      break;

    default:
      console.warn(`[WebSocket] Unknown message type: ${type}`);
  }

  // Update last activity
  connection.lastActivity = new Date();
}

/**
 * Handle subscribe to messages
 */
function handleSubscribeMessages(connectionId: string, conversationId: string): void {
  const connection = connections.get(connectionId);
  if (!connection) return;

  connection.conversationIds.add(conversationId);

  // Add to conversation subscribers
  if (!conversationSubscribers.has(conversationId)) {
    conversationSubscribers.set(conversationId, new Set());
  }
  conversationSubscribers.get(conversationId)!.add(connectionId);

  console.log(`[WebSocket] User ${connection.userId} subscribed to messages in ${conversationId}`);
}

/**
 * Handle unsubscribe from messages
 */
function handleUnsubscribeMessages(connectionId: string, conversationId: string): void {
  const connection = connections.get(connectionId);
  if (!connection) return;

  connection.conversationIds.delete(conversationId);

  // Remove from conversation subscribers
  const subscribers = conversationSubscribers.get(conversationId);
  if (subscribers) {
    subscribers.delete(connectionId);
    if (subscribers.size === 0) {
      conversationSubscribers.delete(conversationId);
    }
  }

  console.log(`[WebSocket] User ${connection.userId} unsubscribed from messages in ${conversationId}`);
}

/**
 * Handle send message
 */
function handleSendMessage(connectionId: string, conversationId: string, userId: string, data: any): void {
  const connection = connections.get(connectionId);
  if (!connection) return;

  // Create message object
  const message = {
    type: 'message',
    data: {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      senderId: userId,
      content: data.content,
      imageUrl: data.imageUrl,
      createdAt: new Date().toISOString(),
      timestamp: data.timestamp
    }
  };

  // Broadcast to all subscribers in this conversation
  const subscribers = conversationSubscribers.get(conversationId);
  if (subscribers) {
    subscribers.forEach((subConnectionId) => {
      const subConnection = connections.get(subConnectionId);
      if (subConnection && subConnection.ws.readyState === WebSocket.OPEN) {
        subConnection.ws.send(JSON.stringify(message));
      }
    });
  }

  console.log(`[WebSocket] Message sent in ${conversationId} by ${userId}`);
}

/**
 * Handle typing indicator
 */
function handleTyping(connectionId: string, conversationId: string, userId: string, data: any): void {
  const connection = connections.get(connectionId);
  if (!connection) return;

  // Broadcast to all subscribers in this conversation
  const subscribers = conversationSubscribers.get(conversationId);
  if (subscribers) {
    subscribers.forEach((subConnectionId) => {
      if (subConnectionId !== connectionId) {
        const subConnection = connections.get(subConnectionId);
        if (subConnection && subConnection.ws.readyState === WebSocket.OPEN) {
          subConnection.ws.send(
            JSON.stringify({
              type: 'typing',
              data: {
                conversationId,
                userId,
                isTyping: data.isTyping,
                timestamp: data.timestamp
              }
            })
          );
        }
      }
    });
  }
}

/**
 * Handle subscribe to typing
 */
function handleSubscribeTyping(connectionId: string, conversationId: string): void {
  const connection = connections.get(connectionId);
  if (!connection) return;

  connection.conversationIds.add(conversationId);
  console.log(`[WebSocket] User ${connection.userId} subscribed to typing in ${conversationId}`);
}

/**
 * Handle unsubscribe from typing
 */
function handleUnsubscribeTyping(connectionId: string, conversationId: string): void {
  const connection = connections.get(connectionId);
  if (!connection) return;

  connection.conversationIds.delete(conversationId);
  console.log(`[WebSocket] User ${connection.userId} unsubscribed from typing in ${conversationId}`);
}

/**
 * Handle online status
 */
function handleOnlineStatus(connectionId: string, userId: string, data: any): void {
  // Broadcast to all connections
  connections.forEach((connection) => {
    if (connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(
        JSON.stringify({
          type: 'online-status',
          data: {
            userId,
            isOnline: data.isOnline,
            lastSeen: data.timestamp,
            timestamp: data.timestamp
          }
        })
      );
    }
  });

  console.log(`[WebSocket] User ${userId} online status: ${data.isOnline}`);
}

/**
 * Handle subscribe to online status
 */
function handleSubscribeOnlineStatus(connectionId: string, conversationId: string, data: any): void {
  const connection = connections.get(connectionId);
  if (!connection) return;

  connection.conversationIds.add(conversationId);
  console.log(`[WebSocket] User ${connection.userId} subscribed to online status for ${data.targetUserId}`);
}

/**
 * Handle unsubscribe from online status
 */
function handleUnsubscribeOnlineStatus(connectionId: string, conversationId: string): void {
  const connection = connections.get(connectionId);
  if (!connection) return;

  connection.conversationIds.delete(conversationId);
  console.log(`[WebSocket] User ${connection.userId} unsubscribed from online status`);
}

/**
 * Handle read receipt
 */
function handleReadReceipt(connectionId: string, conversationId: string, userId: string, data: any): void {
  const connection = connections.get(connectionId);
  if (!connection) return;

  // Broadcast to all subscribers in this conversation
  const subscribers = conversationSubscribers.get(conversationId);
  if (subscribers) {
    subscribers.forEach((subConnectionId) => {
      if (subConnectionId !== connectionId) {
        const subConnection = connections.get(subConnectionId);
        if (subConnection && subConnection.ws.readyState === WebSocket.OPEN) {
          subConnection.ws.send(
            JSON.stringify({
              type: 'read-receipt',
              data: {
                conversationId,
                messageId: data.messageId,
                readerId: userId,
                readAt: data.timestamp
              }
            })
          );
        }
      }
    });
  }

  console.log(`[WebSocket] Read receipt for message ${data.messageId} by ${userId}`);
}

/**
 * Handle subscribe to read receipts
 */
function handleSubscribeReadReceipts(connectionId: string, conversationId: string): void {
  const connection = connections.get(connectionId);
  if (!connection) return;

  connection.conversationIds.add(conversationId);
  console.log(`[WebSocket] User ${connection.userId} subscribed to read receipts in ${conversationId}`);
}

/**
 * Handle unsubscribe from read receipts
 */
function handleUnsubscribeReadReceipts(connectionId: string, conversationId: string): void {
  const connection = connections.get(connectionId);
  if (!connection) return;

  connection.conversationIds.delete(conversationId);
  console.log(`[WebSocket] User ${connection.userId} unsubscribed from read receipts in ${conversationId}`);
}

/**
 * Handle message reaction
 */
function handleReaction(connectionId: string, conversationId: string, userId: string, data: any): void {
  const connection = connections.get(connectionId);
  if (!connection) return;

  // Broadcast to all subscribers in this conversation
  const subscribers = conversationSubscribers.get(conversationId);
  if (subscribers) {
    subscribers.forEach((subConnectionId) => {
      const subConnection = connections.get(subConnectionId);
      if (subConnection && subConnection.ws.readyState === WebSocket.OPEN) {
        subConnection.ws.send(
          JSON.stringify({
            type: 'reaction',
            data: {
              conversationId,
              messageId: data.messageId,
              userId,
              emoji: data.emoji,
              action: data.action,
              timestamp: data.timestamp
            }
          })
        );
      }
    });
  }

  console.log(`[WebSocket] Reaction ${data.emoji} on message ${data.messageId} by ${userId}`);
}

/**
 * Handle subscribe to reactions
 */
function handleSubscribeReactions(connectionId: string, conversationId: string): void {
  const connection = connections.get(connectionId);
  if (!connection) return;

  connection.conversationIds.add(conversationId);
  console.log(`[WebSocket] User ${connection.userId} subscribed to reactions in ${conversationId}`);
}

/**
 * Handle unsubscribe from reactions
 */
function handleUnsubscribeReactions(connectionId: string, conversationId: string): void {
  const connection = connections.get(connectionId);
  if (!connection) return;

  connection.conversationIds.delete(conversationId);
  console.log(`[WebSocket] User ${connection.userId} unsubscribed from reactions in ${conversationId}`);
}

/**
 * Clean up inactive connections
 */
function cleanupInactiveConnections(): void {
  const now = new Date();
  const timeout = 5 * 60 * 1000; // 5 minutes

  connections.forEach((connection, connectionId) => {
    if (now.getTime() - connection.lastActivity.getTime() > timeout) {
      console.log(`[WebSocket] Closing inactive connection: ${connectionId}`);
      connection.ws.close();
      connections.delete(connectionId);
    }
  });
}

// Run cleanup every minute
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupInactiveConnections, 60000);
}
