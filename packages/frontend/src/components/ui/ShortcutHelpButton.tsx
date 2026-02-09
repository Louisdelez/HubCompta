// ============================================================================
// SHORTCUT HELP BUTTON - Finance Hub
// Button that opens the keyboard shortcuts help modal
// ============================================================================

import { Keyboard } from 'lucide-react';
import { clsx } from 'clsx';
import { useShortcuts } from '@/lib/shortcuts';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ShortcutHelpButtonProps {
  className?: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ShortcutHelpButton({ className }: ShortcutHelpButtonProps) {
  const { setHelpOpen } = useShortcuts();

  return (
    <button
      onClick={() => setHelpOpen(true)}
      className={clsx(
        'p-2 rounded-lg text-ctp-overlay1 hover:text-ctp-text hover:bg-ctp-surface0 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ctp-blue/50',
        className
      )}
      aria-label="Raccourcis clavier"
      title="Raccourcis clavier (?)"
    >
      <Keyboard className="w-5 h-5" />
    </button>
  );
}

export default ShortcutHelpButton;
