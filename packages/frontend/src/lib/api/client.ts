// ============================================================================
// API CLIENT - Finance Hub
// ============================================================================

/// <reference types="vite/client" />

import type { ApiError } from '@finance-hub/shared';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

/** Maximum number of retry attempts for rate limited requests */
const MAX_RETRY_ATTEMPTS = 3;

/** Base delay in milliseconds for exponential backoff */
const BASE_RETRY_DELAY_MS = 1000;

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError & {
    retryAfter?: number | string;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  workspaceId?: string;
  /** Number of retry attempts (internal use) */
  _retryAttempt?: number;
  /** Skip rate limit retry handling */
  skipRateLimitRetry?: boolean;
}

// ----------------------------------------------------------------------------
// Rate Limit Error
// ----------------------------------------------------------------------------

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number,
    public code: string = 'RATE_LIMIT_EXCEEDED'
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
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
    public details?: Record<string, unknown>,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * Calculate delay for exponential backoff with jitter
 */
function calculateBackoffDelay(attempt: number, retryAfter?: number): number {
  // If server provided a retry-after time, use it (with some buffer)
  if (retryAfter && retryAfter > 0) {
    return retryAfter * 1000 + Math.random() * 1000;
  }

  // Exponential backoff with jitter: base * 2^attempt + random jitter
  const exponentialDelay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse retry-after header value
 */
function parseRetryAfter(response: Response): number | undefined {
  const retryAfter = response.headers.get('Retry-After');
  if (!retryAfter) return undefined;

  // Try parsing as number (seconds)
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds;
  }

  // Try parsing as HTTP date
  const date = Date.parse(retryAfter);
  if (!isNaN(date)) {
    return Math.ceil((date - Date.now()) / 1000);
  }

  return undefined;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const {
    body,
    workspaceId,
    headers: customHeaders,
    _retryAttempt = 0,
    skipRateLimitRetry = false,
    ...fetchOptions
  } = options;

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

  // Handle 429 - Rate limit exceeded
  if (response.status === 429) {
    const retryAfter = parseRetryAfter(response);

    // Attempt retry with exponential backoff if allowed
    if (!skipRateLimitRetry && _retryAttempt < MAX_RETRY_ATTEMPTS) {
      const delay = calculateBackoffDelay(_retryAttempt, retryAfter);
      console.warn(
        `Rate limit exceeded. Retrying in ${Math.round(delay / 1000)}s (attempt ${_retryAttempt + 1}/${MAX_RETRY_ATTEMPTS})`
      );

      await sleep(delay);

      return request(endpoint, {
        ...options,
        _retryAttempt: _retryAttempt + 1,
      });
    }

    // Max retries exceeded or retry disabled - throw rate limit error
    let errorData: ApiErrorResponse | undefined;
    try {
      errorData = (await response.json()) as ApiErrorResponse;
    } catch {
      // Response might not be JSON
    }

    const message =
      errorData?.error?.message ||
      'Trop de requetes. Veuillez patienter avant de reessayer.';

    throw new RateLimitError(message, retryAfter || 60);
  }

  // Handle 401 - try token refresh once
  if (
    response.status === 401 &&
    refreshToken &&
    !(options.headers as Record<string, string> | undefined)?.[
      'X-Retry-After-Refresh'
    ]
  ) {
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
    const retryAfter =
      typeof error.retryAfter === 'string'
        ? parseInt(error.retryAfter, 10)
        : error.retryAfter;
    throw new ApiClientError(
      error.message,
      error.code,
      response.status,
      error.details,
      retryAfter
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
