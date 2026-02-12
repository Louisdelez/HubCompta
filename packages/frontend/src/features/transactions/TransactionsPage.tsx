// ============================================================================
// TRANSACTIONS PAGE - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useTranslation } from 'react-i18next';
import { TransactionList } from './TransactionList';
import { useWorkspace } from '@/hooks/useWorkspace';

export function TransactionsPage() {
  const { t } = useTranslation();
  const { currentWorkspaceId } = useWorkspace();

  if (!currentWorkspaceId) {
    return (
      <div className="p-6">
        <p className="text-ctp-subtext0">
          {t('transactions.selectWorkspace')}
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
