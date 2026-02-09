// ============================================================================
// THEME PROVIDER - Finance Hub
// Catppuccin theme support (Latte, Frappé, Macchiato, Mocha)
// https://catppuccin.com
// ============================================================================

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type CatppuccinFlavor = 'latte' | 'frappe' | 'macchiato' | 'mocha';
export type Theme = CatppuccinFlavor | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: CatppuccinFlavor;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
  isDark: boolean;
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

const STORAGE_KEY = 'finance-hub-catppuccin-theme';
const FLAVORS: CatppuccinFlavor[] = ['latte', 'frappe', 'macchiato', 'mocha'];

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

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && (FLAVORS.includes(stored as CatppuccinFlavor) || stored === 'system')) {
    return stored as Theme;
  }
  return 'system';
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
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => defaultTheme ?? getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<CatppuccinFlavor>(() => {
    const initial = defaultTheme ?? getStoredTheme();
    return initial === 'system' ? getSystemTheme() : initial;
  });

  // Apply theme on mount and when theme changes
  useEffect(() => {
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    setResolvedTheme(resolved);
    applyTheme(resolved);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        const newTheme = e.matches ? 'mocha' : 'latte';
        setResolvedTheme(newTheme);
        applyTheme(newTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const allOptions: Theme[] = [...FLAVORS, 'system'];
      const currentIndex = allOptions.indexOf(current);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % allOptions.length;
      return allOptions[nextIndex] as Theme;
    });
  }, []);

  const isDark = THEME_META[resolvedTheme].isDark;

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, cycleTheme, isDark }}>
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
