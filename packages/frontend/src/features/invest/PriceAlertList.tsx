// ============================================================================
// PRICE ALERT LIST - Finance Hub
// Display and manage active price alerts
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellOff,
  Trash2,
  TrendingUp,
  TrendingDown,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { formatCurrency } from '@/lib/utils';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface PriceAlertConfig {
  assetId: string;
  assetSymbol: string;
  targetPrice: number;
  direction: 'above' | 'below';
}

interface PriceAlert {
  id: string;
  name: string;
  type: 'price_above' | 'price_below';
  config: PriceAlertConfig;
  isEnabled: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function PriceAlertList() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['price-alerts', currentWorkspace?.id],
    queryFn: () =>
      api.get<{ data: PriceAlert[] }>(`/workspaces/${currentWorkspace?.id}/alerts/price`)
        .then((res) => res.data),
    enabled: !!currentWorkspace?.id,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ alertId, isEnabled }: { alertId: string; isEnabled: boolean }) =>
      api.patch(`/workspaces/${currentWorkspace?.id}/alerts/${alertId}`, { isEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-alerts'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (alertId: string) =>
      api.delete(`/workspaces/${currentWorkspace?.id}/alerts/${alertId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-alerts'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Bell className="h-12 w-12 mx-auto text-gray-300 mb-3" />
        <p>Aucune alerte de prix</p>
        <p className="text-sm mt-1">
          Definissez des alertes sur vos positions pour etre notifie
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center justify-between p-3 rounded-lg border ${
            alert.isEnabled
              ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700/50 opacity-60'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              alert.type === 'price_above'
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-red-100 dark:bg-red-900/30'
            }`}>
              {alert.type === 'price_above' ? (
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div>
              <p className="font-medium">{alert.config.assetSymbol}</p>
              <p className="text-sm text-gray-500">
                {alert.type === 'price_above' ? 'Au-dessus de ' : 'En-dessous de '}
                {formatCurrency(alert.config.targetPrice, 'USD')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleMutation.mutate({ alertId: alert.id, isEnabled: !alert.isEnabled })}
              disabled={toggleMutation.isPending}
              className={`p-2 rounded-lg transition-colors ${
                alert.isEnabled
                  ? 'text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                  : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={alert.isEnabled ? 'Desactiver' : 'Activer'}
            >
              {alert.isEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </button>
            <button
              onClick={() => {
                if (window.confirm('Supprimer cette alerte?')) {
                  deleteMutation.mutate(alert.id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default PriceAlertList;
