// ============================================================================
// DATA MANAGEMENT PAGE - Finance Hub
// Main page with tabs for Export and Import sections
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { ExportSection } from './ExportSection';
import { ImportSection } from './ImportSection';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type TabType = 'export' | 'import';

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function DataManagementPage() {
  const { currentWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<TabType>('export');

  if (!currentWorkspace) {
    return (
      <div className="p-6 text-center">
        <p className="text-ctp-subtext0">
          Selectionnez un espace de travail pour gerer vos donnees.
        </p>
      </div>
    );
  }

  const tabs = [
    { id: 'export' as const, label: 'Exporter', icon: Download },
    { id: 'import' as const, label: 'Importer', icon: Upload },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ctp-text">
          Gestion des donnees
        </h1>
        <p className="text-ctp-subtext0 mt-1">
          Exportez vos donnees ou importez de nouvelles transactions
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-ctp-surface0 rounded-lg w-fit mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-ctp-base text-ctp-text shadow-sm'
                : 'text-ctp-subtext0 hover:text-ctp-text'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {activeTab === 'export' && (
          <ExportSection workspaceId={currentWorkspace.id} />
        )}
        {activeTab === 'import' && (
          <ImportSection workspaceId={currentWorkspace.id} />
        )}
      </div>
    </div>
  );
}

export default DataManagementPage;
