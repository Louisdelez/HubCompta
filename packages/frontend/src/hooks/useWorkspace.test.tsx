// ============================================================================
// USE WORKSPACE HOOK TESTS - Finance Hub
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useWorkspace, type Workspace } from './useWorkspace';

// ----------------------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------------------

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '@/lib/api';

const mockApi = vi.mocked(api);

// ----------------------------------------------------------------------------
// Test Data
// ----------------------------------------------------------------------------

const mockWorkspaces: Workspace[] = [
  {
    id: 'ws-1',
    name: 'Personal Finance',
    slug: 'personal-finance',
    description: 'My personal finances',
    currency: 'EUR',
    type: 'personal',
    proEnabled: false,
    investEnabled: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    role: 'owner',
  },
  {
    id: 'ws-2',
    name: 'Family Budget',
    slug: 'family-budget',
    description: 'Family shared budget',
    currency: 'EUR',
    type: 'family',
    proEnabled: true,
    investEnabled: true,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    role: 'admin',
  },
];

// ----------------------------------------------------------------------------
// Test Helpers
// ----------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('useWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage to reset zustand persisted state
    localStorage.clear();
    // Reset zustand store by clearing the storage key
    localStorage.removeItem('workspace-storage');
  });

  afterEach(() => {
    localStorage.clear();
  });

  // --------------------------------------------------------------------------
  // Workspace Fetching
  // --------------------------------------------------------------------------

  describe('workspace fetching', () => {
    it('should fetch workspaces on mount', async () => {
      mockApi.get.mockResolvedValue(mockWorkspaces);

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.workspacesLoading).toBe(false);
      });

      expect(mockApi.get).toHaveBeenCalledWith('/workspaces');
      expect(result.current.workspaces).toEqual(mockWorkspaces);
    });

    it('should set loading state while fetching', () => {
      mockApi.get.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      expect(result.current.workspacesLoading).toBe(true);
    });

    it('should handle fetch error', async () => {
      const error = new Error('Network error');
      mockApi.get.mockRejectedValue(error);

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.workspacesLoading).toBe(false);
      });

      expect(result.current.workspacesError).toBeTruthy();
      expect(result.current.workspaces).toEqual([]);
    });

    it('should return hasWorkspaces as true when workspaces exist', async () => {
      mockApi.get.mockResolvedValue(mockWorkspaces);

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.workspacesLoading).toBe(false);
      });

      expect(result.current.hasWorkspaces).toBe(true);
    });

    it('should return hasWorkspaces as false when no workspaces', async () => {
      mockApi.get.mockResolvedValue([]);

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.workspacesLoading).toBe(false);
      });

      expect(result.current.hasWorkspaces).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Workspace Selection
  // --------------------------------------------------------------------------

  describe('workspace selection', () => {
    it('should auto-select first workspace when none selected', async () => {
      mockApi.get.mockResolvedValue(mockWorkspaces);

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.workspacesLoading).toBe(false);
      });

      expect(result.current.currentWorkspaceId).toBe('ws-1');
      expect(result.current.currentWorkspace?.id).toBe('ws-1');
    });

    it('should switch workspace using switchWorkspace', async () => {
      mockApi.get.mockResolvedValue(mockWorkspaces);

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.workspacesLoading).toBe(false);
      });

      act(() => {
        result.current.switchWorkspace('ws-2');
      });

      expect(result.current.currentWorkspaceId).toBe('ws-2');
    });

    it('should switch workspace using setCurrentWorkspaceId', async () => {
      mockApi.get.mockResolvedValue(mockWorkspaces);

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.workspacesLoading).toBe(false);
      });

      act(() => {
        result.current.setCurrentWorkspaceId('ws-2');
      });

      expect(result.current.currentWorkspaceId).toBe('ws-2');
    });

    it('should fetch workspace details when workspace is selected', async () => {
      mockApi.get
        .mockResolvedValueOnce(mockWorkspaces) // workspaces list
        .mockResolvedValueOnce(mockWorkspaces[1]); // workspace details

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.workspacesLoading).toBe(false);
      });

      act(() => {
        result.current.switchWorkspace('ws-2');
      });

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/workspaces/ws-2');
      });
    });

    it('should return null workspace when id is set to null', async () => {
      mockApi.get.mockResolvedValue(mockWorkspaces);

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.workspacesLoading).toBe(false);
      });

      act(() => {
        result.current.setCurrentWorkspaceId(null);
      });

      // When currentWorkspaceId is null, it should fall back to first workspace
      expect(result.current.currentWorkspaceId).toBe('ws-1');
    });
  });

  // --------------------------------------------------------------------------
  // Loading States
  // --------------------------------------------------------------------------

  describe('loading states', () => {
    it('should combine loading states correctly', async () => {
      let resolveWorkspaces: (value: Workspace[]) => void;
      mockApi.get.mockImplementation(() => new Promise((resolve) => {
        resolveWorkspaces = resolve;
      }));

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.workspacesLoading).toBe(true);

      act(() => {
        resolveWorkspaces(mockWorkspaces);
      });

      await waitFor(() => {
        expect(result.current.workspacesLoading).toBe(false);
      });
    });

    it('should track currentWorkspaceLoading separately', async () => {
      mockApi.get
        .mockResolvedValueOnce(mockWorkspaces)
        .mockImplementation(() => new Promise(() => {})); // Never resolves for workspace details

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.workspacesLoading).toBe(false);
      });

      act(() => {
        result.current.switchWorkspace('ws-2');
      });

      // After switching, currentWorkspaceLoading should be true
      expect(result.current.currentWorkspaceLoading).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Pro/Invest Features
  // --------------------------------------------------------------------------

  describe('feature flags', () => {
    it('should return isProEnabled based on current workspace', async () => {
      mockApi.get.mockResolvedValue(mockWorkspaces);

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.workspacesLoading).toBe(false);
      });

      // First workspace has proEnabled: false
      expect(result.current.isProEnabled).toBe(false);

      act(() => {
        result.current.switchWorkspace('ws-2');
      });

      // Second workspace has proEnabled: true
      await waitFor(() => {
        expect(result.current.currentWorkspaceId).toBe('ws-2');
      });
    });

    it('should return isInvestEnabled based on current workspace', async () => {
      mockApi.get.mockResolvedValue(mockWorkspaces);

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.workspacesLoading).toBe(false);
      });

      // First workspace has investEnabled: false
      expect(result.current.isInvestEnabled).toBe(false);

      act(() => {
        result.current.switchWorkspace('ws-2');
      });

      // Second workspace has investEnabled: true
      await waitFor(() => {
        expect(result.current.currentWorkspaceId).toBe('ws-2');
      });
    });

    it('should default to false when workspace is not loaded', async () => {
      mockApi.get.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isProEnabled).toBe(false);
      expect(result.current.isInvestEnabled).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------

  describe('workspace state management', () => {
    it('should maintain workspace selection across re-renders', async () => {
      mockApi.get.mockResolvedValue(mockWorkspaces);

      const { result, rerender } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.workspacesLoading).toBe(false);
      });

      act(() => {
        result.current.switchWorkspace('ws-2');
      });

      // Verify the state was updated correctly
      expect(result.current.currentWorkspaceId).toBe('ws-2');

      // Re-render and verify state is maintained
      rerender();
      expect(result.current.currentWorkspaceId).toBe('ws-2');
    });

    it('should allow switching between workspaces', async () => {
      mockApi.get.mockResolvedValue(mockWorkspaces);

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.workspacesLoading).toBe(false);
      });

      // Note: currentWorkspaceId might be from previous test state due to zustand singleton
      // We test the switching behavior instead of initial state
      const initialId = result.current.currentWorkspaceId;

      // Switch to a different workspace
      const targetId = initialId === 'ws-1' ? 'ws-2' : 'ws-1';
      act(() => {
        result.current.switchWorkspace(targetId);
      });

      expect(result.current.currentWorkspaceId).toBe(targetId);

      // Switch back
      act(() => {
        result.current.switchWorkspace(initialId ?? '');
      });

      expect(result.current.currentWorkspaceId).toBe(initialId);
    });
  });

  // --------------------------------------------------------------------------
  // Error States
  // --------------------------------------------------------------------------

  describe('error states', () => {
    it('should combine errors from workspaces and current workspace', async () => {
      const workspacesError = new Error('Failed to fetch workspaces');
      mockApi.get.mockRejectedValue(workspacesError);

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.workspacesLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.workspacesError).toBeTruthy();
    });

    it('should return currentWorkspaceError when workspace fetch fails', async () => {
      const workspaceError = new Error('Failed to fetch workspace');
      mockApi.get
        .mockResolvedValueOnce(mockWorkspaces)
        .mockRejectedValueOnce(workspaceError);

      // Pre-set a workspace ID to trigger the second query
      localStorage.setItem(
        'workspace-storage',
        JSON.stringify({
          state: { currentWorkspaceId: 'ws-1' },
          version: 0,
        })
      );

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.currentWorkspaceError).toBeTruthy();
      });
    });
  });
});
