import { ApiResponse, ApiErrorResponse, RefreshResponseData } from "@luggage-storage/contracts";
import { secureStorage } from "./secure-storage.service";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api/v1";

/**
 * Custom error class for Mobile API errors.
 */
export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown[];

  constructor(
    message: string,
    statusCode: number,
    code: string = "API_ERROR",
    details?: unknown[]
  ) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * In-memory storage for short-lived JWT access token.
 * NEVER persisted in AsyncStorage or ordinary files.
 */
let inMemoryAccessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function clearAccessToken(): void {
  inMemoryAccessToken = null;
}

/**
 * Singleton refresh mutex lock to prevent concurrent refresh races.
 */
let refreshPromise: Promise<string | null> | null = null;

type AuthFailureCallback = () => void;
let onAuthFailure: AuthFailureCallback | null = null;

export function setAuthFailureHandler(handler: AuthFailureCallback | null): void {
  onAuthFailure = handler;
}

/**
 * Rotates the refresh token using SecureStore and updates the in-memory access token.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const storedRefreshToken = await secureStorage.getRefreshToken();
      if (!storedRefreshToken) {
        clearAccessToken();
        if (onAuthFailure) {
          onAuthFailure();
        }
        return null;
      }

      const url = `${API_BASE}/auth/refresh`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          refreshToken: storedRefreshToken,
          clientType: "MOBILE"
        })
      });

      if (!response.ok) {
        // Token revoked, expired, or reused
        await secureStorage.deleteRefreshToken();
        clearAccessToken();
        if (onAuthFailure) {
          onAuthFailure();
        }
        return null;
      }

      const body = (await response.json()) as ApiResponse<RefreshResponseData>;
      if (body.success && body.data?.accessToken) {
        setAccessToken(body.data.accessToken);

        // Update newly rotated refresh token in SecureStore
        if (body.data.refreshToken) {
          await secureStorage.setRefreshToken(body.data.refreshToken);
        }

        return body.data.accessToken;
      }

      await secureStorage.deleteRefreshToken();
      clearAccessToken();
      if (onAuthFailure) {
        onAuthFailure();
      }
      return null;
    } catch {
      await secureStorage.deleteRefreshToken();
      clearAccessToken();
      if (onAuthFailure) {
        onAuthFailure();
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Centralized fetch wrapper for mobile requests.
 */
export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit & { skipAuthRefresh?: boolean }
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) || {})
  };

  const currentToken = getAccessToken();
  if (currentToken && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${currentToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const isAuthEndpoint =
    endpoint.includes("/auth/login") ||
    endpoint.includes("/auth/register") ||
    endpoint.includes("/auth/refresh");

  // Handle 401 Unauthorized with token refresh if not already an auth endpoint
  if (response.status === 401 && !options?.skipAuthRefresh && !isAuthEndpoint) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry original request with new access token
      headers.Authorization = `Bearer ${newToken}`;
      const retryResponse = await fetch(url, {
        ...options,
        headers
      });

      const retryBody = await retryResponse.json();
      if (!retryResponse.ok) {
        const errorBody = retryBody as ApiErrorResponse;
        throw new ApiClientError(
          errorBody.error?.message || `HTTP error ${retryResponse.status}`,
          retryResponse.status,
          errorBody.error?.code || "HTTP_ERROR",
          errorBody.error?.details
        );
      }
      return retryBody as ApiResponse<T>;
    }
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const errorBody = body as ApiErrorResponse | null;
    throw new ApiClientError(
      errorBody?.error?.message || `HTTP error ${response.status}`,
      response.status,
      errorBody?.error?.code || "HTTP_ERROR",
      errorBody?.error?.details
    );
  }

  return body as ApiResponse<T>;
}

