// ============================================================================
// THEME TOGGLE - Finance Hub
// Catppuccin theme selector with light/dark/system options
// ============================================================================

import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Palette, Check, type LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { useTheme, THEME_META, type CatppuccinFlavor, type Theme } from '@/providers/ThemeProvider';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ThemeOption {
  value: Theme;
  label: string;
  description: string;
  icon: LucideIcon;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: 'system',
    label: 'Systeme',
    description: 'Suit les preferences du systeme',
    icon: Monitor,
  },
  {
    value: 'latte',
    label: 'Latte',
    description: 'Theme clair aux tons chauds',
    icon: Sun,
  },
  {
    value: 'frappe',
    label: 'Frappe',
    description: 'Theme sombre aux couleurs atenuees',
    icon: Moon,
  },
  {
    value: 'macchiato',
    label: 'Macchiato',
    description: 'Theme sombre aux couleurs vibrantes',
    icon: Moon,
  },
  {
    value: 'mocha',
    label: 'Mocha',
    description: 'Theme sombre aux couleurs riches',
    icon: Moon,
  },
];

// ----------------------------------------------------------------------------
// Theme Toggle Dropdown Component
// ----------------------------------------------------------------------------

interface ThemeToggleProps {
  /** Additional CSS classes */
  className?: string;
  /** Show as icon-only button or with label */
  variant?: 'icon' | 'button';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export function ThemeToggle({
  className,
  variant = 'icon',
  size = 'md',
}: ThemeToggleProps) {
  const { theme, setTheme, isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const currentOption = THEME_OPTIONS.find((opt) => opt.value === theme) ?? THEME_OPTIONS[0]!;

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  // Render the appropriate icon based on theme
  const renderThemeIcon = () => {
    const iconClass = iconSizeClasses[size];
    if (theme === 'system') {
      return isDark ? <Moon className={iconClass} /> : <Sun className={iconClass} />;
    }
    if (theme === 'latte') {
      return <Sun className={iconClass} />;
    }
    return <Moon className={iconClass} />;
  };

  return (
    <div className={clsx('relative', className)} ref={dropdownRef}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 rounded-lg transition-colors',
          'text-ctp-subtext1 hover:bg-ctp-surface0 hover:text-ctp-text',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue focus-visible:ring-offset-2 focus-visible:ring-offset-ctp-base',
          sizeClasses[size],
          variant === 'button' && 'px-3'
        )}
        aria-label={`Theme: ${currentOption.label}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={`Theme: ${currentOption.label}`}
      >
        {renderThemeIcon()}
        {variant === 'button' && (
          <span className="text-sm font-medium">{currentOption.label}</span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={clsx(
            'absolute right-0 top-full mt-2 z-50',
            'w-72 rounded-xl overflow-hidden',
            'bg-ctp-base border border-ctp-surface1',
            'shadow-lg shadow-black/20',
            'animate-in fade-in-0 zoom-in-95 duration-100'
          )}
          role="listbox"
          aria-label="Theme selection"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-ctp-surface0">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-ctp-mauve" />
              <span className="text-sm font-semibold text-ctp-text">
                Theme Catppuccin
              </span>
            </div>
            <p className="text-xs text-ctp-subtext0 mt-1">
              Choisissez votre palette de couleurs
            </p>
          </div>

          {/* Theme Options */}
          <div className="p-2">
            {THEME_OPTIONS.map((option) => {
              const isSelected = theme === option.value;
              const meta = option.value !== 'system'
                ? THEME_META[option.value as CatppuccinFlavor]
                : null;
              const OptionIcon = option.icon;

              return (
                <button
                  key={option.value}
                  onClick={() => {
                    setTheme(option.value);
                    setIsOpen(false);
                  }}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
                    'transition-colors duration-100',
                    isSelected
                      ? 'bg-ctp-blue/15 text-ctp-blue'
                      : 'text-ctp-text hover:bg-ctp-surface0'
                  )}
                  role="option"
                  aria-selected={isSelected}
                >
                  {/* Icon */}
                  <div
                    className={clsx(
                      'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                      isSelected
                        ? 'bg-ctp-blue/20'
                        : 'bg-ctp-surface0'
                    )}
                  >
                    <OptionIcon className="w-4 h-4" />
                  </div>

                  {/* Label and description */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium text-sm">{option.label}</div>
                    <div className="text-xs text-ctp-subtext0 truncate">
                      {option.description}
                    </div>
                  </div>

                  {/* Color preview dots */}
                  {meta && (
                    <div className="flex-shrink-0 flex gap-1">
                      <span
                        className="w-3 h-3 rounded-full ring-1 ring-inset ring-black/10"
                        style={{ backgroundColor: meta.colors.base }}
                        title="Base"
                      />
                      <span
                        className="w-3 h-3 rounded-full ring-1 ring-inset ring-black/10"
                        style={{ backgroundColor: meta.colors.blue }}
                        title="Accent"
                      />
                      <span
                        className="w-3 h-3 rounded-full ring-1 ring-inset ring-black/10"
                        style={{ backgroundColor: meta.colors.green }}
                        title="Success"
                      />
                    </div>
                  )}

                  {/* System indicator */}
                  {option.value === 'system' && !isSelected && (
                    <span className="flex-shrink-0 text-xs text-ctp-subtext0 bg-ctp-surface0 px-2 py-0.5 rounded">
                      Auto
                    </span>
                  )}

                  {/* Selected checkmark */}
                  {isSelected && (
                    <Check className="w-4 h-4 flex-shrink-0 text-ctp-blue" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Quick Toggle Component (cycles through themes)
// ----------------------------------------------------------------------------

interface ThemeQuickToggleProps {
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * A simpler toggle that cycles through themes on click.
 * Useful for compact UIs where a dropdown isn't needed.
 */
export function ThemeQuickToggle({
  className,
  size = 'md',
}: ThemeQuickToggleProps) {
  const { theme, cycleTheme, isDark } = useTheme();

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const currentOption = THEME_OPTIONS.find((opt) => opt.value === theme);

  // Render the appropriate icon based on theme
  const renderThemeIcon = () => {
    const iconClass = clsx(iconSizeClasses[size], 'transition-transform duration-200');
    if (theme === 'system') {
      return isDark ? <Moon className={iconClass} /> : <Sun className={iconClass} />;
    }
    if (theme === 'latte') {
      return <Sun className={iconClass} />;
    }
    return <Moon className={iconClass} />;
  };

  return (
    <button
      onClick={cycleTheme}
      className={clsx(
        'rounded-lg transition-all duration-200',
        'text-ctp-subtext1 hover:bg-ctp-surface0 hover:text-ctp-text',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue focus-visible:ring-offset-2 focus-visible:ring-offset-ctp-base',
        'active:scale-95',
        sizeClasses[size],
        className
      )}
      aria-label={`Theme: ${currentOption?.label ?? 'Unknown'}. Cliquez pour changer.`}
      title={`Theme: ${currentOption?.label ?? 'Unknown'}`}
    >
      {renderThemeIcon()}
    </button>
  );
}

export default ThemeToggle;
