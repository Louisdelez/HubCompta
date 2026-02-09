// ============================================================================
// SHORTCUTS CONFIG - Finance Hub
// Default keyboard shortcuts configuration
// ============================================================================

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface Shortcut {
  /** Unique identifier for the shortcut */
  id: string;
  /** Display name */
  name: string;
  /** Description of what the shortcut does */
  description: string;
  /** Key combination (e.g., 'g h', 'Ctrl+K', 'Escape') */
  keys: string;
  /** Category for grouping in help modal */
  category: ShortcutCategory;
  /** Whether this shortcut is enabled */
  enabled: boolean;
  /** Whether this shortcut requires a sequence (e.g., 'g' then 'h') */
  isSequence: boolean;
}

export type ShortcutCategory =
  | 'navigation'
  | 'actions'
  | 'lists'
  | 'modals'
  | 'global';

export interface ShortcutCategoryInfo {
  id: ShortcutCategory;
  name: string;
  description: string;
}

// ----------------------------------------------------------------------------
// Categories
// ----------------------------------------------------------------------------

export const SHORTCUT_CATEGORIES: ShortcutCategoryInfo[] = [
  {
    id: 'global',
    name: 'Global',
    description: 'Raccourcis disponibles partout',
  },
  {
    id: 'navigation',
    name: 'Navigation',
    description: 'Naviguer entre les pages',
  },
  {
    id: 'actions',
    name: 'Actions',
    description: 'Actions rapides',
  },
  {
    id: 'lists',
    name: 'Listes',
    description: 'Navigation dans les listes',
  },
  {
    id: 'modals',
    name: 'Modales',
    description: 'Controle des fenetres modales',
  },
];

// ----------------------------------------------------------------------------
// Default Shortcuts
// ----------------------------------------------------------------------------

export const DEFAULT_SHORTCUTS: Shortcut[] = [
  // Global shortcuts
  {
    id: 'help',
    name: 'Aide raccourcis',
    description: 'Afficher cette aide',
    keys: '?',
    category: 'global',
    enabled: true,
    isSequence: false,
  },
  {
    id: 'search',
    name: 'Recherche globale',
    description: 'Ouvrir la recherche',
    keys: 'Ctrl+K',
    category: 'global',
    enabled: true,
    isSequence: false,
  },
  {
    id: 'toggle-sidebar',
    name: 'Barre laterale',
    description: 'Afficher/masquer la barre laterale',
    keys: 'Ctrl+/',
    category: 'global',
    enabled: true,
    isSequence: false,
  },

  // Navigation shortcuts (g + key sequences)
  {
    id: 'go-home',
    name: 'Tableau de bord',
    description: 'Aller au tableau de bord',
    keys: 'g h',
    category: 'navigation',
    enabled: true,
    isSequence: true,
  },
  {
    id: 'go-transactions',
    name: 'Transactions',
    description: 'Aller aux transactions',
    keys: 'g t',
    category: 'navigation',
    enabled: true,
    isSequence: true,
  },
  {
    id: 'go-accounts',
    name: 'Comptes',
    description: 'Aller aux comptes',
    keys: 'g a',
    category: 'navigation',
    enabled: true,
    isSequence: true,
  },
  {
    id: 'go-budgets',
    name: 'Budgets',
    description: 'Aller aux budgets',
    keys: 'g b',
    category: 'navigation',
    enabled: true,
    isSequence: true,
  },
  {
    id: 'go-settings',
    name: 'Parametres',
    description: 'Aller aux parametres',
    keys: 'g s',
    category: 'navigation',
    enabled: true,
    isSequence: true,
  },
  {
    id: 'go-documents',
    name: 'Documents',
    description: 'Aller aux documents',
    keys: 'g d',
    category: 'navigation',
    enabled: true,
    isSequence: true,
  },

  // Action shortcuts (n + key sequences for new items)
  {
    id: 'new-transaction',
    name: 'Nouvelle transaction',
    description: 'Creer une nouvelle transaction',
    keys: 'n t',
    category: 'actions',
    enabled: true,
    isSequence: true,
  },
  {
    id: 'new-account',
    name: 'Nouveau compte',
    description: 'Creer un nouveau compte',
    keys: 'n a',
    category: 'actions',
    enabled: true,
    isSequence: true,
  },

  // List navigation shortcuts
  {
    id: 'list-down',
    name: 'Element suivant',
    description: 'Selectionner element suivant',
    keys: 'j',
    category: 'lists',
    enabled: true,
    isSequence: false,
  },
  {
    id: 'list-up',
    name: 'Element precedent',
    description: 'Selectionner element precedent',
    keys: 'k',
    category: 'lists',
    enabled: true,
    isSequence: false,
  },
  {
    id: 'list-select',
    name: 'Selectionner',
    description: 'Ouvrir l\'element selectionne',
    keys: 'Enter',
    category: 'lists',
    enabled: true,
    isSequence: false,
  },
  {
    id: 'list-edit',
    name: 'Modifier',
    description: 'Modifier l\'element selectionne',
    keys: 'e',
    category: 'lists',
    enabled: true,
    isSequence: false,
  },
  {
    id: 'list-delete',
    name: 'Supprimer',
    description: 'Supprimer l\'element selectionne (avec confirmation)',
    keys: 'd',
    category: 'lists',
    enabled: true,
    isSequence: false,
  },

  // Modal shortcuts
  {
    id: 'close-modal',
    name: 'Fermer',
    description: 'Fermer la modale active',
    keys: 'Escape',
    category: 'modals',
    enabled: true,
    isSequence: false,
  },
];

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Parse a key combination string into its components
 */
