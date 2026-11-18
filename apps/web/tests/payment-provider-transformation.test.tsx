import { describe, it, expect } from "vitest";
import {
  parseCheckoutReturnQuery,
  isStripeElementsHandoff,
  isPayPalCheckoutHandoff,
  savePendingCheckoutContext,
  loadPendingCheckoutContext,
  clearPendingCheckoutContext
} from "../src/lib/payment-handoff";

describe("Payment Provider Transformation Web Frontend Specification", () => {
  it("1. ignores forged query string payment claims on checkout return", () => {
    const maliciousQuery =
      "?bookingId=00000000-0000-0000-0000-000000000001&status=paid&status_code=2&payment_id=forged_123&md5sig=fakehash";

    const parsed = parseCheckoutReturnQuery(maliciousQuery);

    expect(parsed.bookingId).toBe("00000000-0000-0000-0000-000000000001");
    expect(parsed.ignoredQueryPaymentClaim).toBe(true);
    expect(parsed.cancelledHint).toBe(false);
  });

  it("2. detects user cancellation query hint cleanly", () => {
    const cancelQuery = "?bookingId=00000000-0000-0000-0000-000000000002&cancelled=1";

    const parsed = parseCheckoutReturnQuery(cancelQuery);

    expect(parsed.bookingId).toBe("00000000-0000-0000-0000-000000000002");
    expect(parsed.cancelledHint).toBe(true);
  });

  it("3. validates Stripe Elements handoff schema identifier", () => {
    const stripeHandoff = {
      mode: "STRIPE_ELEMENTS" as const,
      provider: "STRIPE" as const,
      method: "STRIPE_ELEMENTS" as const,
      clientSecret: "pi_test_secret_123",
      publishableKey: "pk_test_123",
      paymentIntentId: "pi_test_123"
    };

    expect(isStripeElementsHandoff(stripeHandoff)).toBe(true);
    expect(isPayPalCheckoutHandoff(stripeHandoff)).toBe(false);
  });

  it("4. validates PayPal Checkout handoff schema identifier", () => {
    const payPalHandoff = {
      mode: "PAYPAL_CHECKOUT" as const,
      provider: "PAYPAL" as const,
      method: "PAYPAL_CHECKOUT" as const,
      orderId: "ORDER-12345",
      approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-12345"
    };

    expect(isPayPalCheckoutHandoff(payPalHandoff)).toBe(true);
    expect(isStripeElementsHandoff(payPalHandoff)).toBe(false);
  });

  it("5. saves, loads, and clears multi-provider pending checkout session context", () => {
    const memoryStore = new Map<string, string>();
    const mockStorage = {
      setItem: (k: string, v: string) => memoryStore.set(k, v),
      getItem: (k: string) => memoryStore.get(k) ?? null,
      removeItem: (k: string) => memoryStore.delete(k)
    };

    savePendingCheckoutContext(
      {
        bookingId: "bkg_001",
        intentId: "pi_001",
        orderId: "ORD-001",
        provider: "STRIPE",
        channel: "WEB",
        createdAt: "2026-11-19T00:00:00Z"
      },
      mockStorage
    );

    const loaded = loadPendingCheckoutContext(mockStorage);
    expect(loaded?.bookingId).toBe("bkg_001");
    expect(loaded?.provider).toBe("STRIPE");

    clearPendingCheckoutContext(mockStorage);
    expect(loadPendingCheckoutContext(mockStorage)).toBeNull();
  });
});
