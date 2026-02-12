// ============================================================================
// ACCOUNTS PAGE - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useTranslation } from 'react-i18next';
import { AccountList } from './AccountList';
import { useWorkspace } from '@/hooks/useWorkspace';

export function AccountsPage() {
  const { t } = useTranslation();
  const { currentWorkspaceId } = useWorkspace();

  if (!currentWorkspaceId) {
    return (
      <div className="p-6">
        <p className="text-ctp-subtext0">
          {t('accounts.selectWorkspace')}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ctp-text">
            {t('accounts.title')}
          </h1>
          <p className="text-ctp-subtext0 mt-1">
            {t('accounts.manageBankAccounts')}
          </p>
        </div>
      </div>
      <AccountList workspaceId={currentWorkspaceId} />
    </div>
  );
}

export default AccountsPage;
