// ============================================================================
// USE SHORTCUT HOOK - Finance Hub
// Hook to register individual shortcuts
// ============================================================================

import { useEffect, useCallback, useRef } from 'react';
import { useShortcuts, type ShortcutHandler } from './ShortcutProvider';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface UseShortcutOptions {
  /** Whether the shortcut is enabled */
  enabled?: boolean;
  /** Priority (higher = checked first) */
  priority?: number;
  /** Dependencies for the handler */
  deps?: unknown[];
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

/**
 * Register a keyboard shortcut handler
 *
 * @param id - The shortcut ID (must match a shortcut in the config)
 * @param handler - The function to call when shortcut is triggered
 * @param options - Optional configuration
 *
 * @example
 * ```tsx
 * useShortcut('go-home', () => navigate('/dashboard'));
 * useShortcut('new-transaction', () => setModalOpen(true), { enabled: isReady });
 * ```
 */
export function useShortcut(
  id: string,
  handler: ShortcutHandler,
  options: UseShortcutOptions = {}
): void {
  const { enabled = true, priority = 0, deps = [] } = options;
  const { registerShortcut } = useShortcuts();

  // Store handler in ref to avoid re-registering on every render
  const handlerRef = useRef(handler);

  // Update ref in effect to avoid updating during render
  useEffect(() => {
    handlerRef.current = handler;
  });

  // Stable handler wrapper
  const stableHandler = useCallback(() => {
    handlerRef.current();
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const unregister = registerShortcut(id, stableHandler, priority);
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, enabled, priority, registerShortcut, stableHandler, ...deps]);
}

/**
 * Register multiple shortcuts at once
 *
 * @param shortcuts - Object mapping shortcut IDs to handlers
 * @param options - Optional configuration
 *
 * @example
 * ```tsx
 * useShortcuts({
 *   'go-home': () => navigate('/dashboard'),
 *   'go-transactions': () => navigate('/transactions'),
 * });
 * ```
 */
export function useShortcutMap(
  shortcuts: Record<string, ShortcutHandler>,
  options: UseShortcutOptions = {}
): void {
  const { enabled = true, priority = 0 } = options;
  const { registerShortcut } = useShortcuts();

  // Store handlers in ref
  const handlersRef = useRef(shortcuts);

  // Update ref in effect to avoid updating during render
  useEffect(() => {
    handlersRef.current = shortcuts;
  });

  // Memoize shortcut keys
  const shortcutKeys = Object.keys(shortcuts).join(',');

  useEffect(() => {
    if (!enabled) return;

    const unregisters: (() => void)[] = [];

    for (const [id] of Object.entries(handlersRef.current)) {
      const unregister = registerShortcut(
        id,
        () => handlersRef.current[id]?.(),
        priority
      );
      unregisters.push(unregister);
    }

    return () => {
      for (const unregister of unregisters) {
        unregister();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, priority, registerShortcut, shortcutKeys]);
}

export default useShortcut;
