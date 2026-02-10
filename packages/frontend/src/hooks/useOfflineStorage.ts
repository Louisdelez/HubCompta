// ============================================================================
// USE OFFLINE STORAGE - Finance Hub
// IndexedDB-based offline storage for transactions
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

const DB_NAME = 'hubcompta-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-transactions';

interface OfflineTransaction {
  id: string;
  data: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
}

interface UseOfflineStorageResult {
  isOnline: boolean;
  pendingCount: number;
  addPendingTransaction: (data: Record<string, unknown>) => Promise<string>;
  getPendingTransactions: () => Promise<OfflineTransaction[]>;
  removePendingTransaction: (id: string) => Promise<void>;
  syncPendingTransactions: (
    syncFn: (data: Record<string, unknown>) => Promise<boolean>
  ) => Promise<number>;
  clearPendingTransactions: () => Promise<void>;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

function generateId(): string {
  return `offline-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function useOfflineStorage(): UseOfflineStorageResult {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load pending count
  useEffect(() => {
    const loadCount = async () => {
      try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const countRequest = store.count();

        countRequest.onsuccess = () => {
          setPendingCount(countRequest.result);
        };
      } catch (error) {
        console.error('Failed to load pending count:', error);
      }
    };

    void loadCount();
  }, []);

  const addPendingTransaction = useCallback(
    async (data: Record<string, unknown>): Promise<string> => {
      const db = await openDatabase();
      const id = generateId();

      const transaction: OfflineTransaction = {
        id,
        data,
        createdAt: Date.now(),
        retryCount: 0,
      };

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.add(transaction);

        request.onsuccess = () => {
          setPendingCount((c) => c + 1);
          resolve(id);
        };
        request.onerror = () => reject(request.error);
      });
    },
    []
  );

  const getPendingTransactions = useCallback(async (): Promise<
    OfflineTransaction[]
  > => {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('createdAt');
      const request = index.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, []);

  const removePendingTransaction = useCallback(
    async (id: string): Promise<void> => {
      const db = await openDatabase();

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
          setPendingCount((c) => Math.max(0, c - 1));
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    },
    []
  );

  const syncPendingTransactions = useCallback(
    async (
      syncFn: (data: Record<string, unknown>) => Promise<boolean>
    ): Promise<number> => {
      if (!isOnline) return 0;

      const pending = await getPendingTransactions();
      let synced = 0;

      for (const transaction of pending) {
        try {
          const success = await syncFn(transaction.data);
          if (success) {
            await removePendingTransaction(transaction.id);
            synced++;
          } else {
            // Update retry count
            const db = await openDatabase();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put({ ...transaction, retryCount: transaction.retryCount + 1 });
          }
        } catch (error) {
          console.error('Failed to sync transaction:', transaction.id, error);
        }
      }

      return synced;
    },
    [isOnline, getPendingTransactions, removePendingTransaction]
  );

  const clearPendingTransactions = useCallback(async (): Promise<void> => {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        setPendingCount(0);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }, []);

  return {
    isOnline,
    pendingCount,
    addPendingTransaction,
    getPendingTransactions,
    removePendingTransaction,
    syncPendingTransactions,
    clearPendingTransactions,
  };
}

export default useOfflineStorage;
