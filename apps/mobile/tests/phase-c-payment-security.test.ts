import fs from "node:fs";
import path from "node:path";
import type { PayHereCheckoutHandoff } from "@luggage-storage/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALLOWED_PAYHERE_HANDOFF_PATH_REGEX,
  isPayHerePostHandoff,
  openExternalPayHereHandoff,
  resolveMobileHandoffUrl
} from "../src/lib/payment-handoff";
import { mobileQueryClient } from "../src/lib/query-client";
import {
  ApiClientError,
  clearAccessToken,
  getAccessToken,
  setAccessToken
} from "../src/services/api-client";
import { authApi } from "../src/services/auth-api";
import { marketplaceApi } from "../src/services/marketplace-api";
import { secureStorage } from "../src/services/secure-storage.service";
import { useAuthStore } from "../src/store/useAuthStore";
import { useMobileStore } from "../src/store/useMobileStore";

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe("Phase C — Mobile Payment, Custody & Auth Security Invariants", () => {
  const mobileRoot = path.resolve(__dirname, "..");
  const validSignedPath = "/payments/handoff/eyJpbnRlbnRJZCI6IjExMTExMTExIn0.c2lnbmF0dXJlMTIzNDU2";

  beforeEach(async () => {
    vi.restoreAllMocks();
    clearAccessToken();
    mobileQueryClient.clear();
    useMobileStore.getState().resetTransientState();
    await secureStorage.deleteRefreshToken();
    await useAuthStore.getState().clearAuth();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("1. routes PayHere POST checkout through an approved external browser URL and never embeds WebView", async () => {
    const handoff: PayHereCheckoutHandoff = {
      mode: "PAYHERE_SANDBOX_REDIRECT",
      provider: "PAYHERE",
      method: "POST_FORM",
      actionUrl: "https://sandbox.payhere.lk/pay/checkout",
      fields: {
        merchant_id: "1220001",
        return_url: "https://api.example.com/return",
        cancel_url: "https://api.example.com/cancel",
        notify_url: "https://api.example.com/notify",
        order_id: "LGS-ORDER-1",
        items: "Luggage Storage",
        currency: "LKR",
        amount: "2500.00",
        first_name: "Kasun",
        last_name: "Perera",
        email: "kasun@example.com",
        phone: "+94771234567",
        address: "Fort Railway Station",
        city: "Colombo",
        country: "Sri Lanka",
        hash: "DEADBEEF1234567890"
      },
      mobileHandoffPath: validSignedPath
    };

    expect(isPayHerePostHandoff(handoff)).toBe(true);
    const resolved = resolveMobileHandoffUrl(
      "https://api.luggage.example.com/api/v1",
      handoff.mobileHandoffPath
    );
    expect(resolved).toBe(
      `https://api.luggage.example.com/api/v1${validSignedPath}`
    );

    const openSpy = vi.fn().mockResolvedValue(undefined);
    await openExternalPayHereHandoff(resolved, openSpy);
    expect(openSpy).toHaveBeenCalledWith(resolved);

    const files = [
      ...collectSourceFiles(path.join(mobileRoot, "app")),
      ...collectSourceFiles(path.join(mobileRoot, "src"))
    ];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      expect(src).not.toContain("react-native-webview");
      expect(src).not.toContain("<WebView");
    }
  });

  it("2. rejects unapproved handoff paths or cross-origin redirects", () => {
    expect(ALLOWED_PAYHERE_HANDOFF_PATH_REGEX.test(validSignedPath)).toBe(true);
    expect(() =>
      resolveMobileHandoffUrl(
        "https://api.luggage.example.com/api/v1",
        "https://evil.attacker.example/pay"
      )
    ).toThrow(/Invalid mobile PayHere handoff path/i);
    expect(() =>
      resolveMobileHandoffUrl(
        "https://api.luggage.example.com/api/v1",
        "/payments/admin/override"
      )
    ).toThrow(/Invalid mobile PayHere handoff path/i);
  });

  it("3. contains zero server or gateway secrets anywhere in mobile app/ or src/", () => {
    const forbiddenSecrets = [
      "PAYHERE_MERCHANT_SECRET",
      "JWT_SECRET",
      "DATABASE_IDENTITY_SECRET",
      "COOKIE_SECRET",
      "R2_SECRET_ACCESS_KEY"
    ];
    const files = [
      ...collectSourceFiles(path.join(mobileRoot, "app")),
      ...collectSourceFiles(path.join(mobileRoot, "src"))
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      for (const secretName of forbiddenSecrets) {
        expect(content).not.toContain(secretName);
      }
    }
  });

  it("4. stays fail-closed when returning from external checkout while status is still PENDING", async () => {
    setAccessToken("traveller-jwt-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              bookingId: "22222222-2222-4222-8222-222222222222",
              referenceCode: "BGBX-LK-1001",
              bookingStatus: "PENDING_PAYMENT",
              holdExpiresAt: "2026-11-15T01:15:00.000Z",
              confirmedAt: null,
              canRetryPayment: true,
              custodyReady: false,
              pollRecommended: true,
              paymentIntent: {
                id: "11111111-1111-4111-8111-111111111111",
                bookingId: "22222222-2222-4222-8222-222222222222",
                travellerUserId: "33333333-3333-4333-8333-333333333333",
                provider: "PAYHERE",
                providerOrderId: "LGS-ORDER-1",
                amountMinor: 250000,
                currency: "LKR",
                status: "PENDING_GATEWAY",
                nextAction: "SUBMIT_FORM",
                checkoutHandoff: {
                  mode: "PAYHERE_SANDBOX_REDIRECT",
                  provider: "PAYHERE",
                  method: "POST_FORM",
                  actionUrl: "https://sandbox.payhere.lk/pay/checkout",
                  fields: {},
                  mobileHandoffPath: validSignedPath
                },
                checkoutPayload: {},
                expiresAt: "2026-11-15T01:15:00.000Z",
                verifiedAt: null,
                failureReason: null,
                createdAt: "2026-11-15T01:00:00.000Z",
                updatedAt: "2026-11-15T01:00:00.000Z"
              }
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const status = await marketplaceApi.getCheckoutStatus({
      bookingId: "22222222-2222-4222-8222-222222222222"
    });
    expect(status.custodyReady).toBe(false);
    expect(status.bookingStatus).toBe("PENDING_PAYMENT");
    expect(status.paymentIntent?.status).toBe("PENDING_GATEWAY");
  });

  it("5. gates custody pass behind confirmed payment status and serves QR/PIN pass on CONFIRMED", async () => {
    const passSource = fs.readFileSync(
      path.join(mobileRoot, "app/(traveller)/pass.tsx"),
      "utf8"
    );
    expect(passSource).toContain("PENDING_PAYMENT");
    expect(passSource).toContain("QrCodeMatrix");

    setAccessToken("traveller-jwt-token");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: false,
              error: {
                code: "PAYMENT_REQUIRED",
                message: "Custody pass cannot be issued before payment confirmation"
              }
            }),
            { status: 409, headers: { "Content-Type": "application/json" } }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                bookingId: "22222222-2222-4222-8222-222222222222",
                referenceCode: "BGBX-LK-1001",
                operation: "CHECK_IN",
                qrToken: "LGS-QR-CONFIRMED-" + "0".repeat(47),
                verificationPin: "849201",
                expiresAt: "2026-11-15T03:00:00.000Z"
              }
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
    );

    await expect(
      marketplaceApi.issueCustodyPass("22222222-2222-4222-8222-222222222222", {
        operation: "CHECK_IN"
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "PAYMENT_REQUIRED"
    });

    const pass = await marketplaceApi.issueCustodyPass(
      "22222222-2222-4222-8222-222222222222",
      { operation: "CHECK_IN" }
    );
    expect(pass.qrToken).toHaveLength(64);
    expect(pass.verificationPin).toMatch(/^\d{6}$/);
  });

  it("6. surfaces 409 replay rejection cleanly from custody pass verification", async () => {
    setAccessToken("host-jwt-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "PASS_ALREADY_CONSUMED",
              message: "This custody pass token has already been used"
            }
          }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    await expect(
      marketplaceApi.verifyCustodyPass({
        bookingId: "22222222-2222-4222-8222-222222222222",
        operation: "CHECK_IN",
        qrToken: "LGS-QR-REPLAYED-" + "9".repeat(48)
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "PASS_ALREADY_CONSUMED"
    });
  });

  it("7. parses Retry-After headers into ApiClientError.retryAfterSeconds on HTTP 429", async () => {
    setAccessToken("host-jwt-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: "Too many PIN verification attempts"
            }
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "45"
            }
          }
        )
      )
    );

    try {
      await marketplaceApi.verifyCustodyPass({
        bookingId: "22222222-2222-4222-8222-222222222222",
        operation: "CHECK_IN",
        verificationPin: "000000"
      });
      throw new Error("Expected verifyCustodyPass to reject with 429");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.statusCode).toBe(429);
      expect(apiErr.retryAfterSeconds).toBe(45);
    }
  });

  it("8. preserves SecureStore refresh token on transient offline errors and clears it on 401 invalid refresh", async () => {
    await secureStorage.setRefreshToken("valid-offline-refresh-token");
    vi.spyOn(authApi, "refresh").mockRejectedValueOnce(new TypeError("Network request failed"));

    await useAuthStore.getState().initAuth();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(await secureStorage.getRefreshToken()).toBe("valid-offline-refresh-token");

    vi.spyOn(authApi, "refresh").mockRejectedValueOnce(
      new ApiClientError("Refresh token revoked", 401, "INVALID_REFRESH_TOKEN")
    );

    await useAuthStore.getState().initAuth();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(await secureStorage.getRefreshToken()).toBeNull();
  });

  it("9. clears access token, mobileQueryClient cache, and useMobileStore transient state on logout", async () => {
    setAccessToken("active-session-jwt");
    await secureStorage.setRefreshToken("active-refresh-token");
    mobileQueryClient.setQueryData(["bookings", "list"], { bookings: ["cached"] });
    useMobileStore.getState().setRole("host");
    useMobileStore.getState().setSelectedHostLocationId("loc-99");

    vi.spyOn(authApi, "logout").mockResolvedValue({ message: "Signed out" });

    await useAuthStore.getState().logout();

    expect(getAccessToken()).toBeNull();
    expect(await secureStorage.getRefreshToken()).toBeNull();
    expect(mobileQueryClient.getQueryData(["bookings", "list"])).toBeUndefined();
    expect(useMobileStore.getState().role).toBe("traveller");
    expect(useMobileStore.getState().selectedHostLocationId).toBeNull();
  });
});
