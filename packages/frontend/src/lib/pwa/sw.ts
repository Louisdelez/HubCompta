// ============================================================================
// SERVICE WORKER - HubCompta
// PWA offline support, caching, and background sync
// ============================================================================

/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import {
  NetworkFirst,
  CacheFirst,
  StaleWhileRevalidate,
  NetworkOnly,
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

declare const self: ServiceWorkerGlobalScope;

// Helper to cast plugins for exactOptionalPropertyTypes compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asPlugin<T>(plugin: T): any {
  return plugin;
}

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const CACHE_PREFIX = 'hubcompta';
const CACHE_VERSION = 'v2';
const API_CACHE = `${CACHE_PREFIX}-api-${CACHE_VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${CACHE_VERSION}`;
const OFFLINE_PAGE = '/offline.html';

// Background sync queue names
const SYNC_QUEUE_TRANSACTIONS = 'hubcompta-sync-transactions';
const SYNC_QUEUE_GENERAL = 'hubcompta-sync-general';

// ----------------------------------------------------------------------------
// Precaching
// ----------------------------------------------------------------------------

// Precache all assets built by Vite
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- __WB_MANIFEST is injected by workbox-build at build time
precacheAndRoute(self.__WB_MANIFEST || []);

// Cleanup old caches
cleanupOutdatedCaches();

// ----------------------------------------------------------------------------
// Navigation Routes (SPA)
// ----------------------------------------------------------------------------

// Handle navigation requests with NetworkFirst strategy
// Falls back to cached index.html if offline, then to offline.html
const navigationRoute = new NavigationRoute(
  new NetworkFirst({
    cacheName: `${CACHE_PREFIX}-pages-${CACHE_VERSION}`,
    networkTimeoutSeconds: 5,
    plugins: [
      asPlugin(new CacheableResponsePlugin({
        statuses: [200],
      })),
    ],
  }),
  {
    // Only cache navigation to same-origin pages
    allowlist: [/^\/(?!api|health)/],
    // Don't cache auth-related pages
    denylist: [/\/login/, /\/logout/, /\/auth/],
  }
);

registerRoute(navigationRoute);

// Offline fallback for navigation requests that fail
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        // Try to return cached page first
        const cache = await caches.open(`${CACHE_PREFIX}-pages-${CACHE_VERSION}`);
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // Fall back to offline page
        const offlineResponse = await caches.match(OFFLINE_PAGE);
        if (offlineResponse) {
          return offlineResponse;
        }
        // Last resort: return a basic offline response
        return new Response(
          '<html><body><h1>Offline</h1><p>Please check your connection.</p></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      })
    );
  }
});

// ----------------------------------------------------------------------------
// API Routes
// ----------------------------------------------------------------------------

// API requests - NetworkFirst with short cache for offline support
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: API_CACHE,
    networkTimeoutSeconds: 10,
    plugins: [
      asPlugin(new CacheableResponsePlugin({
        statuses: [200],
      })),
      asPlugin(new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60, // 1 hour
        purgeOnQuotaError: true,
      })),
    ],
  })
);

// Don't cache sensitive API endpoints
registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/api/auth') ||
    url.pathname.startsWith('/api/user/sessions') ||
    url.pathname.startsWith('/api/settings/data'),
  new NetworkFirst({
    cacheName: API_CACHE,
    networkTimeoutSeconds: 5,
    plugins: [
      asPlugin(new CacheableResponsePlugin({
        statuses: [200],
      })),
      asPlugin(new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60, // 1 minute only
      })),
    ],
  })
);

// ----------------------------------------------------------------------------
// Static Assets
// ----------------------------------------------------------------------------

// JavaScript and CSS - CacheFirst (they have hashed filenames)
registerRoute(
  ({ request }) =>
    request.destination === 'script' || request.destination === 'style',
  new CacheFirst({
    cacheName: STATIC_CACHE,
    plugins: [
      asPlugin(new CacheableResponsePlugin({
        statuses: [200],
      })),
      asPlugin(new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      })),
    ],
  })
);

