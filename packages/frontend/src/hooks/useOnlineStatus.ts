// ============================================================================
// USE ONLINE STATUS HOOK - HubCompta
// Track online/offline state with event listeners
// ============================================================================

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { syncQueue, type SyncStatus } from '@/lib/offline/syncQueue';

// ----------------------------------------------------------------------------
// Online Status Hook
// ----------------------------------------------------------------------------

/**
 * Hook to track online/offline status
 */
export function useOnlineStatus(): boolean {
  // Use useSyncExternalStore for better SSR compatibility
  return useSyncExternalStore(
    subscribeToOnlineStatus,
    getOnlineSnapshot,
    getServerSnapshot
  );
}

function subscribeToOnlineStatus(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);

  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getOnlineSnapshot(): boolean {
  return navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true; // Assume online on server
}

// ----------------------------------------------------------------------------
// Sync Status Hook
// ----------------------------------------------------------------------------

/**
 * Hook to track sync queue status
 */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({
    isSyncing: false,
    pendingCount: 0,
    lastSyncAt: null,
    lastError: null,
  });

  useEffect(() => {
    const unsubscribe = syncQueue.subscribe(setStatus);
    return unsubscribe;
  }, []);

  return status;
}

// ----------------------------------------------------------------------------
// Combined Offline Status Hook
// ----------------------------------------------------------------------------

export interface OfflineStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  lastError: string | null;
  sync: () => Promise<void>;
}

/**
 * Combined hook for offline status and sync queue
 */
export function useOfflineStatus(): OfflineStatus {
  const isOnline = useOnlineStatus();
  const syncStatus = useSyncStatus();

  const sync = useCallback(async () => {
    if (isOnline) {
      await syncQueue.sync();
    }
  }, [isOnline]);

  return {
    isOnline,
    isSyncing: syncStatus.isSyncing,
    pendingCount: syncStatus.pendingCount,
    lastSyncAt: syncStatus.lastSyncAt,
    lastError: syncStatus.lastError,
    sync,
  };
}

// ----------------------------------------------------------------------------
// Network Quality Hook (optional enhancement)
// ----------------------------------------------------------------------------

export type NetworkQuality = 'good' | 'slow' | 'offline';

/**
 * Hook to track network quality using Network Information API
 */
export function useNetworkQuality(): NetworkQuality {
  const isOnline = useOnlineStatus();
  const [quality, setQuality] = useState<NetworkQuality>('good');

  useEffect(() => {
    // Check if Network Information API is available
    const connection = (navigator as {
      connection?: {
        effectiveType: string;
        addEventListener: (type: string, listener: () => void) => void;
        removeEventListener: (type: string, listener: () => void) => void;
      };
    }).connection;

    const updateQuality = () => {
      if (!isOnline) {
        setQuality('offline');
        return;
      }

      if (!connection) {
        setQuality('good');
        return;
      }

      const effectiveType = connection.effectiveType;

      if (effectiveType === '4g') {
        setQuality('good');
      } else if (effectiveType === '3g' || effectiveType === '2g') {
        setQuality('slow');
      } else {
        setQuality('good');
      }
    };

    updateQuality();

    if (connection) {
      connection.addEventListener('change', updateQuality);
      return () => {
        connection.removeEventListener('change', updateQuality);
      };
    }
    return undefined;
  }, [isOnline]);

  return quality;
}
