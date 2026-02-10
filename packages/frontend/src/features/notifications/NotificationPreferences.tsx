// ============================================================================
// NOTIFICATION PREFERENCES - Finance Hub
// User preferences for different notification types
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Mail,
  Smartphone,
  Loader2,
  Sparkles,
  TrendingUp,
  Calendar,
  PiggyBank,
  AlertTriangle,
  Wallet,
  RefreshCcw,
  Target,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { clsx } from 'clsx';

interface NotificationPreference {
  type: string;
  inApp: boolean;
  email: boolean;
  push: boolean;
}

interface NotificationPreferencesResponse {
  preferences: NotificationPreference[];
}

const notificationTypeConfig: Record<
  string,
  { icon: typeof Bell; label: string; description: string; category: string }
> = {
  // Savings
  savings_milestone: {
    icon: PiggyBank,
    label: 'Jalons epargne',
    description: 'Quand vous atteignez 25%, 50%, 75% ou 100% de votre objectif',
    category: 'savings',
  },
  savings_off_track: {
    icon: Target,
    label: 'Epargne en retard',
    description: "Quand vous etes en retard sur votre objectif d'epargne",
    category: 'savings',
  },
  goal_achieved: {
    icon: Sparkles,
    label: 'Objectif atteint',
    description: 'Quand vous atteignez un objectif',
    category: 'savings',
  },

  // Spending
  unusual_spending: {
    icon: AlertTriangle,
    label: 'Depense inhabituelle',
    description: 'Quand une depense est anormalement elevee',
    category: 'spending',
  },
  budget_threshold: {
    icon: Wallet,
    label: 'Alerte budget',
    description: 'Quand un budget atteint le seuil defini',
    category: 'spending',
  },
  budget_exceeded: {
    icon: AlertTriangle,
    label: 'Budget depasse',
    description: 'Quand un budget est depasse',
    category: 'spending',
  },
  low_balance_warning: {
    icon: Wallet,
    label: 'Solde bas',
    description: 'Quand un compte a un solde bas',
    category: 'spending',
  },

  // Summaries
  weekly_summary: {
    icon: Calendar,
    label: 'Resume hebdomadaire',
    description: 'Resume de vos finances chaque semaine',
    category: 'summaries',
  },
  monthly_report: {
    icon: TrendingUp,
    label: 'Rapport mensuel',
    description: 'Rapport detaille chaque mois',
    category: 'summaries',
  },

  // Recurring
  recurring_processed: {
    icon: RefreshCcw,
    label: 'Transaction recurrente',
    description: 'Quand une transaction recurrente est traitee',
    category: 'recurring',
  },
  recurring_upcoming: {
    icon: Calendar,
    label: 'Echeance a venir',
    description: 'Rappel avant une echeance recurrente',
    category: 'recurring',
  },
};

const categoryLabels: Record<string, string> = {
  savings: 'Epargne',
  spending: 'Depenses & Budgets',
  summaries: 'Resumes & Rapports',
  recurring: 'Transactions recurrentes',
};

const categoryOrder = ['spending', 'savings', 'recurring', 'summaries'];

