// ============================================================================
// ACCESSIBILITY UTILITIES - Finance Hub
// Helper functions and utilities for WCAG compliance
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';

// ----------------------------------------------------------------------------
// Focus Management
// ----------------------------------------------------------------------------

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    'audio[controls]',
    'video[controls]',
    '[contenteditable]:not([contenteditable="false"])',
  ].join(', ');

  const elements = container.querySelectorAll<HTMLElement>(focusableSelectors);
  return Array.from(elements).filter((el) => {
    // Filter out elements that are not visible
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

/**
 * Focus the first focusable element in a container
 */
export function focusFirstElement(container: HTMLElement): void {
  const focusable = getFocusableElements(container);
  if (focusable.length > 0) {
    focusable[0]?.focus();
  }
}

/**
 * Focus the last focusable element in a container
 */
export function focusLastElement(container: HTMLElement): void {
  const focusable = getFocusableElements(container);
  if (focusable.length > 0) {
    focusable[focusable.length - 1]?.focus();
  }
}

// ----------------------------------------------------------------------------
// Focus Trap Hook
// ----------------------------------------------------------------------------

interface UseFocusTrapOptions {
  /** Whether the focus trap is active */
  isActive: boolean;
  /** Callback when escape is pressed */
  onEscape?: () => void;
  /** Whether to auto-focus the first element */
  autoFocus?: boolean;
  /** Whether to restore focus on unmount */
  restoreFocus?: boolean;
}

/**
 * Hook to trap focus within a container (for modals, dialogs)
 *
 * @example
 * const modalRef = useFocusTrap({
 *   isActive: isOpen,
 *   onEscape: handleClose,
 *   autoFocus: true,
 *   restoreFocus: true,
 * });
 *
 * return <div ref={modalRef}>...</div>;
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>({
  isActive,
  onEscape,
  autoFocus = true,
  restoreFocus = true,
}: UseFocusTrapOptions) {
  const containerRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store the previously focused element
  useEffect(() => {
    if (isActive) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
  }, [isActive]);

  // Auto-focus first element
  useEffect(() => {
    if (isActive && autoFocus && containerRef.current) {
      // Small delay to ensure the container is rendered
      const timeoutId = setTimeout(() => {
        if (containerRef.current) {
          focusFirstElement(containerRef.current);
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [isActive, autoFocus]);

  // Restore focus on unmount
  useEffect(() => {
    return () => {
      if (restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [restoreFocus]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isActive || !containerRef.current) return;

      // Handle Escape key
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }

      // Handle Tab key for focus trapping
      if (event.key === 'Tab') {
        const focusable = getFocusableElements(containerRef.current);
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        // Shift + Tab from first element -> move to last
        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
        // Tab from last element -> move to first
        else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    },
    [isActive, onEscape]
  );

  // Add event listener
  useEffect(() => {
    if (isActive) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [isActive, handleKeyDown]);

  return containerRef;
}

// ----------------------------------------------------------------------------
// Roving Tabindex Hook
// ----------------------------------------------------------------------------

interface UseRovingTabindexOptions {
  /** Current active index */
  activeIndex: number;
  /** Total number of items */
  itemCount: number;
  /** Callback when active index changes */
  onActiveIndexChange: (index: number) => void;
  /** Whether navigation wraps around */
  wrap?: boolean;
  /** Orientation for arrow key navigation */
  orientation?: 'horizontal' | 'vertical' | 'both';
}

/**
 * Hook for roving tabindex pattern (keyboard navigation in lists)
 *
 * @example
 * const { getItemProps } = useRovingTabindex({
 *   activeIndex,
 *   itemCount: items.length,
 *   onActiveIndexChange: setActiveIndex,
 * });
 *
 * return items.map((item, index) => (
 *   <button {...getItemProps(index)}>{item.label}</button>
 * ));
 */
export function useRovingTabindex({
  activeIndex,
  itemCount,
  onActiveIndexChange,
  wrap = true,
  orientation = 'vertical',
}: UseRovingTabindexOptions) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, currentIndex: number) => {
      let newIndex = currentIndex;

      const isHorizontal = orientation === 'horizontal' || orientation === 'both';
      const isVertical = orientation === 'vertical' || orientation === 'both';

      switch (event.key) {
        case 'ArrowDown':
          if (isVertical) {
            event.preventDefault();
            newIndex = wrap
              ? (currentIndex + 1) % itemCount
              : Math.min(currentIndex + 1, itemCount - 1);
          }
          break;
        case 'ArrowUp':
          if (isVertical) {
            event.preventDefault();
            newIndex = wrap
              ? (currentIndex - 1 + itemCount) % itemCount
              : Math.max(currentIndex - 1, 0);
          }
          break;
        case 'ArrowRight':
          if (isHorizontal) {
            event.preventDefault();
            newIndex = wrap
              ? (currentIndex + 1) % itemCount
              : Math.min(currentIndex + 1, itemCount - 1);
          }
          break;
        case 'ArrowLeft':
          if (isHorizontal) {
            event.preventDefault();
            newIndex = wrap
              ? (currentIndex - 1 + itemCount) % itemCount
              : Math.max(currentIndex - 1, 0);
          }
          break;
        case 'Home':
          event.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          newIndex = itemCount - 1;
          break;
        default:
          return;
      }

      if (newIndex !== currentIndex) {
        onActiveIndexChange(newIndex);
      }
    },
    [itemCount, onActiveIndexChange, orientation, wrap]
  );

  const getItemProps = useCallback(
    (index: number) => ({
      tabIndex: index === activeIndex ? 0 : -1,
      onKeyDown: (event: React.KeyboardEvent) => handleKeyDown(event, index),
      onFocus: () => onActiveIndexChange(index),
    }),
    [activeIndex, handleKeyDown, onActiveIndexChange]
  );

  return { getItemProps };
}

