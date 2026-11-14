import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { PayHereCheckoutHandoff, SandboxCheckoutHandoff } from "@luggage-storage/contracts";
import {
  ALLOWED_PAYHERE_CHECKOUT_URLS,
  buildPayHereCheckoutForm,
  clearPendingCheckoutContext,
  isPayHerePostHandoff,
  loadPendingCheckoutContext,
  parseCheckoutReturnQuery,
  savePendingCheckoutContext,
  submitPayHereCheckoutForm
} from "../src/lib/payment-handoff";
import { marketplaceApi } from "../src/services/marketplace-api";
import { clearAccessToken, setAccessToken } from "../src/lib/api-client";
import {
  WebCheckoutSchedulePage,
  WebPaymentConfirmationPage
} from "../src/pages/PublicMarketplacePages";

function createSamplePayHereHandoff(
  overrides?: Partial<PayHereCheckoutHandoff>
): PayHereCheckoutHandoff {
  return {
    mode: "PAYHERE_SANDBOX_REDIRECT",
    provider: "PAYHERE",
    method: "POST_FORM",
    actionUrl: "https://sandbox.payhere.lk/pay/checkout",
    mobileHandoffPath: "/payments/handoff/abc123.sig456",
    fields: {
      merchant_id: "1219999",
      return_url: "https://web.luggagestorage.test/booking/confirm",
      cancel_url: "https://web.luggagestorage.test/booking/confirm?cancelled=1",
      notify_url: "https://api.luggagestorage.test/api/v1/payments/webhooks/payhere",
      order_id: "ORD-PH-WEB-001",
      items: "Luggage Storage Booking LGS-WEB001",
      currency: "LKR",
      amount: "1500.00",
      first_name: "Kasun",
      last_name: "Perera",
      email: "kasun@example.com",
      phone: "+94771234567",
      address: "42 Station Road",
      city: "Colombo",
      country: "Sri Lanka",
      hash: "0123456789ABCDEF0123456789ABCDEF",
      custom_1: "11111111-2222-4333-8444-555555555555",
      custom_2: "22222222-3333-4444-8555-666666666666"
    },
    ...overrides
  };
}

interface MockInputElement {
  type: string;
  name: string;
  value: string;
}

interface MockFormElement {
  method: string;
  action: string;
  style: { display: string };
  attributes: Record<string, string>;
  children: MockInputElement[];
  setAttribute: (k: string, v: string) => void;
  appendChild: (el: MockInputElement) => void;
  submit: ReturnType<typeof vi.fn>;
}

function createMockDom() {
  const appendedForms: MockFormElement[] = [];

  const mockDoc = {
    createElement: vi.fn((tag: string) => {
      if (tag === "form") {
        const form: MockFormElement = {
          method: "",
          action: "",
          style: { display: "" },
          attributes: {},
          children: [],
          setAttribute: (k, v) => {
            form.attributes[k] = v;
          },
          appendChild: (el) => {
            form.children.push(el);
          },
          submit: vi.fn()
        };
        return form;
      }
      return {
        type: "",
        name: "",
        value: ""
      } satisfies MockInputElement;
    }),
    body: {
      appendChild: vi.fn((el: MockFormElement) => {
        appendedForms.push(el);
      })
    }
  } as unknown as Document;

  return { mockDoc, appendedForms };
}

