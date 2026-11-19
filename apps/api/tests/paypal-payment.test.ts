import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { PayPalGatewayAdapter } from "../src/modules/payments/adapters/paypal.adapter.js";

const { Pool } = pg;

const MOCK_PAYPAL_CLIENT_ID = "mock_paypal_client_id_12345";
const MOCK_PAYPAL_CLIENT_SECRET = "mock_paypal_client_secret_67890";
const MOCK_PAYPAL_WEBHOOK_ID = "mock_paypal_webhook_id_abcde";

describe("PayPal Alternative Payment Integration & Webhook Lifecycle", () => {
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

  it("1. caches OAuth 2.0 access token without repeated authentication handshakes", async () => {
    const adapter = new PayPalGatewayAdapter(
      MOCK_PAYPAL_CLIENT_ID,
      MOCK_PAYPAL_CLIENT_SECRET,
      MOCK_PAYPAL_WEBHOOK_ID,
      true
    );

    let fetchCount = 0;
    // Mock global fetch for OAuth endpoint
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, opts: any) => {
      if (String(url).includes("/v1/oauth2/token")) {
        fetchCount++;
        return new Response(
          JSON.stringify({
            access_token: "mock_paypal_bearer_token_xyz",
            expires_in: 3600
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, opts);
    };

    try {
      const token1 = await adapter.getAccessToken();
      const token2 = await adapter.getAccessToken();
      expect(token1).toBe("mock_paypal_bearer_token_xyz");
      expect(token2).toBe("mock_paypal_bearer_token_xyz");
      expect(fetchCount).toBe(1); // Cached! No redundant network call
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("2. creates PayPal order and extracts approve HATEOAS link", async () => {
    const adapter = new PayPalGatewayAdapter(
      MOCK_PAYPAL_CLIENT_ID,
      MOCK_PAYPAL_CLIENT_SECRET,
      MOCK_PAYPAL_WEBHOOK_ID,
      true
    );

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, opts: any) => {
      if (String(url).includes("/v1/oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "mock_token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (String(url).includes("/v2/checkout/orders")) {
        return new Response(
          JSON.stringify({
            id: "ORDER-PP-12345",
            status: "CREATED",
            links: [
              { href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-PP-12345", rel: "approve" },
              { href: "https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER-PP-12345", rel: "self" }
            ]
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, opts);
    };

    try {
      const handoff = await adapter.buildCheckoutPayload({
        intentId: "00000000-0000-0000-0000-000000000010",
        bookingId: "00000000-0000-0000-0000-000000000011",
        referenceCode: "BK-PAYPAL-001",
        providerOrderId: "ORD-BK-PAYPAL-001-A1B2",
        amountMinor: 4500,
        currency: "USD",
        customerEmail: "traveller@example.com",
        customerName: "Jane Doe"
      });

      expect(handoff.mode).toBe("PAYPAL_CHECKOUT");
      expect(handoff.provider).toBe("PAYPAL");
      expect(handoff.orderId).toBe("ORDER-PP-12345");
      expect(handoff.approveUrl).toBe(
        "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-PP-12345"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("3. normalizes PAYMENT.CAPTURE.COMPLETED into verified SUCCEEDED status", async () => {
    const adapter = new PayPalGatewayAdapter(
      MOCK_PAYPAL_CLIENT_ID,
      MOCK_PAYPAL_CLIENT_SECRET,
      MOCK_PAYPAL_WEBHOOK_ID,
      true
    );

    const payload = JSON.stringify({
      id: "WH-EVT-PP-001",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      create_time: "2026-11-19T00:00:00Z",
      resource: {
        id: "CAPTURE-PP-99999",
        status: "COMPLETED",
        amount: {
          value: "45.00",
          currency_code: "USD"
        },
        invoice_id: "ORD-BK-PAYPAL-001-A1B2",
        reference_id: "00000000-0000-0000-0000-000000000010"
      }
    });

    const normalized = await adapter.normalizeVerifiedNotification({
      rawBody: payload,
      headers: {
        "x-mock-paypal-verified": "true"
      }
    });

    expect(normalized.provider).toBe("PAYPAL");
    expect(normalized.providerEventId).toBe("WH-EVT-PP-001");
    expect(normalized.status).toBe("SUCCEEDED");
    expect(normalized.amountMinor).toBe(4500);
    expect(normalized.currency).toBe("USD");
    expect(normalized.providerTransactionId).toBe("CAPTURE-PP-99999");
    expect(normalized.providerOrderId).toBe("ORD-BK-PAYPAL-001-A1B2");
    expect(normalized.paymentIntentId).toBe("00000000-0000-0000-0000-000000000010");
  });

  it("4. handles PAYMENT.CAPTURE.DENIED as FAILED with failure reason", async () => {
    const adapter = new PayPalGatewayAdapter(
      MOCK_PAYPAL_CLIENT_ID,
      MOCK_PAYPAL_CLIENT_SECRET,
      MOCK_PAYPAL_WEBHOOK_ID,
      true
    );

    const payload = JSON.stringify({
      id: "WH-EVT-PP-002",
      event_type: "PAYMENT.CAPTURE.DENIED",
      resource: {
        id: "CAPTURE-PP-DENIED",
        status: "DECLINED",
        amount: { value: "30.00", currency_code: "USD" },
        status_details: { reason: "BUYER_COMPLAINT" }
      }
    });

    const normalized = await adapter.normalizeVerifiedNotification({
      rawBody: payload,
      headers: {
        "x-mock-paypal-verified": "true"
      }
    });

    expect(normalized.provider).toBe("PAYPAL");
    expect(normalized.status).toBe("FAILED");
    expect(normalized.failureReason).toBe("BUYER_COMPLAINT");
  });

  it("5. executes programmatic refunds via PayPal REST API", async () => {
    const adapter = new PayPalGatewayAdapter(
      MOCK_PAYPAL_CLIENT_ID,
      MOCK_PAYPAL_CLIENT_SECRET,
      MOCK_PAYPAL_WEBHOOK_ID,
      true
    );

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, opts: any) => {
      if (String(url).includes("/v1/oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "mock_token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (String(url).includes("/refund")) {
        return new Response(
          JSON.stringify({
            id: "REFUND-PP-77777",
            status: "COMPLETED",
            amount: { value: "20.00", currency_code: "USD" }
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, opts);
    };

    try {
      const result = await adapter.createRefund({
        refundId: "00000000-0000-0000-0000-000000000020",
        bookingId: "00000000-0000-0000-0000-000000000021",
        paymentIntentId: "pi_mock",
        providerTransactionId: "CAPTURE-PP-99999",
        amountMinor: 2000,
        currency: "USD",
        reason: "Customer cancellation request"
      });

      expect(result.status).toBe("SUCCEEDED");
      expect(result.providerRefundId).toBe("REFUND-PP-77777");
      expect(result.amountMinor).toBe(2000);
      expect(result.currency).toBe("USD");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