// ----------------------------------------------------------------------------
// Announce to Screen Readers
// ----------------------------------------------------------------------------

let announceElement: HTMLElement | null = null;

/**
 * Announce a message to screen readers
 * Uses a hidden live region to communicate changes
 *
 * @param message - The message to announce
 * @param politeness - How urgently the message should be announced
 */
export function announce(
  message: string,
  politeness: 'polite' | 'assertive' = 'polite'
): void {
  // Create the announcer element if it doesn't exist
  if (!announceElement) {
    announceElement = document.createElement('div');
    announceElement.setAttribute('aria-live', politeness);
    announceElement.setAttribute('aria-atomic', 'true');
    announceElement.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
    announceElement.className = 'sr-only';
    document.body.appendChild(announceElement);
  } else {
    announceElement.setAttribute('aria-live', politeness);
    announceElement.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
  }

  // Clear and set the message (this triggers the announcement)
  announceElement.textContent = '';
  // Use requestAnimationFrame to ensure the DOM updates
  requestAnimationFrame(() => {
    if (announceElement) {
      announceElement.textContent = message;
    }
  });
}

// ----------------------------------------------------------------------------
// ID Generation for ARIA attributes
// ----------------------------------------------------------------------------

let idCounter = 0;

/**
 * Generate a unique ID for ARIA attributes
 *
 * @param prefix - Optional prefix for the ID
 * @returns A unique ID string
 */
export function generateId(prefix = 'a11y'): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * Hook to generate a stable unique ID
 */
export function useId(prefix = 'a11y'): string {
  // Use lazy initialization with useState to generate ID only once
  // This avoids accessing refs during render which violates React rules
  const [id] = useState(() => generateId(prefix));
  return id;
}

// ----------------------------------------------------------------------------
// Color Contrast Utilities
// ----------------------------------------------------------------------------

/**
 * Calculate relative luminance of an RGB color
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0);
}

/**
 * Calculate contrast ratio between two colors
 * https://www.w3.org/WAI/GL/wiki/Contrast_ratio
 *
 * @returns Contrast ratio (1 to 21)
 */
export function getContrastRatio(
  rgb1: [number, number, number],
  rgb2: [number, number, number]
): number {
  const l1 = getRelativeLuminance(...rgb1);
  const l2 = getRelativeLuminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG requirements
 *
 * @param ratio - The contrast ratio to check
 * @param level - WCAG level ('AA' or 'AAA')
 * @param size - Text size ('normal' or 'large')
 */
export function meetsContrastRequirement(
  ratio: number,
  level: 'AA' | 'AAA' = 'AA',
  size: 'normal' | 'large' = 'normal'
): boolean {
  const requirements = {
    AA: { normal: 4.5, large: 3 },
    AAA: { normal: 7, large: 4.5 },
  };
  return ratio >= requirements[level][size];
}

// ----------------------------------------------------------------------------
// Skip Link Helper
// ----------------------------------------------------------------------------

/**
 * Scroll to and focus the main content area
 * Used by skip links
 */
export function skipToMainContent(mainId = 'main-content'): void {
  const mainContent = document.getElementById(mainId);
  if (mainContent) {
    mainContent.focus();
    mainContent.scrollIntoView({ behavior: 'smooth' });
  }
}

// ----------------------------------------------------------------------------
// Keyboard Detection
// ----------------------------------------------------------------------------

let isUsingKeyboard = false;

/**
 * Initialize keyboard detection
 * Adds a class to body when user is navigating with keyboard
 */
export function initKeyboardDetection(): () => void {
  const handleMouseDown = () => {
    isUsingKeyboard = false;
    document.body.classList.remove('using-keyboard');
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      isUsingKeyboard = true;
      document.body.classList.add('using-keyboard');
    }
  };

  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('keydown', handleKeyDown);

  return () => {
    document.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Check if user is currently navigating with keyboard
 */
export function isKeyboardNavigation(): boolean {
  return isUsingKeyboard;
}

// ----------------------------------------------------------------------------
// Reduced Motion Detection
// ----------------------------------------------------------------------------

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Hook to detect reduced motion preference
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

// ----------------------------------------------------------------------------
// Export Types
// ----------------------------------------------------------------------------

export type { UseFocusTrapOptions, UseRovingTabindexOptions };
