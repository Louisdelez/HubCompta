// ============================================================================
// SMART INSIGHT CARD - Finance Hub
// Display AI-generated insights and recommendations
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  ChevronRight,
  X,
  Loader2,
  Wallet,
  Receipt,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { clsx } from 'clsx';

type InsightType =
  | 'spending_spike'
  | 'saving_opportunity'
  | 'budget_risk'
  | 'trend'
  | 'tip'
  | 'unusual_spending'
  | 'weekly_summary'
  | 'monthly_report'
  | 'low_balance_warning'
  | 'bill_upcoming';

interface Insight {
  id: string;
  type: InsightType;
  title: string;
  message: string;
  impact?: number;
  category?: string;
  actionUrl?: string;
  actionLabel?: string;
  severity: 'info' | 'warning' | 'success' | 'danger';
  createdAt: string;
  data?: Record<string, unknown>;
}

interface SmartInsightCardProps {
  compact?: boolean;
  limit?: number;
}

const insightTypeConfig: Record<
  InsightType,
  { icon: typeof Sparkles; color: string; bgColor: string }
> = {
  spending_spike: { icon: TrendingUp, color: 'text-ctp-red', bgColor: 'bg-ctp-red/20' },
  saving_opportunity: { icon: Lightbulb, color: 'text-ctp-green', bgColor: 'bg-ctp-green/20' },
  budget_risk: { icon: AlertTriangle, color: 'text-ctp-yellow', bgColor: 'bg-ctp-yellow/20' },
  trend: { icon: TrendingDown, color: 'text-ctp-blue', bgColor: 'bg-ctp-blue/20' },
  tip: { icon: Sparkles, color: 'text-ctp-mauve', bgColor: 'bg-ctp-mauve/20' },
  unusual_spending: { icon: AlertTriangle, color: 'text-ctp-peach', bgColor: 'bg-ctp-peach/20' },
  weekly_summary: { icon: Calendar, color: 'text-ctp-teal', bgColor: 'bg-ctp-teal/20' },
  monthly_report: { icon: BarChart3, color: 'text-ctp-sapphire', bgColor: 'bg-ctp-sapphire/20' },
  low_balance_warning: { icon: Wallet, color: 'text-ctp-maroon', bgColor: 'bg-ctp-maroon/20' },
  bill_upcoming: { icon: Receipt, color: 'text-ctp-flamingo', bgColor: 'bg-ctp-flamingo/20' },
};

