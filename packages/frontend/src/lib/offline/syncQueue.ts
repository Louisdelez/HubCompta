// ============================================================================
// SYNC QUEUE - HubCompta
// Queue failed mutations when offline and sync when back online
// ============================================================================

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type MutationType =
  | 'transaction:create'
  | 'transaction:update'
  | 'transaction:delete'
  | 'account:create'
  | 'account:update'
  | 'account:delete'
  | 'category:create'
  | 'category:update'
  | 'category:delete';

export interface QueuedMutation {
  id: string;
  type: MutationType;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  workspaceId: string;
  createdAt: number;
  retries: number;
  lastError?: string;
  lastRetryAt?: number;
}

export interface SyncResult {
  success: boolean;
  mutationId: string;
  error?: string;
}

type SyncStatusCallback = (status: SyncStatus) => void;

export interface SyncStatus {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  lastError: string | null;
}

// ----------------------------------------------------------------------------
// Database Schema
// ----------------------------------------------------------------------------

interface SyncQueueDB extends DBSchema {
  mutations: {
    key: string;
    value: QueuedMutation;
    indexes: {
      'by-type': string;
      'by-workspace': string;
      'by-created': number;
    };
  };
  syncMeta: {
    key: string;
    value: {
      key: string;
      value: unknown;
    };
  };
}

// ----------------------------------------------------------------------------
// Database Instance
// ----------------------------------------------------------------------------

const DB_NAME = 'hubcompta-sync-queue';
const DB_VERSION = 1;
const MAX_RETRIES = 5;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

let dbInstance: IDBPDatabase<SyncQueueDB> | null = null;

async function getDB(): Promise<IDBPDatabase<SyncQueueDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<SyncQueueDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('mutations')) {
        const store = db.createObjectStore('mutations', { keyPath: 'id' });
        store.createIndex('by-type', 'type');
        store.createIndex('by-workspace', 'workspaceId');
        store.createIndex('by-created', 'createdAt');
      }

      if (!db.objectStoreNames.contains('syncMeta')) {
        db.createObjectStore('syncMeta', { keyPath: 'key' });
      }
    },
    blocked() {
      console.warn('[SyncQueue] Database blocked by another version');
    },
    blocking() {
      console.warn('[SyncQueue] Blocking another database version');
      dbInstance?.close();
      dbInstance = null;
    },
    terminated() {
      console.warn('[SyncQueue] Database terminated unexpectedly');
      dbInstance = null;
    },
  });

  return dbInstance;
}

// ----------------------------------------------------------------------------
// Sync Queue Manager
// ----------------------------------------------------------------------------

class SyncQueueManager {
  private listeners: Set<SyncStatusCallback> = new Set();
  private isSyncing = false;
  private syncPromise: Promise<SyncResult[]> | null = null;

  /**
   * Add a mutation to the queue
   */
  async add(mutation: Omit<QueuedMutation, 'id' | 'createdAt' | 'retries'>): Promise<string> {
    const db = await getDB();
    const id = crypto.randomUUID();

    const queuedMutation: QueuedMutation = {
      ...mutation,
      id,
      createdAt: Date.now(),
      retries: 0,
    };

    await db.put('mutations', queuedMutation);
    this.notifyListeners();

    // If we're online, try to sync immediately
    if (navigator.onLine && !this.isSyncing) {
      void this.sync();
    }

    return id;
  }

  /**
   * Get all pending mutations
   */
  async getPending(): Promise<QueuedMutation[]> {
    const db = await getDB();
    return db.getAll('mutations');
  }

  /**
   * Get pending mutations by workspace
   */
  async getPendingByWorkspace(workspaceId: string): Promise<QueuedMutation[]> {
    const db = await getDB();
    return db.getAllFromIndex('mutations', 'by-workspace', workspaceId);
  }

  /**
   * Get the count of pending mutations
   */
  async getPendingCount(): Promise<number> {
    const db = await getDB();
    return db.count('mutations');
  }

  /**
   * Remove a mutation from the queue
   */
  async remove(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('mutations', id);
    this.notifyListeners();
  }

  /**
   * Clear all mutations for a workspace
   */
  async clearWorkspace(workspaceId: string): Promise<void> {
    const db = await getDB();
    const mutations = await db.getAllFromIndex('mutations', 'by-workspace', workspaceId);
    const tx = db.transaction('mutations', 'readwrite');
    await Promise.all([
      ...mutations.map((m) => tx.store.delete(m.id)),
      tx.done,
    ]);
    this.notifyListeners();
  }

  /**
   * Clear all mutations
   */
  async clearAll(): Promise<void> {
    const db = await getDB();
    await db.clear('mutations');
    this.notifyListeners();
  }

  /**
   * Sync all pending mutations with the server
   */
  async sync(): Promise<SyncResult[]> {
    // If already syncing, return the existing promise
    if (this.syncPromise) {
      return this.syncPromise;
    }

    if (!navigator.onLine) {
      return [];
    }

    this.isSyncing = true;
    this.notifyListeners();

    this.syncPromise = this.performSync();
    const results = await this.syncPromise;

    this.syncPromise = null;
    this.isSyncing = false;
    await this.setLastSyncTime(Date.now());
    this.notifyListeners();

    return results;
  }

