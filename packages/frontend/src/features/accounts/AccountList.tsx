// ============================================================================
// ACCOUNT LIST - Finance Hub
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
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
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
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            + Ajouter
          </button>
        </div>

        <div className="space-y-2">
          {(accounts ?? []).slice(0, 5).map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div className="flex items-center gap-2">
                {account.icon ? (
                  <span className="text-lg">{account.icon}</span>
                ) : (
                  (() => {
                    const IconComponent = ACCOUNT_TYPE_ICONS[account.type];
                    return <IconComponent className="w-5 h-5" />;
                  })()
                )}
                <span className="font-medium">{account.name}</span>
              </div>
              <span
                className={clsx(
                  'font-medium',
                  account.balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-danger-600'
                )}
              >
                {formatCurrency(account.balance, account.currency)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
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
          <p className="text-gray-600 dark:text-gray-400">
            {accounts?.length ?? 0} compte{(accounts?.length ?? 0) > 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + Nouveau compte
        </button>
      </div>

      {/* Total Balance Card */}
      <div className="card bg-gradient-to-r from-primary-500 to-primary-600 text-white">
        <p className="text-primary-100">Solde total</p>
        <p className="text-3xl font-bold mt-1">{formatCurrency(totalBalance)}</p>
      </div>

      {/* Account Groups */}
      {Object.entries(groupedAccounts).map(([type, typeAccounts]) => {
        const IconComponent = ACCOUNT_TYPE_ICONS[type as Account['type']];
        return (
        <div key={type}>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <IconComponent className="w-5 h-5" />
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
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: account.color ?? '#E5E7EB' }}
                  >
                    {account.icon ? (
                      <span className="text-lg">{account.icon}</span>
                    ) : (
                      (() => {
                        const AcctIcon = ACCOUNT_TYPE_ICONS[account.type];
                        return <AcctIcon className="w-5 h-5" />;
                      })()
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {account.transactionCount} transaction
                      {account.transactionCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <span
                  className={clsx(
                    'text-lg font-bold',
                    account.balance >= 0
                      ? 'text-gray-900 dark:text-white'
                      : 'text-danger-600'
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
          <p className="text-gray-400 text-lg mb-4">Aucun compte</p>
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
