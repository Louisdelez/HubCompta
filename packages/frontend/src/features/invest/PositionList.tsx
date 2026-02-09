// ============================================================================
// POSITION LIST COMPONENT - Finance Hub
// Display list of investment positions with P&L
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Bitcoin,
  Building2,
  MoreVertical,
  Plus,
  Minus,
  Trash2,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { cn, formatCurrency, formatNumber, formatPercent } from '@/lib/utils';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: string;
  currency: string;
  lastPrice?: number;
  lastPriceAt?: string;
}

interface Position {
  id: string;
  asset: Asset;
  accountId: string;
  quantity: number;
  averageCost: number;
  currentValue: number;
  totalCost: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
  realizedGain: number;
  createdAt: string;
}

interface PositionListProps {
  accountId?: string;
  onPositionClick?: (position: Position) => void;
  onAddTransaction?: (position: Position) => void;
}

// Refresh interval in milliseconds (30 seconds)
const REFRESH_INTERVAL = 30000;

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function PositionList({
  accountId,
  onPositionClick,
  onAddTransaction,
}: PositionListProps) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Fetch positions with auto-refresh every 30 seconds
  const { data: positions, isLoading } = useQuery({
    queryKey: ['positions', currentWorkspace?.id, accountId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (accountId) params.append('accountId', accountId);
      const response = await api.get<Position[]>(
        `/workspaces/${currentWorkspace?.id}/positions?${params}`
      );
      return response;
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
  });

  // Delete position mutation
  const deleteMutation = useMutation({
    mutationFn: async (positionId: string) => {
      return api.delete(`/workspaces/${currentWorkspace?.id}/positions/${positionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });

  const handleDelete = (position: Position) => {
    if (confirm(`Supprimer la position ${position.asset.symbol} ?`)) {
      deleteMutation.mutate(position.id);
    }
    setOpenMenuId(null);
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'crypto':
        return <Bitcoin className="h-5 w-5 text-ctp-peach" />;
      case 'etf':
        return <Building2 className="h-5 w-5 text-ctp-sapphire" />;
      default:
        return <TrendingUp className="h-5 w-5 text-ctp-blue" />;
    }
  };

  const getPnLColor = (value: number) => {
    if (value > 0) return 'text-ctp-green';
    if (value < 0) return 'text-ctp-red';
    return 'text-ctp-subtext0';
  };

  const getPnLBgColor = (value: number) => {
    if (value > 0) return 'bg-ctp-green/10';
    if (value < 0) return 'bg-ctp-red/10';
    return 'bg-ctp-surface0';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-ctp-blue" />
      </div>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="h-12 w-12 mx-auto text-ctp-overlay1 mb-4" />
        <h3 className="text-lg font-medium text-ctp-text mb-2">Aucune position</h3>
        <p className="text-ctp-subtext0">
          Ajoutez votre première position d'investissement pour commencer le suivi.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {positions.map((position) => (
        <div
          key={position.id}
          className="bg-ctp-mantle border border-ctp-surface1 rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="p-4">
            <div className="flex items-center gap-4">
              {/* Asset icon and info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-2 bg-ctp-surface0 rounded-lg">{getAssetIcon(position.asset.type)}</div>
                <div className="min-w-0">
                  <button
                    onClick={() => onPositionClick?.(position)}
                    className="font-medium text-ctp-text hover:text-ctp-blue flex items-center gap-1"
                  >
                    {position.asset.symbol}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <p className="text-sm text-ctp-subtext0 truncate">{position.asset.name}</p>
                </div>
              </div>

              {/* Quantity and PRU */}
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-ctp-text">
                  {formatNumber(position.quantity)} unités
                </p>
                <p className="text-xs text-ctp-subtext0">
                  PRU: {formatCurrency(position.averageCost, position.asset.currency)}
                </p>
              </div>

              {/* Current value */}
              <div className="text-right hidden md:block">
                <p className="text-sm text-ctp-subtext0">Valeur actuelle</p>
                <p className="font-medium text-ctp-text">
                  {formatCurrency(position.currentValue, 'EUR')}
                </p>
              </div>

              {/* P&L */}
              <div className={cn('text-right px-3 py-2 rounded-lg', getPnLBgColor(position.unrealizedGain))}>
                <div className="flex items-center gap-1 justify-end">
                  {position.unrealizedGain >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-ctp-green" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-ctp-red" />
                  )}
                  <span className={cn('font-medium', getPnLColor(position.unrealizedGain))}>
                    {position.unrealizedGain >= 0 ? '+' : ''}
                    {formatCurrency(position.unrealizedGain, 'EUR')}
                  </span>
                </div>
                <p className={cn('text-xs', getPnLColor(position.unrealizedGainPercent))}>
                  {position.unrealizedGainPercent >= 0 ? '+' : ''}
                  {formatPercent(position.unrealizedGainPercent)}
                </p>
              </div>

              {/* Actions menu */}
              <div className="relative">
                <button
                  onClick={() => setOpenMenuId(openMenuId === position.id ? null : position.id)}
                  className="p-2 text-ctp-overlay1 hover:text-ctp-subtext0 bg-ctp-surface0 hover:bg-ctp-surface1 rounded-lg"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>

                {openMenuId === position.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setOpenMenuId(null)}
                    />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-ctp-mantle border border-ctp-surface1 rounded-lg shadow-lg z-20 py-1">
                      <button
                        onClick={() => {
                          onAddTransaction?.(position);
                          setOpenMenuId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-ctp-text hover:bg-ctp-surface0 flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Acheter
                      </button>
                      <button
                        onClick={() => {
                          onAddTransaction?.(position);
                          setOpenMenuId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-ctp-text hover:bg-ctp-surface0 flex items-center gap-2"
                      >
                        <Minus className="h-4 w-4" />
                        Vendre
                      </button>
                      <hr className="my-1 border-ctp-surface1" />
                      <button
                        onClick={() => handleDelete(position)}
                        className="w-full px-4 py-2 text-left text-sm text-ctp-red hover:bg-ctp-red/10 flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Supprimer
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Mobile details */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-ctp-surface1 sm:hidden">
              <div>
                <p className="text-xs text-ctp-subtext0">Quantité</p>
                <p className="text-sm font-medium text-ctp-text">{formatNumber(position.quantity)}</p>
              </div>
              <div>
                <p className="text-xs text-ctp-subtext0">PRU</p>
                <p className="text-sm font-medium text-ctp-text">
                  {formatCurrency(position.averageCost, position.asset.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ctp-subtext0">Valeur</p>
                <p className="text-sm font-medium text-ctp-text">{formatCurrency(position.currentValue, 'EUR')}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default PositionList;
