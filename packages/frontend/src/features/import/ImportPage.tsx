// ============================================================================
// IMPORT PAGE - Finance Hub
// ============================================================================

import { ImportWizard } from './ImportWizard';
import { useWorkspace } from '@/hooks/useWorkspace';

export function ImportPage() {
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Import
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Importez vos transactions depuis un fichier CSV ou OFX
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}

export default ImportPage;
