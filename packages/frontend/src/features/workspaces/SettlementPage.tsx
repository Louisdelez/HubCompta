// ============================================================================
// SETTLEMENT PAGE - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { BalanceChart } from './BalanceChart';
import { TransferSuggestions } from './TransferSuggestions';

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

interface Transfer {
  from: { id: string; name: string };
  to: { id: string; name: string };
  amount: number;
}

interface SettlementData {
  workspaceId: string;
  workspaceName: string;
  period: {
    startDate: string;
    endDate: string;
  };
  totalExpenses: number;
  memberCount: number;
  fairSharePerMember: number;
  balances: MemberBalance[];
  suggestedTransfers: Transfer[];
  currency: string;
}

interface ExpenseBreakdown {
  categoryId: string | null;
  categoryName: string;
  amount: number;
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SettlementPage() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Parse selected month to dates
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

  // Fetch settlement data
  const { data: settlement, isLoading } = useQuery({
    queryKey: ['settlement', workspaceId, selectedMonth],
    queryFn: () =>
      api.get<{ data: SettlementData }>(
        `/workspaces/${workspaceId}/settlement?startDate=${startDate}&endDate=${endDate}`
      ).then((res) => res.data),
    enabled: !!workspaceId,
  });

  // Fetch expense breakdown
  const { data: breakdown } = useQuery({
    queryKey: ['settlement-breakdown', workspaceId, selectedMonth],
    queryFn: () =>
      api.get<{ data: ExpenseBreakdown[] }>(
        `/workspaces/${workspaceId}/settlement/breakdown?startDate=${startDate}&endDate=${endDate}`
      ).then((res) => res.data),
    enabled: !!workspaceId,
  });

  if (!workspaceId) {
    return (
      <div className="p-6 text-center text-gray-500">
        Sélectionnez un espace de travail
      </div>
    );
  }

  // Generate month options (last 12 months)
  const monthOptions: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    monthOptions.push({ value, label });
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Équilibre des comptes</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Qui doit quoi à qui ?
          </p>
        </div>

        {/* Month Selector */}
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="input w-auto"
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {settlement ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="card text-center">
              <p className="text-3xl font-bold">
                {formatCurrency(settlement.totalExpenses, settlement.currency)}
              </p>
              <p className="text-sm text-gray-500">Dépenses totales</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold">{settlement.memberCount}</p>
              <p className="text-sm text-gray-500">Colocataires</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-primary-600">
                {formatCurrency(settlement.fairSharePerMember, settlement.currency)}
              </p>
              <p className="text-sm text-gray-500">Part équitable</p>
            </div>
          </div>

          {/* Period Info */}
          <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📅</span>
              <p className="text-blue-800 dark:text-blue-200">
                Période: {formatDate(settlement.period.startDate)} au{' '}
                {formatDate(settlement.period.endDate)}
              </p>
            </div>
          </div>

          {/* Balance Visualization */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <BalanceChart balances={settlement.balances} currency={settlement.currency} />

            {/* Expense Breakdown */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Répartition des dépenses</h2>
              {breakdown && breakdown.length > 0 ? (
                <div className="space-y-3">
                  {breakdown.slice(0, 6).map((item, index) => {
                    const percent = settlement.totalExpenses > 0
                      ? Math.round((item.amount / settlement.totalExpenses) * 100)
                      : 0;
                    return (
                      <div key={index}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{item.categoryName}</span>
                          <span className="font-medium">
                            {formatCurrency(item.amount, settlement.currency)}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-500 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Aucune dépense</p>
              )}
            </div>
          </div>

          {/* Transfer Suggestions */}
          <TransferSuggestions
            transfers={settlement.suggestedTransfers}
            currency={settlement.currency}
          />
        </>
      ) : (
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">🏠</div>
          <h2 className="text-xl font-bold mb-2">Aucune donnée</h2>
          <p className="text-gray-500">
            Ajoutez des dépenses partagées pour voir l'équilibre
          </p>
        </div>
      )}
    </div>
  );
}

export default SettlementPage;
