import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Bundle analyzer - generates stats.html when building
    visualizer({
      filename: 'dist/stats.html',
      open: false, // Set to true to auto-open after build
      gzipSize: true,
      brotliSize: true,
      template: 'treemap', // or 'sunburst', 'network'
    }) as PluginOption,
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
            src: '/pwa-72x72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-96x96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-128x128.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-144x144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-152x152.png',
            sizes: '152x152',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-384x384.png',
            sizes: '384x384',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/pwa-maskable-512x512.png',
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
            icons: [{ src: '/pwa-96x96.png', sizes: '96x96' }],
          },
          {
            name: 'Tableau de bord',
            short_name: 'Dashboard',
            description: 'Voir le tableau de bord',
            url: '/dashboard',
            icons: [{ src: '/pwa-96x96.png', sizes: '96x96' }],
          },
          {
            name: 'Comptes',
            short_name: 'Comptes',
            description: 'Voir les comptes',
            url: '/accounts',
            icons: [{ src: '/pwa-96x96.png', sizes: '96x96' }],
          },
          {
            name: 'Budgets',
            short_name: 'Budgets',
            description: 'Gerer les budgets',
            url: '/budgets',
            icons: [{ src: '/pwa-96x96.png', sizes: '96x96' }],
          },
          {
            name: 'Scanner un document',
            short_name: 'Scanner',
            description: 'Scanner un document ou recu',
            url: '/documents?action=scan',
            icons: [{ src: '/pwa-96x96.png', sizes: '96x96' }],
          },
          {
            name: 'Importer des donnees',
            short_name: 'Import',
            description: 'Importer des transactions',
            url: '/import',
            icons: [{ src: '/pwa-96x96.png', sizes: '96x96' }],
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
    // Enable minification
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Granular vendor chunking for better caching
        manualChunks: (id: string) => {
          // React core - loaded on every page (most stable, rarely changes)
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }

          // Router - needed for navigation (stable)
          if (id.includes('node_modules/react-router') ||
              id.includes('node_modules/@remix-run/')) {
            return 'vendor-router';
          }

          // Data fetching - TanStack Query (relatively stable)
          if (id.includes('node_modules/@tanstack/')) {
            return 'vendor-query';
          }

          // Icons - lucide-react (large, tree-shakeable)
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }

          // Charts - recharts (large, only loaded when needed)
          if (id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3-') ||
              id.includes('node_modules/victory-vendor')) {
            return 'vendor-charts';
          }

          // Forms - react-hook-form
          if (id.includes('node_modules/react-hook-form')) {
            return 'vendor-forms';
          }

          // State management - zustand
          if (id.includes('node_modules/zustand')) {
            return 'vendor-state';
          }

          // Date utilities
          if (id.includes('node_modules/date-fns')) {
            return 'vendor-date';
          }

          // Utilities - clsx, tailwind-merge
          if (id.includes('node_modules/clsx') ||
              id.includes('node_modules/tailwind-merge')) {
            return 'vendor-utils';
          }

          // PWA/Service worker utilities
          if (id.includes('node_modules/workbox-') ||
              id.includes('node_modules/idb')) {
            return 'vendor-pwa';
          }

          // Sentry error tracking (loaded async)
          if (id.includes('node_modules/@sentry/')) {
            return 'vendor-sentry';
          }

          // Grid layout (used in dashboard)
          if (id.includes('node_modules/react-grid-layout')) {
            return 'vendor-grid';
          }

          // Onboarding/tour
          if (id.includes('node_modules/react-joyride')) {
            return 'vendor-onboarding';
          }

          // Other vendor modules - group small deps together
          if (id.includes('node_modules/')) {
            return 'vendor-misc';
          }
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
