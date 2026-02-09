// ============================================================================
// SAVINGS PAGE - Finance Hub
// Main page with grid of savings goals
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, Plus, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { SavingsGoalCard } from './SavingsGoalCard';
import { SavingsGoalModal } from './SavingsGoalModal';
import { ContributionModal } from './ContributionModal';
import { SavingsProgress } from './SavingsProgress';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface SavingsGoalWithProgress {
  id: string;
  workspaceId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  targetDate: string | null;
  icon: string | null;
  color: string | null;
  accountId: string | null;
  account: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  isCompleted: boolean;
  completedAt: string | null;
  progress: number;
  remainingAmount: number;
  avgMonthlyContribution: number | null;
  projectedCompletionDate: string | null;
  daysUntilTarget: number | null;
  isOnTrack: boolean | null;
  contributions: Array<{
    id: string;
    amount: number;
    date: string;
    notes: string | null;
  }>;
  contributionCount: number;
}

interface SavingsSummary {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  totalTargetAmount: number;
  totalCurrentAmount: number;
  totalRemainingAmount: number;
  overallProgress: number;
  goalsByCurrency: Record<string, { target: number; current: number; count: number }>;
}

interface ContributionHistory {
  id: string;
  goalId: string;
  amount: number;
  date: string;
  notes: string | null;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount);
}

// ----------------------------------------------------------------------------
// History Modal Component
// ----------------------------------------------------------------------------

