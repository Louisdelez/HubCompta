// ============================================================================
// ACTIVITY PAGE COMPONENT - Finance Hub
// Full page view of workspace activity
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useParams } from 'react-router-dom';
import { Activity as ActivityIcon } from 'lucide-react';
import { useWorkspace } from '@/hooks';
import { ActivityFeed } from './ActivityFeed';

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ActivityPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { currentWorkspace } = useWorkspace();

  const effectiveWorkspaceId = workspaceId ?? currentWorkspace?.id;

  if (!effectiveWorkspaceId) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-ctp-subtext0">Selectionnez un workspace</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-ctp-surface1 bg-ctp-base">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-ctp-blue/20 rounded-lg">
            <ActivityIcon className="h-6 w-6 text-ctp-blue" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ctp-text">Activite</h1>
            <p className="text-sm text-ctp-subtext0">
              Historique des actions dans ce workspace
            </p>
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="flex-1 overflow-hidden">
        <ActivityFeed
          workspaceId={effectiveWorkspaceId}
          showFilters={true}
          pageSize={50}
        />
      </div>
    </div>
  );
}

export default ActivityPage;
