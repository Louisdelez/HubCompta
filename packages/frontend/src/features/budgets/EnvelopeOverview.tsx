// ============================================================================
// ENVELOPE OVERVIEW - Finance Hub
// Visual overview of envelope budgets with drag-and-drop reallocation
// ============================================================================

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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

interface EnvelopeBudgetItem {
  id: string;
  name: string;
  categoryName: string;
  budgetAmount: number;
  rolloverAmount: number;
  spent: number;
  available: number;
}

interface EnvelopeStatusResponse {
  totalEnvelopes: number;
  totalAvailable: number;
  totalSpent: number;
  envelopes: EnvelopeBudgetItem[];
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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showReallocate, setShowReallocate] = useState(false);
  const [sourceEnvelope, setSourceEnvelope] = useState<string | null>(null);
  const [targetEnvelope, setTargetEnvelope] = useState<string | null>(null);
  const [reallocateAmount, setReallocateAmount] = useState('');

  const { data: envelopeData, isLoading } = useQuery({
    queryKey: ['budgets', workspaceId, 'envelopes'],
    queryFn: () =>
      api.get<EnvelopeStatusResponse>(
        `/workspaces/${workspaceId}/budgets/envelopes`
      ),
    enabled: !!workspaceId,
  });

  const envelopes = envelopeData?.envelopes ?? [];

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

  // Use totals from the API response
  const totalBudgeted = envelopes.reduce((sum, e) => sum + e.budgetAmount, 0);
  const totalSpent = envelopeData?.totalSpent ?? 0;
  const totalAvailable = envelopeData?.totalAvailable ?? 0;
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
  const maxTransferAmount = sourceEnvelopeData?.available ?? 0;

  if (isLoading) {
    return (
      <div className="card p-8 text-center">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-ctp-blue mb-4" />
        <p className="text-ctp-subtext0">{t('budgets.loadingEnvelopes')}</p>
      </div>
    );
  }

  if (envelopes.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Wallet className="w-12 h-12 mx-auto text-ctp-overlay1 mb-4" />
        <h3 className="text-lg font-semibold mb-2">{t('budgets.envelopeModeTitle')}</h3>
        <p className="text-ctp-subtext0 mb-4">
          {t('budgets.enableEnvelopeModeDescription')}
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
          <p className="text-sm text-ctp-subtext0">{t('budgets.totalBudgeted')}</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-ctp-blue">
            {formatCurrency(totalSpent)}
          </p>
          <p className="text-sm text-ctp-subtext0">{t('budgets.spent')}</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-ctp-green">
            {formatCurrency(totalAvailable)}
          </p>
          <p className="text-sm text-ctp-subtext0">{t('budgets.available')}</p>
        </div>
        {totalRollover > 0 && (
          <div className="card text-center">
            <p className="text-2xl font-bold text-ctp-mauve">
              {formatCurrency(totalRollover)}
            </p>
            <p className="text-sm text-ctp-subtext0">{t('budgets.rollover')}</p>
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
          {t('budgets.reallocate')}
        </button>
      </div>

      {/* Reallocate Modal */}
      {showReallocate && (
        <div className="card p-4 bg-ctp-surface0">
          <h4 className="font-medium mb-4">{t('budgets.reallocateFunds')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm text-ctp-subtext0 mb-1">
                {t('budgets.fromEnvelope')}
              </label>
              <select
                value={sourceEnvelope ?? ''}
                onChange={(e) => setSourceEnvelope(e.target.value || null)}
                className="input-select w-full"
              >
                <option value="">{t('budgets.select')}</option>
                {envelopes
                  .filter((e) => e.available > 0)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({formatCurrency(e.available)})
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-center">
              <ArrowRight className="w-6 h-6 text-ctp-subtext0" />
            </div>
            <div>
              <label className="block text-sm text-ctp-subtext0 mb-1">
                {t('budgets.toEnvelope')}
              </label>
              <select
                value={targetEnvelope ?? ''}
                onChange={(e) => setTargetEnvelope(e.target.value || null)}
                className="input-select w-full"
                disabled={!sourceEnvelope}
              >
                <option value="">{t('budgets.select')}</option>
                {envelopes
                  .filter((e) => e.id !== sourceEnvelope)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm text-ctp-subtext0 mb-1">
                {t('budgets.amount')}
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
                  {t('budgets.max')}: {formatCurrency(maxTransferAmount)}
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
              {t('budgets.transfer')}
            </button>
          </div>
        </div>
      )}

      {/* Envelope Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {envelopes.map((envelope) => {
          const totalAvailableForEnvelope = envelope.budgetAmount + envelope.rolloverAmount;
          const percentUsed = totalAvailableForEnvelope > 0
            ? Math.round((envelope.spent / totalAvailableForEnvelope) * 100)
            : 0;
          const isOverBudget = envelope.spent > totalAvailableForEnvelope;
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
                <Wallet className="w-6 h-6 text-ctp-mauve" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-ctp-text truncate">
                    {envelope.name}
                  </h3>
                  <p className="text-sm text-ctp-subtext0">
                    {envelope.categoryName}
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
                    {formatCurrency(totalAvailableForEnvelope)}
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
                  <p className="text-ctp-subtext0">{t('budgets.available')}</p>
                  <p
                    className={clsx(
                      'font-medium',
                      envelope.available < 0
                        ? 'text-ctp-red'
                        : 'text-ctp-green'
                    )}
                  >
                    {formatCurrency(envelope.available)}
                  </p>
                </div>
                {envelope.rolloverAmount > 0 && (
                  <div>
                    <p className="text-ctp-subtext0 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {t('budgets.rollover')}
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