const severityColors: Record<Insight['severity'], string> = {
  info: 'bg-ctp-blue/10 border-ctp-blue/30',
  warning: 'bg-ctp-yellow/10 border-ctp-yellow/30',
  success: 'bg-ctp-green/10 border-ctp-green/30',
  danger: 'bg-ctp-red/10 border-ctp-red/30',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function SmartInsightCard({ compact = false, limit = 5 }: SmartInsightCardProps) {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const { data: insightsData = [], isLoading } = useQuery({
    queryKey: ['insights', workspaceId],
    queryFn: () =>
      api.get<Insight[]>(`/workspaces/${workspaceId}/insights`),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const insights = insightsData
    .filter((insight) => !dismissedIds.has(insight.id))
    .slice(0, limit);

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  if (!workspaceId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={clsx('card', compact && 'p-3')}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-ctp-mauve" />
          <h3 className="font-semibold">Insights</h3>
        </div>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-ctp-blue" />
        </div>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className={clsx('card', compact && 'p-3')}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-ctp-mauve" />
          <h3 className="font-semibold">Insights</h3>
        </div>
        <div className="text-center py-4 text-ctp-subtext0 text-sm">
          Aucun insight disponible pour le moment
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {insights.map((insight) => {
          const config = insightTypeConfig[insight.type];
          const Icon = config.icon;

          return (
            <div
              key={insight.id}
              className={clsx(
                'flex items-start gap-3 p-3 rounded-lg border',
                severityColors[insight.severity]
              )}
            >
              <Icon className={clsx('w-5 h-5 flex-shrink-0 mt-0.5', config.color)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ctp-text line-clamp-2">
                  {insight.title}
                </p>
                {insight.impact && (
                  <p className="text-xs text-ctp-subtext0 mt-0.5">
                    Impact: {formatCurrency(insight.impact)}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDismiss(insight.id)}
                className="p-1 rounded hover:bg-ctp-surface0"
              >
                <X className="w-4 h-4 text-ctp-overlay0" />
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-ctp-mauve" />
          <h3 className="font-semibold">Insights intelligents</h3>
        </div>
        <span className="text-xs text-ctp-subtext0 bg-ctp-surface0 px-2 py-1 rounded-full">
          {insights.length} nouveau{insights.length > 1 ? 'x' : ''}
        </span>
      </div>

      {/* Insights List */}
      <div className="space-y-3">
        {insights.map((insight) => {
          const config = insightTypeConfig[insight.type];
          const Icon = config.icon;

          return (
            <div
              key={insight.id}
              className={clsx(
                'relative p-4 rounded-lg border transition-all hover:shadow-sm',
                severityColors[insight.severity]
              )}
            >
              {/* Dismiss button */}
              <button
                onClick={() => handleDismiss(insight.id)}
                className="absolute top-2 right-2 p-1 rounded hover:bg-ctp-surface0"
              >
                <X className="w-4 h-4 text-ctp-overlay0" />
              </button>

              <div className="flex gap-3">
                {/* Icon */}
                <div
                  className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                    config.bgColor
                  )}
                >
                  <Icon className={clsx('w-5 h-5', config.color)} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-6">
                  <h4 className="font-medium text-ctp-text mb-1">
                    {insight.title}
                  </h4>
                  <p className="text-sm text-ctp-subtext0 mb-2">
                    {insight.message}
                  </p>

                  {/* Impact */}
                  {insight.impact && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-ctp-subtext0">Impact:</span>
                      <span
                        className={clsx(
                          'text-sm font-semibold',
                          insight.impact > 0 ? 'text-ctp-red' : 'text-ctp-green'
                        )}
                      >
                        {insight.impact > 0 ? '+' : ''}
                        {formatCurrency(insight.impact)}
                      </span>
                    </div>
                  )}

                  {/* Category */}
                  {insight.category && (
                    <span className="inline-block text-xs bg-ctp-surface0 text-ctp-subtext0 px-2 py-0.5 rounded-full">
                      {insight.category}
                    </span>
                  )}

                  {/* Smart notification specific data */}
                  {insight.type === 'weekly_summary' && insight.data && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(insight.data.topCategories as string[] | undefined)?.slice(0, 3).map((cat) => (
                        <span
                          key={cat}
                          className="text-xs bg-ctp-surface0 text-ctp-subtext0 px-2 py-0.5 rounded-full"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}

                  {insight.type === 'low_balance_warning' && insight.data && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-ctp-subtext0">Solde:</span>
                      <span className="text-sm font-semibold text-ctp-red">
                        {formatCurrency((insight.data.balance as number) ?? 0)}
                      </span>
                    </div>
                  )}

                  {insight.type === 'bill_upcoming' && insight.data && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-ctp-subtext0">Echeance:</span>
                      <span className="text-sm font-medium text-ctp-text">
                        {(insight.data.daysUntilDue as number) === 0
                          ? "Aujourd'hui"
                          : (insight.data.daysUntilDue as number) === 1
                          ? 'Demain'
                          : `Dans ${insight.data.daysUntilDue} jours`}
                      </span>
                    </div>
                  )}

                  {/* Action */}
                  {insight.actionUrl && (
                    <a
                      href={insight.actionUrl}
                      className="inline-flex items-center gap-1 text-sm text-ctp-blue hover:underline mt-2"
                    >
                      {insight.actionLabel ?? 'Voir details'}
                      <ChevronRight className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SmartInsightCard;
