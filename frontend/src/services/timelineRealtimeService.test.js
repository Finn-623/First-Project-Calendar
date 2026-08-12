import { createTimelineRealtimeService, TIMELINE_BROADCAST_CHANNEL } from './timelineRealtimeService';

const channels = [];
class FakeBroadcastChannel {
  constructor(name) {
    this.name = name;
    this.onmessage = null;
    channels.push(this);
  }

  postMessage(message) {
    channels.filter((channel) => channel !== this && channel.name === this.name)
      .forEach((channel) => channel.onmessage?.({ data: message }));
  }

  close() {
    channels.splice(channels.indexOf(this), 1);
  }
}

const createSupabaseMock = () => {
  const handlers = [];
  const channel = {
    on: jest.fn((_, config, handler) => {
      handlers.push({ config, handler });
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  return {
    handlers,
    channel,
    client: {
      channel: jest.fn(() => channel),
      removeChannel: jest.fn().mockResolvedValue('ok'),
    },
  };
};

describe('timelineRealtimeService', () => {
  beforeEach(() => channels.splice(0));

  test('subscribes once to timeline and food changes with the current user filter', async () => {
    const mock = createSupabaseMock();
    const service = createTimelineRealtimeService({ client: mock.client, BroadcastChannelImpl: FakeBroadcastChannel });
    const listener = jest.fn();
    await service.start({ userId: 'user-a', onInvalidate: listener });

    expect(mock.client.channel).toHaveBeenCalledTimes(1);
    expect(mock.channel.on).toHaveBeenCalledTimes(3);
    expect(mock.handlers.map(({ config }) => config)).toEqual([
      expect.objectContaining({ table: 'timeline_items', filter: 'user_id=eq.user-a' }),
      expect.objectContaining({ table: 'food_entries', filter: 'user_id=eq.user-a' }),
      expect.objectContaining({ table: 'daily_archives', filter: 'user_id=eq.user-a' }),
    ]);

    mock.handlers[0].handler({
      eventType: 'UPDATE',
      new: { id: 'meal-1', user_id: 'user-a', event_date: '2026-08-03', updated_at: '2026-08-03T01:00:00Z' },
    });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'meal_update', entity_id: 'meal-1' }));
  });

  test('BroadcastChannel synchronizes another tab, ignores another user and does not echo to sender', async () => {
    const firstMock = createSupabaseMock();
    const secondMock = createSupabaseMock();
    const first = createTimelineRealtimeService({ client: firstMock.client, BroadcastChannelImpl: FakeBroadcastChannel });
    const second = createTimelineRealtimeService({ client: secondMock.client, BroadcastChannelImpl: FakeBroadcastChannel });
    const firstListener = jest.fn();
    const secondListener = jest.fn();
    await first.start({ userId: 'user-a', onInvalidate: firstListener });
    await second.start({ userId: 'user-a', onInvalidate: secondListener });

    first.broadcast({
      type: 'food_entry_created', user_id: 'user-a', record_date: '2026-08-03', entity_id: 'entry-1', operation_id: 'op-1',
    });
    expect(firstListener).not.toHaveBeenCalled();
    expect(secondListener).toHaveBeenCalledTimes(1);

    first.broadcast({ type: 'food_entry_created', user_id: 'user-b', entity_id: 'entry-2', operation_id: 'op-2' });
    expect(secondListener).toHaveBeenCalledTimes(1);
    expect(channels.every((channel) => channel.name === TIMELINE_BROADCAST_CHANNEL)).toBe(true);
  });

  test('user switch and logout remove the previous realtime channel', async () => {
    const mock = createSupabaseMock();
    const service = createTimelineRealtimeService({ client: mock.client, BroadcastChannelImpl: FakeBroadcastChannel });
    await service.start({ userId: 'user-a', onInvalidate: jest.fn() });
    await service.start({ userId: 'user-b', onInvalidate: jest.fn() });
    expect(mock.client.removeChannel).toHaveBeenCalledTimes(1);
    await service.stop();
    expect(mock.client.removeChannel).toHaveBeenCalledTimes(2);
  });
});
