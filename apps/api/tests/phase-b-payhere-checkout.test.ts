import crypto from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { env, loadConfig } from "../src/config/env.js";
import { rateLimitService } from "../src/modules/auth/rate-limit.service.js";
import { PayHereGatewayAdapter } from "../src/modules/payments/payment-gateway.port.js";

const { Pool } = pg;

const TEST_PAYHERE_MERCHANT_ID = "1219999";
const TEST_PAYHERE_MERCHANT_SECRET = "payhere_checkout_b7_test_secret_key_32_chars!";

function buildProdEnvFixture(overrides?: Record<string, string | undefined>): Record<string, string | undefined> {
  const base: Record<string, string | undefined> = {
    NODE_ENV: "production",
    PORT: "3000",
    HOST: "0.0.0.0",
    LOG_LEVEL: "info",
    DATABASE_URL: "postgresql://luggage_user:luggage_password@db.luggagevault.lk:5432/luggage_prod",
    MIGRATION_DATABASE_URL:
      "postgresql://luggage_migrator:migrator_password@db.luggagevault.lk:5432/luggage_prod",
    DATABASE_SSL: "true",
    DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
    CORS_ORIGIN: "https://app.luggagevault.lk",
    APP_PUBLIC_URL: "https://app.luggagevault.lk",
    JWT_SECRET: "prod_jwt_secret_distinct_at_least_32_chars_a1",
    COOKIE_SECRET: "prod_cookie_secret_distinct_at_least_32_chars_b2",
    RATE_LIMIT_HASH_SECRET: "prod_ratelimit_secret_distinct_at_least_32_chars_c3",
    EMAIL_PROVIDER: "zoho",
    ZOHO_SMTP_HOST: "smtp.zoho.com",
    ZOHO_SMTP_PORT: "465",
    ZOHO_SMTP_SECURE: "true",
    ZOHO_SMTP_REQUIRE_TLS: "true",
    ZOHO_SMTP_USER: "noreply@luggagevault.lk",
    ZOHO_SMTP_PASSWORD: "zoho_smtp_app_password_prod_99",
    STORAGE_PROVIDER: "r2",
    R2_ACCOUNT_ID: "r2_account_prod_001",
    R2_ACCESS_KEY_ID: "r2_access_key_prod_001",
    R2_SECRET_ACCESS_KEY: "r2_secret_access_key_prod_001",
    R2_BUCKET_NAME: "luggage-storage-prod",
    PAYOUT_ENCRYPTION_KEY: "prod_payout_encryption_key_distinct_32_chars_d4",
    DB_IDENTITY_SECRET: "prod_db_identity_secret_distinct_32_chars_e5",
    PAYMENT_WEBHOOK_SECRET: "prod_payment_webhook_secret_distinct_32_chars_f6",
    CUSTODY_TOKEN_HMAC_SECRET: "prod_custody_hmac_secret_distinct_32_chars_g7",
    PAYMENT_PROVIDER: "payhere",
    PAYHERE_SANDBOX_MODE: "false",
    PAYHERE_MERCHANT_ID: "2218888",
    PAYHERE_MERCHANT_SECRET: "prod_payhere_merchant_secret_key_distinct_h8",
    PAYHERE_NOTIFY_URL: "https://api.luggagevault.lk/api/v1/payments/webhooks/payhere",
    PAYHERE_RETURN_URL: "https://app.luggagevault.lk/booking/confirm",
    PAYHERE_CANCEL_URL: "https://app.luggagevault.lk/booking/confirm?cancelled=1"
  };

  if (!overrides) return base;
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete base[k];
    } else {
      base[k] = v;
    }
  }
  return base;
}

