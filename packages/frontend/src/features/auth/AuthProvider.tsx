// ============================================================================
// AUTH CONTEXT PROVIDER - Finance Hub
// ============================================================================

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  setTokens,
  clearTokens,
  loadRefreshToken,
  getAccessToken,
  api,
} from '@/lib/api/client';
import type { User, MFAType } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLocked: boolean;
}

interface LoginResult {
  requiresMfa: boolean;
  mfaMethods?: MFAType[];
  tempToken?: string;
}

interface AuthContextValue extends AuthState {
  login: (
    email: string,
    password: string,
    deviceFingerprint: string,
    deviceName: string
  ) => Promise<LoginResult>;
  verifyMfa: (tempToken: string, code: string, type: MFAType) => Promise<void>;
  logout: () => Promise<void>;
  lock: () => void;
  unlock: (password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

// ----------------------------------------------------------------------------
// Context
// ----------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

// ----------------------------------------------------------------------------
// Provider
// ----------------------------------------------------------------------------

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    isLocked: false,
  });

  // Initialize auth state on mount
  useEffect(() => {
    async function initAuth() {
      loadRefreshToken();
      const token = getAccessToken();

      if (!token) {
        // Try to get token from stored refresh token
        try {
          await refreshUser();
        } catch {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } else {
        await refreshUser();
      }
    }

    void initAuth();
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      const user = await api.get<User>('/user/me');
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        isLocked: false,
      });
    } catch {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isLocked: false,
      });
    }
  }, []);

  // Login
  const login = useCallback(
    async (
      email: string,
      password: string,
      deviceFingerprint: string,
      deviceName: string
    ): Promise<LoginResult> => {
      const response = await api.post<{
        requiresMfa: boolean;
        mfaMethods?: MFAType[];
        tempToken?: string;
        accessToken?: string;
        refreshToken?: string;
      }>('/auth/login', {
        email,
        password,
        deviceFingerprint,
        deviceName,
      });

      if (response.requiresMfa) {
        return {
          requiresMfa: true,
          mfaMethods: response.mfaMethods,
          tempToken: response.tempToken,
        };
      }

      // No MFA required, set tokens
      if (response.accessToken && response.refreshToken) {
        setTokens(response.accessToken, response.refreshToken);
        await refreshUser();
      }

      return { requiresMfa: false };
    },
    [refreshUser]
  );

  // Verify MFA
  const verifyMfa = useCallback(
    async (tempToken: string, code: string, type: MFAType) => {
      const response = await api.post<{
        accessToken: string;
        refreshToken: string;
      }>('/auth/mfa/verify', {
        tempToken,
        code,
        type,
      });

      setTokens(response.accessToken, response.refreshToken);
      await refreshUser();
    },
    [refreshUser]
  );

  // Logout
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors
    }
    clearTokens();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isLocked: false,
    });
  }, []);

  // Lock session
  const lock = useCallback(() => {
    setState((prev) => ({ ...prev, isLocked: true }));
    void api.post('/auth/lock').catch(() => {
      // Ignore lock errors
    });
  }, []);

  // Unlock session
  const unlock = useCallback(async (password: string) => {
    await api.post('/auth/unlock', { password });
    setState((prev) => ({ ...prev, isLocked: false }));
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    verifyMfa,
    logout,
    lock,
    unlock,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
