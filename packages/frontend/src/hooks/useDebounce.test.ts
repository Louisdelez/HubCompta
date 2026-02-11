// ============================================================================
// USE DEBOUNCE HOOK TESTS - Finance Hub
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Initial Value
  // --------------------------------------------------------------------------

  describe('initial value', () => {
    it('should return initial value immediately', () => {
      const { result } = renderHook(() => useDebounce('initial', 500));

      expect(result.current).toBe('initial');
    });

    it('should handle empty string as initial value', () => {
      const { result } = renderHook(() => useDebounce('', 500));

      expect(result.current).toBe('');
    });

    it('should handle number as initial value', () => {
      const { result } = renderHook(() => useDebounce(42, 500));

      expect(result.current).toBe(42);
    });

    it('should handle object as initial value', () => {
      const initialObject = { name: 'test', value: 123 };
      const { result } = renderHook(() => useDebounce(initialObject, 500));

      expect(result.current).toEqual(initialObject);
    });

    it('should handle null as initial value', () => {
      const { result } = renderHook(() => useDebounce(null, 500));

      expect(result.current).toBeNull();
    });

    it('should handle undefined as initial value', () => {
      const { result } = renderHook(() => useDebounce(undefined, 500));

      expect(result.current).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Debounce Behavior
  // --------------------------------------------------------------------------

  describe('debounce behavior', () => {
    it('should not update value immediately when value changes', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      rerender({ value: 'updated', delay: 500 });

      // Value should still be 'initial' immediately after change
      expect(result.current).toBe('initial');
    });

    it('should update value after delay', async () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      rerender({ value: 'updated', delay: 500 });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current).toBe('updated');
    });

    it('should reset timer when value changes before delay', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      // First update
      rerender({ value: 'first', delay: 500 });

      // Advance timer partially
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Value should still be 'initial'
      expect(result.current).toBe('initial');

      // Second update (should reset timer)
      rerender({ value: 'second', delay: 500 });

      // Advance timer by another 300ms (total 600ms, but timer was reset)
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Value should still be 'initial' because timer was reset
      expect(result.current).toBe('initial');

      // Complete the remaining 200ms
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Now value should be 'second'
      expect(result.current).toBe('second');
    });

    it('should handle rapid value changes', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      // Rapid changes
      rerender({ value: 'a', delay: 500 });
      rerender({ value: 'ab', delay: 500 });
      rerender({ value: 'abc', delay: 500 });
      rerender({ value: 'abcd', delay: 500 });

      // Should still be 'initial'
      expect(result.current).toBe('initial');

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should be the last value
      expect(result.current).toBe('abcd');
    });
  });

  // --------------------------------------------------------------------------
  // Different Delays
  // --------------------------------------------------------------------------

  describe('different delays', () => {
    it('should respect short delay (100ms)', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 100 } }
      );

      rerender({ value: 'updated', delay: 100 });

      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(result.current).toBe('initial');

      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(result.current).toBe('updated');
    });

    it('should respect long delay (2000ms)', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 2000 } }
      );

      rerender({ value: 'updated', delay: 2000 });

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current).toBe('initial');

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current).toBe('updated');
    });

    it('should handle zero delay', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 0 } }
      );

      rerender({ value: 'updated', delay: 0 });

      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(result.current).toBe('updated');
    });

    it('should update timer when delay changes', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      rerender({ value: 'updated', delay: 500 });

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current).toBe('initial');

      // Change delay to shorter value
      rerender({ value: 'updated', delay: 100 });

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(result.current).toBe('updated');
    });
  });

  // --------------------------------------------------------------------------
  // Type Safety
  // --------------------------------------------------------------------------

  describe('type safety', () => {
    it('should preserve string type', () => {
      const { result } = renderHook(() => useDebounce('test', 500));

      // TypeScript should infer result.current as string
      const value: string = result.current;
      expect(typeof value).toBe('string');
    });

    it('should preserve number type', () => {
      const { result } = renderHook(() => useDebounce(123, 500));

      // TypeScript should infer result.current as number
      const value: number = result.current;
      expect(typeof value).toBe('number');
    });

    it('should preserve boolean type', () => {
      const { result } = renderHook(() => useDebounce(true, 500));

      // TypeScript should infer result.current as boolean
      const value: boolean = result.current;
      expect(typeof value).toBe('boolean');
    });

    it('should preserve array type', () => {
      const { result } = renderHook(() => useDebounce([1, 2, 3], 500));

      expect(Array.isArray(result.current)).toBe(true);
      expect(result.current).toEqual([1, 2, 3]);
    });

    it('should preserve complex object type', () => {
      interface TestObject {
        id: number;
        name: string;
        nested: { value: boolean };
      }

      const testObject: TestObject = {
        id: 1,
        name: 'test',
        nested: { value: true },
      };

      const { result } = renderHook(() => useDebounce(testObject, 500));

      expect(result.current).toEqual(testObject);
      expect(result.current.nested.value).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  describe('cleanup', () => {
    it('should clear timeout on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { unmount, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      rerender({ value: 'updated', delay: 500 });
      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('should not cause memory leaks with multiple rapid updates', () => {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { rerender, unmount } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      // Rapid updates
      for (let i = 0; i < 100; i++) {
        rerender({ value: `value-${i}`, delay: 500 });
      }

      // Each update should clear the previous timeout
      // clearTimeout should be called at least 99 times (100 updates - 1)
      expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThanOrEqual(99);

      unmount();

      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle same value being set multiple times', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'test', delay: 500 } }
      );

      rerender({ value: 'test', delay: 500 });
      rerender({ value: 'test', delay: 500 });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current).toBe('test');
    });

    it('should handle value changing back to initial', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      rerender({ value: 'changed', delay: 500 });

      act(() => {
        vi.advanceTimersByTime(250);
      });

      rerender({ value: 'initial', delay: 500 });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current).toBe('initial');
    });
  });
});
