// ============================================================================
// BALANCE CHART - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
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
// Helpers - Catppuccin Colors
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

// Avatar colors using all 14 Catppuccin accent colors
function getAvatarColor(name: string): string {
  const colors = [
    'bg-ctp-blue',
    'bg-ctp-green',
    'bg-ctp-mauve',
    'bg-ctp-peach',
    'bg-ctp-pink',
    'bg-ctp-teal',
    'bg-ctp-sapphire',
    'bg-ctp-lavender',
    'bg-ctp-yellow',
    'bg-ctp-flamingo',
    'bg-ctp-sky',
    'bg-ctp-maroon',
    'bg-ctp-red',
    'bg-ctp-rosewater',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length] ?? 'bg-ctp-blue';
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function BalanceChart({ balances, currency }: BalanceChartProps) {
  // Find max absolute balance for scaling
  const maxBalance = Math.max(...balances.map((b) => Math.abs(b.balance)), 1);

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-ctp-text mb-4">Situation par membre</h2>

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
                    'w-10 h-10 rounded-full flex items-center justify-center text-ctp-base font-medium',
                    getAvatarColor(balance.memberName)
                  )}
                >
                  {getInitials(balance.memberName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ctp-text truncate">{balance.memberName}</p>
                  <p className="text-xs text-ctp-subtext0">
                    A payé {formatCurrency(balance.totalPaid, currency)}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={clsx(
                      'font-bold',
                      isPositive ? 'text-ctp-green' : 'text-ctp-red'
                    )}
                  >
                    {isPositive ? '+' : ''}
                    {formatCurrency(balance.balance, currency)}
                  </p>
                  <p className="text-xs text-ctp-subtext0">
                    {isPositive ? 'doit recevoir' : 'doit payer'}
                  </p>
                </div>
              </div>

              {/* Balance Bar */}
              <div className="flex items-center gap-2">
                {/* Negative side (owes money) */}
                <div className="flex-1 h-3 bg-ctp-surface1 rounded-l-full overflow-hidden flex justify-end">
                  {!isPositive && (
                    <div
                      className="h-full bg-ctp-red rounded-l-full transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  )}
                </div>

                {/* Center indicator */}
                <div className="w-0.5 h-4 bg-ctp-overlay1" />

                {/* Positive side (is owed money) */}
                <div className="flex-1 h-3 bg-ctp-surface1 rounded-r-full overflow-hidden">
                  {isPositive && (
                    <div
                      className="h-full bg-ctp-green rounded-r-full transition-all duration-500"
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
      <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-ctp-surface1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-ctp-red" />
          <span className="text-sm text-ctp-subtext0">Doit payer</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-ctp-green" />
          <span className="text-sm text-ctp-subtext0">Doit recevoir</span>
        </div>
      </div>

      {/* Summary */}
      {balances.length > 0 && (
        <div className="mt-4 p-3 bg-ctp-surface0 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-center text-sm">
            <div>
              <p className="text-ctp-subtext0">Total à redistribuer</p>
              <p className="font-bold text-lg text-ctp-text">
                {formatCurrency(
                  balances.filter((b) => b.balance > 0).reduce((sum, b) => sum + b.balance, 0),
                  currency
                )}
              </p>
            </div>
            <div>
              <p className="text-ctp-subtext0">Équilibre</p>
              <p className="font-bold text-lg">
                {Math.abs(balances.reduce((sum, b) => sum + b.balance, 0)) < 0.01 ? (
                  <span className="text-ctp-green flex items-center justify-center gap-1">
                    <Check className="w-4 h-4" /> Équilibré
                  </span>
                ) : (
                  <span className="text-ctp-yellow flex items-center justify-center gap-1">
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
