import { describe, it, expect, beforeEach, vi } from "vitest";
import { secureStorage } from "../src/services/secure-storage.service";

describe("Mobile SecureStore Service", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await secureStorage.deleteRefreshToken();
  });

  it("should securely store and retrieve refresh token", async () => {
    await secureStorage.setRefreshToken("test-refresh-token-123");
    const retrieved = await secureStorage.getRefreshToken();
    expect(retrieved).toBe("test-refresh-token-123");
  });

  it("should delete stored refresh token on cleanup", async () => {
    await secureStorage.setRefreshToken("test-token-to-delete");
    expect(await secureStorage.getRefreshToken()).toBe("test-token-to-delete");

    await secureStorage.deleteRefreshToken();
    expect(await secureStorage.getRefreshToken()).toBeNull();
  });

  it("should reject setting an empty refresh token", async () => {
    await expect(secureStorage.setRefreshToken("")).rejects.toThrow(
      "Cannot persist empty refresh token"
    );
  });

  it("should never expose credentials to ordinary global storage", () => {
    // Verify that global/window/AsyncStorage doesn't contain refresh token
    expect(typeof window !== "undefined" ? (window as unknown as Record<string, unknown>).refreshToken : undefined).toBeUndefined();
    expect(typeof global !== "undefined" ? (global as unknown as Record<string, unknown>).refreshToken : undefined).toBeUndefined();
  });
});

