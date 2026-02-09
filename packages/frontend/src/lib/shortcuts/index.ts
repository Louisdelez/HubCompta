// ============================================================================
// SHORTCUTS MODULE - Finance Hub
// Comprehensive keyboard shortcuts system
// ============================================================================

// Provider and context
export { ShortcutProvider, useShortcuts } from './ShortcutProvider';
export type { ShortcutHandler } from './ShortcutProvider';

// Hook for registering shortcuts
export { useShortcut, useShortcutMap } from './useShortcut';

// Help modal component
export { ShortcutHelp } from './ShortcutHelp';

// Configuration and types
export {
  DEFAULT_SHORTCUTS,
  SHORTCUT_CATEGORIES,
  formatKeyCombo,
  parseKeyCombo,
  matchesKeyCombo,
  getShortcutsByCategory,
} from './shortcuts';
export type {
  Shortcut,
  ShortcutCategory,
  ShortcutCategoryInfo,
} from './shortcuts';
