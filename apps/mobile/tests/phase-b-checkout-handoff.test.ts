import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type {
  PayHereNativeCheckoutHandoff,
  PayHereWebCheckoutHandoff,
  SandboxCheckoutHandoff
} from "@luggage-storage/contracts";
import {
  ALLOWED_PAYHERE_CHECKOUT_URLS,
  assertSafeWebReferrerPolicy,
  buildPayHereWebCheckoutForm,
  isPayHereNativeSdkHandoff,
  isPayHereWebPostHandoff,
  submitPayHereWebCheckoutForm
} from "../src/lib/payment-handoff";
import { launchPayHereNativeCheckout } from "../src/lib/payhere-native";
import { marketplaceApi } from "../src/services/marketplace-api";
import { clearAccessToken, getApiBaseUrl, setAccessToken } from "../src/services/api-client";

function createMockWebDocument(metaReferrer?: string) {
  const appendedForms: Array<{
    method: string;
    action: string;
    style: { display: string };
    attributes: Record<string, string>;
    children: Array<{ type: string; name: string; value: string }>;
    setAttribute: (k: string, v: string) => void;
    appendChild: (el: { type: string; name: string; value: string }) => void;
    submit: ReturnType<typeof vi.fn>;
  }> = [];

  const mockDoc = {
    querySelectorAll: vi.fn((selector: string) => {
      if (selector === 'meta[name="referrer"]' && metaReferrer) {
        return [{ getAttribute: () => metaReferrer }];
      }
      return [];
    }),
    createElement: vi.fn((tag: string) => {
      if (tag === "form") {
        const form = {
          method: "",
          action: "",
          style: { display: "" },
          attributes: {} as Record<string, string>,
          children: [] as Array<{ type: string; name: string; value: string }>,
          setAttribute: (k: string, v: string) => {
            form.attributes[k] = v;
          },
          appendChild: (el: { type: string; name: string; value: string }) => {
            form.children.push(el);
          },
          submit: vi.fn()
        };
        return form;
      }
      return { type: "", name: "", value: "" };
    }),
    body: {
      appendChild: vi.fn((el: (typeof appendedForms)[number]) => {
        appendedForms.push(el);
      })
    }
  } as unknown as Document;

  return { mockDoc, appendedForms };
}

