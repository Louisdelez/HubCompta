// ============================================================================
// VISUALLY HIDDEN - Finance Hub
// Component to hide content visually while keeping it accessible to screen readers
// ============================================================================

import { type ReactNode, type CSSProperties, type HTMLAttributes } from 'react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface VisuallyHiddenProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Content to be visually hidden but accessible to screen readers */
  children: ReactNode;
  /** HTML element to render (default: span) */
  as?: 'span' | 'div' | 'label' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

/**
 * CSS styles that visually hide content while keeping it accessible to
 * screen readers. This uses a combination of techniques that are considered
 * best practice for accessibility.
 *
 * Note: We avoid using `display: none` or `visibility: hidden` as these
 * would also hide the content from screen readers.
 */
const visuallyHiddenStyles: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

/**
 * VisuallyHidden component - hides content visually while keeping it
 * accessible to screen readers and other assistive technologies.
 *
 * Use cases:
 * - Providing additional context for screen reader users
 * - Adding labels to icon-only buttons
 * - Hiding decorative content from assistive technologies
 * - Providing skip links that are only visible on focus
 *
 * @example
 * // Adding a label to an icon-only button
 * <button>
 *   <SearchIcon />
 *   <VisuallyHidden>Search</VisuallyHidden>
 * </button>
 *
 * @example
 * // Providing additional context
 * <p>
 *   Items in cart: {count}
 *   <VisuallyHidden>items currently in your shopping cart</VisuallyHidden>
 * </p>
 */
export function VisuallyHidden({
  children,
  as: Component = 'span',
  ...props
}: VisuallyHiddenProps) {
  return (
    <Component style={visuallyHiddenStyles} {...props}>
      {children}
    </Component>
  );
}

// ----------------------------------------------------------------------------
// Focusable Variant
// ----------------------------------------------------------------------------

interface VisuallyHiddenFocusableProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Content to be visually hidden but accessible to screen readers */
  children: ReactNode;
  /** Additional CSS class when focused */
  focusClassName?: string;
}

/**
 * VisuallyHiddenFocusable - same as VisuallyHidden but becomes visible when focused.
 * Perfect for skip links that should only appear when keyboard users tab to them.
 *
 * @example
 * <VisuallyHiddenFocusable>
 *   <a href="#main-content">Skip to main content</a>
 * </VisuallyHiddenFocusable>
 */
export function VisuallyHiddenFocusable({
  children,
  focusClassName = '',
  className,
  ...props
}: VisuallyHiddenFocusableProps) {
  return (
    <span
      className={`sr-only focus-within:not-sr-only ${focusClassName} ${className ?? ''}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}

// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

export default VisuallyHidden;
