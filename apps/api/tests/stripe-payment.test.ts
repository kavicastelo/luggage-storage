import crypto from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { StripeGatewayAdapter } from "../src/modules/payments/adapters/stripe.adapter.js";

const { Pool } = pg;

const MOCK_STRIPE_SECRET = "sk_test_mock_stripe_secret_key_12345";
const MOCK_STRIPE_PUB = "pk_test_mock_stripe_publishable_key_12345";
const MOCK_STRIPE_WH_SECRET = "whsec_mock_stripe_webhook_secret_67890";

describe("Stripe Primary Payment Integration & Webhook Lifecycle", () => {
  let app: FastifyInstance;
  let runtimePool: pg.Pool;

  beforeAll(async () => {
    runtimePool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: false,
      max: 3
    });
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await runtimePool.end();
  });

  it("1. builds valid Stripe Elements checkout handoff without secret leakage", async () => {
    const adapter = new StripeGatewayAdapter(
      MOCK_STRIPE_SECRET,
      MOCK_STRIPE_PUB,
      MOCK_STRIPE_WH_SECRET
    );

    // Mock stripe.paymentIntents.create
    const mockPi = {
      id: "pi_test_1234567890",
      client_secret: "pi_test_1234567890_secret_abc123"
    };
    (adapter as any).stripe.paymentIntents.create = async () => mockPi;

    const handoff = await adapter.buildCheckoutPayload({
      intentId: "00000000-0000-0000-0000-000000000001",
      bookingId: "00000000-0000-0000-0000-000000000002",
      referenceCode: "BK-STRIPE-001",
      providerOrderId: "ORD-BK-STRIPE-001-A1B2",
      amountMinor: 2500,
      currency: "USD",
      customerEmail: "traveller@example.com",
      customerName: "Jane Doe"
    });

    expect(handoff.mode).toBe("STRIPE_ELEMENTS");
    expect(handoff.provider).toBe("STRIPE");
    expect(handoff.clientSecret).toBe("pi_test_1234567890_secret_abc123");
    expect(handoff.publishableKey).toBe(MOCK_STRIPE_PUB);
    expect(handoff.paymentIntentId).toBe("pi_test_1234567890");
    // Ensure raw secret key is NOT present in customer payload
    expect(JSON.stringify(handoff)).not.toContain(MOCK_STRIPE_SECRET);
  });

  it("2. constructs and verifies cryptographic Stripe webhook signatures", () => {
    const adapter = new StripeGatewayAdapter(
      MOCK_STRIPE_SECRET,
      MOCK_STRIPE_PUB,
      MOCK_STRIPE_WH_SECRET
    );

    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      id: "evt_test_stripe_001",
      object: "event",
      type: "payment_intent.succeeded",
      created: timestamp,
      data: {
        object: {
          id: "pi_test_001",
          amount: 3500,
          currency: "usd",
          latest_charge: "ch_test_charge_001",
          metadata: {
            intentId: "00000000-0000-0000-0000-000000000003",
            providerOrderId: "ORD-TEST-001"
          }
        }
      }
    });

    // Generate valid Stripe signature header: t=timestamp,v1=HMAC-SHA256(timestamp.payload)
    const signature = crypto
      .createHmac("sha256", MOCK_STRIPE_WH_SECRET)
      .update(`${timestamp}.${payload}`, "utf8")
      .digest("hex");
    const sigHeader = `t=${timestamp},v1=${signature}`;

    const normalized = adapter.normalizeVerifiedNotification({
      rawBody: payload,
      headers: {
        "stripe-signature": sigHeader
      }
    });

    expect(normalized.provider).toBe("STRIPE");
    expect(normalized.providerEventId).toBe("evt_test_stripe_001");
    expect(normalized.status).toBe("SUCCEEDED");
    expect(normalized.amountMinor).toBe(3500);
    expect(normalized.currency).toBe("USD");
    expect(normalized.providerTransactionId).toBe("ch_test_charge_001");
    expect(normalized.paymentIntentId).toBe("00000000-0000-0000-0000-000000000003");
  });

  it("3. rejects tampered Stripe webhook payload with unauthorized error", () => {
    const adapter = new StripeGatewayAdapter(
      MOCK_STRIPE_SECRET,
      MOCK_STRIPE_PUB,
      MOCK_STRIPE_WH_SECRET
    );

    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ id: "evt_test_002" });
    const invalidSigHeader = `t=${timestamp},v1=invalid_signature_hex_digest`;

    expect(() =>
      adapter.normalizeVerifiedNotification({
        rawBody: payload,
        headers: {
          "stripe-signature": invalidSigHeader
        }
      })
    ).toThrow(/Invalid Stripe webhook cryptographic signature/i);
  });

  it("4. handles Stripe dispute charge.dispute.created as CHARGEDBACK", () => {
    const adapter = new StripeGatewayAdapter(
      MOCK_STRIPE_SECRET,
      MOCK_STRIPE_PUB,
      MOCK_STRIPE_WH_SECRET
    );

    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      id: "evt_test_dispute_001",
      type: "charge.dispute.created",
      created: timestamp,
      data: {
        object: {
          id: "dp_test_001",
          amount: 5000,
          currency: "usd",
          metadata: {
            providerOrderId: "ORD-DISPUTE-001"
          }
        }
      }
    });

    const signature = crypto
      .createHmac("sha256", MOCK_STRIPE_WH_SECRET)
      .update(`${timestamp}.${payload}`, "utf8")
      .digest("hex");

    const normalized = adapter.normalizeVerifiedNotification({
      rawBody: payload,
      headers: {
        "stripe-signature": `t=${timestamp},v1=${signature}`
      }
    });

    expect(normalized.provider).toBe("STRIPE");
    expect(normalized.status).toBe("CHARGEDBACK");
    expect(normalized.failureReason).toContain("disputed");
  });

  it("5. executes programmatic refunds via Stripe SDK", async () => {
    const adapter = new StripeGatewayAdapter(
      MOCK_STRIPE_SECRET,
      MOCK_STRIPE_PUB,
      MOCK_STRIPE_WH_SECRET
    );

    // Mock stripe.refunds.create
    (adapter as any).stripe.refunds.create = async (params: any) => ({
      id: "re_test_mock_refund_123",
      amount: params.amount,
      currency: "usd",
      status: "succeeded"
    });

    const result = await adapter.createRefund({
      refundId: "00000000-0000-0000-0000-000000000005",
      bookingId: "00000000-0000-0000-0000-000000000006",
      paymentIntentId: "pi_test_001",
      providerTransactionId: "ch_test_charge_001",
      amountMinor: 2500,
      currency: "USD",
      reason: "Customer requested cancellation"
    });

    expect(result.status).toBe("SUCCEEDED");
    expect(result.providerRefundId).toBe("re_test_mock_refund_123");
    expect(result.amountMinor).toBe(2500);
    expect(result.currency).toBe("USD");
  });
});

