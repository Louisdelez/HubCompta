// ============================================================================
// USE RATE LIMIT HOOK TESTS - Finance Hub
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRateLimit } from './useRateLimit';
import { RateLimitError } from '@/lib/api/client';

describe('useRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Initial State
  // --------------------------------------------------------------------------

  describe('initial state', () => {
    it('should not be rate limited initially', () => {
      const { result } = renderHook(() => useRateLimit());

      expect(result.current.isRateLimited).toBe(false);
    });

    it('should have zero retryAfter initially', () => {
      const { result } = renderHook(() => useRateLimit());

      expect(result.current.retryAfter).toBe(0);
    });

    it('should have null message initially', () => {
      const { result } = renderHook(() => useRateLimit());

      expect(result.current.message).toBeNull();
    });

    it('should have zero hitCount initially', () => {
      const { result } = renderHook(() => useRateLimit());

      expect(result.current.hitCount).toBe(0);
    });

    it('should have empty formattedTimeRemaining initially', () => {
      const { result } = renderHook(() => useRateLimit());

      expect(result.current.formattedTimeRemaining).toBe('');
    });
  });

  // --------------------------------------------------------------------------
  // handleRateLimitError
  // --------------------------------------------------------------------------

  describe('handleRateLimitError', () => {
    it('should set isRateLimited to true when handling error', () => {
      const { result } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Too many requests', 60);

      act(() => {
        result.current.handleRateLimitError(error);
      });

      expect(result.current.isRateLimited).toBe(true);
    });

    it('should set retryAfter from error', () => {
      const { result } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Too many requests', 45);

      act(() => {
        result.current.handleRateLimitError(error);
      });

      expect(result.current.retryAfter).toBe(45);
    });

    it('should set message from error', () => {
      const { result } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Custom rate limit message', 60);

      act(() => {
        result.current.handleRateLimitError(error);
      });

      expect(result.current.message).toBe('Custom rate limit message');
    });

    it('should use default retryAfter of 60 when error has no retryAfter', () => {
      const { result } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Too many requests', 0);

      act(() => {
        result.current.handleRateLimitError(error);
      });

      expect(result.current.retryAfter).toBe(60);
    });

    it('should increment hitCount on each error', () => {
      const { result } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Too many requests', 60);

      act(() => {
        result.current.handleRateLimitError(error);
      });
      expect(result.current.hitCount).toBe(1);

      // Clear rate limit first to allow another error
      act(() => {
        result.current.clearRateLimit();
      });

      act(() => {
        result.current.handleRateLimitError(error);
      });
      // hitCount is reset by clearRateLimit, so it should be 1 again
      expect(result.current.hitCount).toBe(1);
    });

    it('should increment hitCount even while already rate limited', () => {
      const { result } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Too many requests', 60);

      act(() => {
        result.current.handleRateLimitError(error);
      });
      expect(result.current.hitCount).toBe(1);

      act(() => {
        result.current.handleRateLimitError(error);
      });
      expect(result.current.hitCount).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // Countdown Timer
  // --------------------------------------------------------------------------

  describe('countdown timer', () => {
    it('should countdown retryAfter every second', () => {
      const { result } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Too many requests', 5);

      act(() => {
        result.current.handleRateLimitError(error);
      });

      expect(result.current.retryAfter).toBe(5);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current.retryAfter).toBe(4);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current.retryAfter).toBe(3);
    });

    it('should clear rate limit when countdown reaches zero', () => {
      const { result } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Too many requests', 3);

      act(() => {
        result.current.handleRateLimitError(error);
      });

      expect(result.current.isRateLimited).toBe(true);

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.isRateLimited).toBe(false);
      expect(result.current.retryAfter).toBe(0);
      expect(result.current.message).toBeNull();
    });

    it('should stop countdown at zero', () => {
      const { result } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Too many requests', 2);

      act(() => {
        result.current.handleRateLimitError(error);
      });

      act(() => {
        vi.advanceTimersByTime(5000); // Advance way past zero
      });

      expect(result.current.retryAfter).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // clearRateLimit
  // --------------------------------------------------------------------------

  describe('clearRateLimit', () => {
    it('should clear all rate limit state', () => {
      const { result } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Too many requests', 60);

      act(() => {
        result.current.handleRateLimitError(error);
      });

      expect(result.current.isRateLimited).toBe(true);

      act(() => {
        result.current.clearRateLimit();
      });

      expect(result.current.isRateLimited).toBe(false);
      expect(result.current.retryAfter).toBe(0);
      expect(result.current.message).toBeNull();
      expect(result.current.hitCount).toBe(0);
    });

    it('should stop countdown timer', () => {
      const { result } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Too many requests', 60);

      act(() => {
        result.current.handleRateLimitError(error);
      });

      act(() => {
        result.current.clearRateLimit();
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.retryAfter).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // isRateLimitError
  // --------------------------------------------------------------------------

  describe('isRateLimitError', () => {
    it('should return true for RateLimitError instances', () => {
      const { result } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Too many requests', 60);

      expect(result.current.isRateLimitError(error)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const { result } = renderHook(() => useRateLimit());
      const error = new Error('Regular error');

      expect(result.current.isRateLimitError(error)).toBe(false);
    });

    it('should return false for null', () => {
      const { result } = renderHook(() => useRateLimit());

      expect(result.current.isRateLimitError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      const { result } = renderHook(() => useRateLimit());

      expect(result.current.isRateLimitError(undefined)).toBe(false);
    });

    it('should return false for plain objects', () => {
      const { result } = renderHook(() => useRateLimit());
      const obj = { message: 'error', retryAfter: 60 };

      expect(result.current.isRateLimitError(obj)).toBe(false);
    });

    it('should return false for strings', () => {
      const { result } = renderHook(() => useRateLimit());

      expect(result.current.isRateLimitError('error')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // formattedTimeRemaining
  // --------------------------------------------------------------------------

  describe('formattedTimeRemaining', () => {
    it('should format seconds only', () => {
      const { result } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Too many requests', 45);

      act(() => {
        result.current.handleRateLimitError(error);
      });

      expect(result.current.formattedTimeRemaining).toBe('45s');
    });

    it('should format minutes only when no seconds remain', () => {
      const { result } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Too many requests', 120);

      act(() => {
        result.current.handleRateLimitError(error);
      });

      expect(result.current.formattedTimeRemaining).toBe('2m');
    });

    it('should format minutes and seconds', () => {
      const { result } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Too many requests', 90);

      act(() => {
        result.current.handleRateLimitError(error);
      });

      expect(result.current.formattedTimeRemaining).toBe('1m 30s');
    });

    it('should return empty string when zero', () => {
      const { result } = renderHook(() => useRateLimit());

      expect(result.current.formattedTimeRemaining).toBe('');
    });

    it('should update as countdown progresses', () => {
      const { result } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Too many requests', 62);

      act(() => {
        result.current.handleRateLimitError(error);
      });

      expect(result.current.formattedTimeRemaining).toBe('1m 2s');

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.formattedTimeRemaining).toBe('59s');
    });
  });

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  describe('cleanup', () => {
    it('should clear timer on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { result, unmount } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Too many requests', 60);

      act(() => {
        result.current.handleRateLimitError(error);
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('should not leak timer after unmount', () => {
      const { result, unmount } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Too many requests', 60);

      act(() => {
        result.current.handleRateLimitError(error);
      });

      unmount();

      // This should not cause any issues
      act(() => {
        vi.advanceTimersByTime(5000);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Callback Stability
  // --------------------------------------------------------------------------

  describe('callback stability', () => {
    it('should return stable handleRateLimitError callback', () => {
      const { result, rerender } = renderHook(() => useRateLimit());

      const firstCallback = result.current.handleRateLimitError;
      rerender();
      const secondCallback = result.current.handleRateLimitError;

      expect(firstCallback).toBe(secondCallback);
    });

    it('should return stable clearRateLimit callback', () => {
      const { result, rerender } = renderHook(() => useRateLimit());

      const firstCallback = result.current.clearRateLimit;
      rerender();
      const secondCallback = result.current.clearRateLimit;

      expect(firstCallback).toBe(secondCallback);
    });

    it('should return stable isRateLimitError callback', () => {
      const { result, rerender } = renderHook(() => useRateLimit());

      const firstCallback = result.current.isRateLimitError;
      rerender();
      const secondCallback = result.current.isRateLimitError;

      expect(firstCallback).toBe(secondCallback);
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle very large retryAfter values', () => {
      const { result } = renderHook(() => useRateLimit());
      const error = new RateLimitError('Too many requests', 3600); // 1 hour

      act(() => {
        result.current.handleRateLimitError(error);
      });

      expect(result.current.retryAfter).toBe(3600);
      expect(result.current.formattedTimeRemaining).toBe('60m');
    });

    it('should handle consecutive rate limit errors', () => {
      const { result } = renderHook(() => useRateLimit());

      act(() => {
        result.current.handleRateLimitError(new RateLimitError('First', 30));
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      act(() => {
        result.current.handleRateLimitError(new RateLimitError('Second', 60));
      });

      expect(result.current.retryAfter).toBe(60);
      expect(result.current.message).toBe('Second');
      expect(result.current.hitCount).toBe(2);
    });

    it('should restart countdown when new error is handled', () => {
      const { result } = renderHook(() => useRateLimit());

      act(() => {
        result.current.handleRateLimitError(new RateLimitError('First', 10));
      });

      act(() => {
        vi.advanceTimersByTime(5000); // 5 seconds
      });

      expect(result.current.retryAfter).toBe(5);

      act(() => {
        result.current.handleRateLimitError(new RateLimitError('Second', 20));
      });

      expect(result.current.retryAfter).toBe(20);
    });
  });
});
