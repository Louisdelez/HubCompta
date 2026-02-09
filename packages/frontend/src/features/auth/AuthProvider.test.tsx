// ============================================================================
// AUTH PROVIDER TESTS - Finance Hub
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './AuthProvider';

// ----------------------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------------------

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  loadRefreshToken: vi.fn(),
  getAccessToken: vi.fn(),
}));

// Get mocked functions
import { api, setTokens, clearTokens, loadRefreshToken, getAccessToken } from '@/lib/api/client';

const mockApi = vi.mocked(api);
const mockSetTokens = vi.mocked(setTokens);
const mockClearTokens = vi.mocked(clearTokens);
const mockLoadRefreshToken = vi.mocked(loadRefreshToken);
const mockGetAccessToken = vi.mocked(getAccessToken);

// ----------------------------------------------------------------------------
// Test Helpers
// ----------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

// Test component that exposes auth context
function AuthConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="is-authenticated">{auth.isAuthenticated.toString()}</span>
      <span data-testid="is-loading">{auth.isLoading.toString()}</span>
      <span data-testid="is-locked">{auth.isLocked.toString()}</span>
      <span data-testid="user-email">{auth.user?.email ?? 'none'}</span>
      <button
        onClick={() =>
          auth.login('test@example.com', 'password123', 'fingerprint', 'Test Device')
        }
        data-testid="login-btn"
      >
        Login
      </button>
      <button onClick={() => auth.logout()} data-testid="logout-btn">
        Logout
      </button>
      <button onClick={() => auth.lock()} data-testid="lock-btn">
        Lock
      </button>
      <button onClick={() => auth.unlock('password123')} data-testid="unlock-btn">
        Unlock
      </button>
      <button onClick={() => auth.refreshUser()} data-testid="refresh-btn">
        Refresh
      </button>
    </div>
  );
}

