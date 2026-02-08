// ============================================================================
// ALERT SETTINGS COMPONENT - Finance Hub
// Manage alert rules
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Clock,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { cn, formatCurrency } from '@/lib/utils';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface AlertRule {
  id: string;
  type: string;
  name: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
  lastTriggeredAt?: string;
  createdAt: string;
}

interface CreateAlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// ----------------------------------------------------------------------------
// Alert Type Config
// ----------------------------------------------------------------------------

const alertTypeConfig: Record<string, { icon: typeof Bell; label: string; description: string }> = {
  budget_threshold: {
    icon: AlertTriangle,
    label: 'Alerte budget',
    description: 'Notification quand un budget atteint un seuil',
  },
  price_above: {
    icon: TrendingUp,
    label: 'Prix au-dessus de',
    description: "Notification quand le prix d'un actif dépasse un seuil",
  },
  price_below: {
    icon: TrendingUp,
    label: 'Prix en-dessous de',
    description: "Notification quand le prix d'un actif descend sous un seuil",
  },
  low_balance: {
    icon: Wallet,
    label: 'Solde bas',
    description: "Notification quand le solde d'un compte est bas",
  },
  recurring_reminder: {
    icon: Clock,
    label: 'Rappel récurrent',
    description: "Rappel avant l'échéance d'une transaction récurrente",
  },
};

// ----------------------------------------------------------------------------
// Create Alert Dialog
// ----------------------------------------------------------------------------