export function parseKeyCombo(keys: string): {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
} {
  const parts = keys.toLowerCase().split('+');
  const key = parts[parts.length - 1] ?? '';

  return {
    key,
    ctrl: parts.includes('ctrl'),
    meta: parts.includes('meta') || parts.includes('cmd'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
  };
}

/**
 * Check if a keyboard event matches a key combination
 */
export function matchesKeyCombo(
  event: KeyboardEvent,
  keys: string,
  isSequence: boolean,
  sequenceBuffer: string[]
): boolean {
  if (isSequence) {
    // For sequences like 'g h', check if the buffer + current key matches
    const sequenceParts = keys.split(' ');
    const currentSequence = [...sequenceBuffer, event.key.toLowerCase()];

    if (currentSequence.length !== sequenceParts.length) {
      return false;
    }

    return sequenceParts.every(
      (part, index) => currentSequence[index] === part.toLowerCase()
    );
  }

  // For single keys or modifier combinations
  const { key, ctrl, meta, shift, alt } = parseKeyCombo(keys);

  // Handle special keys
  const eventKey = event.key.toLowerCase();
  const keyMatches =
    eventKey === key ||
    (key === 'escape' && eventKey === 'escape') ||
    (key === 'enter' && eventKey === 'enter') ||
    (key === '?' && event.key === '?') ||
    (key === '/' && event.key === '/');

  // Check modifiers
  const ctrlMatches = ctrl === (event.ctrlKey || event.metaKey);
  const shiftMatches = !shift || event.shiftKey;
  const altMatches = !alt || event.altKey;

  // For simple keys without modifiers, make sure no modifiers are pressed
  if (!ctrl && !meta && !shift && !alt) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return false;
    }
  }

  return keyMatches && ctrlMatches && shiftMatches && altMatches;
}

/**
 * Format key combination for display
 */
export function formatKeyCombo(keys: string): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

  return keys
    .split(' ')
    .map((part) => {
      return part
        .split('+')
        .map((key) => {
          switch (key.toLowerCase()) {
            case 'ctrl':
              return isMac ? '\u2318' : 'Ctrl';
            case 'meta':
            case 'cmd':
              return isMac ? '\u2318' : 'Ctrl';
            case 'shift':
              return isMac ? '\u21E7' : 'Shift';
            case 'alt':
              return isMac ? '\u2325' : 'Alt';
            case 'enter':
              return isMac ? '\u21A9' : 'Enter';
            case 'escape':
              return 'Esc';
            default:
              return key.toUpperCase();
          }
        })
        .join(isMac ? '' : '+');
    })
    .join(' ');
}

/**
 * Get shortcuts by category
 */
export function getShortcutsByCategory(
  shortcuts: Shortcut[]
): Map<ShortcutCategory, Shortcut[]> {
  const map = new Map<ShortcutCategory, Shortcut[]>();

  for (const category of SHORTCUT_CATEGORIES) {
    map.set(category.id, []);
  }

  for (const shortcut of shortcuts) {
    if (shortcut.enabled) {
      const categoryShortcuts = map.get(shortcut.category) ?? [];
      categoryShortcuts.push(shortcut);
      map.set(shortcut.category, categoryShortcuts);
    }
  }

  return map;
}
