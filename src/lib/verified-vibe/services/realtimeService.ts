/**
 * Real-Time Service for Chat
 *
 * Provides high-level API for real-time messaging, typing indicators,
 * and online status updates using WebSocket.
 */

import { getWebSocketClient, type WebSocketClient, type WebSocketEvent } from '$lib/client/websocket';
import { messages, addMessage, isTyping, updateMatchUserOnlineStatus } from '../stores';
import type { Message } from '../types';

let wsClient: WebSocketClient | null = null;
let currentConversationId: string | null = null;
let currentUserId: string | null = null;
let unsubscribeMessage: (() => void) | null = null;
let unsubscribeTyping: (() => void) | null = null;
let unsubscribeOnlineStatus: (() => void) | null = null;

/**
 * Initialize real-time service
 */
export async function initializeRealtimeService(userId: string): Promise<void> {
  try {
    currentUserId = userId;
    wsClient = getWebSocketClient();
    await wsClient.connect();
    console.log('[RealtimeService] Initialized');
  } catch (error) {
    console.error('[RealtimeService] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Subscribe to messages for a conversation
 */
export function subscribeToMessages(conversationId: string, onMessage?: (message: Message) => void): () => void {
  if (!wsClient) {
    console.warn('[RealtimeService] WebSocket client not initialized');
    return () => {};
  }

  currentConversationId = conversationId;

  // Send subscription message
  wsClient.send({
    type: 'subscribe-messages',
    conversationId,
    userId: currentUserId
  });

  // Subscribe to message events
  unsubscribeMessage = wsClient.on('message', (event: WebSocketEvent) => {
    const messageData = event.data as any;

    // Only process messages for current conversation
    if (messageData.conversationId === conversationId) {
      const message: Message = {
        id: messageData.id,
        matchId: messageData.conversationId,
        senderId: messageData.senderId,
        content: messageData.content,
        createdAt: new Date(messageData.createdAt),
        imageUrl: messageData.imageUrl,
        isDeleted: messageData.isDeleted,
        editedAt: messageData.editedAt ? new Date(messageData.editedAt) : undefined
      };

      // Add to store
      addMessage(message);

      // Call callback if provided
      if (onMessage) {
        onMessage(message);
      }
    }
  });

  // Return unsubscribe function
  return () => {
    if (unsubscribeMessage) {
      unsubscribeMessage();
      unsubscribeMessage = null;
    }

    // Send unsubscribe message
    if (wsClient) {
      wsClient.send({
        type: 'unsubscribe-messages',
        conversationId,
        userId: currentUserId
      });
    }
  };
}

/**
 * Send a message through WebSocket
 */
export function sendMessage(conversationId: string, content: string, imageUrl?: string): void {
  if (!wsClient) {
    console.warn('[RealtimeService] WebSocket client not initialized');
    return;
  }

  wsClient.send({
    type: 'send-message',
    conversationId,
    userId: currentUserId,
    data: {
      content,
      imageUrl,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Subscribe to typing indicators
 */
export function subscribeToTypingIndicator(conversationId: string): () => void {
  if (!wsClient) {
    console.warn('[RealtimeService] WebSocket client not initialized');
    return () => {};
  }

  // Send subscription message
  wsClient.send({
    type: 'subscribe-typing',
    conversationId,
    userId: currentUserId
  });

  // Subscribe to typing events
  unsubscribeTyping = wsClient.on('typing', (event: WebSocketEvent) => {
    const typingData = event.data as any;

    // Only process typing for current conversation
    if (typingData.conversationId === conversationId && typingData.userId !== currentUserId) {
      isTyping.set(typingData.isTyping);

      // Auto-clear typing indicator after 3 seconds
      if (typingData.isTyping) {
        setTimeout(() => {
          isTyping.set(false);
        }, 3000);
      }
    }
  });

  // Return unsubscribe function
  return () => {
    if (unsubscribeTyping) {
      unsubscribeTyping();
      unsubscribeTyping = null;
    }

    // Send unsubscribe message
    if (wsClient) {
      wsClient.send({
        type: 'unsubscribe-typing',
        conversationId,
        userId: currentUserId
      });
    }
  };
}

/**
 * Publish typing indicator
 */
export function publishTypingIndicator(conversationId: string, isTyping: boolean): void {
  if (!wsClient) {
    console.warn('[RealtimeService] WebSocket client not initialized');
    return;
  }

  wsClient.send({
    type: 'typing',
    conversationId,
    userId: currentUserId,
    data: {
      isTyping,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Subscribe to online status updates
 */
export function subscribeToOnlineStatus(conversationId: string, matchUserId: string): () => void {
  if (!wsClient) {
    console.warn('[RealtimeService] WebSocket client not initialized');
    return () => {};
  }

  // Send subscription message
  wsClient.send({
    type: 'subscribe-online-status',
    conversationId,
    userId: currentUserId,
    data: {
      targetUserId: matchUserId
    }
  });

  // Subscribe to online status events
  unsubscribeOnlineStatus = wsClient.on('online-status', (event: WebSocketEvent) => {
    const statusData = event.data as any;

    // Only process status for target user
    if (statusData.userId === matchUserId) {
      updateMatchUserOnlineStatus(statusData.isOnline, statusData.lastSeen ? new Date(statusData.lastSeen) : null);
    }
  });

  // Return unsubscribe function
  return () => {
    if (unsubscribeOnlineStatus) {
      unsubscribeOnlineStatus();
      unsubscribeOnlineStatus = null;
    }

    // Send unsubscribe message
    if (wsClient) {
      wsClient.send({
        type: 'unsubscribe-online-status',
        conversationId,
        userId: currentUserId,
        data: {
          targetUserId: matchUserId
        }
      });
    }
  };
}

/**
 * Publish online status
 */
export function publishOnlineStatus(isOnline: boolean): void {
  if (!wsClient) {
    console.warn('[RealtimeService] WebSocket client not initialized');
    return;
  }

  wsClient.send({
    type: 'online-status',
    userId: currentUserId,
    data: {
      isOnline,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Subscribe to read receipts
 */
export function subscribeToReadReceipts(conversationId: string): () => void {
  if (!wsClient) {
    console.warn('[RealtimeService] WebSocket client not initialized');
    return () => {};
  }

  // Send subscription message
  wsClient.send({
    type: 'subscribe-read-receipts',
    conversationId,
    userId: currentUserId
  });

  // Subscribe to read receipt events
  const unsubscribe = wsClient.on('read-receipt', (event: WebSocketEvent) => {
    const receiptData = event.data as any;

    // Update message read status in store
    messages.update((msgs) =>
      msgs.map((msg) =>
        msg.id === receiptData.messageId
          ? { ...msg, readAt: new Date(receiptData.readAt) }
          : msg
      )
    );
  });

  // Return unsubscribe function
  return () => {
    unsubscribe();

    // Send unsubscribe message
    if (wsClient) {
      wsClient.send({
        type: 'unsubscribe-read-receipts',
        conversationId,
        userId: currentUserId
      });
    }
  };
}

/**
 * Publish read receipt
 */
export function publishReadReceipt(conversationId: string, messageId: string): void {
  if (!wsClient) {
    console.warn('[RealtimeService] WebSocket client not initialized');
    return;
  }

  wsClient.send({
    type: 'read-receipt',
    conversationId,
    userId: currentUserId,
    data: {
      messageId,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Subscribe to message reactions
 */
export function subscribeToReactions(conversationId: string): () => void {
  if (!wsClient) {
    console.warn('[RealtimeService] WebSocket client not initialized');
    return () => {};
  }

  // Send subscription message
  wsClient.send({
    type: 'subscribe-reactions',
    conversationId,
    userId: currentUserId
  });

  // Subscribe to reaction events
  const unsubscribe = wsClient.on('reaction', (event: WebSocketEvent) => {
    const reactionData = event.data as any;

    // Update message reactions in store
    messages.update((msgs) =>
      msgs.map((msg) =>
        msg.id === reactionData.messageId
          ? {
              ...msg,
              reactions: reactionData.reactions || []
            }
          : msg
      )
    );
  });

  // Return unsubscribe function
  return () => {
    unsubscribe();

    // Send unsubscribe message
    if (wsClient) {
      wsClient.send({
        type: 'unsubscribe-reactions',
        conversationId,
        userId: currentUserId
      });
    }
  };
}

/**
 * Publish message reaction
 */
export function publishReaction(conversationId: string, messageId: string, emoji: string, action: 'add' | 'remove'): void {
  if (!wsClient) {
    console.warn('[RealtimeService] WebSocket client not initialized');
    return;
  }

  wsClient.send({
    type: 'reaction',
    conversationId,
    userId: currentUserId,
    data: {
      messageId,
      emoji,
      action,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Get WebSocket client status
 */
export function getRealtimeStatus() {
  if (!wsClient) {
    return {
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
      messageQueueSize: 0
    };
  }

  return wsClient.getStatus();
}

/**
 * Disconnect real-time service
 */
export function disconnectRealtimeService(): void {
  if (unsubscribeMessage) {
    unsubscribeMessage();
    unsubscribeMessage = null;
  }

  if (unsubscribeTyping) {
    unsubscribeTyping();
    unsubscribeTyping = null;
  }

  if (unsubscribeOnlineStatus) {
    unsubscribeOnlineStatus();
    unsubscribeOnlineStatus = null;
  }

  if (wsClient) {
    wsClient.disconnect();
    wsClient = null;
  }

  currentConversationId = null;
  currentUserId = null;

  console.log('[RealtimeService] Disconnected');
}