function CreateAlertDialog({ isOpen, onClose, onSuccess }: CreateAlertDialogProps) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [alertType, setAlertType] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for different alert types
  const [budgetId, setBudgetId] = useState('');
  const [thresholdPercent, setThresholdPercent] = useState('80');
  const [accountId, setAccountId] = useState('');
  const [balanceThreshold, setBalanceThreshold] = useState('');
  const [assetId, setAssetId] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [priceDirection, setPriceDirection] = useState<'above' | 'below'>('above');

  // Fetch budgets for budget alert
  const { data: budgets } = useQuery({
    queryKey: ['budgets', currentWorkspace?.id],
    queryFn: async () => {
      const response = await api.get<{ data: { id: string; name: string; category: { name: string } }[] }>(
        `/workspaces/${currentWorkspace?.id}/budgets`
      );
      return response.data;
    },
    enabled: !!currentWorkspace?.id && alertType === 'budget_threshold',
  });

  // Fetch accounts for low balance alert
  const { data: accounts } = useQuery({
    queryKey: ['accounts', currentWorkspace?.id],
    queryFn: async () => {
      const response = await api.get<{ data: { id: string; name: string }[] }>(
        `/workspaces/${currentWorkspace?.id}/accounts`
      );
      return response.data;
    },
    enabled: !!currentWorkspace?.id && alertType === 'low_balance',
  });

  const handleSubmit = async () => {
    if (!currentWorkspace) return;

    setIsSubmitting(true);

    try {
      let endpoint = '/notifications/alerts';
      let body: Record<string, unknown> = {};

      if (alertType === 'budget_threshold') {
        endpoint = '/notifications/alerts/budget';
        body = {
          workspaceId: currentWorkspace.id,
          budgetId,
          thresholdPercent: parseInt(thresholdPercent),
        };
      } else if (alertType === 'low_balance') {
        endpoint = '/notifications/alerts/balance';
        body = {
          workspaceId: currentWorkspace.id,
          accountId,
          threshold: parseFloat(balanceThreshold),
        };
      } else if (alertType === 'price_above' || alertType === 'price_below') {
        endpoint = '/notifications/alerts/price';
        body = {
          workspaceId: currentWorkspace.id,
          assetId,
          targetPrice: parseFloat(targetPrice),
          direction: priceDirection,
        };
      }

      await api.post(endpoint, body);
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error creating alert:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Nouvelle alerte</h2>
        </div>

        <div className="p-6 space-y-4">
          {/* Alert type selection */}
          {!alertType ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Type d'alerte</label>
              {Object.entries(alertTypeConfig).map(([type, config]) => (
                <button
                  key={type}
                  onClick={() => setAlertType(type)}
                  className="w-full p-3 text-left border rounded-lg hover:border-blue-500 hover:bg-blue-50 flex items-center gap-3"
                >
                  <config.icon className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="font-medium text-gray-900">{config.label}</p>
                    <p className="text-xs text-gray-500">{config.description}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <>
              {/* Budget alert form */}
              {alertType === 'budget_threshold' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
                    <select
                      value={budgetId}
                      onChange={(e) => setBudgetId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Sélectionner un budget...</option>
                      {budgets?.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name || b.category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Seuil d'alerte (%)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={thresholdPercent}
                      onChange={(e) => setThresholdPercent(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Vous serez notifié quand le budget atteint ce pourcentage
                    </p>
                  </div>
                </>
              )}

              {/* Low balance alert form */}
              {alertType === 'low_balance' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Compte</label>
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Sélectionner un compte...</option>
                      {accounts?.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Seuil minimum (€)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={balanceThreshold}
                      onChange={(e) => setBalanceThreshold(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="500"
                    />
                  </div>
                </>
              )}

              {/* Price alert form */}
              {(alertType === 'price_above' || alertType === 'price_below') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Direction
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPriceDirection('above')}
                        className={cn(
                          'flex-1 px-3 py-2 border rounded-lg',
                          priceDirection === 'above' && 'border-blue-500 bg-blue-50'
                        )}
                      >
                        Au-dessus de
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriceDirection('below')}
                        className={cn(
                          'flex-1 px-3 py-2 border rounded-lg',
                          priceDirection === 'below' && 'border-blue-500 bg-blue-50'
                        )}
                      >
                        En-dessous de
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prix cible (€)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="100.00"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Note: Vous pouvez créer cette alerte depuis la page de votre portefeuille
                  </p>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={() => {
              setAlertType('');
              onClose();
            }}
            className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            Annuler
          </button>
          {alertType && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer l'alerte
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------------

export function AlertSettings() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Fetch alert rules
  const { data: alertRules, isLoading } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: async () => {
      const response = await api.get<{ data: AlertRule[] }>('/notifications/alerts');
      return response.data;
    },
  });

  // Toggle alert mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ ruleId, isEnabled }: { ruleId: string; isEnabled: boolean }) => {
      return api.patch(`/notifications/alerts/${ruleId}`, { isEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    },
  });

  // Delete alert mutation
  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return api.delete(`/notifications/alerts/${ruleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    },
  });

  const getAlertIcon = (type: string) => {
    const config = alertTypeConfig[type];
    if (config) {
      const Icon = config.icon;
      return <Icon className="h-5 w-5 text-gray-500" />;
    }
    return <Bell className="h-5 w-5 text-gray-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Règles d'alerte</h2>
          <p className="text-sm text-gray-500">Configurez des alertes automatiques</p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nouvelle alerte
        </button>
      </div>

      {/* Alert list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : alertRules && alertRules.length > 0 ? (
        <div className="space-y-2">
          {alertRules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                'flex items-center gap-4 p-4 bg-white border rounded-lg',
                !rule.isEnabled && 'opacity-60'
              )}
            >
              {/* Icon */}
              <div className="p-2 bg-gray-100 rounded-lg">{getAlertIcon(rule.type)}</div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{rule.name}</p>
                <p className="text-xs text-gray-500">
                  {alertTypeConfig[rule.type]?.label || rule.type}
                </p>
              </div>

              {/* Toggle */}
              <button
                onClick={() => toggleMutation.mutate({ ruleId: rule.id, isEnabled: !rule.isEnabled })}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  rule.isEnabled
                    ? 'text-blue-600 hover:bg-blue-50'
                    : 'text-gray-400 hover:bg-gray-100'
                )}
              >
                {rule.isEnabled ? (
                  <ToggleRight className="h-6 w-6" />
                ) : (
                  <ToggleLeft className="h-6 w-6" />
                )}
              </button>

              {/* Delete */}
              <button
                onClick={() => {
                  if (confirm('Supprimer cette alerte ?')) {
                    deleteMutation.mutate(rule.id);
                  }
                }}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white border rounded-lg">
          <Bell className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune alerte configurée</h3>
          <p className="text-gray-500 mb-4">
            Créez des alertes pour être notifié des événements importants.
          </p>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Créer une alerte
          </button>
        </div>
      )}

      {/* Create dialog */}
      <CreateAlertDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
    </div>
  );
}

export default AlertSettings;
