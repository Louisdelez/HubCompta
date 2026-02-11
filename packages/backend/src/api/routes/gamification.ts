// ============================================================================
// GAMIFICATION ROUTES - Finance Hub
// Achievements, XP, and user stats
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { achievementService } from '@/modules/gamification/achievement.service.js';
import { authGuard } from '@/core/auth/authGuard.js';

// ----------------------------------------------------------------------------
// OpenAPI Schemas
// ----------------------------------------------------------------------------

const userStatsSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const, format: 'uuid' },
    userId: { type: 'string' as const, format: 'uuid' },
    level: { type: 'integer' as const, minimum: 1 },
    currentXp: { type: 'integer' as const, minimum: 0 },
    totalXp: { type: 'integer' as const, minimum: 0 },
    xpToNextLevel: { type: 'integer' as const },
    streak: { type: 'integer' as const, minimum: 0, description: 'Current activity streak in days' },
    longestStreak: { type: 'integer' as const, minimum: 0 },
    lastActivityAt: { type: 'string' as const, format: 'date-time', nullable: true },
    createdAt: { type: 'string' as const, format: 'date-time' },
    updatedAt: { type: 'string' as const, format: 'date-time' },
  },
};

const achievementSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    name: { type: 'string' as const },
    description: { type: 'string' as const },
    category: { type: 'string' as const, enum: ['budgeting', 'saving', 'tracking', 'engagement', 'milestones'] },
    icon: { type: 'string' as const },
    xpReward: { type: 'integer' as const },
    isUnlocked: { type: 'boolean' as const },
    unlockedAt: { type: 'string' as const, format: 'date-time', nullable: true },
    progress: { type: 'number' as const, minimum: 0, maximum: 100, description: 'Progress percentage' },
  },
};

const leaderboardEntrySchema = {
  type: 'object' as const,
  properties: {
    rank: { type: 'integer' as const },
    userId: { type: 'string' as const, format: 'uuid' },
    username: { type: 'string' as const },
    level: { type: 'integer' as const },
    totalXp: { type: 'integer' as const },
    achievementCount: { type: 'integer' as const },
  },
};

const successResponseSchema = (dataSchema: object) => ({
  type: 'object' as const,
  properties: {
    success: { type: 'boolean' as const, enum: [true] },
    data: dataSchema,
  },
});

const errorResponseSchema = {
  type: 'object' as const,
  properties: {
    success: { type: 'boolean' as const, enum: [false] },
    error: {
      type: 'object' as const,
      properties: {
        message: { type: 'string' as const },
        code: { type: 'string' as const },
      },
    },
  },
};

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export function gamificationRoutes(app: FastifyInstance): void {
  // Apply auth guard
  app.addHook('preHandler', authGuard);

  // --------------------------------------------------------------------------
  // GET /gamification/stats - Get user stats
  // --------------------------------------------------------------------------
  app.get('/stats', {
    schema: {
      summary: 'Get user stats',
      description: 'Retrieve the current user\'s gamification stats including level, XP, and streak information.',
      tags: ['Gamification'],
      security: [{ bearerAuth: [] }],
      response: {
        200: successResponseSchema(userStatsSchema),
        401: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
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
  app.get('/achievements', {
    schema: {
      summary: 'Get user achievements',
      description: 'Retrieve all achievements with unlock status and progress, grouped by category.',
      tags: ['Gamification'],
      security: [{ bearerAuth: [] }],
      response: {
        200: successResponseSchema({
          type: 'object' as const,
          properties: {
            achievements: { type: 'array' as const, items: achievementSchema },
            grouped: {
              type: 'object' as const,
              additionalProperties: { type: 'array' as const, items: achievementSchema },
              description: 'Achievements grouped by category',
            },
            summary: {
              type: 'object' as const,
              properties: {
                total: { type: 'integer' as const },
                unlocked: { type: 'integer' as const },
                totalXp: { type: 'integer' as const, description: 'Total XP earned from achievements' },
              },
            },
          },
        }),
        401: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
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
  }>('/leaderboard', {
    schema: {
      summary: 'Get leaderboard',
      description: 'Retrieve the top users ranked by level and XP.',
      tags: ['Gamification'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object' as const,
        properties: {
          limit: { type: 'string' as const, pattern: '^[0-9]+$', default: '10', description: 'Number of entries to return' },
        },
      },
      response: {
        200: successResponseSchema({ type: 'array' as const, items: leaderboardEntrySchema }),
        401: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
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
  app.post('/activity', {
    schema: {
      summary: 'Record daily activity',
      description: 'Record user activity to maintain streak and earn XP. Should be called once per day.',
      tags: ['Gamification'],
      security: [{ bearerAuth: [] }],
      response: {
        200: successResponseSchema({
          type: 'object' as const,
          properties: {
            xpEarned: { type: 'integer' as const },
            newStreak: { type: 'integer' as const },
            levelUp: { type: 'boolean' as const },
            newLevel: { type: 'integer' as const, nullable: true },
            unlockedAchievements: { type: 'array' as const, items: achievementSchema },
          },
        }),
        401: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.sub;

    const result = await achievementService.recordActivity(userId);

    return reply.send({
      success: true,
      data: result,
    });
  });
}

export default gamificationRoutes;
