// ============================================================================
// GAMIFICATION ROUTES - Finance Hub
// Achievements, XP, and user stats
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { achievementService } from '@/modules/gamification/achievement.service.js';
import { authGuard } from '@/core/auth/authGuard.js';

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export function gamificationRoutes(app: FastifyInstance): void {
  // Apply auth guard
  app.addHook('preHandler', authGuard);

  // --------------------------------------------------------------------------
  // GET /gamification/stats - Get user stats
  // --------------------------------------------------------------------------
  app.get('/stats', async (request, reply) => {
    const userId = request.user!.sub;

    const stats = await achievementService.getOrCreateStats(userId);

    return reply.send({
      success: true,
      data: stats,
    });
  });

  // --------------------------------------------------------------------------
  // GET /gamification/achievements - Get user achievements
  // --------------------------------------------------------------------------
  app.get('/achievements', async (request, reply) => {
    const userId = request.user!.sub;

    const achievements = await achievementService.getUserAchievements(userId);

    // Group by category
    const grouped = achievements.reduce(
      (acc, achievement) => {
        if (!acc[achievement.category]) {
          acc[achievement.category] = [];
        }
        acc[achievement.category]!.push(achievement);
        return acc;
      },
      {} as Record<string, typeof achievements>
    );

    return reply.send({
      success: true,
      data: {
        achievements,
        grouped,
        summary: {
          total: achievements.length,
          unlocked: achievements.filter((a) => a.isUnlocked).length,
          totalXp: achievements.filter((a) => a.isUnlocked).reduce((sum, a) => sum + a.xpReward, 0),
        },
      },
    });
  });

  // --------------------------------------------------------------------------
  // GET /gamification/leaderboard - Get leaderboard
  // --------------------------------------------------------------------------
  app.get<{
    Querystring: { limit?: string };
  }>('/leaderboard', async (request, reply) => {
    const limit = parseInt(request.query.limit ?? '10', 10);

    const leaderboard = await achievementService.getLeaderboard(limit);

    return reply.send({
      success: true,
      data: leaderboard,
    });
  });

  // --------------------------------------------------------------------------
  // POST /gamification/activity - Record daily activity
  // --------------------------------------------------------------------------
  app.post('/activity', async (request, reply) => {
    const userId = request.user!.sub;

    const result = await achievementService.recordActivity(userId);

    return reply.send({
      success: true,
      data: result,
    });
  });
}

export default gamificationRoutes;
