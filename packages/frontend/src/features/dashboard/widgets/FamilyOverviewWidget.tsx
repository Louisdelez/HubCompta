// ============================================================================
// FAMILY OVERVIEW WIDGET - Finance Hub Dashboard
// Shows family workspace summary with members and pending approvals
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Clock,
  Wallet,
  TrendingDown,
  Loader2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import type { WidgetProps } from './index';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface FamilyMember {
  id: string;
  displayName: string;
  role: string;
  spendingLimit: number | null;
  currentMonthSpent: number;
  approvalRequired: boolean;
}

interface FamilyOverviewData {
  members: FamilyMember[];
  pendingApprovalsCount: number;
  totalSpentThisMonth: number;
  totalBudget: number;
  currency: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function FamilyOverviewWidget({ workspaceId }: WidgetProps) {
  // Fetch family overview data
  const { data, isLoading, error } = useQuery({
    queryKey: ['family-overview', workspaceId],
    queryFn: () => api.get<FamilyOverviewData>(`/workspaces/${workspaceId}/family/overview`),
    enabled: !!workspaceId,
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-ctp-blue" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-ctp-subtext0">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p className="text-sm">Impossible de charger les donnees</p>
      </div>
    );
  }

  const { members, pendingApprovalsCount, totalSpentThisMonth, totalBudget, currency } = data;

  // Calculate progress
  const budgetProgress = totalBudget > 0 ? (totalSpentThisMonth / totalBudget) * 100 : 0;
  const isOverBudget = budgetProgress > 100;
  const isNearBudget = budgetProgress >= 80 && !isOverBudget;

  return (
    <div className="h-full flex flex-col">
      {/* Header Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Total Spent */}
        <div className="bg-ctp-surface0 rounded-lg p-3">
          <div className="flex items-center gap-2 text-ctp-subtext0 text-xs mb-1">
            <TrendingDown className="w-3 h-3" />
            Depenses du mois
          </div>
          <p
            className={clsx(
              'text-lg font-bold',
              isOverBudget ? 'text-ctp-red' : isNearBudget ? 'text-ctp-yellow' : 'text-ctp-text'
            )}
          >
            {formatCurrency(totalSpentThisMonth, currency)}
          </p>
          {totalBudget > 0 && (
            <div className="mt-1">
              <div className="h-1.5 bg-ctp-surface1 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full transition-all',
                    isOverBudget
                      ? 'bg-ctp-red'
                      : isNearBudget
                      ? 'bg-ctp-yellow'
                      : 'bg-ctp-green'
                  )}
                  style={{ width: `${Math.min(budgetProgress, 100)}%` }}
                />
              </div>
              <p className="text-xs text-ctp-subtext0 mt-0.5">
                sur {formatCurrency(totalBudget, currency)}
              </p>
            </div>
          )}
        </div>

        {/* Pending Approvals */}
        <div className="bg-ctp-surface0 rounded-lg p-3">
          <div className="flex items-center gap-2 text-ctp-subtext0 text-xs mb-1">
            <Clock className="w-3 h-3" />
            En attente
          </div>
          <p
            className={clsx(
              'text-lg font-bold',
              pendingApprovalsCount > 0 ? 'text-ctp-yellow' : 'text-ctp-green'
            )}
          >
            {pendingApprovalsCount}
          </p>
          <p className="text-xs text-ctp-subtext0 mt-1">
            {pendingApprovalsCount === 0
              ? 'Tout est approuve'
              : pendingApprovalsCount === 1
              ? 'transaction a valider'
              : 'transactions a valider'}
          </p>
        </div>
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm text-ctp-subtext0">
            <Users className="w-4 h-4" />
            <span>Membres ({members.length})</span>
          </div>
          <a
            href={`/workspaces/members`}
            className="text-xs text-ctp-blue hover:underline flex items-center gap-0.5"
          >
            Gerer
            <ChevronRight className="w-3 h-3" />
          </a>
        </div>

        <div className="space-y-2 overflow-y-auto max-h-[calc(100%-2rem)]">
          {members.slice(0, 5).map((member) => {
            const hasLimit = member.spendingLimit !== null;
            const spentPercent = hasLimit
              ? (member.currentMonthSpent / member.spendingLimit!) * 100
              : 0;
            const isOverLimit = hasLimit && spentPercent > 100;
            const isNearLimit = hasLimit && spentPercent >= 80 && !isOverLimit;

            return (
              <div
                key={member.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-ctp-surface0/50 hover:bg-ctp-surface0 transition-colors"
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-ctp-blue/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-ctp-blue">
                    {member.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate text-ctp-text">
                      {member.displayName}
                    </p>
                    {member.approvalRequired && (
                      <span title="Approbation requise">
                        <Clock className="w-3 h-3 text-ctp-mauve flex-shrink-0" />
                      </span>
                    )}
                  </div>

                  {/* Spending progress */}
                  {hasLimit ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1 bg-ctp-surface1 rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            'h-full',
                            isOverLimit
                              ? 'bg-ctp-red'
                              : isNearLimit
                              ? 'bg-ctp-yellow'
                              : 'bg-ctp-green'
                          )}
                          style={{ width: `${Math.min(spentPercent, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-ctp-subtext0 flex-shrink-0">
                        {formatCurrency(member.currentMonthSpent, currency)} /{' '}
                        {formatCurrency(member.spendingLimit!, currency)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-ctp-subtext0 flex items-center gap-1">
                      <Wallet className="w-3 h-3" />
                      Pas de limite
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {members.length > 5 && (
            <p className="text-xs text-ctp-subtext0 text-center py-1">
              +{members.length - 5} autres membres
            </p>
          )}
        </div>
      </div>

      {/* Quick Action */}
      {pendingApprovalsCount > 0 && (
        <a
          href={`/workspaces/approvals`}
          className="mt-3 flex items-center justify-center gap-2 py-2 bg-ctp-yellow/10 text-ctp-yellow rounded-lg hover:bg-ctp-yellow/20 transition-colors text-sm"
        >
          <Clock className="w-4 h-4" />
          Voir les demandes d'approbation
        </a>
      )}
    </div>
  );
}

export default FamilyOverviewWidget;
