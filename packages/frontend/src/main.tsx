import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './features/auth/AuthProvider';
import { OnboardingProvider } from './features/onboarding';
import { ThemeProvider } from './providers/ThemeProvider';
import { registerServiceWorker } from './lib/pwa/register';
import { initSentry } from './lib/sentry';
import { initWebVitals } from './lib/webVitals';
import './index.css';

// Initialize i18n
import './lib/i18n';

// Initialize Sentry before rendering
initSentry();

// Initialize Web Vitals monitoring (LCP, FID, CLS, INP, TTFB)
initWebVitals();

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Register service worker for PWA
registerServiceWorker();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
              <OnboardingProvider>
                <App />
              </OnboardingProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
