// ============================================================================
// LOAN PROGRESS CHART - Finance Hub
// Visual chart showing principal vs interest over time
// ============================================================================

import { useMemo } from 'react';
import { format, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TrendingDown, Coins } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { clsx } from 'clsx';

interface LoanProgressChartProps {
  principalAmount: number;
  currentBalance: number;
  annualInterestRate: number;
  termMonths: number;
  startDate: Date;
  monthlyPayment: number;
  paidMonths: number;
  currency?: string;
}

interface ChartDataPoint {
  month: string;
  principal: number;
  interest: number;
  balance: number;
  isPast: boolean;
}

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function generateChartData(
  principal: number,
  annualRate: number,
  termMonths: number,
  startDate: Date,
  monthlyPayment: number,
  paidMonths: number
): ChartDataPoint[] {
  const monthlyRate = annualRate / 12 / 100;
  const data: ChartDataPoint[] = [];

  let balance = principal;
  let cumulativePrincipal = 0;
  let cumulativeInterest = 0;

  for (let month = 0; month <= termMonths && balance > 0; month++) {
    const interest = balance * monthlyRate;
    const principalPaid = Math.min(monthlyPayment - interest, balance);

    data.push({
      month: format(addMonths(startDate, month), 'MMM yy', { locale: fr }),
      principal: cumulativePrincipal,
      interest: cumulativeInterest,
      balance,
      isPast: month <= paidMonths,
    });

    balance = Math.max(0, balance - principalPaid);
    cumulativePrincipal += principalPaid;
    cumulativeInterest += interest;
  }

  return data;
}

export function LoanProgressChart({
  principalAmount,
  currentBalance,
  annualInterestRate,
  termMonths,
  startDate,
  monthlyPayment,
  paidMonths,
  currency = 'EUR',
}: LoanProgressChartProps) {
  const chartData = useMemo(
    () =>
      generateChartData(
        principalAmount,
        annualInterestRate,
        termMonths,
        startDate,
        monthlyPayment,
        paidMonths
      ),
    [
      principalAmount,
      annualInterestRate,
      termMonths,
      startDate,
      monthlyPayment,
      paidMonths,
    ]
  );

  const totalInterest = chartData[chartData.length - 1]?.interest ?? 0;
  const totalCost = principalAmount + totalInterest;
  const paidPrincipal = principalAmount - currentBalance;
  const progressPercent = (paidPrincipal / principalAmount) * 100;

  const monthlyInterestCost = totalInterest / termMonths;

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-ctp-green" />
            Progression du remboursement
          </h3>
          <span className="text-sm text-ctp-subtext0">
            {paidMonths} / {termMonths} mois
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-ctp-subtext0">Rembourse</span>
            <span className="font-medium text-ctp-text">
              {progressPercent.toFixed(1)}%
            </span>
          </div>
          <div className="h-4 bg-ctp-surface1 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-ctp-blue to-ctp-green transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-xs text-ctp-subtext0 mb-1">Capital initial</p>
            <p className="text-lg font-semibold text-ctp-text">
              {formatCurrency(principalAmount, currency)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-ctp-subtext0 mb-1">Capital rembourse</p>
            <p className="text-lg font-semibold text-ctp-green">
              {formatCurrency(paidPrincipal, currency)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-ctp-subtext0 mb-1">Solde restant</p>
            <p className="text-lg font-semibold text-ctp-blue">
              {formatCurrency(currentBalance, currency)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-ctp-subtext0 mb-1">Interets totaux</p>
            <p className="text-lg font-semibold text-ctp-red">
              {formatCurrency(totalInterest, currency)}
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <h3 className="font-semibold mb-4">Evolution du capital</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPrincipal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--ctp-blue)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--ctp-blue)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorInterest" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--ctp-red)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--ctp-red)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-ctp-surface1" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10 }}
                className="fill-ctp-subtext0"
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                className="fill-ctp-subtext0"
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatCurrency(value, currency),
                  name === 'balance'
                    ? 'Solde restant'
                    : name === 'principal'
                    ? 'Capital rembourse'
                    : 'Interets payes',
                ]}
                contentStyle={{
                  backgroundColor: 'var(--ctp-surface0)',
                  borderColor: 'var(--ctp-surface1)',
                }}
              />
              <Legend
                formatter={(value) =>
                  value === 'balance'
                    ? 'Solde restant'
                    : value === 'principal'
                    ? 'Capital rembourse'
                    : 'Interets'
                }
              />
              {chartData[paidMonths]?.month && (
                <ReferenceLine
                  x={chartData[paidMonths].month}
                  stroke="var(--ctp-green)"
                  strokeDasharray="3 3"
                  label={{
                    value: "Aujourd'hui",
                    position: 'top',
                    fill: 'var(--ctp-green)',
                    fontSize: 10,
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="balance"
                name="balance"
                stroke="var(--ctp-blue)"
                fillOpacity={1}
                fill="url(#colorPrincipal)"
              />
              <Area
                type="monotone"
                dataKey="interest"
                name="interest"
                stroke="var(--ctp-red)"
                fillOpacity={1}
                fill="url(#colorInterest)"
                stackId="1"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Coins className="w-5 h-5 text-ctp-yellow" />
          Cout total du pret
        </h3>

        <div className="space-y-3">
          {/* Principal */}
          <div className="flex items-center justify-between">
            <span className="text-ctp-subtext0">Capital emprunte</span>
            <span className="font-medium text-ctp-text">
              {formatCurrency(principalAmount, currency)}
            </span>
          </div>

          {/* Interest */}
          <div className="flex items-center justify-between">
            <span className="text-ctp-subtext0">Interets totaux</span>
            <span className="font-medium text-ctp-red">
              + {formatCurrency(totalInterest, currency)}
            </span>
          </div>

          <div className="h-px bg-ctp-surface1" />

          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-ctp-text">Cout total</span>
            <span className="text-xl font-bold text-ctp-text">
              {formatCurrency(totalCost, currency)}
            </span>
          </div>

          {/* Interest ratio */}
          <div className="bg-ctp-surface0 rounded-lg p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ctp-subtext0">Ratio interets / capital</span>
              <span
                className={clsx(
                  'font-medium',
                  (totalInterest / principalAmount) * 100 > 50
                    ? 'text-ctp-red'
                    : 'text-ctp-yellow'
                )}
              >
                {((totalInterest / principalAmount) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-ctp-subtext0">Cout mensuel moyen en interets</span>
              <span className="font-medium text-ctp-red">
                {formatCurrency(monthlyInterestCost, currency)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoanProgressChart;
