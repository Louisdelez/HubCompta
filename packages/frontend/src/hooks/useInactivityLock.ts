// ============================================================================
// INACTIVITY LOCK HOOK - Finance Hub
// ============================================================================

import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const DEFAULT_LOCK_TIMEOUT = 10 * 60 * 1000; // 10 minutes in ms
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const;

// Throttle activity updates to avoid excessive calls
const ACTIVITY_THROTTLE = 30 * 1000; // 30 seconds

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

interface UseInactivityLockOptions {
  timeout?: number;
  enabled?: boolean;
  onLock?: () => void;
  onWarning?: (remainingMs: number) => void;
  warningBeforeMs?: number;
}

export function useInactivityLock(options: UseInactivityLockOptions = {}) {
  const {
    timeout = DEFAULT_LOCK_TIMEOUT,
    enabled = true,
    onLock,
    onWarning,
    warningBeforeMs = 60 * 1000, // 1 minute warning
  } = options;

  const { isAuthenticated, isLocked, lock } = useAuth();
  const lastActivityRef = useRef<number>(Date.now());
  const lockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const throttleRef = useRef<number>(0);

  // Clear all timeouts
  const clearTimeouts = useCallback(() => {
    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
  }, []);

  // Schedule lock
  const scheduleLock = useCallback(() => {
    clearTimeouts();

    // Schedule warning
    if (onWarning && warningBeforeMs < timeout) {
      warningTimeoutRef.current = setTimeout(() => {
        onWarning(warningBeforeMs);
      }, timeout - warningBeforeMs);
    }

    // Schedule lock
    lockTimeoutRef.current = setTimeout(() => {
      lock();
      onLock?.();
    }, timeout);
  }, [timeout, warningBeforeMs, onWarning, onLock, lock, clearTimeouts]);

  // Handle activity
  const handleActivity = useCallback(() => {
    const now = Date.now();

    // Throttle activity updates
    if (now - throttleRef.current < ACTIVITY_THROTTLE) {
      return;
    }

    throttleRef.current = now;
    lastActivityRef.current = now;

    // Reschedule lock
    if (enabled && isAuthenticated && !isLocked) {
      scheduleLock();
    }
  }, [enabled, isAuthenticated, isLocked, scheduleLock]);

  // Set up event listeners
  useEffect(() => {
    if (!enabled || !isAuthenticated || isLocked) {
      clearTimeouts();
      return;
    }

    // Initial schedule
    scheduleLock();

    // Add activity listeners
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if we should have locked while hidden
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= timeout) {
          lock();
          onLock?.();
        } else {
          scheduleLock();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeouts();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    enabled,
    isAuthenticated,
    isLocked,
    timeout,
    handleActivity,
    scheduleLock,
    clearTimeouts,
    lock,
    onLock,
  ]);

  // Return current state
  return {
    lastActivity: lastActivityRef.current,
    remainingTime: Math.max(0, timeout - (Date.now() - lastActivityRef.current)),
    isEnabled: enabled && isAuthenticated && !isLocked,
  };
}

export default useInactivityLock;