function renderWithProviders() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    </QueryClientProvider>
  );
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockReturnValue(null);
  });

  // --------------------------------------------------------------------------
  // Authentication State
  // --------------------------------------------------------------------------

  describe('authentication state', () => {
    it('should start with loading state', () => {
      mockApi.get.mockImplementation(() => new Promise(() => {})); // Never resolves
      renderWithProviders();

      expect(screen.getByTestId('is-loading').textContent).toBe('true');
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    });

    it('should set authenticated state when user is fetched successfully', async () => {
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };
      mockGetAccessToken.mockReturnValue('valid-token');
      mockApi.get.mockResolvedValueOnce(mockUser);

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      expect(screen.getByTestId('user-email').textContent).toBe('test@example.com');
    });

    it('should set unauthenticated state when user fetch fails', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Unauthorized'));

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
      expect(screen.getByTestId('user-email').textContent).toBe('none');
    });

    it('should load refresh token on mount', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('No user'));

      renderWithProviders();

      await waitFor(() => {
        expect(mockLoadRefreshToken).toHaveBeenCalled();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Login Flow
  // --------------------------------------------------------------------------

  describe('login flow', () => {
    it('should login successfully without MFA', async () => {
      const user = userEvent.setup();
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };

      mockApi.get.mockRejectedValueOnce(new Error('No user')); // Initial load
      mockApi.post.mockResolvedValueOnce({
        requiresMfa: false,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      mockApi.get.mockResolvedValueOnce(mockUser); // After login

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      await user.click(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(mockSetTokens).toHaveBeenCalledWith('access-token', 'refresh-token');
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });
    });

    it('should handle MFA required response', async () => {
      const user = userEvent.setup();

      mockApi.get.mockRejectedValueOnce(new Error('No user'));
      mockApi.post.mockResolvedValueOnce({
        requiresMfa: true,
        mfaMethods: ['totp', 'email'],
        tempToken: 'temp-token',
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      await user.click(screen.getByTestId('login-btn'));

      expect(mockSetTokens).not.toHaveBeenCalled();
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    });

    it('should call login endpoint with correct parameters', async () => {
      const user = userEvent.setup();

      mockApi.get.mockRejectedValueOnce(new Error('No user'));
      mockApi.post.mockResolvedValueOnce({
        requiresMfa: false,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      mockApi.get.mockResolvedValueOnce({ id: '1', email: 'test@example.com' });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      await user.click(screen.getByTestId('login-btn'));

      expect(mockApi.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
        deviceFingerprint: 'fingerprint',
        deviceName: 'Test Device',
      });
    });
  });

  // --------------------------------------------------------------------------
  // Logout Flow
  // --------------------------------------------------------------------------

  describe('logout flow', () => {
    it('should logout successfully', async () => {
      const user = userEvent.setup();
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };

      mockGetAccessToken.mockReturnValue('valid-token');
      mockApi.get.mockResolvedValueOnce(mockUser);
      mockApi.post.mockResolvedValueOnce({}); // Logout response

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });

      await user.click(screen.getByTestId('logout-btn'));

      await waitFor(() => {
        expect(mockClearTokens).toHaveBeenCalled();
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
      expect(screen.getByTestId('user-email').textContent).toBe('none');
    });

    it('should call logout endpoint', async () => {
      const user = userEvent.setup();
      const mockUser = { id: '1', email: 'test@example.com' };

      mockGetAccessToken.mockReturnValue('valid-token');
      mockApi.get.mockResolvedValueOnce(mockUser);
      mockApi.post.mockResolvedValueOnce({});

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });

      await user.click(screen.getByTestId('logout-btn'));

      expect(mockApi.post).toHaveBeenCalledWith('/auth/logout');
    });

    it('should clear tokens even if logout API call fails', async () => {
      const user = userEvent.setup();
      const mockUser = { id: '1', email: 'test@example.com' };

      mockGetAccessToken.mockReturnValue('valid-token');
      mockApi.get.mockResolvedValueOnce(mockUser);
      mockApi.post.mockRejectedValueOnce(new Error('Network error'));

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });

      await user.click(screen.getByTestId('logout-btn'));

      await waitFor(() => {
        expect(mockClearTokens).toHaveBeenCalled();
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    });
  });

  // --------------------------------------------------------------------------
  // Token Refresh
  // --------------------------------------------------------------------------

  describe('token refresh', () => {
    it('should refresh user data when refreshUser is called', async () => {
      const user = userEvent.setup();
      const initialUser = { id: '1', email: 'old@example.com' };
      const updatedUser = { id: '1', email: 'new@example.com' };

      mockGetAccessToken.mockReturnValue('valid-token');
      mockApi.get.mockResolvedValueOnce(initialUser);

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('user-email').textContent).toBe('old@example.com');
      });

      mockApi.get.mockResolvedValueOnce(updatedUser);
      await user.click(screen.getByTestId('refresh-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('user-email').textContent).toBe('new@example.com');
      });
    });

    it('should handle refresh failure gracefully', async () => {
      const user = userEvent.setup();
      const initialUser = { id: '1', email: 'test@example.com' };

      mockGetAccessToken.mockReturnValue('valid-token');
      mockApi.get.mockResolvedValueOnce(initialUser);

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });

      mockApi.get.mockRejectedValueOnce(new Error('Token expired'));
      await user.click(screen.getByTestId('refresh-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
      });
    });
  });

  // --------------------------------------------------------------------------
  // Lock/Unlock
  // --------------------------------------------------------------------------

  describe('lock and unlock', () => {
    it('should lock the session', async () => {
      const user = userEvent.setup();
      const mockUser = { id: '1', email: 'test@example.com' };

      mockGetAccessToken.mockReturnValue('valid-token');
      mockApi.get.mockResolvedValueOnce(mockUser);
      mockApi.post.mockResolvedValue({});

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });

      expect(screen.getByTestId('is-locked').textContent).toBe('false');

      await user.click(screen.getByTestId('lock-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-locked').textContent).toBe('true');
      });
    });

    it('should call lock API endpoint', async () => {
      const user = userEvent.setup();
      const mockUser = { id: '1', email: 'test@example.com' };

      mockGetAccessToken.mockReturnValue('valid-token');
      mockApi.get.mockResolvedValueOnce(mockUser);
      mockApi.post.mockResolvedValue({});

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });

      await user.click(screen.getByTestId('lock-btn'));

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/auth/lock');
      });
    });

    it('should unlock the session', async () => {
      const user = userEvent.setup();
      const mockUser = { id: '1', email: 'test@example.com' };

      mockGetAccessToken.mockReturnValue('valid-token');
      mockApi.get.mockResolvedValueOnce(mockUser);
      mockApi.post.mockResolvedValue({});

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });

      // Lock first
      await user.click(screen.getByTestId('lock-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-locked').textContent).toBe('true');
      });

      // Then unlock
      await user.click(screen.getByTestId('unlock-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('is-locked').textContent).toBe('false');
      });
    });

    it('should call unlock API with password', async () => {
      const user = userEvent.setup();
      const mockUser = { id: '1', email: 'test@example.com' };

      mockGetAccessToken.mockReturnValue('valid-token');
      mockApi.get.mockResolvedValueOnce(mockUser);
      mockApi.post.mockResolvedValue({});

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });

      await user.click(screen.getByTestId('unlock-btn'));

      expect(mockApi.post).toHaveBeenCalledWith('/auth/unlock', {
        password: 'password123',
      });
    });
  });

  // --------------------------------------------------------------------------
  // Error Handling
  // --------------------------------------------------------------------------

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<AuthConsumer />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleError.mockRestore();
    });
  });
});
