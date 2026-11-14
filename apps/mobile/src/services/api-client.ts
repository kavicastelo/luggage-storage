import { ApiResponse, ApiErrorResponse, RefreshResponseData } from "@luggage-storage/contracts";
import { secureStorage } from "./secure-storage.service";

export function normalizeApiBaseUrl(rawUrl?: string): string {
  const trimmed = (rawUrl ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    return "http://localhost:3000/api/v1";
  }
  if (/\/api\/v1$/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}/api/v1`;
}

export function getApiBaseUrl(): string {
  return normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);
}

/**
 * Custom error class for Mobile API errors.
 */
export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown[];
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    statusCode: number,
    code: string = "API_ERROR",
    details?: unknown[],
    retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface NormalizedApiError {
  message: string;
  code: string;
  statusCode: number;
  retryAfterSeconds?: number;
  isNetworkError: boolean;
  isRateLimited: boolean;
  isAuthError: boolean;
}

export function normalizeApiError(error: unknown): NormalizedApiError {
  if (error instanceof ApiClientError) {
    const isNetworkError = error.statusCode === 0 || error.code === "NETWORK_ERROR" || error.code === "TIMEOUT";
    const isRateLimited = error.statusCode === 429 || error.code === "RATE_LIMITED";
    const isAuthError = error.statusCode === 401 || error.statusCode === 403;
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      retryAfterSeconds: error.retryAfterSeconds,
      isNetworkError,
      isRateLimited,
      isAuthError
    };
  }

  if (error instanceof TypeError) {
    return {
      message: "Unable to reach the server. Check your internet connection and try again.",
      code: "NETWORK_ERROR",
      statusCode: 0,
      isNetworkError: true,
      isRateLimited: false,
      isAuthError: false
    };
  }

  if (error instanceof Error) {
    const isTimeout = error.name === "AbortError";
    return {
      message: isTimeout
        ? "Request timed out. Please try again."
        : error.message || "Unexpected error occurred.",
      code: isTimeout ? "TIMEOUT" : "UNKNOWN_ERROR",
      statusCode: isTimeout ? 0 : 500,
      isNetworkError: isTimeout,
      isRateLimited: false,
      isAuthError: false
    };
  }

  return {
    message: "Unexpected error occurred.",
    code: "UNKNOWN_ERROR",
    statusCode: 500,
    isNetworkError: false,
    isRateLimited: false,
    isAuthError: false
  };
}

function parseRetryAfterSeconds(response: Response): number | undefined {
  const raw = response.headers?.get?.("Retry-After") ?? response.headers?.get?.("retry-after");
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
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

      const url = `${getApiBaseUrl()}/auth/refresh`;
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
        if (response.status === 401 || response.status === 403) {
          // Token revoked, expired, or reused
          await secureStorage.deleteRefreshToken();
          clearAccessToken();
          if (onAuthFailure) {
            onAuthFailure();
          }
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
      // Preserve stored refresh token on transient network/offline errors
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  url: string,
  options?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? 15000;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    return await fetch(url, {
      ...options,
      signal: options?.signal ?? controller?.signal
    });
  } catch (err) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    const isAbort = err instanceof Error && err.name === "AbortError";
    throw new ApiClientError(
      isAbort
        ? "Request timed out. Please try again."
        : "Network request failed. Check your connection and try again.",
      0,
      isAbort ? "TIMEOUT" : "NETWORK_ERROR"
    );
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/**
 * Centralized fetch wrapper for mobile requests.
 */
export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit & { skipAuthRefresh?: boolean; timeoutMs?: number }
): Promise<ApiResponse<T>> {
  const url = `${getApiBaseUrl()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) || {})
  };

  const currentToken = getAccessToken();
  if (currentToken && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${currentToken}`;
  }

  const response = await fetchWithTimeout(url, {
    ...options,
    headers
  });

  const isAuthEndpoint =
    endpoint.includes("/auth/login") ||
    endpoint.includes("/auth/register") ||
    endpoint.includes("/auth/refresh") ||
    endpoint.includes("/auth/change-password") ||
    endpoint.includes("/auth/verify-email") ||
    endpoint.includes("/auth/resend-verification") ||
    endpoint.includes("/auth/forgot-password") ||
    endpoint.includes("/auth/reset-password");

  // Handle 401 Unauthorized with token refresh if not already an auth endpoint
  if (response.status === 401 && !options?.skipAuthRefresh && !isAuthEndpoint) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry original request with new access token
      headers.Authorization = `Bearer ${newToken}`;
      const retryResponse = await fetchWithTimeout(url, {
        ...options,
        headers
      });

      const retryBody = await parseJsonSafe(retryResponse);
      if (!retryResponse.ok) {
        const errorBody = retryBody as ApiErrorResponse | null;
        throw new ApiClientError(
          errorBody?.error?.message || `HTTP error ${retryResponse.status}`,
          retryResponse.status,
          errorBody?.error?.code || "HTTP_ERROR",
          errorBody?.error?.details,
          parseRetryAfterSeconds(retryResponse)
        );
      }
      return retryBody as ApiResponse<T>;
    }
  }

  const body = await parseJsonSafe(response);

  if (!response.ok) {
    const errorBody = body as ApiErrorResponse | null;
    throw new ApiClientError(
      errorBody?.error?.message || `HTTP error ${response.status}`,
      response.status,
      errorBody?.error?.code || "HTTP_ERROR",
      errorBody?.error?.details,
      parseRetryAfterSeconds(response)
    );
  }

  return body as ApiResponse<T>;
}

