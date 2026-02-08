// ============================================================================
// DASHBOARD PAGE - Finance Hub
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { MonthlySummary } from './MonthlySummary';
import { CategoryChart } from './CategoryChart';
import { AccountList } from '@/features/accounts/AccountList';
import { RecentTransactions } from './RecentTransactions';
import { BudgetAlerts } from './BudgetAlerts';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface DashboardData {
  period: {
    year: number;
    month: number;
  };
  flow: {
    income: number;
    expenses: number;
    net: number;
    savingsRate: number;
  };
  comparison: {
    incomeChange: number;
    expenseChange: number;
  };
  spendingByCategory: {
    categoryId: string | null;
    categoryName: string;
    total: number;
  }[];
  totalBalance: number;
  accountsCount: number;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function DashboardPage() {
  const { currentWorkspaceId: workspaceId } = useWorkspace();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary', workspaceId],
    queryFn: () => api.get<DashboardData>(`/workspaces/${workspaceId}/reports/summary`),
    enabled: !!workspaceId,
  });

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Sélectionnez un espace de travail
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Vue d'ensemble de vos finances
        </p>
      </div>

      {/* Monthly Summary Cards */}
      {summary && <MonthlySummary data={summary} />}

      {/* Charts & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending by Category */}
        {summary && (
          <CategoryChart
            categories={summary.spendingByCategory}
            title="Dépenses par catégorie"
          />
        )}

        {/* Budget Alerts */}
        <BudgetAlerts workspaceId={workspaceId} />
      </div>

      {/* Accounts */}
      <AccountList workspaceId={workspaceId} compact />

      {/* Recent Transactions */}
      <RecentTransactions workspaceId={workspaceId} />
    </div>
  );
}

export default DashboardPage;
