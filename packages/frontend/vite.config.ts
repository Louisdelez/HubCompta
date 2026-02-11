import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'masked-icon.svg',
        'offline.html',
      ],
      manifest: {
        name: 'HubCompta',
        short_name: 'HubCompta',
        description: 'Self-hosted financial management platform',
        theme_color: '#cba6f7', // Catppuccin Mocha mauve (primary accent)
        background_color: '#1e1e2e', // Catppuccin Mocha base
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        id: 'hubcompta-pwa',
        categories: ['finance', 'productivity', 'utilities'],
        lang: 'fr-FR',
        dir: 'ltr',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Ajouter une transaction',
            short_name: 'Transaction',
            description: 'Ajouter une nouvelle transaction',
            url: '/transactions?action=new',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Tableau de bord',
            short_name: 'Dashboard',
            description: 'Voir le tableau de bord',
            url: '/dashboard',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Comptes',
            short_name: 'Comptes',
            description: 'Voir les comptes',
            url: '/accounts',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Budgets',
            short_name: 'Budgets',
            description: 'Gerer les budgets',
            url: '/budgets',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'],
        // Offline fallback page
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api/, /^\/health/],
        // Runtime caching strategies
        runtimeCaching: [
          // API calls - NetworkFirst with offline support
          {
            urlPattern: /^.*\/api\/(?!auth|user\/sessions).*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'hubcompta-api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              backgroundSync: {
                name: 'hubcompta-api-queue',
                options: {
                  maxRetentionTime: 24 * 60, // 24 hours in minutes
                },
              },
            },
          },
          // Auth API - shorter cache, no background sync
          {
            urlPattern: /^.*\/api\/auth.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'hubcompta-auth-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60, // 1 minute
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
          // Static assets (JS/CSS with hashes) - CacheFirst
          {
            urlPattern: /\.(?:js|css)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'hubcompta-static-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Images - StaleWhileRevalidate
          {
            urlPattern: /\.(?:png|jpg|jpeg|gif|svg|ico|webp)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'hubcompta-images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Fonts - CacheFirst with long expiration
          {
            urlPattern: /\.(?:woff|woff2|ttf|eot|otf)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'hubcompta-fonts-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Google Fonts stylesheets - StaleWhileRevalidate
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'hubcompta-google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
          // Google Fonts files - CacheFirst
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'hubcompta-google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@features': path.resolve(__dirname, './src/features'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@stores': path.resolve(__dirname, './src/stores'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries - loaded on every page
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Data fetching - used across the app
          query: ['@tanstack/react-query'],
          // UI libraries - icons and charts
          ui: ['lucide-react'],
          charts: ['recharts'],
          // Form handling (if used)
          // forms: ['react-hook-form', 'zod'],
        },
        // Better chunk naming for debugging
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ?? '';
          // Feature-based chunks from lazy imports
          if (facadeModuleId.includes('/features/')) {
            const match = facadeModuleId.match(/\/features\/([^/]+)\//);
            if (match) {
              return `features/${match[1]}-[hash].js`;
            }
          }
          return 'chunks/[name]-[hash].js';
        },
        // Keep asset names organized
        assetFileNames: 'assets/[name]-[hash][extname]',
        entryFileNames: '[name]-[hash].js',
      },
    },
    // Increase chunk size warning limit slightly for vendor chunks
    chunkSizeWarningLimit: 600,
  },
});
