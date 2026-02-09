// ============================================================================
// MULTI-CURRENCY SUMMARY - Finance Hub
// Display all currencies in a workspace with totals and conversions
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Coins, TrendingUp, ArrowRightLeft, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api/client';
import { CurrencyDisplay, formatCurrency } from './CurrencyDisplay';
import { CurrencySelector } from './CurrencySelector';
import { useState } from 'react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface CurrencySummary {
  defaultCurrency: string;
  totalInDefaultCurrency: number;
  currencies: Array<{
    currency: string;
    symbol: string;
    name: string;
    totalBalance: number;
    convertedBalance: number;
    exchangeRate: number | null;
    accountCount: number;
    accounts: Array<{
      id: string;
      name: string;
      balance: number;
    }>;
  }>;
}

interface MultiCurrencySummaryProps {
  workspaceId: string;
  targetCurrency?: string;
  onTargetCurrencyChange?: (currency: string) => void;
  showAccounts?: boolean;
  compact?: boolean;
  className?: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function MultiCurrencySummary({
  workspaceId,
  targetCurrency,
  onTargetCurrencyChange,
  showAccounts = true,
  compact = false,
  className = '',
}: MultiCurrencySummaryProps) {
  const [expandedCurrency, setExpandedCurrency] = useState<string | null>(null);
  const [internalTargetCurrency, setInternalTargetCurrency] = useState<string | null>(null);

  const effectiveTargetCurrency = targetCurrency ?? internalTargetCurrency;

  const { data: summary, isLoading, refetch } = useQuery({
    queryKey: ['currency-summary', workspaceId, effectiveTargetCurrency],
    queryFn: () => {
      const url = effectiveTargetCurrency
        ? `/currencies/workspace/${workspaceId}/summary?targetCurrency=${effectiveTargetCurrency}`
        : `/currencies/workspace/${workspaceId}/summary`;
      return api.get<CurrencySummary>(url);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleCurrencyChange = (currency: string) => {
    if (onTargetCurrencyChange) {
      onTargetCurrencyChange(currency);
    } else {
      setInternalTargetCurrency(currency);
    }
  };

  const toggleExpanded = (currency: string) => {
    setExpandedCurrency((prev) => (prev === currency ? null : currency));
  };

  // Calculate percentage distribution
  const percentages = useMemo(() => {
    if (!summary || summary.totalInDefaultCurrency === 0) return new Map();
    return new Map(
      summary.currencies.map((c) => [
        c.currency,
        (c.convertedBalance / summary.totalInDefaultCurrency) * 100,
      ])
    );
  }, [summary]);

  if (isLoading) {
    return (
      <div className={clsx('card', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-ctp-surface1 rounded w-1/3" />
          <div className="h-20 bg-ctp-surface1 rounded" />
          <div className="space-y-2">
            <div className="h-12 bg-ctp-surface1 rounded" />
            <div className="h-12 bg-ctp-surface1 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className={clsx('card', className)}>
        <p className="text-ctp-subtext0 text-center py-8">
          Aucune donnee disponible
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={clsx('card', className)}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-ctp-blue" />
            <h3 className="font-semibold">Multi-devises</h3>
          </div>
          <button
            onClick={() => void refetch()}
            className="p-1.5 rounded hover:bg-ctp-surface0 text-ctp-subtext0"
            title="Actualiser"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Currency selector */}
        <div className="mb-4">
          <CurrencySelector
            value={effectiveTargetCurrency ?? summary.defaultCurrency}
            onChange={handleCurrencyChange}
            className="w-full"
          />
        </div>

        {/* Total */}
        <div className="p-3 bg-ctp-surface0 rounded-lg mb-4">
          <p className="text-xs text-ctp-subtext0 mb-1">Total converti</p>
          <CurrencyDisplay
            amount={summary.totalInDefaultCurrency}
            currency={effectiveTargetCurrency ?? summary.defaultCurrency}
            size="lg"
            colorize
          />
        </div>

        {/* Currency breakdown - compact */}
        <div className="space-y-2">
          {summary.currencies.map((curr) => (
            <div
              key={curr.currency}
              className="flex items-center justify-between p-2 rounded hover:bg-ctp-surface0"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{curr.symbol}</span>
                <span className="text-sm font-medium">{curr.currency}</span>
              </div>
              <div className="text-right">
                <CurrencyDisplay
                  amount={curr.totalBalance}
                  currency={curr.currency}
                  size="sm"
                />
                {curr.exchangeRate && curr.exchangeRate !== 1 && (
                  <p className="text-xs text-ctp-subtext0">
                    {formatCurrency(curr.convertedBalance, effectiveTargetCurrency ?? summary.defaultCurrency, { compact: true })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-ctp-blue/20 flex items-center justify-center">
            <Coins className="w-5 h-5 text-ctp-blue" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Synthese multi-devises</h2>
            <p className="text-sm text-ctp-subtext0">
              {summary.currencies.length} devise{summary.currencies.length > 1 ? 's' : ''} active{summary.currencies.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => void refetch()}
          className="p-2 rounded-lg hover:bg-ctp-surface0 text-ctp-subtext0"
          title="Actualiser les taux"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Currency selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-ctp-subtext1 mb-2">
          Afficher en
        </label>
        <CurrencySelector
          value={effectiveTargetCurrency ?? summary.defaultCurrency}
          onChange={handleCurrencyChange}
          className="w-full max-w-xs"
        />
      </div>

      {/* Total card */}
      <div className="p-6 bg-gradient-to-r from-ctp-blue to-ctp-sapphire rounded-xl mb-6">
        <p className="text-ctp-crust/70 text-sm mb-1">Solde total</p>
        <CurrencyDisplay
          amount={summary.totalInDefaultCurrency}
          currency={effectiveTargetCurrency ?? summary.defaultCurrency}
          size="xl"
          className="text-ctp-crust"
        />
      </div>

      {/* Distribution bar */}
      {summary.currencies.length > 1 && (
        <div className="mb-6">
          <div className="flex h-3 rounded-full overflow-hidden bg-ctp-surface1">
            {summary.currencies.map((curr, index) => {
              const percent = percentages.get(curr.currency) ?? 0;
              const colors = [
                'bg-ctp-blue',
                'bg-ctp-green',
                'bg-ctp-mauve',
                'bg-ctp-peach',
                'bg-ctp-teal',
                'bg-ctp-pink',
                'bg-ctp-yellow',
                'bg-ctp-sapphire',
              ];
              return (
                <div
                  key={curr.currency}
                  className={clsx(colors[index % colors.length], 'transition-all')}
                  style={{ width: `${percent}%` }}
                  title={`${curr.currency}: ${percent.toFixed(1)}%`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {summary.currencies.map((curr, index) => {
              const percent = percentages.get(curr.currency) ?? 0;
              const colors = [
                'bg-ctp-blue',
                'bg-ctp-green',
                'bg-ctp-mauve',
                'bg-ctp-peach',
                'bg-ctp-teal',
                'bg-ctp-pink',
                'bg-ctp-yellow',
                'bg-ctp-sapphire',
              ];
              return (
                <div key={curr.currency} className="flex items-center gap-1.5 text-xs">
                  <div className={clsx('w-2 h-2 rounded-full', colors[index % colors.length])} />
                  <span className="text-ctp-subtext0">
                    {curr.currency} {percent.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Currency breakdown */}
      <div className="space-y-3">
        {summary.currencies.map((curr) => {
          const isExpanded = expandedCurrency === curr.currency;
          const percent = percentages.get(curr.currency) ?? 0;

          return (
            <div
              key={curr.currency}
              className="border border-ctp-surface1 rounded-xl overflow-hidden"
            >
              {/* Currency header */}
              <div
                className={clsx(
                  'flex items-center justify-between p-4 cursor-pointer hover:bg-ctp-surface0 transition-colors',
                  isExpanded && 'bg-ctp-surface0'
                )}
                onClick={() => showAccounts && toggleExpanded(curr.currency)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-ctp-surface1 flex items-center justify-center text-lg">
                    {curr.symbol}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{curr.currency}</span>
                      <span className="text-sm text-ctp-subtext0">{curr.name}</span>
                    </div>
                    <p className="text-sm text-ctp-subtext0">
                      {curr.accountCount} compte{curr.accountCount > 1 ? 's' : ''} - {percent.toFixed(1)}% du total
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <CurrencyDisplay
                      amount={curr.totalBalance}
                      currency={curr.currency}
                      size="lg"
                      colorize
                    />
                    {curr.exchangeRate && curr.exchangeRate !== 1 && (
                      <div className="flex items-center gap-1 justify-end text-xs text-ctp-subtext0">
                        <ArrowRightLeft className="w-3 h-3" />
                        {formatCurrency(curr.convertedBalance, effectiveTargetCurrency ?? summary.defaultCurrency)}
                      </div>
                    )}
                  </div>
                  {showAccounts && (
                    isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-ctp-subtext0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-ctp-subtext0" />
                    )
                  )}
                </div>
              </div>

              {/* Accounts list */}
              {showAccounts && isExpanded && curr.accounts.length > 0 && (
                <div className="border-t border-ctp-surface1 bg-ctp-mantle">
                  {curr.accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between px-4 py-3 border-b border-ctp-surface0 last:border-b-0"
                    >
                      <span className="text-sm">{account.name}</span>
                      <CurrencyDisplay
                        amount={account.balance}
                        currency={curr.currency}
                        size="sm"
                        colorize
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Exchange rate info */}
              {curr.exchangeRate && curr.exchangeRate !== 1 && (
                <div className="px-4 py-2 bg-ctp-mantle border-t border-ctp-surface1">
                  <div className="flex items-center gap-2 text-xs text-ctp-subtext0">
                    <TrendingUp className="w-3 h-3" />
                    <span>
                      1 {curr.currency} = {curr.exchangeRate.toFixed(4)} {effectiveTargetCurrency ?? summary.defaultCurrency}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MultiCurrencySummary;
