/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ============================================================
        // CATPPUCCIN COLOR PALETTE
        // All 26 colors with alpha support
        // ============================================================
        ctp: {
          // Base/Background colors
          base: 'rgb(var(--ctp-base) / <alpha-value>)',
          mantle: 'rgb(var(--ctp-mantle) / <alpha-value>)',
          crust: 'rgb(var(--ctp-crust) / <alpha-value>)',

          // Surface colors (elevated elements)
          surface0: 'rgb(var(--ctp-surface0) / <alpha-value>)',
          surface1: 'rgb(var(--ctp-surface1) / <alpha-value>)',
          surface2: 'rgb(var(--ctp-surface2) / <alpha-value>)',

          // Overlay colors (popups, modals)
          overlay0: 'rgb(var(--ctp-overlay0) / <alpha-value>)',
          overlay1: 'rgb(var(--ctp-overlay1) / <alpha-value>)',
          overlay2: 'rgb(var(--ctp-overlay2) / <alpha-value>)',

          // Text colors
          text: 'rgb(var(--ctp-text) / <alpha-value>)',
          subtext0: 'rgb(var(--ctp-subtext0) / <alpha-value>)',
          subtext1: 'rgb(var(--ctp-subtext1) / <alpha-value>)',

          // Accent colors (full Catppuccin palette)
          rosewater: 'rgb(var(--ctp-rosewater) / <alpha-value>)',
          flamingo: 'rgb(var(--ctp-flamingo) / <alpha-value>)',
          pink: 'rgb(var(--ctp-pink) / <alpha-value>)',
          mauve: 'rgb(var(--ctp-mauve) / <alpha-value>)',
          red: 'rgb(var(--ctp-red) / <alpha-value>)',
          maroon: 'rgb(var(--ctp-maroon) / <alpha-value>)',
          peach: 'rgb(var(--ctp-peach) / <alpha-value>)',
          yellow: 'rgb(var(--ctp-yellow) / <alpha-value>)',
          green: 'rgb(var(--ctp-green) / <alpha-value>)',
          teal: 'rgb(var(--ctp-teal) / <alpha-value>)',
          sky: 'rgb(var(--ctp-sky) / <alpha-value>)',
          sapphire: 'rgb(var(--ctp-sapphire) / <alpha-value>)',
          blue: 'rgb(var(--ctp-blue) / <alpha-value>)',
          lavender: 'rgb(var(--ctp-lavender) / <alpha-value>)',
        },

        // ============================================================
        // SEMANTIC COLORS (using CSS variables)
        // ============================================================

        // Accounting colors
        income: 'rgb(var(--color-income) / <alpha-value>)',
        expense: 'rgb(var(--color-expense) / <alpha-value>)',
        transfer: 'rgb(var(--color-transfer) / <alpha-value>)',
        balance: 'rgb(var(--color-balance) / <alpha-value>)',
        savings: 'rgb(var(--color-savings) / <alpha-value>)',
        investment: 'rgb(var(--color-investment) / <alpha-value>)',
        budget: 'rgb(var(--color-budget) / <alpha-value>)',

        // Status colors
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',

        // Primary color
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          hover: 'rgb(var(--color-primary-hover) / <alpha-value>)',
        },

        // Surface/Background semantic
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          hover: 'rgb(var(--color-surface-hover) / <alpha-value>)',
          active: 'rgb(var(--color-surface-active) / <alpha-value>)',
        },

        // Border semantic
        border: {
          DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
          hover: 'rgb(var(--color-border-hover) / <alpha-value>)',
          focus: 'rgb(var(--color-border-focus) / <alpha-value>)',
        },
      },

      // ============================================================
      // TEXT COLORS
      // ============================================================
      textColor: {
        // Semantic text colors
        primary: 'rgb(var(--color-text) / <alpha-value>)',
        secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
        tertiary: 'rgb(var(--color-text-tertiary) / <alpha-value>)',
        muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
        disabled: 'rgb(var(--color-text-disabled) / <alpha-value>)',
      },

      // ============================================================
      // BACKGROUND COLORS
      // ============================================================
      backgroundColor: {
        // Semantic backgrounds
        base: 'rgb(var(--color-bg) / <alpha-value>)',
        'base-secondary': 'rgb(var(--color-bg-secondary) / <alpha-value>)',
        'base-tertiary': 'rgb(var(--color-bg-tertiary) / <alpha-value>)',
      },

      // ============================================================
      // TYPOGRAPHY
      // ============================================================
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
      },

      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },

      // ============================================================
      // SPACING & SIZING
      // ============================================================
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },

      borderRadius: {
        '4xl': '2rem',
      },

      // ============================================================
      // SHADOWS
      // ============================================================
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
        'elevated': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },

      // ============================================================
      // ANIMATIONS
      // ============================================================
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