  private async performSync(): Promise<SyncResult[]> {
    const db = await getDB();
    const mutations = await db.getAllFromIndex('mutations', 'by-created');
    const results: SyncResult[] = [];

    for (const mutation of mutations) {
      if (!navigator.onLine) {
        // Stop syncing if we went offline
        break;
      }

      try {
        const fetchOptions: RequestInit = {
          method: mutation.method,
          headers: {
            'Content-Type': 'application/json',
            ...mutation.headers,
          },
          credentials: 'include',
        };

        if (mutation.body) {
          fetchOptions.body = JSON.stringify(mutation.body);
        }

        const response = await fetch(mutation.url, fetchOptions);

        if (response.ok) {
          // Success - remove from queue
          await this.remove(mutation.id);
          results.push({ success: true, mutationId: mutation.id });
        } else if (response.status >= 400 && response.status < 500) {
          // Client error - remove from queue (don't retry)
          const errorText = await response.text();
          await this.remove(mutation.id);
          results.push({
            success: false,
            mutationId: mutation.id,
            error: `${response.status}: ${errorText}`,
          });
        } else {
          // Server error - increment retry count
          await this.incrementRetry(mutation.id, `${response.status}: ${response.statusText}`);
          results.push({
            success: false,
            mutationId: mutation.id,
            error: `${response.status}: ${response.statusText}`,
          });
        }
      } catch (error) {
        // Network error - increment retry count
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await this.incrementRetry(mutation.id, errorMessage);
        results.push({
          success: false,
          mutationId: mutation.id,
          error: errorMessage,
        });
      }
    }

    return results;
  }

  private async incrementRetry(id: string, error: string): Promise<void> {
    const db = await getDB();
    const mutation = await db.get('mutations', id);

    if (!mutation) {
      return;
    }

    if (mutation.retries >= MAX_RETRIES) {
      // Too many retries - remove from queue
      console.error(`[SyncQueue] Mutation ${id} failed after ${MAX_RETRIES} retries:`, error);
      await this.remove(id);
      return;
    }

    await db.put('mutations', {
      ...mutation,
      retries: mutation.retries + 1,
      lastError: error,
      lastRetryAt: Date.now(),
    });
  }

  /**
   * Get the current sync status
   */
  async getStatus(): Promise<SyncStatus> {
    const [pendingCount, lastSyncAt] = await Promise.all([
      this.getPendingCount(),
      this.getLastSyncTime(),
    ]);

    const pending = await this.getPending();
    const lastError = pending.length > 0
      ? pending.find((m) => m.lastError)?.lastError ?? null
      : null;

    return {
      isSyncing: this.isSyncing,
      pendingCount,
      lastSyncAt,
      lastError,
    };
  }

  private async getLastSyncTime(): Promise<number | null> {
    const db = await getDB();
    const meta = await db.get('syncMeta', 'lastSyncAt');
    return meta ? (meta.value as number) : null;
  }

  private async setLastSyncTime(time: number): Promise<void> {
    const db = await getDB();
    await db.put('syncMeta', { key: 'lastSyncAt', value: time });
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(callback: SyncStatusCallback): () => void {
    this.listeners.add(callback);

    // Immediately notify with current status
    void this.getStatus().then(callback);

    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    void this.getStatus().then((status) => {
      this.listeners.forEach((callback) => callback(status));
    });
  }

  /**
   * Schedule sync with exponential backoff
   */
  scheduleSync(attempt = 0): void {
    if (!navigator.onLine || this.isSyncing) {
      return;
    }

    const delay = Math.min(RETRY_DELAY_BASE * Math.pow(2, attempt), 30000); // Max 30 seconds
    setTimeout(() => {
      if (navigator.onLine && !this.isSyncing) {
        void this.sync();
      }
    }, delay);
  }
}

// ----------------------------------------------------------------------------
// Singleton Export
// ----------------------------------------------------------------------------

export const syncQueue = new SyncQueueManager();

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Queue a transaction creation for offline sync
 */
export async function queueTransactionCreate(
  workspaceId: string,
  data: unknown
): Promise<string> {
  return syncQueue.add({
    type: 'transaction:create',
    url: `/api/workspaces/${workspaceId}/transactions`,
    method: 'POST',
    body: data,
    workspaceId,
  });
}

/**
 * Queue a transaction update for offline sync
 */
export async function queueTransactionUpdate(
  workspaceId: string,
  transactionId: string,
  data: unknown
): Promise<string> {
  return syncQueue.add({
    type: 'transaction:update',
    url: `/api/workspaces/${workspaceId}/transactions/${transactionId}`,
    method: 'PUT',
    body: data,
    workspaceId,
  });
}

/**
 * Queue a transaction deletion for offline sync
 */
export async function queueTransactionDelete(
  workspaceId: string,
  transactionId: string
): Promise<string> {
  return syncQueue.add({
    type: 'transaction:delete',
    url: `/api/workspaces/${workspaceId}/transactions/${transactionId}`,
    method: 'DELETE',
    workspaceId,
  });
}

// ----------------------------------------------------------------------------
// Auto-sync on Online
// ----------------------------------------------------------------------------

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SyncQueue] Back online, syncing...');
    void syncQueue.sync();
  });

  // Initial sync if online
  if (navigator.onLine) {
    void syncQueue.getPendingCount().then((count) => {
      if (count > 0) {
        void syncQueue.sync();
      }
    });
  }
}
