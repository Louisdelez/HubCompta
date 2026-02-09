// ============================================================================
// ACCOUNTS WIDGET - Finance Hub Dashboard
// Displays account balances in a compact format
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { Wallet, Building, CreditCard, Coins, TrendingUp, Banknote } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import type { WidgetProps } from './index';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit_card' | 'cash' | 'investment' | 'loan';
  balance: number;
  currency: string;
  icon?: string;
  color?: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const ACCOUNT_ICONS = {
  checking: Building,
  savings: Coins,
  credit_card: CreditCard,
  cash: Banknote,
  investment: TrendingUp,
  loan: Wallet,
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AccountsWidget({ workspaceId }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['accounts-widget', workspaceId],
    queryFn: () => api.get<Account[]>(`/workspaces/${workspaceId}/accounts`),
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="animate-pulse space-y-2 flex-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <div className="w-8 h-8 bg-ctp-surface1 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 bg-ctp-surface1 rounded w-3/4" />
              </div>
              <div className="h-4 bg-ctp-surface1 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const accounts = data ?? [];
  const totalBalance = accounts.reduce((sum, acc) => {
    // Subtract credit card and loan balances
    if (acc.type === 'credit_card' || acc.type === 'loan') {
      return sum - Math.abs(acc.balance);
    }
    return sum + acc.balance;
  }, 0);

  return (
    <div className="h-full flex flex-col">
      {/* Total */}
      <div className="mb-3 pb-2 border-b border-ctp-surface1">
        <p className="text-xs text-ctp-subtext0 uppercase tracking-wide">Solde total</p>
        <p className={clsx(
          'text-xl font-bold',
          totalBalance >= 0 ? 'text-ctp-green' : 'text-ctp-red'
        )}>
          {formatCurrency(totalBalance)}
        </p>
      </div>

      {/* Account List */}
      <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
        {accounts.length === 0 ? (
          <div className="text-center py-4">
            <Wallet className="w-8 h-8 mx-auto text-ctp-overlay1 mb-2" />
            <p className="text-sm text-ctp-subtext0">Aucun compte</p>
          </div>
        ) : (
          accounts.slice(0, 6).map((account) => {
            const Icon = ACCOUNT_ICONS[account.type] || Wallet;
            const isDebt = account.type === 'credit_card' || account.type === 'loan';

            return (
              <Link
                key={account.id}
                to={`/accounts/${account.id}`}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-ctp-mantle transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: account.color ? `${account.color}20` : undefined }}
                >
                  {account.icon ? (
                    <span className="text-lg">{account.icon}</span>
                  ) : (
                    <Icon className="w-4 h-4 text-ctp-overlay1" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ctp-text truncate">
                    {account.name}
                  </p>
                </div>
                <p className={clsx(
                  'text-sm font-semibold',
                  isDebt
                    ? account.balance < 0 ? 'text-ctp-red' : 'text-ctp-text'
                    : account.balance >= 0 ? 'text-ctp-green' : 'text-ctp-red'
                )}>
                  {formatCurrency(account.balance, account.currency)}
                </p>
              </Link>
            );
          })
        )}
      </div>

      {/* View All Link */}
      {accounts.length > 6 && (
        <Link
          to="/accounts"
          className="mt-2 pt-2 border-t border-ctp-surface1 text-center text-sm text-ctp-blue hover:text-ctp-sapphire transition-colors"
        >
          Voir les {accounts.length} comptes
        </Link>
      )}
    </div>
  );
}

export default AccountsWidget;
