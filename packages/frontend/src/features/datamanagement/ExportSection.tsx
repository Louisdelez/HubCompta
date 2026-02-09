// ============================================================================
// EXPORT SECTION - Finance Hub
// Export options and history section
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  Landmark,
  FolderOpen,
  Tags,
  Target,
  Settings2,
  RefreshCw,
  HardDrive,
  FileDown,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { ExportModal } from './ExportModal';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ExportSectionProps {
  workspaceId: string;
}

type ExportEntityType =
  | 'transactions'
  | 'accounts'
  | 'categories'
  | 'tags'
  | 'budgets'
  | 'rules'
  | 'recurrences'
  | 'backup';

interface ExportHistory {
  id: string;
  type: string;
  format: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
  error?: string;
}

const entityTypes: {
  id: ExportEntityType;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
}[] = [
  {
    id: 'transactions',
    label: 'Transactions',
    description: 'Toutes vos operations financieres',
    icon: CreditCard,
    color: 'ctp-blue',
  },
  {
    id: 'accounts',
    label: 'Comptes',
    description: 'Comptes bancaires et soldes',
    icon: Landmark,
    color: 'ctp-green',
  },
  {
    id: 'categories',
    label: 'Categories',
    description: 'Categories de revenus et depenses',
    icon: FolderOpen,
    color: 'ctp-mauve',
  },
  {
    id: 'tags',
    label: 'Tags',
    description: 'Etiquettes personnalisees',
    icon: Tags,
    color: 'ctp-pink',
  },
  {
    id: 'budgets',
    label: 'Budgets',
    description: 'Objectifs et limites budgetaires',
    icon: Target,
    color: 'ctp-yellow',
  },
  {
    id: 'rules',
    label: 'Regles',
    description: 'Regles de categorisation automatique',
    icon: Settings2,
    color: 'ctp-teal',
  },
  {
    id: 'recurrences',
    label: 'Recurrences',
    description: 'Transactions recurrentes',
    icon: RefreshCw,
    color: 'ctp-peach',
  },
  {
    id: 'backup',
    label: 'Sauvegarde complete',
    description: 'Export de toutes les donnees',
    icon: HardDrive,
    color: 'ctp-lavender',
  },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ExportSection({ workspaceId }: ExportSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntityType, setSelectedEntityType] = useState<ExportEntityType>('transactions');

  // Fetch export history (mock for now, will be connected to backend)
  const { data: exportHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['export-history', workspaceId],
    queryFn: async () => {
      // This would normally fetch from the API
      // For now, return empty array as history feature needs backend support
      return [] as ExportHistory[];
    },
    enabled: !!workspaceId,
  });

  const handleExportClick = (entityType: ExportEntityType) => {
    setSelectedEntityType(entityType);
    setIsModalOpen(true);
  };

  const getStatusIcon = (status: ExportHistory['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-ctp-green" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-ctp-red" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-ctp-blue animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-ctp-subtext0" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Export Options Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4 text-ctp-text">
          Que souhaitez-vous exporter ?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {entityTypes.map((entity) => {
            const Icon = entity.icon;
            return (
              <button
                key={entity.id}
                onClick={() => handleExportClick(entity.id)}
                className="p-4 bg-ctp-base rounded-xl border border-ctp-surface1 text-left hover:border-ctp-blue transition-all hover:shadow-lg group"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={clsx(
                      'p-2.5 rounded-lg transition-colors',
                      `bg-${entity.color}/20 group-hover:bg-${entity.color}/30`
                    )}
                    style={{
                      backgroundColor: `var(--ctp-${entity.color.replace('ctp-', '')})`,
                      opacity: 0.15,
                    }}
                  >
                    <Icon
                      className="w-5 h-5"
                      style={{ color: `var(--ctp-${entity.color.replace('ctp-', '')})` }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-ctp-text">{entity.label}</h3>
                    <p className="text-xs text-ctp-subtext0 mt-0.5 line-clamp-2">
                      {entity.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-ctp-surface0 rounded-xl p-4">
        <h3 className="font-medium mb-3 text-ctp-text">Actions rapides</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleExportClick('backup')}
            className="btn-primary inline-flex items-center gap-2"
          >
            <HardDrive className="w-4 h-4" />
            Sauvegarde complete
          </button>
          <button
            onClick={() => handleExportClick('transactions')}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            Exporter les transactions
          </button>
        </div>
      </div>

      {/* Export History */}
      <div>
        <h2 className="text-lg font-semibold mb-4 text-ctp-text">
          Historique des exports
        </h2>

        {historyLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-ctp-blue" />
          </div>
        ) : exportHistory && exportHistory.length > 0 ? (
          <div className="bg-ctp-base rounded-xl border border-ctp-surface1 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ctp-surface1">
                  <th className="text-left p-4 text-sm font-medium text-ctp-subtext0">
                    Type
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-ctp-subtext0">
                    Format
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-ctp-subtext0">
                    Statut
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-ctp-subtext0">
                    Date
                  </th>
                  <th className="text-right p-4 text-sm font-medium text-ctp-subtext0">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {exportHistory.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-ctp-surface0 last:border-0"
                  >
                    <td className="p-4 text-sm text-ctp-text">{item.type}</td>
                    <td className="p-4 text-sm text-ctp-text uppercase">
                      {item.format}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.status)}
                        <span className="text-sm text-ctp-text capitalize">
                          {item.status}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-ctp-subtext0">
                      {new Date(item.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-4 text-right">
                      {item.status === 'completed' && item.downloadUrl && (
                        <a
                          href={item.downloadUrl}
                          download
                          className="text-sm text-ctp-blue hover:underline"
                        >
                          Telecharger
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 bg-ctp-base rounded-xl border border-ctp-surface1">
            <FileDown className="w-12 h-12 mx-auto mb-3 text-ctp-overlay1" />
            <p className="text-ctp-subtext0">Aucun export recent</p>
            <p className="text-sm text-ctp-overlay0 mt-1">
              Vos exports precedents apparaitront ici
            </p>
          </div>
        )}
      </div>

      {/* Export Modal */}
      <ExportModal
        workspaceId={workspaceId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        entityType={selectedEntityType}
      />
    </div>
  );
}

export default ExportSection;
