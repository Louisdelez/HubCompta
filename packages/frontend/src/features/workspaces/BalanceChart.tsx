// ============================================================================
// BALANCE CHART - Finance Hub
// ============================================================================

import { Check, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface MemberBalance {
  memberId: string;
  memberName: string;
  memberEmail: string;
  totalPaid: number;
  fairShare: number;
  balance: number;
}

interface BalanceChartProps {
  balances: MemberBalance[];
  currency: string;
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

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-red-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length] ?? 'bg-blue-500';
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function BalanceChart({ balances, currency }: BalanceChartProps) {
  // Find max absolute balance for scaling
  const maxBalance = Math.max(...balances.map((b) => Math.abs(b.balance)), 1);

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Situation par membre</h2>

      <div className="space-y-4">
        {balances.map((balance) => {
          const isPositive = balance.balance >= 0;
          const barWidth = Math.min((Math.abs(balance.balance) / maxBalance) * 100, 100);

          return (
            <div key={balance.memberId} className="space-y-2">
              {/* Member Info */}
              <div className="flex items-center gap-3">
                <div
                  className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium',
                    getAvatarColor(balance.memberName)
                  )}
                >
                  {getInitials(balance.memberName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{balance.memberName}</p>
                  <p className="text-xs text-gray-500">
                    A payé {formatCurrency(balance.totalPaid, currency)}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={clsx(
                      'font-bold',
                      isPositive ? 'text-success-600' : 'text-danger-600'
                    )}
                  >
                    {isPositive ? '+' : ''}
                    {formatCurrency(balance.balance, currency)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isPositive ? 'doit recevoir' : 'doit payer'}
                  </p>
                </div>
              </div>

              {/* Balance Bar */}
              <div className="flex items-center gap-2">
                {/* Negative side (owes money) */}
                <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-l-full overflow-hidden flex justify-end">
                  {!isPositive && (
                    <div
                      className="h-full bg-danger-500 rounded-l-full transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  )}
                </div>

                {/* Center indicator */}
                <div className="w-0.5 h-4 bg-gray-400" />

                {/* Positive side (is owed money) */}
                <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-r-full overflow-hidden">
                  {isPositive && (
                    <div
                      className="h-full bg-success-500 rounded-r-full transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-danger-500" />
          <span className="text-sm text-gray-600 dark:text-gray-400">Doit payer</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-success-500" />
          <span className="text-sm text-gray-600 dark:text-gray-400">Doit recevoir</span>
        </div>
      </div>

      {/* Summary */}
      {balances.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-center text-sm">
            <div>
              <p className="text-gray-500">Total à redistribuer</p>
              <p className="font-bold text-lg">
                {formatCurrency(
                  balances.filter((b) => b.balance > 0).reduce((sum, b) => sum + b.balance, 0),
                  currency
                )}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Équilibre</p>
              <p className="font-bold text-lg">
                {Math.abs(balances.reduce((sum, b) => sum + b.balance, 0)) < 0.01 ? (
                  <span className="text-success-600 flex items-center justify-center gap-1">
                    <Check className="w-4 h-4" /> Équilibré
                  </span>
                ) : (
                  <span className="text-warning-600 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Déséquilibre
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BalanceChart;
