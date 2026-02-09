// ============================================================================
// PRICE ALERT LIST - Finance Hub
// Display and manage active price alerts
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Trash2,
  TrendingUp,
  TrendingDown,
  Loader2,
  RefreshCw,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { cn, formatCurrency } from '@/lib/utils';
import { PriceAlertModal } from './PriceAlertModal';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface PriceAlert {
  id: string;
  workspaceId: string;
  positionId: string | null;
  symbol: string;
  direction: 'above' | 'below';
  targetPrice: number;
  isRecurring: boolean;
  isTriggered: boolean;
  triggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
  position?: {
    id: string;
    asset: {
      id: string;
      symbol: string;
      name: string;
      lastPrice: number | null;
      currency: string;
    };
  } | null;
}

interface PriceAlertListProps {
  positionId?: string;
  compact?: boolean;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function PriceAlertList({ positionId, compact = false }: PriceAlertListProps) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null);

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['price-alerts', currentWorkspace?.id, positionId],
    queryFn: async () => {
      const queryParams = positionId ? `?positionId=${positionId}` : '';
      const response = await api.get<{ data: PriceAlert[] }>(
        `/workspaces/${currentWorkspace?.id}/alerts/price${queryParams}`
      );
      return response.data;
    },
    enabled: !!currentWorkspace?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: (alertId: string) =>
      api.delete(`/workspaces/${currentWorkspace?.id}/alerts/${alertId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['price-alerts'] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: (alertId: string) =>
      api.post(`/workspaces/${currentWorkspace?.id}/alerts/${alertId}/reset`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['price-alerts'] });
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
      <div className={cn('text-center py-8 text-ctp-subtext0', compact && 'py-4')}>
        <Bell className={cn('mx-auto text-ctp-overlay1 mb-3', compact ? 'h-8 w-8' : 'h-12 w-12')} />
        <p>Aucune alerte de prix</p>
        {!compact && (
          <p className="text-sm mt-1">
            Definissez des alertes sur vos positions pour etre notifie
          </p>
        )}
      </div>
    );
  }

  // Group alerts by triggered status
  const activeAlerts = alerts.filter(a => !a.isTriggered);
  const triggeredAlerts = alerts.filter(a => a.isTriggered);

  return (
    <div className="space-y-4">
      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="space-y-2">
          {!compact && activeAlerts.length > 0 && triggeredAlerts.length > 0 && (
            <h4 className="text-sm font-medium text-ctp-subtext0 mb-2">Alertes actives</h4>
          )}
          {activeAlerts.map((alert) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              compact={compact}
              onEdit={() => setEditingAlert(alert)}
              onDelete={() => {
                if (window.confirm('Supprimer cette alerte?')) {
                  deleteMutation.mutate(alert.id);
                }
              }}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Triggered Alerts */}
      {triggeredAlerts.length > 0 && (
        <div className="space-y-2">
          {!compact && (
            <h4 className="text-sm font-medium text-ctp-subtext0 mb-2">Alertes declenchees</h4>
          )}
          {triggeredAlerts.map((alert) => (
            <TriggeredAlertItem
              key={alert.id}
              alert={alert}
              compact={compact}
              onReset={() => resetMutation.mutate(alert.id)}
              onDelete={() => {
                if (window.confirm('Supprimer cette alerte?')) {
                  deleteMutation.mutate(alert.id);
                }
              }}
              isResetting={resetMutation.isPending}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingAlert && (
        <PriceAlertModal
          isOpen={true}
          onClose={() => setEditingAlert(null)}
          asset={{
            id: editingAlert.position?.asset.id || '',
            symbol: editingAlert.symbol,
            name: editingAlert.position?.asset.name || editingAlert.symbol,
            lastPrice: editingAlert.position?.asset.lastPrice || undefined,
            currency: editingAlert.position?.asset.currency || 'EUR',
          }}
          positionId={editingAlert.positionId || undefined}
          existingAlert={editingAlert}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Alert Item Components
// ----------------------------------------------------------------------------

interface AlertItemProps {
  alert: PriceAlert;
  compact: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function AlertItem({ alert, compact, onEdit, onDelete, isDeleting }: AlertItemProps) {
  const currency = alert.position?.asset.currency || 'EUR';
  const currentPrice = alert.position?.asset.lastPrice;

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border bg-ctp-mantle border-ctp-surface1',
        compact ? 'p-2' : 'p-3'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'rounded-lg',
            compact ? 'p-1.5' : 'p-2',
            alert.direction === 'above' ? 'bg-ctp-green/10' : 'bg-ctp-red/10'
          )}
        >
          {alert.direction === 'above' ? (
            <TrendingUp className={cn('text-ctp-green', compact ? 'h-3 w-3' : 'h-4 w-4')} />
          ) : (
            <TrendingDown className={cn('text-ctp-red', compact ? 'h-3 w-3' : 'h-4 w-4')} />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className={cn('font-medium text-ctp-text', compact && 'text-sm')}>
              {alert.symbol}
            </p>
            {alert.isRecurring && (
              <span title="Alerte recurrente">
                <RefreshCw className="h-3 w-3 text-ctp-blue" />
              </span>
            )}
          </div>
          <p className={cn('text-ctp-subtext0', compact ? 'text-xs' : 'text-sm')}>
            {alert.direction === 'above' ? 'Au-dessus de ' : 'En-dessous de '}
            {formatCurrency(alert.targetPrice, currency)}
          </p>
          {currentPrice && !compact && (
            <p className="text-xs text-ctp-overlay1">
              Prix actuel: {formatCurrency(currentPrice, currency)}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          className={cn(
            'text-ctp-overlay1 hover:text-ctp-blue hover:bg-ctp-blue/10 rounded-lg transition-colors',
            compact ? 'p-1.5' : 'p-2'
          )}
          title="Modifier"
        >
          <Edit2 className={cn(compact ? 'h-3 w-3' : 'h-4 w-4')} />
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className={cn(
            'text-ctp-overlay1 hover:text-ctp-red hover:bg-ctp-red/10 rounded-lg transition-colors',
            compact ? 'p-1.5' : 'p-2'
          )}
          title="Supprimer"
        >
          <Trash2 className={cn(compact ? 'h-3 w-3' : 'h-4 w-4')} />
        </button>
      </div>
    </div>
  );
}

interface TriggeredAlertItemProps {
  alert: PriceAlert;
  compact: boolean;
  onReset: () => void;
  onDelete: () => void;
  isResetting: boolean;
  isDeleting: boolean;
}

function TriggeredAlertItem({
  alert,
  compact,
  onReset,
  onDelete,
  isResetting,
  isDeleting,
}: TriggeredAlertItemProps) {
  const currency = alert.position?.asset.currency || 'EUR';

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border bg-ctp-surface0 border-ctp-surface1/50 opacity-75',
        compact ? 'p-2' : 'p-3'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'rounded-lg bg-ctp-yellow/10',
            compact ? 'p-1.5' : 'p-2'
          )}
        >
          <Check className={cn('text-ctp-yellow', compact ? 'h-3 w-3' : 'h-4 w-4')} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className={cn('font-medium text-ctp-text', compact && 'text-sm')}>
              {alert.symbol}
            </p>
            <span className="text-xs px-1.5 py-0.5 bg-ctp-yellow/10 text-ctp-yellow rounded">
              Declenchee
            </span>
          </div>
          <p className={cn('text-ctp-subtext0', compact ? 'text-xs' : 'text-sm')}>
            {alert.direction === 'above' ? 'Au-dessus de ' : 'En-dessous de '}
            {formatCurrency(alert.targetPrice, currency)}
          </p>
          {alert.triggeredAt && !compact && (
            <p className="text-xs text-ctp-overlay1">
              Le {new Date(alert.triggeredAt).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {alert.isRecurring && (
          <button
            onClick={onReset}
            disabled={isResetting}
            className={cn(
              'text-ctp-overlay1 hover:text-ctp-blue hover:bg-ctp-blue/10 rounded-lg transition-colors',
              compact ? 'p-1.5' : 'p-2'
            )}
            title="Reactiver"
          >
            <RefreshCw className={cn(compact ? 'h-3 w-3' : 'h-4 w-4', isResetting && 'animate-spin')} />
          </button>
        )}
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className={cn(
            'text-ctp-overlay1 hover:text-ctp-red hover:bg-ctp-red/10 rounded-lg transition-colors',
            compact ? 'p-1.5' : 'p-2'
          )}
          title="Supprimer"
        >
          {isDeleting ? (
            <X className={cn(compact ? 'h-3 w-3' : 'h-4 w-4')} />
          ) : (
            <Trash2 className={cn(compact ? 'h-3 w-3' : 'h-4 w-4')} />
          )}
        </button>
      </div>
    </div>
  );
}

export default PriceAlertList;
