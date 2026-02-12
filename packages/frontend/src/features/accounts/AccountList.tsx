// ============================================================================
// ACCOUNT LIST - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Landmark, PiggyBank, Banknote, CreditCard, FileText, TrendingUp, ArrowRightLeft } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';
import { AccountForm } from './AccountForm';
import { CurrencyDisplay } from '@/features/currency';

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

interface PortfolioData {
  targetCurrency: string;
  totalBalance: number;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    originalBalance: number;
    originalCurrency: string;
    convertedBalance: number;
    exchangeRate: number;
    rateSource: string;
  }>;
}

// Currency display mode hook
function useCurrencyDisplayMode() {
  const [mode, setMode] = useState<'original' | 'converted'>(() => {
    return (localStorage.getItem('displayCurrencyMode') as 'original' | 'converted') ?? 'original';
  });
  const [displayCurrency, setDisplayCurrency] = useState(() => {
    return localStorage.getItem('displayCurrency') ?? 'EUR';
  });

  useEffect(() => {
    const handleModeChange = (e: CustomEvent<{ mode: string }>) => {
      setMode(e.detail.mode as 'original' | 'converted');
    };
    const handleCurrencyChange = (e: CustomEvent<{ currency: string }>) => {
      setDisplayCurrency(e.detail.currency);
    };

    window.addEventListener('currencyDisplayModeChanged', handleModeChange as EventListener);
    window.addEventListener('displayCurrencyChanged', handleCurrencyChange as EventListener);

    return () => {
      window.removeEventListener('currencyDisplayModeChanged', handleModeChange as EventListener);
      window.removeEventListener('displayCurrencyChanged', handleCurrencyChange as EventListener);
    };
  }, []);

  return { mode, displayCurrency };
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

// Account type labels are now handled via i18n in the component


// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AccountList({ workspaceId, compact = false }: AccountListProps) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const { mode, displayCurrency } = useCurrencyDisplayMode();

  // Account type labels using i18n
  const ACCOUNT_TYPE_LABELS: Record<Account['type'], string> = {
    checking: t('accounts.checking'),
    savings: t('accounts.savings'),
    cash: t('accounts.cash'),
    credit_card: t('accounts.creditCard'),
    loan: t('accounts.loan'),
    investment: t('accounts.investment'),
  };

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts', workspaceId],
    queryFn: () => api.get<Account[]>(`/workspaces/${workspaceId}/accounts`),
  });

  // Fetch portfolio data for conversions
  const { data: portfolio } = useQuery({
    queryKey: ['portfolio-currency', workspaceId, displayCurrency],
    queryFn: () => api.get<PortfolioData>(`/currencies/workspace/${workspaceId}/portfolio?currency=${displayCurrency}`),
    enabled: mode === 'converted',
  });

  // Map for quick lookup of converted balances
  const convertedBalances = new Map(
    portfolio?.accounts.map(a => [a.id, { converted: a.convertedBalance, rate: a.exchangeRate }]) ?? []
  );

  // Group accounts by type
  const groupedAccounts = (accounts ?? []).reduce((groups, account) => {
    if (!groups[account.type]) {
      groups[account.type] = [];
    }
    groups[account.type].push(account);
    return groups;
  }, {} as Record<Account['type'], Account[]>);

  const totalBalance = mode === 'converted' && portfolio
    ? portfolio.totalBalance
    : (accounts ?? [])
        .filter((a) => !a.isArchived)
        .reduce((sum, a) => sum + a.balance, 0);

  const totalCurrency = mode === 'converted' ? displayCurrency : 'EUR';

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
          <h3 className="text-lg font-semibold">{t('accounts.title')}</h3>
          <button
            onClick={() => setShowForm(true)}
            className="text-sm text-ctp-blue hover:underline"
          >
            + {t('accounts.addAccount')}
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
              <div className="text-right">
                <CurrencyDisplay
                  amount={account.balance}
                  currency={account.currency}
                  colorize
                  size="sm"
                />
                {mode === 'converted' && account.currency !== displayCurrency && convertedBalances.has(account.id) && (
                  <div className="flex items-center gap-1 text-xs text-ctp-subtext0">
                    <ArrowRightLeft className="w-3 h-3" />
                    <CurrencyDisplay
                      amount={convertedBalances.get(account.id)!.converted}
                      currency={displayCurrency}
                      size="sm"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-ctp-surface1 flex justify-between">
          <span className="font-medium">{t('accounts.totalBalance')}</span>
          <CurrencyDisplay
            amount={totalBalance}
            currency={totalCurrency}
            size="md"
            className="font-bold"
          />
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
          <h1 className="text-2xl font-bold">{t('accounts.title')}</h1>
          <p className="text-ctp-subtext0">
            {t('accounts.accountCount', { count: accounts?.length ?? 0 })}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + {t('accounts.newAccount')}
        </button>
      </div>

      {/* Total Balance Card */}
      <div className="card bg-gradient-to-r from-ctp-blue to-ctp-sapphire">
        <div className="flex items-center justify-between">
          <p className="text-ctp-crust/70">{t('accounts.totalBalance')}</p>
          {mode === 'converted' && (
            <span className="text-xs text-ctp-crust/50 bg-ctp-crust/10 px-2 py-0.5 rounded">
              {t('accounts.inCurrency', { currency: displayCurrency })}
            </span>
          )}
        </div>
        <CurrencyDisplay
          amount={totalBalance}
          currency={totalCurrency}
          size="xl"
          className={clsx('mt-1', totalBalance >= 0 ? 'text-ctp-crust' : 'text-ctp-red')}
        />
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
                      {t('accounts.transactionCount', { count: account.transactionCount })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <CurrencyDisplay
                    amount={account.balance}
                    currency={account.currency}
                    colorize
                    size="lg"
                  />
                  {mode === 'converted' && account.currency !== displayCurrency && convertedBalances.has(account.id) && (
                    <div className="flex items-center gap-1 text-xs text-ctp-subtext0 justify-end mt-0.5">
                      <ArrowRightLeft className="w-3 h-3" />
                      <CurrencyDisplay
                        amount={convertedBalances.get(account.id)!.converted}
                        currency={displayCurrency}
                        size="sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );})}

      {/* Empty State */}
      {(accounts?.length ?? 0) === 0 && (
        <div className="card text-center py-12">
          <p className="text-ctp-overlay1 text-lg mb-4">{t('accounts.noAccounts')}</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            {t('accounts.createFirstAccount')}
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
