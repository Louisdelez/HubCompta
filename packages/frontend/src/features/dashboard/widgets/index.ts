// ============================================================================
// WIDGET REGISTRY - Finance Hub Dashboard
// Central registry for all dashboard widgets
// ============================================================================

import { lazy } from 'react';
import type { ComponentType } from 'react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetSize {
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  position: WidgetPosition;
  config: Record<string, unknown>;
}

export interface WidgetProps {
  workspaceId: string;
  config: Record<string, unknown>;
  onRefresh?: () => void;
}

export interface WidgetDefinition {
  type: WidgetType;
  name: string;
  description: string;
  icon: string;
  category: 'finance' | 'planning' | 'analytics' | 'utilities' | 'invest';
  defaultSize: WidgetSize;
  Component: ComponentType<WidgetProps>;
}

export type WidgetType =
  | 'accounts'
  | 'transactions'
  | 'budget'
  | 'networth'
  | 'savings'
  | 'upcoming'
  | 'spending'
  | 'quick-actions'
  | 'monthly-summary'
  | 'portfolio';

// ----------------------------------------------------------------------------
// Lazy-loaded Widget Components
// ----------------------------------------------------------------------------

const AccountsWidget = lazy(() => import('./AccountsWidget'));
const TransactionsWidget = lazy(() => import('./TransactionsWidget'));
const BudgetWidget = lazy(() => import('./BudgetWidget'));
const NetWorthWidget = lazy(() => import('./NetWorthWidget'));
const SavingsWidget = lazy(() => import('./SavingsWidget'));
const UpcomingWidget = lazy(() => import('./UpcomingWidget'));
const SpendingWidget = lazy(() => import('./SpendingWidget'));
const QuickActionsWidget = lazy(() => import('./QuickActionsWidget'));
const MonthlySummaryWidget = lazy(() => import('./MonthlySummaryWidget'));
const PortfolioWidget = lazy(() => import('./PortfolioWidget'));

// ----------------------------------------------------------------------------
// Widget Registry
// ----------------------------------------------------------------------------

export const WIDGET_REGISTRY: Record<WidgetType, WidgetDefinition> = {
  accounts: {
    type: 'accounts',
    name: 'Comptes',
    description: 'Affiche les soldes de vos comptes',
    icon: 'wallet',
    category: 'finance',
    defaultSize: { w: 4, h: 3, minW: 2, minH: 2, maxW: 6, maxH: 4 },
    Component: AccountsWidget,
  },
  transactions: {
    type: 'transactions',
    name: 'Transactions recentes',
    description: 'Liste des dernieres transactions',
    icon: 'credit-card',
    category: 'finance',
    defaultSize: { w: 4, h: 4, minW: 3, minH: 3, maxW: 6, maxH: 6 },
    Component: TransactionsWidget,
  },
  budget: {
    type: 'budget',
    name: 'Budgets',
    description: 'Progression de vos budgets',
    icon: 'pie-chart',
    category: 'finance',
    defaultSize: { w: 4, h: 3, minW: 2, minH: 2, maxW: 6, maxH: 4 },
    Component: BudgetWidget,
  },
  networth: {
    type: 'networth',
    name: 'Patrimoine net',
    description: 'Resume de votre patrimoine',
    icon: 'trending-up',
    category: 'finance',
    defaultSize: { w: 3, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 3 },
    Component: NetWorthWidget,
  },
  savings: {
    type: 'savings',
    name: 'Objectifs epargne',
    description: 'Progression de vos objectifs',
    icon: 'target',
    category: 'finance',
    defaultSize: { w: 4, h: 3, minW: 2, minH: 2, maxW: 6, maxH: 4 },
    Component: SavingsWidget,
  },
  upcoming: {
    type: 'upcoming',
    name: 'A venir',
    description: 'Transactions programmees et factures',
    icon: 'calendar',
    category: 'planning',
    defaultSize: { w: 4, h: 3, minW: 2, minH: 2, maxW: 6, maxH: 5 },
    Component: UpcomingWidget,
  },
  spending: {
    type: 'spending',
    name: 'Depenses par categorie',
    description: 'Graphique des depenses',
    icon: 'bar-chart-3',
    category: 'analytics',
    defaultSize: { w: 4, h: 4, minW: 3, minH: 3, maxW: 6, maxH: 5 },
    Component: SpendingWidget,
  },
  'quick-actions': {
    type: 'quick-actions',
    name: 'Actions rapides',
    description: "Boutons d'action rapide",
    icon: 'zap',
    category: 'utilities',
    defaultSize: { w: 2, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 3 },
    Component: QuickActionsWidget,
  },
  'monthly-summary': {
    type: 'monthly-summary',
    name: 'Resume mensuel',
    description: 'Resume des revenus et depenses',
    icon: 'bar-chart',
    category: 'finance',
    defaultSize: { w: 6, h: 2, minW: 4, minH: 2, maxW: 6, maxH: 3 },
    Component: MonthlySummaryWidget,
  },
  portfolio: {
    type: 'portfolio',
    name: 'Portefeuille',
    description: 'Resume des investissements',
    icon: 'briefcase',
    category: 'invest',
    defaultSize: { w: 4, h: 3, minW: 3, minH: 2, maxW: 6, maxH: 4 },
    Component: PortfolioWidget,
  },
};

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

export function getWidgetDefinition(type: WidgetType): WidgetDefinition | undefined {
  return WIDGET_REGISTRY[type];
}

export function getAllWidgetTypes(): WidgetType[] {
  return Object.keys(WIDGET_REGISTRY) as WidgetType[];
}

export function getWidgetsByCategory(category: WidgetDefinition['category']): WidgetDefinition[] {
  return Object.values(WIDGET_REGISTRY).filter((w) => w.category === category);
}

export function generateWidgetId(type: WidgetType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
