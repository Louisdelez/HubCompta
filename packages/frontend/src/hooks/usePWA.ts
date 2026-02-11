// ============================================================================
// USE PWA HOOK - HubCompta
// Comprehensive hook for PWA functionality
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  isPWA,
  skipWaiting,
  getVersion,
  clearCache,
  forceSync,
  isBackgroundSyncSupported,
  isPushSupported,
  requestNotificationPermission,
  getNotificationPermission,
} from '@/lib/pwa/register';
import { useOnlineStatus } from './useOnlineStatus';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface PWAStatus {
  /** Whether the app is running as an installed PWA */
  isInstalled: boolean;
  /** Whether the device is online */
  isOnline: boolean;
  /** Whether an update is available */
  updateAvailable: boolean;
  /** Whether content is cached for offline use */
  contentCached: boolean;
  /** Service worker version */
  version: string | null;
  /** Whether background sync is supported */
  backgroundSyncSupported: boolean;
  /** Whether push notifications are supported */
  pushSupported: boolean;
  /** Notification permission status */
  notificationPermission: NotificationPermission;
}

export interface PWAActions {
  /** Apply the pending update (refreshes the page) */
  applyUpdate: () => void;
  /** Clear all cached data */
  clearAllCache: () => Promise<void>;
  /** Force a background sync */
  triggerSync: () => Promise<void>;
  /** Request notification permission */
  requestNotifications: () => Promise<NotificationPermission>;
  /** Dismiss the update notification */
  dismissUpdate: () => void;
}

export interface UsePWAResult {
  status: PWAStatus;
  actions: PWAActions;
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

/**
 * Hook for managing PWA functionality
 */
export function usePWA(): UsePWAResult {
  const isOnline = useOnlineStatus();
  const [isInstalled, setIsInstalled] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [contentCached, setContentCached] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>('default');

  // Check if running as PWA
  useEffect(() => {
    setIsInstalled(isPWA());
  }, []);

  // Load version
  useEffect(() => {
    const loadVersion = async () => {
      try {
        const v = await getVersion();
        setVersion(v);
      } catch {
        // Service worker might not be ready
      }
    };
    void loadVersion();
  }, []);

  // Load notification permission
  useEffect(() => {
    setNotificationPermission(getNotificationPermission());
  }, []);

  // Listen for service worker events
  useEffect(() => {
    const handleUpdateAvailable = () => {
      console.info('[PWA] Update available');
      setUpdateAvailable(true);
    };

    const handleContentCached = () => {
      console.info('[PWA] Content cached for offline use');
      setContentCached(true);
    };

    const handleSyncSuccess = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      console.info('[PWA] Sync success:', detail);
    };

    const handleSyncFailed = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      console.warn('[PWA] Sync failed:', detail);
    };

    window.addEventListener('sw-update-available', handleUpdateAvailable);
    window.addEventListener('sw-content-cached', handleContentCached);
    window.addEventListener('sw-sync-success', handleSyncSuccess);
    window.addEventListener('sw-sync-failed', handleSyncFailed);

    return () => {
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
      window.removeEventListener('sw-content-cached', handleContentCached);
      window.removeEventListener('sw-sync-success', handleSyncSuccess);
      window.removeEventListener('sw-sync-failed', handleSyncFailed);
    };
  }, []);

  // Actions
  const applyUpdate = useCallback(() => {
    void skipWaiting();
    window.location.reload();
  }, []);

  const clearAllCache = useCallback(async () => {
    await clearCache();
    console.info('[PWA] Cache cleared');
  }, []);

  const triggerSync = useCallback(async () => {
    await forceSync();
    console.info('[PWA] Sync triggered');
  }, []);

  const requestNotifications = useCallback(async () => {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    return permission;
  }, []);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  return {
    status: {
      isInstalled,
      isOnline,
      updateAvailable,
      contentCached,
      version,
      backgroundSyncSupported: isBackgroundSyncSupported(),
      pushSupported: isPushSupported(),
      notificationPermission,
    },
    actions: {
      applyUpdate,
      clearAllCache,
      triggerSync,
      requestNotifications,
      dismissUpdate,
    },
  };
}

export default usePWA;