function HistoryModal({
  workspaceId,
  goal,
  onClose,
}: {
  workspaceId: string;
  goal: SavingsGoalWithProgress;
  onClose: () => void;
}) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['savings', workspaceId, goal.id, 'history'],
    queryFn: () =>
      api.get<{ data: ContributionHistory[] }>(
        `/workspaces/${workspaceId}/savings/${goal.id}/history`
      ),
    select: (res) => res.data,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-ctp-base rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden animate-scale-in">
        <div className="p-6 border-b border-ctp-surface1">
          <div className="flex items-center gap-2">
            {goal.icon && <span className="text-2xl">{goal.icon}</span>}
            <h2 className="text-xl font-bold">Historique - {goal.name}</h2>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-ctp-surface1 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : history && history.length > 0 ? (
            <div className="space-y-3">
              {history.map((contribution) => (
                <div
                  key={contribution.id}
                  className="flex items-center justify-between p-3 bg-ctp-surface0 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-ctp-green">
                      +{formatCurrency(contribution.amount, goal.currency)}
                    </p>
                    <p className="text-sm text-ctp-subtext0">
                      {new Date(contribution.date).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    {contribution.notes && (
                      <p className="text-sm text-ctp-subtext1 mt-1">{contribution.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-ctp-subtext0">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Aucune contribution</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-ctp-surface1">
          <button onClick={onClose} className="btn-secondary w-full">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------------

export function SavingsPage() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoalWithProgress | null>(null);
  const [contributingGoal, setContributingGoal] = useState<SavingsGoalWithProgress | null>(null);
  const [historyGoal, setHistoryGoal] = useState<SavingsGoalWithProgress | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  // Fetch goals
  const { data: goalsResponse, isLoading } = useQuery({
    queryKey: ['savings', workspaceId, showCompleted ? 'all' : 'active'],
    queryFn: () =>
      api.get<{ data: SavingsGoalWithProgress[] }>(
        `/workspaces/${workspaceId}/savings?includeCompleted=${showCompleted}`
      ),
    enabled: !!workspaceId,
  });

  const goals = goalsResponse?.data ?? [];

  // Fetch summary
  const { data: summaryResponse } = useQuery({
    queryKey: ['savings', workspaceId, 'summary'],
    queryFn: () => api.get<{ data: SavingsSummary }>(`/workspaces/${workspaceId}/savings/summary`),
    enabled: !!workspaceId,
  });

  const summary = summaryResponse?.data;

  const handleEdit = (goal: SavingsGoalWithProgress) => {
    setEditingGoal(goal);
    setShowGoalModal(true);
  };

  const handleCloseGoalModal = () => {
    setShowGoalModal(false);
    setEditingGoal(null);
  };

  const handleSaveGoal = () => {
    void queryClient.invalidateQueries({ queryKey: ['savings', workspaceId] });
    handleCloseGoalModal();
  };

  const handleContribute = (goal: SavingsGoalWithProgress) => {
    setContributingGoal(goal);
  };

  const handleCloseContributionModal = () => {
    setContributingGoal(null);
  };

  const handleSaveContribution = () => {
    void queryClient.invalidateQueries({ queryKey: ['savings', workspaceId] });
    handleCloseContributionModal();
  };

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-ctp-subtext0">
        Selectionnez un espace de travail
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-ctp-surface1 rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-ctp-surface1 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Separate active and completed goals
  const activeGoals = goals.filter((g) => !g.isCompleted);
  const completedGoals = goals.filter((g) => g.isCompleted);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-7 h-7" />
            Objectifs d'epargne
          </h1>
          <p className="text-ctp-subtext0">
            Suivez vos objectifs et visualisez votre progression
          </p>
        </div>
        <button onClick={() => setShowGoalModal(true)} className="btn-primary">
          <Plus className="w-4 h-4 mr-1" />
          Nouvel objectif
        </button>
      </div>

      {/* Summary Cards */}
      {summary && summary.totalGoals > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Overall Progress */}
          <div className="card flex items-center gap-4">
            <SavingsProgress progress={summary.overallProgress} size="md" showLabel={true} />
            <div>
              <p className="text-sm text-ctp-subtext0">Progression</p>
              <p className="font-bold text-lg">globale</p>
            </div>
          </div>

          {/* Total Saved */}
          <div className="card text-center">
            <p className="text-2xl font-bold text-ctp-green">
              {formatCurrency(summary.totalCurrentAmount)}
            </p>
            <p className="text-sm text-ctp-subtext0">Epargne totale</p>
          </div>

          {/* Remaining */}
          <div className="card text-center">
            <p className="text-2xl font-bold text-ctp-blue">
              {formatCurrency(summary.totalRemainingAmount)}
            </p>
            <p className="text-sm text-ctp-subtext0">Reste a epargner</p>
          </div>

          {/* Goals Count */}
          <div className="card text-center">
            <div className="flex justify-center gap-4">
              <div>
                <p className="text-2xl font-bold text-ctp-text">{summary.activeGoals}</p>
                <p className="text-sm text-ctp-subtext0">Actifs</p>
              </div>
              <div className="border-l border-ctp-surface1 pl-4">
                <p className="text-2xl font-bold text-ctp-green">{summary.completedGoals}</p>
                <p className="text-sm text-ctp-subtext0">Atteints</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Goals Grid */}
      {goals.length > 0 ? (
        <div className="space-y-8">
          {/* Active Goals */}
          {activeGoals.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Objectifs en cours ({activeGoals.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeGoals.map((goal) => (
                  <SavingsGoalCard
                    key={goal.id}
                    goal={goal}
                    workspaceId={workspaceId}
                    onEdit={() => handleEdit(goal)}
                    onContribute={() => handleContribute(goal)}
                    onViewHistory={() => setHistoryGoal(goal)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Completed Goals Toggle */}
          {(completedGoals.length > 0 || summary?.completedGoals) && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="text-sm text-ctp-subtext0 hover:text-ctp-text flex items-center gap-1"
              >
                <CheckCircle className="w-4 h-4" />
                {showCompleted ? 'Masquer' : 'Afficher'} les objectifs atteints (
                {summary?.completedGoals ?? completedGoals.length})
              </button>
            </div>
          )}

          {/* Completed Goals */}
          {showCompleted && completedGoals.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-ctp-green">
                <CheckCircle className="w-5 h-5" />
                Objectifs atteints ({completedGoals.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75">
                {completedGoals.map((goal) => (
                  <SavingsGoalCard
                    key={goal.id}
                    goal={goal}
                    workspaceId={workspaceId}
                    onEdit={() => handleEdit(goal)}
                    onContribute={() => handleContribute(goal)}
                    onViewHistory={() => setHistoryGoal(goal)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="card text-center py-12">
          <Target className="w-16 h-16 mx-auto mb-4 text-ctp-overlay1" />
          <h2 className="text-xl font-bold mb-2">Aucun objectif d'epargne</h2>
          <p className="text-ctp-subtext0 mb-6 max-w-md mx-auto">
            Creez des objectifs pour suivre votre epargne et visualiser votre progression vers vos
            projets importants.
          </p>
          <button onClick={() => setShowGoalModal(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-1" />
            Creer votre premier objectif
          </button>
        </div>
      )}

      {/* Goal Modal */}
      {showGoalModal && (
        <SavingsGoalModal
          workspaceId={workspaceId}
          goal={editingGoal}
          onClose={handleCloseGoalModal}
          onSave={handleSaveGoal}
        />
      )}

      {/* Contribution Modal */}
      {contributingGoal && (
        <ContributionModal
          workspaceId={workspaceId}
          goal={contributingGoal}
          onClose={handleCloseContributionModal}
          onSave={handleSaveContribution}
        />
      )}

      {/* History Modal */}
      {historyGoal && (
        <HistoryModal
          workspaceId={workspaceId}
          goal={historyGoal}
          onClose={() => setHistoryGoal(null)}
        />
      )}
    </div>
  );
}

export default SavingsPage;
