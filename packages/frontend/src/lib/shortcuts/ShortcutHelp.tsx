// ============================================================================
// SHORTCUT HELP MODAL - Finance Hub
// Displays all available keyboard shortcuts grouped by category
// Uses Catppuccin colors
// ============================================================================

import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Keyboard } from 'lucide-react';
import { clsx } from 'clsx';
import { useShortcuts } from './ShortcutProvider';
import {
  SHORTCUT_CATEGORIES,
  formatKeyCombo,
  getShortcutsByCategory,
  type Shortcut,
  type ShortcutCategory,
} from './shortcuts';

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ShortcutHelp() {
  const { shortcuts, isHelpOpen, setHelpOpen } = useShortcuts();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ShortcutCategory | 'all'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Filter shortcuts based on search query
  const filteredShortcuts = useMemo(() => {
    let filtered = shortcuts.filter((s) => s.enabled);

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((s) => s.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.keys.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [shortcuts, searchQuery, selectedCategory]);

  // Group shortcuts by category
  const groupedShortcuts = useMemo(() => {
    if (selectedCategory !== 'all') {
      return new Map([[selectedCategory, filteredShortcuts]]);
    }
    return getShortcutsByCategory(filteredShortcuts);
  }, [filteredShortcuts, selectedCategory]);

  // Reset state and focus search input when modal opens
  const prevIsHelpOpenRef = useRef(isHelpOpen);

  // Reset and focus on modal open (move ref access to effect)
  useEffect(() => {
    const wasClosedNowOpen = !prevIsHelpOpenRef.current && isHelpOpen;
    prevIsHelpOpenRef.current = isHelpOpen;

    if (wasClosedNowOpen) {
      // Reset state on open - this is intentional to reset modal state when reopening
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchQuery('');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedCategory('all');
      // Focus search input
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isHelpOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isHelpOpen) {
        e.preventDefault();
        setHelpOpen(false);
      }
    };

    if (isHelpOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [isHelpOpen, setHelpOpen]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
    };

    if (isHelpOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isHelpOpen, setHelpOpen]);

  if (!isHelpOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ctp-crust/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-help-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl max-h-[80vh] bg-ctp-base rounded-xl shadow-2xl border border-ctp-surface0 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-ctp-surface0 bg-ctp-mantle">
          <div className="flex items-center gap-2 text-ctp-blue">
            <Keyboard className="w-5 h-5" />
            <h2 id="shortcut-help-title" className="text-lg font-semibold text-ctp-text">
              Raccourcis clavier
            </h2>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setHelpOpen(false)}
            className="p-2 rounded-lg text-ctp-overlay1 hover:text-ctp-text hover:bg-ctp-surface0 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search and filters */}
        <div className="px-6 py-4 border-b border-ctp-surface0 space-y-3">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ctp-overlay1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un raccourci..."
              className="w-full pl-10 pr-4 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded-lg text-ctp-text placeholder-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue/50 focus:border-ctp-blue"
            />
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={clsx(
                'px-3 py-1 text-sm rounded-full transition-colors',
                selectedCategory === 'all'
                  ? 'bg-ctp-blue text-ctp-crust'
                  : 'bg-ctp-surface0 text-ctp-subtext1 hover:bg-ctp-surface1'
              )}
            >
              Tous
            </button>
            {SHORTCUT_CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={clsx(
                  'px-3 py-1 text-sm rounded-full transition-colors',
                  selectedCategory === category.id
                    ? 'bg-ctp-blue text-ctp-crust'
                    : 'bg-ctp-surface0 text-ctp-subtext1 hover:bg-ctp-surface1'
                )}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Shortcuts list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filteredShortcuts.length === 0 ? (
            <div className="text-center py-8 text-ctp-overlay1">
              <p>Aucun raccourci trouve</p>
              {searchQuery && (
                <p className="text-sm mt-1">
                  Essayez un autre terme de recherche
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from(groupedShortcuts.entries()).map(([categoryId, categoryShortcuts]) => {
                if (categoryShortcuts.length === 0) return null;

                const category = SHORTCUT_CATEGORIES.find((c) => c.id === categoryId);

                return (
                  <div key={categoryId}>
                    <h3 className="text-sm font-medium text-ctp-mauve uppercase tracking-wide mb-3">
                      {category?.name ?? categoryId}
                    </h3>
                    <div className="space-y-2">
                      {categoryShortcuts.map((shortcut) => (
                        <ShortcutRow key={shortcut.id} shortcut={shortcut} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-ctp-surface0 bg-ctp-mantle">
          <p className="text-xs text-ctp-overlay1 text-center">
            Appuyez sur <KeyBadge keys="?" /> pour afficher/masquer cette aide
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ----------------------------------------------------------------------------
// Shortcut Row
// ----------------------------------------------------------------------------

interface ShortcutRowProps {
  shortcut: Shortcut;
}

function ShortcutRow({ shortcut }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-ctp-surface0 transition-colors group">
      <div>
        <p className="text-sm font-medium text-ctp-text">{shortcut.name}</p>
        <p className="text-xs text-ctp-subtext0">{shortcut.description}</p>
      </div>
      <KeyBadge keys={shortcut.keys} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Key Badge
// ----------------------------------------------------------------------------

interface KeyBadgeProps {
  keys: string;
}

function KeyBadge({ keys }: KeyBadgeProps) {
  const formatted = formatKeyCombo(keys);
  const parts = formatted.split(' ');

  return (
    <div className="flex items-center gap-1">
      {parts.map((part, index) => (
        <span key={index}>
          <kbd className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-1 text-xs font-medium text-ctp-text bg-ctp-surface1 border border-ctp-surface2 rounded shadow-sm">
            {part}
          </kbd>
          {index < parts.length - 1 && (
            <span className="mx-0.5 text-ctp-overlay0">puis</span>
          )}
        </span>
      ))}
    </div>
  );
}

export default ShortcutHelp;
