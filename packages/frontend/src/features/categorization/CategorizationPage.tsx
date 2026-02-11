// ============================================================================
// CATEGORIZATION PAGE - Finance Hub
// AI-powered categorization dashboard with training and auto-categorization
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Brain,
  Target,
  TrendingUp,
  CheckCircle,
  XCircle,
  Loader2,
  Zap,
  BarChart3,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { BulkCategorize } from './BulkCategorize';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface CategorizationStats {
  totalPatterns: number;
  totalPredictions: number;
  acceptedPredictions: number;
  rejectedPredictions: number;
  accuracy: number;
}

interface TrainResponse {
  success: boolean;
  patternsCreated: number;
  message?: string;
}

interface AutoCategorizeResponse {
  success: boolean;
  categorizedCount: number;
  message?: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function CategorizationPage() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [minConfidence, setMinConfidence] = useState(0.8);

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['categorization', workspaceId, 'stats'],
    queryFn: () =>
      api.get<CategorizationStats>(
        `/workspaces/${workspaceId}/categorization/stats`
      ),
    enabled: !!workspaceId,
  });

  // Train model mutation
  const trainMutation = useMutation({
    mutationFn: () =>
      api.post<TrainResponse>(
        `/workspaces/${workspaceId}/categorization/train`,
        {}
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['categorization', workspaceId],
      });
    },
  });

  // Auto-categorize mutation
  const autoCategorize = useMutation({
    mutationFn: () =>
      api.post<AutoCategorizeResponse>(
        `/workspaces/${workspaceId}/categorization/auto`,
        { minConfidence }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['transactions', workspaceId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['categorization', workspaceId],
      });
    },
  });

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-ctp-subtext0">
        Selectionnez un espace de travail
      </div>
    );
  }

  if (statsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-ctp-surface1 rounded w-1/3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="h-24 bg-ctp-surface1 rounded-xl" />
            <div className="h-24 bg-ctp-surface1 rounded-xl" />
            <div className="h-24 bg-ctp-surface1 rounded-xl" />
            <div className="h-24 bg-ctp-surface1 rounded-xl" />
          </div>
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
          <Sparkles className="w-7 h-7 text-ctp-mauve" />
          Categorisation IA
        </h1>
        <p className="text-ctp-subtext0">
          Utilisez l'intelligence artificielle pour categoriser automatiquement
          vos transactions
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Patterns */}
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-ctp-blue/20">
              <Brain className="w-5 h-5 text-ctp-blue" />
            </div>
            <span className="text-sm text-ctp-subtext0">Patterns</span>
          </div>
          <p className="text-2xl font-bold text-ctp-text">
            {stats?.totalPatterns ?? 0}
          </p>
        </div>

        {/* Predictions */}
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-ctp-mauve/20">
              <Target className="w-5 h-5 text-ctp-mauve" />
            </div>
            <span className="text-sm text-ctp-subtext0">Predictions</span>
          </div>
          <p className="text-2xl font-bold text-ctp-text">
            {stats?.totalPredictions ?? 0}
          </p>
        </div>

        {/* Accepted / Rejected */}
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-ctp-green/20">
              <CheckCircle className="w-5 h-5 text-ctp-green" />
            </div>
            <span className="text-sm text-ctp-subtext0">Acceptees</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-ctp-green">
              {stats?.acceptedPredictions ?? 0}
            </p>
            <span className="text-sm text-ctp-subtext0">/</span>
            <p className="text-lg font-semibold text-ctp-red flex items-center gap-1">
              <XCircle className="w-4 h-4" />
              {stats?.rejectedPredictions ?? 0}
            </p>
          </div>
        </div>

        {/* Accuracy */}
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-ctp-yellow/20">
              <TrendingUp className="w-5 h-5 text-ctp-yellow" />
            </div>
            <span className="text-sm text-ctp-subtext0">Precision</span>
          </div>
          <p className="text-2xl font-bold text-ctp-text">
            {stats?.accuracy !== undefined
              ? `${stats.accuracy}%`
              : 'N/A'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Train Model Section */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-ctp-blue/20">
              <Brain className="w-6 h-6 text-ctp-blue" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Entrainer le modele</h2>
              <p className="text-sm text-ctp-subtext0">
                Analysez vos transactions pour ameliorer les predictions
              </p>
            </div>
          </div>

          <div className="bg-ctp-surface0 rounded-lg p-4 mb-4">
            <p className="text-sm text-ctp-subtext0">
              L'entrainement analyse vos transactions categorisees pour creer
              des patterns de reconnaissance. Plus vous avez de transactions
              categorisees, plus les predictions seront precises.
            </p>
          </div>

          {trainMutation.isSuccess && (
            <div className="bg-ctp-green/10 border border-ctp-green/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-ctp-green flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Entrainement termine avec succes !
              </p>
            </div>
          )}

          {trainMutation.isError && (
            <div className="bg-ctp-red/10 border border-ctp-red/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-ctp-red flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Erreur lors de l'entrainement
              </p>
            </div>
          )}

          <button
            onClick={() => trainMutation.mutate()}
            disabled={trainMutation.isPending}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {trainMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Entrainement en cours...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4" />
                Lancer l'entrainement
              </>
            )}
          </button>
        </div>

        {/* Auto-categorize Section */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-ctp-mauve/20">
              <Zap className="w-6 h-6 text-ctp-mauve" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Auto-categorisation</h2>
              <p className="text-sm text-ctp-subtext0">
                Categorisez automatiquement les transactions non classees
              </p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Confiance minimale: {Math.round(minConfidence * 100)}%
            </label>
            <input
              type="range"
              min={0.5}
              max={0.99}
              step={0.01}
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="w-full h-2 bg-ctp-surface1 rounded-lg appearance-none cursor-pointer accent-ctp-mauve"
            />
            <div className="flex justify-between text-xs text-ctp-subtext0 mt-1">
              <span>50%</span>
              <span>99%</span>
            </div>
          </div>

          <div className="bg-ctp-surface0 rounded-lg p-4 mb-4">
            <p className="text-sm text-ctp-subtext0">
              Seules les transactions avec une confiance superieure a{' '}
              <span className="font-semibold text-ctp-mauve">
                {Math.round(minConfidence * 100)}%
              </span>{' '}
              seront automatiquement categorisees.
            </p>
          </div>

          {autoCategorize.isSuccess && (
            <div className="bg-ctp-green/10 border border-ctp-green/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-ctp-green flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Auto-categorisation terminee !
              </p>
            </div>
          )}

          {autoCategorize.isError && (
            <div className="bg-ctp-red/10 border border-ctp-red/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-ctp-red flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Erreur lors de l'auto-categorisation
              </p>
            </div>
          )}

          <button
            onClick={() => autoCategorize.mutate()}
            disabled={autoCategorize.isPending}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {autoCategorize.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Categorisation en cours...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Lancer l'auto-categorisation
              </>
            )}
          </button>
        </div>
      </div>

      {/* Bulk Categorize Section */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-ctp-peach/20">
            <BarChart3 className="w-6 h-6 text-ctp-peach" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Suggestions a reviser</h2>
            <p className="text-sm text-ctp-subtext0">
              Validez ou rejetez les suggestions de l'IA pour ameliorer les
              predictions futures
            </p>
          </div>
        </div>
        <BulkCategorize />
      </div>
    </div>
  );
}

export default CategorizationPage;
