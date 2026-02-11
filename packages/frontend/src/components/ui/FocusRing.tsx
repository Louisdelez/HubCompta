// ============================================================================
// FOCUS RING - Finance Hub
// Provides consistent focus ring styles for keyboard navigation
// ============================================================================

import { forwardRef, type ReactNode, type HTMLAttributes } from 'react';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface FocusRingProps extends HTMLAttributes<HTMLDivElement> {
  /** The element to wrap with focus ring */
  children: ReactNode;
  /** Whether the focus ring is visible (controlled mode) */
  visible?: boolean;
  /** Focus ring color variant */
  variant?: 'primary' | 'danger' | 'success' | 'warning';
  /** Whether to show focus ring on focus-within (for wrapper elements) */
  focusWithin?: boolean;
  /** Offset of the focus ring from the element */
  offset?: 'none' | 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const variantStyles = {
  primary: 'focus-visible:ring-ctp-blue',
  danger: 'focus-visible:ring-ctp-red',
  success: 'focus-visible:ring-ctp-green',
  warning: 'focus-visible:ring-ctp-yellow',
};

const offsetStyles = {
  none: 'focus-visible:ring-offset-0',
  sm: 'focus-visible:ring-offset-1',
  md: 'focus-visible:ring-offset-2',
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

/**
 * FocusRing component - wraps an element with a consistent focus ring
 *
 * Use this component to add accessible focus indicators to custom interactive elements
 * that may not have built-in focus styles.
 *
 * @example
 * <FocusRing>
 *   <div tabIndex={0} onClick={handleClick}>
 *     Custom interactive element
 *   </div>
 * </FocusRing>
 *
 * @example
 * // With focus-within for container elements
 * <FocusRing focusWithin>
 *   <div>
 *     <input type="text" />
 *   </div>
 * </FocusRing>
 */
export const FocusRing = forwardRef<HTMLDivElement, FocusRingProps>(
  function FocusRing(
    {
      children,
      visible,
      variant = 'primary',
      focusWithin = false,
      offset = 'sm',
      className,
      ...props
    },
    ref
  ) {
    const focusClass = focusWithin
      ? 'focus-within:ring-2'
      : 'focus-visible:ring-2';

    const classes = clsx(
      'rounded-lg transition-shadow',
      focusClass,
      variantStyles[variant],
      offsetStyles[offset],
      visible && 'ring-2',
      className
    );

    return (
      <div ref={ref} className={classes} {...props}>
        {children}
      </div>
    );
  }
);

// ----------------------------------------------------------------------------
// CSS class helper
// ----------------------------------------------------------------------------

/**
 * Get focus ring CSS classes for use in className prop
 *
 * @example
 * <button className={focusRingClasses({ variant: 'primary' })}>
 *   Click me
 * </button>
 */
export function focusRingClasses({
  variant = 'primary',
  offset = 'sm',
  focusWithin = false,
}: {
  variant?: FocusRingProps['variant'];
  offset?: FocusRingProps['offset'];
  focusWithin?: boolean;
} = {}): string {
  const ringColorMap = {
    primary: 'focus-visible:ring-ctp-blue',
    danger: 'focus-visible:ring-ctp-red',
    success: 'focus-visible:ring-ctp-green',
    warning: 'focus-visible:ring-ctp-yellow',
  };

  const ringWithinColorMap = {
    primary: 'focus-within:ring-ctp-blue',
    danger: 'focus-within:ring-ctp-red',
    success: 'focus-within:ring-ctp-green',
    warning: 'focus-within:ring-ctp-yellow',
  };

  const offsetMap = {
    none: 'focus-visible:ring-offset-0',
    sm: 'focus-visible:ring-offset-1',
    md: 'focus-visible:ring-offset-2',
  };

  if (focusWithin) {
    return clsx(
      'focus-within:ring-2',
      ringWithinColorMap[variant],
      'focus-within:ring-offset-2'
    );
  }

  return clsx(
    'focus:outline-none focus-visible:ring-2',
    ringColorMap[variant],
    offsetMap[offset]
  );
}

export default FocusRing;
