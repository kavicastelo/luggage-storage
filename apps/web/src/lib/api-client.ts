import { ApiResponse, ApiErrorResponse } from "@luggage-storage/contracts";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    },
    ...options
  });

  const body = await response.json();
  if (!response.ok) {
    const errorBody = body as ApiErrorResponse;
    throw new Error(errorBody.error?.message || `HTTP error ${response.status}`);
  }

  return body as ApiResponse<T>;
}
