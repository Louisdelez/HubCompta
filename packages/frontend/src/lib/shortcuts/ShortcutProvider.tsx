// ============================================================================
// SHORTCUT PROVIDER - Finance Hub
// Context provider for keyboard shortcuts system
// ============================================================================

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import {
  DEFAULT_SHORTCUTS,
  matchesKeyCombo,
  type Shortcut,
} from './shortcuts';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type ShortcutHandler = () => void;

interface RegisteredShortcut {
  shortcut: Shortcut;
  handler: ShortcutHandler;
  priority: number;
}

interface ShortcutContextValue {
  /** All registered shortcuts */
  shortcuts: Shortcut[];
  /** Register a shortcut handler */
  registerShortcut: (
    id: string,
    handler: ShortcutHandler,
    priority?: number
  ) => () => void;
  /** Unregister a shortcut handler */
  unregisterShortcut: (id: string) => void;
  /** Enable/disable a shortcut */
  setShortcutEnabled: (id: string, enabled: boolean) => void;
  /** Check if shortcuts are currently active (not in input) */
  isActive: boolean;
  /** Temporarily disable all shortcuts */
  pauseShortcuts: () => void;
  /** Re-enable shortcuts after pause */
  resumeShortcuts: () => void;
  /** Whether shortcuts help is open */
  isHelpOpen: boolean;
  /** Open/close shortcuts help */
  setHelpOpen: (open: boolean) => void;
}

// ----------------------------------------------------------------------------
// Context
// ----------------------------------------------------------------------------

const ShortcutContext = createContext<ShortcutContextValue | null>(null);

// ----------------------------------------------------------------------------
// Provider
// ----------------------------------------------------------------------------

interface ShortcutProviderProps {
  children: ReactNode;
  /** Custom shortcuts to use instead of defaults */
  shortcuts?: Shortcut[];
  /** Timeout for key sequences (ms) */
  sequenceTimeout?: number;
}

export function ShortcutProvider({
  children,
  shortcuts: customShortcuts,
  sequenceTimeout = 1000,
}: ShortcutProviderProps) {
  // State for shortcuts configuration
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(
    customShortcuts ?? DEFAULT_SHORTCUTS
  );

  // Registered handlers (id -> handler)
  const handlersRef = useRef<Map<string, RegisteredShortcut>>(new Map());

  // Sequence buffer for multi-key shortcuts
  const sequenceBufferRef = useRef<string[]>([]);
  const sequenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pause state
  const [isPaused, setIsPaused] = useState(false);

  // Help modal state
  const [isHelpOpen, setHelpOpen] = useState(false);

  // Check if shortcuts should be active (not in input field)
  const shouldProcessShortcuts = useCallback((event: KeyboardEvent): boolean => {
    if (isPaused) return false;

    const target = event.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    const isEditable = target.isContentEditable;
    const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';

    // Always allow Escape
    if (event.key === 'Escape') return true;

    // Always allow Ctrl/Cmd shortcuts even in inputs
    if (event.ctrlKey || event.metaKey) return true;

    // Block other shortcuts when in input fields
    if (isInput || isEditable) return false;

    return true;
  }, [isPaused]);

  // Register a shortcut handler
  const registerShortcut = useCallback(
    (id: string, handler: ShortcutHandler, priority = 0): (() => void) => {
      const shortcut = shortcuts.find((s) => s.id === id);
      if (!shortcut) {
        console.warn(`Shortcut '${id}' not found in shortcuts config`);
        return () => {};
      }

      handlersRef.current.set(id, { shortcut, handler, priority });

      // Return unregister function
      return () => {
        handlersRef.current.delete(id);
      };
    },
    [shortcuts]
  );

  // Unregister a shortcut handler
  const unregisterShortcut = useCallback((id: string) => {
    handlersRef.current.delete(id);
  }, []);

  // Enable/disable a shortcut
  const setShortcutEnabled = useCallback((id: string, enabled: boolean) => {
    setShortcuts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled } : s))
    );
  }, []);

  // Pause/resume shortcuts
  const pauseShortcuts = useCallback(() => setIsPaused(true), []);
  const resumeShortcuts = useCallback(() => setIsPaused(false), []);

  // Clear sequence buffer
  const clearSequenceBuffer = useCallback(() => {
    sequenceBufferRef.current = [];
    if (sequenceTimeoutRef.current) {
      clearTimeout(sequenceTimeoutRef.current);
      sequenceTimeoutRef.current = null;
    }
  }, []);

  // Handle keydown events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!shouldProcessShortcuts(event)) {
        clearSequenceBuffer();
        return;
      }

      const key = event.key.toLowerCase();

      // Check for sequence shortcuts first
      // Add current key to sequence buffer
      const isStartOfSequence = key === 'g' || key === 'n';
      const inSequence = sequenceBufferRef.current.length > 0;

      if (isStartOfSequence && !inSequence) {
        // Start a new sequence
        sequenceBufferRef.current = [key];

        // Set timeout to clear sequence
        sequenceTimeoutRef.current = setTimeout(() => {
          clearSequenceBuffer();
        }, sequenceTimeout);

        event.preventDefault();
        return;
      }

      // Try to match shortcuts
      const handlers = Array.from(handlersRef.current.values())
        .filter((h) => h.shortcut.enabled)
        .sort((a, b) => b.priority - a.priority);

      for (const { shortcut, handler } of handlers) {
        const matches = matchesKeyCombo(
          event,
          shortcut.keys,
          shortcut.isSequence,
          sequenceBufferRef.current
        );

        if (matches) {
          event.preventDefault();
          event.stopPropagation();
          handler();
          clearSequenceBuffer();
          return;
        }
      }

      // If in sequence but no match, clear buffer
      if (inSequence) {
        clearSequenceBuffer();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearSequenceBuffer();
    };
  }, [shouldProcessShortcuts, clearSequenceBuffer, sequenceTimeout]);

  // Context value
  const value = useMemo<ShortcutContextValue>(
    () => ({
      shortcuts,
      registerShortcut,
      unregisterShortcut,
      setShortcutEnabled,
      isActive: !isPaused,
      pauseShortcuts,
      resumeShortcuts,
      isHelpOpen,
      setHelpOpen,
    }),
    [
      shortcuts,
      registerShortcut,
      unregisterShortcut,
      setShortcutEnabled,
      isPaused,
      pauseShortcuts,
      resumeShortcuts,
      isHelpOpen,
    ]
  );

  return (
    <ShortcutContext.Provider value={value}>
      {children}
    </ShortcutContext.Provider>
  );
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function useShortcuts(): ShortcutContextValue {
  const context = useContext(ShortcutContext);
  if (!context) {
    throw new Error('useShortcuts must be used within a ShortcutProvider');
  }
  return context;
}
