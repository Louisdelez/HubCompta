// ============================================================================
// IMPORT PAGE - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { ImportWizard } from './ImportWizard';
import { useWorkspace } from '@/hooks/useWorkspace';

export function ImportPage() {
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ctp-text">
          Import
        </h1>
        <p className="text-ctp-subtext0 mt-1">
          Importez vos transactions depuis un fichier CSV ou OFX
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}

export default ImportPage;