export function NotificationPreferences() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [updatingType, setUpdatingType] = useState<string | null>(null);

  const { data: preferencesData, isLoading } = useQuery({
    queryKey: ['notifications', workspaceId, 'preferences'],
    queryFn: () =>
      api.get<NotificationPreferencesResponse>(
        `/workspaces/${workspaceId}/notifications/preferences`
      ),
    enabled: !!workspaceId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      type: string;
      channel: 'inApp' | 'email' | 'push';
      enabled: boolean;
    }) =>
      api.patch(`/workspaces/${workspaceId}/notifications/preferences`, data),
    onMutate: async (variables) => {
      setUpdatingType(variables.type);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['notifications', workspaceId, 'preferences'],
      });
    },
    onSettled: () => {
      setUpdatingType(null);
    },
  });

  const preferences = preferencesData?.preferences ?? [];

  // Group preferences by category
  const preferencesByCategory = categoryOrder.reduce((acc, category) => {
    const categoryPrefs = Object.entries(notificationTypeConfig)
      .filter(([_, config]) => config.category === category)
      .map(([type, config]) => {
        const pref = preferences.find((p) => p.type === type);
        return {
          type,
          ...config,
          inApp: pref?.inApp ?? true,
          email: pref?.email ?? false,
          push: pref?.push ?? false,
        };
      });
    if (categoryPrefs.length > 0) {
      acc[category] = categoryPrefs;
    }
    return acc;
  }, {} as Record<string, Array<typeof notificationTypeConfig[string] & { type: string; inApp: boolean; email: boolean; push: boolean }>>);

  const handleToggle = (
    type: string,
    channel: 'inApp' | 'email' | 'push',
    currentValue: boolean
  ) => {
    updateMutation.mutate({ type, channel, enabled: !currentValue });
  };

  if (!workspaceId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-ctp-blue mb-4" />
        <p className="text-ctp-subtext0">Chargement des preferences...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-ctp-text flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Preferences de notifications
        </h2>
        <p className="text-sm text-ctp-subtext0">
          Choisissez comment et quand etre notifie
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-ctp-subtext0">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4" />
          <span>Dans l'app</span>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4" />
          <span>Email</span>
        </div>
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4" />
          <span>Push</span>
        </div>
      </div>

      {/* Preferences by category */}
      {categoryOrder.map((category) => {
        const categoryPrefs = preferencesByCategory[category];
        if (!categoryPrefs?.length) return null;

        return (
          <div key={category} className="card">
            <h3 className="font-medium text-ctp-text mb-4">
              {categoryLabels[category]}
            </h3>
            <div className="space-y-3">
              {categoryPrefs.map((pref) => {
                const Icon = pref.icon;
                const isUpdating = updatingType === pref.type;

                return (
                  <div
                    key={pref.type}
                    className="flex items-center gap-4 p-3 bg-ctp-surface0 rounded-lg"
                  >
                    {/* Icon & Info */}
                    <div className="p-2 bg-ctp-surface1 rounded-lg">
                      <Icon className="w-5 h-5 text-ctp-subtext0" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ctp-text">{pref.label}</p>
                      <p className="text-xs text-ctp-subtext0 line-clamp-1">
                        {pref.description}
                      </p>
                    </div>

                    {/* Toggles */}
                    <div className="flex items-center gap-2">
                      {/* In-App */}
                      <button
                        onClick={() => handleToggle(pref.type, 'inApp', pref.inApp)}
                        disabled={isUpdating}
                        className={clsx(
                          'p-2 rounded-lg transition-colors',
                          pref.inApp
                            ? 'bg-ctp-blue/20 text-ctp-blue'
                            : 'bg-ctp-surface1 text-ctp-overlay0 hover:text-ctp-subtext0'
                        )}
                        title="Dans l'application"
                      >
                        <Bell className="w-4 h-4" />
                      </button>

                      {/* Email */}
                      <button
                        onClick={() => handleToggle(pref.type, 'email', pref.email)}
                        disabled={isUpdating}
                        className={clsx(
                          'p-2 rounded-lg transition-colors',
                          pref.email
                            ? 'bg-ctp-green/20 text-ctp-green'
                            : 'bg-ctp-surface1 text-ctp-overlay0 hover:text-ctp-subtext0'
                        )}
                        title="Email"
                      >
                        <Mail className="w-4 h-4" />
                      </button>

                      {/* Push */}
                      <button
                        onClick={() => handleToggle(pref.type, 'push', pref.push)}
                        disabled={isUpdating}
                        className={clsx(
                          'p-2 rounded-lg transition-colors',
                          pref.push
                            ? 'bg-ctp-mauve/20 text-ctp-mauve'
                            : 'bg-ctp-surface1 text-ctp-overlay0 hover:text-ctp-subtext0'
                        )}
                        title="Notification push"
                      >
                        <Smartphone className="w-4 h-4" />
                      </button>
                    </div>

                    {isUpdating && (
                      <Loader2 className="w-4 h-4 animate-spin text-ctp-blue" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default NotificationPreferences;
