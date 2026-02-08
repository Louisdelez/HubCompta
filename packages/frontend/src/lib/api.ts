// ============================================================================
// API CLIENT - Finance Hub
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: ApiError;
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

// ----------------------------------------------------------------------------
// Token Management
// ----------------------------------------------------------------------------

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token) {
    localStorage.setItem('accessToken', token);
  } else {
    localStorage.removeItem('accessToken');
  }
}

export function getAccessToken(): string | null {
  if (!accessToken) {
    accessToken = localStorage.getItem('accessToken');
  }
  return accessToken;
}

// ----------------------------------------------------------------------------
// API Client
// ----------------------------------------------------------------------------

async function request<T>(
  method: string,
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  // Build URL with query params
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // Build headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers || {}),
  };

  const token = getAccessToken();
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  // Make request
  const response = await fetch(url, {
    ...fetchOptions,
    method,
    headers,
    credentials: 'include',
  });

  // Handle response
  if (!response.ok) {
    let errorMessage = 'Une erreur est survenue';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error?.message || errorData.message || errorMessage;
    } catch {
      // Ignore JSON parse errors
    }

    // Handle 401 - Unauthorized
    if (response.status === 401) {
      setAccessToken(null);
      window.location.href = '/login';
    }

    throw new Error(errorMessage);
  }

  // Parse JSON response
  const data = await response.json();
  return data as T;
}

// ----------------------------------------------------------------------------
// API Methods
// ----------------------------------------------------------------------------

export const api = {
  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>('GET', endpoint, options);
  },

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('POST', endpoint, {
      ...options,
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('PUT', endpoint, {
      ...options,
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('PATCH', endpoint, {
      ...options,
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>('DELETE', endpoint, options);
  },
};

export default api;
