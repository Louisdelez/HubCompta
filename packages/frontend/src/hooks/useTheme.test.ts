// ============================================================================
// USE THEME HOOK TESTS - Finance Hub
// Tests for the ThemeProvider-based theme system with Catppuccin support
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { ThemeProvider, useTheme, type ThemeMode } from '@/providers/ThemeProvider';

// ----------------------------------------------------------------------------
// Test Wrapper
// ----------------------------------------------------------------------------

function createWrapper(defaultTheme?: ThemeMode) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const props = defaultTheme !== undefined
      ? { defaultTheme, children }
      : { children };
    return createElement(ThemeProvider, props);
  };
}

// ----------------------------------------------------------------------------
// Mock localStorage
// ----------------------------------------------------------------------------

class MockStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }
}

// ----------------------------------------------------------------------------
// Test Setup
// ----------------------------------------------------------------------------

describe('useTheme', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>;
  let addEventListenerMock: ReturnType<typeof vi.fn>;
  let removeEventListenerMock: ReturnType<typeof vi.fn>;
  let mockStorage: MockStorage;

  beforeEach(() => {
    // Setup localStorage mock
    mockStorage = new MockStorage();
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
    });

    // Mock matchMedia
    addEventListenerMock = vi.fn();
    removeEventListenerMock = vi.fn();
    matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    });

    // Reset document classList
    document.documentElement.classList.remove('dark', 'theme-latte', 'theme-frappe', 'theme-macchiato', 'theme-mocha');
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark', 'theme-latte', 'theme-frappe', 'theme-macchiato', 'theme-mocha');
    mockStorage.clear();
  });

  // --------------------------------------------------------------------------
  // Initial State
  // --------------------------------------------------------------------------

  describe('initial state', () => {
    it('should default to system theme when no stored preference', () => {
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      expect(result.current.theme).toBe('system');
    });

    it('should load stored theme from localStorage', () => {
      mockStorage.setItem('theme-mode', 'mocha');

      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      expect(result.current.theme).toBe('mocha');
    });

    it('should handle invalid stored theme and default to system', () => {
      mockStorage.setItem('theme-mode', 'invalid');

      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      expect(result.current.theme).toBe('system');
    });

    it('should load latte (light) theme from localStorage', () => {
      mockStorage.setItem('theme-mode', 'latte');

      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      expect(result.current.theme).toBe('latte');
    });

    it('should migrate from old storage key', () => {
      mockStorage.setItem('finance-hub-catppuccin-theme', 'frappe');

      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      expect(result.current.theme).toBe('frappe');
      expect(mockStorage.getItem('theme-mode')).toBe('frappe');
      expect(mockStorage.getItem('finance-hub-catppuccin-theme')).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Resolved Theme
  // --------------------------------------------------------------------------

  describe('resolvedTheme', () => {
    it('should return latte when theme is latte', () => {
      mockStorage.setItem('theme-mode', 'latte');

      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      expect(result.current.resolvedTheme).toBe('latte');
    });

    it('should return mocha when theme is mocha', () => {
      mockStorage.setItem('theme-mode', 'mocha');

      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      expect(result.current.resolvedTheme).toBe('mocha');
    });

    it('should return latte when theme is system and prefers light', () => {
      matchMediaMock.mockImplementation((query: string) => ({
        matches: false, // prefers-color-scheme: dark returns false = light
        media: query,
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      }));

      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      expect(result.current.theme).toBe('system');
      expect(result.current.resolvedTheme).toBe('latte');
    });

    it('should return mocha when theme is system and prefers dark', () => {
      matchMediaMock.mockImplementation((query: string) => ({
        matches: true, // prefers-color-scheme: dark returns true = dark
        media: query,
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      }));

      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      expect(result.current.theme).toBe('system');
      expect(result.current.resolvedTheme).toBe('mocha');
    });
  });

  // --------------------------------------------------------------------------
  // setTheme
  // --------------------------------------------------------------------------

  describe('setTheme', () => {
    it('should update theme to mocha', () => {
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      act(() => {
        result.current.setTheme('mocha');
      });

      expect(result.current.theme).toBe('mocha');
      expect(result.current.resolvedTheme).toBe('mocha');
    });

    it('should update theme to latte', () => {
      mockStorage.setItem('theme-mode', 'mocha');
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      act(() => {
        result.current.setTheme('latte');
      });

      expect(result.current.theme).toBe('latte');
      expect(result.current.resolvedTheme).toBe('latte');
    });

    it('should update theme to system', () => {
      mockStorage.setItem('theme-mode', 'mocha');
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      act(() => {
        result.current.setTheme('system');
      });

      expect(result.current.theme).toBe('system');
    });

    it('should update theme to auto', () => {
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      act(() => {
        result.current.setTheme('auto');
      });

      expect(result.current.theme).toBe('auto');
      expect(result.current.isAutoMode).toBe(true);
    });

    it('should persist theme to localStorage', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      act(() => {
        result.current.setTheme('mocha');
      });

      await waitFor(() => {
        expect(mockStorage.getItem('theme-mode')).toBe('mocha');
      });
    });

    it('should add dark class to document when setting mocha theme', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      act(() => {
        result.current.setTheme('mocha');
      });

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.classList.contains('theme-mocha')).toBe(true);
      });
    });

    it('should remove dark class from document when setting latte theme', async () => {
      document.documentElement.classList.add('dark', 'theme-mocha');
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      act(() => {
        result.current.setTheme('latte');
      });

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        expect(document.documentElement.classList.contains('theme-latte')).toBe(true);
      });
    });
  });

  // --------------------------------------------------------------------------
  // cycleTheme
  // --------------------------------------------------------------------------

  describe('cycleTheme', () => {
    it('should cycle from auto to system', () => {
      mockStorage.setItem('theme-mode', 'auto');
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      act(() => {
        result.current.cycleTheme();
      });

      expect(result.current.theme).toBe('system');
    });

    it('should cycle from system to latte', () => {
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      act(() => {
        result.current.cycleTheme();
      });

      expect(result.current.theme).toBe('latte');
    });

    it('should cycle from mocha to auto', () => {
      mockStorage.setItem('theme-mode', 'mocha');
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      act(() => {
        result.current.cycleTheme();
      });

      expect(result.current.theme).toBe('auto');
    });

    it('should complete full cycle: auto -> system -> latte -> frappe -> macchiato -> mocha -> auto', () => {
      mockStorage.setItem('theme-mode', 'auto');
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      expect(result.current.theme).toBe('auto');

      act(() => result.current.cycleTheme());
      expect(result.current.theme).toBe('system');

      act(() => result.current.cycleTheme());
      expect(result.current.theme).toBe('latte');

      act(() => result.current.cycleTheme());
      expect(result.current.theme).toBe('frappe');

      act(() => result.current.cycleTheme());
      expect(result.current.theme).toBe('macchiato');

      act(() => result.current.cycleTheme());
      expect(result.current.theme).toBe('mocha');

      act(() => result.current.cycleTheme());
      expect(result.current.theme).toBe('auto');
    });
  });

  // --------------------------------------------------------------------------
  // System Theme Changes
  // --------------------------------------------------------------------------

  describe('system theme changes', () => {
    it('should listen for system theme changes', () => {
      renderHook(() => useTheme(), { wrapper: createWrapper() });

      expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should update resolvedTheme when system theme changes', () => {
      let changeCallback: (e: { matches: boolean }) => void;
      addEventListenerMock.mockImplementation((event: string, callback: (e: { matches: boolean }) => void) => {
        if (event === 'change') {
          changeCallback = callback;
        }
      });

      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      // Initial state with theme=system
      expect(result.current.theme).toBe('system');
      expect(result.current.resolvedTheme).toBe('latte'); // matchMedia returns false by default

      // Simulate system dark mode change
      act(() => {
        changeCallback({ matches: true });
      });

      expect(result.current.resolvedTheme).toBe('mocha');
    });

    it('should not update resolved theme when not using system theme', () => {
      let changeCallback: (e: { matches: boolean }) => void;
      addEventListenerMock.mockImplementation((event: string, callback: (e: { matches: boolean }) => void) => {
        if (event === 'change') {
          changeCallback = callback;
        }
      });

      mockStorage.setItem('theme-mode', 'latte');
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      // Simulate system dark mode change
      act(() => {
        changeCallback({ matches: true });
      });

      // Theme is explicitly 'latte', so resolvedTheme should remain 'latte'
      expect(result.current.resolvedTheme).toBe('latte');
    });

    it('should cleanup event listener on unmount', () => {
      const { unmount } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      unmount();

      expect(removeEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  // --------------------------------------------------------------------------
  // DOM Class Management
  // --------------------------------------------------------------------------

  describe('DOM class management', () => {
    it('should add dark class on mount when theme is mocha', async () => {
      mockStorage.setItem('theme-mode', 'mocha');

      renderHook(() => useTheme(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.classList.contains('theme-mocha')).toBe(true);
      });
    });

    it('should not add dark class on mount when theme is latte', async () => {
      mockStorage.setItem('theme-mode', 'latte');

      renderHook(() => useTheme(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        expect(document.documentElement.classList.contains('theme-latte')).toBe(true);
      });
    });

    it('should add dark class when system theme is dark', async () => {
      matchMediaMock.mockImplementation((query: string) => ({
        matches: true, // prefers dark
        media: query,
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      }));

      renderHook(() => useTheme(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Mode Indicators
  // --------------------------------------------------------------------------

  describe('mode indicators', () => {
    it('should have isAutoMode true when theme is auto', () => {
      mockStorage.setItem('theme-mode', 'auto');
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      expect(result.current.isAutoMode).toBe(true);
      expect(result.current.isSystemMode).toBe(false);
    });

    it('should have isSystemMode true when theme is system', () => {
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      expect(result.current.isSystemMode).toBe(true);
      expect(result.current.isAutoMode).toBe(false);
    });

    it('should have isDark true when resolved theme is dark', () => {
      mockStorage.setItem('theme-mode', 'mocha');
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      expect(result.current.isDark).toBe(true);
    });

    it('should have isDark false when resolved theme is latte', () => {
      mockStorage.setItem('theme-mode', 'latte');
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      expect(result.current.isDark).toBe(false);
    });

    it('should provide modeIndicator string', () => {
      mockStorage.setItem('theme-mode', 'system');
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      expect(typeof result.current.modeIndicator).toBe('string');
      expect(result.current.modeIndicator.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // Auto Theme Config
  // --------------------------------------------------------------------------

  describe('auto theme configuration', () => {
    it('should have default auto config', () => {
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      expect(result.current.autoConfig).toEqual({
        lightTheme: 'latte',
        darkTheme: 'mocha',
        lightStart: 7,
        lightEnd: 19,
      });
    });

    it('should update auto config', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      act(() => {
        result.current.setAutoConfig({ lightStart: 6, lightEnd: 20 });
      });

      await waitFor(() => {
        expect(result.current.autoConfig.lightStart).toBe(6);
        expect(result.current.autoConfig.lightEnd).toBe(20);
      });
    });

    it('should persist auto config to localStorage', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      act(() => {
        result.current.setAutoConfig({ lightTheme: 'frappe', darkTheme: 'macchiato' });
      });

      await waitFor(() => {
        const stored = mockStorage.getItem('theme-auto-config');
        expect(stored).toBeDefined();
        if (stored) {
          const parsed = JSON.parse(stored);
          expect(parsed.lightTheme).toBe('frappe');
          expect(parsed.darkTheme).toBe('macchiato');
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // Memoization & Callbacks
  // --------------------------------------------------------------------------

  describe('memoization', () => {
    it('should return stable setTheme callback', () => {
      const { result, rerender } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      const firstSetTheme = result.current.setTheme;
      rerender();
      const secondSetTheme = result.current.setTheme;

      expect(firstSetTheme).toBe(secondSetTheme);
    });

    it('should return stable cycleTheme callback', () => {
      const { result, rerender } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      const firstCycleTheme = result.current.cycleTheme;
      rerender();
      const secondCycleTheme = result.current.cycleTheme;

      expect(firstCycleTheme).toBe(secondCycleTheme);
    });

    it('should return stable setAutoConfig callback', () => {
      const { result, rerender } = renderHook(() => useTheme(), { wrapper: createWrapper() });

      const firstSetAutoConfig = result.current.setAutoConfig;
      rerender();
      const secondSetAutoConfig = result.current.setAutoConfig;

      expect(firstSetAutoConfig).toBe(secondSetAutoConfig);
    });
  });
});
