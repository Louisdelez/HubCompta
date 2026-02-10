// ============================================================================
// ENVELOPE OVERVIEW - Finance Hub
// Visual overview of envelope budgets with drag-and-drop reallocation
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  ArrowRight,
  RefreshCcw,
  Loader2,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

interface EnvelopeBudget {
  id: string;
  name: string;
  amount: number;
  spent: number;
  remaining: number;
  rolloverAmount: number;
  availableAmount: number;
  percentUsed: number;
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  };
}

interface EnvelopeOverviewProps {
  workspaceId: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function EnvelopeOverview({ workspaceId }: EnvelopeOverviewProps) {
  const queryClient = useQueryClient();
  const [showReallocate, setShowReallocate] = useState(false);
  const [sourceEnvelope, setSourceEnvelope] = useState<string | null>(null);
  const [targetEnvelope, setTargetEnvelope] = useState<string | null>(null);
  const [reallocateAmount, setReallocateAmount] = useState('');

  const { data: envelopesResponse, isLoading } = useQuery({
    queryKey: ['budgets', workspaceId, 'envelopes'],
    queryFn: () =>
      api.get<{ data: EnvelopeBudget[] }>(
        `/workspaces/${workspaceId}/budgets/envelopes`
      ),
    enabled: !!workspaceId,
  });

  const reallocateMutation = useMutation({
    mutationFn: (data: {
      fromBudgetId: string;
      toBudgetId: string;
      amount: number;
    }) =>
      api.post(`/workspaces/${workspaceId}/budgets/reallocate`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['budgets', workspaceId] });
      setShowReallocate(false);
      setSourceEnvelope(null);
      setTargetEnvelope(null);
      setReallocateAmount('');
    },
  });

  const envelopes = envelopesResponse?.data ?? [];

  // Calculate totals
  const totalBudgeted = envelopes.reduce((sum, e) => sum + e.amount, 0);
  const totalSpent = envelopes.reduce((sum, e) => sum + e.spent, 0);
  const totalAvailable = envelopes.reduce((sum, e) => sum + e.availableAmount, 0);
  const totalRollover = envelopes.reduce((sum, e) => sum + e.rolloverAmount, 0);

  const handleReallocate = () => {
    if (!sourceEnvelope || !targetEnvelope || !reallocateAmount) return;
    reallocateMutation.mutate({
      fromBudgetId: sourceEnvelope,
      toBudgetId: targetEnvelope,
      amount: parseFloat(reallocateAmount),
    });
  };

  const sourceEnvelopeData = envelopes.find((e) => e.id === sourceEnvelope);
  const maxTransferAmount = sourceEnvelopeData?.remaining ?? 0;

  if (isLoading) {
    return (
      <div className="card p-8 text-center">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-ctp-blue mb-4" />
        <p className="text-ctp-subtext0">Chargement des enveloppes...</p>
      </div>
    );
  }

  if (envelopes.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Wallet className="w-12 h-12 mx-auto text-ctp-overlay1 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Mode Enveloppes</h3>
        <p className="text-ctp-subtext0 mb-4">
          Activez le mode enveloppes sur vos budgets pour voir cette vue.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-ctp-text">
            {formatCurrency(totalBudgeted)}
          </p>
          <p className="text-sm text-ctp-subtext0">Budget total</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-ctp-blue">
            {formatCurrency(totalSpent)}
          </p>
          <p className="text-sm text-ctp-subtext0">Depense</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-ctp-green">
            {formatCurrency(totalAvailable)}
          </p>
          <p className="text-sm text-ctp-subtext0">Disponible</p>
        </div>
        {totalRollover > 0 && (
          <div className="card text-center">
            <p className="text-2xl font-bold text-ctp-mauve">
              {formatCurrency(totalRollover)}
            </p>
            <p className="text-sm text-ctp-subtext0">Report</p>
          </div>
        )}
      </div>

      {/* Reallocate Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowReallocate(!showReallocate)}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCcw className="w-4 h-4" />
          Reallouer
        </button>
      </div>

      {/* Reallocate Modal */}
      {showReallocate && (
        <div className="card p-4 bg-ctp-surface0">
          <h4 className="font-medium mb-4">Reallouer des fonds</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm text-ctp-subtext0 mb-1">
                De l'enveloppe
              </label>
              <select
                value={sourceEnvelope ?? ''}
                onChange={(e) => setSourceEnvelope(e.target.value || null)}
                className="input-select w-full"
              >
                <option value="">Selectionner...</option>
                {envelopes
                  .filter((e) => e.remaining > 0)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.category.icon} {e.name} ({formatCurrency(e.remaining)})
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-center">
              <ArrowRight className="w-6 h-6 text-ctp-subtext0" />
            </div>
            <div>
              <label className="block text-sm text-ctp-subtext0 mb-1">
                Vers l'enveloppe
              </label>
              <select
                value={targetEnvelope ?? ''}
                onChange={(e) => setTargetEnvelope(e.target.value || null)}
                className="input-select w-full"
                disabled={!sourceEnvelope}
              >
                <option value="">Selectionner...</option>
                {envelopes
                  .filter((e) => e.id !== sourceEnvelope)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.category.icon} {e.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm text-ctp-subtext0 mb-1">
                Montant
              </label>
              <input
                type="number"
                value={reallocateAmount}
                onChange={(e) => setReallocateAmount(e.target.value)}
                max={maxTransferAmount}
                min={0}
                step={0.01}
                className="input-text w-full"
                placeholder="0.00"
                disabled={!sourceEnvelope || !targetEnvelope}
              />
              {sourceEnvelope && maxTransferAmount > 0 && (
                <p className="text-xs text-ctp-subtext0 mt-1">
                  Max: {formatCurrency(maxTransferAmount)}
                </p>
              )}
            </div>
            <button
              onClick={handleReallocate}
              disabled={
                !sourceEnvelope ||
                !targetEnvelope ||
                !reallocateAmount ||
                parseFloat(reallocateAmount) <= 0 ||
                parseFloat(reallocateAmount) > maxTransferAmount ||
                reallocateMutation.isPending
              }
              className="btn-primary"
            >
              {reallocateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Transferer
            </button>
          </div>
        </div>
      )}

      {/* Envelope Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {envelopes.map((envelope) => {
          const percentUsed = Math.round(
            (envelope.spent / envelope.availableAmount) * 100
          );
          const isOverBudget = envelope.spent > envelope.availableAmount;
          const isNearLimit = percentUsed >= 80 && !isOverBudget;

          return (
            <div
              key={envelope.id}
              className={clsx(
                'card relative overflow-hidden',
                isOverBudget && 'ring-2 ring-ctp-red',
                isNearLimit && 'ring-2 ring-ctp-yellow'
              )}
            >
              {/* Category Header */}
              <div className="flex items-center gap-2 mb-3">
                {envelope.category.icon && (
                  <span className="text-2xl">{envelope.category.icon}</span>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-ctp-text truncate">
                    {envelope.name}
                  </h3>
                  <p className="text-sm text-ctp-subtext0">
                    {envelope.category.name}
                  </p>
                </div>
                {isOverBudget && (
                  <AlertTriangle className="w-5 h-5 text-ctp-red" />
                )}
              </div>

              {/* Progress */}
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span
                    className={clsx(
                      'font-medium',
                      isOverBudget
                        ? 'text-ctp-red'
                        : isNearLimit
                        ? 'text-ctp-yellow'
                        : 'text-ctp-text'
                    )}
                  >
                    {percentUsed}%
                  </span>
                  <span className="text-ctp-subtext0">
                    {formatCurrency(envelope.spent)} /{' '}
                    {formatCurrency(envelope.availableAmount)}
                  </span>
                </div>
                <div className="h-3 bg-ctp-surface1 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all duration-500',
                      isOverBudget
                        ? 'bg-ctp-red'
                        : isNearLimit
                        ? 'bg-ctp-yellow'
                        : percentUsed >= 50
                        ? 'bg-ctp-blue'
                        : 'bg-ctp-green'
                    )}
                    style={{ width: `${Math.min(percentUsed, 100)}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-ctp-subtext0">Restant</p>
                  <p
                    className={clsx(
                      'font-medium',
                      envelope.remaining < 0
                        ? 'text-ctp-red'
                        : 'text-ctp-green'
                    )}
                  >
                    {formatCurrency(envelope.remaining)}
                  </p>
                </div>
                {envelope.rolloverAmount > 0 && (
                  <div>
                    <p className="text-ctp-subtext0 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Report
                    </p>
                    <p className="font-medium text-ctp-mauve">
                      +{formatCurrency(envelope.rolloverAmount)}
                    </p>
                  </div>
                )}
              </div>

              {/* Envelope fill indicator */}
              <div className="absolute top-0 left-0 w-full h-1">
                <div
                  className={clsx(
                    'h-full',
                    isOverBudget
                      ? 'bg-ctp-red'
                      : isNearLimit
                      ? 'bg-ctp-yellow'
                      : 'bg-ctp-green'
                  )}
                  style={{ width: `${Math.min(percentUsed, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EnvelopeOverview;
