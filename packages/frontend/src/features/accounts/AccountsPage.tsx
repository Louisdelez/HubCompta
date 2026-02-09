// ============================================================================
// ACCOUNTS PAGE - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { AccountList } from './AccountList';
import { useWorkspace } from '@/hooks/useWorkspace';

export function AccountsPage() {
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ctp-text">
            Comptes
          </h1>
          <p className="text-ctp-subtext0 mt-1">
            Gérez vos comptes bancaires et portefeuilles
          </p>
        </div>
      </div>
      <AccountList workspaceId={currentWorkspaceId} />
    </div>
  );
}

export default AccountsPage;
