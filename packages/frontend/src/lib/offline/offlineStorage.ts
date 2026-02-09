// ============================================================================
// OFFLINE STORAGE - HubCompta
// Cache transactions, accounts, and categories for offline access
// ============================================================================

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface CachedTransaction {
  id: string;
  workspaceId: string;
  accountId: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  currency: string;
  description: string;
  categoryId?: string;
  date: string;
  tags?: string[];
  notes?: string;
  isReconciled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CachedAccount {
  id: string;
  workspaceId: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'loan' | 'other';
  currency: string;
  balance: number;
  icon?: string;
  color?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CachedCategory {
  id: string;
  workspaceId: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
  parentId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// Database Schema
// ----------------------------------------------------------------------------

interface OfflineCacheDB extends DBSchema {
  transactions: {
    key: string;
    value: CachedTransaction;
    indexes: {
      'by-workspace': string;
      'by-account': string;
      'by-date': string;
      'by-category': string;
    };
  };
  accounts: {
    key: string;
    value: CachedAccount;
    indexes: {
      'by-workspace': string;
    };
  };
  categories: {
    key: string;
    value: CachedCategory;
    indexes: {
      'by-workspace': string;
      'by-type': string;
    };
  };
  metadata: {
    key: string;
    value: {
      key: string;
      value: unknown;
      updatedAt: number;
    };
  };
}

// ----------------------------------------------------------------------------
// Database Instance
// ----------------------------------------------------------------------------

const DB_NAME = 'hubcompta-offline-cache';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<OfflineCacheDB> | null = null;

async function getDB(): Promise<IDBPDatabase<OfflineCacheDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<OfflineCacheDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Transactions store
      if (!db.objectStoreNames.contains('transactions')) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
        txStore.createIndex('by-workspace', 'workspaceId');
        txStore.createIndex('by-account', 'accountId');
        txStore.createIndex('by-date', 'date');
        txStore.createIndex('by-category', 'categoryId');
      }

      // Accounts store
      if (!db.objectStoreNames.contains('accounts')) {
        const accountStore = db.createObjectStore('accounts', { keyPath: 'id' });
        accountStore.createIndex('by-workspace', 'workspaceId');
      }

      // Categories store
      if (!db.objectStoreNames.contains('categories')) {
        const categoryStore = db.createObjectStore('categories', { keyPath: 'id' });
        categoryStore.createIndex('by-workspace', 'workspaceId');
        categoryStore.createIndex('by-type', 'type');
      }

      // Metadata store
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    },
    blocked() {
      console.warn('[OfflineCache] Database blocked by another version');
    },
    blocking() {
      console.warn('[OfflineCache] Blocking another database version');
      dbInstance?.close();
      dbInstance = null;
    },
    terminated() {
      console.warn('[OfflineCache] Database terminated unexpectedly');
      dbInstance = null;
    },
  });

  return dbInstance;
}

// ----------------------------------------------------------------------------
// Transactions Cache
// ----------------------------------------------------------------------------

export const transactionCache = {
  async cacheMany(transactions: CachedTransaction[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('transactions', 'readwrite');
    await Promise.all([
      ...transactions.map((t) => tx.store.put(t)),
      tx.done,
    ]);
    await this.updateLastSync('transactions');
  },

  async cache(transaction: CachedTransaction): Promise<void> {
    const db = await getDB();
    await db.put('transactions', transaction);
  },

  async get(id: string): Promise<CachedTransaction | undefined> {
    const db = await getDB();
    return db.get('transactions', id);
  },

  async getByWorkspace(workspaceId: string): Promise<CachedTransaction[]> {
    const db = await getDB();
    return db.getAllFromIndex('transactions', 'by-workspace', workspaceId);
  },

  async getByAccount(accountId: string): Promise<CachedTransaction[]> {
    const db = await getDB();
    return db.getAllFromIndex('transactions', 'by-account', accountId);
  },

  async getByDateRange(
    workspaceId: string,
    startDate: string,
    endDate: string
  ): Promise<CachedTransaction[]> {
    const db = await getDB();
    const all = await db.getAllFromIndex('transactions', 'by-workspace', workspaceId);
    return all.filter((t) => t.date >= startDate && t.date <= endDate);
  },

  async getRecent(workspaceId: string, limit = 50): Promise<CachedTransaction[]> {
    const db = await getDB();
    const all = await db.getAllFromIndex('transactions', 'by-workspace', workspaceId);
    return all
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  },

  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('transactions', id);
  },

  async clearWorkspace(workspaceId: string): Promise<void> {
    const db = await getDB();
    const transactions = await db.getAllFromIndex('transactions', 'by-workspace', workspaceId);
    const tx = db.transaction('transactions', 'readwrite');
    await Promise.all([
      ...transactions.map((t) => tx.store.delete(t.id)),
      tx.done,
    ]);
  },

  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear('transactions');
  },

  async updateLastSync(key: string): Promise<void> {
    const db = await getDB();
    await db.put('metadata', {
      key: `lastSync:${key}`,
      value: Date.now(),
      updatedAt: Date.now(),
    });
  },

  async getLastSync(): Promise<number | null> {
    const db = await getDB();
    const meta = await db.get('metadata', 'lastSync:transactions');
    return meta ? (meta.value as number) : null;
  },
};

// ----------------------------------------------------------------------------
// Accounts Cache
// ----------------------------------------------------------------------------

