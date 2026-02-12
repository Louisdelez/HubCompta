// ============================================================================
// IMPORT PAGE - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useTranslation } from 'react-i18next';
import { ImportWizard } from './ImportWizard';
import { useWorkspace } from '@/hooks/useWorkspace';

export function ImportPage() {
  const { t } = useTranslation();
  const { currentWorkspaceId } = useWorkspace();

  if (!currentWorkspaceId) {
    return (
      <div className="p-6">
        <p className="text-ctp-subtext0">
          {t('import.selectWorkspace')}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ctp-text">
          {t('import.title')}
        </h1>
        <p className="text-ctp-subtext0 mt-1">
          {t('import.description')}
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}

export default ImportPage;
