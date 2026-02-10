// ============================================================================
// NET WORTH REPORT - Finance Hub
// Track patrimony evolution over time
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  CreditCard,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { clsx } from 'clsx';

interface NetWorthDataPoint {
  date: string;
  assets: number;
  liabilities: number;
  netWorth: number;
}

interface AssetBreakdown {
  id: string;
  name: string;
  type: 'bank' | 'investment' | 'property' | 'other';
  balance: number;
  change: number;
  changePercent: number;
}

interface LiabilityBreakdown {
  id: string;
  name: string;
  type: 'loan' | 'credit' | 'other';
  balance: number;
  change: number;
}

interface NetWorthResponse {
  history: NetWorthDataPoint[];
  currentNetWorth: number;
  previousNetWorth: number;
  change: number;
  changePercent: number;
  assets: {
    total: number;
    breakdown: AssetBreakdown[];
  };
  liabilities: {
    total: number;
    breakdown: LiabilityBreakdown[];
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

const assetTypeIcons: Record<string, typeof Wallet> = {
  bank: Wallet,
  investment: TrendingUp,
  property: Building2,
  other: Wallet,
};

export function NetWorthReport() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const [period, setPeriod] = useState<'6m' | '1y' | '2y' | 'all'>('1y');

  const months = period === '6m' ? 6 : period === '1y' ? 12 : period === '2y' ? 24 : 60;

  const { data: netWorthResponse, isLoading } = useQuery({
    queryKey: ['reports', workspaceId, 'net-worth', period],
    queryFn: () =>
      api.get<{ data: NetWorthResponse }>(
        `/workspaces/${workspaceId}/reports/net-worth?months=${months}`
      ),
    enabled: !!workspaceId,
  });

  const data = netWorthResponse?.data;

  const chartData = data?.history.map((point) => ({
    date: format(new Date(point.date), 'MMM yy', { locale: fr }),
    actifs: point.assets,
    passifs: point.liabilities,
    patrimoine: point.netWorth,
  }));

  if (!workspaceId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="card p-8 text-center">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-ctp-blue mb-4" />
        <p className="text-ctp-subtext0">Chargement du patrimoine...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card p-8 text-center">
        <Wallet className="w-12 h-12 mx-auto text-ctp-overlay1 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Aucune donnee</h3>
        <p className="text-ctp-subtext0">
          Ajoutez des comptes pour suivre votre patrimoine
        </p>
      </div>
    );
  }

  const isPositiveChange = data.change >= 0;

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Net Worth */}
        <div className="card col-span-2 bg-gradient-to-br from-ctp-blue/10 to-ctp-mauve/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-ctp-subtext0">Patrimoine net</span>
            <div
              className={clsx(
                'flex items-center gap-1 text-sm font-medium',
                isPositiveChange ? 'text-ctp-green' : 'text-ctp-red'
              )}
            >
              {isPositiveChange ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              {isPositiveChange ? '+' : ''}
              {data.changePercent.toFixed(1)}%
            </div>
          </div>
          <p className="text-3xl font-bold text-ctp-text">
            {formatCurrency(data.currentNetWorth)}
          </p>
          <p className="text-sm text-ctp-subtext0 mt-1">
            {isPositiveChange ? '+' : ''}
            {formatCurrency(data.change)} ce mois
          </p>
        </div>

        {/* Assets */}
        <div className="card">
          <div className="flex items-center gap-2 text-ctp-green mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">Total actifs</span>
          </div>
          <p className="text-2xl font-bold text-ctp-text">
            {formatCurrency(data.assets.total)}
          </p>
        </div>

        {/* Liabilities */}
        <div className="card">
          <div className="flex items-center gap-2 text-ctp-red mb-2">
            <TrendingDown className="w-4 h-4" />
            <span className="text-sm">Total passifs</span>
          </div>
          <p className="text-2xl font-bold text-ctp-text">
            {formatCurrency(data.liabilities.total)}
          </p>
        </div>
      </div>

      {/* Period Selector & Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Evolution du patrimoine</h3>
          <div className="flex gap-1 bg-ctp-surface0 rounded-lg p-1">
            {(['6m', '1y', '2y', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={clsx(
                  'px-3 py-1 text-sm rounded-md transition-colors',
                  period === p
                    ? 'bg-ctp-surface1 text-ctp-text'
                    : 'text-ctp-subtext0 hover:text-ctp-text'
                )}
              >
                {p === '6m'
                  ? '6 mois'
                  : p === '1y'
                  ? '1 an'
                  : p === '2y'
                  ? '2 ans'
                  : 'Tout'}
              </button>
            ))}
          </div>
        </div>

        {chartData && chartData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorPatrimoine" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--ctp-blue)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--ctp-blue)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-ctp-surface1" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  className="fill-ctp-subtext0"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="fill-ctp-subtext0"
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'var(--ctp-surface0)',
                    borderColor: 'var(--ctp-surface1)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="patrimoine"
                  name="Patrimoine"
                  stroke="var(--ctp-blue)"
                  fillOpacity={1}
                  fill="url(#colorPatrimoine)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center text-ctp-subtext0">
            Pas assez de donnees
          </div>
        )}
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Assets Breakdown */}
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-ctp-green" />
            Actifs
          </h3>
          <div className="space-y-3">
            {data.assets.breakdown.map((asset) => {
              const Icon = assetTypeIcons[asset.type] ?? Wallet;
              return (
                <div
                  key={asset.id}
                  className="flex items-center justify-between p-3 bg-ctp-surface0 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-ctp-surface1 rounded-lg">
                      <Icon className="w-5 h-5 text-ctp-subtext0" />
                    </div>
                    <div>
                      <p className="font-medium text-ctp-text">{asset.name}</p>
                      {asset.changePercent !== 0 && (
                        <p
                          className={clsx(
                            'text-xs',
                            asset.changePercent >= 0
                              ? 'text-ctp-green'
                              : 'text-ctp-red'
                          )}
                        >
                          {asset.changePercent >= 0 ? '+' : ''}
                          {asset.changePercent.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="font-semibold text-ctp-text">
                    {formatCurrency(asset.balance)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Liabilities Breakdown */}
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-ctp-red" />
            Passifs
          </h3>
          {data.liabilities.breakdown.length > 0 ? (
            <div className="space-y-3">
              {data.liabilities.breakdown.map((liability) => (
                <div
                  key={liability.id}
                  className="flex items-center justify-between p-3 bg-ctp-surface0 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-ctp-surface1 rounded-lg">
                      <CreditCard className="w-5 h-5 text-ctp-subtext0" />
                    </div>
                    <div>
                      <p className="font-medium text-ctp-text">{liability.name}</p>
                      {liability.change !== 0 && (
                        <p
                          className={clsx(
                            'text-xs',
                            liability.change < 0
                              ? 'text-ctp-green'
                              : 'text-ctp-red'
                          )}
                        >
                          {liability.change > 0 ? '+' : ''}
                          {formatCurrency(liability.change)}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="font-semibold text-ctp-red">
                    -{formatCurrency(Math.abs(liability.balance))}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-ctp-subtext0">
              <CreditCard className="w-8 h-8 mx-auto mb-2 text-ctp-overlay1" />
              <p>Aucun passif enregistre</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NetWorthReport;