describe("Phase B8 — Web PayHere POST Form Handoff & Authoritative Confirmation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearAccessToken();
  });

  it("constructs and submits hidden POST form to verified PayHere URL with all server-computed fields verbatim", () => {
    const handoff = createSamplePayHereHandoff();
    const { mockDoc, appendedForms } = createMockDom();

    const submitted = submitPayHereCheckoutForm(handoff, mockDoc);
    expect(appendedForms.length).toBe(1);

    const form = appendedForms[0];
    expect(form).toBe(submitted);
    expect(form.method).toBe("POST");
    expect(form.action).toBe("https://sandbox.payhere.lk/pay/checkout");
    expect(form.attributes["data-testid"]).toBe("payhere-post-form");
    expect(form.submit).toHaveBeenCalledTimes(1);

    const fieldMap = Object.fromEntries(form.children.map((i) => [i.name, i.value]));
    expect(fieldMap).toEqual(handoff.fields);
    expect(fieldMap.hash).toBe("0123456789ABCDEF0123456789ABCDEF");
    expect(Object.keys(fieldMap).length).toBe(18);
  });

  it("accepts live www.payhere.lk URL and rejects untrusted actionUrl destinations", () => {
    expect(ALLOWED_PAYHERE_CHECKOUT_URLS.has("https://sandbox.payhere.lk/pay/checkout")).toBe(true);
    expect(ALLOWED_PAYHERE_CHECKOUT_URLS.has("https://www.payhere.lk/pay/checkout")).toBe(true);

    const liveHandoff = createSamplePayHereHandoff({
      mode: "PAYHERE_LIVE_REDIRECT",
      actionUrl: "https://www.payhere.lk/pay/checkout"
    });
    const { mockDoc } = createMockDom();
    expect(() => buildPayHereCheckoutForm(liveHandoff, mockDoc)).not.toThrow();

    const evilHandoff = createSamplePayHereHandoff({
      actionUrl: "https://evil.phishing.example/pay/checkout" as unknown as PayHereCheckoutHandoff["actionUrl"]
    });
    expect(() => buildPayHereCheckoutForm(evilHandoff, mockDoc)).toThrow(/Untrusted PayHere/);

    const httpDowngrade = createSamplePayHereHandoff({
      actionUrl: "http://sandbox.payhere.lk/pay/checkout" as unknown as PayHereCheckoutHandoff["actionUrl"]
    });
    expect(() => buildPayHereCheckoutForm(httpDowngrade, mockDoc)).toThrow(/Untrusted PayHere/);
  });

  it("ignores URL query payment forgery flags (?status=paid, ?status_code=2, ?md5sig=...) and parses navigation hints safely", () => {
    const forged = parseCheckoutReturnQuery(
      "?order_id=ORD-PH-123&status=paid&status_code=2&payment_id=9999&md5sig=FORGED&paid=true"
    );
    expect(forged.bookingId).toBeNull();
    expect(forged.orderId).toBe("ORD-PH-123");
    expect(forged.cancelledHint).toBe(false);
    expect(forged.ignoredQueryPaymentClaim).toBe(true);

    const cancelled = parseCheckoutReturnQuery("?bookingId=22222222-3333-4444-8555-666666666666&cancelled=1");
    expect(cancelled.bookingId).toBe("22222222-3333-4444-8555-666666666666");
    expect(cancelled.cancelledHint).toBe(true);
    expect(cancelled.ignoredQueryPaymentClaim).toBe(false);
  });

  it("persists, loads, and clears pending PayHere checkout context cleanly", () => {
    const storeMap = new Map<string, string>();
    const storageStub: Storage = {
      get length() {
        return storeMap.size;
      },
      clear: () => storeMap.clear(),
      key: (i) => Array.from(storeMap.keys())[i] ?? null,
      getItem: (k) => storeMap.get(k) ?? null,
      setItem: (k, v) => {
        storeMap.set(k, v);
      },
      removeItem: (k) => {
        storeMap.delete(k);
      }
    };

    savePendingCheckoutContext(
      {
        bookingId: "22222222-3333-4444-8555-666666666666",
        intentId: "11111111-2222-4333-8444-555555555555",
        orderId: "ORD-CTX-1",
        provider: "PAYHERE",
        createdAt: "2026-11-10T10:00:00.000Z"
      },
      storageStub
    );

    const loaded = loadPendingCheckoutContext(storageStub);
    expect(loaded).not.toBeNull();
    expect(loaded?.orderId).toBe("ORD-CTX-1");
    expect(loaded?.provider).toBe("PAYHERE");

    clearPendingCheckoutContext(storageStub);
    expect(loadPendingCheckoutContext(storageStub)).toBeNull();
  });

  it("distinguishes REDIRECT_TO_PROVIDER POST_FORM vs SANDBOX_SIMULATION handoffs and queries authoritative checkout status", async () => {
    const payHereHandoff = createSamplePayHereHandoff();
    const sandboxHandoff: SandboxCheckoutHandoff = {
      mode: "SANDBOX_SIMULATION",
      provider: "SANDBOX_GATEWAY",
      method: "SIMULATED_API",
      intentId: "11111111-2222-4333-8444-555555555555",
      orderId: "ORD-SBX-1",
      amountMinor: 150000,
      currency: "LKR"
    };

    expect(isPayHerePostHandoff(payHereHandoff)).toBe(true);
    expect(isPayHerePostHandoff(sandboxHandoff)).toBe(false);

    setAccessToken("web-traveller-jwt");
    const fetchMock = vi
      .fn()
      // 1. Delayed confirmation: still PENDING_PAYMENT after forged return query
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            bookingId: "22222222-3333-4444-8555-666666666666",
            referenceCode: "LGS-DELAYED1",
            bookingStatus: "PENDING_PAYMENT",
            holdExpiresAt: "2026-11-10T12:00:00.000Z",
            confirmedAt: null,
            canRetryPayment: true,
            custodyReady: false,
            pollRecommended: true,
            paymentIntent: null
          }
        })
      })
      // 2. Manual/poll refresh after webhook arrives -> CONFIRMED & custodyReady
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            bookingId: "22222222-3333-4444-8555-666666666666",
            referenceCode: "LGS-DELAYED1",
            bookingStatus: "CONFIRMED",
            holdExpiresAt: null,
            confirmedAt: "2026-11-10T10:02:00.000Z",
            canRetryPayment: false,
            custodyReady: true,
            pollRecommended: false,
            paymentIntent: null
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const firstStatus = await marketplaceApi.getCheckoutStatus({ orderId: "ORD-PH-WEB-001" });
    expect(firstStatus.bookingStatus).toBe("PENDING_PAYMENT");
    expect(firstStatus.custodyReady).toBe(false);
    expect(firstStatus.pollRecommended).toBe(true);

    const refreshedStatus = await marketplaceApi.getCheckoutStatus({ orderId: "ORD-PH-WEB-001" });
    expect(refreshedStatus.bookingStatus).toBe("CONFIRMED");
    expect(refreshedStatus.custodyReady).toBe(true);
    expect(refreshedStatus.canRetryPayment).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/payments/checkout-status?orderId=ORD-PH-WEB-001"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer web-traveller-jwt"
        })
      })
    );
  });

  it("renders billing fields on live checkout without fake defaults and keeps live forged return locked", () => {
    const uuidLocRoute = "/checkout/11111111-2222-4333-8444-555555555555";
    const checkoutHtml = renderToString(
      <MemoryRouter initialEntries={[uuidLocRoute]}>
        <Routes>
          <Route path="/checkout/:locId" element={<WebCheckoutSchedulePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(checkoutHtml).toContain("First Name");
    expect(checkoutHtml).toContain("Last Name");
    expect(checkoutHtml).toContain("Email Address");
    expect(checkoutHtml).toContain("Phone Number");
    expect(checkoutHtml).toContain("Street Address");
    expect(checkoutHtml).toContain("City");
    expect(checkoutHtml).toContain("Country");
    expect(checkoutHtml).not.toContain("0770000000");

    const liveReturnHtml = renderToString(
      <MemoryRouter
        initialEntries={[
          "/booking/confirm?bookingId=22222222-3333-4444-8555-666666666666&status=paid&status_code=2&md5sig=FAKE"
        ]}
      >
        <Routes>
          <Route path="/booking/confirm" element={<WebPaymentConfirmationPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(liveReturnHtml).toContain("Verifying Booking");
    expect(liveReturnHtml).not.toContain("#LS-2026-8841");
    expect(liveReturnHtml).not.toContain("Issue Check-In Pass");
  });

  it("audits web source code: zero merchant secrets, zero client MD5 hashing, zero synthetic refund IDs, and PayHere branch isolation", () => {
    const publicPagesSrc = fs.readFileSync(
      path.resolve(__dirname, "../src/pages/PublicMarketplacePages.tsx"),
      "utf-8"
    );
    const adminPagesSrc = fs.readFileSync(
      path.resolve(__dirname, "../src/pages/AdminDashboardPages.tsx"),
      "utf-8"
    );
    const handoffLibSrc = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/payment-handoff.ts"),
      "utf-8"
    );

    for (const src of [publicPagesSrc, adminPagesSrc, handoffLibSrc]) {
      expect(src).not.toContain("PAYHERE_MERCHANT_SECRET");
      expect(src).not.toContain("PAYMENT_WEBHOOK_SECRET");
      expect(src).not.toContain('createHash("md5")');
      expect(src).not.toContain("RFD-GW-");
      expect(src).not.toContain("rfnd_");
    }

    expect(publicPagesSrc).toContain('nextAction === "REDIRECT_TO_PROVIDER"');
    expect(publicPagesSrc).toContain("submitPayHereCheckoutForm");
    expect(publicPagesSrc).toContain("parseCheckoutReturnQuery");
    expect(publicPagesSrc).toContain("getCheckoutStatus");
    expect(publicPagesSrc).toContain('nextAction === "SANDBOX_SIMULATION"');

    expect(adminPagesSrc).toContain("PROVIDER_CONFIRMED");
    expect(adminPagesSrc).toContain("MANUAL_OFFLINE");
    expect(adminPagesSrc).toContain("evidenceSource");
    expect(adminPagesSrc).toContain("manualReference");
  });
});
