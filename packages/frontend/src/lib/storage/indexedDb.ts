// ============================================================================
// INDEXED DB STORAGE - Finance Hub
// Offline storage for drafts and pending operations
// ============================================================================

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// ----------------------------------------------------------------------------
// Schema
// ----------------------------------------------------------------------------

interface HubComptaDB extends DBSchema {
  // Draft transactions waiting to be synced
  draftTransactions: {
    key: string;
    value: DraftTransaction;
    indexes: {
      'by-workspace': string;
      'by-created': number;
    };
  };
  // Pending operations (for background sync)
  pendingOperations: {
    key: string;
    value: PendingOperation;
    indexes: {
      'by-type': string;
      'by-created': number;
    };
  };
  // Cached data for offline access
  cachedData: {
    key: string;
    value: CachedItem;
    indexes: {
      'by-type': string;
      'by-expires': number;
    };
  };
  // User preferences (synced from server)
  preferences: {
    key: string;
    value: PreferenceItem;
  };
}

interface PreferenceItem {
  key: string;
  value: unknown;
}

interface DraftTransaction {
  id: string;
  workspaceId: string;
  accountId: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  description: string;
  categoryId?: string;
  date: string;
  tags?: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'transaction' | 'category' | 'tag';
  data: unknown;
  createdAt: number;
  retries: number;
  lastError?: string;
}

interface CachedItem {
  key: string;
  type: string;
  data: unknown;
  expiresAt: number;
  createdAt: number;
}

// ----------------------------------------------------------------------------
// Database Instance
// ----------------------------------------------------------------------------

const DB_NAME = 'hubcompta';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<HubComptaDB> | null = null;

async function getDB(): Promise<IDBPDatabase<HubComptaDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<HubComptaDB>(DB_NAME, DB_VERSION, {
    upgrade(db, _oldVersion, _newVersion, _transaction) {
      // Draft transactions store
      if (!db.objectStoreNames.contains('draftTransactions')) {
        const draftStore = db.createObjectStore('draftTransactions', {
          keyPath: 'id',
        });
        draftStore.createIndex('by-workspace', 'workspaceId');
        draftStore.createIndex('by-created', 'createdAt');
      }

      // Pending operations store
      if (!db.objectStoreNames.contains('pendingOperations')) {
        const pendingStore = db.createObjectStore('pendingOperations', {
          keyPath: 'id',
        });
        pendingStore.createIndex('by-type', 'type');
        pendingStore.createIndex('by-created', 'createdAt');
      }

      // Cached data store
      if (!db.objectStoreNames.contains('cachedData')) {
        const cacheStore = db.createObjectStore('cachedData', {
          keyPath: 'key',
        });
        cacheStore.createIndex('by-type', 'type');
        cacheStore.createIndex('by-expires', 'expiresAt');
      }

      // Preferences store
      if (!db.objectStoreNames.contains('preferences')) {
        db.createObjectStore('preferences', { keyPath: 'key' });
      }
    },
    blocked() {
      console.warn('[IndexedDB] Database blocked by another version');
    },
    blocking() {
      console.warn('[IndexedDB] Blocking another database version');
      dbInstance?.close();
      dbInstance = null;
    },
    terminated() {
      console.warn('[IndexedDB] Database terminated unexpectedly');
      dbInstance = null;
    },
  });

  return dbInstance;
}

// ----------------------------------------------------------------------------
// Draft Transactions
// ----------------------------------------------------------------------------

export const draftTransactions = {
  async create(draft: Omit<DraftTransaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const db = await getDB();
    const id = crypto.randomUUID();
    const now = Date.now();

    const transaction: DraftTransaction = {
      ...draft,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await db.put('draftTransactions', transaction);
    return id;
  },

  async update(id: string, updates: Partial<DraftTransaction>): Promise<void> {
    const db = await getDB();
    const existing = await db.get('draftTransactions', id);

    if (!existing) {
      throw new Error('Draft not found');
    }

    await db.put('draftTransactions', {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    });
  },

  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('draftTransactions', id);
  },

  async get(id: string): Promise<DraftTransaction | undefined> {
    const db = await getDB();
    return db.get('draftTransactions', id);
  },

  async getByWorkspace(workspaceId: string): Promise<DraftTransaction[]> {
    const db = await getDB();
    return db.getAllFromIndex('draftTransactions', 'by-workspace', workspaceId);
  },

  async getAll(): Promise<DraftTransaction[]> {
    const db = await getDB();
    return db.getAll('draftTransactions');
  },

  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear('draftTransactions');
  },
};

