// ============================================================================
// API CLIENT - Finance Hub
// ============================================================================

/// <reference types="vite/client" />

import type { ApiError } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  workspaceId?: string;
}

// ----------------------------------------------------------------------------
// Token Management
// ----------------------------------------------------------------------------

let accessToken: string | null = null;
let refreshToken: string | null = null;
let tokenRefreshPromise: Promise<void> | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  // Store refresh token securely (httpOnly cookie is preferred, but for now localStorage)
  localStorage.setItem('refreshToken', refresh);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('refreshToken');
}

export function loadRefreshToken() {
  refreshToken = localStorage.getItem('refreshToken');
}

// ----------------------------------------------------------------------------
// Token Refresh
// ----------------------------------------------------------------------------

async function refreshAccessToken(): Promise<void> {
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearTokens();
    throw new Error('Token refresh failed');
  }

  const result = (await response.json()) as {
    success: boolean;
    data: {
      accessToken: string;
      refreshToken: string;
    };
  };

  if (!result.success || !result.data.accessToken || !result.data.refreshToken) {
    clearTokens();
    throw new Error('Token refresh failed');
  }

  setTokens(result.data.accessToken, result.data.refreshToken);
}

async function ensureValidToken(): Promise<void> {
  // If there's already a refresh in progress, wait for it
  if (tokenRefreshPromise) {
    await tokenRefreshPromise;
    return;
  }

  // If no access token but we have refresh token, try to refresh
  if (!accessToken && refreshToken) {
    tokenRefreshPromise = refreshAccessToken();
    try {
      await tokenRefreshPromise;
    } finally {
      tokenRefreshPromise = null;
    }
  }
}

// ----------------------------------------------------------------------------
// API Client
// ----------------------------------------------------------------------------

export class ApiClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, workspaceId, headers: customHeaders, ...fetchOptions } = options;

  // Ensure we have a valid token
  await ensureValidToken();

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  if (workspaceId) {
    headers['X-Workspace-Id'] = workspaceId;
  }

  // Make request
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  // Handle 401 - try token refresh once
  if (response.status === 401 && refreshToken && !(options.headers as Record<string, string> | undefined)?.['X-Retry-After-Refresh']) {
    try {
      // Use shared promise to prevent concurrent refreshes
      if (!tokenRefreshPromise) {
        tokenRefreshPromise = refreshAccessToken();
      }
      await tokenRefreshPromise;
      tokenRefreshPromise = null;
      // Retry the request with new token
      return request(endpoint, {
        ...options,
        headers: { ...customHeaders, 'X-Retry-After-Refresh': 'true' },
      });
    } catch {
      tokenRefreshPromise = null;
      clearTokens();
      window.location.href = '/login';
      throw new ApiClientError('Session expired', 'SESSION_EXPIRED', 401);
    }
  }

  // Parse response
  const data = (await response.json()) as ApiResult<T>;

  if (!response.ok || !data.success) {
    const error = (data as ApiErrorResponse).error;
    throw new ApiClientError(
      error.message,
      error.code,
      response.status,
      error.details
    );
  }

  return data.data;
}

// ----------------------------------------------------------------------------
// HTTP Method Helpers
// ----------------------------------------------------------------------------

export const api = {
  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'GET' });
  },

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'POST', body });
  },

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'PUT', body });
  },

  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'PATCH', body });
  },

  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'DELETE' });
  },
};

export default api;
