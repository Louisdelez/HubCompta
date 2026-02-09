// ============================================================================
// SCREEN READER ANNOUNCER - Finance Hub
// Provides live region announcements for async operations
// ============================================================================

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type Politeness = 'polite' | 'assertive';

interface AnnouncerContextValue {
  /** Announce a message to screen readers (polite by default) */
  announce: (message: string, politeness?: Politeness) => void;
  /** Announce a loading state */
  announceLoading: (message?: string) => void;
  /** Announce a success message */
  announceSuccess: (message: string) => void;
  /** Announce an error message */
  announceError: (message: string) => void;
}

// ----------------------------------------------------------------------------
// Context
// ----------------------------------------------------------------------------

const AnnouncerContext = createContext<AnnouncerContextValue | null>(null);

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

/**
 * Hook to access screen reader announcements
 *
 * @example
 * const { announce, announceSuccess, announceError } = useAnnouncer();
 *
 * // On form submit
 * announceLoading('Saving...');
 * try {
 *   await saveData();
 *   announceSuccess('Data saved successfully');
 * } catch (error) {
 *   announceError('Failed to save data');
 * }
 */
export function useAnnouncer(): AnnouncerContextValue {
  const context = useContext(AnnouncerContext);
  if (!context) {
    throw new Error('useAnnouncer must be used within an AnnouncerProvider');
  }
  return context;
}

// ----------------------------------------------------------------------------
// Provider Component
// ----------------------------------------------------------------------------

interface AnnouncerProviderProps {
  children: ReactNode;
}

export function AnnouncerProvider({ children }: AnnouncerProviderProps) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  // Use refs to track timeouts for cleanup
  const politeTimeoutRef = useRef<NodeJS.Timeout>();
  const assertiveTimeoutRef = useRef<NodeJS.Timeout>();

  const announce = useCallback((message: string, politeness: Politeness = 'polite') => {
    if (politeness === 'assertive') {
      // Clear existing timeout
      if (assertiveTimeoutRef.current) {
        clearTimeout(assertiveTimeoutRef.current);
      }
      // Clear then set to trigger re-announcement
      setAssertiveMessage('');
      requestAnimationFrame(() => {
        setAssertiveMessage(message);
      });
      // Clear message after a delay to allow re-announcements
      assertiveTimeoutRef.current = setTimeout(() => {
        setAssertiveMessage('');
      }, 1000);
    } else {
      // Clear existing timeout
      if (politeTimeoutRef.current) {
        clearTimeout(politeTimeoutRef.current);
      }
      // Clear then set to trigger re-announcement
      setPoliteMessage('');
      requestAnimationFrame(() => {
        setPoliteMessage(message);
      });
      // Clear message after a delay to allow re-announcements
      politeTimeoutRef.current = setTimeout(() => {
        setPoliteMessage('');
      }, 1000);
    }
  }, []);

  const announceLoading = useCallback((message = 'Loading...') => {
    announce(message, 'polite');
  }, [announce]);

  const announceSuccess = useCallback((message: string) => {
    announce(message, 'polite');
  }, [announce]);

  const announceError = useCallback((message: string) => {
    announce(message, 'assertive');
  }, [announce]);

  return (
    <AnnouncerContext.Provider
      value={{ announce, announceLoading, announceSuccess, announceError }}
    >
      {children}

      {/* Polite live region - for non-urgent updates */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>

      {/* Assertive live region - for urgent updates like errors */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
}

// ----------------------------------------------------------------------------
// Standalone Announcer Component (for simpler use cases)
// ----------------------------------------------------------------------------

interface AnnouncerProps {
  /** Message to announce */
  message: string;
  /** Politeness level (default: polite) */
  politeness?: Politeness;
  /** Whether to use role="alert" for assertive (default: true) */
  useAlert?: boolean;
}

/**
 * Standalone announcer component for simple announcements
 *
 * @example
 * {error && <Announcer message={error} politeness="assertive" />}
 * {isLoading && <Announcer message="Loading data..." />}
 */
export function Announcer({
  message,
  politeness = 'polite',
  useAlert = true
}: AnnouncerProps) {
  const role = politeness === 'assertive' && useAlert ? 'alert' : 'status';

  return (
    <div
      role={role}
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

export default Announcer;
