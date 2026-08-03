const DB_NAME = 'first-project-calendar-timeline-cache';
const DB_VERSION = 1;
const SNAPSHOT_STORE = 'timeline_snapshots';
const META_STORE = 'timeline_meta';
export const TIMELINE_CACHE_SCHEMA_VERSION = 1;

const memorySnapshots = new Map();
const memoryMeta = new Map();

const projectScope = (() => {
  try {
    return new URL(process.env.REACT_APP_SUPABASE_URL || window.location.origin).host;
  } catch {
    return 'local';
  }
})();

const snapshotKey = (userId, dateStr) => `${projectScope}:${userId}:${dateStr}`;
const metaKey = (userId) => `${projectScope}:${userId}`;

const openDatabase = () => new Promise((resolve, reject) => {
  if (typeof indexedDB === 'undefined') {
    resolve(null);
    return;
  }

  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'key' });
    if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('时间线缓存打开失败'));
});

const runRequest = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result || null);
  request.onerror = () => reject(request.error || new Error('时间线缓存操作失败'));
});

const isValidSnapshot = (snapshot, userId, dateStr) => Boolean(
  snapshot
  && snapshot.schemaVersion === TIMELINE_CACHE_SCHEMA_VERSION
  && snapshot.userId === userId
  && snapshot.recordDate === dateStr
  && Array.isArray(snapshot.timeline)
);

const getRecord = async (storeName, key, memoryStore) => {
  const db = await openDatabase();
  if (!db) return memoryStore.get(key) || null;
  try {
    return await runRequest(db.transaction(storeName, 'readonly').objectStore(storeName).get(key));
  } finally {
    db.close();
  }
};

const putRecord = async (storeName, record, memoryStore) => {
  const db = await openDatabase();
  if (!db) {
    memoryStore.set(record.key, record);
    return;
  }
  try {
    await runRequest(db.transaction(storeName, 'readwrite').objectStore(storeName).put(record));
  } finally {
    db.close();
  }
};

export const timelineCacheService = {
  async getSnapshot(userId, dateStr) {
    if (!userId || !dateStr) return null;
    try {
      const snapshot = await getRecord(SNAPSHOT_STORE, snapshotKey(userId, dateStr), memorySnapshots);
      return isValidSnapshot(snapshot, userId, dateStr) ? snapshot : null;
    } catch {
      return null;
    }
  },

  async getActiveSnapshot(userId) {
    if (!userId) return null;
    try {
      const meta = await getRecord(META_STORE, metaKey(userId), memoryMeta);
      if (!meta?.recordDate) return null;
      return this.getSnapshot(userId, meta.recordDate);
    } catch {
      return null;
    }
  },

  async putSnapshot(userId, dateStr, timeline, options = {}) {
    if (!userId || !dateStr || !Array.isArray(timeline)) return;
    const cachedAt = new Date().toISOString();
    const snapshot = {
      key: snapshotKey(userId, dateStr),
      projectScope,
      userId,
      recordDate: dateStr,
      timeline,
      pendingDeleteEntryIds: Array.from(options.pendingDeleteEntryIds || []),
      cachedAt,
      schemaVersion: TIMELINE_CACHE_SCHEMA_VERSION,
    };
    try {
      await Promise.all([
        putRecord(SNAPSHOT_STORE, snapshot, memorySnapshots),
        putRecord(META_STORE, { key: metaKey(userId), userId, recordDate: dateStr, cachedAt }, memoryMeta),
      ]);
    } catch {
      // Cache failures must never block the Supabase data path.
    }
  },

  async removeSnapshot(userId, dateStr) {
    if (!userId || !dateStr) return;
    const key = snapshotKey(userId, dateStr);
    memorySnapshots.delete(key);
    try {
      const db = await openDatabase();
      if (!db) return;
      await runRequest(db.transaction(SNAPSHOT_STORE, 'readwrite').objectStore(SNAPSHOT_STORE).delete(key));
      db.close();
    } catch {
      // A stale cache is ignored after the next successful remote calibration.
    }
  },

  __resetMemoryForTests() {
    memorySnapshots.clear();
    memoryMeta.clear();
  },
};
