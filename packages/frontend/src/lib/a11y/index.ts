// ============================================================================
// ACCESSIBILITY UTILITIES - Index
// Central export point for all a11y utilities
// ============================================================================

export {
  // Focus Management
  getFocusableElements,
  focusFirstElement,
  focusLastElement,
  useFocusTrap,
  useRovingTabindex,

  // Screen Reader Announcements
  announce,

  // ID Generation
  generateId,
  useId,

  // Color Contrast
  getRelativeLuminance,
  getContrastRatio,
  meetsContrastRequirement,

  // Skip Links
  skipToMainContent,

  // Keyboard Detection
  initKeyboardDetection,
  isKeyboardNavigation,

  // Reduced Motion
  prefersReducedMotion,
  usePrefersReducedMotion,

  // Types
  type UseFocusTrapOptions,
  type UseRovingTabindexOptions,
} from '../a11y';
