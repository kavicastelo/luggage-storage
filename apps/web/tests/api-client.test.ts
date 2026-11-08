import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  fetchApi,
  ApiClientError,
  setAccessToken,
  getAccessToken,
  clearAccessToken,
  refreshAccessToken
} from "../src/lib/api-client";

describe("api-client (HTTP & Refresh Interceptor)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearAccessToken();
  });

  it("should send requests with credentials: 'include'", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { ok: true } })
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchApi("/health");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/health"),
      expect.objectContaining({
        credentials: "include"
      })
    );
  });

  it("should attach Authorization header when in-memory access token is set", async () => {
    setAccessToken("my-jwt-access-token");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { ok: true } })
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchApi("/auth/me");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/me"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my-jwt-access-token"
        })
      })
    );
  });

  it("should automatically refresh token on 401 and retry the original request", async () => {
    setAccessToken("expired-token");

    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (url.includes("/auth/refresh")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { accessToken: "new-rotated-token" }
          })
        };
      }

      if (url.includes("/protected-resource")) {
        if (callCount === 1) {
          // First attempt fails with 401
          return {
            ok: false,
            status: 401,
            json: async () => ({
              success: false,
              error: { code: "UNAUTHORIZED", message: "Token expired" }
            })
          };
        }
        // Second attempt with new token succeeds
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { secretData: 12345 }
          })
        };
      }

      return { ok: false, status: 404 };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchApi<{ secretData: number }>("/protected-resource");

    expect(result.data.secretData).toBe(12345);
    expect(getAccessToken()).toBe("new-rotated-token");
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1. Failed request, 2. Refresh request, 3. Retried request
  });

  it("should NOT trigger token refresh when an auth endpoint itself returns 401 (prevents infinite loop)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid credentials" }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchApi("/auth/login", { method: "POST" })).rejects.toThrow(ApiClientError);
    // Should NOT have called /auth/refresh
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should serialize concurrent refresh attempts via mutex (only 1 refresh dispatched)", async () => {
    let refreshDispatchedCount = 0;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/auth/refresh")) {
        refreshDispatchedCount++;
        // Delay response to simulate async in-flight request
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { accessToken: "singleton-refreshed-token" }
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    // Dispatch 3 concurrent refreshes
    const [token1, token2, token3] = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
      refreshAccessToken()
    ]);

    expect(refreshDispatchedCount).toBe(1);
    expect(token1).toBe("singleton-refreshed-token");
    expect(token2).toBe("singleton-refreshed-token");
    expect(token3).toBe("singleton-refreshed-token");
  });

  it("should preserve error details in ApiClientError", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: [{ field: "email", message: "Invalid email" }]
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await fetchApi("/test-validation");
      expect.fail("Should have thrown ApiClientError");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.statusCode).toBe(400);
      expect(apiErr.code).toBe("VALIDATION_ERROR");
      expect(apiErr.message).toBe("Validation failed");
      expect(apiErr.details).toEqual([{ field: "email", message: "Invalid email" }]);
    }
  });
});

