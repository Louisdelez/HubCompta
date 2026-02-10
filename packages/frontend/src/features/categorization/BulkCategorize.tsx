// ============================================================================
// BULK CATEGORIZE - Finance Hub
// Review and categorize multiple AI suggestions at once
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Check, X, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';

interface PendingPrediction {
  transactionId: string;
  description: string;
  amount: number;
  date: string;
  suggestedCategory: {
    id: string;
    name: string;
  };
  confidence: number;
}

interface BulkCategorizeProps {
  onComplete?: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

export function BulkCategorize({ onComplete }: BulkCategorizeProps) {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch pending predictions
  const { data: pendingResponse, isLoading } = useQuery({
    queryKey: ['categorization', workspaceId, 'pending'],
    queryFn: () =>
      api.get<{ data: PendingPrediction[] }>(
        `/workspaces/${workspaceId}/categorization/pending`
      ),
    enabled: !!workspaceId,
  });

  const pending = pendingResponse?.data ?? [];
  const currentItem = pending[currentIndex];
  const remainingCount = pending.length - Object.keys(decisions).length;

  // Submit feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: (data: { transactionId: string; accepted: boolean }) =>
      api.post(`/workspaces/${workspaceId}/categorization/feedback`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transactions', workspaceId] });
    },
  });

  // Auto-categorize mutation
  const autoCategorize = useMutation({
    mutationFn: () =>
      api.post(`/workspaces/${workspaceId}/categorization/auto`, { minConfidence: 0.8 }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transactions', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['categorization', workspaceId] });
      onComplete?.();
    },
  });

  const handleDecision = (accept: boolean) => {
    if (!currentItem) return;

    setDecisions((prev) => ({ ...prev, [currentItem.transactionId]: accept }));
    feedbackMutation.mutate({
      transactionId: currentItem.transactionId,
      accepted: accept,
    });

    if (currentIndex < pending.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSkip = () => {
    if (currentIndex < pending.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSubmitAll = async () => {
    // Process remaining accepted decisions
    for (const [transactionId, accepted] of Object.entries(decisions)) {
      if (!feedbackMutation.isSuccess) {
        await feedbackMutation.mutateAsync({ transactionId, accepted });
      }
    }
    onComplete?.();
  };

  if (!workspaceId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="card p-8 text-center">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-ctp-blue mb-4" />
        <p className="text-ctp-subtext0">Chargement des suggestions...</p>
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Sparkles className="w-12 h-12 mx-auto text-ctp-green mb-4" />
        <h3 className="text-lg font-semibold mb-2">Tout est categorise !</h3>
        <p className="text-ctp-subtext0 mb-4">
          Aucune transaction ne necessite de revision.
        </p>
        <button
          onClick={() => autoCategorize.mutate()}
          disabled={autoCategorize.isPending}
          className="btn-secondary"
        >
          {autoCategorize.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          Auto-categoriser les transactions
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-ctp-surface1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-ctp-blue" />
          <h3 className="font-semibold">Suggestions IA</h3>
        </div>
        <span className="text-sm text-ctp-subtext0">
          {remainingCount} a revoir
        </span>
      </div>

      {/* Current Item */}
      {currentItem && (
        <div className="p-6">
          {/* Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-ctp-subtext0 mb-1">
              <span>Progression</span>
              <span>{currentIndex + 1} / {pending.length}</span>
            </div>
            <div className="h-1.5 bg-ctp-surface1 rounded-full overflow-hidden">
              <div
                className="h-full bg-ctp-blue transition-all"
                style={{ width: `${((currentIndex + 1) / pending.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Transaction Info */}
          <div className="bg-ctp-surface0 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ctp-text truncate">
                  {currentItem.description}
                </p>
                <p className="text-sm text-ctp-subtext0">
                  {formatDate(currentItem.date)}
                </p>
              </div>
              <span
                className={`font-semibold ${currentItem.amount < 0 ? 'text-ctp-red' : 'text-ctp-green'}`}
              >
                {formatCurrency(currentItem.amount)}
              </span>
            </div>
          </div>

          {/* Suggestion */}
          <div className="flex items-center gap-3 mb-6">
            <ArrowRight className="w-5 h-5 text-ctp-subtext0 flex-shrink-0" />
            <div className="flex-1 bg-ctp-blue/10 border border-ctp-blue/30 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ctp-text">
                  {currentItem.suggestedCategory.name}
                </span>
                <span
                  className={`text-sm ${
                    currentItem.confidence >= 0.8 ? 'text-ctp-green' :
                    currentItem.confidence >= 0.6 ? 'text-ctp-yellow' :
                    'text-ctp-peach'
                  }`}
                >
                  {Math.round(currentItem.confidence * 100)}% confiance
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => handleDecision(false)}
              disabled={feedbackMutation.isPending}
              className="btn-secondary flex items-center justify-center gap-2 text-ctp-red"
            >
              <X className="w-4 h-4" />
              Rejeter
            </button>
            <button
              onClick={handleSkip}
              className="btn-ghost"
            >
              Passer
            </button>
            <button
              onClick={() => handleDecision(true)}
              disabled={feedbackMutation.isPending}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Accepter
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-ctp-surface1 flex justify-between">
        <button
          onClick={() => autoCategorize.mutate()}
          disabled={autoCategorize.isPending}
          className="btn-ghost text-sm"
        >
          {autoCategorize.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <Sparkles className="w-4 h-4 mr-1" />
          )}
          Auto-accepter haute confiance
        </button>
        <button onClick={handleSubmitAll} className="btn-secondary text-sm">
          Terminer
        </button>
      </div>
    </div>
  );
}

export default BulkCategorize;
