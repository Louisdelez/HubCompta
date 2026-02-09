// ============================================================================
// FORECAST WIDGET COMPONENT - Finance Hub
// Dashboard widget showing forecast summary
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { TrendingUp, ArrowRight, Sparkles } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ForecastSummary {
  nextMonth: {
    date: string;
    totalPredicted: number;
    confidence: number;
    method: string;
  };
  topCategories: {
    categoryId: string;
    categoryName: string;
    categoryIcon: string | null;
    categoryColor: string | null;
    predictedAmount: number;
    confidence: number;
  }[];
  accuracy: {
    mape: number;
    rmse: number;
    accuracy: number;
  };
}

interface ForecastWidgetProps {
  className?: string;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function getMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    average: 'moyenne',
    trend: 'tendance',
    seasonal: 'saisonnier',
  };
  return labels[method] || method;
}

function getConfidenceLevel(confidence: number): { label: string; color: string } {
  if (confidence >= 0.7) {
    return { label: 'Haute', color: 'text-ctp-green' };
  } else if (confidence >= 0.4) {
    return { label: 'Moyenne', color: 'text-ctp-yellow' };
  }
  return { label: 'Basse', color: 'text-ctp-peach' };
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ForecastWidget({ className }: ForecastWidgetProps) {
  const { currentWorkspaceId: workspaceId } = useWorkspace();

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['forecast', workspaceId, 'summary'],
    queryFn: () => api.get<ForecastSummary>(`/workspaces/${workspaceId}/forecast/summary`),
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });

  if (!workspaceId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={cn('card p-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-ctp-surface1 rounded w-1/3" />
          <div className="h-8 bg-ctp-surface1 rounded w-1/2" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-ctp-surface1 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className={cn('card p-6', className)}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-ctp-mauve" />
          <h3 className="font-semibold">Previsions</h3>
        </div>
        <p className="text-sm text-ctp-subtext0">
          Les previsions seront disponibles apres quelques mois de transactions.
        </p>
      </div>
    );
  }

  const nextMonthDate = new Date(summary.nextMonth.date);
  const confidenceInfo = getConfidenceLevel(summary.nextMonth.confidence);

  return (
    <div className={cn('card p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-ctp-mauve/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-ctp-mauve" />
          </div>
          <h3 className="font-semibold">Previsions</h3>
        </div>
        <Link
          to={`/workspaces/${workspaceId}/forecast`}
          className="text-sm text-ctp-mauve hover:text-ctp-pink flex items-center gap-1"
        >
          Voir tout
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Next Month Forecast */}
      <div className="bg-ctp-surface0 rounded-xl p-4 mb-4">
        <p className="text-sm text-ctp-subtext0 mb-1">
          Depenses prevues pour {format(nextMonthDate, 'MMMM yyyy', { locale: fr })}
        </p>
        <p className="text-2xl font-bold text-ctp-text">
          {formatCurrency(summary.nextMonth.totalPredicted, 'EUR')}
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs">
          <span className={confidenceInfo.color}>
            Confiance {confidenceInfo.label.toLowerCase()}
          </span>
          <span className="text-ctp-overlay1">-</span>
          <span className="text-ctp-subtext0">
            Modele {getMethodLabel(summary.nextMonth.method)}
          </span>
        </div>
      </div>

      {/* Top Categories */}
      {summary.topCategories.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-ctp-subtext0 uppercase tracking-wide">
            Top categories
          </p>
          {summary.topCategories.slice(0, 3).map((category) => (
            <div
              key={category.categoryId}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <span>{category.categoryIcon || '?'}</span>
                <span className="text-ctp-text">{category.categoryName}</span>
              </div>
              <span className="font-medium text-ctp-subtext1">
                {formatCurrency(category.predictedAmount, 'EUR')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Accuracy Badge */}
      {summary.accuracy.accuracy > 0 && (
        <div className="mt-4 pt-4 border-t border-ctp-surface1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ctp-subtext0">Precision du modele</span>
            <span
              className={cn(
                'font-medium',
                summary.accuracy.accuracy >= 80
                  ? 'text-ctp-green'
                  : summary.accuracy.accuracy >= 60
                    ? 'text-ctp-yellow'
                    : 'text-ctp-peach'
              )}
            >
              {summary.accuracy.accuracy.toFixed(0)}%
            </span>
          </div>
          <div className="mt-1 h-1 bg-ctp-surface1 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', {
                'bg-ctp-green': summary.accuracy.accuracy >= 80,
                'bg-ctp-yellow':
                  summary.accuracy.accuracy >= 60 && summary.accuracy.accuracy < 80,
                'bg-ctp-peach': summary.accuracy.accuracy < 60,
              })}
              style={{ width: `${summary.accuracy.accuracy}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ForecastWidget;
