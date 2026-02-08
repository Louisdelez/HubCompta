// ============================================================================
// AUTH STORE - Finance Hub (Zustand)
// ============================================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  lastActivity: number;

  // Actions
  setUser: (user: User | null) => void;
  setAuthenticated: (value: boolean) => void;
  setLocked: (value: boolean) => void;
  updateLastActivity: () => void;
  reset: () => void;
}

// ----------------------------------------------------------------------------
// Initial State
// ----------------------------------------------------------------------------

const initialState = {
  user: null,
  isAuthenticated: false,
  isLocked: false,
  lastActivity: Date.now(),
};

// ----------------------------------------------------------------------------
// Store
// ----------------------------------------------------------------------------

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...initialState,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: user !== null,
        }),

      setAuthenticated: (value) =>
        set({
          isAuthenticated: value,
          isLocked: false,
        }),

      setLocked: (value) =>
        set({
          isLocked: value,
        }),

      updateLastActivity: () =>
        set({
          lastActivity: Date.now(),
        }),

      reset: () => set(initialState),
    }),
    {
      name: 'finance-hub-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        isLocked: state.isLocked,
        lastActivity: state.lastActivity,
      }),
    }
  )
);

// ----------------------------------------------------------------------------
// Selectors
// ----------------------------------------------------------------------------

export const selectUser = (state: AuthState) => state.user;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectIsLocked = (state: AuthState) => state.isLocked;
export const selectLastActivity = (state: AuthState) => state.lastActivity;

// ----------------------------------------------------------------------------
// Hooks
// ----------------------------------------------------------------------------

export function useUser() {
  return useAuthStore(selectUser);
}

export function useIsAuthenticated() {
  return useAuthStore(selectIsAuthenticated);
}

export function useIsLocked() {
  return useAuthStore(selectIsLocked);
}
