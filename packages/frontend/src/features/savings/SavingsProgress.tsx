// ============================================================================
// SAVINGS PROGRESS - Finance Hub
// Circular progress visualization for savings goals
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface SavingsProgressProps {
  progress: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  color?: string; // hex color
  isCompleted?: boolean;
  className?: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function getProgressColor(progress: number, isCompleted: boolean, customColor?: string): string {
  if (isCompleted) return 'stroke-ctp-green';
  if (customColor) return ''; // Will use inline style
  if (progress >= 75) return 'stroke-ctp-blue';
  if (progress >= 50) return 'stroke-ctp-teal';
  if (progress >= 25) return 'stroke-ctp-yellow';
  return 'stroke-ctp-peach';
}

function getSizeConfig(size: 'sm' | 'md' | 'lg') {
  switch (size) {
    case 'sm':
      return { viewBox: 80, radius: 32, strokeWidth: 6, fontSize: 'text-sm' };
    case 'md':
      return { viewBox: 100, radius: 40, strokeWidth: 8, fontSize: 'text-lg' };
    case 'lg':
      return { viewBox: 120, radius: 48, strokeWidth: 10, fontSize: 'text-xl' };
  }
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SavingsProgress({
  progress,
  size = 'md',
  showLabel = true,
  color,
  isCompleted = false,
  className,
}: SavingsProgressProps) {
  const config = getSizeConfig(size);
  const circumference = 2 * Math.PI * config.radius;
  const offset = circumference - (progress / 100) * circumference;
  const progressColor = getProgressColor(progress, isCompleted, color);

  return (
    <div className={clsx('relative inline-flex items-center justify-center', className)}>
      <svg
        width={config.viewBox}
        height={config.viewBox}
        viewBox={`0 0 ${config.viewBox} ${config.viewBox}`}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={config.viewBox / 2}
          cy={config.viewBox / 2}
          r={config.radius}
          fill="none"
          className="stroke-ctp-surface1"
          strokeWidth={config.strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={config.viewBox / 2}
          cy={config.viewBox / 2}
          r={config.radius}
          fill="none"
          className={clsx('transition-all duration-500 ease-out', progressColor)}
          style={color ? { stroke: color } : undefined}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>

      {/* Center label */}
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={clsx('font-bold', config.fontSize)}>
            {isCompleted ? (
              <span className="text-ctp-green">100%</span>
            ) : (
              <span className="text-ctp-text">{Math.round(progress)}%</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

export default SavingsProgress;