describe("Phase B7 — Complete PayHere Checkout Contract, Handoff Endpoint & Status Verification", () => {
  let app: FastifyInstance;
  let migratorPool: pg.Pool;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    migratorPool = new Pool({
      connectionString: env.MIGRATION_DATABASE_URL,
      max: 6
    });
  });

  beforeEach(async () => {
    await rateLimitService.clearAll();
  });

  afterAll(async () => {
    await app.close();
    await migratorPool.end();
  });

  async function withPayHereEnv<T>(
    options: { sandboxMode?: boolean },
    fn: () => Promise<T>
  ): Promise<T> {
    const prevProvider = env.PAYMENT_PROVIDER;
    const prevMerchantId = env.PAYHERE_MERCHANT_ID;
    const prevMerchantSecret = env.PAYHERE_MERCHANT_SECRET;
    const prevSandboxMode = env.PAYHERE_SANDBOX_MODE;
    const prevNotifyUrl = env.PAYHERE_NOTIFY_URL;
    const prevReturnUrl = env.PAYHERE_RETURN_URL;
    const prevCancelUrl = env.PAYHERE_CANCEL_URL;

    env.PAYMENT_PROVIDER = "payhere";
    env.PAYHERE_MERCHANT_ID = TEST_PAYHERE_MERCHANT_ID;
    env.PAYHERE_MERCHANT_SECRET = TEST_PAYHERE_MERCHANT_SECRET;
    env.PAYHERE_SANDBOX_MODE = options.sandboxMode ?? true;
    env.PAYHERE_NOTIFY_URL = "https://api.luggagevault.lk/api/v1/payments/webhooks/payhere";
    env.PAYHERE_RETURN_URL = "https://app.luggagevault.lk/booking/confirm";
    env.PAYHERE_CANCEL_URL = "https://app.luggagevault.lk/booking/confirm?cancelled=1";

    try {
      return await fn();
    } finally {
      env.PAYMENT_PROVIDER = prevProvider;
      env.PAYHERE_MERCHANT_ID = prevMerchantId;
      env.PAYHERE_MERCHANT_SECRET = prevMerchantSecret;
      env.PAYHERE_SANDBOX_MODE = prevSandboxMode;
      env.PAYHERE_NOTIFY_URL = prevNotifyUrl;
      env.PAYHERE_RETURN_URL = prevReturnUrl;
      env.PAYHERE_CANCEL_URL = prevCancelUrl;
    }
  }

  async function createTestUser(
    roleCode: "TRAVELLER" | "HOST_OWNER" = "TRAVELLER",
    displayName = "PayHere Checkout User"
  ) {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const email = `ph_b7_${unique}@example.com`;
    const password = "StrongPassword123!";

    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password, displayName }
    });
    expect(regRes.statusCode).toBe(201);
    const userId = JSON.parse(regRes.body).data.id as string;

    if (roleCode !== "TRAVELLER") {
      const roleRes = await migratorPool.query("SELECT id FROM roles WHERE code = $1 LIMIT 1;", [
        roleCode
      ]);
      await migratorPool.query(
        "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
        [userId, roleRes.rows[0].id]
      );
    }

    await migratorPool.query(
      "UPDATE users SET status = 'ACTIVE', is_email_verified = true WHERE id = $1;",
      [userId]
    );

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password, clientType: "WEB" }
    });
    expect(loginRes.statusCode).toBe(200);

    return {
      userId,
      email,
      accessToken: JSON.parse(loginRes.body).data.accessToken as string
    };
  }

  async function createActiveLocation() {
    const owner = await createTestUser("HOST_OWNER", "Host Checkout B7");
    const bizRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/businesses",
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        legalBusinessName: `B7 Storage Ltd ${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        tradeName: "Kandy Station Lockers",
        entityType: "RETAIL_SHOP",
        contactEmail: `biz_${Date.now()}@kandylockers.lk`,
        contactPhone: "+94771234567",
        city: "Kandy"
      }
    });
    expect(bizRes.statusCode).toBe(201);
    const businessId = JSON.parse(bizRes.body).data.id as string;
    await migratorPool.query("UPDATE host_businesses SET status = 'ACTIVE' WHERE id = $1;", [
      businessId
    ]);

    const locRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/locations",
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        businessId,
        name: `Kandy Hub ${Math.random().toString(36).slice(2, 6)}`,
        description: "Verified luggage counter next to Kandy Railway Station",
        addressLine1: "12 Peradeniya Road, Kandy",
        city: "Kandy",
        postalCode: "20000",
        latitude: 7.2906,
        longitude: 80.6337,
        timezone: "Asia/Colombo",
        bookingMode: "INSTANT",
        acceptsOversized: true
      }
    });
    expect(locRes.statusCode).toBe(201);
    const locationId = JSON.parse(locRes.body).data.id as string;

    const schedules = [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
      dayOfWeek,
      openTime: "08:00",
      closeTime: "22:00",
      isClosed: false
    }));
    await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/opening-hours`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { schedules }
    });

    const zoneRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/locations/${locationId}/zones`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { name: "Vault Zone B7", zoneType: "LOCKER" }
    });
    const zoneId = JSON.parse(zoneRes.body).data.id as string;

    const poolsRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/locations/${locationId}/capacity-pools`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    const pools = JSON.parse(poolsRes.body).data.pools as Array<{ id: string }>;
    await app.inject({
      method: "PATCH",
      url: `/api/v1/hosts/capacity-pools/${pools[0].id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { zoneId, totalUnits: 20, isActive: true }
    });

    await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/pricing`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        currency: "LKR",
        pricingUnit: "CALENDAR_DAY",
        baseRateMinor: 120000,
        tierRates: [
          { bagCategory: "BAG_SMALL", rateMinor: 80000, categoryMultiplierBps: 7000 },
          { bagCategory: "BAG_MEDIUM", rateMinor: 120000, categoryMultiplierBps: 10000 },
          { bagCategory: "BAG_LARGE", rateMinor: 150000, categoryMultiplierBps: 13000 },
          { bagCategory: "BAG_OVERSIZED", rateMinor: 220000, categoryMultiplierBps: 20000 }
        ]
      }
    });

    await migratorPool.query("UPDATE storage_locations SET status = 'ACTIVE' WHERE id = $1;", [
      locationId
    ]);
    return { locationId };
  }

  async function createBooking(travellerToken: string, locationId: string, daysAhead = 10) {
    const base = new Date();
    base.setUTCDate(base.getUTCDate() + daysAhead);
    const yyyy = base.getUTCFullYear();
    const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(base.getUTCDate()).padStart(2, "0");

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/bookings",
      headers: { authorization: `Bearer ${travellerToken}` },
      payload: {
        locationId,
        dropOffAt: `${yyyy}-${mm}-${dd}T04:30:00.000Z`,
        collectionAt: `${yyyy}-${mm}-${dd}T11:30:00.000Z`,
        items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
      }
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body).data as {
      id: string;
      referenceCode: string;
      totalAmountMinor: number;
      currency: string;
    };
  }

  it("1-3. produces complete 16-field PayHere sandbox & live checkout handoffs with valid MD5 hash and zero secret leakage", async () => {
    const { locationId } = await createActiveLocation();
    const traveller = await createTestUser("TRAVELLER", "Nimal Fernando");

    // 1. Sandbox mode checkout
    await withPayHereEnv({ sandboxMode: true }, async () => {
      const booking = await createBooking(traveller.accessToken, locationId, 8);
      const intentRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          bookingId: booking.id,
          customerDetails: {
            firstName: "Nimal",
            lastName: "Fernando",
            email: traveller.email,
            phone: "+94771234567",
            address: "42 Peradeniya Road",
            city: "Kandy",
            country: "Sri Lanka"
          }
        }
      });
      expect(intentRes.statusCode).toBe(201);
      expect(intentRes.body).not.toContain(TEST_PAYHERE_MERCHANT_SECRET);

      const intent = JSON.parse(intentRes.body).data;
      expect(intent.nextAction).toBe("REDIRECT_TO_PROVIDER");
      expect(intent.checkoutHandoff.mode).toBe("PAYHERE_SANDBOX_REDIRECT");
      expect(intent.checkoutHandoff.method).toBe("POST_FORM");
      expect(intent.checkoutHandoff.actionUrl).toBe("https://sandbox.payhere.lk/pay/checkout");
      expect(intent.checkoutHandoff.mobileHandoffPath).toMatch(
        /^\/payments\/handoff\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
      );

      const f = intent.checkoutHandoff.fields;
      const requiredKeys = [
        "merchant_id",
        "return_url",
        "cancel_url",
        "notify_url",
        "order_id",
        "items",
        "currency",
        "amount",
        "first_name",
        "last_name",
        "email",
        "phone",
        "address",
        "city",
        "country",
        "hash"
      ];
      for (const k of requiredKeys) {
        expect(typeof f[k]).toBe("string");
        expect(f[k].length).toBeGreaterThan(0);
      }

      expect(f.merchant_id).toBe(TEST_PAYHERE_MERCHANT_ID);
      expect(f.return_url).toBe("https://app.luggagevault.lk/booking/confirm");
      expect(f.cancel_url).toBe("https://app.luggagevault.lk/booking/confirm?cancelled=1");
      expect(f.notify_url).toBe("https://api.luggagevault.lk/api/v1/payments/webhooks/payhere");
      expect(f.amount).toBe("1200.00");
      expect(f.currency).toBe("LKR");
      expect(f.custom_1).toBe(intent.id);
      expect(f.custom_2).toBe(booking.id);

      const hashedSecret = crypto
        .createHash("md5")
        .update(TEST_PAYHERE_MERCHANT_SECRET, "utf8")
        .digest("hex")
        .toUpperCase();
      const expectedHash = crypto
        .createHash("md5")
        .update(`${TEST_PAYHERE_MERCHANT_ID}${f.order_id}1200.00LKR${hashedSecret}`, "utf8")
        .digest("hex")
        .toUpperCase();
      expect(f.hash).toBe(expectedHash);
    });

    // 2. Live mode action URL
    await withPayHereEnv({ sandboxMode: false }, async () => {
      const booking = await createBooking(traveller.accessToken, locationId, 9);
      const intentRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          bookingId: booking.id,
          customerDetails: {
            firstName: "Nimal",
            lastName: "Fernando",
            email: traveller.email,
            phone: "+94771234567",
            address: "42 Peradeniya Road",
            city: "Kandy",
            country: "Sri Lanka"
          }
        }
      });
      expect(intentRes.statusCode).toBe(201);
      const intent = JSON.parse(intentRes.body).data;
      expect(intent.checkoutHandoff.mode).toBe("PAYHERE_LIVE_REDIRECT");
      expect(intent.checkoutHandoff.actionUrl).toBe("https://www.payhere.lk/pay/checkout");
    });
  });

  it("4-6. fails closed (400) when billing fields missing, merges persisted profile + partial customerDetails, and rejects client-supplied callback/hash overrides", async () => {
    const { locationId } = await createActiveLocation();
    const traveller = await createTestUser("TRAVELLER", "Amaya Jayawardena");

    await withPayHereEnv({ sandboxMode: true }, async () => {
      const b1 = await createBooking(traveller.accessToken, locationId, 11);

      // Missing phone/address/city/country fails closed without inventing fake defaults
      const missingRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { bookingId: b1.id }
      });
      expect(missingRes.statusCode).toBe(400);

      // Client overrides / strict fields rejected with 400
      for (const badPayload of [
        { bookingId: b1.id, notify_url: "https://evil.example/hook" },
        { bookingId: b1.id, return_url: "https://evil.example/return" },
        { bookingId: b1.id, cancel_url: "https://evil.example/cancel" },
        { bookingId: b1.id, hash: "00000000000000000000000000000000" },
        { bookingId: b1.id, merchant_id: "9999999" },
        { bookingId: b1.id, amount: "1.00" }
      ]) {
        const strictRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/intents",
          headers: { authorization: `Bearer ${traveller.accessToken}` },
          payload: badPayload
        });
        expect(strictRes.statusCode).toBe(400);
      }

      // Persisted users + traveller_profiles merge with partial customerDetails (address, city, country)
      await migratorPool.query("UPDATE users SET phone_number = $1 WHERE id = $2;", [
        "+94779998877",
        traveller.userId
      ]);
      await migratorPool.query(
        `INSERT INTO traveller_profiles (user_id, first_name, last_name)
         VALUES ($1, 'Amaya', 'ProfileLast')
         ON CONFLICT (user_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name;`,
        [traveller.userId]
      );

      const mergedRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          bookingId: b1.id,
          customerDetails: {
            address: "18 Dalada Veediya",
            city: "Kandy",
            country: "Sri Lanka"
          }
        }
      });
      expect(mergedRes.statusCode).toBe(201);
      const mergedIntent = JSON.parse(mergedRes.body).data;
      expect(mergedIntent.checkoutHandoff.fields.first_name).toBe("Amaya");
      expect(mergedIntent.checkoutHandoff.fields.last_name).toBe("ProfileLast");
      expect(mergedIntent.checkoutHandoff.fields.email).toBe(traveller.email);
      expect(mergedIntent.checkoutHandoff.fields.phone).toBe("+94779998877");
      expect(mergedIntent.checkoutHandoff.fields.address).toBe("18 Dalada Veediya");
      expect(mergedIntent.checkoutHandoff.fields.city).toBe("Kandy");
      expect(mergedIntent.checkoutHandoff.fields.country).toBe("Sri Lanka");
    });
  });

  it("7. loadConfig fails closed for missing PayHere URLs and unsafe production URLs (http, localhost, private IP, placeholder, credentials)", () => {
    expect(() => loadConfig(buildProdEnvFixture())).not.toThrow();

    expect(() => loadConfig(buildProdEnvFixture({ PAYHERE_NOTIFY_URL: undefined }))).toThrow();
    expect(() => loadConfig(buildProdEnvFixture({ PAYHERE_RETURN_URL: undefined }))).toThrow();
    expect(() => loadConfig(buildProdEnvFixture({ PAYHERE_CANCEL_URL: undefined }))).toThrow();

    for (const unsafeUrl of [
      "http://api.luggagevault.lk/api/v1/payments/webhooks/payhere",
      "https://localhost:3000/api/v1/payments/webhooks/payhere",
      "https://127.0.0.1/api/v1/payments/webhooks/payhere",
      "https://10.0.0.5/api/v1/payments/webhooks/payhere",
      "https://192.168.1.50/api/v1/payments/webhooks/payhere",
      "https://api.example.com/api/v1/payments/webhooks/payhere",
      "https://REPLACE_WITH_API_ORIGIN/api/v1/payments/webhooks/payhere",
      "https://user:pass@api.luggagevault.lk/api/v1/payments/webhooks/payhere"
    ]) {
      expect(() =>
        loadConfig(buildProdEnvFixture({ PAYHERE_NOTIFY_URL: unsafeUrl }))
      ).toThrow();
    }
  });

  it("8-10. serves CSP-hardened handoff bridge, isolates sandbox simulation, and enforces authoritative checkout-status polling", async () => {
    const { locationId } = await createActiveLocation();
    const traveller = await createTestUser("TRAVELLER", "Dinesh Mendis");
    const otherTraveller = await createTestUser("TRAVELLER", "Other Intruder");

    // 8 + 9 + 10 in PayHere mode
    let payHereOrderId = "";
    let payHereIntentId = "";
    let payHereBookingId = "";
    let payHereHandoffPath = "";

    await withPayHereEnv({ sandboxMode: true }, async () => {
      const booking = await createBooking(traveller.accessToken, locationId, 12);
      payHereBookingId = booking.id;

      const intentRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          bookingId: booking.id,
          customerDetails: {
            firstName: "Dinesh",
            lastName: "Mendis",
            email: traveller.email,
            phone: "+94771234567",
            address: "75 Lake Road",
            city: "Kandy",
            country: "Sri Lanka"
          }
        }
      });
      expect(intentRes.statusCode).toBe(201);
      const intent = JSON.parse(intentRes.body).data;
      payHereOrderId = intent.providerOrderId;
      payHereIntentId = intent.id;
      payHereHandoffPath = intent.checkoutHandoff.mobileHandoffPath;

      // 8a. Valid handoff HTML response with CSP & cache headers and zero secrets
      const handoffRes = await app.inject({
        method: "GET",
        url: `/api/v1${payHereHandoffPath}`
      });
      expect(handoffRes.statusCode).toBe(200);
      expect(handoffRes.headers["content-type"]).toContain("text/html");
      expect(handoffRes.headers["cache-control"]).toContain("no-store");
      expect(handoffRes.headers["x-frame-options"]).toBe("DENY");
      const csp = String(handoffRes.headers["content-security-policy"] || "");
      expect(csp).toContain("form-action https://sandbox.payhere.lk https://www.payhere.lk");
      expect(csp).toContain("script-src 'nonce-");
      expect(handoffRes.body).toContain('action="https://sandbox.payhere.lk/pay/checkout"');
      expect(handoffRes.body).toContain(payHereOrderId);
      expect(handoffRes.body).not.toContain(TEST_PAYHERE_MERCHANT_SECRET);

      // 8b. Tampered handoff token rejected
      const tamperedTokenRes = await app.inject({
        method: "GET",
        url: `/api/v1${payHereHandoffPath.slice(0, -4)}XXXX`
      });
      expect(tamperedTokenRes.statusCode).toBe(401);

      // 9a. Sandbox simulation blocked when PAYHERE provider active or on PAYHERE intents (403)
      const simBlocked = await app.inject({
        method: "POST",
        url: `/api/v1/payments/intents/${payHereIntentId}/sandbox-simulate`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { outcome: "SUCCEEDED" }
      });
      expect(simBlocked.statusCode).toBe(403);

      // 10a. Other traveller forbidden (403) on checkout-status
      const otherStatusRes = await app.inject({
        method: "GET",
        url: `/api/v1/payments/checkout-status?bookingId=${payHereBookingId}`,
        headers: { authorization: `Bearer ${otherTraveller.accessToken}` }
      });
      expect(otherStatusRes.statusCode).toBe(403);

      // 10b. Before webhook: PENDING_PAYMENT, custodyReady = false
      const pendingStatusRes = await app.inject({
        method: "GET",
        url: `/api/v1/payments/checkout-status?orderId=${encodeURIComponent(payHereOrderId)}`,
        headers: { authorization: `Bearer ${traveller.accessToken}` }
      });
      expect(pendingStatusRes.statusCode).toBe(200);
      const pendingStatus = JSON.parse(pendingStatusRes.body).data;
      expect(pendingStatus.bookingId).toBe(payHereBookingId);
      expect(pendingStatus.bookingStatus).toBe("PENDING_PAYMENT");
      expect(pendingStatus.custodyReady).toBe(false);
      expect(pendingStatus.canRetryPayment).toBe(true);
      expect(pendingStatus.pollRecommended).toBe(true);

      // 10c. Verified PayHere webhook transitions status_code=2 -> CONFIRMED
      const md5sig = PayHereGatewayAdapter.computeNotifyMd5Sig({
        merchantId: TEST_PAYHERE_MERCHANT_ID,
        orderId: payHereOrderId,
        payhereAmount: "1200.00",
        payhereCurrency: "LKR",
        statusCode: "2",
        merchantSecret: TEST_PAYHERE_MERCHANT_SECRET
      });
      const notifyBody = new URLSearchParams({
        merchant_id: TEST_PAYHERE_MERCHANT_ID,
        order_id: payHereOrderId,
        payment_id: `PH-B7-PAY-${Date.now()}`,
        payhere_amount: "1200.00",
        payhere_currency: "LKR",
        status_code: "2",
        md5sig
      }).toString();

      const whRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/webhooks/payhere",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: notifyBody
      });
      expect(whRes.statusCode).toBe(200);

      // After webhook: CONFIRMED, custodyReady = true
      const confirmedStatusRes = await app.inject({
        method: "GET",
        url: `/api/v1/payments/checkout-status?bookingId=${payHereBookingId}`,
        headers: { authorization: `Bearer ${traveller.accessToken}` }
      });
      expect(confirmedStatusRes.statusCode).toBe(200);
      const confirmedStatus = JSON.parse(confirmedStatusRes.body).data;
      expect(confirmedStatus.bookingStatus).toBe("CONFIRMED");
      expect(confirmedStatus.custodyReady).toBe(true);
      expect(confirmedStatus.canRetryPayment).toBe(false);
      expect(confirmedStatus.pollRecommended).toBe(false);

      // 8c. Settled intent handoff link now refuses launching PayHere form (409)
      const closedHandoffRes = await app.inject({
        method: "GET",
        url: `/api/v1${payHereHandoffPath}`
      });
      expect(closedHandoffRes.statusCode).toBe(409);
    });

    // 9b. Even when active env provider is sandbox, sandbox-simulate rejects PAYHERE intents (403)
    const crossProviderSim = await app.inject({
      method: "POST",
      url: `/api/v1/payments/intents/${payHereIntentId}/sandbox-simulate`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { outcome: "SUCCEEDED" }
    });
    expect(crossProviderSim.statusCode).toBe(403);

    // 9c. Sandbox intent simulation records SANDBOX_SIMULATOR & signature_verified = false
    const sbxBooking = await createBooking(traveller.accessToken, locationId, 13);
    const sbxIntentRes = await app.inject({
      method: "POST",
      url: "/api/v1/payments/intents",
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { bookingId: sbxBooking.id }
    });
    expect(sbxIntentRes.statusCode).toBe(201);
    const sbxIntent = JSON.parse(sbxIntentRes.body).data;
    expect(sbxIntent.nextAction).toBe("SANDBOX_SIMULATION");
    expect(sbxIntent.checkoutHandoff.method).toBe("SIMULATED_API");

    const simOk = await app.inject({
      method: "POST",
      url: `/api/v1/payments/intents/${sbxIntent.id}/sandbox-simulate`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { outcome: "SUCCEEDED" }
    });
    expect(simOk.statusCode).toBe(200);

    const txRows = await migratorPool.query(
      "SELECT evidence_source, signature_verified FROM payment_transactions WHERE booking_id = $1 AND transaction_type = 'CHARGE';",
      [sbxBooking.id]
    );
    expect(txRows.rows.length).toBe(1);
    expect(txRows.rows[0].evidence_source).toBe("SANDBOX_SIMULATOR");
    expect(txRows.rows[0].signature_verified).toBe(false);
  });
});

