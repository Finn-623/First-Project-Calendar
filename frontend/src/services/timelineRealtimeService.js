import { supabase } from '../lib/supabaseClient';

export const TIMELINE_BROADCAST_CHANNEL = 'first-project-calendar-timeline';

const createSourceId = () => `timeline-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const createTimelineRealtimeService = ({
  client = supabase,
  BroadcastChannelImpl = typeof BroadcastChannel === 'function' ? BroadcastChannel : null,
} = {}) => {
  const sourceId = createSourceId();
  let activeUserId = null;
  let realtimeChannel = null;
  let broadcastChannel = null;
  let listener = null;
  let generation = 0;

  const emit = (message) => {
    if (!listener || !activeUserId || message?.user_id !== activeUserId) return;
    if (message?.source_id === sourceId) return;
    listener(message);
  };

  const cleanup = async () => {
    listener = null;
    activeUserId = null;
    if (broadcastChannel) {
      broadcastChannel.close();
      broadcastChannel = null;
    }
    if (realtimeChannel && client) {
      const channel = realtimeChannel;
      realtimeChannel = null;
      await client.removeChannel(channel);
    }
  };

  const stop = async () => {
    generation += 1;
    await cleanup();
  };

  const start = async ({ userId, onInvalidate }) => {
    if (!userId || typeof onInvalidate !== 'function' || !client) return stop;
    if (activeUserId === userId && listener === onInvalidate && realtimeChannel) return stop;

    const startGeneration = ++generation;
    await cleanup();
    if (startGeneration !== generation) return stop;
    activeUserId = userId;
    listener = onInvalidate;

    if (BroadcastChannelImpl) {
      broadcastChannel = new BroadcastChannelImpl(TIMELINE_BROADCAST_CHANNEL);
      broadcastChannel.onmessage = (event) => emit(event?.data);
    }

    if (typeof client.channel !== 'function') return stop;

    realtimeChannel = client
      .channel(`timeline-sync:${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'timeline_items', filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const row = payload.new || payload.old || {};
        emit({
          type: `meal_${String(payload.eventType || '').toLowerCase()}`,
          user_id: row.user_id,
          record_date: row.event_date || null,
          entity_id: row.id,
          updated_at: row.updated_at || null,
          source_id: 'supabase-realtime',
        });
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'food_entries', filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const row = payload.new || payload.old || {};
        emit({
          type: `food_entry_${String(payload.eventType || '').toLowerCase()}`,
          user_id: row.user_id,
          record_date: null,
          entity_id: row.id,
          meal_id: row.timeline_item_id || null,
          updated_at: row.updated_at || null,
          source_id: 'supabase-realtime',
        });
      })
      .subscribe();

    return stop;
  };

  const broadcast = (message) => {
    if (!broadcastChannel || !activeUserId || message?.user_id !== activeUserId) return;
    broadcastChannel.postMessage({ ...message, source_id: sourceId });
  };

  return { start, stop, broadcast, getSourceId: () => sourceId };
};

export const timelineRealtimeService = createTimelineRealtimeService();
