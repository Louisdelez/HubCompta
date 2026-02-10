// ============================================================================
// ACHIEVEMENT BADGE - Finance Hub
// Display individual achievement with unlock status
// ============================================================================

import { clsx } from 'clsx';
import { Lock } from 'lucide-react';

interface AchievementBadgeProps {
  code: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  category: string;
  unlocked: boolean;
  unlockedAt?: string | null;
  progress?: number;
  threshold?: number;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const categoryColors: Record<string, string> = {
  onboarding: 'from-ctp-blue to-ctp-sapphire',
  transactions: 'from-ctp-green to-ctp-teal',
  budgeting: 'from-ctp-yellow to-ctp-peach',
  savings: 'from-ctp-mauve to-ctp-pink',
  streaks: 'from-ctp-red to-ctp-maroon',
  milestones: 'from-ctp-lavender to-ctp-blue',
};

export function AchievementBadge({
  name,
  description,
  icon,
  xpReward,
  category,
  unlocked,
  unlockedAt,
  progress = 0,
  threshold = 1,
  size = 'md',
  onClick,
}: AchievementBadgeProps) {
  const sizeClasses = {
    sm: 'w-12 h-12 text-xl',
    md: 'w-16 h-16 text-2xl',
    lg: 'w-24 h-24 text-4xl',
  };

  const gradientClass = categoryColors[category] ?? 'from-ctp-overlay1 to-ctp-overlay2';
  const progressPercent = Math.min((progress / threshold) * 100, 100);

  return (
    <div
      className={clsx(
        'relative flex flex-col items-center p-3 rounded-xl transition-all',
        unlocked ? 'bg-ctp-surface0' : 'bg-ctp-mantle opacity-60',
        onClick && 'cursor-pointer hover:bg-ctp-surface1'
      )}
      onClick={onClick}
    >
      {/* Badge Icon */}
      <div
        className={clsx(
          'relative rounded-full flex items-center justify-center mb-2',
          sizeClasses[size],
          unlocked
            ? `bg-gradient-to-br ${gradientClass}`
            : 'bg-ctp-surface1'
        )}
      >
        {unlocked ? (
          <span>{icon}</span>
        ) : (
          <Lock className="w-6 h-6 text-ctp-overlay1" />
        )}

        {/* Progress Ring for locked achievements */}
        {!unlocked && progress > 0 && (
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-ctp-surface2"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray={`${progressPercent * 2.83} 283`}
              className="text-ctp-blue"
            />
          </svg>
        )}
      </div>

      {/* Name */}
      <p
        className={clsx(
          'text-sm font-medium text-center',
          unlocked ? 'text-ctp-text' : 'text-ctp-subtext0'
        )}
      >
        {name}
      </p>

      {/* Description (on hover/click) */}
      {size !== 'sm' && (
        <p className="text-xs text-ctp-subtext0 text-center mt-1 line-clamp-2">
          {description}
        </p>
      )}

      {/* XP Reward */}
      <div
        className={clsx(
          'mt-2 px-2 py-0.5 rounded-full text-xs font-medium',
          unlocked
            ? 'bg-ctp-yellow/20 text-ctp-yellow'
            : 'bg-ctp-surface1 text-ctp-subtext0'
        )}
      >
        +{xpReward} XP
      </div>

      {/* Unlock Date */}
      {unlocked && unlockedAt && (
        <p className="text-xs text-ctp-subtext0 mt-1">
          {new Date(unlockedAt).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
          })}
        </p>
      )}

      {/* Progress */}
      {!unlocked && threshold > 1 && (
        <p className="text-xs text-ctp-subtext0 mt-1">
          {progress} / {threshold}
        </p>
      )}
    </div>
  );
}

export default AchievementBadge;
