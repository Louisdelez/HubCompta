// ============================================================================
// SERVICE WORKER REGISTRATION - HubCompta
// Enhanced PWA functionality with background sync and offline support
// ============================================================================

// Store the current registration for external access
let currentRegistration: ServiceWorkerRegistration | null = null;

/**
 * Register the service worker for PWA functionality
 */
export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        currentRegistration = registration;

        // Check for updates periodically
        setInterval(() => {
          void registration.update();
        }, 60 * 60 * 1000); // Every hour

        // Handle updates
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New content is available, show update notification
                console.info('[PWA] New content available, please refresh.');
                dispatchUpdateEvent();
              } else {
                // Content is cached for offline use
                console.info('[PWA] Content is cached for offline use.');
                dispatchCachedEvent();
              }
            }
          };
        };

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          const { type, ...data } = event.data as { type: string; [key: string]: unknown };

          switch (type) {
            case 'SW_SYNC_SUCCESS':
              console.info('[PWA] Background sync completed:', data);
              window.dispatchEvent(new CustomEvent('sw-sync-success', { detail: data }));
              break;
            case 'SW_SYNC_FAILED':
              console.warn('[PWA] Background sync failed:', data);
              window.dispatchEvent(new CustomEvent('sw-sync-failed', { detail: data }));
              break;
            default:
              // Handle other message types
              break;
          }
        });

        console.info('[PWA] Service worker registered successfully');
      } catch (error) {
        console.error('[PWA] Service worker registration failed:', error);
      }
    });
  }
}

/**
 * Get the current service worker registration
 */
export function getRegistration(): ServiceWorkerRegistration | null {
  return currentRegistration;
}

/**
 * Unregister all service workers
 */
export async function unregisterServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
  }
}

/**
 * Dispatch a custom event when an update is available
 */
function dispatchUpdateEvent(): void {
  window.dispatchEvent(new CustomEvent('sw-update-available'));
}

/**
 * Dispatch a custom event when content is cached for offline use
 */
function dispatchCachedEvent(): void {
  window.dispatchEvent(new CustomEvent('sw-content-cached'));
}

/**
 * Check if the app is running as a PWA
 */
export function isPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

/**
 * Check if the device is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Listen for online/offline status changes
 */
export function onConnectivityChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Send a message to the active service worker
 */
export async function sendMessageToSW(message: Record<string, unknown>): Promise<unknown> {
  const controller = navigator.serviceWorker.controller;
  if (!controller) {
    console.warn('[PWA] No active service worker controller');
    return null;
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      resolve(event.data);
    };

    controller.postMessage(message, [messageChannel.port2]);
  });
}

/**
 * Request the service worker to skip waiting and activate
 */
export async function skipWaiting(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

/**
 * Get the service worker version
 */
export async function getVersion(): Promise<string | null> {
  const response = await sendMessageToSW({ type: 'GET_VERSION' });
  return (response as { version?: string })?.version ?? null;
}

/**
 * Clear all caches managed by the service worker
 */
export async function clearCache(): Promise<void> {
  await sendMessageToSW({ type: 'CLEAR_CACHE' });
}

/**
 * Force a background sync
 */
export async function forceSync(): Promise<void> {
  await sendMessageToSW({ type: 'FORCE_SYNC' });
}

/**
 * Check if background sync is supported
 */
export function isBackgroundSyncSupported(): boolean {
  return 'serviceWorker' in navigator && 'sync' in (ServiceWorkerRegistration.prototype as object);
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return await Notification.requestPermission();
}

/**
 * Get notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}
