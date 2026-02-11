// ============================================================================
// ONBOARDING TOOLTIP - Finance Hub
// Custom styled tooltip for guided tours
// Uses Catppuccin theme colors
// ============================================================================

import { type TooltipRenderProps } from 'react-joyride';
import { X, ChevronLeft, ChevronRight, Check, SkipForward } from 'lucide-react';
import { OnboardingProgress } from './OnboardingProgress';

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function OnboardingTooltip({
  backProps,
  closeProps,
  continuous,
  index,
  isLastStep,
  primaryProps,
  skipProps,
  step,
  tooltipProps,
  size,
}: TooltipRenderProps) {
  const progress = ((index + 1) / size) * 100;

  return (
    <div
      {...tooltipProps}
      className="bg-ctp-surface0 rounded-xl shadow-2xl border border-ctp-surface1 max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Progress bar */}
      <div className="h-1 bg-ctp-surface1">
        <div
          className="h-full bg-ctp-blue transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Header with close button */}
        <div className="flex items-start justify-between gap-4 mb-3">
          {step.title && (
            <h3 className="text-lg font-semibold text-ctp-text">
              {step.title}
            </h3>
          )}
          <button
            {...closeProps}
            className="p-1 rounded-lg text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface1 transition-colors -mt-1 -mr-1"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body content */}
        <div className="text-sm text-ctp-subtext1 leading-relaxed">
          {step.content}
        </div>

        {/* Progress dots */}
        <div className="mt-4 mb-4">
          <OnboardingProgress current={index} total={size} />
        </div>

        {/* Footer with buttons */}
        <div className="flex items-center justify-between gap-3">
          {/* Skip button */}
          <button
            {...skipProps}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-ctp-subtext0 hover:text-ctp-subtext1 transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Passer
          </button>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                {...backProps}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-ctp-text bg-ctp-surface1 hover:bg-ctp-surface2 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Precedent
              </button>
            )}

            {continuous && (
              <button
                {...primaryProps}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-ctp-crust bg-ctp-blue hover:bg-ctp-sapphire rounded-lg transition-colors"
              >
                {isLastStep ? (
                  <>
                    Terminer
                    <Check className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Suivant
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OnboardingTooltip;
