import crypto from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { env, loadConfig } from "../src/config/env.js";
import { rateLimitService } from "../src/modules/auth/rate-limit.service.js";
import {
  PayHereGatewayAdapter,
  formatMinorAmountTwoDecimals
} from "../src/modules/payments/payment-gateway.port.js";

const { Pool } = pg;

const TEST_PAYHERE_MERCHANT_ID = "1219999";
const TEST_PAYHERE_WEB_SECRET = "ph_remed_web_secret_32_characters!!";
const TEST_PAYHERE_MOBILE_SECRET = "ph_remed_mob_secret_32_characters!!";
const TEST_PAYHERE_ANDROID_PKG = "com.luggagestorage.app";

function buildProdEnvFixture(
  overrides?: Record<string, string | undefined>
): Record<string, string | undefined> {
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
    PAYHERE_MERCHANT_SECRET: "",
    PAYHERE_WEB_MERCHANT_SECRET: "prod_payhere_web_merchant_secret_distinct_h8",
    PAYHERE_MOBILE_MERCHANT_SECRET: "prod_payhere_mobile_merchant_secret_distinct_h9",
    PAYHERE_ANDROID_PACKAGE_NAME: TEST_PAYHERE_ANDROID_PKG,
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

describe("PayHere Sandbox Remediation — Channel Isolation, Native SDK Payload & Webhook Security", () => {
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
    options: { sandboxMode?: boolean } | undefined,
    fn: () => Promise<T>
  ): Promise<T> {
    const prevProvider = env.PAYMENT_PROVIDER;
    const prevMerchantId = env.PAYHERE_MERCHANT_ID;
    const prevMerchantSecret = env.PAYHERE_MERCHANT_SECRET;
    const prevWebSecret = env.PAYHERE_WEB_MERCHANT_SECRET;
    const prevMobileSecret = env.PAYHERE_MOBILE_MERCHANT_SECRET;
    const prevAndroidPkg = env.PAYHERE_ANDROID_PACKAGE_NAME;
    const prevSandboxMode = env.PAYHERE_SANDBOX_MODE;
    const prevNotifyUrl = env.PAYHERE_NOTIFY_URL;
    const prevReturnUrl = env.PAYHERE_RETURN_URL;
    const prevCancelUrl = env.PAYHERE_CANCEL_URL;

    env.PAYMENT_PROVIDER = "payhere";
    env.PAYHERE_MERCHANT_ID = TEST_PAYHERE_MERCHANT_ID;
    env.PAYHERE_MERCHANT_SECRET = undefined;
    env.PAYHERE_WEB_MERCHANT_SECRET = TEST_PAYHERE_WEB_SECRET;
    env.PAYHERE_MOBILE_MERCHANT_SECRET = TEST_PAYHERE_MOBILE_SECRET;
    env.PAYHERE_ANDROID_PACKAGE_NAME = TEST_PAYHERE_ANDROID_PKG;
    env.PAYHERE_SANDBOX_MODE = options?.sandboxMode ?? true;
    env.PAYHERE_NOTIFY_URL = "https://api.luggagevault.lk/api/v1/payments/webhooks/payhere";
    env.PAYHERE_RETURN_URL = "https://app.luggagevault.lk/booking/confirm";
    env.PAYHERE_CANCEL_URL = "https://app.luggagevault.lk/booking/confirm?cancelled=1";

    try {
      return await fn();
    } finally {
      env.PAYMENT_PROVIDER = prevProvider;
      env.PAYHERE_MERCHANT_ID = prevMerchantId;
      env.PAYHERE_MERCHANT_SECRET = prevMerchantSecret;
      env.PAYHERE_WEB_MERCHANT_SECRET = prevWebSecret;
      env.PAYHERE_MOBILE_MERCHANT_SECRET = prevMobileSecret;
      env.PAYHERE_ANDROID_PACKAGE_NAME = prevAndroidPkg;
      env.PAYHERE_SANDBOX_MODE = prevSandboxMode;
      env.PAYHERE_NOTIFY_URL = prevNotifyUrl;
      env.PAYHERE_RETURN_URL = prevReturnUrl;
      env.PAYHERE_CANCEL_URL = prevCancelUrl;
    }
  }

  async function createTestUser(
    roleCode: "TRAVELLER" | "HOST_OWNER" = "TRAVELLER",
    displayName = "PayHere Remed User"
  ) {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const email = `ph_rem_${unique}@example.com`;
    const password = "StrongPassword123!";

    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email,
        password,
        displayName
      }
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
    const owner = await createTestUser("HOST_OWNER", "Kandy Host Owner");
    const bizRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/businesses",
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        legalBusinessName: `Kandy Vault Partners ${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        tradeName: "Kandy Vaults",
        entityType: "RETAIL_SHOP",
        contactEmail: owner.email,
        contactPhone: "+94771234567",
        city: "Colombo"
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
        name: "Colombo Fort Vault",
        description: "Secure locker near Fort railway station",
        addressLine1: "10 Olcott Mawatha",
        city: "Colombo",
        postalCode: "00100",
        countryCode: "LK",
        latitude: 6.9339,
        longitude: 79.8501,
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
      payload: { name: "Vault Zone A", zoneType: "LOCKER" }
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
      payload: { zoneId, totalUnits: 25, isActive: true }
    });

    await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/pricing`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        currency: "LKR",
        pricingUnit: "CALENDAR_DAY",
        baseRateMinor: 150000,
        tierRates: [
          { bagCategory: "BAG_SMALL", rateMinor: 90000, categoryMultiplierBps: 7000 },
          { bagCategory: "BAG_MEDIUM", rateMinor: 150000, categoryMultiplierBps: 10000 },
          { bagCategory: "BAG_LARGE", rateMinor: 190000, categoryMultiplierBps: 13000 },
          { bagCategory: "BAG_OVERSIZED", rateMinor: 250000, categoryMultiplierBps: 20000 }
        ]
      }
    });

    await migratorPool.query("UPDATE storage_locations SET status = 'ACTIVE' WHERE id = $1;", [
      locationId
    ]);
    return { locationId };
  }

  async function createBooking(travellerToken: string, locationId: string, daysAhead = 15) {
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

  function makeCustomerDetails(email: string) {
    return {
      firstName: "Kasun",
      lastName: "Perera",
      email,
      phone: "+94771234567",
      address: "42 Olcott Mawatha",
      city: "Colombo",
      country: "Sri Lanka"
    };
  }

  it("1. matches deterministic known-vector MD5 hashes, webhook md5sig, and integer LKR formatting", () => {
    expect(formatMinorAmountTwoDecimals(150000)).toBe("1500.00");
    expect(formatMinorAmountTwoDecimals(1999)).toBe("19.99");
    expect(formatMinorAmountTwoDecimals(1)).toBe("0.01");

    const webAdapter = new PayHereGatewayAdapter(
      "1211149",
      "payhere_web_vector_secret_32chars",
      true,
      "WEB",
      "https://api.luggagevault.lk/api/v1/payments/webhooks/payhere",
      "https://app.luggagevault.lk/booking/confirm",
      "https://app.luggagevault.lk/booking/confirm?cancelled=1",
      TEST_PAYHERE_ANDROID_PKG
    );

    const payload = webAdapter.buildCheckoutPayload({
      intentId: "11111111-2222-4333-8444-555555555555",
      bookingId: "22222222-3333-4444-8555-666666666666",
      referenceCode: "LGS-VEC-001",
      providerOrderId: "ORD-VEC-001",
      amountMinor: 150000,
      currency: "LKR",
      channel: "WEB",
      customerEmail: "kasun@example.com",
      customerName: "Kasun Perera",
      customerDetails: makeCustomerDetails("kasun@example.com")
    });

    expect(payload.amount).toBe("1500.00");
    expect(payload.hash).toBe("3C245BF18ED5CC06FB7665589B13BF4B");

    const webSig = PayHereGatewayAdapter.computeNotifyMd5Sig({
      merchantId: "1211149",
      orderId: "ORD-VEC-001",
      payhereAmount: "1500.00",
      payhereCurrency: "LKR",
      statusCode: "2",
      merchantSecret: "payhere_web_vector_secret_32chars"
    });
    expect(webSig).toBe("0B7BE46130293B5F882B067C48EC7C4A");

    const mobileSig = PayHereGatewayAdapter.computeNotifyMd5Sig({
      merchantId: "1211149",
      orderId: "ORD-VEC-001",
      payhereAmount: "1500.00",
      payhereCurrency: "LKR",
      statusCode: "2",
      merchantSecret: "payhere_mob_vector_secret_32chars"
    });
    expect(mobileSig).toBe("BD4EF3A887542BB5E2AF549608F2E549");
    expect(webSig).not.toBe(mobileSig);
  });

  it("2. loadConfig fails closed on legacy PAYHERE_MERCHANT_SECRET, missing or identical secrets, and invalid Android package", () => {
    expect(() => loadConfig(buildProdEnvFixture())).not.toThrow();

    expect(() =>
      loadConfig(
        buildProdEnvFixture({
          PAYHERE_MERCHANT_SECRET: "legacy_shared_secret_must_fail_closed"
        })
      )
    ).toThrow(/PAYHERE_MERCHANT_SECRET/i);

    expect(() =>
      loadConfig(buildProdEnvFixture({ PAYHERE_WEB_MERCHANT_SECRET: undefined }))
    ).toThrow(/PAYHERE_WEB_MERCHANT_SECRET/i);

    expect(() =>
      loadConfig(buildProdEnvFixture({ PAYHERE_MOBILE_MERCHANT_SECRET: undefined }))
    ).toThrow(/PAYHERE_MOBILE_MERCHANT_SECRET/i);

    expect(() =>
      loadConfig(
        buildProdEnvFixture({
          PAYHERE_WEB_MERCHANT_SECRET: "identical_secret_value_32_characters!!",
          PAYHERE_MOBILE_MERCHANT_SECRET: "identical_secret_value_32_characters!!"
        })
      )
    ).toThrow(/distinct/i);

    expect(() =>
      loadConfig(buildProdEnvFixture({ PAYHERE_ANDROID_PACKAGE_NAME: undefined }))
    ).toThrow(/PAYHERE_ANDROID_PACKAGE_NAME/i);

    expect(() =>
      loadConfig(buildProdEnvFixture({ PAYHERE_ANDROID_PACKAGE_NAME: "not_a_package" }))
    ).toThrow(/PAYHERE_ANDROID_PACKAGE_NAME/i);
  });

  it("3. issues channel-specific WEB (POST_FORM) vs MOBILE_APP (NATIVE_SDK, zero hash/secrets) payloads", async () => {
    const { locationId } = await createActiveLocation();
    const traveller = await createTestUser("TRAVELLER", "Nimal Silva");

    await withPayHereEnv({ sandboxMode: true }, async () => {
      const webBooking = await createBooking(traveller.accessToken, locationId, 16);
      const webRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          bookingId: webBooking.id,
          channel: "WEB",
          customerDetails: makeCustomerDetails(traveller.email)
        }
      });
      expect(webRes.statusCode).toBe(201);
      expect(webRes.body).not.toContain(TEST_PAYHERE_WEB_SECRET);
      expect(webRes.body).not.toContain(TEST_PAYHERE_MOBILE_SECRET);

      const webIntent = JSON.parse(webRes.body).data;
      expect(webIntent.checkoutChannel).toBe("WEB");
      expect(webIntent.nextAction).toBe("REDIRECT_TO_PROVIDER");
      expect(webIntent.checkoutHandoff.method).toBe("POST_FORM");
      expect(webIntent.checkoutHandoff.actionUrl).toBe("https://sandbox.payhere.lk/pay/checkout");
      expect(webIntent.checkoutHandoff.mobileHandoffPath).toBeUndefined();
      expect(webIntent.checkoutHandoff.fields.amount).toBe("1500.00");
      expect(webIntent.checkoutHandoff.fields.hash).toMatch(/^[0-9A-F]{32}$/);

      const mobileBooking = await createBooking(traveller.accessToken, locationId, 17);
      const mobRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          bookingId: mobileBooking.id,
          channel: "MOBILE_APP",
          customerDetails: makeCustomerDetails(traveller.email)
        }
      });
      expect(mobRes.statusCode).toBe(201);
      expect(mobRes.body).not.toContain(TEST_PAYHERE_WEB_SECRET);
      expect(mobRes.body).not.toContain(TEST_PAYHERE_MOBILE_SECRET);

      const mobIntent = JSON.parse(mobRes.body).data;
      expect(mobIntent.checkoutChannel).toBe("MOBILE_APP");
      expect(mobIntent.nextAction).toBe("LAUNCH_NATIVE_SDK");
      expect(mobIntent.checkoutHandoff.mode).toBe("PAYHERE_NATIVE_SANDBOX");
      expect(mobIntent.checkoutHandoff.method).toBe("NATIVE_SDK");
      expect(mobIntent.checkoutPayload.androidPackageName).toBe(TEST_PAYHERE_ANDROID_PKG);

      const sdk = mobIntent.checkoutHandoff.sdkPayload;
      expect(sdk.sandbox).toBe(true);
      expect(sdk.merchant_id).toBe(TEST_PAYHERE_MERCHANT_ID);
      expect(sdk.notify_url).toBe("https://api.luggagevault.lk/api/v1/payments/webhooks/payhere");
      expect(sdk.order_id).toBe(mobIntent.providerOrderId);
      expect(sdk.amount).toBe("1500.00");
      expect(sdk.currency).toBe("LKR");
      expect(sdk.custom_1).toBe(mobIntent.id);
      expect(sdk.custom_2).toBe(mobileBooking.referenceCode);
      expect(sdk.hash).toBeUndefined();
      expect(sdk.return_url).toBeUndefined();
      expect(sdk.cancel_url).toBeUndefined();
      expect(sdk.merchant_secret).toBeUndefined();
    });
  });

  it("4. enforces channel-isolated md5sig webhook verification, rejects mismatches/unknown/cross-provider, and settles idempotently", async () => {
    const { locationId } = await createActiveLocation();
    const traveller = await createTestUser("TRAVELLER", "Sanduni Perera");

    // Create a SANDBOX_GATEWAY intent first for cross-provider rejection verification
    const sandboxBooking = await createBooking(traveller.accessToken, locationId, 18);
    const sbxIntentRes = await app.inject({
      method: "POST",
      url: "/api/v1/payments/intents",
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { bookingId: sandboxBooking.id }
    });
    expect(sbxIntentRes.statusCode).toBe(201);
    const sbxOrderId = JSON.parse(sbxIntentRes.body).data.providerOrderId as string;

    await withPayHereEnv({ sandboxMode: true }, async () => {
      const webBooking = await createBooking(traveller.accessToken, locationId, 19);
      const webIntent = JSON.parse(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/payments/intents",
            headers: { authorization: `Bearer ${traveller.accessToken}` },
            payload: {
              bookingId: webBooking.id,
              channel: "WEB",
              customerDetails: makeCustomerDetails(traveller.email)
            }
          })
        ).body
      ).data;

      const mobBooking = await createBooking(traveller.accessToken, locationId, 20);
      const mobIntent = JSON.parse(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/payments/intents",
            headers: { authorization: `Bearer ${traveller.accessToken}` },
            payload: {
              bookingId: mobBooking.id,
              channel: "MOBILE_APP",
              customerDetails: makeCustomerDetails(traveller.email)
            }
          })
        ).body
      ).data;

      const runSuffix = `${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

      const sendWebhook = async (params: {
        merchantId?: string;
        orderId: string;
        intentId?: string;
        amount?: string;
        currency?: string;
        statusCode?: string;
        secret: string;
        overrideSig?: string;
        paymentId?: string;
      }) => {
        const merchantId = params.merchantId ?? TEST_PAYHERE_MERCHANT_ID;
        const amount = params.amount ?? "1500.00";
        const currency = params.currency ?? "LKR";
        const statusCode = params.statusCode ?? "2";
        const sig =
          params.overrideSig ??
          PayHereGatewayAdapter.computeNotifyMd5Sig({
            merchantId,
            orderId: params.orderId,
            payhereAmount: amount,
            payhereCurrency: currency,
            statusCode,
            merchantSecret: params.secret
          });
        const form = new URLSearchParams({
          merchant_id: merchantId,
          order_id: params.orderId,
          payment_id: params.paymentId ?? `PH-PAY-${runSuffix}`,
          payhere_amount: amount,
          payhere_currency: currency,
          status_code: statusCode,
          md5sig: sig,
          ...(params.intentId ? { custom_1: params.intentId } : {})
        }).toString();

        return app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: form
        });
      };

      // WEB intent signed with MOBILE secret -> 401; custody remains locked
      expect(
        (
          await sendWebhook({
            orderId: webIntent.providerOrderId,
            intentId: webIntent.id,
            secret: TEST_PAYHERE_MOBILE_SECRET
          })
        ).statusCode
      ).toBe(401);

      // MOBILE_APP intent signed with WEB secret -> 401; custody remains locked
      expect(
        (
          await sendWebhook({
            orderId: mobIntent.providerOrderId,
            intentId: mobIntent.id,
            secret: TEST_PAYHERE_WEB_SECRET
          })
        ).statusCode
      ).toBe(401);

      // Invalid signature, wrong merchant_id, wrong amount, wrong currency, unknown order, cross-provider
      expect(
        (
          await sendWebhook({
            orderId: mobIntent.providerOrderId,
            secret: TEST_PAYHERE_MOBILE_SECRET,
            overrideSig: "00000000000000000000000000000000"
          })
        ).statusCode
      ).toBe(401);

      expect(
        (
          await sendWebhook({
            merchantId: "9999999",
            orderId: mobIntent.providerOrderId,
            secret: TEST_PAYHERE_MOBILE_SECRET
          })
        ).statusCode
      ).toBe(401);

      expect(
        (
          await sendWebhook({
            orderId: mobIntent.providerOrderId,
            amount: "100.00",
            secret: TEST_PAYHERE_MOBILE_SECRET
          })
        ).statusCode
      ).toBe(400);

      expect(
        (
          await sendWebhook({
            orderId: mobIntent.providerOrderId,
            currency: "USD",
            secret: TEST_PAYHERE_MOBILE_SECRET
          })
        ).statusCode
      ).toBe(400);

      expect(
        (
          await sendWebhook({
            orderId: "ORD-UNKNOWN-DOES-NOT-EXIST",
            secret: TEST_PAYHERE_WEB_SECRET
          })
        ).statusCode
      ).toBe(404);

      expect(
        (
          await sendWebhook({
            orderId: sbxOrderId,
            secret: TEST_PAYHERE_WEB_SECRET
          })
        ).statusCode
      ).toBe(409);

      // Before valid webhook: custody pass refuses (409) & status stays PENDING_PAYMENT
      const prePassRes = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${mobBooking.id}/custody-pass`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { operation: "CHECK_IN" }
      });
      expect(prePassRes.statusCode).toBe(409);

      // Valid MOBILE_APP webhook confirms booking and unlocks custody pass
      const validMobPaymentId = `PH-MOB-VALID-${runSuffix}`;
      const validMobWh = await sendWebhook({
        orderId: mobIntent.providerOrderId,
        intentId: mobIntent.id,
        secret: TEST_PAYHERE_MOBILE_SECRET,
        paymentId: validMobPaymentId
      });
      expect(validMobWh.statusCode).toBe(200);

      // Duplicate/replayed identical notification stays idempotent (200)
      const replayWh = await sendWebhook({
        orderId: mobIntent.providerOrderId,
        intentId: mobIntent.id,
        secret: TEST_PAYHERE_MOBILE_SECRET,
        paymentId: validMobPaymentId
      });
      expect(replayWh.statusCode).toBe(200);
      expect(JSON.parse(replayWh.body).data.duplicate).toBe(true);

      const postStatus = JSON.parse(
        (
          await app.inject({
            method: "GET",
            url: `/api/v1/payments/checkout-status?bookingId=${mobBooking.id}`,
            headers: { authorization: `Bearer ${traveller.accessToken}` }
          })
        ).body
      ).data;
      expect(postStatus.bookingStatus).toBe("CONFIRMED");
      expect(postStatus.custodyReady).toBe(true);

      const passRes = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${mobBooking.id}/custody-pass`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { operation: "CHECK_IN" }
      });
      expect(passRes.statusCode).toBe(200);

      const txCountRes = await migratorPool.query(
        "SELECT COUNT(*)::int AS cnt FROM payment_transactions WHERE booking_id = $1 AND transaction_type = 'CHARGE';",
        [mobBooking.id]
      );
      expect(txCountRes.rows[0].cnt).toBe(1);
    });
  });

  it("5. preserves single active intent across same-channel retry, channel switch, concurrency, and retired legacy intents", async () => {
    const { locationId } = await createActiveLocation();
    const traveller = await createTestUser("TRAVELLER", "Tharindu Jaya");

    await withPayHereEnv({ sandboxMode: true }, async () => {
      const booking = await createBooking(traveller.accessToken, locationId, 21);
      const idempotencyKey = `remed-retry-${crypto.randomBytes(6).toString("hex")}`;

      // Same-channel concurrent calls with matching idempotencyKey produce a single intent
      const [r1, r2] = await Promise.all([
        app.inject({
          method: "POST",
          url: "/api/v1/payments/intents",
          headers: { authorization: `Bearer ${traveller.accessToken}` },
          payload: {
            bookingId: booking.id,
            channel: "WEB",
            idempotencyKey,
            customerDetails: makeCustomerDetails(traveller.email)
          }
        }),
        app.inject({
          method: "POST",
          url: "/api/v1/payments/intents",
          headers: { authorization: `Bearer ${traveller.accessToken}` },
          payload: {
            bookingId: booking.id,
            channel: "WEB",
            idempotencyKey,
            customerDetails: makeCustomerDetails(traveller.email)
          }
        })
      ]);
      expect([200, 201]).toContain(r1.statusCode);
      expect([200, 201]).toContain(r2.statusCode);
      const webIntent = JSON.parse(r1.body).data;
      expect(JSON.parse(r2.body).data.id).toBe(webIntent.id);

      // Reusing same idempotencyKey for a different channel fails closed (409)
      const mismatchKeyRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          bookingId: booking.id,
          channel: "MOBILE_APP",
          idempotencyKey,
          customerDetails: makeCustomerDetails(traveller.email)
        }
      });
      expect(mismatchKeyRes.statusCode).toBe(409);

      // Switching channel with fresh request supersedes prior active intent
      const switchRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          bookingId: booking.id,
          channel: "MOBILE_APP",
          customerDetails: makeCustomerDetails(traveller.email)
        }
      });
      expect(switchRes.statusCode).toBe(201);
      const mobIntent = JSON.parse(switchRes.body).data;
      expect(mobIntent.checkoutChannel).toBe("MOBILE_APP");
      expect(mobIntent.id).not.toBe(webIntent.id);

      const activeRows = await migratorPool.query(
        "SELECT id, status FROM payment_intents WHERE booking_id = $1 ORDER BY created_at ASC;",
        [booking.id]
      );
      const activeOnly = activeRows.rows.filter(
        (r) => r.status === "INITIATED" || r.status === "PENDING_GATEWAY"
      );
      expect(activeOnly.length).toBe(1);
      expect(activeOnly[0].id).toBe(mobIntent.id);
      const oldRow = activeRows.rows.find((r) => r.id === webIntent.id);
      expect(oldRow?.status).toBe("EXPIRED");

      // Legacy pre-0015 expired payload serializes cleanly as LEGACY_EXPIRED and permits fresh checkout
      const legacyBooking = await createBooking(traveller.accessToken, locationId, 22);
      const legacyIntentId = crypto.randomUUID();
      await migratorPool.query(
        `INSERT INTO payment_intents (
          id, booking_id, traveller_user_id, provider, checkout_channel,
          provider_order_id, amount_minor, currency, status, checkout_payload, expires_at
        ) VALUES ($1, $2, $3, 'PAYHERE', 'WEB', $4, 150000, 'LKR', 'EXPIRED', $5::jsonb, NOW() - INTERVAL '5 minutes');`,
        [
          legacyIntentId,
          legacyBooking.id,
          traveller.userId,
          `ORD-LEGACY-${Date.now()}`,
          JSON.stringify({ mobileHandoffPath: "/payments/handoff/legacy.sig" })
        ]
      );

      const legacyStatusRes = await app.inject({
        method: "GET",
        url: `/api/v1/payments/checkout-status?bookingId=${legacyBooking.id}`,
        headers: { authorization: `Bearer ${traveller.accessToken}` }
      });
      expect(legacyStatusRes.statusCode).toBe(200);
      const legacyStatus = JSON.parse(legacyStatusRes.body).data;
      expect(legacyStatus.paymentIntent.checkoutHandoff.mode).toBe("LEGACY_EXPIRED");
      expect(legacyStatus.paymentIntent.checkoutHandoff.method).toBe("EXPIRED");
      expect(legacyStatus.canRetryPayment).toBe(true);

      const freshRetryRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          bookingId: legacyBooking.id,
          channel: "MOBILE_APP",
          customerDetails: makeCustomerDetails(traveller.email)
        }
      });
      expect(freshRetryRes.statusCode).toBe(201);
      expect(JSON.parse(freshRetryRes.body).data.checkoutHandoff.method).toBe("NATIVE_SDK");
    });
  });
});
