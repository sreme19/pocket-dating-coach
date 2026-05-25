/**
 * WebSocket Client for Real-Time Messaging
 *
 * Handles WebSocket connection management, message queuing, and automatic reconnection.
 * Provides a simple interface for subscribing to real-time events.
 */

import { writable, type Writable } from 'svelte/store';

export type WebSocketEventType = 'message' | 'typing' | 'online-status' | 'read-receipt' | 'reaction' | 'error' | 'connected' | 'disconnected';

export interface WebSocketEvent {
  type: WebSocketEventType;
  data: any;
  timestamp: Date;
}

export interface WebSocketMessage {
  type: string;
  conversationId?: string;
  userId?: string;
  data?: any;
}

interface QueuedMessage {
  message: WebSocketMessage;
  timestamp: Date;
  retries: number;
}

const MAX_RETRIES = 3;
const RECONNECT_DELAY = 3000; // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 5;
const MESSAGE_QUEUE_SIZE = 100;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

/**
 * WebSocket Client
 *
 * Manages WebSocket connection with automatic reconnection,
 * message queuing, and event subscription.
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private messageQueue: QueuedMessage[] = [];
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private eventSubscribers: Map<WebSocketEventType, Set<(event: WebSocketEvent) => void>> = new Map();

  // Stores for reactive state
  public isConnected: Writable<boolean> = writable(false);
  public isConnecting: Writable<boolean> = writable(false);
  public lastError: Writable<string | null> = writable(null);
  public messageQueueSize: Writable<number> = writable(0);

  constructor(url: string) {
    this.url = url;
    this.initializeEventSubscribers();
  }

  /**
   * Initialize event subscriber maps
   */
  private initializeEventSubscribers() {
    const eventTypes: WebSocketEventType[] = ['message', 'typing', 'online-status', 'read-receipt', 'reaction', 'error', 'connected', 'disconnected'];
    eventTypes.forEach((type) => {
      this.eventSubscribers.set(type, new Set());
    });
  }

  /**
   * Connect to WebSocket server
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.isConnecting.set(true);

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected');
          this.isConnected.set(true);
          this.isConnecting.set(false);
          this.reconnectAttempts = 0;
          this.lastError.set(null);

          // Emit connected event
          this.emit('connected', { timestamp: new Date() });

          // Start heartbeat
          this.startHeartbeat();

          // Process queued messages
          this.processMessageQueue();

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const wsEvent = JSON.parse(event.data) as WebSocketEvent;
            this.handleMessage(wsEvent);
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          this.lastError.set('WebSocket connection error');
          this.emit('error', { error: 'Connection error', timestamp: new Date() });
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[WebSocket] Disconnected');
          this.isConnected.set(false);
          this.isConnecting.set(false);
          this.stopHeartbeat();

          // Emit disconnected event
          this.emit('disconnected', { timestamp: new Date() });

          // Attempt to reconnect
          this.attemptReconnect();
        };
      } catch (error) {
        console.error('[WebSocket] Connection failed:', error);
        this.lastError.set('Failed to create WebSocket connection');
        this.isConnecting.set(false);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.stopHeartbeat();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected.set(false);
    this.isConnecting.set(false);
  }

  /**
   * Send a message through WebSocket
   */
  public send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[WebSocket] Failed to send message:', error);
        this.queueMessage(message);
      }
    } else {
      // Queue message if not connected
      this.queueMessage(message);
    }
  }

  /**
   * Queue a message for later delivery
   */
  private queueMessage(message: WebSocketMessage): void {
    if (this.messageQueue.length >= MESSAGE_QUEUE_SIZE) {
      console.warn('[WebSocket] Message queue full, dropping oldest message');
      this.messageQueue.shift();
    }

    this.messageQueue.push({
      message,
      timestamp: new Date(),
      retries: 0
    });

    this.messageQueueSize.set(this.messageQueue.length);
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const queued = this.messageQueue.shift();
      if (queued) {
        try {
          this.send(queued.message);
        } catch (error) {
          console.error('[WebSocket] Failed to send queued message:', error);
          queued.retries++;
          if (queued.retries < MAX_RETRIES) {
            this.messageQueue.unshift(queued);
          }
        }
      }
    }

    this.messageQueueSize.set(this.messageQueue.length);
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(event: WebSocketEvent): void {
    // Emit event to subscribers
    this.emit(event.type, event);
  }

  /**
   * Emit event to subscribers
   */
  private emit(type: WebSocketEventType, data: any): void {
    const subscribers = this.eventSubscribers.get(type);
    if (subscribers) {
      const event: WebSocketEvent = {
        type,
        data,
        timestamp: new Date()
      };
      subscribers.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error(`[WebSocket] Error in ${type} subscriber:`, error);
        }
      });
    }
  }

  /**
   * Subscribe to WebSocket events
   */
  public on(type: WebSocketEventType, callback: (event: WebSocketEvent) => void): () => void {
    const subscribers = this.eventSubscribers.get(type);
    if (subscribers) {
      subscribers.add(callback);

      // Return unsubscribe function
      return () => {
        subscribers.delete(callback);
      };
    }

    return () => {};
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[WebSocket] Max reconnection attempts reached');
      this.lastError.set('Failed to reconnect after multiple attempts');
      return;
    }

    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(`[WebSocket] Attempting to reconnect (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[WebSocket] Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          console.error('[WebSocket] Failed to send heartbeat:', error);
        }
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get connection status
   */
  public getStatus(): {
    isConnected: boolean;
    isConnecting: boolean;
    reconnectAttempts: number;
    messageQueueSize: number;
  } {
    let connected = false;
    let connecting = false;
    let queueSize = 0;

    this.isConnected.subscribe((value) => {
      connected = value;
    })();

    this.isConnecting.subscribe((value) => {
      connecting = value;
    })();

    this.messageQueueSize.subscribe((value) => {
      queueSize = value;
    })();

    return {
      isConnected: connected,
      isConnecting: connecting,
      reconnectAttempts: this.reconnectAttempts,
      messageQueueSize: queueSize
    };
  }
}

/**
 * Global WebSocket client instance
 */
let wsClient: WebSocketClient | null = null;

/**
 * Get or create WebSocket client
 */
export function getWebSocketClient(url?: string): WebSocketClient {
  if (!wsClient) {
    const wsUrl = url || getWebSocketUrl();
    wsClient = new WebSocketClient(wsUrl);
  }
  return wsClient;
}

/**
 * Get WebSocket URL based on current location
 */
function getWebSocketUrl(): string {
  if (typeof window === 'undefined') {
    return 'ws://localhost:5173/api/verified-vibe/websocket';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/api/verified-vibe/websocket`;
}

/**
 * Destroy WebSocket client
 */
export function destroyWebSocketClient(): void {
  if (wsClient) {
    wsClient.disconnect();
    wsClient = null;
  }
}
