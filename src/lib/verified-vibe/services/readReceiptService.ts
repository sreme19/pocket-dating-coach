/**
 * Read Receipt Service
 *
 * Manages message read status tracking and publishing.
 * Automatically marks messages as read when viewed and batches updates.
 */

import { publishReadReceipt } from './realtimeService';
import { messages } from '../stores';

const BATCH_DELAY = 500; // 500ms
const BATCH_SIZE = 10; // Max messages per batch

interface ReadReceiptState {
  conversationId: string;
  messageId: string;
  readAt: Date;
}

// Store for tracking read receipts
const readReceipts = new Map<string, ReadReceiptState>();
const pendingReadReceipts = new Set<string>();
let batchTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Mark message as read
 */
export function markMessageAsRead(conversationId: string, messageId: string): void {
  const key = `${conversationId}:${messageId}`;

  // Check if already marked as read
  if (readReceipts.has(key)) {
    return;
  }

  // Add to read receipts
  readReceipts.set(key, {
    conversationId,
    messageId,
    readAt: new Date()
  });

  // Add to pending batch
  pendingReadReceipts.add(key);

  // Schedule batch processing
  scheduleBatchProcessing();
}

/**
 * Mark multiple messages as read
 */
export function markMessagesAsRead(conversationId: string, messageIds: string[]): void {
  messageIds.forEach((messageId) => {
    markMessageAsRead(conversationId, messageId);
  });
}

/**
 * Schedule batch processing of read receipts
 */
function scheduleBatchProcessing(): void {
  // Clear existing timeout
  if (batchTimeout) {
    clearTimeout(batchTimeout);
  }

  // Set new timeout
  batchTimeout = setTimeout(() => {
    processBatch();
  }, BATCH_DELAY);
}

/**
 * Process batch of read receipts
 */
function processBatch(): void {
  if (pendingReadReceipts.size === 0) {
    return;
  }

  // Get batch of receipts
  const batch = Array.from(pendingReadReceipts).slice(0, BATCH_SIZE);

  // Process each receipt
  batch.forEach((key) => {
    const receipt = readReceipts.get(key);
    if (receipt) {
      publishReadReceipt(receipt.conversationId, receipt.messageId);
    }

    // Remove from pending
    pendingReadReceipts.delete(key);
  });

  // If more pending, schedule next batch
  if (pendingReadReceipts.size > 0) {
    scheduleBatchProcessing();
  }
}

/**
 * Get read status for message
 */
export function getReadStatus(conversationId: string, messageId: string): ReadReceiptState | undefined {
  const key = `${conversationId}:${messageId}`;
  return readReceipts.get(key);
}

/**
 * Check if message is read
 */
export function isMessageRead(conversationId: string, messageId: string): boolean {
  const key = `${conversationId}:${messageId}`;
  return readReceipts.has(key);
}

/**
 * Get read time for message
 */
export function getReadTime(conversationId: string, messageId: string): Date | null {
  const receipt = getReadStatus(conversationId, messageId);
  return receipt?.readAt ?? null;
}

/**
 * Auto-mark visible messages as read
 *
 * This function should be called with an IntersectionObserver
 * to automatically mark messages as read when they become visible.
 */
export function autoMarkVisibleMessagesAsRead(conversationId: string, visibleMessageIds: string[]): void {
  visibleMessageIds.forEach((messageId) => {
    if (!isMessageRead(conversationId, messageId)) {
      markMessageAsRead(conversationId, messageId);
    }
  });
}

/**
 * Clear read receipts for conversation
 */
export function clearReadReceipts(conversationId: string): void {
  // Remove all receipts for this conversation
  const keysToDelete: string[] = [];

  readReceipts.forEach((receipt, key) => {
    if (receipt.conversationId === conversationId) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach((key) => {
    readReceipts.delete(key);
    pendingReadReceipts.delete(key);
  });
}

/**
 * Clear all read receipts
 */
export function clearAllReadReceipts(): void {
  readReceipts.clear();
  pendingReadReceipts.clear();

  if (batchTimeout) {
    clearTimeout(batchTimeout);
    batchTimeout = null;
  }
}

/**
 * Get read receipt statistics
 */
export function getReadReceiptStats(): {
  totalRead: number;
  pendingBatch: number;
} {
  return {
    totalRead: readReceipts.size,
    pendingBatch: pendingReadReceipts.size
  };
}

/**
 * Flush pending read receipts immediately
 */
export function flushPendingReadReceipts(): void {
  if (batchTimeout) {
    clearTimeout(batchTimeout);
    batchTimeout = null;
  }

  processBatch();
}