describe("Phase B8 — Mobile Channel-Aware PayHere Checkout & Authoritative Status Polling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearAccessToken();
  });

  it("submits direct POST form from Expo Web without no-referrer suppression and rejects untrusted destinations", () => {
    expect(ALLOWED_PAYHERE_CHECKOUT_URLS.has("https://sandbox.payhere.lk/pay/checkout")).toBe(true);
    expect(ALLOWED_PAYHERE_CHECKOUT_URLS.has("https://www.payhere.lk/pay/checkout")).toBe(true);

    const webHandoff: PayHereWebCheckoutHandoff = {
      mode: "PAYHERE_SANDBOX_REDIRECT",
      provider: "PAYHERE",
      method: "POST_FORM",
      actionUrl: "https://sandbox.payhere.lk/pay/checkout",
      fields: {
        merchant_id: "1219999",
        return_url: "https://web.luggagestorage.lk/booking/confirm",
        cancel_url: "https://web.luggagestorage.lk/booking/confirm?cancelled=1",
        notify_url: "https://api.luggagestorage.lk/api/v1/payments/webhooks/payhere",
        order_id: "ORD-MWEB-001",
        items: "Luggage Storage Booking LGS-MWEB001",
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

    const { mockDoc, appendedForms } = createMockWebDocument("strict-origin-when-cross-origin");
    const submitted = submitPayHereWebCheckoutForm(webHandoff, mockDoc);
    expect(appendedForms.length).toBe(1);
    expect(appendedForms[0]).toBe(submitted);
    expect(appendedForms[0].method).toBe("POST");
    expect(appendedForms[0].action).toBe("https://sandbox.payhere.lk/pay/checkout");
    expect(appendedForms[0].attributes["referrerpolicy"]).toBe("strict-origin-when-cross-origin");
    expect(appendedForms[0].submit).toHaveBeenCalledTimes(1);

    const { mockDoc: badReferrerDoc } = createMockWebDocument("no-referrer");
    expect(() => assertSafeWebReferrerPolicy(badReferrerDoc)).toThrow(
      /Unsafe document referrer policy/i
    );
    expect(() => buildPayHereWebCheckoutForm(webHandoff, badReferrerDoc)).toThrow(
      /Unsafe document referrer policy/i
    );

    const untrusted = {
      ...webHandoff,
      actionUrl: "https://evil.example/pay" as unknown as PayHereWebCheckoutHandoff["actionUrl"]
    };
    expect(() => buildPayHereWebCheckoutForm(untrusted, mockDoc)).toThrow(/Untrusted PayHere/);
    expect(typeof getApiBaseUrl()).toBe("string");
  });

  it("distinguishes MOBILE_APP NATIVE_SDK vs WEB POST_FORM vs SANDBOX_SIMULATION and polls authoritative status without simulating", async () => {
    const nativeHandoff: PayHereNativeCheckoutHandoff = {
      mode: "PAYHERE_NATIVE_SANDBOX",
      provider: "PAYHERE",
      method: "NATIVE_SDK",
      sdkPayload: {
        sandbox: true,
        merchant_id: "1219999",
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
        custom_1: "11111111-2222-4333-8444-555555555555",
        custom_2: "LGS-MOB001"
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

    expect(isPayHereNativeSdkHandoff(nativeHandoff)).toBe(true);
    expect(isPayHereWebPostHandoff(nativeHandoff)).toBe(false);
    expect(isPayHereNativeSdkHandoff(sandboxHandoff)).toBe(false);

    setAccessToken("mobile-traveller-jwt");
    const fetchMock = vi
      .fn()
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
            checkoutChannel: "MOBILE_APP",
            providerOrderId: "ORD-MOB-001",
            amountMinor: 180000,
            currency: "LKR",
            status: "PENDING_GATEWAY",
            nextAction: "LAUNCH_NATIVE_SDK",
            checkoutHandoff: nativeHandoff,
            checkoutPayload: {},
            expiresAt: "2026-12-01T10:30:00.000Z",
            verifiedAt: null,
            failureReason: null,
            createdAt: "2026-12-01T10:00:00.000Z",
            updatedAt: "2026-12-01T10:00:00.000Z"
          }
        })
      })
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
      channel: "MOBILE_APP",
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

    expect(intent.checkoutChannel).toBe("MOBILE_APP");
    expect(intent.nextAction).toBe("LAUNCH_NATIVE_SDK");
    expect(isPayHereNativeSdkHandoff(intent.checkoutHandoff)).toBe(true);

    const sdkOutcome = await launchPayHereNativeCheckout(nativeHandoff.sdkPayload, {
      platformOs: "android",
      hasNativeBridge: true,
      sdkModule: {
        startPayment: (_payload, onCompleted) => onCompleted("PH-SANDBOX-999")
      }
    });
    expect(sdkOutcome).toEqual({ status: "COMPLETED", paymentId: "PH-SANDBOX-999" });

    // Even after COMPLETED callback, custody stays locked until backend confirms
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

    const calledUrls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes("sandbox-simulate"))).toBe(false);
  });

  it("audits mobile checkout, confirm, native bridge & custody pass screens for channel isolation and zero secrets", () => {
    const checkoutSrc = fs.readFileSync(
      path.resolve(__dirname, "../app/(traveller)/checkout.tsx"),
      "utf-8"
    );
    const confirmSrc = fs.readFileSync(
      path.resolve(__dirname, "../app/booking/confirm.tsx"),
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
    const nativeSrc = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/payhere-native.ts"),
      "utf-8"
    );

    expect(checkoutSrc).toContain('Platform.OS === "web" ? "WEB" : "MOBILE_APP"');
    expect(checkoutSrc).toContain("submitPayHereWebCheckoutForm");
    expect(checkoutSrc).toContain("launchPayHereNativeCheckout");
    expect(checkoutSrc).toContain("AppState.addEventListener");
    expect(checkoutSrc).toContain("getCheckoutStatus");
    expect(checkoutSrc).toContain("Check Payment Status");
    expect(checkoutSrc).toContain("Re-open PayHere Checkout");
    expect(checkoutSrc).toContain("Retry PayHere Checkout");
    expect(checkoutSrc).toContain("submitInFlightRef");
    expect(checkoutSrc).not.toContain("react-native-webview");
    expect(checkoutSrc).not.toContain("Linking.openURL");
    expect(checkoutSrc).not.toContain("/payments/handoff/");

    expect(confirmSrc).toContain("parseMobileCheckoutReturnQuery");
    expect(confirmSrc).toContain("getCheckoutStatus");

    expect(passSrc).toContain("isCustodyUnlocked");
    expect(passSrc).toContain('detail.status === "CONFIRMED" || detail.status === "IN_STORAGE"');

    for (const src of [checkoutSrc, confirmSrc, passSrc, handoffSrc, nativeSrc]) {
      expect(src).not.toContain("PAYHERE_MERCHANT_SECRET");
      expect(src).not.toContain("PAYHERE_WEB_MERCHANT_SECRET");
      expect(src).not.toContain("PAYHERE_MOBILE_MERCHANT_SECRET");
      expect(src).not.toContain("PAYMENT_WEBHOOK_SECRET");
      expect(src).not.toContain('createHash("md5")');
    }
  });
});
