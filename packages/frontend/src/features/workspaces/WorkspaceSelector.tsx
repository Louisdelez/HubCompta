// ============================================================================
// WORKSPACE SELECTOR - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, Users, Home, Building2, Folder, Plus } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'family' | 'flatshare' | 'company';
  role: string;
  memberCount: number;
}

interface WorkspaceSelectorProps {
  currentWorkspaceId?: string | undefined;
  onSelect: (workspace: Workspace) => void;
  onCreateNew: () => void;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const WORKSPACE_ICONS: Record<Workspace['type'], typeof User> = {
  personal: User,
  family: Users,
  flatshare: Home,
  company: Building2,
};

const WORKSPACE_LABELS: Record<Workspace['type'], string> = {
  personal: 'Personnel',
  family: 'Famille',
  flatshare: 'Colocation',
  company: 'Entreprise',
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function WorkspaceSelector({
  currentWorkspaceId,
  onSelect,
  onCreateNew,
}: WorkspaceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get<Workspace[]>('/workspaces'),
  });

  const currentWorkspace = workspaces?.find((w) => w.id === currentWorkspaceId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 w-full"
      >
        {currentWorkspace ? (
          (() => {
            const IconComponent = WORKSPACE_ICONS[currentWorkspace.type];
            return <IconComponent className="w-5 h-5" />;
          })()
        ) : (
          <Folder className="w-5 h-5" />
        )}
        <span className="flex-1 text-left truncate">
          {isLoading
            ? 'Chargement...'
            : currentWorkspace?.name ?? 'Sélectionner un espace'}
        </span>
        <svg
          className={clsx(
            'w-4 h-4 transition-transform',
            isOpen && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 max-h-64 overflow-auto">
            {workspaces?.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => {
                  onSelect(workspace);
                  setIsOpen(false);
                }}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700',
                  workspace.id === currentWorkspaceId &&
                    'bg-primary-50 dark:bg-primary-900/20'
                )}
              >
                {(() => {
                  const IconComponent = WORKSPACE_ICONS[workspace.type];
                  return <IconComponent className="w-5 h-5" />;
                })()}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{workspace.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {WORKSPACE_LABELS[workspace.type]} • {workspace.memberCount} membre
                    {workspace.memberCount > 1 ? 's' : ''}
                  </p>
                </div>
                {workspace.id === currentWorkspaceId && (
                  <svg
                    className="w-4 h-4 text-primary-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}

            <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
              <button
                onClick={() => {
                  onCreateNew();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-primary-600 dark:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Plus className="w-5 h-5" />
                <span>Créer un espace</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default WorkspaceSelector;
