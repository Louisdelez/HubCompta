// ============================================================================
// FLOATING ACTION BUTTON - Finance Hub
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
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function FloatingActionButton({
  actions,
  mainIcon = '+',
  mainColor = 'bg-primary-500 hover:bg-primary-600',
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
          'fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg text-white text-2xl flex items-center justify-center z-40 transition-transform hover:scale-110',
          mainColor
        )}
        title={action.label}
      >
        {action.icon}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Action buttons */}
      <div
        className={clsx(
          'absolute bottom-16 right-0 flex flex-col gap-3 transition-all duration-200',
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        )}
      >
        {actions.map((action, index) => (
          <div
            key={index}
            className="flex items-center gap-3 justify-end"
            style={{
              transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
            }}
          >
            <span className="bg-white dark:bg-gray-800 px-3 py-1 rounded-lg shadow text-sm font-medium whitespace-nowrap">
              {action.label}
            </span>
            <button
              onClick={() => handleAction(action)}
              className={clsx(
                'w-12 h-12 rounded-full shadow-lg text-white text-xl flex items-center justify-center transition-transform hover:scale-110',
                action.color ?? 'bg-gray-700 hover:bg-gray-800'
              )}
            >
              {action.icon}
            </button>
          </div>
        ))}
      </div>

      {/* Main button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-14 h-14 rounded-full shadow-lg text-white text-2xl flex items-center justify-center transition-all duration-200',
          mainColor,
          isOpen && 'rotate-45'
        )}
      >
        {mainIcon}
      </button>
    </div>
  );
}

export default FloatingActionButton;
