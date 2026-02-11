// ============================================================================
// RESTART TUTORIAL BUTTON - Finance Hub
// Button to restart the onboarding tutorial from settings
// ============================================================================

import { RefreshCw, Play, Check } from 'lucide-react';
import { useOnboarding } from './OnboardingProvider';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface RestartTutorialButtonProps {
  variant?: 'default' | 'card';
  className?: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function RestartTutorialButton({
  variant = 'default',
  className,
}: RestartTutorialButtonProps) {
  const { resetOnboarding, startTour, state } = useOnboarding();

  const handleRestart = () => {
    resetOnboarding();
    // Small delay to ensure state is reset
    setTimeout(() => {
      startTour('welcome');
    }, 100);
  };

  const completedCount = state.completedTours.length;
  const isFullyCompleted = state.completedAt !== null;

  if (variant === 'card') {
    return (
      <div className={clsx('bg-ctp-surface0 rounded-lg p-4', className)}>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-ctp-blue/10 flex items-center justify-center flex-shrink-0">
            <Play className="w-5 h-5 text-ctp-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-ctp-text mb-1">
              Tutoriel interactif
            </h4>
            <p className="text-xs text-ctp-subtext0 mb-3">
              Relancez la visite guidee de Finance Hub pour decouvrir toutes les
              fonctionnalites.
            </p>

            {/* Progress indicator */}
            {completedCount > 0 && (
              <div className="flex items-center gap-2 mb-3 text-xs text-ctp-subtext0">
                {isFullyCompleted ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-ctp-green" />
                    <span className="text-ctp-green">Tutoriel termine</span>
                  </>
                ) : (
                  <>
                    <span>{completedCount}/4 etapes completees</span>
                  </>
                )}
              </div>
            )}

            <button
              onClick={handleRestart}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-ctp-blue bg-ctp-blue/10 hover:bg-ctp-blue/20 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Relancer le tutoriel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default variant: simple button
  return (
    <button
      onClick={handleRestart}
      className={clsx(
        'flex items-center gap-2 px-4 py-2 text-sm font-medium',
        'text-ctp-blue bg-ctp-blue/10 hover:bg-ctp-blue/20',
        'rounded-lg transition-colors',
        className
      )}
    >
      <RefreshCw className="w-4 h-4" />
      Relancer le tutoriel
    </button>
  );
}

export default RestartTutorialButton;
