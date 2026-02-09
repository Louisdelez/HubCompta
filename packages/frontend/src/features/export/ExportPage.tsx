// ============================================================================
// EXPORT PAGE - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { CreditCard, Landmark, BarChart3, HardDrive } from 'lucide-react';
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
      <div className="p-6 text-center text-ctp-subtext0">
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
        <p className="text-ctp-subtext0 mt-1">
          Exportez vos données ou créez une sauvegarde complète
        </p>
      </div>

      {/* Quick Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Export Transactions */}
        <button
          onClick={() => openExport('transactions')}
          className="p-4 bg-ctp-base rounded-xl border border-ctp-surface1 text-left hover:border-ctp-blue transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-ctp-blue/20 rounded-lg">
              <CreditCard className="w-6 h-6 text-ctp-blue" />
            </div>
            <div>
              <h3 className="font-medium">Exporter les transactions</h3>
              <p className="text-sm text-ctp-subtext0">CSV, JSON avec filtres par date et compte</p>
            </div>
          </div>
        </button>

        {/* Export Accounts */}
        <button
          onClick={() => openExport('accounts')}
          className="p-4 bg-ctp-base rounded-xl border border-ctp-surface1 text-left hover:border-ctp-blue transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-ctp-green/20 rounded-lg">
              <Landmark className="w-6 h-6 text-ctp-green" />
            </div>
            <div>
              <h3 className="font-medium">Exporter les comptes</h3>
              <p className="text-sm text-ctp-subtext0">Liste des comptes avec soldes</p>
            </div>
          </div>
        </button>

        {/* Generate Report */}
        <button
          onClick={() => openExport('report')}
          className="p-4 bg-ctp-base rounded-xl border border-ctp-surface1 text-left hover:border-ctp-blue transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-ctp-mauve/20 rounded-lg">
              <BarChart3 className="w-6 h-6 text-ctp-mauve" />
            </div>
            <div>
              <h3 className="font-medium">Générer un rapport</h3>
              <p className="text-sm text-ctp-subtext0">Rapport mensuel, annuel ou par catégorie</p>
            </div>
          </div>
        </button>

        {/* Quick Backup */}
        <button
          onClick={() => openExport('backup')}
          className="p-4 bg-ctp-base rounded-xl border border-ctp-surface1 text-left hover:border-ctp-blue transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-ctp-peach/20 rounded-lg">
              <HardDrive className="w-6 h-6 text-ctp-peach" />
            </div>
            <div>
              <h3 className="font-medium">Sauvegarde rapide</h3>
              <p className="text-sm text-ctp-subtext0">Télécharger toutes vos données en JSON</p>
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
