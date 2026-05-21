import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';
import type { Database } from '$lib/server/supabase';

let client: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Get or create the Supabase client for client-side operations
 * Uses anonymous key for public operations (realtime subscriptions)
 */
export function getSupabaseClient() {
  if (!client) {
    client = createClient<Database>(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY);
  }
  return client;
}

/**
 * Subscribe to realtime message updates for a specific match
 * Returns an unsubscribe function
 */
export function subscribeToMessages(
  matchId: string,
  onNewMessage: (message: any) => void,
  onError?: (error: Error) => void
): () => void {
  const supabase = getSupabaseClient();

  const channel = supabase
    .channel(`match:${matchId}:messages`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'verified_vibe_messages',
        filter: `match_id=eq.${matchId}`
      },
      (payload) => {
        if (payload.new) {
          onNewMessage(payload.new);
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`Realtime subscription error for match ${matchId}:`, err);
        if (onError) onError(new Error(`Realtime subscription failed: ${status}`));
      }
    });

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to typing indicator updates for a specific match
 * Returns an unsubscribe function
 */
export function subscribeToTypingIndicator(
  matchId: string,
  userId: string,
  onTypingChange: (isTyping: boolean, typingUserId: string) => void,
  onError?: (error: Error) => void
): () => void {
  const supabase = getSupabaseClient();

  const channel = supabase
    .channel(`match:${matchId}:typing`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'verified_vibe_typing_indicators',
        filter: `match_id=eq.${matchId}`
      },
      (payload) => {
        if (payload.new && payload.new.user_id !== userId) {
          onTypingChange(true, payload.new.user_id);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'verified_vibe_typing_indicators',
        filter: `match_id=eq.${matchId}`
      },
      (payload) => {
        if (payload.old && payload.old.user_id !== userId) {
          onTypingChange(false, payload.old.user_id);
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`Typing indicator subscription error for match ${matchId}:`, err);
        if (onError) onError(new Error(`Typing indicator subscription failed: ${status}`));
      }
    });

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to online status updates for a specific user
 * Returns an unsubscribe function
 */
export function subscribeToOnlineStatus(
  userId: string,
  onStatusChange: (isOnline: boolean) => void,
  onError?: (error: Error) => void
): () => void {
  const supabase = getSupabaseClient();

  const channel = supabase
    .channel(`user:${userId}:presence`)
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const isOnline = Object.keys(state).length > 0;
      onStatusChange(isOnline);
    })
    .on('presence', { event: 'join' }, () => {
      onStatusChange(true);
    })
    .on('presence', { event: 'leave' }, () => {
      onStatusChange(false);
    })
    .on('system', { event: 'error' }, (error) => {
      console.error('Online status subscription error:', error);
      if (onError) {
        onError(new Error(`Online status subscription error: ${error.message}`));
      }
    })
    .subscribe(async (status) => {
      console.log(`Online status subscription status for user ${userId}:`, status);
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: userId,
          online_at: new Date().toISOString()
        });
      }
    });

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Publish typing indicator event
 */
export async function publishTypingIndicator(
  matchId: string,
  userId: string,
  isTyping: boolean
): Promise<void> {
  const supabase = getSupabaseClient();

  if (isTyping) {
    // Insert typing indicator
    const { error } = await supabase
      .from('verified_vibe_typing_indicators')
      .insert({
        match_id: matchId,
        user_id: userId,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error publishing typing indicator:', error);
      throw error;
    }
  } else {
    // Delete typing indicator
    const { error } = await supabase
      .from('verified_vibe_typing_indicators')
      .delete()
      .eq('match_id', matchId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error clearing typing indicator:', error);
      throw error;
    }
  }
}

/**
 * Check connection status
 */
export function getConnectionStatus(): 'connected' | 'disconnected' {
  const supabase = getSupabaseClient();
  const state = supabase.getChannels();
  return state.length > 0 ? 'connected' : 'disconnected';
}
