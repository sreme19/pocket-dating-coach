/**
 * Online Status Service
 * Manages user online status tracking and presence updates
 */

import { getSupabaseClient } from '$lib/client/supabase';
import type { VerifiedVibeUser } from '../types';

export interface OnlineStatus {
  userId: string;
  isOnline: boolean;
  lastSeen: Date | null;
  onlineAt?: Date;
}

export interface PresenceData {
  user_id: string;
  online_at: string;
  last_activity?: string;
}

// Store active presence channels to manage cleanup
const activeChannels = new Map<string, ReturnType<typeof getSupabaseClient>['channel']>();

/**
 * Track user online status in Supabase presence
 * Call this when user opens the app
 */
export async function trackUserOnline(userId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    // Create a presence channel for the user
    const channel = supabase.channel(`user:${userId}:presence`, {
      config: {
        presence: {
          key: userId
        }
      }
    });

    // Store channel reference for cleanup
    activeChannels.set(`user:${userId}:presence`, channel);

    channel
      .on('presence', { event: 'sync' }, () => {
        console.log('Presence sync:', channel.presenceState());
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track user as online
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
            last_activity: new Date().toISOString()
          } as PresenceData);
        }
      });

    return;
  } catch (error) {
    console.error('Error tracking user online:', error);
    throw error;
  }
}

/**
 * Update user's last activity timestamp
 * Call this on user interactions (messages, clicks, etc.)
 */
export async function updateLastActivity(userId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    // Update the presence data with new last_activity
    const channel = supabase.channel(`user:${userId}:presence`);
    
    await channel.track({
      user_id: userId,
      online_at: new Date().toISOString(),
      last_activity: new Date().toISOString()
    } as PresenceData);
  } catch (error) {
    console.error('Error updating last activity:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Subscribe to online status of a specific user
 * Returns an unsubscribe function
 */
export function subscribeToUserOnlineStatus(
  userId: string,
  onStatusChange: (status: OnlineStatus) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const supabase = getSupabaseClient();

    const channel = supabase.channel(`user:${userId}:presence`);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const presences = state[userId] || [];
        
        if (presences.length > 0) {
          const presence = presences[0] as PresenceData;
          onStatusChange({
            userId,
            isOnline: true,
            lastSeen: presence.online_at ? new Date(presence.online_at) : null,
            onlineAt: presence.online_at ? new Date(presence.online_at) : undefined
          });
        } else {
          onStatusChange({
            userId,
            isOnline: false,
            lastSeen: null
          });
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const presence = newPresences[0] as PresenceData;
        onStatusChange({
          userId,
          isOnline: true,
          lastSeen: presence.online_at ? new Date(presence.online_at) : null,
          onlineAt: presence.online_at ? new Date(presence.online_at) : undefined
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const presence = leftPresences[0] as PresenceData;
        onStatusChange({
          userId,
          isOnline: false,
          lastSeen: presence.last_activity 
            ? new Date(presence.last_activity) 
            : (presence.online_at ? new Date(presence.online_at) : null)
        });
      })
      .on('system', { event: 'error' }, (error) => {
        console.error('Online status subscription error:', error);
        if (onError) {
          onError(new Error(`Online status subscription error: ${error.message}`));
        }
      })
      .subscribe(async (status) => {
        console.log(`Online status subscription status for user ${userId}:`, status);
      });

    // Return unsubscribe function
    return () => {
      supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error('Failed to subscribe to online status:', error);
    if (onError) {
      onError(error as Error);
    }
    return () => {};
  }
}

/**
 * Format last seen time for display
 */
export function formatLastSeen(lastSeen: Date | null): string {
  if (!lastSeen) {
    return 'Never';
  }

  const now = new Date();
  const diff = now.getTime() - lastSeen.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  if (days < 7) {
    return `${days}d ago`;
  }

  // Format as date
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return lastSeen.toLocaleDateString('en-US', options);
}

/**
 * Check if user is considered "recently active"
 * (online or seen within last 5 minutes)
 */
export function isRecentlyActive(status: OnlineStatus): boolean {
  if (status.isOnline) {
    return true;
  }

  if (!status.lastSeen) {
    return false;
  }

  const now = new Date();
  const diff = now.getTime() - status.lastSeen.getTime();
  const minutes = Math.floor(diff / 60000);

  return minutes < 5;
}

/**
 * Untrack user online status (call on app close/logout)
 */
export async function untrackUserOnline(userId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const channelKey = `user:${userId}:presence`;
    const channel = activeChannels.get(channelKey);
    
    if (channel) {
      // Unsubscribe from the channel
      await supabase.removeChannel(channel);
      activeChannels.delete(channelKey);
    }
  } catch (error) {
    console.error('Error untracking user online:', error);
    // Don't throw - this is cleanup
  }
}

/**
 * Clean up all active presence channels
 * Call this on app destroy or logout
 */
export async function cleanupAllPresenceChannels(): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    for (const [key, channel] of activeChannels.entries()) {
      try {
        await supabase.removeChannel(channel);
      } catch (error) {
        console.error(`Error cleaning up channel ${key}:`, error);
      }
    }
    
    activeChannels.clear();
  } catch (error) {
    console.error('Error cleaning up presence channels:', error);
  }
}
