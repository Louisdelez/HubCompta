// ============================================================================
// NET WORTH BREAKDOWN COMPONENT - Finance Hub
// Shows breakdown of assets and liabilities
// Uses Catppuccin colors
// ============================================================================

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  Wallet,
  TrendingUp,
  CreditCard,
  Banknote,
  Building,
  CircleDollarSign,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useTheme } from '@/providers/ThemeProvider';
import { CATPPUCCIN } from '@/lib/catppuccin-colors';

// Helper to convert RGB string to hex
function rgbToHex(rgb: string): string {
  const parts = rgb.split(' ').map(Number);
  return '#' + parts.map(n => n.toString(16).padStart(2, '0')).join('');
}

// Hook to get Catppuccin colors as hex for charts
function useCatppuccinChartColors() {
  const { resolvedTheme } = useTheme();
  const palette = CATPPUCCIN[resolvedTheme];

  return useMemo(() => ({
    green: rgbToHex(palette.green),
    red: rgbToHex(palette.red),
    blue: rgbToHex(palette.blue),
    mauve: rgbToHex(palette.mauve),
    teal: rgbToHex(palette.teal),
    peach: rgbToHex(palette.peach),
    yellow: rgbToHex(palette.yellow),
    sapphire: rgbToHex(palette.sapphire),
    pink: rgbToHex(palette.pink),
    sky: rgbToHex(palette.sky),
    lavender: rgbToHex(palette.lavender),
  }), [resolvedTheme, palette]);
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface AccountItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

interface InvestmentItem {
  id: string;
  symbol: string;
  name: string;
  type: string;
  value: number;
  currency: string;
}

interface LoanItem {
  id: string;
  name: string;
  type: 'debt' | 'credit';
  balance: number;
  currency: string;
}

interface NetWorthBreakdownProps {
  accounts: AccountItem[];
  investments: InvestmentItem[];
  loans: LoanItem[];
  totalAssets: number;
  totalLiabilities: number;
  currency?: string;
  className?: string;
}

// ----------------------------------------------------------------------------
// Icons for account types
// ----------------------------------------------------------------------------

const accountTypeIcons: Record<string, typeof Wallet> = {
  checking: Wallet,
  savings: Building,
  credit_card: CreditCard,
  cash: Banknote,
  investment: TrendingUp,
};

const investmentTypeIcons: Record<string, typeof TrendingUp> = {
  stock: TrendingUp,
  etf: TrendingUp,
  crypto: CircleDollarSign,
  bond: Building,
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function NetWorthBreakdown({
  accounts,
  investments,
  loans,
  totalAssets,
  totalLiabilities,
  currency = 'EUR',
  className,
}: NetWorthBreakdownProps) {
  const colors = useCatppuccinChartColors();

  // Prepare data for pie charts
  const assetPieData = useMemo(() => {
    const data: { name: string; value: number; color: string }[] = [];

    // Add positive account balances
    const accountsTotal = accounts
      .filter(a => a.balance > 0)
      .reduce((sum, a) => sum + a.balance, 0);
    if (accountsTotal > 0) {
      data.push({ name: 'Comptes', value: accountsTotal, color: colors.blue });
    }

    // Add investments
    const investTotal = investments.reduce((sum, i) => sum + i.value, 0);
    if (investTotal > 0) {
      data.push({ name: 'Investissements', value: investTotal, color: colors.mauve });
    }

    // Add credits (money owed to me)
    const creditsTotal = loans
      .filter(l => l.type === 'credit')
      .reduce((sum, l) => sum + l.balance, 0);
    if (creditsTotal > 0) {
      data.push({ name: 'Creances', value: creditsTotal, color: colors.teal });
    }

    return data;
  }, [accounts, investments, loans, colors]);

  const liabilityPieData = useMemo(() => {
    const data: { name: string; value: number; color: string }[] = [];

    // Add negative account balances (overdrafts, credit card debt)
    const overdrafts = accounts
      .filter(a => a.balance < 0)
      .reduce((sum, a) => sum + Math.abs(a.balance), 0);
    if (overdrafts > 0) {
      data.push({ name: 'Decouverts', value: overdrafts, color: colors.peach });
    }

    // Add debts
    const debtsTotal = loans
      .filter(l => l.type === 'debt')
      .reduce((sum, l) => sum + l.balance, 0);
    if (debtsTotal > 0) {
      data.push({ name: 'Dettes', value: debtsTotal, color: colors.red });
    }

    return data;
  }, [accounts, loans, colors]);

  // Separate positive and negative accounts
  const positiveAccounts = accounts.filter(a => a.balance >= 0);
  const negativeAccounts = accounts.filter(a => a.balance < 0);
  const debts = loans.filter(l => l.type === 'debt');
  const credits = loans.filter(l => l.type === 'credit');

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Assets Card */}
        <div className="bg-ctp-green/10 border border-ctp-green/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-ctp-subtext0">Total Actifs</p>
              <p className="text-2xl font-semibold text-ctp-green">
                {formatCurrency(totalAssets, currency)}
              </p>
            </div>
            {assetPieData.length > 0 && (
              <div className="w-20 h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={assetPieData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={20}
                      outerRadius={35}
                      paddingAngle={2}
                    >
                      {assetPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value, currency)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          {/* Asset legend */}
          <div className="flex flex-wrap gap-3">
            {assetPieData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-ctp-subtext0">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Liabilities Card */}
        <div className="bg-ctp-red/10 border border-ctp-red/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-ctp-subtext0">Total Passifs</p>
              <p className="text-2xl font-semibold text-ctp-red">
                {formatCurrency(totalLiabilities, currency)}
              </p>
            </div>
            {liabilityPieData.length > 0 && (
              <div className="w-20 h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={liabilityPieData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={20}
                      outerRadius={35}
                      paddingAngle={2}
                    >
                      {liabilityPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value, currency)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          {/* Liability legend */}
          <div className="flex flex-wrap gap-3">
            {liabilityPieData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-ctp-subtext0">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Accounts */}
        <div className="bg-ctp-mantle border border-ctp-surface1 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="h-4 w-4 text-ctp-blue" />
            <h3 className="text-sm font-medium text-ctp-text">Comptes</h3>
          </div>
          <div className="space-y-2">
            {positiveAccounts.map((account) => {
              const Icon = accountTypeIcons[account.type] || Wallet;
              return (
                <div
                  key={account.id}
                  className="flex items-center justify-between py-2 px-3 bg-ctp-surface0 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-ctp-subtext0" />
                    <span className="text-sm text-ctp-text truncate max-w-32">
                      {account.name}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-ctp-green">
                    {formatCurrency(account.balance, account.currency)}
                  </span>
                </div>
              );
            })}
            {negativeAccounts.map((account) => {
              const Icon = accountTypeIcons[account.type] || Wallet;
              return (
                <div
                  key={account.id}
                  className="flex items-center justify-between py-2 px-3 bg-ctp-red/10 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-ctp-red" />
                    <span className="text-sm text-ctp-text truncate max-w-32">
                      {account.name}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-ctp-red">
                    {formatCurrency(account.balance, account.currency)}
                  </span>
                </div>
              );
            })}
            {accounts.length === 0 && (
              <p className="text-sm text-ctp-overlay1 text-center py-4">
                Aucun compte
              </p>
            )}
          </div>
        </div>

        {/* Investments */}
        <div className="bg-ctp-mantle border border-ctp-surface1 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-ctp-mauve" />
            <h3 className="text-sm font-medium text-ctp-text">Investissements</h3>
          </div>
          <div className="space-y-2">
            {investments.map((investment) => {
              const Icon = investmentTypeIcons[investment.type] || TrendingUp;
              return (
                <div
                  key={investment.id}
                  className="flex items-center justify-between py-2 px-3 bg-ctp-surface0 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-ctp-subtext0" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-ctp-text">
                        {investment.symbol}
                      </span>
                      <span className="text-xs text-ctp-subtext0 truncate max-w-24">
                        {investment.name}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-ctp-mauve">
                    {formatCurrency(investment.value, investment.currency)}
                  </span>
                </div>
              );
            })}
            {investments.length === 0 && (
              <p className="text-sm text-ctp-overlay1 text-center py-4">
                Aucun investissement
              </p>
            )}
          </div>
        </div>

        {/* Loans */}
        <div className="bg-ctp-mantle border border-ctp-surface1 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <CircleDollarSign className="h-4 w-4 text-ctp-peach" />
            <h3 className="text-sm font-medium text-ctp-text">Prets et Dettes</h3>
          </div>
          <div className="space-y-2">
            {credits.map((loan) => (
              <div
                key={loan.id}
                className="flex items-center justify-between py-2 px-3 bg-ctp-green/10 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-ctp-green" />
                  <span className="text-sm text-ctp-text truncate max-w-32">
                    {loan.name}
                  </span>
                </div>
                <span className="text-sm font-medium text-ctp-green">
                  +{formatCurrency(loan.balance, loan.currency)}
                </span>
              </div>
            ))}
            {debts.map((loan) => (
              <div
                key={loan.id}
                className="flex items-center justify-between py-2 px-3 bg-ctp-red/10 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-ctp-red" />
                  <span className="text-sm text-ctp-text truncate max-w-32">
                    {loan.name}
                  </span>
                </div>
                <span className="text-sm font-medium text-ctp-red">
                  -{formatCurrency(loan.balance, loan.currency)}
                </span>
              </div>
            ))}
            {loans.length === 0 && (
              <p className="text-sm text-ctp-overlay1 text-center py-4">
                Aucun pret ou dette
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NetWorthBreakdown;
