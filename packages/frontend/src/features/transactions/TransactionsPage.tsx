// ============================================================================
// TRANSACTIONS PAGE - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { TransactionList } from './TransactionList';
import { useWorkspace } from '@/hooks/useWorkspace';

export function TransactionsPage() {
  const { currentWorkspaceId } = useWorkspace();

  if (!currentWorkspaceId) {
    return (
      <div className="p-6">
        <p className="text-ctp-subtext0">
          Sélectionnez un espace de travail
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-ctp-base">
      <TransactionList />
    </div>
  );
}

export default TransactionsPage;