export const accountCache = {
  async cacheMany(accounts: CachedAccount[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('accounts', 'readwrite');
    await Promise.all([
      ...accounts.map((a) => tx.store.put(a)),
      tx.done,
    ]);
    await this.updateLastSync();
  },

  async cache(account: CachedAccount): Promise<void> {
    const db = await getDB();
    await db.put('accounts', account);
  },

  async get(id: string): Promise<CachedAccount | undefined> {
    const db = await getDB();
    return db.get('accounts', id);
  },

  async getByWorkspace(workspaceId: string): Promise<CachedAccount[]> {
    const db = await getDB();
    return db.getAllFromIndex('accounts', 'by-workspace', workspaceId);
  },

  async getActive(workspaceId: string): Promise<CachedAccount[]> {
    const db = await getDB();
    const all = await db.getAllFromIndex('accounts', 'by-workspace', workspaceId);
    return all.filter((a) => a.isActive);
  },

  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('accounts', id);
  },

  async clearWorkspace(workspaceId: string): Promise<void> {
    const db = await getDB();
    const accounts = await db.getAllFromIndex('accounts', 'by-workspace', workspaceId);
    const tx = db.transaction('accounts', 'readwrite');
    await Promise.all([
      ...accounts.map((a) => tx.store.delete(a.id)),
      tx.done,
    ]);
  },

  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear('accounts');
  },

  async updateLastSync(): Promise<void> {
    const db = await getDB();
    await db.put('metadata', {
      key: 'lastSync:accounts',
      value: Date.now(),
      updatedAt: Date.now(),
    });
  },

  async getLastSync(): Promise<number | null> {
    const db = await getDB();
    const meta = await db.get('metadata', 'lastSync:accounts');
    return meta ? (meta.value as number) : null;
  },
};

// ----------------------------------------------------------------------------
// Categories Cache
// ----------------------------------------------------------------------------

export const categoryCache = {
  async cacheMany(categories: CachedCategory[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('categories', 'readwrite');
    await Promise.all([
      ...categories.map((c) => tx.store.put(c)),
      tx.done,
    ]);
    await this.updateLastSync();
  },

  async cache(category: CachedCategory): Promise<void> {
    const db = await getDB();
    await db.put('categories', category);
  },

  async get(id: string): Promise<CachedCategory | undefined> {
    const db = await getDB();
    return db.get('categories', id);
  },

  async getByWorkspace(workspaceId: string): Promise<CachedCategory[]> {
    const db = await getDB();
    return db.getAllFromIndex('categories', 'by-workspace', workspaceId);
  },

  async getByType(
    workspaceId: string,
    type: 'income' | 'expense'
  ): Promise<CachedCategory[]> {
    const db = await getDB();
    const all = await db.getAllFromIndex('categories', 'by-workspace', workspaceId);
    return all.filter((c) => c.type === type && c.isActive);
  },

  async getActive(workspaceId: string): Promise<CachedCategory[]> {
    const db = await getDB();
    const all = await db.getAllFromIndex('categories', 'by-workspace', workspaceId);
    return all.filter((c) => c.isActive);
  },

  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('categories', id);
  },

  async clearWorkspace(workspaceId: string): Promise<void> {
    const db = await getDB();
    const categories = await db.getAllFromIndex('categories', 'by-workspace', workspaceId);
    const tx = db.transaction('categories', 'readwrite');
    await Promise.all([
      ...categories.map((c) => tx.store.delete(c.id)),
      tx.done,
    ]);
  },

  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear('categories');
  },

  async updateLastSync(): Promise<void> {
    const db = await getDB();
    await db.put('metadata', {
      key: 'lastSync:categories',
      value: Date.now(),
      updatedAt: Date.now(),
    });
  },

  async getLastSync(): Promise<number | null> {
    const db = await getDB();
    const meta = await db.get('metadata', 'lastSync:categories');
    return meta ? (meta.value as number) : null;
  },
};

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------

export async function clearAllOfflineData(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear('transactions'),
    db.clear('accounts'),
    db.clear('categories'),
    db.clear('metadata'),
  ]);
}

export async function clearWorkspaceOfflineData(workspaceId: string): Promise<void> {
  await Promise.all([
    transactionCache.clearWorkspace(workspaceId),
    accountCache.clearWorkspace(workspaceId),
    categoryCache.clearWorkspace(workspaceId),
  ]);
}

export async function getOfflineDataStats(): Promise<{
  transactions: number;
  accounts: number;
  categories: number;
  lastSync: {
    transactions: number | null;
    accounts: number | null;
    categories: number | null;
  };
}> {
  const db = await getDB();
  const [transactionCount, accountCount, categoryCount] = await Promise.all([
    db.count('transactions'),
    db.count('accounts'),
    db.count('categories'),
  ]);

  const [txSync, accSync, catSync] = await Promise.all([
    transactionCache.getLastSync(),
    accountCache.getLastSync(),
    categoryCache.getLastSync(),
  ]);

  return {
    transactions: transactionCount,
    accounts: accountCount,
    categories: categoryCount,
    lastSync: {
      transactions: txSync,
      accounts: accSync,
      categories: catSync,
    },
  };
}

export async function isDataStale(maxAgeMs: number = 60 * 60 * 1000): Promise<boolean> {
  const stats = await getOfflineDataStats();
  const now = Date.now();

  const syncs = [
    stats.lastSync.transactions,
    stats.lastSync.accounts,
    stats.lastSync.categories,
  ].filter((s): s is number => s !== null);

  if (syncs.length === 0) {
    return true; // No sync data means it's stale
  }

  const oldestSync = Math.min(...syncs);
  return now - oldestSync > maxAgeMs;
}
