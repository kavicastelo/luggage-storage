import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { PayHereCheckoutHandoff, SandboxCheckoutHandoff } from "@luggage-storage/contracts";
import {
  ALLOWED_PAYHERE_HANDOFF_PATH_REGEX,
  isPayHerePostHandoff,
  openExternalPayHereHandoff,
  resolveMobileHandoffUrl
} from "../src/lib/payment-handoff";
import { marketplaceApi } from "../src/services/marketplace-api";
import { clearAccessToken, getApiBaseUrl, setAccessToken } from "../src/services/api-client";

describe("Phase B8 — Mobile PayHere External Handoff & Authoritative Status Polling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearAccessToken();
  });

  it("validates mobile PayHere handoff paths, rejects traversal or unsafe schemes, and opens external browser URL", async () => {
    const validPath = "/payments/handoff/eyJpbnRlbnRJZCI6IjEyMyJ9.abcdef123456";
    expect(ALLOWED_PAYHERE_HANDOFF_PATH_REGEX.test(validPath)).toBe(true);

    const resolved = resolveMobileHandoffUrl("https://api.luggagestorage.lk/api/v1/", validPath);
    expect(resolved).toBe(`https://api.luggagestorage.lk/api/v1${validPath}`);

    const openSpy = vi.fn().mockResolvedValue(undefined);
    await openExternalPayHereHandoff(resolved, openSpy);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(resolved);

    expect(() =>
      resolveMobileHandoffUrl("https://api.luggagestorage.lk/api/v1", "/payments/handoff/../../admin")
    ).toThrow(/Invalid mobile PayHere handoff path/);

    expect(() =>
      resolveMobileHandoffUrl("https://api.luggagestorage.lk/api/v1", "/payments/handoff/a.b?evil=1")
    ).toThrow(/Invalid mobile PayHere handoff path/);

    expect(() =>
      resolveMobileHandoffUrl("javascript://localhost", validPath)
    ).toThrow(/Invalid API base URL|Unsupported protocol/);

    expect(typeof getApiBaseUrl()).toBe("string");
  });

  it("distinguishes REDIRECT_TO_PROVIDER vs SANDBOX_SIMULATION and verifies authoritative checkout-status without calling simulateSandboxPayment in PayHere mode", async () => {
    const payHereHandoff: PayHereCheckoutHandoff = {
      mode: "PAYHERE_SANDBOX_REDIRECT",
      provider: "PAYHERE",
      method: "POST_FORM",
      actionUrl: "https://sandbox.payhere.lk/pay/checkout",
      mobileHandoffPath: "/payments/handoff/headerPayload.hmacSig99",
      fields: {
        merchant_id: "1219999",
        return_url: "https://web.luggagestorage.lk/booking/confirm",
        cancel_url: "https://web.luggagestorage.lk/booking/confirm?cancelled=1",
        notify_url: "https://api.luggagestorage.lk/api/v1/payments/webhooks/payhere",
        order_id: "ORD-MOB-001",
        items: "Luggage Storage Booking LGS-MOB001",
        currency: "LKR",
        amount: "1800.00",
        first_name: "Nadeesha",
        last_name: "Silva",
        email: "nadeesha@example.com",
        phone: "+94771234567",
        address: "100 Galle Road",
        city: "Colombo",
        country: "Sri Lanka",
        hash: "FEDCBA9876543210FEDCBA9876543210",
        custom_1: "11111111-2222-4333-8444-555555555555",
        custom_2: "22222222-3333-4444-8555-666666666666"
      }
    };
    const sandboxHandoff: SandboxCheckoutHandoff = {
      mode: "SANDBOX_SIMULATION",
      provider: "SANDBOX_GATEWAY",
      method: "SIMULATED_API",
      intentId: "11111111-2222-4333-8444-555555555555",
      orderId: "ORD-SBX-MOB",
      amountMinor: 180000,
      currency: "LKR"
    };

    expect(isPayHerePostHandoff(payHereHandoff)).toBe(true);
    expect(isPayHerePostHandoff(sandboxHandoff)).toBe(false);

    setAccessToken("mobile-traveller-jwt");
    const fetchMock = vi
      .fn()
      // 1. Create intent -> PayHere redirect
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            id: "11111111-2222-4333-8444-555555555555",
            bookingId: "22222222-3333-4444-8555-666666666666",
            travellerUserId: "33333333-4444-4555-8666-777777777777",
            provider: "PAYHERE",
            providerOrderId: "ORD-MOB-001",
            amountMinor: 180000,
            currency: "LKR",
            status: "PENDING_GATEWAY",
            nextAction: "REDIRECT_TO_PROVIDER",
            checkoutHandoff: payHereHandoff,
            checkoutPayload: {},
            expiresAt: "2026-12-01T10:30:00.000Z",
            verifiedAt: null,
            failureReason: null,
            createdAt: "2026-12-01T10:00:00.000Z",
            updatedAt: "2026-12-01T10:00:00.000Z"
          }
        })
      })
      // 2. AppState resume check before webhook arrives -> still PENDING_PAYMENT
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            bookingId: "22222222-3333-4444-8555-666666666666",
            referenceCode: "LGS-MOB001",
            bookingStatus: "PENDING_PAYMENT",
            holdExpiresAt: "2026-12-01T10:15:00.000Z",
            confirmedAt: null,
            canRetryPayment: true,
            custodyReady: false,
            pollRecommended: true,
            paymentIntent: null
          }
        })
      })
      // 3. Subsequent status check after webhook settles -> CONFIRMED
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            bookingId: "22222222-3333-4444-8555-666666666666",
            referenceCode: "LGS-MOB001",
            bookingStatus: "CONFIRMED",
            holdExpiresAt: null,
            confirmedAt: "2026-12-01T10:01:00.000Z",
            canRetryPayment: false,
            custodyReady: true,
            pollRecommended: false,
            paymentIntent: null
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const intent = await marketplaceApi.createPaymentIntent({
      bookingId: "22222222-3333-4444-8555-666666666666",
      customerDetails: {
        firstName: "Nadeesha",
        lastName: "Silva",
        email: "nadeesha@example.com",
        phone: "+94771234567",
        address: "100 Galle Road",
        city: "Colombo",
        country: "Sri Lanka"
      }
    });

    expect(intent.nextAction).toBe("REDIRECT_TO_PROVIDER");
    expect(isPayHerePostHandoff(intent.checkoutHandoff)).toBe(true);

    const pendingStatus = await marketplaceApi.getCheckoutStatus({
      bookingId: "22222222-3333-4444-8555-666666666666"
    });
    expect(pendingStatus.bookingStatus).toBe("PENDING_PAYMENT");
    expect(pendingStatus.custodyReady).toBe(false);

    const confirmedStatus = await marketplaceApi.getCheckoutStatus({
      bookingId: "22222222-3333-4444-8555-666666666666"
    });
    expect(confirmedStatus.bookingStatus).toBe("CONFIRMED");
    expect(confirmedStatus.custodyReady).toBe(true);

    // Ensure simulateSandboxPayment endpoint was NEVER called during PayHere flow
    const calledUrls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes("sandbox-simulate"))).toBe(false);
  });

  it("audits mobile checkout & custody pass screens for AppState resume polling, duplicate-submit locks, locked pass protection, and zero secrets", () => {
    const checkoutSrc = fs.readFileSync(
      path.resolve(__dirname, "../app/(traveller)/checkout.tsx"),
      "utf-8"
    );
    const passSrc = fs.readFileSync(
      path.resolve(__dirname, "../app/(traveller)/pass.tsx"),
      "utf-8"
    );
    const handoffSrc = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/payment-handoff.ts"),
      "utf-8"
    );

    // Mobile PayHere external browser handoff + return verification wiring
    expect(checkoutSrc).toContain('nextAction === "REDIRECT_TO_PROVIDER"');
    expect(checkoutSrc).toContain("openExternalPayHereHandoff");
    expect(checkoutSrc).toContain("resolveMobileHandoffUrl");
    expect(checkoutSrc).toContain("Linking.openURL");
    expect(checkoutSrc).toContain("AppState.addEventListener");
    expect(checkoutSrc).toContain("getCheckoutStatus");
    expect(checkoutSrc).toContain("Check Payment Status");
    expect(checkoutSrc).toContain("Re-open PayHere Checkout");
    expect(checkoutSrc).toContain("Retry PayHere Checkout");
    expect(checkoutSrc).toContain("submitInFlightRef");
    expect(checkoutSrc).not.toContain("react-native-webview");

    // Pass screen must refuse QR/PIN unless status is CONFIRMED / IN_STORAGE
    expect(passSrc).toContain("isCustodyUnlocked");
    expect(passSrc).toContain('detail.status === "CONFIRMED" || detail.status === "IN_STORAGE"');

    // No secrets or client MD5 logic in mobile code
    for (const src of [checkoutSrc, passSrc, handoffSrc]) {
      expect(src).not.toContain("PAYHERE_MERCHANT_SECRET");
      expect(src).not.toContain("PAYMENT_WEBHOOK_SECRET");
      expect(src).not.toContain('createHash("md5")');
    }
  });
});

