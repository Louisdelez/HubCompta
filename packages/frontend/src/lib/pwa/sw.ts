// ============================================================================
// SERVICE WORKER - Finance Hub
// PWA offline support and caching
// ============================================================================

/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import {
  NetworkFirst,
  CacheFirst,
  StaleWhileRevalidate,
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

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
const CACHE_VERSION = 'v1';
const API_CACHE = `${CACHE_PREFIX}-api-${CACHE_VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${CACHE_VERSION}`;

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
// Falls back to cached index.html if offline
const navigationRoute = new NavigationRoute(
  new NetworkFirst({
    cacheName: `${CACHE_PREFIX}-pages-${CACHE_VERSION}`,
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
// Background Sync (for offline transactions)
// ----------------------------------------------------------------------------

// Queue for offline transaction creation
// const transactionQueue = new Queue('offline-transactions', {
//   onSync: async ({ queue }) => {
//     let entry;
//     while ((entry = await queue.shiftRequest())) {
//       try {
//         await fetch(entry.request.clone());
//       } catch (error) {
//         await queue.unshiftRequest(entry);
//         throw error;
//       }
//     }
//   },
// });

// Register route for offline transaction creation
// registerRoute(
//   ({ url, request }) =>
//     url.pathname.includes('/transactions') && request.method === 'POST',
//   new NetworkOnly({
//     plugins: [transactionQueue],
//   }),
//   'POST'
// );

// ----------------------------------------------------------------------------
// Event Listeners
// ----------------------------------------------------------------------------

// Install event
self.addEventListener('install', (_event) => {
  console.log('[ServiceWorker] Install');
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
});

// Push notification event (for future use)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    const options: NotificationOptions = {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: data.tag || 'hubcompta-notification',
      data: data.data || {},
      requireInteraction: data.requireInteraction || false,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Finance Hub', options)
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
