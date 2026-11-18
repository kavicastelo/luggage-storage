import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  clearMobilePendingCheckoutContext,
  isPayPalCheckoutHandoff,
  isStripeElementsHandoff,
  loadMobilePendingCheckoutContext,
  parseMobileCheckoutReturnQuery,
  saveMobilePendingCheckoutContext
} from "../src/lib/payment-handoff";

describe("Payment Provider Transformation Mobile App Specification", () => {
  const mobileRoot = path.resolve(__dirname, "..");

  it("1. validates Stripe Elements handoff schema identifier for mobile handoff", () => {
    const stripeHandoff = {
      mode: "STRIPE_ELEMENTS" as const,
      provider: "STRIPE" as const,
      method: "STRIPE_ELEMENTS" as const,
      clientSecret: "pi_test_secret_999",
      publishableKey: "pk_test_999",
      paymentIntentId: "pi_test_999"
    };

    expect(isStripeElementsHandoff(stripeHandoff)).toBe(true);
    expect(isPayPalCheckoutHandoff(stripeHandoff)).toBe(false);
  });

  it("2. validates PayPal Checkout handoff schema identifier for mobile handoff", () => {
    const payPalHandoff = {
      mode: "PAYPAL_CHECKOUT" as const,
      provider: "PAYPAL" as const,
      method: "PAYPAL_CHECKOUT" as const,
      orderId: "ORDER-PAYPAL-MOB-1",
      approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-PAYPAL-MOB-1"
    };

    expect(isPayPalCheckoutHandoff(payPalHandoff)).toBe(true);
    expect(isStripeElementsHandoff(payPalHandoff)).toBe(false);
  });

  it("3. saves, loads, and clears multi-provider pending checkout session context for Stripe and PayPal", () => {
    const memoryStore = new Map<string, string>();
    const mockStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
      setItem: (k: string, v: string) => memoryStore.set(k, v),
      getItem: (k: string) => memoryStore.get(k) ?? null,
      removeItem: (k: string) => memoryStore.delete(k)
    };

    saveMobilePendingCheckoutContext(
      {
        bookingId: "bkg-mob-001",
        intentId: "pi-mob-001",
        orderId: "ORD-MOB-001",
        provider: "STRIPE",
        channel: "MOBILE_APP",
        createdAt: "2026-11-19T00:00:00Z"
      },
      mockStorage
    );

    const loadedStripe = loadMobilePendingCheckoutContext(mockStorage);
    expect(loadedStripe?.bookingId).toBe("bkg-mob-001");
    expect(loadedStripe?.provider).toBe("STRIPE");
    expect(loadedStripe?.channel).toBe("MOBILE_APP");

    saveMobilePendingCheckoutContext(
      {
        bookingId: "bkg-mob-002",
        intentId: "pi-mob-002",
        orderId: "ORD-MOB-002",
        provider: "PAYPAL",
        channel: "MOBILE_APP",
        createdAt: "2026-11-19T00:00:00Z"
      },
      mockStorage
    );

    const loadedPayPal = loadMobilePendingCheckoutContext(mockStorage);
    expect(loadedPayPal?.bookingId).toBe("bkg-mob-002");
    expect(loadedPayPal?.provider).toBe("PAYPAL");

    clearMobilePendingCheckoutContext(mockStorage);
    expect(loadMobilePendingCheckoutContext(mockStorage)).toBeNull();
  });

  it("4. parses return query safely without trusting forged query status claims", () => {
    const forgedReturn = parseMobileCheckoutReturnQuery(
      "?bookingId=bkg-return-01&status=SUCCESS&payment_id=spoofed_pay_id&token=EC-FAKE"
    );
    expect(forgedReturn.bookingId).toBe("bkg-return-01");
    expect(forgedReturn.ignoredQueryPaymentClaim).toBe(true);
    expect(forgedReturn.cancelledHint).toBe(false);
  });

  it("5. verifies mobile checkout screen source contains Stripe & PayPal multi-provider selection and no PayHere secrets", () => {
    const checkoutSrc = fs.readFileSync(path.join(mobileRoot, "app/(traveller)/checkout.tsx"), "utf8");

    expect(checkoutSrc).toContain('"STRIPE"');
    expect(checkoutSrc).toContain('"PAYPAL"');
    expect(checkoutSrc).toContain('"SANDBOX_GATEWAY"');
    expect(checkoutSrc).toContain("selectedProvider");
    expect(checkoutSrc).toContain("STRIPE_ELEMENTS_CONFIRM");
    expect(checkoutSrc).toContain("PAYPAL_CHECKOUT_APPROVE");
    expect(checkoutSrc).not.toContain("PAYHERE_MERCHANT_SECRET");
    expect(checkoutSrc).not.toContain("STRIPE_SECRET_KEY");
    expect(checkoutSrc).not.toContain("PAYPAL_CLIENT_SECRET");
  });
});
