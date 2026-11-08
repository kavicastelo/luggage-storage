import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  fetchApi,
  ApiClientError,
  setAccessToken,
  getAccessToken,
  clearAccessToken,
  refreshAccessToken
} from "../src/services/api-client";
import { secureStorage } from "../src/services/secure-storage.service";

describe("Mobile api-client (HTTP & Refresh Interceptor)", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    clearAccessToken();
    await secureStorage.deleteRefreshToken();
  });

  it("should attach Authorization Bearer header when in-memory access token is set", async () => {
    setAccessToken("mock-mobile-jwt-access-token");

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
          Authorization: "Bearer mock-mobile-jwt-access-token"
        })
      })
    );
  });

  it("should automatically rotate refresh token via SecureStore on 401 and retry request", async () => {
    setAccessToken("expired-token");
    await secureStorage.setRefreshToken("current-refresh-token");

    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (url.includes("/auth/refresh")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              accessToken: "new-rotated-access-token",
              refreshToken: "new-rotated-refresh-token",
              expiresIn: 900,
              tokenType: "Bearer"
            }
          })
        };
      }

      if (url.includes("/protected-endpoint")) {
        if (callCount === 1) {
          return {
            ok: false,
            status: 401,
            json: async () => ({
              success: false,
              error: { code: "UNAUTHORIZED", message: "Token expired" }
            })
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { protectedData: "secured" }
          })
        };
      }

      return { ok: false, status: 404 };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchApi<{ protectedData: string }>("/protected-endpoint");

    expect(result.data.protectedData).toBe("secured");
    expect(getAccessToken()).toBe("new-rotated-access-token");
    expect(await secureStorage.getRefreshToken()).toBe("new-rotated-refresh-token");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("should NOT attempt refresh when auth endpoints return 401 (infinite loop defense)", async () => {
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should serialize concurrent refresh attempts into a singleton call", async () => {
    await secureStorage.setRefreshToken("singleton-refresh-token");

    let refreshCount = 0;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/auth/refresh")) {
        refreshCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              accessToken: "singleton-access-token",
              refreshToken: "singleton-next-token",
              expiresIn: 900,
              tokenType: "Bearer"
            }
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const [t1, t2, t3] = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
      refreshAccessToken()
    ]);

    expect(refreshCount).toBe(1);
    expect(t1).toBe("singleton-access-token");
    expect(t2).toBe("singleton-access-token");
    expect(t3).toBe("singleton-access-token");
  });
});