// ----------------------------------------------------------------------------
// Pending Operations
// ----------------------------------------------------------------------------

export const pendingOperations = {
  async add(operation: Omit<PendingOperation, 'id' | 'createdAt' | 'retries'>): Promise<string> {
    const db = await getDB();
    const id = crypto.randomUUID();

    await db.put('pendingOperations', {
      ...operation,
      id,
      createdAt: Date.now(),
      retries: 0,
    });

    return id;
  },

  async markRetry(id: string, error?: string): Promise<void> {
    const db = await getDB();
    const existing = await db.get('pendingOperations', id);

    if (existing) {
      const updated: PendingOperation = {
        ...existing,
        retries: existing.retries + 1,
      };
      if (error !== undefined) {
        updated.lastError = error;
      }
      await db.put('pendingOperations', updated);
    }
  },

  async remove(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('pendingOperations', id);
  },

  async getAll(): Promise<PendingOperation[]> {
    const db = await getDB();
    return db.getAll('pendingOperations');
  },

  async getByType(type: PendingOperation['type']): Promise<PendingOperation[]> {
    const db = await getDB();
    return db.getAllFromIndex('pendingOperations', 'by-type', type);
  },

  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear('pendingOperations');
  },

  async count(): Promise<number> {
    const db = await getDB();
    return db.count('pendingOperations');
  },
};

// ----------------------------------------------------------------------------
// Cache
// ----------------------------------------------------------------------------

export const cache = {
  async set(key: string, type: string, data: unknown, ttlMs: number): Promise<void> {
    const db = await getDB();
    const now = Date.now();

    await db.put('cachedData', {
      key,
      type,
      data,
      expiresAt: now + ttlMs,
      createdAt: now,
    });
  },

  async get<T>(key: string): Promise<T | null> {
    const db = await getDB();
    const item = await db.get('cachedData', key);

    if (!item) {
      return null;
    }

    // Check if expired
    if (item.expiresAt < Date.now()) {
      await db.delete('cachedData', key);
      return null;
    }

    return item.data as T;
  },

  async delete(key: string): Promise<void> {
    const db = await getDB();
    await db.delete('cachedData', key);
  },

  async deleteByType(type: string): Promise<void> {
    const db = await getDB();
    const items = await db.getAllFromIndex('cachedData', 'by-type', type);

    const tx = db.transaction('cachedData', 'readwrite');
    await Promise.all([
      ...items.map((item) => tx.store.delete(item.key)),
      tx.done,
    ]);
  },

  async cleanup(): Promise<number> {
    const db = await getDB();
    const now = Date.now();
    const expired = await db.getAllFromIndex('cachedData', 'by-expires');
    const toDelete = expired.filter((item) => item.expiresAt < now);

    const tx = db.transaction('cachedData', 'readwrite');
    await Promise.all([
      ...toDelete.map((item) => tx.store.delete(item.key)),
      tx.done,
    ]);

    return toDelete.length;
  },

  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear('cachedData');
  },
};

// ----------------------------------------------------------------------------
// Preferences
// ----------------------------------------------------------------------------

export const preferences = {
  async set(key: string, value: unknown): Promise<void> {
    const db = await getDB();
    await db.put('preferences', { key, value });
  },

  async get<T>(key: string): Promise<T | null> {
    const db = await getDB();
    const item = await db.get('preferences', key);
    return item ? (item.value as T) : null;
  },

  async delete(key: string): Promise<void> {
    const db = await getDB();
    await db.delete('preferences', key);
  },

  async getAll(): Promise<Record<string, unknown>> {
    const db = await getDB();
    const items = await db.getAll('preferences');
    return items.reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {} as Record<string, unknown>);
  },

  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear('preferences');
  },
};

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear('draftTransactions'),
    db.clear('pendingOperations'),
    db.clear('cachedData'),
    db.clear('preferences'),
  ]);
}

export async function getDatabaseSize(): Promise<{ usage: number; quota: number }> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
  return { usage: 0, quota: 0 };
}

export async function isStoragePersisted(): Promise<boolean> {
  if ('storage' in navigator && 'persisted' in navigator.storage) {
    return navigator.storage.persisted();
  }
  return false;
}

export async function requestPersistentStorage(): Promise<boolean> {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    return navigator.storage.persist();
  }
  return false;
}

// Export database types
export type { DraftTransaction, PendingOperation, CachedItem };
