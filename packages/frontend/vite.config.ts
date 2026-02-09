import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'HubCompta',
        short_name: 'HubCompta',
        description: 'Self-hosted financial management platform',
        theme_color: '#1e1e2e', // Catppuccin Mocha base
        background_color: '#1e1e2e',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
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
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
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
