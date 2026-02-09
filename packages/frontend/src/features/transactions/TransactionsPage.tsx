// ============================================================================
// TRANSACTIONS PAGE - Finance Hub
// ============================================================================

import { TransactionList } from './TransactionList';
import { useWorkspace } from '@/hooks/useWorkspace';

export function TransactionsPage() {
  const { currentWorkspaceId } = useWorkspace();

  if (!currentWorkspaceId) {
    return (
      <div className="p-6">
        <p className="text-gray-600 dark:text-gray-400">
          Sélectionnez un espace de travail
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-gray-100">
            Transactions
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gérez vos revenus et dépenses
          </p>
        </div>
      </div>
      <TransactionList />
    </div>
  );
}

export default TransactionsPage;
