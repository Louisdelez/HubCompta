// ============================================================================
// STREAK COUNTER - Finance Hub
// Display consecutive days of activity
// ============================================================================

import { Flame, Calendar, Award } from 'lucide-react';
import { clsx } from 'clsx';

interface StreakCounterProps {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate?: string | null;
  compact?: boolean;
}

export function StreakCounter({
  currentStreak: rawCurrentStreak,
  longestStreak: rawLongestStreak,
  lastActivityDate,
  compact = false,
}: StreakCounterProps) {
  // Ensure streak values are valid numbers
  const currentStreak = Number.isFinite(rawCurrentStreak) ? rawCurrentStreak : 0;
  const longestStreak = Number.isFinite(rawLongestStreak) ? rawLongestStreak : 0;
  const isActive = lastActivityDate
    ? new Date(lastActivityDate).toDateString() === new Date().toDateString()
    : false;

  const streakLevel =
    currentStreak >= 30 ? 'legendary' :
    currentStreak >= 14 ? 'epic' :
    currentStreak >= 7 ? 'rare' :
    currentStreak >= 3 ? 'common' : 'none';

  const streakColors = {
    none: 'text-ctp-subtext0',
    common: 'text-ctp-green',
    rare: 'text-ctp-blue',
    epic: 'text-ctp-mauve',
    legendary: 'text-ctp-red',
  };

  const streakBgColors = {
    none: 'bg-ctp-surface1',
    common: 'bg-ctp-green/20',
    rare: 'bg-ctp-blue/20',
    epic: 'bg-ctp-mauve/20',
    legendary: 'bg-ctp-red/20',
  };

  if (compact) {
    return (
      <div
        className={clsx(
          'flex items-center gap-1.5 px-2 py-1 rounded-full',
          streakBgColors[streakLevel]
        )}
      >
        <Flame
          className={clsx(
            'w-4 h-4',
            streakColors[streakLevel],
            currentStreak > 0 && 'animate-pulse'
          )}
        />
        <span className={clsx('text-sm font-bold', streakColors[streakLevel])}>
          {currentStreak}
        </span>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-ctp-text flex items-center gap-2">
          <Flame className="w-5 h-5 text-ctp-red" />
          Serie en cours
        </h3>
        {isActive && (
          <span className="text-xs px-2 py-0.5 bg-ctp-green/20 text-ctp-green rounded-full">
            Actif aujourd'hui
          </span>
        )}
      </div>

      {/* Current Streak */}
      <div className="flex items-center justify-center mb-4">
        <div
          className={clsx(
            'relative w-24 h-24 rounded-full flex items-center justify-center',
            streakBgColors[streakLevel]
          )}
        >
          <Flame
            className={clsx(
              'absolute w-12 h-12 transition-all',
              streakColors[streakLevel],
              currentStreak > 0 && 'animate-bounce'
            )}
          />
          <span
            className={clsx(
              'relative text-3xl font-bold mt-8',
              streakColors[streakLevel]
            )}
          >
            {currentStreak}
          </span>
        </div>
      </div>

      <p className="text-center text-sm text-ctp-subtext0 mb-4">
        {currentStreak === 0
          ? "Commencez une nouvelle serie aujourd'hui !"
          : currentStreak === 1
          ? '1 jour consecutif'
          : `${currentStreak} jours consecutifs`}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-ctp-surface0 rounded-lg p-3 text-center">
          <Award className="w-5 h-5 mx-auto mb-1 text-ctp-yellow" />
          <p className="text-lg font-bold text-ctp-text">{longestStreak}</p>
          <p className="text-xs text-ctp-subtext0">Record</p>
        </div>
        <div className="bg-ctp-surface0 rounded-lg p-3 text-center">
          <Calendar className="w-5 h-5 mx-auto mb-1 text-ctp-blue" />
          <p className="text-lg font-bold text-ctp-text">
            {lastActivityDate
              ? new Date(lastActivityDate).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                })
              : '-'}
          </p>
          <p className="text-xs text-ctp-subtext0">Derniere activite</p>
        </div>
      </div>

      {/* Streak milestones */}
      {currentStreak > 0 && currentStreak < 30 && (
        <div className="mt-4 pt-4 border-t border-ctp-surface1">
          <p className="text-xs text-ctp-subtext0 mb-2">Prochain palier</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-ctp-surface1 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full transition-all',
                  currentStreak < 7
                    ? 'bg-ctp-green'
                    : currentStreak < 14
                    ? 'bg-ctp-blue'
                    : 'bg-ctp-mauve'
                )}
                style={{
                  width: `${
                    currentStreak < 7
                      ? (currentStreak / 7) * 100
                      : currentStreak < 14
                      ? ((currentStreak - 7) / 7) * 100
                      : ((currentStreak - 14) / 16) * 100
                  }%`,
                }}
              />
            </div>
            <span className="text-xs text-ctp-subtext0">
              {currentStreak < 7
                ? `${7 - currentStreak}j`
                : currentStreak < 14
                ? `${14 - currentStreak}j`
                : `${30 - currentStreak}j`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default StreakCounter;
