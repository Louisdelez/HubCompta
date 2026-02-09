// ============================================================================
// DASHBOARD ROUTES - Finance Hub
// Handles dashboard layout and widget configuration
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { prisma } from '@/core/database/client.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { z } from 'zod';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface WidgetConfig {
  id: string;
  type: string;
  position: WidgetPosition;
  config: Record<string, unknown>;
}

interface DashboardLayoutBody {
  workspaceId?: string;
  widgets: WidgetConfig[];
}

// ----------------------------------------------------------------------------
// Widget Types Registry
// ----------------------------------------------------------------------------

const WIDGET_TYPES = [
  {
    type: 'accounts',
    name: 'Comptes',
    description: 'Affiche les soldes de vos comptes',
    icon: 'wallet',
    defaultSize: { w: 4, h: 3, minW: 2, minH: 2, maxW: 6, maxH: 4 },
    category: 'finance',
  },
  {
    type: 'transactions',
    name: 'Transactions recentes',
    description: 'Liste des dernieres transactions',
    icon: 'credit-card',
    defaultSize: { w: 4, h: 4, minW: 3, minH: 3, maxW: 6, maxH: 6 },
    category: 'finance',
  },
  {
    type: 'budget',
    name: 'Budgets',
    description: 'Progression de vos budgets',
    icon: 'pie-chart',
    defaultSize: { w: 4, h: 3, minW: 2, minH: 2, maxW: 6, maxH: 4 },
    category: 'finance',
  },
  {
    type: 'networth',
    name: 'Patrimoine net',
    description: 'Resume de votre patrimoine',
    icon: 'trending-up',
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 3 },
    category: 'finance',
  },
  {
    type: 'savings',
    name: 'Objectifs epargne',
    description: 'Progression de vos objectifs',
    icon: 'target',
    defaultSize: { w: 4, h: 3, minW: 2, minH: 2, maxW: 6, maxH: 4 },
    category: 'finance',
  },
  {
    type: 'upcoming',
    name: 'A venir',
    description: 'Transactions programmees et factures',
    icon: 'calendar',
    defaultSize: { w: 4, h: 3, minW: 2, minH: 2, maxW: 6, maxH: 5 },
    category: 'planning',
  },
  {
    type: 'spending',
    name: 'Depenses par categorie',
    description: 'Graphique des depenses',
    icon: 'bar-chart-3',
    defaultSize: { w: 4, h: 4, minW: 3, minH: 3, maxW: 6, maxH: 5 },
    category: 'analytics',
  },
  {
    type: 'quick-actions',
    name: 'Actions rapides',
    description: 'Boutons d\'action rapide',
    icon: 'zap',
    defaultSize: { w: 2, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 3 },
    category: 'utilities',
  },
  {
    type: 'monthly-summary',
    name: 'Resume mensuel',
    description: 'Resume des revenus et depenses',
    icon: 'bar-chart',
    defaultSize: { w: 6, h: 2, minW: 4, minH: 2, maxW: 6, maxH: 3 },
    category: 'finance',
  },
  {
    type: 'portfolio',
    name: 'Portefeuille',
    description: 'Resume des investissements',
    icon: 'briefcase',
    defaultSize: { w: 4, h: 3, minW: 3, minH: 2, maxW: 6, maxH: 4 },
    category: 'invest',
  },
] as const;

// ----------------------------------------------------------------------------
// Default Layout
// ----------------------------------------------------------------------------

const DEFAULT_WIDGETS: WidgetConfig[] = [
  {
    id: 'monthly-summary-1',
    type: 'monthly-summary',
    position: { x: 0, y: 0, w: 6, h: 2 },
    config: {},
  },
  {
    id: 'accounts-1',
    type: 'accounts',
    position: { x: 0, y: 2, w: 3, h: 3 },
    config: {},
  },
  {
    id: 'spending-1',
    type: 'spending',
    position: { x: 3, y: 2, w: 3, h: 3 },
    config: {},
  },
  {
    id: 'transactions-1',
    type: 'transactions',
    position: { x: 0, y: 5, w: 4, h: 4 },
    config: { limit: 10 },
  },
  {
    id: 'budget-1',
    type: 'budget',
    position: { x: 4, y: 5, w: 2, h: 4 },
    config: {},
  },
];

