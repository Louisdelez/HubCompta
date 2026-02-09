// ============================================================================
// SETTLEMENT HISTORY - Finance Hub
// Display historical settlement data
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { SettlementHistoryChart } from './SettlementHistoryChart';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface HistoryEntry {
  period: string;
  totalExpenses: number;
  settled: boolean;
}

interface SettlementHistoryProps {
  currency?: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount);
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SettlementHistory({ currency = 'EUR' }: SettlementHistoryProps) {
  const { currentWorkspaceId: workspaceId } = useWorkspace();

  const { data: history, isLoading } = useQuery({
    queryKey: ['settlement-history', workspaceId],
    queryFn: () =>
      api.get<{ data: HistoryEntry[] }>(
        `/workspaces/${workspaceId}/settlement/history?months=6`
      ).then((res) => res.data),
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-48 bg-ctp-surface1 rounded-lg animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-ctp-surface1 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="h-12 w-12 text-ctp-overlay1 mx-auto mb-3" />
        <p className="text-ctp-subtext0">Aucun historique disponible</p>
      </div>
    );
  }

  // Calculate stats
  const totalAll = history.reduce((sum, h) => sum + h.totalExpenses, 0);
  const average = totalAll / history.length;
  const currentMonth = history[0];
  const lastMonth = history[1];
  const trend = currentMonth && lastMonth && lastMonth.totalExpenses > 0
    ? ((currentMonth.totalExpenses - lastMonth.totalExpenses) / lastMonth.totalExpenses) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-sm text-ctp-subtext0">Total 6 mois</p>
          <p className="text-2xl font-bold">{formatCurrency(totalAll, currency)}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-ctp-subtext0">Moyenne mensuelle</p>
          <p className="text-2xl font-bold">{formatCurrency(average, currency)}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-ctp-subtext0">Tendance</p>
          <div className="flex items-center justify-center gap-2">
            {trend >= 0 ? (
              <TrendingUp className="h-5 w-5 text-ctp-red" />
            ) : (
              <TrendingDown className="h-5 w-5 text-ctp-green" />
            )}
            <p className={`text-2xl font-bold ${trend >= 0 ? 'text-ctp-red' : 'text-ctp-green'}`}>
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <h3 className="font-semibold mb-4">Evolution des depenses</h3>
        <SettlementHistoryChart data={history} currency={currency} />
      </div>

      {/* History List */}
      <div className="card">
        <h3 className="font-semibold mb-4">Historique mensuel</h3>
        <div className="space-y-2">
          {history.map((entry, index) => (
            <div
              key={entry.period}
              className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                index === 0
                  ? 'bg-ctp-blue/10 border border-ctp-blue'
                  : 'bg-ctp-surface0'
              }`}
            >
              <div className="flex items-center gap-3">
                {entry.settled ? (
                  <CheckCircle className="h-5 w-5 text-ctp-green" />
                ) : (
                  <Clock className="h-5 w-5 text-ctp-yellow" />
                )}
                <div>
                  <p className="font-medium capitalize">{entry.period}</p>
                  <p className="text-sm text-ctp-subtext0">
                    {entry.settled ? 'Reglement effectue' : 'En cours'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(entry.totalExpenses, currency)}</p>
                {index > 0 && history[index - 1] && (
                  <p className="text-xs text-ctp-subtext0">
                    {(() => {
                      const prev = history[index - 1];
                      if (!prev || prev.totalExpenses === 0) return '';
                      const diff = ((entry.totalExpenses - prev.totalExpenses) / prev.totalExpenses) * 100;
                      return (
                        <span className={diff >= 0 ? 'text-ctp-red' : 'text-ctp-green'}>
                          {diff >= 0 ? '+' : ''}{diff.toFixed(1)}% vs mois suivant
                        </span>
                      );
                    })()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SettlementHistory;
