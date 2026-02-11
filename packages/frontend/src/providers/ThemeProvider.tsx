// ============================================================================
// THEME PROVIDER - Finance Hub
// Catppuccin theme support (Latte, Frappé, Macchiato, Mocha)
// With automatic time-based and system preference switching
// https://catppuccin.com
// ============================================================================

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type CatppuccinFlavor = 'latte' | 'frappe' | 'macchiato' | 'mocha';
export type ThemeMode = 'auto' | 'system' | CatppuccinFlavor;
/** @deprecated Use ThemeMode instead */
export type Theme = ThemeMode;

export interface AutoThemeConfig {
  lightTheme: CatppuccinFlavor;
  darkTheme: CatppuccinFlavor;
  lightStart: number; // Hour (0-23) when light theme starts
  lightEnd: number;   // Hour (0-23) when light theme ends
}

interface ThemeContextValue {
  /** Current theme mode setting */
  theme: ThemeMode;
  /** The actual resolved theme after applying auto/system logic */
  resolvedTheme: CatppuccinFlavor;
  /** Set the theme mode */
  setTheme: (theme: ThemeMode) => void;
  /** Cycle through available themes */
  cycleTheme: () => void;
  /** Whether the current resolved theme is dark */
  isDark: boolean;
  /** Whether auto mode is currently active */
  isAutoMode: boolean;
  /** Whether system mode is currently active */
  isSystemMode: boolean;
  /** Current indicator text for the active mode */
  modeIndicator: string;
  /** Auto theme configuration */
  autoConfig: AutoThemeConfig;
  /** Update auto theme configuration */
  setAutoConfig: (config: Partial<AutoThemeConfig>) => void;
}

// Theme metadata for UI
export const THEME_META: Record<CatppuccinFlavor, {
  label: string;
  labelFr: string;
  description: string;
  isDark: boolean;
  colors: {
    base: string;
    surface: string;
    text: string;
    blue: string;
    mauve: string;
    pink: string;
    green: string;
    red: string;
    peach: string;
    yellow: string;
  };
}> = {
  latte: {
    label: 'Latte',
    labelFr: 'Latte',
    description: 'Light theme with warm tones',
    isDark: false,
    colors: {
      base: '#eff1f5',
      surface: '#ccd0da',
      text: '#4c4f69',
      blue: '#1e66f5',
      mauve: '#8839ef',
      pink: '#ea76cb',
      green: '#40a02b',
      red: '#d20f39',
      peach: '#fe640b',
      yellow: '#df8e1d',
    },
  },
  frappe: {
    label: 'Frappé',
    labelFr: 'Frappé',
    description: 'Dark theme with muted colors',
    isDark: true,
    colors: {
      base: '#303446',
      surface: '#414559',
      text: '#c6d0f5',
      blue: '#8caaee',
      mauve: '#ca9ee6',
      pink: '#f4b8e4',
      green: '#a6d189',
      red: '#e78284',
      peach: '#ef9f76',
      yellow: '#e5c890',
    },
  },
  macchiato: {
    label: 'Macchiato',
    labelFr: 'Macchiato',
    description: 'Dark theme with vibrant colors',
    isDark: true,
    colors: {
      base: '#24273a',
      surface: '#363a4f',
      text: '#cad3f5',
      blue: '#8aadf4',
      mauve: '#c6a0f6',
      pink: '#f5bde6',
      green: '#a6da95',
      red: '#ed8796',
      peach: '#f5a97f',
      yellow: '#eed49f',
    },
  },
  mocha: {
    label: 'Mocha',
    labelFr: 'Mocha',
    description: 'Dark theme with rich colors',
    isDark: true,
    colors: {
      base: '#1e1e2e',
      surface: '#313244',
      text: '#cdd6f4',
      blue: '#89b4fa',
      mauve: '#cba6f7',
      pink: '#f5c2e7',
      green: '#a6e3a1',
      red: '#f38ba8',
      peach: '#fab387',
      yellow: '#f9e2af',
    },
  },
};

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const STORAGE_KEY = 'theme-mode';
const STORAGE_KEY_AUTO_CONFIG = 'theme-auto-config';
const FLAVORS: CatppuccinFlavor[] = ['latte', 'frappe', 'macchiato', 'mocha'];

const DEFAULT_AUTO_CONFIG: AutoThemeConfig = {
  lightTheme: 'latte',
  darkTheme: 'mocha',
  lightStart: 7,  // 7 AM
  lightEnd: 19,   // 7 PM
};

// ----------------------------------------------------------------------------
// Context
// ----------------------------------------------------------------------------

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function getSystemTheme(): CatppuccinFlavor {
  if (typeof window === 'undefined') return 'latte';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'mocha' : 'latte';
}

function getTimeBasedTheme(config: AutoThemeConfig): CatppuccinFlavor {
  if (typeof window === 'undefined') return config.lightTheme;

  const now = new Date();
  const currentHour = now.getHours();

  // Handle normal range (e.g., 7-19)
  if (config.lightStart < config.lightEnd) {
    const isDaytime = currentHour >= config.lightStart && currentHour < config.lightEnd;
    return isDaytime ? config.lightTheme : config.darkTheme;
  }

  // Handle overnight range (e.g., 22-6 would mean light from 10pm to 6am)
  const isDaytime = currentHour >= config.lightStart || currentHour < config.lightEnd;
  return isDaytime ? config.lightTheme : config.darkTheme;
}

