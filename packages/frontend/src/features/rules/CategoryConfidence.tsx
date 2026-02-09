// ============================================================================
// CATEGORY CONFIDENCE BADGE - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// Shows confidence score with color coding: green > 80%, yellow > 50%, red < 50%
// ============================================================================

import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface CategoryConfidenceProps {
  confidence: number; // 0 to 1
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  showLabel?: boolean;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function CategoryConfidence({
  confidence,
  size = 'md',
  showPercentage = true,
  showLabel = false,
}: CategoryConfidenceProps) {
  const percentage = Math.round(confidence * 100);

  // Determine color based on confidence level
  const getColorClasses = () => {
    if (confidence >= 0.8) {
      return 'bg-ctp-green/20 text-ctp-green border-ctp-green/30';
    }
    if (confidence >= 0.5) {
      return 'bg-ctp-yellow/20 text-ctp-yellow border-ctp-yellow/30';
    }
    return 'bg-ctp-red/20 text-ctp-red border-ctp-red/30';
  };

  const getLabel = () => {
    if (confidence >= 0.8) return 'Haute';
    if (confidence >= 0.5) return 'Moyenne';
    return 'Faible';
  };

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-2.5 py-1',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        getColorClasses(),
        sizeClasses[size]
      )}
      title={`Confiance: ${percentage}%`}
    >
      {showPercentage && <span>{percentage}%</span>}
      {showLabel && <span>{getLabel()}</span>}
      {!showPercentage && !showLabel && (
        <span className="w-2 h-2 rounded-full bg-current" />
      )}
    </span>
  );
}

// ----------------------------------------------------------------------------
// Confidence Bar variant
// ----------------------------------------------------------------------------

interface ConfidenceBarProps {
  confidence: number;
  className?: string;
}

export function ConfidenceBar({ confidence, className }: ConfidenceBarProps) {
  const percentage = Math.round(confidence * 100);

  const getBarColor = () => {
    if (confidence >= 0.8) return 'bg-ctp-green';
    if (confidence >= 0.5) return 'bg-ctp-yellow';
    return 'bg-ctp-red';
  };

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div className="flex-1 h-2 bg-ctp-surface1 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all', getBarColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-ctp-subtext0 tabular-nums w-10 text-right">
        {percentage}%
      </span>
    </div>
  );
}

export default CategoryConfidence;
