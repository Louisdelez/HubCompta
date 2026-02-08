// ============================================================================
// WORKSPACE STORE - Finance Hub (Zustand)
// ============================================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'family' | 'flatshare' | 'company';
  currency: string;
  role: string;
}

interface WorkspaceState {
  // State
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];

  // Actions
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;
  reset: () => void;
}

// ----------------------------------------------------------------------------
// Initial State
// ----------------------------------------------------------------------------

const initialState = {
  currentWorkspace: null,
  workspaces: [],
};

// ----------------------------------------------------------------------------
// Store
// ----------------------------------------------------------------------------

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentWorkspace: (workspace) =>
        set({ currentWorkspace: workspace }),

      setWorkspaces: (workspaces) =>
        set({ workspaces }),

      addWorkspace: (workspace) =>
        set((state) => ({
          workspaces: [...state.workspaces, workspace],
        })),

      updateWorkspace: (id, updates) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
          currentWorkspace:
            state.currentWorkspace?.id === id
              ? { ...state.currentWorkspace, ...updates }
              : state.currentWorkspace,
        })),

      removeWorkspace: (id) =>
        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== id),
          currentWorkspace:
            state.currentWorkspace?.id === id ? null : state.currentWorkspace,
        })),

      reset: () => set(initialState),
    }),
    {
      name: 'finance-hub-workspace',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentWorkspace: state.currentWorkspace
          ? { id: state.currentWorkspace.id }
          : null,
      }),
    }
  )
);

// ----------------------------------------------------------------------------
// Selectors
// ----------------------------------------------------------------------------

export const selectCurrentWorkspace = (state: WorkspaceState) =>
  state.currentWorkspace;

export const selectWorkspaces = (state: WorkspaceState) => state.workspaces;

export const selectCurrentWorkspaceId = (state: WorkspaceState) =>
  state.currentWorkspace?.id;

// ----------------------------------------------------------------------------
// Hooks
// ----------------------------------------------------------------------------

export function useCurrentWorkspace() {
  return useWorkspaceStore(selectCurrentWorkspace);
}

export function useWorkspaces() {
  return useWorkspaceStore(selectWorkspaces);
}

export function useCurrentWorkspaceId() {
  return useWorkspaceStore(selectCurrentWorkspaceId);
}