function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && (FLAVORS.includes(stored as CatppuccinFlavor) || stored === 'system' || stored === 'auto')) {
    return stored as ThemeMode;
  }

  // Migration: check for old storage key
  const oldKey = 'finance-hub-catppuccin-theme';
  const oldStored = localStorage.getItem(oldKey);
  if (oldStored && (FLAVORS.includes(oldStored as CatppuccinFlavor) || oldStored === 'system')) {
    // Migrate to new key
    localStorage.setItem(STORAGE_KEY, oldStored);
    localStorage.removeItem(oldKey);
    return oldStored as ThemeMode;
  }

  return 'system';
}

function getStoredAutoConfig(): AutoThemeConfig {
  if (typeof window === 'undefined') return DEFAULT_AUTO_CONFIG;

  try {
    const stored = localStorage.getItem(STORAGE_KEY_AUTO_CONFIG);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AutoThemeConfig>;
      return { ...DEFAULT_AUTO_CONFIG, ...parsed };
    }
  } catch {
    // Ignore parse errors
  }

  return DEFAULT_AUTO_CONFIG;
}

function getModeIndicator(theme: ThemeMode, resolvedTheme: CatppuccinFlavor, config: AutoThemeConfig): string {
  if (theme === 'auto') {
    const now = new Date();
    const currentHour = now.getHours();
    let isDaytime: boolean;

    if (config.lightStart < config.lightEnd) {
      isDaytime = currentHour >= config.lightStart && currentHour < config.lightEnd;
    } else {
      isDaytime = currentHour >= config.lightStart || currentHour < config.lightEnd;
    }

    return isDaytime ? 'Jour' : 'Nuit';
  }

  if (theme === 'system') {
    return THEME_META[resolvedTheme].isDark ? 'Sombre' : 'Clair';
  }

  return THEME_META[resolvedTheme].labelFr;
}

function applyTheme(flavor: CatppuccinFlavor): void {
  const root = document.documentElement;

  // Remove all theme classes
  FLAVORS.forEach((f) => root.classList.remove(`theme-${f}`));
  root.classList.remove('dark');

  // Add new theme class
  root.classList.add(`theme-${flavor}`);

  // Add dark class for Tailwind compatibility (dark themes)
  if (THEME_META[flavor].isDark) {
    root.classList.add('dark');
  }
}

// ----------------------------------------------------------------------------
// Provider Component
// ----------------------------------------------------------------------------

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ThemeMode;
}

export function ThemeProvider({ children, defaultTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() => defaultTheme ?? getStoredTheme());
  const [systemTheme, setSystemTheme] = useState<CatppuccinFlavor>(getSystemTheme);
  const [autoConfig, setAutoConfigState] = useState<AutoThemeConfig>(getStoredAutoConfig);
  const [timeBasedTheme, setTimeBasedTheme] = useState<CatppuccinFlavor>(() =>
    getTimeBasedTheme(autoConfig)
  );

  // Compute resolved theme based on mode
  const resolvedTheme = useMemo<CatppuccinFlavor>(() => {
    if (theme === 'auto') {
      return timeBasedTheme;
    }
    if (theme === 'system') {
      return systemTheme;
    }
    return theme;
  }, [theme, systemTheme, timeBasedTheme]);

  // Mode indicators
  const isAutoMode = theme === 'auto';
  const isSystemMode = theme === 'system';
  const modeIndicator = useMemo(
    () => getModeIndicator(theme, resolvedTheme, autoConfig),
    [theme, resolvedTheme, autoConfig]
  );

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyTheme(resolvedTheme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, resolvedTheme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'mocha' : 'latte');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Time-based theme updates for auto mode
  useEffect(() => {
    if (theme !== 'auto') return;

    const checkTime = () => {
      const newTheme = getTimeBasedTheme(autoConfig);
      setTimeBasedTheme(newTheme);
    };

    // Check immediately
    checkTime();

    // Check every minute
    const intervalId = setInterval(checkTime, 60 * 1000);

    // Calculate time until next change and set a timeout
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentSeconds = now.getSeconds();

    let nextChangeHour: number;
    if (autoConfig.lightStart < autoConfig.lightEnd) {
      if (currentHour < autoConfig.lightStart) {
        nextChangeHour = autoConfig.lightStart;
      } else if (currentHour < autoConfig.lightEnd) {
        nextChangeHour = autoConfig.lightEnd;
      } else {
        nextChangeHour = autoConfig.lightStart + 24;
      }
    } else {
      if (currentHour < autoConfig.lightEnd) {
        nextChangeHour = autoConfig.lightEnd;
      } else if (currentHour < autoConfig.lightStart) {
        nextChangeHour = autoConfig.lightStart;
      } else {
        nextChangeHour = autoConfig.lightEnd + 24;
      }
    }

    const msUntilChange =
      ((nextChangeHour - currentHour) * 60 * 60 * 1000) -
      (currentMinutes * 60 * 1000) -
      (currentSeconds * 1000);

    const timeoutId = setTimeout(checkTime, msUntilChange);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [theme, autoConfig]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
  }, []);

  const setAutoConfig = useCallback((config: Partial<AutoThemeConfig>) => {
    setAutoConfigState((prev) => {
      const newConfig = { ...prev, ...config };
      localStorage.setItem(STORAGE_KEY_AUTO_CONFIG, JSON.stringify(newConfig));
      return newConfig;
    });
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const allOptions: ThemeMode[] = ['auto', 'system', ...FLAVORS];
      const currentIndex = allOptions.indexOf(current);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % allOptions.length;
      return allOptions[nextIndex] as ThemeMode;
    });
  }, []);

  const isDark = THEME_META[resolvedTheme].isDark;

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      cycleTheme,
      isDark,
      isAutoMode,
      isSystemMode,
      modeIndicator,
      autoConfig,
      setAutoConfig,
    }),
    [theme, resolvedTheme, setTheme, cycleTheme, isDark, isAutoMode, isSystemMode, modeIndicator, autoConfig, setAutoConfig]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeProvider;
