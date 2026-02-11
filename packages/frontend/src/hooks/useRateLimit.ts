// ============================================================================
// RATE LIMIT HOOK - HubCompta
// Hook for handling rate limit errors in React components
// ============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { RateLimitError } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface RateLimitState {
  /** Whether currently rate limited */
  isRateLimited: boolean;
  /** Seconds remaining until retry is allowed */
  retryAfter: number;
  /** Error message to display */
  message: string | null;
  /** Number of times rate limit was hit */
  hitCount: number;
}

export interface UseRateLimitResult extends RateLimitState {
  /** Handle a rate limit error */
  handleRateLimitError: (error: RateLimitError) => void;
  /** Clear the rate limit state */
  clearRateLimit: () => void;
  /** Check if an error is a rate limit error */
  isRateLimitError: (error: unknown) => error is RateLimitError;
  /** Formatted time remaining (e.g., "45s" or "1m 30s") */
  formattedTimeRemaining: string;
}

// ----------------------------------------------------------------------------
// Hook Implementation
// ----------------------------------------------------------------------------

/**
 * Hook for handling rate limit errors in React components
 *
 * @example
 * ```tsx
 * const { isRateLimited, retryAfter, handleRateLimitError, formattedTimeRemaining } = useRateLimit();
 *
 * const handleSubmit = async () => {
 *   try {
 *     await api.post('/login', data);
 *   } catch (error) {
 *     if (isRateLimitError(error)) {
 *       handleRateLimitError(error);
 *     } else {
 *       // Handle other errors
 *     }
 *   }
 * };
 *
 * if (isRateLimited) {
 *   return <div>Trop de tentatives. Reessayez dans {formattedTimeRemaining}</div>;
 * }
 * ```
 */
export function useRateLimit(): UseRateLimitResult {
  const [state, setState] = useState<RateLimitState>({
    isRateLimited: false,
    retryAfter: 0,
    message: null,
    hitCount: 0,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear any existing timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Countdown timer effect
  useEffect(() => {
    // Only start timer when rate limited and there's time remaining
    if (!state.isRateLimited || state.retryAfter <= 0) {
      return;
    }

    timerRef.current = setInterval(() => {
      setState((prev) => {
        const newRetryAfter = Math.max(0, prev.retryAfter - 1);
        if (newRetryAfter === 0) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return {
            ...prev,
            isRateLimited: false,
            retryAfter: 0,
            message: null,
          };
        }
        return {
          ...prev,
          retryAfter: newRetryAfter,
        };
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state.isRateLimited, state.retryAfter]);

  const handleRateLimitError = useCallback((error: RateLimitError) => {
    setState((prev) => ({
      isRateLimited: true,
      retryAfter: error.retryAfter || 60,
      message: error.message,
      hitCount: prev.hitCount + 1,
    }));
  }, []);

  const clearRateLimit = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState({
      isRateLimited: false,
      retryAfter: 0,
      message: null,
      hitCount: 0,
    });
  }, []);

  const isRateLimitError = useCallback(
    (error: unknown): error is RateLimitError => {
      return error instanceof RateLimitError;
    },
    []
  );

  const formattedTimeRemaining = formatTimeRemaining(state.retryAfter);

  return {
    ...state,
    handleRateLimitError,
    clearRateLimit,
    isRateLimitError,
    formattedTimeRemaining,
  };
}

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------

/**
 * Format seconds into a human-readable string
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '';

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

export default useRateLimit;
