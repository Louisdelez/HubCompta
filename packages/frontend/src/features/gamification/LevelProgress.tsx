// ============================================================================
// LEVEL PROGRESS - Finance Hub
// Display user level and XP progress bar
// ============================================================================

import { Star, TrendingUp } from 'lucide-react';

interface LevelProgressProps {
  level: number;
  totalXp: number;
  currentStreak?: number;
  compact?: boolean;
}

// XP required for each level (exponential growth)
function getXpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

function getTotalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += getXpForLevel(i);
  }
  return total;
}

export function LevelProgress({
  level: rawLevel,
  totalXp: rawTotalXp,
  currentStreak: rawCurrentStreak = 0,
  compact = false,
}: LevelProgressProps) {
  // Ensure values are valid numbers
  const level = Number.isFinite(rawLevel) && rawLevel > 0 ? rawLevel : 1;
  const totalXp = Number.isFinite(rawTotalXp) ? rawTotalXp : 0;
  const currentStreak = Number.isFinite(rawCurrentStreak) ? rawCurrentStreak : 0;
  const xpForCurrentLevel = getXpForLevel(level);
  const totalXpForCurrentLevel = getTotalXpForLevel(level);
  const xpInCurrentLevel = totalXp - totalXpForCurrentLevel;
  const progressPercent = Math.min((xpInCurrentLevel / xpForCurrentLevel) * 100, 100);
  const xpToNextLevel = xpForCurrentLevel - xpInCurrentLevel;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 px-2 py-1 bg-ctp-yellow/20 rounded-full">
          <Star className="w-4 h-4 text-ctp-yellow" />
          <span className="text-sm font-bold text-ctp-yellow">{level}</span>
        </div>
        <div className="flex-1 h-2 bg-ctp-surface1 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-ctp-yellow to-ctp-peach transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Level Badge */}
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-ctp-yellow to-ctp-peach flex items-center justify-center">
              <Star className="w-8 h-8 text-ctp-base" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-ctp-base border-2 border-ctp-yellow flex items-center justify-center">
              <span className="text-sm font-bold text-ctp-yellow">{level}</span>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-ctp-text">Niveau {level}</h3>
            <p className="text-sm text-ctp-subtext0">
              {totalXp.toLocaleString('fr-FR')} XP total
            </p>
          </div>
        </div>

        {/* Streak */}
        {currentStreak > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-ctp-red/20 rounded-full">
            <TrendingUp className="w-4 h-4 text-ctp-red" />
            <span className="text-sm font-bold text-ctp-red">
              {currentStreak} jours
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-ctp-subtext0">
          <span>{xpInCurrentLevel.toLocaleString('fr-FR')} XP</span>
          <span>{xpForCurrentLevel.toLocaleString('fr-FR')} XP</span>
        </div>
        <div className="h-3 bg-ctp-surface1 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-ctp-yellow via-ctp-peach to-ctp-red transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-ctp-subtext0 text-center">
          Encore {xpToNextLevel.toLocaleString('fr-FR')} XP pour le niveau {level + 1}
        </p>
      </div>
    </div>
  );
}

export default LevelProgress;
