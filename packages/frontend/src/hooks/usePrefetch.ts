// ============================================================================
// PREFETCH HOOK - Finance Hub
// Provides route prefetching utilities for navigation links
// ============================================================================

import { useCallback } from 'react';
import { prefetchRoute } from '../App';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type PrefetchKey = keyof typeof prefetchRoute;

// Route path to prefetch key mapping
const pathToPrefetchKey: Record<string, PrefetchKey> = {
  '/dashboard': 'dashboard',
  '/transactions': 'transactions',
  '/accounts': 'accounts',
  '/budgets': 'budgets',
  '/portfolio': 'invest',
  '/documents': 'documents',
  '/recurrences': 'recurrences',
  '/import': 'import',
  '/export': 'export',
  '/rules': 'rules',
  '/reports': 'reports',
  '/currencies': 'currency',
  '/search': 'search',
  '/settings': 'settings',
  '/admin': 'admin',
};

// Cache to track already prefetched routes
const prefetchedRoutes = new Set<string>();

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

/**
 * Hook that provides a prefetch handler for navigation links.
 * Use on onMouseEnter or onFocus events to preload route chunks.
 *
 * @example
 * const { prefetchOnHover } = usePrefetch();
 * <NavLink to="/transactions" onMouseEnter={() => prefetchOnHover('/transactions')}>
 */
export function usePrefetch() {
  /**
   * Prefetch a route by its path.
   * Will only prefetch once per route per session.
   */
  const prefetchOnHover = useCallback((path: string) => {
    // Extract base path (remove workspace prefix if present)
    const basePath = path.replace(/^\/workspaces\/[^/]+/, '');
    const key = pathToPrefetchKey[basePath];

    if (!key || prefetchedRoutes.has(key)) {
      return;
    }

    // Mark as prefetched to avoid duplicate loads
    prefetchedRoutes.add(key);

    // Prefetch the route module
    const prefetcher = prefetchRoute[key];
    if (prefetcher) {
      prefetcher().catch(() => {
        // If prefetch fails, remove from cache so it can be retried
        prefetchedRoutes.delete(key);
      });
    }
  }, []);

  /**
   * Create event handlers for a navigation element.
   * Returns onMouseEnter and onFocus handlers.
   */
  const createPrefetchHandlers = useCallback((path: string) => ({
    onMouseEnter: () => prefetchOnHover(path),
    onFocus: () => prefetchOnHover(path),
  }), [prefetchOnHover]);

  return {
    prefetchOnHover,
    createPrefetchHandlers,
  };
}

export default usePrefetch;
