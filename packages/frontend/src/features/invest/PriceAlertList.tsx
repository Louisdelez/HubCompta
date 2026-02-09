// ============================================================================
// PRICE ALERT LIST - Finance Hub
// Display and manage active price alerts
// Uses Catppuccin colors that adapt to the current theme
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
        <Loader2 className="h-6 w-6 animate-spin text-ctp-blue" />
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="text-center py-8 text-ctp-subtext0">
        <Bell className="h-12 w-12 mx-auto text-ctp-overlay1 mb-3" />
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
              ? 'bg-ctp-mantle border-ctp-surface1'
              : 'bg-ctp-surface0 border-ctp-surface1/50 opacity-60'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              alert.type === 'price_above'
                ? 'bg-ctp-green/10'
                : 'bg-ctp-red/10'
            }`}>
              {alert.type === 'price_above' ? (
                <TrendingUp className="h-4 w-4 text-ctp-green" />
              ) : (
                <TrendingDown className="h-4 w-4 text-ctp-red" />
              )}
            </div>
            <div>
              <p className="font-medium text-ctp-text">{alert.config.assetSymbol}</p>
              <p className="text-sm text-ctp-subtext0">
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
                  ? 'text-ctp-blue hover:bg-ctp-blue/10'
                  : 'text-ctp-overlay1 hover:bg-ctp-surface1'
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
              className="p-2 text-ctp-overlay1 hover:text-ctp-red hover:bg-ctp-red/10 rounded-lg transition-colors"
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
