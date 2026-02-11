// ============================================================================
// GAMIFICATION PAGE - Finance Hub
// Main page for achievements, levels, and streaks
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { Trophy, Loader2, Users } from 'lucide-react';
import { api } from '@/lib/api/client';
import { LevelProgress } from './LevelProgress';
import { StreakCounter } from './StreakCounter';
import { AchievementList } from './AchievementList';

interface UserStats {
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  transactionCount: number;
  budgetsOnTrack: number;
  goalsCompleted: number;
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  userAvatar: string | null;
  totalXp: number;
  level: number;
  rank: number;
}

export function GamificationPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['gamification', 'stats'],
    queryFn: () =>
      api.get<UserStats>(`/gamification/stats`),
  });

  const { data: leaderboard = [], isLoading: leaderboardLoading } = useQuery({
    queryKey: ['gamification', 'leaderboard'],
    queryFn: () =>
      api.get<LeaderboardEntry[]>(`/gamification/leaderboard`),
  });

  if (statsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-ctp-surface1 rounded-xl" />
          <div className="h-48 bg-ctp-surface1 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="w-7 h-7 text-ctp-yellow" />
          Progression
        </h1>
        <p className="text-ctp-subtext0">
          Suivez vos succes et debloquez des recompenses
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Level & Streak */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LevelProgress
                level={stats.level ?? 1}
                totalXp={stats.totalXp ?? 0}
                currentStreak={stats.currentStreak ?? 0}
              />
              <StreakCounter
                currentStreak={stats.currentStreak ?? 0}
                longestStreak={stats.longestStreak ?? 0}
              />
            </div>
          )}

          {/* Stats Overview */}
          {stats && (
            <div className="card p-4">
              <h3 className="font-semibold mb-4">Statistiques</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-ctp-surface0 rounded-lg">
                  <p className="text-2xl font-bold text-ctp-text">
                    {stats.transactionCount ?? 0}
                  </p>
                  <p className="text-sm text-ctp-subtext0">Transactions</p>
                </div>
                <div className="text-center p-3 bg-ctp-surface0 rounded-lg">
                  <p className="text-2xl font-bold text-ctp-green">
                    {stats.budgetsOnTrack ?? 0}
                  </p>
                  <p className="text-sm text-ctp-subtext0">Budgets respectes</p>
                </div>
                <div className="text-center p-3 bg-ctp-surface0 rounded-lg">
                  <p className="text-2xl font-bold text-ctp-yellow">
                    {stats.goalsCompleted ?? 0}
                  </p>
                  <p className="text-sm text-ctp-subtext0">Objectifs atteints</p>
                </div>
              </div>
            </div>
          )}

          {/* Achievements */}
          <AchievementList />
        </div>

        {/* Sidebar - Leaderboard */}
        <div className="space-y-6">
          <div className="card p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Users className="w-5 h-5" />
              Classement
            </h3>
            {leaderboardLoading ? (
              <div className="py-8 text-center">
                <Loader2 className="w-6 h-6 mx-auto animate-spin text-ctp-blue" />
              </div>
            ) : leaderboard.length > 0 ? (
              <div className="space-y-2">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.userId}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-ctp-surface0"
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0
                          ? 'bg-ctp-yellow text-ctp-base'
                          : index === 1
                          ? 'bg-ctp-overlay2 text-ctp-base'
                          : index === 2
                          ? 'bg-ctp-peach text-ctp-base'
                          : 'bg-ctp-surface1 text-ctp-text'
                      }`}
                    >
                      {entry.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ctp-text truncate">
                        {entry.userName}
                      </p>
                      <p className="text-xs text-ctp-subtext0">
                        Niveau {entry.level}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-ctp-yellow">
                      {entry.totalXp.toLocaleString('fr-FR')} XP
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-ctp-subtext0 py-4">
                Aucun classement disponible
              </p>
            )}
          </div>

          {/* Tips */}
          <div className="card p-4 bg-ctp-blue/10 border border-ctp-blue/30">
            <h4 className="font-medium mb-2 text-ctp-text">
              Comment gagner des XP ?
            </h4>
            <ul className="text-sm text-ctp-subtext0 space-y-1">
              <li>• Ajoutez des transactions quotidiennement</li>
              <li>• Respectez vos budgets</li>
              <li>• Atteignez vos objectifs d'epargne</li>
              <li>• Maintenez une serie d'activite</li>
              <li>• Debloquez des succes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GamificationPage;