// ----------------------------------------------------------------------------
// Validation Schemas
// ----------------------------------------------------------------------------

const widgetPositionSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  w: z.number().min(1).max(12),
  h: z.number().min(1).max(12),
});

const widgetConfigSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  position: widgetPositionSchema,
  config: z.record(z.unknown()).default({}),
});

const layoutUpdateSchema = z.object({
  widgets: z.array(widgetConfigSchema),
});

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

export function dashboardRoutes(app: FastifyInstance): void {
  // Apply auth guard to all routes
  app.addHook('preHandler', authGuard);

  // --------------------------------------------------------------------------
  // GET /dashboard/layout - Get user's dashboard layout
  // --------------------------------------------------------------------------
  app.get<{ Querystring: { workspaceId?: string } }>(
    '/layout',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { workspaceId } = request.query;

      // Find existing layout
      const layout = await prisma.dashboardLayout.findFirst({
        where: {
          userId,
          workspaceId: workspaceId ?? null,
        },
      });

      if (!layout) {
        // Return default layout
        return reply.send({
          success: true,
          data: {
            widgets: DEFAULT_WIDGETS,
            isDefault: true,
          },
        });
      }

      return reply.send({
        success: true,
        data: {
          id: layout.id,
          widgets: layout.widgets as unknown as WidgetConfig[],
          isDefault: false,
          updatedAt: layout.updatedAt,
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // PUT /dashboard/layout - Save dashboard layout
  // --------------------------------------------------------------------------
  app.put<{ Body: DashboardLayoutBody; Querystring: { workspaceId?: string } }>(
    '/layout',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { workspaceId } = request.query;

      // Validate input
      const parsed = layoutUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid layout data',
            details: parsed.error.flatten(),
          },
        });
      }

      const { widgets } = parsed.data;

      // Validate widget types
      const validTypes = WIDGET_TYPES.map((w) => w.type);
      const invalidWidgets = widgets.filter((w) => !validTypes.includes(w.type as typeof validTypes[number]));
      if (invalidWidgets.length > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_WIDGET_TYPE',
            message: `Invalid widget types: ${invalidWidgets.map((w) => w.type).join(', ')}`,
          },
        });
      }

      // If workspaceId provided, verify user has access
      if (workspaceId) {
        const membership = await prisma.membership.findFirst({
          where: { workspaceId, userId },
        });
        if (!membership) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have access to this workspace',
            },
          });
        }
      }

      // Find existing or create
      const existing = await prisma.dashboardLayout.findFirst({
        where: {
          userId,
          workspaceId: workspaceId ?? null,
        },
      });

      let layout;
      if (existing) {
        layout = await prisma.dashboardLayout.update({
          where: { id: existing.id },
          data: { widgets: widgets as unknown as object },
        });
      } else {
        layout = await prisma.dashboardLayout.create({
          data: {
            userId,
            workspaceId: workspaceId ?? null,
            widgets: widgets as unknown as object,
          },
        });
      }

      return reply.send({
        success: true,
        data: {
          id: layout.id,
          widgets: layout.widgets as unknown as WidgetConfig[],
          updatedAt: layout.updatedAt,
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /dashboard/layout - Reset to default layout
  // --------------------------------------------------------------------------
  app.delete<{ Querystring: { workspaceId?: string } }>(
    '/layout',
    async (request, reply) => {
      const userId = request.user!.sub;
      const { workspaceId } = request.query;

      await prisma.dashboardLayout.deleteMany({
        where: {
          userId,
          workspaceId: workspaceId ?? null,
        },
      });

      return reply.send({
        success: true,
        data: {
          widgets: DEFAULT_WIDGETS,
          isDefault: true,
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /dashboard/widgets - List available widget types
  // --------------------------------------------------------------------------
  app.get('/widgets', async (_request, reply) => {
    return reply.send({
      success: true,
      data: WIDGET_TYPES,
    });
  });

  // --------------------------------------------------------------------------
  // GET /dashboard/widgets/default - Get default layout
  // --------------------------------------------------------------------------
  app.get('/widgets/default', async (_request, reply) => {
    return reply.send({
      success: true,
      data: DEFAULT_WIDGETS,
    });
  });
}

export default dashboardRoutes;
