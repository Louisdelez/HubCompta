// ============================================================================
// FLOATING ACTION BUTTON - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface FloatingAction {
  label: string;
  icon: string;
  onClick: () => void;
  color?: string;
}

interface FloatingActionButtonProps {
  actions: FloatingAction[];
  mainIcon?: string;
  mainColor?: string;
  /** ARIA label for the main FAB button (default: "Actions" or action label for single action) */
  mainLabel?: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function FloatingActionButton({
  actions,
  mainIcon = '+',
  mainColor = 'bg-ctp-blue hover:bg-ctp-sapphire',
  mainLabel,
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = (action: FloatingAction) => {
    action.onClick();
    setIsOpen(false);
  };

  if (actions.length === 1) {
    const action = actions[0];
    if (!action) return null;
    // Single action - direct click
    return (
      <button
        onClick={() => action.onClick()}
        className={clsx(
          'fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg shadow-ctp-blue/30 text-ctp-crust text-2xl flex items-center justify-center z-40 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ctp-sapphire focus-visible:ring-offset-2 focus-visible:ring-offset-ctp-base',
          mainColor
        )}
        aria-label={mainLabel ?? action.label}
        title={action.label}
      >
        <span aria-hidden="true">{action.icon}</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40" role="group" aria-label="Actions rapides">
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Action buttons */}
      <div
        className={clsx(
          'absolute bottom-16 right-0 flex flex-col gap-3 transition-all duration-200',
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        )}
        role="menu"
        aria-hidden={!isOpen}
      >
        {actions.map((action, index) => (
          <div
            key={index}
            className="flex items-center gap-3 justify-end"
            style={{
              transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
            }}
            role="none"
          >
            <span
              className="bg-ctp-surface0 px-3 py-1 rounded-lg shadow text-sm font-medium text-ctp-text whitespace-nowrap"
              id={`fab-action-label-${index}`}
            >
              {action.label}
            </span>
            <button
              onClick={() => handleAction(action)}
              className={clsx(
                'w-12 h-12 rounded-full shadow-lg text-ctp-base text-xl flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2',
                action.color ?? 'bg-ctp-overlay1 hover:bg-ctp-overlay2'
              )}
              role="menuitem"
              aria-labelledby={`fab-action-label-${index}`}
              tabIndex={isOpen ? 0 : -1}
            >
              <span aria-hidden="true">{action.icon}</span>
            </button>
          </div>
        ))}
      </div>

      {/* Main button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-14 h-14 rounded-full shadow-lg shadow-ctp-blue/30 text-ctp-crust text-2xl flex items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ctp-sapphire focus-visible:ring-offset-2 focus-visible:ring-offset-ctp-base',
          mainColor,
          isOpen && 'rotate-45'
        )}
        aria-label={mainLabel ?? (isOpen ? 'Fermer le menu actions' : 'Ouvrir le menu actions')}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <span aria-hidden="true">{mainIcon}</span>
      </button>
    </div>
  );
}

export default FloatingActionButton;