// Fonts - CacheFirst with long expiration
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}-fonts-${CACHE_VERSION}`,
    plugins: [
      asPlugin(new CacheableResponsePlugin({
        statuses: [200],
      })),
      asPlugin(new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
      })),
    ],
  })
);

// Images - StaleWhileRevalidate
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: IMAGE_CACHE,
    plugins: [
      asPlugin(new CacheableResponsePlugin({
        statuses: [200],
      })),
      asPlugin(new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        purgeOnQuotaError: true,
      })),
    ],
  })
);

// ----------------------------------------------------------------------------
// Background Sync (for offline mutations)
// ----------------------------------------------------------------------------

// Plugin for transaction-related requests (POST, PATCH, DELETE)
const transactionSyncPlugin = new BackgroundSyncPlugin(SYNC_QUEUE_TRANSACTIONS, {
  maxRetentionTime: 24 * 60, // 24 hours in minutes
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        const response = await fetch(entry.request.clone());
        if (!response.ok) {
          // If server error, put back in queue for retry
          if (response.status >= 500) {
            await queue.unshiftRequest(entry);
            throw new Error(`Server error: ${response.status}`);
          }
          // Client errors (4xx) - notify user but don't retry
          console.warn('[ServiceWorker] Sync failed with client error:', response.status);
          await notifyClient('sync-failed', {
            url: entry.request.url,
            method: entry.request.method,
            status: response.status,
          });
        } else {
          // Success - notify client
          await notifyClient('sync-success', {
            url: entry.request.url,
            method: entry.request.method,
          });
        }
      } catch (error) {
        console.error('[ServiceWorker] Sync error:', error);
        await queue.unshiftRequest(entry);
        throw error;
      }
    }
  },
});

// Plugin for general API requests (non-transaction)
const generalSyncPlugin = new BackgroundSyncPlugin(SYNC_QUEUE_GENERAL, {
  maxRetentionTime: 60, // 1 hour in minutes
});

// Register route for transaction POST requests (create)
registerRoute(
  ({ url, request }) =>
    url.pathname.includes('/api/transactions') && request.method === 'POST',
  new NetworkOnly({
    plugins: [asPlugin(transactionSyncPlugin)],
  }),
  'POST'
);

// Register route for transaction PATCH requests (update)
registerRoute(
  ({ url, request }) =>
    url.pathname.includes('/api/transactions') && request.method === 'PATCH',
  new NetworkOnly({
    plugins: [asPlugin(transactionSyncPlugin)],
  }),
  'PATCH'
);

// Register route for transaction DELETE requests
registerRoute(
  ({ url, request }) =>
    url.pathname.includes('/api/transactions') && request.method === 'DELETE',
  new NetworkOnly({
    plugins: [asPlugin(transactionSyncPlugin)],
  }),
  'DELETE'
);

// Register route for budget updates
registerRoute(
  ({ url, request }) =>
    url.pathname.includes('/api/budgets') &&
    (request.method === 'POST' || request.method === 'PATCH'),
  new NetworkOnly({
    plugins: [asPlugin(generalSyncPlugin)],
  }),
  'POST'
);

registerRoute(
  ({ url, request }) =>
    url.pathname.includes('/api/budgets') && request.method === 'PATCH',
  new NetworkOnly({
    plugins: [asPlugin(generalSyncPlugin)],
  }),
  'PATCH'
);

// Register route for category updates
registerRoute(
  ({ url, request }) =>
    url.pathname.includes('/api/categories') &&
    (request.method === 'POST' || request.method === 'PATCH'),
  new NetworkOnly({
    plugins: [asPlugin(generalSyncPlugin)],
  }),
  'POST'
);

// Helper function to notify clients
async function notifyClient(type: string, data: Record<string, unknown>) {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({
      type: `SW_${type.toUpperCase().replace(/-/g, '_')}`,
      ...data,
    });
  }
}

// ----------------------------------------------------------------------------
// Event Listeners
// ----------------------------------------------------------------------------

// Install event
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');

  // Pre-cache the offline page
  event.waitUntil(
    caches.open(`${CACHE_PREFIX}-offline-${CACHE_VERSION}`).then((cache) => {
      console.log('[ServiceWorker] Caching offline page');
      return cache.add(OFFLINE_PAGE);
    })
  );

  // Skip waiting to activate immediately
  void self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  // Take control of all pages immediately
  event.waitUntil(self.clients.claim());
});

// Message event (for communication with main app)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({
      version: CACHE_VERSION,
    });
  }

  if (event.data && event.data.type === 'GET_SYNC_STATUS') {
    // Return pending sync status
    event.ports[0]?.postMessage({
      hasPendingSync: false, // Would need IndexedDB query for actual count
      queues: [SYNC_QUEUE_TRANSACTIONS, SYNC_QUEUE_GENERAL],
    });
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith(CACHE_PREFIX))
            .map((name) => caches.delete(name))
        );
      })
    );
  }

  if (event.data && event.data.type === 'FORCE_SYNC') {
    // Trigger sync manually if supported
    if ('sync' in self.registration) {
      void (self.registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } })
        .sync.register(SYNC_QUEUE_TRANSACTIONS);
    }
  }
});

// Push notification event (for future use)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json() as {
      body?: string;
      title?: string;
      tag?: string;
      data?: Record<string, unknown>;
      requireInteraction?: boolean;
    };

    const options: NotificationOptions = {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: data.tag || 'hubcompta-notification',
      data: data.data || {},
      requireInteraction: data.requireInteraction || false,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'HubCompta', options)
    );
  } catch (error) {
    console.error('[ServiceWorker] Push notification error:', error);
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          void client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
      return undefined;
    })
  );
});

// Export for TypeScript
export {};
