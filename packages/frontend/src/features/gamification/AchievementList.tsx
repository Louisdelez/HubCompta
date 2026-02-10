// ============================================================================
// ACHIEVEMENT LIST - Finance Hub
// Display all achievements grouped by category
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Loader2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { clsx } from 'clsx';
import { AchievementBadge } from './AchievementBadge';

interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  threshold: number;
  xpReward: number;
}

interface UserAchievement {
  achievementId: string;
  unlockedAt: string;
  progress: number;
}

interface AchievementsResponse {
  achievements: Achievement[];
  userAchievements: UserAchievement[];
}

const categoryLabels: Record<string, string> = {
  onboarding: 'Premiers pas',
  transactions: 'Transactions',
  budgeting: 'Budgets',
  savings: 'Epargne',
  streaks: 'Series',
  milestones: 'Jalons',
};

const categoryOrder = ['onboarding', 'transactions', 'budgeting', 'savings', 'streaks', 'milestones'];

export function AchievementList() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['gamification', workspaceId, 'achievements'],
    queryFn: () =>
      api.get<AchievementsResponse>(
        `/workspaces/${workspaceId}/gamification/achievements`
      ),
    enabled: !!workspaceId,
  });

  const achievements = data?.achievements ?? [];
  const userAchievements = data?.userAchievements ?? [];

  // Create a map of user achievements
  const userAchievementMap = new Map(
    userAchievements.map((ua) => [ua.achievementId, ua])
  );

  // Group achievements by category
  const groupedAchievements = achievements.reduce((acc, achievement) => {
    if (!acc[achievement.category]) {
      acc[achievement.category] = [];
    }
    acc[achievement.category]!.push(achievement);
    return acc;
  }, {} as Record<string, Achievement[]>);

  // Filter by selected category
  const displayCategories = selectedCategory
    ? [selectedCategory]
    : categoryOrder.filter((cat) => groupedAchievements[cat]);

  // Stats
  const totalAchievements = achievements.length;
  const unlockedCount = userAchievements.length;
  const totalXpEarned = userAchievements.reduce((sum, ua) => {
    const achievement = achievements.find((a) => a.id === ua.achievementId);
    return sum + (achievement?.xpReward ?? 0);
  }, 0);

  if (!workspaceId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-ctp-blue mb-4" />
        <p className="text-ctp-subtext0">Chargement des succes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="w-6 h-6 text-ctp-yellow" />
          <h2 className="text-xl font-bold">Succes</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-ctp-text">
              {unlockedCount}/{totalAchievements}
            </p>
            <p className="text-sm text-ctp-subtext0">Debloques</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-ctp-yellow">
              {totalXpEarned.toLocaleString('fr-FR')}
            </p>
            <p className="text-sm text-ctp-subtext0">XP gagnes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-ctp-green">
              {Math.round((unlockedCount / totalAchievements) * 100)}%
            </p>
            <p className="text-sm text-ctp-subtext0">Complete</p>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={clsx(
            'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            selectedCategory === null
              ? 'bg-ctp-blue text-ctp-base'
              : 'bg-ctp-surface0 text-ctp-text hover:bg-ctp-surface1'
          )}
        >
          Tous
        </button>
        {categoryOrder.map((category) => {
          const count = groupedAchievements[category]?.length ?? 0;
          const unlocked = (groupedAchievements[category] ?? []).filter(
            (a) => userAchievementMap.has(a.id)
          ).length;

          if (count === 0) return null;

          return (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={clsx(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                selectedCategory === category
                  ? 'bg-ctp-blue text-ctp-base'
                  : 'bg-ctp-surface0 text-ctp-text hover:bg-ctp-surface1'
              )}
            >
              {categoryLabels[category] ?? category} ({unlocked}/{count})
            </button>
          );
        })}
      </div>

      {/* Achievement Grid */}
      {displayCategories.map((category) => {
        const categoryAchievements = groupedAchievements[category] ?? [];
        if (categoryAchievements.length === 0) return null;

        return (
          <div key={category}>
            {!selectedCategory && (
              <h3 className="text-lg font-semibold mb-3 text-ctp-text">
                {categoryLabels[category] ?? category}
              </h3>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {categoryAchievements.map((achievement) => {
                const userAchievement = userAchievementMap.get(achievement.id);
                return (
                  <AchievementBadge
                    key={achievement.id}
                    code={achievement.code}
                    name={achievement.name}
                    description={achievement.description}
                    icon={achievement.icon}
                    xpReward={achievement.xpReward}
                    category={achievement.category}
                    unlocked={!!userAchievement}
                    unlockedAt={userAchievement?.unlockedAt ?? null}
                    progress={userAchievement?.progress ?? 0}
                    threshold={achievement.threshold}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {achievements.length === 0 && (
        <div className="card p-8 text-center">
          <Trophy className="w-12 h-12 mx-auto text-ctp-overlay1 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucun succes disponible</h3>
          <p className="text-ctp-subtext0">
            Les succes seront disponibles bientot !
          </p>
        </div>
      )}
    </div>
  );
}

export default AchievementList;
