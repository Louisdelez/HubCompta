// ============================================================================
// AUTO THEME HOOK - Finance Hub
// Time-based automatic theme switching between light and dark modes
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { CatppuccinFlavor } from '@/providers/ThemeProvider';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type ThemeMode = 'auto' | 'system' | CatppuccinFlavor;

export interface TimeRange {
  lightStart: number; // Hour (0-23) when light theme starts
  lightEnd: number;   // Hour (0-23) when light theme ends (dark theme starts)
}

export interface AutoThemeConfig {
  /** Light theme flavor to use */
  lightTheme: CatppuccinFlavor;
  /** Dark theme flavor to use */
  darkTheme: CatppuccinFlavor;
  /** Time range for light theme (default: 7am-7pm) */
  timeRange: TimeRange;
}

interface UseAutoThemeReturn {
  /** Whether it's currently daytime (light theme time) */
  isDaytime: boolean;
  /** The resolved theme based on current time */
  resolvedTheme: CatppuccinFlavor;
  /** Time until next theme change in milliseconds */
  timeUntilChange: number;
  /** Get resolved theme for auto mode */
  getAutoTheme: () => CatppuccinFlavor;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const DEFAULT_CONFIG: AutoThemeConfig = {
  lightTheme: 'latte',
  darkTheme: 'mocha',
  timeRange: {
    lightStart: 7,  // 7 AM
    lightEnd: 19,   // 7 PM
  },
};

const STORAGE_KEY_AUTO_CONFIG = 'finance-hub-auto-theme-config';

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Determines if the current time is within the daytime range
 */
function isDaytimeNow(timeRange: TimeRange): boolean {
  const now = new Date();
  const currentHour = now.getHours();

  // Handle normal range (e.g., 7-19)
  if (timeRange.lightStart < timeRange.lightEnd) {
    return currentHour >= timeRange.lightStart && currentHour < timeRange.lightEnd;
  }

  // Handle overnight range (e.g., 22-6 would mean light from 10pm to 6am)
  return currentHour >= timeRange.lightStart || currentHour < timeRange.lightEnd;
}

/**
 * Calculates milliseconds until the next theme change
 */
function getTimeUntilChange(timeRange: TimeRange): number {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentSeconds = now.getSeconds();
  const currentMilliseconds = now.getMilliseconds();

  // Current time in milliseconds since midnight
  const currentTimeMs =
    (currentHour * 60 * 60 * 1000) +
    (currentMinutes * 60 * 1000) +
    (currentSeconds * 1000) +
    currentMilliseconds;

  // Light start and end times in milliseconds
  const lightStartMs = timeRange.lightStart * 60 * 60 * 1000;
  const lightEndMs = timeRange.lightEnd * 60 * 60 * 1000;

  let nextChangeMs: number;

  if (timeRange.lightStart < timeRange.lightEnd) {
    // Normal range (e.g., 7-19)
    if (currentTimeMs < lightStartMs) {
      nextChangeMs = lightStartMs;
    } else if (currentTimeMs < lightEndMs) {
      nextChangeMs = lightEndMs;
    } else {
      // After light end, next change is light start tomorrow
      nextChangeMs = lightStartMs + 24 * 60 * 60 * 1000;
    }
  } else {
    // Overnight range
    if (currentTimeMs < timeRange.lightEnd * 60 * 60 * 1000) {
      nextChangeMs = lightEndMs;
    } else if (currentTimeMs < lightStartMs) {
      nextChangeMs = lightStartMs;
    } else {
      // After light start, next change is light end tomorrow
      nextChangeMs = lightEndMs + 24 * 60 * 60 * 1000;
    }
  }

  return nextChangeMs - currentTimeMs;
}

/**
 * Load saved auto theme config from localStorage
 */
function loadAutoConfig(): AutoThemeConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;

  try {
    const stored = localStorage.getItem(STORAGE_KEY_AUTO_CONFIG);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AutoThemeConfig>;
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        timeRange: {
          ...DEFAULT_CONFIG.timeRange,
          ...parsed.timeRange,
        },
      };
    }
  } catch {
    // Ignore parse errors
  }

  return DEFAULT_CONFIG;
}

/**
 * Save auto theme config to localStorage
 */
export function saveAutoConfig(config: Partial<AutoThemeConfig>): void {
  if (typeof window === 'undefined') return;

  const currentConfig = loadAutoConfig();
  const newConfig: AutoThemeConfig = {
    ...currentConfig,
    ...config,
    timeRange: {
      ...currentConfig.timeRange,
      ...config.timeRange,
    },
  };

  localStorage.setItem(STORAGE_KEY_AUTO_CONFIG, JSON.stringify(newConfig));
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function useAutoTheme(customConfig?: Partial<AutoThemeConfig>): UseAutoThemeReturn {
  const [config] = useState<AutoThemeConfig>(() => {
    const savedConfig = loadAutoConfig();
    return {
      ...savedConfig,
      ...customConfig,
      timeRange: {
        ...savedConfig.timeRange,
        ...customConfig?.timeRange,
      },
    };
  });

  const [isDaytime, setIsDaytime] = useState<boolean>(() => isDaytimeNow(config.timeRange));
  const [timeUntilChange, setTimeUntilChange] = useState<number>(() =>
    getTimeUntilChange(config.timeRange)
  );

  // Update daytime status every minute and when time until change elapses
  useEffect(() => {
    const checkTime = () => {
      const newIsDaytime = isDaytimeNow(config.timeRange);
      setIsDaytime(newIsDaytime);
      setTimeUntilChange(getTimeUntilChange(config.timeRange));
    };

    // Check immediately
    checkTime();

    // Set up interval to check every minute
    const intervalId = setInterval(checkTime, 60 * 1000);

    // Also set a timeout for the exact moment of theme change
    const timeoutId = setTimeout(() => {
      checkTime();
    }, getTimeUntilChange(config.timeRange));

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [config.timeRange]);

  const resolvedTheme = useMemo<CatppuccinFlavor>(() => {
    return isDaytime ? config.lightTheme : config.darkTheme;
  }, [isDaytime, config.lightTheme, config.darkTheme]);

  const getAutoTheme = useCallback((): CatppuccinFlavor => {
    return isDaytimeNow(config.timeRange) ? config.lightTheme : config.darkTheme;
  }, [config]);

  return {
    isDaytime,
    resolvedTheme,
    timeUntilChange,
    getAutoTheme,
  };
}

export default useAutoTheme;
export { DEFAULT_CONFIG as AUTO_THEME_DEFAULT_CONFIG };
