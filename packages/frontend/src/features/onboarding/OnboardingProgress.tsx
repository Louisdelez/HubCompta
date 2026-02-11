// ============================================================================
// ONBOARDING PROGRESS - Finance Hub
// Progress indicator with dots for tour steps
// ============================================================================

import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface OnboardingProgressProps {
  current: number;
  total: number;
  className?: string;
  variant?: 'dots' | 'bar' | 'numbered';
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function OnboardingProgress({
  current,
  total,
  className,
  variant = 'dots',
}: OnboardingProgressProps) {
  if (variant === 'bar') {
    const progress = ((current + 1) / total) * 100;
    return (
      <div className={clsx('w-full', className)}>
        <div className="flex items-center justify-between text-xs text-ctp-subtext0 mb-1">
          <span>Etape {current + 1} sur {total}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-ctp-surface1 rounded-full overflow-hidden">
          <div
            className="h-full bg-ctp-blue rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (variant === 'numbered') {
    return (
      <div className={clsx('flex items-center justify-center gap-2', className)}>
        {Array.from({ length: total }, (_, index) => (
          <div
            key={index}
            className={clsx(
              'flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium transition-all duration-200',
              index < current && 'bg-ctp-green text-ctp-crust',
              index === current && 'bg-ctp-blue text-ctp-crust scale-110',
              index > current && 'bg-ctp-surface1 text-ctp-subtext0'
            )}
          >
            {index + 1}
          </div>
        ))}
      </div>
    );
  }

  // Default: dots variant
  return (
    <div className={clsx('flex items-center justify-center gap-1.5', className)}>
      {Array.from({ length: total }, (_, index) => (
        <div
          key={index}
          className={clsx(
            'rounded-full transition-all duration-200',
            index === current
              ? 'w-6 h-2 bg-ctp-blue'
              : index < current
                ? 'w-2 h-2 bg-ctp-green'
                : 'w-2 h-2 bg-ctp-surface2'
          )}
          aria-label={`Etape ${index + 1}${index === current ? ' (actuelle)' : ''}`}
        />
      ))}
    </div>
  );
}

export default OnboardingProgress;
