// ============================================================================
// USE WORKSPACE HOOK - Finance Hub
// ============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  currency: string;
  type: 'personal' | 'family' | 'business';
  proEnabled?: boolean;
  investEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
  role?: 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
}

interface WorkspaceState {
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (id: string | null) => void;
}

// ----------------------------------------------------------------------------
// Zustand Store
// ----------------------------------------------------------------------------

const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      currentWorkspaceId: null,
      setCurrentWorkspaceId: (id) => set({ currentWorkspaceId: id }),
    }),
    {
      name: 'workspace-storage',
    }
  )
);

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function useWorkspace() {
  const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspaceStore();

  // Fetch workspaces list
  const {
    data: workspaces,
    isLoading: workspacesLoading,
    error: workspacesError,
  } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      // api.get already returns unwrapped data
      return api.get<Workspace[]>('/workspaces');
    },
  });

  // Fetch current workspace details
  const {
    data: currentWorkspace,
    isLoading: currentWorkspaceLoading,
    error: currentWorkspaceError,
  } = useQuery({
    queryKey: ['workspace', currentWorkspaceId],
    queryFn: async () => {
      // api.get already returns unwrapped data
      return api.get<Workspace>(`/workspaces/${currentWorkspaceId}`);
    },
    enabled: !!currentWorkspaceId,
  });

  // Auto-select first workspace if none selected
  const effectiveWorkspaceId = currentWorkspaceId || workspaces?.[0]?.id;
  const effectiveWorkspace = currentWorkspaceId
    ? currentWorkspace
    : workspaces?.[0];

  return {
    // State
    currentWorkspace: effectiveWorkspace,
    currentWorkspaceId: effectiveWorkspaceId,
    workspaces: workspaces || [],

    // Loading states
    isLoading: workspacesLoading || currentWorkspaceLoading,
    workspacesLoading,
    currentWorkspaceLoading,

    // Errors
    error: workspacesError || currentWorkspaceError,
    workspacesError,
    currentWorkspaceError,

    // Actions
    setCurrentWorkspaceId,
    switchWorkspace: (id: string) => {
      setCurrentWorkspaceId(id);
    },

    // Helpers
    hasWorkspaces: (workspaces?.length || 0) > 0,
    isProEnabled: effectiveWorkspace?.proEnabled ?? false,
    isInvestEnabled: effectiveWorkspace?.investEnabled ?? false,
  };
}

export default useWorkspace;
