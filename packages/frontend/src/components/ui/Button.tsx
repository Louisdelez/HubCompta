// ============================================================================
// BUTTON COMPONENT - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// Includes accessibility features: aria-disabled, aria-busy, visible focus states
// ============================================================================

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Loading text announced to screen readers (default: "Loading") */
  loadingText?: string;
  icon?: ReactNode;
  /** ARIA label for icon-only buttons (required when no children) */
  'aria-label'?: string;
  children?: ReactNode;
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const baseStyles =
  'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-ctp-base disabled:opacity-50 disabled:cursor-not-allowed';

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-ctp-blue text-ctp-crust hover:bg-ctp-sapphire focus:ring-ctp-blue shadow-sm',
  secondary:
    'bg-ctp-surface0 text-ctp-text hover:bg-ctp-surface1 focus:ring-ctp-surface2 border border-ctp-surface1',
  danger:
    'bg-ctp-red text-ctp-crust hover:bg-ctp-maroon focus:ring-ctp-red shadow-sm',
  ghost:
    'text-ctp-text hover:bg-ctp-surface0 focus:ring-ctp-surface1',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
  lg: 'text-base px-6 py-3 gap-2.5',
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      loadingText = 'Loading',
      disabled,
      icon,
      children,
      className,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) {
    const isDisabled = disabled || loading;

    // Warn in dev if icon-only button lacks aria-label
    if (process.env.NODE_ENV === 'development' && icon && !children && !ariaLabel) {
      console.warn(
        'Button: Icon-only buttons should have an aria-label for accessibility'
      );
    }

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        aria-label={ariaLabel}
        className={clsx(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <span
              className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
            <span className="sr-only">{loadingText}</span>
          </>
        ) : icon ? (
          <span className="flex-shrink-0" aria-hidden={!!ariaLabel}>
            {icon}
          </span>
        ) : null}
        {children && <span>{children}</span>}
      </button>
    );
  }
);

export default Button;
