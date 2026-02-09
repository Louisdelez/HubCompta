// ============================================================================
// ACCOUNT LIST - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Landmark, PiggyBank, Banknote, CreditCard, FileText, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { AccountForm } from './AccountForm';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'cash' | 'credit_card' | 'loan' | 'investment';
  currency: string;
  balance: number;
  transactionCount: number;
  isArchived: boolean;
  icon?: string;
  color?: string;
}

interface AccountListProps {
  workspaceId: string;
  compact?: boolean;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const ACCOUNT_TYPE_ICONS: Record<Account['type'], typeof Landmark> = {
  checking: Landmark,
  savings: PiggyBank,
  cash: Banknote,
  credit_card: CreditCard,
  loan: FileText,
  investment: TrendingUp,
};

// Catppuccin accent colors for each account type
const ACCOUNT_TYPE_COLORS: Record<Account['type'], string> = {
  checking: 'text-ctp-blue',
  savings: 'text-ctp-green',
  cash: 'text-ctp-green',
  credit_card: 'text-ctp-red',
  loan: 'text-ctp-peach',
  investment: 'text-ctp-mauve',
};

const ACCOUNT_TYPE_LABELS: Record<Account['type'], string> = {
  checking: 'Compte courant',
  savings: 'Épargne',
  cash: 'Espèces',
  credit_card: 'Carte de crédit',
  loan: 'Prêt',
  investment: 'Investissement',
};

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AccountList({ workspaceId, compact = false }: AccountListProps) {
  const [showForm, setShowForm] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts', workspaceId],
    queryFn: () => api.get<Account[]>(`/workspaces/${workspaceId}/accounts`),
  });

  // Group accounts by type
  const groupedAccounts = (accounts ?? []).reduce((groups, account) => {
    if (!groups[account.type]) {
      groups[account.type] = [];
    }
    groups[account.type].push(account);
    return groups;
  }, {} as Record<Account['type'], Account[]>);

  const totalBalance = (accounts ?? [])
    .filter((a) => !a.isArchived)
    .reduce((sum, a) => sum + a.balance, 0);

  if (isLoading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-ctp-surface1 rounded w-1/3" />
          <div className="h-12 bg-ctp-surface1 rounded" />
          <div className="h-12 bg-ctp-surface1 rounded" />
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Comptes</h3>
          <button
            onClick={() => setShowForm(true)}
            className="text-sm text-ctp-blue hover:underline"
          >
            + Ajouter
          </button>
        </div>

        <div className="space-y-2">
          {(accounts ?? []).slice(0, 5).map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-ctp-surface0"
            >
              <div className="flex items-center gap-2">
                {account.icon ? (
                  <span className="text-lg">{account.icon}</span>
                ) : (
                  (() => {
                    const IconComponent = ACCOUNT_TYPE_ICONS[account.type];
                    const iconColor = ACCOUNT_TYPE_COLORS[account.type];
                    return <IconComponent className={clsx('w-5 h-5', iconColor)} />;
                  })()
                )}
                <span className="font-medium">{account.name}</span>
              </div>
              <span
                className={clsx(
                  'font-medium',
                  account.balance >= 0 ? 'text-ctp-green' : 'text-ctp-red'
                )}
              >
                {formatCurrency(account.balance, account.currency)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-ctp-surface1 flex justify-between">
          <span className="font-medium">Total</span>
          <span className="font-bold">{formatCurrency(totalBalance)}</span>
        </div>

        {showForm && (
          <AccountForm
            workspaceId={workspaceId}
            onClose={() => setShowForm(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comptes</h1>
          <p className="text-ctp-subtext0">
            {accounts?.length ?? 0} compte{(accounts?.length ?? 0) > 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + Nouveau compte
        </button>
      </div>

      {/* Total Balance Card */}
      <div className="card bg-gradient-to-r from-ctp-blue to-ctp-sapphire">
        <p className="text-ctp-crust/70">Solde total</p>
        <p className={clsx('text-3xl font-bold mt-1', totalBalance >= 0 ? 'text-ctp-crust' : 'text-ctp-red')}>{formatCurrency(totalBalance)}</p>
      </div>

      {/* Account Groups */}
      {Object.entries(groupedAccounts).map(([type, typeAccounts]) => {
        const IconComponent = ACCOUNT_TYPE_ICONS[type as Account['type']];
        const iconColor = ACCOUNT_TYPE_COLORS[type as Account['type']];
        return (
        <div key={type}>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-ctp-text">
            <IconComponent className={clsx('w-5 h-5', iconColor)} />
            {ACCOUNT_TYPE_LABELS[type as Account['type']]}
          </h2>
          <div className="space-y-2">
            {typeAccounts.map((account) => (
              <div
                key={account.id}
                onClick={() => setSelectedAccount(account)}
                className="card flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={clsx(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      !account.color && 'bg-ctp-surface1'
                    )}
                    style={account.color ? { backgroundColor: account.color } : undefined}
                  >
                    {account.icon ? (
                      <span className="text-lg">{account.icon}</span>
                    ) : (
                      (() => {
                        const AcctIcon = ACCOUNT_TYPE_ICONS[account.type];
                        const acctIconColor = ACCOUNT_TYPE_COLORS[account.type];
                        return <AcctIcon className={clsx('w-5 h-5', acctIconColor)} />;
                      })()
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-sm text-ctp-subtext0">
                      {account.transactionCount} transaction
                      {account.transactionCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <span
                  className={clsx(
                    'text-lg font-bold',
                    account.balance >= 0
                      ? 'text-ctp-green'
                      : 'text-ctp-red'
                  )}
                >
                  {formatCurrency(account.balance, account.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );})}

      {/* Empty State */}
      {(accounts?.length ?? 0) === 0 && (
        <div className="card text-center py-12">
          <p className="text-ctp-overlay1 text-lg mb-4">Aucun compte</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            Créer votre premier compte
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <AccountForm
          workspaceId={workspaceId}
          account={selectedAccount ?? undefined}
          onClose={() => {
            setShowForm(false);
            setSelectedAccount(null);
          }}
        />
      )}
    </div>
  );
}

export default AccountList;
