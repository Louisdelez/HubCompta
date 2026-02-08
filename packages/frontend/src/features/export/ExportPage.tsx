// ============================================================================
// EXPORT PAGE - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { ExportDialog } from './ExportDialog';
import { BackupRestoreCard } from './BackupRestoreCard';

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ExportPage() {
  const { currentWorkspace } = useWorkspace();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportType, setExportType] = useState<'transactions' | 'accounts' | 'backup' | 'report'>('transactions');

  if (!currentWorkspace) {
    return (
      <div className="p-6 text-center text-gray-500">
        Sélectionnez un espace de travail
      </div>
    );
  }

  const openExport = (type: typeof exportType) => {
    setExportType(type);
    setIsExportOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Export & Sauvegarde</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Exportez vos données ou créez une sauvegarde complète
        </p>
      </div>

      {/* Quick Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Export Transactions */}
        <button
          onClick={() => openExport('transactions')}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-left hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <span className="text-2xl">💳</span>
            </div>
            <div>
              <h3 className="font-medium">Exporter les transactions</h3>
              <p className="text-sm text-gray-500">CSV, JSON avec filtres par date et compte</p>
            </div>
          </div>
        </button>

        {/* Export Accounts */}
        <button
          onClick={() => openExport('accounts')}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-left hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <span className="text-2xl">🏦</span>
            </div>
            <div>
              <h3 className="font-medium">Exporter les comptes</h3>
              <p className="text-sm text-gray-500">Liste des comptes avec soldes</p>
            </div>
          </div>
        </button>

        {/* Generate Report */}
        <button
          onClick={() => openExport('report')}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-left hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <span className="text-2xl">📊</span>
            </div>
            <div>
              <h3 className="font-medium">Générer un rapport</h3>
              <p className="text-sm text-gray-500">Rapport mensuel, annuel ou par catégorie</p>
            </div>
          </div>
        </button>

        {/* Quick Backup */}
        <button
          onClick={() => openExport('backup')}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-left hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <span className="text-2xl">💾</span>
            </div>
            <div>
              <h3 className="font-medium">Sauvegarde rapide</h3>
              <p className="text-sm text-gray-500">Télécharger toutes vos données en JSON</p>
            </div>
          </div>
        </button>
      </div>

      {/* Backup & Restore Card */}
      <BackupRestoreCard workspaceId={currentWorkspace.id} />

      {/* Export Dialog */}
      <ExportDialog
        workspaceId={currentWorkspace.id}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        initialType={exportType}
      />
    </div>
  );
}

export default ExportPage;
