import { ApiResponse, ApiErrorResponse } from "@luggage-storage/contracts";

const DEFAULT_API_BASE = "http://localhost:3000/api/v1";

export function normalizeApiBaseUrl(rawUrl?: string): string {
  const trimmed = rawUrl?.trim();
  if (!trimmed) {
    return DEFAULT_API_BASE;
  }
  const withoutTrailingSlashes = trimmed.replace(/\/+$/, "");
  if (withoutTrailingSlashes.endsWith("/api/v1")) {
    return withoutTrailingSlashes;
  }
  return `${withoutTrailingSlashes}/api/v1`;
}

const API_BASE = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

/**
 * Custom error class for API errors preserving HTTP status, error code, and validation details.
 */
export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown[];

  constructor(message: string, statusCode: number, code: string = "API_ERROR", details?: unknown[]) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * In-memory storage for short-lived JWT access token.
 * NEVER persisted in localStorage, sessionStorage, or indexedDB.
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
 * Refresh mutex lock to prevent concurrent requests from triggering multiple refresh calls.
 */
let refreshPromise: Promise<string | null> | null = null;

type AuthFailureCallback = () => void;
let onAuthFailure: AuthFailureCallback | null = null;

export function setAuthFailureHandler(handler: AuthFailureCallback | null): void {
  onAuthFailure = handler;
}

/**
 * Attempts to rotate refresh token via HTTP-only cookie and update in-memory access token.
 * Uses a singleton promise to serialize concurrent refresh requests.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const url = `${API_BASE}/auth/refresh`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ clientType: "WEB" })
      });

      if (!response.ok) {
        clearAccessToken();
        if (onAuthFailure) {
          onAuthFailure();
        }
        return null;
      }

      const body = (await response.json()) as ApiResponse<{ accessToken: string }>;
      if (body.success && body.data?.accessToken) {
        setAccessToken(body.data.accessToken);
        return body.data.accessToken;
      }

      clearAccessToken();
      if (onAuthFailure) {
        onAuthFailure();
      }
      return null;
    } catch {
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

const AUTH_NO_REFRESH_ENDPOINTS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
  "/auth/change-password",
  "/auth/verify-email",
  "/auth/resend-verification",
  "/auth/forgot-password",
  "/auth/reset-password"
]);

function normalizeEndpointPath(endpoint: string): string {
  const withLeadingSlash = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (API_BASE.endsWith("/api/v1")) {
    if (withLeadingSlash === "/api/v1") {
      return "";
    }
    if (withLeadingSlash.startsWith("/api/v1/")) {
      return withLeadingSlash.slice("/api/v1".length);
    }
  }
  return withLeadingSlash;
}

function isNoRefreshAuthEndpoint(normalizedEndpoint: string): boolean {
  const pathOnly = normalizedEndpoint.split("?")[0].replace(/\/+$/, "");
  return AUTH_NO_REFRESH_ENDPOINTS.has(pathOnly);
}

function buildRequestHeaders(options?: RequestInit): Record<string, string> {
  const headers: Record<string, string> = {};

  if (options?.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      for (const [key, value] of options.headers) {
        headers[key] = value;
      }
    } else {
      Object.assign(headers, options.headers);
    }
  }

  const body = options?.body;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const isBlob = typeof Blob !== "undefined" && body instanceof Blob;
  const isUrlSearchParams =
    typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams;
  const isBinary =
    typeof ArrayBuffer !== "undefined" &&
    (body instanceof ArrayBuffer || ArrayBuffer.isView(body));

  const existingContentTypeKey = Object.keys(headers).find(
    (key) => key.toLowerCase() === "content-type"
  );

  if (isFormData) {
    if (existingContentTypeKey) {
      delete headers[existingContentTypeKey];
    }
    return headers;
  }

  const hasJsonCandidateBody =
    body !== undefined &&
    body !== null &&
    !isBlob &&
    !isUrlSearchParams &&
    !isBinary &&
    !(typeof body === "string" && body.length === 0);

  if (hasJsonCandidateBody && !existingContentTypeKey) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Centralized fetch wrapper with credentials: 'include', Authorization header injection,
 * and automatic 401 retry with refresh token rotation.
 */
export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit & { skipAuthRefresh?: boolean }
): Promise<ApiResponse<T>> {
  const normalizedEndpoint = normalizeEndpointPath(endpoint);
  const url = `${API_BASE}${normalizedEndpoint}`;
  const headers = buildRequestHeaders(options);

  const currentToken = getAccessToken();
  if (currentToken && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${currentToken}`;
  }

  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers
  });

  // Handle 401 Unauthorized with token refresh if not already refreshing/auth endpoint
  const isAuthEndpoint = isNoRefreshAuthEndpoint(normalizedEndpoint);

  if (response.status === 401 && !options?.skipAuthRefresh && !isAuthEndpoint) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry original request with newly issued access token
      headers.Authorization = `Bearer ${newToken}`;
      const retryResponse = await fetch(url, {
        credentials: "include",
        ...options,
        headers
      });

      const retryBody = await parseResponseBody(retryResponse);
      if (!retryResponse.ok) {
        const errorBody = retryBody as ApiErrorResponse | null;
        throw new ApiClientError(
          errorBody?.error?.message || `HTTP error ${retryResponse.status}`,
          retryResponse.status,
          errorBody?.error?.code || "HTTP_ERROR",
          errorBody?.error?.details
        );
      }
      if (retryBody === null && retryResponse.status !== 204) {
        throw new ApiClientError(
          "Invalid JSON response from server",
          retryResponse.status,
          "INVALID_RESPONSE"
        );
      }
      return (retryBody ?? { success: true, data: undefined }) as ApiResponse<T>;
    }
  }

  const body = await parseResponseBody(response);

  if (!response.ok) {
    const errorBody = body as ApiErrorResponse | null;
    throw new ApiClientError(
      errorBody?.error?.message || `HTTP error ${response.status}`,
      response.status,
      errorBody?.error?.code || "HTTP_ERROR",
      errorBody?.error?.details
    );
  }

  if (body === null && response.status !== 204) {
    throw new ApiClientError(
      "Invalid JSON response from server",
      response.status,
      "INVALID_RESPONSE"
    );
  }

  return (body ?? { success: true, data: undefined }) as ApiResponse<T>;
}
