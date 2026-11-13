import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import { readMigrationFiles } from "drizzle-orm/migrator";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { env, loadConfig } from "../src/config/env.js";
import { runMigrations } from "../src/infrastructure/database/migrate.js";
import { rateLimitService } from "../src/modules/auth/rate-limit.service.js";
import {
  CUSTODY_HASH_VERSION,
  LEGACY_CUSTODY_HASH_VERSION,
  computeCustodyCredentialHmac,
  verifyCustodyCredentialHmac
} from "../src/common/crypto/custody-hmac.js";
import {
  PayHereGatewayAdapter,
  SandboxSignedGatewayAdapter,
  formatMinorAmountTwoDecimals,
  parsePayHereDecimalAmountToMinor
} from "../src/modules/payments/payment-gateway.port.js";
import { quotationService } from "../src/modules/bookings/quotation-availability.service.js";
import { ledgerService, type JournalPostingLine } from "../src/modules/finance/ledger.service.js";

const { Pool } = pg;

const TEST_PAYHERE_MERCHANT_ID = "1219999";
const TEST_PAYHERE_MERCHANT_SECRET = "payhere_test_merchant_secret_key_32_chars!";

interface PgErrorShape {
  code?: string;
  constraint?: string;
}

describe("Phase B Security, Payment Integrity & PostgreSQL Concurrency Remediation", () => {
  let app: FastifyInstance;
  let migratorPool: pg.Pool;
  let runtimePool: pg.Pool;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    migratorPool = new Pool({
      connectionString: env.MIGRATION_DATABASE_URL,
      max: 6
    });
    runtimePool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 6
    });
  });

  beforeEach(async () => {
    await rateLimitService.clearAll();
  });

  afterAll(async () => {
    await app.close();
    await migratorPool.end();
    await runtimePool.end();
  });

  async function withPayHereEnv<T>(fn: () => Promise<T>): Promise<T> {
    const prevProvider = env.PAYMENT_PROVIDER;
    const prevMerchantId = env.PAYHERE_MERCHANT_ID;
    const prevMerchantSecret = env.PAYHERE_MERCHANT_SECRET;
    const prevSandboxMode = env.PAYHERE_SANDBOX_MODE;

    env.PAYMENT_PROVIDER = "payhere";
    env.PAYHERE_MERCHANT_ID = TEST_PAYHERE_MERCHANT_ID;
    env.PAYHERE_MERCHANT_SECRET = TEST_PAYHERE_MERCHANT_SECRET;
    env.PAYHERE_SANDBOX_MODE = true;

    try {
      return await fn();
    } finally {
      env.PAYMENT_PROVIDER = prevProvider;
      env.PAYHERE_MERCHANT_ID = prevMerchantId;
      env.PAYHERE_MERCHANT_SECRET = prevMerchantSecret;
      env.PAYHERE_SANDBOX_MODE = prevSandboxMode;
    }
  }

  function buildPayHereNotifyForm(params: {
    merchantId?: string;
    orderId: string;
    paymentId?: string;
    payhereAmount: string;
    payhereCurrency: string;
    statusCode: string;
    custom1?: string;
    custom2?: string;
    method?: string;
    statusMessage?: string;
    merchantSecret?: string;
    md5sigOverride?: string | null;
  }): string {
    const merchantId = params.merchantId ?? TEST_PAYHERE_MERCHANT_ID;
    const merchantSecret = params.merchantSecret ?? TEST_PAYHERE_MERCHANT_SECRET;
    const md5sig =
      params.md5sigOverride === undefined
        ? PayHereGatewayAdapter.computeNotifyMd5Sig({
            merchantId,
            orderId: params.orderId,
            payhereAmount: params.payhereAmount,
            payhereCurrency: params.payhereCurrency,
            statusCode: params.statusCode,
            merchantSecret
          })
        : params.md5sigOverride;

    const search = new URLSearchParams();
    search.set("merchant_id", merchantId);
    search.set("order_id", params.orderId);
    if (params.paymentId !== undefined) {
      search.set("payment_id", params.paymentId);
    }
    search.set("payhere_amount", params.payhereAmount);
    search.set("payhere_currency", params.payhereCurrency);
    search.set("status_code", params.statusCode);
    if (md5sig !== null) {
      search.set("md5sig", md5sig);
    }
    if (params.custom1 !== undefined) {
      search.set("custom_1", params.custom1);
    }
    if (params.custom2 !== undefined) {
      search.set("custom_2", params.custom2);
    }
    if (params.method !== undefined) {
      search.set("method", params.method);
    }
    if (params.statusMessage !== undefined) {
      search.set("status_message", params.statusMessage);
    }
    return search.toString();
  }

  async function createTestUser(
    roleCode: "TRAVELLER" | "HOST_OWNER" | "HOST_STAFF" | "SUPERADMIN" | "SUPPORT" = "TRAVELLER",
    displayName = "Phase B Rem User"
  ) {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const email = `phaseb_rem_${unique}@example.com`;
    const password = "StrongPassword123!";

    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password, displayName }
    });
    expect(regRes.statusCode).toBe(201);
    const userId = JSON.parse(regRes.body).data.id as string;

    if (roleCode !== "TRAVELLER") {
      const roleRes = await migratorPool.query(
        "SELECT id FROM roles WHERE code = $1 LIMIT 1;",
        [roleCode]
      );
      expect(roleRes.rows.length).toBe(1);
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

  function futureColomboWindow(daysAhead = 5) {
    const base = new Date();
    base.setUTCDate(base.getUTCDate() + daysAhead);
    const yyyy = base.getUTCFullYear();
    const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(base.getUTCDate()).padStart(2, "0");
    return {
      dropOffAt: `${yyyy}-${mm}-${dd}T04:30:00.000Z`,
      collectionAt: `${yyyy}-${mm}-${dd}T11:30:00.000Z`
    };
  }

  async function createActiveLocation(options?: {
    bookingMode?: "INSTANT" | "HOST_APPROVAL";
    sharedPoolUnits?: number;
    baseRateMinor?: number;
  }) {
    const owner = await createTestUser("HOST_OWNER", "Rem Host Owner");
    const bizRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/businesses",
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        legalBusinessName: `Rem Vault Pvt Ltd ${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        tradeName: "Galle Fort Luggage Vault",
        entityType: "RETAIL_SHOP",
        contactEmail: `host_${Date.now()}@gallevault.lk`,
        contactPhone: "+94771234567",
        city: "Galle"
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
        name: `Galle Counter #${Math.random().toString(36).slice(2, 6)}`,
        description: "Secure locker bay near Galle Bus Stand",
        addressLine1: "18 Pedlar Street, Galle",
        addressLine2: "Ground Floor",
        city: "Galle",
        postalCode: "80000",
        latitude: 6.0329,
        longitude: 80.2168,
        timezone: "Asia/Colombo",
        bookingMode: options?.bookingMode ?? "INSTANT",
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
    const hoursRes = await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/opening-hours`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { schedules }
    });
    expect(hoursRes.statusCode).toBe(200);

    const zoneRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/locations/${locationId}/zones`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { name: "Vault Zone A", zoneType: "LOCKER" }
    });
    expect(zoneRes.statusCode).toBe(201);
    const zoneId = JSON.parse(zoneRes.body).data.id as string;

    const poolsRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/locations/${locationId}/capacity-pools`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(poolsRes.statusCode).toBe(200);
    const pools = JSON.parse(poolsRes.body).data.pools as Array<{ id: string }>;
    const capRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/hosts/capacity-pools/${pools[0].id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        zoneId,
        totalUnits: options?.sharedPoolUnits ?? 20,
        isActive: true
      }
    });
    expect(capRes.statusCode).toBe(200);

    const baseRateMinor = options?.baseRateMinor ?? 100000;
    const priceRes = await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/pricing`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        currency: "LKR",
        pricingUnit: "CALENDAR_DAY",
        baseRateMinor,
        tierRates: [
          { bagCategory: "BAG_SMALL", rateMinor: 70000, categoryMultiplierBps: 7000 },
          { bagCategory: "BAG_MEDIUM", rateMinor: baseRateMinor, categoryMultiplierBps: 10000 },
          { bagCategory: "BAG_LARGE", rateMinor: 130000, categoryMultiplierBps: 13000 },
          { bagCategory: "BAG_OVERSIZED", rateMinor: 200000, categoryMultiplierBps: 20000 }
        ]
      }
    });
    expect(priceRes.statusCode).toBe(200);

    await migratorPool.query("UPDATE storage_locations SET status = 'ACTIVE' WHERE id = $1;", [
      locationId
    ]);

    return { owner, businessId, locationId, zoneId };
  }

  async function createBookingAndIntent(params: {
    travellerToken: string;
    locationId: string;
    daysAhead?: number;
    quantity?: number;
    bagCategory?: "BAG_SMALL" | "BAG_MEDIUM" | "BAG_LARGE" | "BAG_OVERSIZED";
    idempotencyKey?: string;
  }) {
    const win = futureColomboWindow(params.daysAhead ?? 7);
    const bRes = await app.inject({
      method: "POST",
      url: "/api/v1/bookings",
      headers: { authorization: `Bearer ${params.travellerToken}` },
      payload: {
        locationId: params.locationId,
        dropOffAt: win.dropOffAt,
        collectionAt: win.collectionAt,
        items: [
          {
            bagCategory: params.bagCategory ?? "BAG_MEDIUM",
            quantity: params.quantity ?? 1
          }
        ]
      }
    });
    expect(bRes.statusCode).toBe(201);
    const booking = JSON.parse(bRes.body).data as {
      id: string;
      referenceCode: string;
      totalAmountMinor: number;
      currency: string;
    };

    const iRes = await app.inject({
      method: "POST",
      url: "/api/v1/payments/intents",
      headers: { authorization: `Bearer ${params.travellerToken}` },
      payload: {
        bookingId: booking.id,
        ...(params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : {})
      }
    });
    expect(iRes.statusCode).toBe(201);
    const intent = JSON.parse(iRes.body).data as {
      id: string;
      bookingId: string;
      provider: "SANDBOX_GATEWAY" | "PAYHERE";
      providerOrderId: string;
      amountMinor: number;
      currency: string;
      checkoutPayload: Record<string, unknown>;
    };

    return { booking, intent, win };
  }

  // ==========================================================================
  // 1. B1: Keyed Custody HMAC, Secret Separation & Legacy Token Migration
  // ==========================================================================
  describe("1. B1: Keyed Domain-Separated Custody HMAC & Secret Validation", () => {
    const validBaseEnv: Record<string, string> = {
      NODE_ENV: "development",
      PAYOUT_ENCRYPTION_KEY: "payout_secret_key_with_sufficient_length_001!",
      DB_IDENTITY_SECRET: "identity_secret_key_with_sufficient_length_002!",
      PAYMENT_WEBHOOK_SECRET: "webhook_secret_key_with_sufficient_length_003!",
      RATE_LIMIT_HASH_SECRET: "ratelimit_secret_key_with_sufficient_length_004!",
      CUSTODY_TOKEN_HMAC_SECRET: "custody_hmac_secret_key_with_sufficient_len_005!"
    };

    it("fails closed when CUSTODY_TOKEN_HMAC_SECRET is missing, short, placeholder in prod, or reused", () => {
      const missingEnv = { ...validBaseEnv };
      delete missingEnv.CUSTODY_TOKEN_HMAC_SECRET;
      expect(() => loadConfig(missingEnv)).toThrow(/CUSTODY_TOKEN_HMAC_SECRET/i);

      expect(() =>
        loadConfig({ ...validBaseEnv, CUSTODY_TOKEN_HMAC_SECRET: "short_123" })
      ).toThrow(/at least 32 characters/i);

      expect(() =>
        loadConfig({
          ...validBaseEnv,
          CUSTODY_TOKEN_HMAC_SECRET: "      short_after_trim_only      "
        })
      ).toThrow(/at least 32 characters/i);

      // Secret reuse prohibition across DB identity, retiring identity, webhook, and rate-limit secrets
      for (const reusedKey of [
        validBaseEnv.DB_IDENTITY_SECRET,
        validBaseEnv.PAYMENT_WEBHOOK_SECRET,
        validBaseEnv.RATE_LIMIT_HASH_SECRET
      ]) {
        expect(() =>
          loadConfig({ ...validBaseEnv, CUSTODY_TOKEN_HMAC_SECRET: reusedKey })
        ).toThrow(/cryptographically distinct/i);
      }

      expect(() =>
        loadConfig({
          ...validBaseEnv,
          DB_IDENTITY_RETIRING_KEY_ID: "retiring_v1",
          DB_IDENTITY_RETIRING_SECRET: "retiring_identity_secret_32_characters_long_009!",
          CUSTODY_TOKEN_HMAC_SECRET: "retiring_identity_secret_32_characters_long_009!"
        })
      ).toThrow(/cryptographically distinct/i);

      // Production placeholder rejection
      const validProdBase: Record<string, string> = {
        NODE_ENV: "production",
        DATABASE_SSL: "true",
        DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
        CORS_ORIGIN: "https://app.luggagestorage.lk",
        APP_PUBLIC_URL: "https://app.luggagestorage.lk",
        STORAGE_PROVIDER: "r2",
        R2_ACCOUNT_ID: "r2acc123",
        R2_ACCESS_KEY_ID: "r2key123",
        R2_SECRET_ACCESS_KEY: "r2secret1234567890",
        R2_BUCKET_NAME: "prod-vault-bucket",
        EMAIL_PROVIDER: "zoho",
        ZOHO_SMTP_HOST: "smtp.zoho.eu",
        ZOHO_SMTP_PORT: "587",
        ZOHO_SMTP_USER: "no-reply@luggagestorage.lk",
        ZOHO_SMTP_PASSWORD: "ProdZohoPassword123!",
        JWT_SECRET: "prod_jwt_unique_entropy_secret_32_chars_long_11!",
        COOKIE_SECRET: "prod_cookie_unique_entropy_secret_32_chars_long2!",
        PAYOUT_ENCRYPTION_KEY: "prod_payout_unique_entropy_secret_32_chars_long3!",
        DB_IDENTITY_SECRET: "prod_identity_unique_entropy_32_chars_long_0004!",
        PAYMENT_WEBHOOK_SECRET: "prod_webhook_unique_entropy_secret_32_chars_ln5!",
        RATE_LIMIT_HASH_SECRET: "prod_ratelimit_unique_entropy_32_chars_long_006!",
        PAYMENT_PROVIDER: "payhere",
        PAYHERE_MERCHANT_ID: "2219999",
        PAYHERE_MERCHANT_SECRET: "live_merchant_secret_9876543210",
        PAYHERE_SANDBOX_MODE: "false"
      };

      expect(() =>
        loadConfig({
          ...validProdBase,
          CUSTODY_TOKEN_HMAC_SECRET: "placeholder_custody_hmac_secret_32_chars_long!"
        })
      ).toThrow(/development, test, example, or placeholder value in production/i);

      expect(() =>
        loadConfig({
          ...validProdBase,
          CUSTODY_TOKEN_HMAC_SECRET: "replace_with_custody_secret_value_32_chars_long!"
        })
      ).toThrow(/development, test, example, or placeholder value in production/i);
    });

    it("enforces domain separation across bookingId, operation, purpose, secret, and preserves leading-zero PINs", () => {
      const bookingA = crypto.randomUUID();
      const bookingB = crypto.randomUUID();
      const secretA = "alpha_custody_hmac_secret_minimum_32_characters!";
      const secretB = "beta_custody_hmac_secret_minimum_32_characters!!";
      const qrToken = "a1b2c3d4".repeat(8);

      const pin0 = computeCustodyCredentialHmac({
        purpose: "CUSTODY_PIN",
        bookingId: bookingA,
        operation: "CHECK_IN",
        credential: "000000",
        secretOverride: secretA
      });
      const pinB = computeCustodyCredentialHmac({
        purpose: "CUSTODY_PIN",
        bookingId: bookingB,
        operation: "CHECK_IN",
        credential: "000000",
        secretOverride: secretA
      });
      const pinCollection = computeCustodyCredentialHmac({
        purpose: "CUSTODY_PIN",
        bookingId: bookingA,
        operation: "COLLECTION",
        credential: "000000",
        secretOverride: secretA
      });
      const qrDigest = computeCustodyCredentialHmac({
        purpose: "CUSTODY_QR",
        bookingId: bookingA,
        operation: "CHECK_IN",
        credential: qrToken,
        secretOverride: secretA
      });

      expect(pin0).toMatch(/^[0-9a-f]{64}$/);
      expect(pin0).not.toBe(pinB);
      expect(pin0).not.toBe(pinCollection);
      expect(pin0).not.toBe(
        crypto.createHash("sha256").update("000000").digest("hex")
      );
      expect(pin0).not.toBe(
        crypto
          .createHash("sha256")
          .update(`${bookingA}:CHECK_IN:000000`)
          .digest("hex")
      );

      // Valid matches
      expect(
        verifyCustodyCredentialHmac({
          purpose: "CUSTODY_PIN",
          bookingId: bookingA,
          operation: "CHECK_IN",
          candidateCredential: "000000",
          storedDigestHex: pin0,
          secretOverride: secretA
        })
      ).toBe(true);
      expect(
        verifyCustodyCredentialHmac({
          purpose: "CUSTODY_QR",
          bookingId: bookingA,
          operation: "CHECK_IN",
          candidateCredential: qrToken,
          storedDigestHex: qrDigest,
          secretOverride: secretA
        })
      ).toBe(true);

      // Wrong booking, operation, secret, or malformed credentials/digests fail safely
      expect(
        verifyCustodyCredentialHmac({
          purpose: "CUSTODY_PIN",
          bookingId: bookingB,
          operation: "CHECK_IN",
          candidateCredential: "000000",
          storedDigestHex: pin0,
          secretOverride: secretA
        })
      ).toBe(false);
      expect(
        verifyCustodyCredentialHmac({
          purpose: "CUSTODY_PIN",
          bookingId: bookingA,
          operation: "COLLECTION",
          candidateCredential: "000000",
          storedDigestHex: pin0,
          secretOverride: secretA
        })
      ).toBe(false);
      expect(
        verifyCustodyCredentialHmac({
          purpose: "CUSTODY_PIN",
          bookingId: bookingA,
          operation: "CHECK_IN",
          candidateCredential: "000000",
          storedDigestHex: pin0,
          secretOverride: secretB
        })
      ).toBe(false);
      expect(
        verifyCustodyCredentialHmac({
          purpose: "CUSTODY_PIN",
          bookingId: bookingA,
          operation: "CHECK_IN",
          candidateCredential: "00000",
          storedDigestHex: pin0,
          secretOverride: secretA
        })
      ).toBe(false);
      expect(
        verifyCustodyCredentialHmac({
          purpose: "CUSTODY_QR",
          bookingId: bookingA,
          operation: "CHECK_IN",
          candidateCredential: "not-a-64-hex-token",
          storedDigestHex: qrDigest,
          secretOverride: secretA
        })
      ).toBe(false);
      expect(
        verifyCustodyCredentialHmac({
          purpose: "CUSTODY_PIN",
          bookingId: bookingA,
          operation: "CHECK_IN",
          candidateCredential: "000000",
          storedDigestHex: "zzzz",
          secretOverride: secretA
        })
      ).toBe(false);
    });

    it("stores keyed hmac-sha256-v2 digests without plaintext leaks, supports leading-zero PINs, enforces single-use & cross-endpoint rate limits", async () => {
      const traveller = await createTestUser("TRAVELLER", "B1 Traveller");
      const { owner, locationId } = await createActiveLocation();
      const { booking, intent } = await createBookingAndIntent({
        travellerToken: traveller.accessToken,
        locationId,
        daysAhead: 8
      });

      const simRes = await app.inject({
        method: "POST",
        url: `/api/v1/payments/intents/${intent.id}/sandbox-simulate`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { outcome: "SUCCEEDED" }
      });
      expect(simRes.statusCode).toBe(200);

      // Issue first CHECK_IN pass, then issue a second one to verify revocation of superseded token
      const pass1Res = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${booking.id}/custody-pass`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { operation: "CHECK_IN" }
      });
      expect(pass1Res.statusCode).toBe(200);
      const pass1 = JSON.parse(pass1Res.body).data as {
        qrToken: string;
        verificationPin: string;
      };

      const pass2Res = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${booking.id}/custody-pass`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { operation: "CHECK_IN" }
      });
      expect(pass2Res.statusCode).toBe(200);
      const pass2 = JSON.parse(pass2Res.body).data as {
        qrToken: string;
        verificationPin: string;
      };

      // DB contains hmac-sha256-v2 digests != raw values and != unkeyed SHA-256
      const tokensDb = await migratorPool.query(
        `SELECT hash_version, token_hash, pin_hash, revoked_at, consumed_at
         FROM custody_tokens
         WHERE booking_id = $1
         ORDER BY created_at ASC;`,
        [booking.id]
      );
      expect(tokensDb.rows.length).toBe(2);
      expect(tokensDb.rows[0].revoked_at).not.toBeNull();
      expect(tokensDb.rows[1].revoked_at).toBeNull();
      expect(tokensDb.rows[1].hash_version).toBe(CUSTODY_HASH_VERSION);
      expect(tokensDb.rows[1].token_hash).toBe(
        computeCustodyCredentialHmac({
          purpose: "CUSTODY_QR",
          bookingId: booking.id,
          operation: "CHECK_IN",
          credential: pass2.qrToken
        })
      );
      expect(tokensDb.rows[1].token_hash).not.toBe(
        crypto.createHash("sha256").update(pass2.qrToken).digest("hex")
      );
      expect(tokensDb.rows[1].pin_hash).not.toBe(
        crypto.createHash("sha256").update(pass2.verificationPin).digest("hex")
      );

      // Superseded token fails verification
      const supersededRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/custody/verify",
        headers: { authorization: `Bearer ${owner.accessToken}` },
        payload: {
          bookingId: booking.id,
          operation: "CHECK_IN",
          qrToken: pass1.qrToken
        }
      });
      expect(supersededRes.statusCode).toBe(401);

      // Leading-zero 6-digit PIN end-to-end verification ("000007")
      const zeroPinDigest = computeCustodyCredentialHmac({
        purpose: "CUSTODY_PIN",
        bookingId: booking.id,
        operation: "CHECK_IN",
        credential: "000007"
      });
      await migratorPool.query(
        "UPDATE custody_tokens SET pin_hash = $1 WHERE booking_id = $2 AND revoked_at IS NULL;",
        [zeroPinDigest, booking.id]
      );

      // Unpadded "7" rejected by schema validation (400)
      const unpaddedRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/custody/verify",
        headers: { authorization: `Bearer ${owner.accessToken}` },
        payload: {
          bookingId: booking.id,
          operation: "CHECK_IN",
          verificationPin: "7"
        }
      });
      expect(unpaddedRes.statusCode).toBe(400);

      // Exact "000007" succeeds on /verify
      const zeroVerifyRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/custody/verify",
        headers: { authorization: `Bearer ${owner.accessToken}` },
        payload: {
          bookingId: booking.id,
          operation: "CHECK_IN",
          verificationPin: "000007"
        }
      });
      expect(zeroVerifyRes.statusCode).toBe(200);
      expect(JSON.parse(zeroVerifyRes.body).data.verified).toBe(true);

      // Check-in token cannot authorize /check-out (COLLECTION)
      const wrongOpRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/custody/${booking.id}/check-out`,
        headers: { authorization: `Bearer ${owner.accessToken}` },
        payload: {
          verificationPin: "000007",
          releasedBagCount: 1
        }
      });
      expect(wrongOpRes.statusCode).toBe(409);

      // Cross-endpoint uniform rate limiting across /verify, /check-in, /check-out (booking limit = 8)
      await rateLimitService.clearAll();
      const attemptResults: number[] = [];
      for (let i = 0; i < 9; i++) {
        const endpoint =
          i % 2 === 0
            ? "/api/v1/hosts/custody/verify"
            : `/api/v1/hosts/custody/${booking.id}/check-in`;
        const payload =
          i % 2 === 0
            ? { bookingId: booking.id, operation: "CHECK_IN", verificationPin: "999999" }
            : {
                verificationPin: "999999",
                bags: [{ bagTagCode: `TAG-${i}`, bagCategory: "BAG_MEDIUM" }]
              };
        const res = await app.inject({
          method: "POST",
          url: endpoint,
          headers: { authorization: `Bearer ${owner.accessToken}` },
          payload
        });
        attemptResults.push(res.statusCode);
      }
      expect(attemptResults.slice(0, 8).every((c) => c === 401)).toBe(true);
      expect(attemptResults[8]).toBe(429);

      // After clearing rate limit, complete CHECK_IN with "000007", verify single-use + no plaintext in GET or audit
      await rateLimitService.clearAll();
      const checkInRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/custody/${booking.id}/check-in`,
        headers: { authorization: `Bearer ${owner.accessToken}` },
        payload: {
          verificationPin: "000007",
          bags: [{ bagTagCode: "GF-0001", bagCategory: "BAG_MEDIUM" }]
        }
      });
      expect(checkInRes.statusCode).toBe(200);

      // Replay of same QR/PIN now fails
      const replayCheckIn = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/custody/${booking.id}/check-in`,
        headers: { authorization: `Bearer ${owner.accessToken}` },
        payload: {
          qrToken: pass2.qrToken,
          bags: [{ bagTagCode: "GF-0002", bagCategory: "BAG_MEDIUM" }]
        }
      });
      expect(replayCheckIn.statusCode).toBe(409);

      // Issue COLLECTION pass, ensure it cannot authorize CHECK_IN and audit logs never contain plaintext credentials
      const collPassRes = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${booking.id}/custody-pass`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { operation: "COLLECTION" }
      });
      expect(collPassRes.statusCode).toBe(200);
      const collPass = JSON.parse(collPassRes.body).data as {
        qrToken: string;
        verificationPin: string;
      };

      const crossCheckIn = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/custody/${booking.id}/check-in`,
        headers: { authorization: `Bearer ${owner.accessToken}` },
        payload: {
          qrToken: collPass.qrToken,
          bags: [{ bagTagCode: "GF-0003", bagCategory: "BAG_MEDIUM" }]
        }
      });
      expect(crossCheckIn.statusCode).toBe(409);

      const custodyGet = await app.inject({
        method: "GET",
        url: `/api/v1/hosts/custody/${booking.id}`,
        headers: { authorization: `Bearer ${owner.accessToken}` }
      });
      expect(custodyGet.statusCode).toBe(200);
      expect(custodyGet.body).not.toContain(pass2.qrToken);
      expect(custodyGet.body).not.toContain(collPass.qrToken);
      expect(custodyGet.body).not.toContain("000007");
      expect(custodyGet.body).not.toContain(collPass.verificationPin);

      const auditLeakRes = await migratorPool.query(
        `SELECT COUNT(*)::int AS cnt
         FROM security_audit_events
         WHERE metadata::text LIKE '%' || $1 || '%'
            OR metadata::text LIKE '%' || $2 || '%'
            OR metadata::text LIKE '%000007%';`,
        [pass2.qrToken, collPass.qrToken]
      );
      expect(auditLeakRes.rows[0].cnt).toBe(0);
    });

    it("upgrades 0012 -> 0013 safely: revokes unconsumed legacy SHA-256 tokens, preserves completed custody history, and enforces single-active-intent", async () => {
      const parsed = new URL(env.MIGRATION_DATABASE_URL);
      const superUrl = new URL(env.MIGRATION_DATABASE_URL);
      superUrl.username = "postgres";
      superUrl.password = "postgres";
      superUrl.pathname = "/postgres";

      const adminPool = new Pool({ connectionString: superUrl.toString(), max: 1 });
      const upgradeDb = `phaseb_0012_0013_${Date.now()}`;

      const createRoleGrantedDb = async (dbName: string) => {
        await adminPool.query(`CREATE DATABASE ${dbName} OWNER postgres;`);
        await adminPool.query(`REVOKE ALL ON DATABASE ${dbName} FROM PUBLIC;`);
        await adminPool.query(
          `GRANT CONNECT, TEMPORARY ON DATABASE ${dbName} TO luggage_migrator, luggage_user;`
        );
        const dbSuperUrl = new URL(superUrl.toString());
        dbSuperUrl.pathname = `/${dbName}`;
        const dbSuperPool = new Pool({ connectionString: dbSuperUrl.toString(), max: 1 });
        try {
          await dbSuperPool.query(`CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;`);
          await dbSuperPool.query(`CREATE EXTENSION IF NOT EXISTS postgis_topology;`);
          await dbSuperPool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;`);
          await dbSuperPool.query(
            `GRANT USAGE, CREATE ON SCHEMA public TO luggage_migrator, luggage_role_assigner;`
          );
          await dbSuperPool.query(`GRANT USAGE ON SCHEMA public TO luggage_user;`);
          await dbSuperPool.query(`REVOKE CREATE ON SCHEMA public FROM luggage_user;`);
          await dbSuperPool.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE luggage_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO luggage_user;`
          );
          await dbSuperPool.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE luggage_migrator IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO luggage_user;`
          );
          await dbSuperPool.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE luggage_migrator IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;`
          );
          await dbSuperPool.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE luggage_migrator IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO luggage_user;`
          );
        } finally {
          await dbSuperPool.end();
        }
      };

      try {
        await createRoleGrantedDb(upgradeDb);

        const upgMigUrl = new URL(parsed.toString());
        upgMigUrl.pathname = `/${upgradeDb}`;
        const upgPool = new Pool({ connectionString: upgMigUrl.toString(), max: 1 });

        const ids = {
          travellerId: crypto.randomUUID(),
          hostId: crypto.randomUUID(),
          bizId: crypto.randomUUID(),
          locId: crypto.randomUUID(),
          completedBookingId: crypto.randomUUID(),
          completedCustodyId: crypto.randomUUID(),
          completedTokenId: crypto.randomUUID(),
          activeBookingId: crypto.randomUUID(),
          activeCustodyId: crypto.randomUUID(),
          activeTokenId: crypto.randomUUID(),
          olderIntentId: crypto.randomUUID(),
          newerIntentId: crypto.randomUUID()
        };

        try {
          const currentDir = path.dirname(fileURLToPath(import.meta.url));
          const migrationsFolder = path.resolve(
            currentDir,
            "../src/infrastructure/database/migrations"
          );
          const allMigrations = readMigrationFiles({ migrationsFolder });
          // 0000..0012 = first 13 entries
          const through0012 = allMigrations.slice(0, 13);

          await upgPool.query(`
            CREATE TABLE IF NOT EXISTS public.__drizzle_migrations (
              id SERIAL PRIMARY KEY,
              hash text NOT NULL,
              created_at bigint
            );
          `);

          for (const m of through0012) {
            await upgPool.query("BEGIN");
            for (const stmt of m.sql) {
              await upgPool.query(stmt);
            }
            await upgPool.query(
              `INSERT INTO public.__drizzle_migrations ("hash", "created_at") VALUES ($1, $2);`,
              [m.hash, m.folderMillis]
            );
            await upgPool.query("COMMIT");
          }

          // Seed baseline users, host, location at 0012 schema version
          await upgPool.query(
            `INSERT INTO users (id, email, normalized_email, password_hash, display_name, status, is_email_verified)
             VALUES
               ($1, 't@example.com', 't@example.com', '$argon2id$v=19$m=65536,t=3,p=4$test$test', 'T', 'ACTIVE', true),
               ($2, 'h@example.com', 'h@example.com', '$argon2id$v=19$m=65536,t=3,p=4$test$test', 'H', 'ACTIVE', true);`,
            [ids.travellerId, ids.hostId]
          );
          await upgPool.query(
            `INSERT INTO host_businesses (id, owner_user_id, legal_business_name, trade_name, contact_email, contact_phone, status)
             VALUES ($1, $2, 'Legacy Co', 'Legacy Co', 'h@example.com', '+94771234567', 'ACTIVE');`,
            [ids.bizId, ids.hostId]
          );
          await upgPool.query(
            `INSERT INTO storage_locations (
               id, business_id, name, address_line1, city, latitude, longitude, coordinates, coarse_coordinates, status
             ) VALUES (
               $1, $2, 'Legacy Counter', '10 Main St', 'Colombo', 6.9271, 79.8612,
               ST_SetSRID(ST_MakePoint(79.8612, 6.9271), 4326)::geography,
               ST_SetSRID(ST_MakePoint(79.86, 6.93), 4326)::geography,
               'ACTIVE'
             );`,
            [ids.locId, ids.bizId]
          );

          // Completed booking + consumed legacy token + custody history (must remain intact)
          await upgPool.query(
            `INSERT INTO bookings (
               id, reference_code, traveller_user_id, business_id, location_id, booking_mode,
               status, drop_off_at, collection_at, total_bags, total_capacity_units, currency, total_amount_minor
             ) VALUES (
               $1, 'LGS-COMP01', $2, $3, $4, 'INSTANT',
               'COMPLETED', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', 1, 2, 'LKR', 100000
             );`,
            [ids.completedBookingId, ids.travellerId, ids.bizId, ids.locId]
          );
          await upgPool.query(
            `INSERT INTO custody_records (id, booking_id, location_id, business_id, status, expected_bag_count, checked_in_bag_count, released_bag_count)
             VALUES ($1, $2, $3, $4, 'RELEASED_TO_TRAVELLER', 1, 1, 1);`,
            [ids.completedCustodyId, ids.completedBookingId, ids.locId, ids.bizId]
          );
          await upgPool.query(
            `INSERT INTO bag_custody_items (custody_record_id, bag_tag_code, bag_category)
             VALUES ($1, 'LEG-TAG-1', 'BAG_MEDIUM');`,
            [ids.completedCustodyId]
          );
          await upgPool.query(
            `INSERT INTO custody_events (custody_record_id, booking_id, event_type, new_status, actor_role)
             VALUES ($1, $2, 'BAGS_RELEASED', 'RELEASED_TO_TRAVELLER', 'HOST_OWNER');`,
            [ids.completedCustodyId, ids.completedBookingId]
          );
          const legConsumedHash = crypto.createHash("sha256").update("legacy-consumed").digest("hex");
          const legConsumedPinHash = crypto.createHash("sha256").update("111111").digest("hex");
          await upgPool.query(
            `INSERT INTO custody_tokens (id, custody_record_id, booking_id, operation, token_hash, pin_hash, expires_at, consumed_at)
             VALUES ($1, $2, $3, 'CHECK_IN', $4, $5, NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours');`,
            [ids.completedTokenId, ids.completedCustodyId, ids.completedBookingId, legConsumedHash, legConsumedPinHash]
          );

          // Active booking with unconsumed legacy token & 2 overlapping PENDING_GATEWAY intents
          await upgPool.query(
            `INSERT INTO bookings (
               id, reference_code, traveller_user_id, business_id, location_id, booking_mode,
               status, drop_off_at, collection_at, total_bags, total_capacity_units, currency, total_amount_minor
             ) VALUES (
               $1, 'LGS-ACT002', $2, $3, $4, 'INSTANT',
               'CONFIRMED', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days', 1, 2, 'LKR', 150000
             );`,
            [ids.activeBookingId, ids.travellerId, ids.bizId, ids.locId]
          );
          const legActivePinHash = crypto.createHash("sha256").update("222222").digest("hex");
          await upgPool.query(
            `INSERT INTO custody_records (id, booking_id, location_id, business_id, status, checkin_pin_hash, expected_bag_count)
             VALUES ($1, $2, $3, $4, 'EXPECTED', $5, 1);`,
            [ids.activeCustodyId, ids.activeBookingId, ids.locId, ids.bizId, legActivePinHash]
          );
          const legActiveHash = crypto.createHash("sha256").update("legacy-active").digest("hex");
          await upgPool.query(
            `INSERT INTO custody_tokens (id, custody_record_id, booking_id, operation, token_hash, pin_hash, expires_at)
             VALUES ($1, $2, $3, 'CHECK_IN', $4, $5, NOW() + INTERVAL '15 minutes');`,
            [ids.activeTokenId, ids.activeCustodyId, ids.activeBookingId, legActiveHash, legActivePinHash]
          );
          await upgPool.query(
            `INSERT INTO payment_intents (id, booking_id, traveller_user_id, provider, provider_order_id, amount_minor, currency, status, expires_at, created_at)
             VALUES
               ($1, $3, $4, 'SANDBOX_GATEWAY', 'ORD-OLD-1', 150000, 'LKR', 'PENDING_GATEWAY', NOW() + INTERVAL '10 minutes', NOW() - INTERVAL '2 minutes'),
               ($2, $3, $4, 'SANDBOX_GATEWAY', 'ORD-NEW-2', 150000, 'LKR', 'PENDING_GATEWAY', NOW() + INTERVAL '10 minutes', NOW() - INTERVAL '10 seconds');`,
            [ids.olderIntentId, ids.newerIntentId, ids.activeBookingId, ids.travellerId]
          );
        } finally {
          await upgPool.end();
        }

        // Apply migration 0013 via official runner
        const upgradedCount = await runMigrations(upgMigUrl.toString());
        expect(upgradedCount).toBe(1);

        const verifyPool = new Pool({ connectionString: upgMigUrl.toString(), max: 1 });
        try {
          const completedRec = await verifyPool.query(
            "SELECT status FROM custody_records WHERE id = $1;",
            [ids.completedCustodyId]
          );
          expect(completedRec.rows[0].status).toBe("RELEASED_TO_TRAVELLER");

          const bagItems = await verifyPool.query(
            "SELECT COUNT(*)::int AS cnt FROM bag_custody_items WHERE custody_record_id = $1;",
            [ids.completedCustodyId]
          );
          expect(bagItems.rows[0].cnt).toBe(1);

          const custodyEvts = await verifyPool.query(
            "SELECT COUNT(*)::int AS cnt FROM custody_events WHERE custody_record_id = $1;",
            [ids.completedCustodyId]
          );
          expect(custodyEvts.rows[0].cnt).toBe(1);

          const compTok = await verifyPool.query(
            "SELECT hash_version, revoked_at, consumed_at FROM custody_tokens WHERE id = $1;",
            [ids.completedTokenId]
          );
          expect(compTok.rows[0].hash_version).toBe(LEGACY_CUSTODY_HASH_VERSION);
          expect(compTok.rows[0].consumed_at).not.toBeNull();
          expect(compTok.rows[0].revoked_at).toBeNull();

          const actTok = await verifyPool.query(
            "SELECT hash_version, revoked_at FROM custody_tokens WHERE id = $1;",
            [ids.activeTokenId]
          );
          expect(actTok.rows[0].hash_version).toBe(LEGACY_CUSTODY_HASH_VERSION);
          expect(actTok.rows[0].revoked_at).not.toBeNull();

          const actRec = await verifyPool.query(
            "SELECT checkin_pin_hash FROM custody_records WHERE id = $1;",
            [ids.activeCustodyId]
          );
          expect(actRec.rows[0].checkin_pin_hash).toBeNull();

          const intents = await verifyPool.query(
            "SELECT id, status FROM payment_intents WHERE booking_id = $1;",
            [ids.activeBookingId]
          );
          const older = intents.rows.find((r) => r.id === ids.olderIntentId);
          const newer = intents.rows.find((r) => r.id === ids.newerIntentId);
          expect(older.status).toBe("EXPIRED");
          expect(newer.status).toBe("PENDING_GATEWAY");

          // Verify partial unique index blocks a second active intent insert at PostgreSQL level
          let dupError: PgErrorShape | null = null;
          try {
            await verifyPool.query(
              `INSERT INTO payment_intents (booking_id, traveller_user_id, provider, provider_order_id, amount_minor, currency, status, expires_at)
               VALUES ($1, $2, 'SANDBOX_GATEWAY', 'ORD-DUP-3', 150000, 'LKR', 'PENDING_GATEWAY', NOW() + INTERVAL '10 minutes');`,
              [ids.activeBookingId, ids.travellerId]
            );
          } catch (err) {
            dupError = err as PgErrorShape;
          }
          expect(dupError?.code).toBe("23505");
          expect(dupError?.constraint).toBe("payment_intents_single_active_per_booking_idx");
        } finally {
          await verifyPool.end();
        }
      } finally {
        await adminPool.query(`DROP DATABASE IF EXISTS ${upgradeDb} WITH (FORCE);`).catch(() => {});
        await adminPool.end();
      }
    }, 60000);
  });

  // ==========================================================================
  // 2. B2: PaymentGatewayPort & Official PayHere Notification Verification
  // ==========================================================================
  describe("2. B2: PaymentGatewayPort, PayHere Adapter & Shared Settlement Pipeline", () => {
    it("converts decimal amounts using pure integer math and rejects invalid strings", () => {
      expect(formatMinorAmountTwoDecimals(50)).toBe("0.50");
      expect(formatMinorAmountTwoDecimals(150000)).toBe("1500.00");
      expect(parsePayHereDecimalAmountToMinor("0.50")).toBe(50);
      expect(parsePayHereDecimalAmountToMinor("1500.00")).toBe(150000);

      for (const bad of ["1500", "15.999", "-1.00", "0.00", "1e3", "999999999999.00", "abc.00"]) {
        expect(() => parsePayHereDecimalAmountToMinor(bad)).toThrow();
      }
    });

    it("computes deterministic PayHere checkout MD5 hash and notification md5sig, and blocks sandbox adapter in production", () => {
      const phAdapter = new PayHereGatewayAdapter(
        TEST_PAYHERE_MERCHANT_ID,
        TEST_PAYHERE_MERCHANT_SECRET,
        true
      );
      const intentId = crypto.randomUUID();
      const bookingId = crypto.randomUUID();
      const checkout = phAdapter.buildCheckoutPayload({
        intentId,
        bookingId,
        referenceCode: "LGS-PH001",
        providerOrderId: "ORD-PH-001",
        amountMinor: 150000,
        currency: "LKR",
        customerEmail: "traveller@example.com",
        customerName: "Kasun Perera"
      });

      const hashedSecret = crypto
        .createHash("md5")
        .update(TEST_PAYHERE_MERCHANT_SECRET, "utf8")
        .digest("hex")
        .toUpperCase();
      const expectedCheckoutHash = crypto
        .createHash("md5")
        .update(`${TEST_PAYHERE_MERCHANT_ID}ORD-PH-0011500.00LKR${hashedSecret}`, "utf8")
        .digest("hex")
        .toUpperCase();

      expect(checkout.actionUrl).toBe("https://sandbox.payhere.lk/pay/checkout");
      expect(checkout.hash).toBe(expectedCheckoutHash);
      expect(checkout.amount).toBe("1500.00");
      expect(checkout.custom_1).toBe(intentId);
      expect(checkout.custom_2).toBe(bookingId);

      const liveAdapter = new PayHereGatewayAdapter(
        TEST_PAYHERE_MERCHANT_ID,
        TEST_PAYHERE_MERCHANT_SECRET,
        false
      );
      const liveCheckout = liveAdapter.buildCheckoutPayload({
        intentId,
        bookingId,
        referenceCode: "LGS-PH002",
        providerOrderId: "ORD-PH-002",
        amountMinor: 150000,
        currency: "LKR",
        customerEmail: "traveller@example.com",
        customerName: "Kasun Perera"
      });
      expect(liveCheckout.actionUrl).toBe("https://www.payhere.lk/pay/checkout");

      // Sandbox webhook verification fails closed in production
      const prodSandbox = new SandboxSignedGatewayAdapter(env.PAYMENT_WEBHOOK_SECRET, "production");

      const sbxPayload = JSON.stringify({
        eventId: "evt_prod_fail_closed_1",
        providerOrderId: "ORD-SBX",
        providerTransactionId: "tx_prod_1",
        status: "SUCCEEDED",
        amountMinor: 150000,
        currency: "LKR",
        timestamp: Math.floor(Date.now() / 1000)
      });
      const devSbx = new SandboxSignedGatewayAdapter(env.PAYMENT_WEBHOOK_SECRET, "development");
      const sig = devSbx.signWebhookPayload(sbxPayload);
      expect(() =>
        prodSandbox.verifyAndNormalizeNotification({
          rawBody: sbxPayload,
          headers: { "x-sandbox-signature": sig },
          contentType: "application/json"
        })
      ).toThrow(/disabled in production/i);
    });

    it("processes form-urlencoded and JSON PayHere notifications, status codes (2, 0, -1, -2, -3), replays, and out-of-order events", async () => {
      await withPayHereEnv(async () => {
        const runTag = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const confTxId = `PH-TX-CONF-${runTag}`;
        const traveller = await createTestUser("TRAVELLER", "PayHere Traveller");
        const { locationId } = await createActiveLocation({ baseRateMinor: 100000 });

        // Flow A: Pending -> Succeeded -> Duplicate Replay -> Out-of-order Failure -> Chargeback
        const { booking, intent } = await createBookingAndIntent({
          travellerToken: traveller.accessToken,
          locationId,
          daysAhead: 9
        });
        expect(intent.provider).toBe("PAYHERE");

        // 1. status_code = 0 (PAYMENT_PENDING)
        const pendingForm = buildPayHereNotifyForm({
          orderId: intent.providerOrderId,
          payhereAmount: "1000.00",
          payhereCurrency: "LKR",
          statusCode: "0",
          custom1: intent.id,
          custom2: booking.id
        });
        const pendingRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: pendingForm
        });
        expect(pendingRes.statusCode).toBe(200);
        expect(JSON.parse(pendingRes.body).data.outcome).toBe("PAYMENT_PENDING");

        // 2. status_code = 2 (SUCCEEDED) via form-urlencoded
        const successForm = buildPayHereNotifyForm({
          orderId: intent.providerOrderId,
          paymentId: confTxId,
          payhereAmount: "1000.00",
          payhereCurrency: "LKR",
          statusCode: "2",
          custom1: intent.id,
          custom2: booking.id,
          method: "VISA",
          statusMessage: "Successfully completed the payment."
        });
        const successRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: successForm
        });
        expect(successRes.statusCode).toBe(200);
        expect(JSON.parse(successRes.body).data).toMatchObject({
          duplicate: false,
          outcome: "BOOKING_CONFIRMED",
          bookingId: booking.id,
          bookingStatus: "CONFIRMED"
        });

        const txRows = await migratorPool.query(
          "SELECT provider, provider_transaction_id, signature_verified FROM payment_transactions WHERE booking_id = $1;",
          [booking.id]
        );
        expect(txRows.rows.length).toBeGreaterThanOrEqual(1);
        const chargeTx = txRows.rows.find((r) => r.provider_transaction_id === confTxId);
        expect(chargeTx?.provider).toBe("PAYHERE");
        expect(chargeTx?.signature_verified).toBe(true);

        const custodyCheck = await migratorPool.query(
          "SELECT status FROM custody_records WHERE booking_id = $1;",
          [booking.id]
        );
        expect(custodyCheck.rows[0].status).toBe("EXPECTED");

        // 3. Replayed identical status_code = 2 notification -> idempotent duplicate
        const replayRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: successForm
        });
        expect(replayRes.statusCode).toBe(200);
        expect(JSON.parse(replayRes.body).data.duplicate).toBe(true);

        // 4. Out-of-order failure notification AFTER settlement -> ALREADY_SETTLED_NOOP, booking stays CONFIRMED
        const lateFailForm = buildPayHereNotifyForm({
          orderId: intent.providerOrderId,
          paymentId: `PH-TX-LATEFAIL-${runTag}`,
          payhereAmount: "1000.00",
          payhereCurrency: "LKR",
          statusCode: "-2",
          custom1: intent.id
        });
        const lateFailRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: lateFailForm
        });
        expect(lateFailRes.statusCode).toBe(200);
        expect(JSON.parse(lateFailRes.body).data).toMatchObject({
          duplicate: true,
          outcome: "ALREADY_SETTLED_NOOP",
          bookingStatus: "CONFIRMED"
        });

        // 5. Chargeback status_code = -3 on CONFIRMED booking -> DISPUTED
        const chargebackForm = buildPayHereNotifyForm({
          orderId: intent.providerOrderId,
          paymentId: `PH-TX-CB-${runTag}`,
          payhereAmount: "1000.00",
          payhereCurrency: "LKR",
          statusCode: "-3",
          statusMessage: "Cardholder dispute chargeback"
        });
        const chargebackRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: chargebackForm
        });
        expect(chargebackRes.statusCode).toBe(200);
        expect(JSON.parse(chargebackRes.body).data).toMatchObject({
          outcome: "CHARGEBACK_FLAGGED_FOR_REVIEW",
          bookingStatus: "DISPUTED"
        });

        // Flow B: Flat JSON notification status_code = 2
        const bJson = await createBookingAndIntent({
          travellerToken: traveller.accessToken,
          locationId,
          daysAhead: 11
        });
        const jsonSig = PayHereGatewayAdapter.computeNotifyMd5Sig({
          merchantId: TEST_PAYHERE_MERCHANT_ID,
          orderId: bJson.intent.providerOrderId,
          payhereAmount: "1000.00",
          payhereCurrency: "LKR",
          statusCode: "2",
          merchantSecret: TEST_PAYHERE_MERCHANT_SECRET
        });
        const jsonRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/json" },
          payload: JSON.stringify({
            merchant_id: TEST_PAYHERE_MERCHANT_ID,
            order_id: bJson.intent.providerOrderId,
            payment_id: `PH-TX-JSON-${runTag}`,
            payhere_amount: "1000.00",
            payhere_currency: "LKR",
            status_code: 2,
            md5sig: jsonSig,
            custom_1: bJson.intent.id
          })
        });
        expect(jsonRes.statusCode).toBe(200);
        expect(JSON.parse(jsonRes.body).data.bookingStatus).toBe("CONFIRMED");

        // Flow C: status_code = -1 (CANCELLED) and status_code = -2 (FAILED)
        const bCancel = await createBookingAndIntent({
          travellerToken: traveller.accessToken,
          locationId,
          daysAhead: 12
        });
        const cancelledWebhook = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: buildPayHereNotifyForm({
            orderId: bCancel.intent.providerOrderId,
            paymentId: `PH-TX-CXL-${runTag}`,
            payhereAmount: "1000.00",
            payhereCurrency: "LKR",
            statusCode: "-1"
          })
        });
        expect(cancelledWebhook.statusCode).toBe(200);
        expect(JSON.parse(cancelledWebhook.body).data.outcome).toBe("PAYMENT_CANCELLED");

        const bFail = await createBookingAndIntent({
          travellerToken: traveller.accessToken,
          locationId,
          daysAhead: 13
        });
        const failedWebhook = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: buildPayHereNotifyForm({
            orderId: bFail.intent.providerOrderId,
            paymentId: `PH-TX-FAIL-${runTag}`,
            payhereAmount: "1000.00",
            payhereCurrency: "LKR",
            statusCode: "-2"
          })
        });
        expect(failedWebhook.statusCode).toBe(200);
        expect(JSON.parse(failedWebhook.body).data.outcome).toBe("PAYMENT_FAILED");

        // Verify duplicate payment_id across another intent is rejected with 409
        const bDupTx = await createBookingAndIntent({
          travellerToken: traveller.accessToken,
          locationId,
          daysAhead: 14
        });
        const dupTxRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: buildPayHereNotifyForm({
            orderId: bDupTx.intent.providerOrderId,
            paymentId: confTxId,
            payhereAmount: "1000.00",
            payhereCurrency: "LKR",
            statusCode: "2"
          })
        });
        expect(dupTxRes.statusCode).toBe(409);
      });
    });

    it("rejects invalid PayHere signatures, wrong merchant, tampered amount/currency, HPP duplicate params, oversized body, unknown order, and cross-provider settlement", async () => {
      const traveller = await createTestUser("TRAVELLER", "Validation Traveller");
      const { locationId } = await createActiveLocation({ baseRateMinor: 120000 });

      // Create a SANDBOX_GATEWAY intent while env is sandbox
      const sbxPair = await createBookingAndIntent({
        travellerToken: traveller.accessToken,
        locationId,
        daysAhead: 15
      });
      expect(sbxPair.intent.provider).toBe("SANDBOX_GATEWAY");

      await withPayHereEnv(async () => {
        const phPair = await createBookingAndIntent({
          travellerToken: traveller.accessToken,
          locationId,
          daysAhead: 16
        });

        // 1. Missing md5sig -> 401
        const missingSigRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: buildPayHereNotifyForm({
            orderId: phPair.intent.providerOrderId,
            payhereAmount: "1200.00",
            payhereCurrency: "LKR",
            statusCode: "2",
            md5sigOverride: null
          })
        });
        expect(missingSigRes.statusCode).toBe(401);

        // 2. Wrong md5sig -> 401
        const badSigRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: buildPayHereNotifyForm({
            orderId: phPair.intent.providerOrderId,
            payhereAmount: "1200.00",
            payhereCurrency: "LKR",
            statusCode: "2",
            md5sigOverride: "A".repeat(32)
          })
        });
        expect(badSigRes.statusCode).toBe(401);

        // 3. Wrong merchant_id -> 401
        const badMerchantRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: buildPayHereNotifyForm({
            merchantId: "9999999",
            orderId: phPair.intent.providerOrderId,
            payhereAmount: "1200.00",
            payhereCurrency: "LKR",
            statusCode: "2"
          })
        });
        expect(badMerchantRes.statusCode).toBe(401);

        // 4. Signed wrong amount -> 400
        const wrongAmountRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: buildPayHereNotifyForm({
            orderId: phPair.intent.providerOrderId,
            payhereAmount: "100.00",
            payhereCurrency: "LKR",
            statusCode: "2"
          })
        });
        expect(wrongAmountRes.statusCode).toBe(400);

        // 5. Signed wrong currency -> 400
        const wrongCurrencyRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: buildPayHereNotifyForm({
            orderId: phPair.intent.providerOrderId,
            payhereAmount: "1200.00",
            payhereCurrency: "USD",
            statusCode: "2"
          })
        });
        expect(wrongCurrencyRes.statusCode).toBe(400);

        // 6. Duplicate URL-encoded HPP parameter -> 400
        const hppRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: `payhere_amount=1200.00&${buildPayHereNotifyForm({
            orderId: phPair.intent.providerOrderId,
            payhereAmount: "1.00",
            payhereCurrency: "LKR",
            statusCode: "2"
          })}`
        });
        expect(hppRes.statusCode).toBe(400);

        // 7. Nested JSON rejected -> 400
        const nestedJsonRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/json" },
          payload: JSON.stringify({ nested: { bad: true } })
        });
        expect(nestedJsonRes.statusCode).toBe(400);

        // 8. Oversized > 64KB body rejected -> 413
        const bigRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: `status_message=${"X".repeat(70_000)}`
        });
        expect(bigRes.statusCode).toBe(413);

        // 9. Unknown order_id -> 404
        const unknownOrderRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: buildPayHereNotifyForm({
            orderId: "ORD-DOES-NOT-EXIST-999",
            payhereAmount: "1200.00",
            payhereCurrency: "LKR",
            statusCode: "2"
          })
        });
        expect(unknownOrderRes.statusCode).toBe(404);

        // 10. PayHere webhook targeting SANDBOX_GATEWAY intent -> 409
        const crossPhToSbx = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: buildPayHereNotifyForm({
            orderId: sbxPair.intent.providerOrderId,
            payhereAmount: "1200.00",
            payhereCurrency: "LKR",
            statusCode: "2"
          })
        });
        expect(crossPhToSbx.statusCode).toBe(409);

        // 11. Sandbox webhook targeting PAYHERE intent -> 409
        const sbxAdapter = new SandboxSignedGatewayAdapter(env.PAYMENT_WEBHOOK_SECRET);
        const crossSbxPayload = JSON.stringify({
          eventId: `evt_cross_${Date.now()}`,
          providerOrderId: phPair.intent.providerOrderId,
          providerTransactionId: `tx_cross_${Date.now()}`,
          status: "SUCCEEDED",
          amountMinor: 120000,
          currency: "LKR",
          timestamp: Math.floor(Date.now() / 1000)
        });
        const crossSbxToPh = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/sandbox",
          headers: {
            "content-type": "application/json",
            "x-sandbox-signature": sbxAdapter.signWebhookPayload(crossSbxPayload)
          },
          payload: crossSbxPayload
        });
        expect(crossSbxToPh.statusCode).toBe(409);

        // Booking remains PENDING_PAYMENT after all rejections
        const bCheck = await migratorPool.query("SELECT status FROM bookings WHERE id = $1;", [
          phPair.booking.id
        ]);
        expect(bCheck.rows[0].status).toBe("PENDING_PAYMENT");
      });
    });

    it("handles late PayHere capture on expired hold with 100% auto-refund and preserves snapshotted pricing integrity", async () => {
      await withPayHereEnv(async () => {
        const traveller = await createTestUser("TRAVELLER", "Late PayHere Traveller");
        const { locationId } = await createActiveLocation({
          baseRateMinor: 100000
        });
        const { booking, intent } = await createBookingAndIntent({
          travellerToken: traveller.accessToken,
          locationId,
          daysAhead: 17
        });

        await migratorPool.query(
          "UPDATE bookings SET hold_expires_at = NOW() - INTERVAL '3 minutes' WHERE id = $1;",
          [booking.id]
        );
        await migratorPool.query(
          "UPDATE capacity_reservations SET expires_at = NOW() - INTERVAL '3 minutes' WHERE booking_id = $1;",
          [booking.id]
        );

        const lateForm = buildPayHereNotifyForm({
          orderId: intent.providerOrderId,
          paymentId: `PH-TX-LATE-CAP-${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          payhereAmount: "1000.00",
          payhereCurrency: "LKR",
          statusCode: "2",
          custom1: intent.id
        });
        const lateRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: lateForm
        });
        expect(lateRes.statusCode).toBe(200);
        expect(JSON.parse(lateRes.body).data).toMatchObject({
          outcome: "LATE_CAPTURE_AUTO_REFUND_QUEUED",
          bookingStatus: "EXPIRED"
        });

        const intentDb = await migratorPool.query(
          "SELECT status FROM payment_intents WHERE id = $1;",
          [intent.id]
        );
        expect(intentDb.rows[0].status).toBe("ORPHANED_SUCCEEDED");

        const capDb = await migratorPool.query(
          "SELECT status FROM capacity_reservations WHERE booking_id = $1;",
          [booking.id]
        );
        expect(capDb.rows[0].status).toBe("RELEASED");

        const refundDb = await migratorPool.query(
          "SELECT amount_minor, refund_percentage, reason_category, status FROM refund_records WHERE booking_id = $1;",
          [booking.id]
        );
        expect(refundDb.rows.length).toBe(1);
        expect(refundDb.rows[0]).toMatchObject({
          amount_minor: 100000,
          refund_percentage: 100,
          reason_category: "LATE_WEBHOOK_EXPIRED_HOLD",
          status: "AUTHORIZED"
        });
      });
    });
  });

  // ==========================================================================
  // 3. B3: Real PostgreSQL Concurrency & Canonical Lock-Ordering Proof
  // ==========================================================================
  describe("3. B3: Real PostgreSQL Concurrency & Lock-Ordering Verification", () => {
    it("resolves concurrent traveller cancellation vs SUCCEEDED webhook without deadlocks or duplicate financial records", async () => {
      const traveller = await createTestUser("TRAVELLER", "Race Traveller");
      const { locationId } = await createActiveLocation({ baseRateMinor: 100000 });
      const sbxAdapter = new SandboxSignedGatewayAdapter(env.PAYMENT_WEBHOOK_SECRET);

      for (let round = 0; round < 3; round++) {
        const { booking, intent } = await createBookingAndIntent({
          travellerToken: traveller.accessToken,
          locationId,
          daysAhead: 20 + round
        });

        const rawWebhook = JSON.stringify({
          eventId: `evt_race_cxl_ok_${round}_${Date.now()}`,
          providerOrderId: intent.providerOrderId,
          providerTransactionId: `tx_race_cxl_ok_${round}_${Date.now()}`,
          status: "SUCCEEDED",
          amountMinor: intent.amountMinor,
          currency: intent.currency,
          timestamp: Math.floor(Date.now() / 1000)
        });
        const sig = sbxAdapter.signWebhookPayload(rawWebhook);

        const [cancelRes, webhookRes] = await Promise.all([
          app.inject({
            method: "POST",
            url: `/api/v1/bookings/${booking.id}/cancel`,
            headers: { authorization: `Bearer ${traveller.accessToken}` },
            payload: { reason: "Concurrent schedule change race" }
          }),
          app.inject({
            method: "POST",
            url: "/api/v1/payments/webhooks/sandbox",
            headers: {
              "content-type": "application/json",
              "x-sandbox-signature": sig
            },
            payload: rawWebhook
          })
        ]);

        expect(cancelRes.statusCode).toBe(200);
        expect(webhookRes.statusCode).toBe(200);

        const bRow = await migratorPool.query("SELECT status FROM bookings WHERE id = $1;", [
          booking.id
        ]);
        expect(bRow.rows[0].status).toBe("CANCELLED_BY_TRAVELLER");

        const refunds = await migratorPool.query(
          "SELECT amount_minor, status FROM refund_records WHERE booking_id = $1;",
          [booking.id]
        );
        expect(refunds.rows.length).toBe(1);
        expect(refunds.rows[0].amount_minor).toBe(intent.amountMinor);
        expect(refunds.rows[0].status).toBe("AUTHORIZED");

        const txCount = await migratorPool.query(
          "SELECT COUNT(*)::int AS cnt FROM payment_transactions WHERE booking_id = $1;",
          [booking.id]
        );
        expect(txCount.rows[0].cnt).toBe(1);

        const balanceRows = await migratorPool.query(
          `SELECT transaction_group_id,
                  SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_minor ELSE 0 END)::int AS debits,
                  SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_minor ELSE 0 END)::int AS credits
           FROM financial_ledger_entries
           WHERE booking_id = $1
           GROUP BY transaction_group_id;`,
          [booking.id]
        );
        expect(balanceRows.rows.length).toBe(2);
        for (const row of balanceRows.rows) {
          expect(row.debits).toBe(row.credits);
        }
      }
    });

    it("resolves cancellation racing FAILED webhook and host cancellation racing PayHere SUCCEEDED webhook cleanly", async () => {
      const traveller = await createTestUser("TRAVELLER", "HostRace Traveller");
      const { owner, locationId } = await createActiveLocation({ baseRateMinor: 100000 });
      const sbxAdapter = new SandboxSignedGatewayAdapter(env.PAYMENT_WEBHOOK_SECRET);

      // Race 1: Cancellation vs FAILED sandbox webhook
      const failRace = await createBookingAndIntent({
        travellerToken: traveller.accessToken,
        locationId,
        daysAhead: 25
      });
      const failRaw = JSON.stringify({
        eventId: `evt_race_fail_${Date.now()}`,
        providerOrderId: failRace.intent.providerOrderId,
        providerTransactionId: `tx_race_fail_${Date.now()}`,
        status: "FAILED",
        amountMinor: failRace.intent.amountMinor,
        currency: "LKR",
        timestamp: Math.floor(Date.now() / 1000),
        failureReason: "Declined by issuer"
      });
      const [cxl1, wh1] = await Promise.all([
        app.inject({
          method: "POST",
          url: `/api/v1/bookings/${failRace.booking.id}/cancel`,
          headers: { authorization: `Bearer ${traveller.accessToken}` },
          payload: { reason: "Cancel during payment decline" }
        }),
        app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/sandbox",
          headers: {
            "content-type": "application/json",
            "x-sandbox-signature": sbxAdapter.signWebhookPayload(failRaw)
          },
          payload: failRaw
        })
      ]);
      expect(cxl1.statusCode).toBe(200);
      expect(wh1.statusCode).toBe(200);

      const failRefunds = await migratorPool.query(
        "SELECT COUNT(*)::int AS cnt FROM refund_records WHERE booking_id = $1;",
        [failRace.booking.id]
      );
      expect(failRefunds.rows[0].cnt).toBe(0);

      // Race 2: Host cancellation vs PayHere SUCCEEDED webhook
      await withPayHereEnv(async () => {
        const hostRace = await createBookingAndIntent({
          travellerToken: traveller.accessToken,
          locationId,
          daysAhead: 26
        });
        const phForm = buildPayHereNotifyForm({
          orderId: hostRace.intent.providerOrderId,
          paymentId: `PH-RACE-HOST-${Date.now()}`,
          payhereAmount: "1000.00",
          payhereCurrency: "LKR",
          statusCode: "2"
        });
        const [hostCxl, phOk] = await Promise.all([
          app.inject({
            method: "POST",
            url: `/api/v1/hosts/bookings/${hostRace.booking.id}/cancel`,
            headers: { authorization: `Bearer ${owner.accessToken}` },
            payload: { reason: "Unexpected counter maintenance" }
          }),
          app.inject({
            method: "POST",
            url: "/api/v1/payments/webhooks/payhere",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            payload: phForm
          })
        ]);
        expect(hostCxl.statusCode).toBe(200);
        expect(phOk.statusCode).toBe(200);

        const bHost = await migratorPool.query("SELECT status FROM bookings WHERE id = $1;", [
          hostRace.booking.id
        ]);
        expect(bHost.rows[0].status).toBe("CANCELLED_BY_HOST");

        const rHost = await migratorPool.query(
          "SELECT amount_minor, refund_percentage FROM refund_records WHERE booking_id = $1;",
          [hostRace.booking.id]
        );
        expect(rHost.rows.length).toBe(1);
        expect(rHost.rows[0].refund_percentage).toBe(100);
      });
    });

    it("deduplicates 5x concurrent identical PayHere webhooks and settles late webhook vs sweepExpiredHolds safely", async () => {
      await withPayHereEnv(async () => {
        const traveller = await createTestUser("TRAVELLER", "Concurrent Webhook Traveller");
        const { locationId } = await createActiveLocation({ baseRateMinor: 100000 });

        // 1. 5x concurrent identical webhooks
        const pairA = await createBookingAndIntent({
          travellerToken: traveller.accessToken,
          locationId,
          daysAhead: 28
        });
        const okForm = buildPayHereNotifyForm({
          orderId: pairA.intent.providerOrderId,
          paymentId: `PH-5X-${Date.now()}`,
          payhereAmount: "1000.00",
          payhereCurrency: "LKR",
          statusCode: "2"
        });
        const responses = await Promise.all(
          Array.from({ length: 5 }, () =>
            app.inject({
              method: "POST",
              url: "/api/v1/payments/webhooks/payhere",
              headers: { "content-type": "application/x-www-form-urlencoded" },
              payload: okForm
            })
          )
        );
        expect(responses.every((r) => r.statusCode === 200)).toBe(true);
        const bodies = responses.map((r) => JSON.parse(r.body).data as { duplicate: boolean });
        expect(bodies.filter((b) => !b.duplicate).length).toBe(1);
        expect(bodies.filter((b) => b.duplicate).length).toBe(4);

        const custodyCount = await migratorPool.query(
          "SELECT COUNT(*)::int AS cnt FROM custody_records WHERE booking_id = $1;",
          [pairA.booking.id]
        );
        expect(custodyCount.rows[0].cnt).toBe(1);

        const txCount = await migratorPool.query(
          "SELECT COUNT(*)::int AS cnt FROM payment_transactions WHERE booking_id = $1;",
          [pairA.booking.id]
        );
        expect(txCount.rows[0].cnt).toBe(1);

        // 2. Late webhook vs sweepExpiredHolds right after hold expiry
        const pairB = await createBookingAndIntent({
          travellerToken: traveller.accessToken,
          locationId,
          daysAhead: 29
        });
        await migratorPool.query(
          "UPDATE bookings SET hold_expires_at = NOW() - INTERVAL '2 seconds' WHERE id = $1;",
          [pairB.booking.id]
        );
        await migratorPool.query(
          "UPDATE capacity_reservations SET expires_at = NOW() - INTERVAL '2 seconds' WHERE booking_id = $1;",
          [pairB.booking.id]
        );

        const lateForm = buildPayHereNotifyForm({
          orderId: pairB.intent.providerOrderId,
          paymentId: `PH-SWEEP-${Date.now()}`,
          payhereAmount: "1000.00",
          payhereCurrency: "LKR",
          statusCode: "2"
        });
        const [lateRes] = await Promise.all([
          app.inject({
            method: "POST",
            url: "/api/v1/payments/webhooks/payhere",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            payload: lateForm
          }),
          quotationService.sweepExpiredHolds()
        ]);
        expect(lateRes.statusCode).toBe(200);
        expect(JSON.parse(lateRes.body).data.bookingStatus).toBe("EXPIRED");

        const capB = await migratorPool.query(
          "SELECT status FROM capacity_reservations WHERE booking_id = $1;",
          [pairB.booking.id]
        );
        expect(capB.rows[0].status).toBe("RELEASED");

        const refB = await migratorPool.query(
          "SELECT amount_minor, refund_percentage FROM refund_records WHERE booking_id = $1;",
          [pairB.booking.id]
        );
        expect(refB.rows.length).toBe(1);
        expect(refB.rows[0]).toMatchObject({ amount_minor: 100000, refund_percentage: 100 });
      });
    });

    it("serializes concurrent refund transitions, check-in token consumption, and single-slot pool bookings without double mutation", async () => {
      const traveller = await createTestUser("TRAVELLER", "MultiRace Traveller");
      const superadmin = await createTestUser("SUPERADMIN", "MultiRace Admin");
      const { owner, locationId } = await createActiveLocation({
        baseRateMinor: 100000,
        sharedPoolUnits: 2
      });

      // 1. Concurrent 4x adminTransitionRefund -> SUCCEEDED + concurrent webhook on cancelled booking
      await withPayHereEnv(async () => {
        const pair = await createBookingAndIntent({
          travellerToken: traveller.accessToken,
          locationId,
          daysAhead: 31
        });
        const okRes = await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: buildPayHereNotifyForm({
            orderId: pair.intent.providerOrderId,
            paymentId: `PH-REF-RACE-${Date.now()}`,
            payhereAmount: "1000.00",
            payhereCurrency: "LKR",
            statusCode: "2"
          })
        });
        expect(okRes.statusCode).toBe(200);

        const cxlRes = await app.inject({
          method: "POST",
          url: `/api/v1/bookings/${pair.booking.id}/cancel`,
          headers: { authorization: `Bearer ${traveller.accessToken}` },
          payload: { reason: "Concurrent refund transition test" }
        });
        expect(cxlRes.statusCode).toBe(200);
        const refundId = JSON.parse(cxlRes.body).data.refundSummary.refundId as string;

        const [tr1, tr2, tr3, tr4, replayWh] = await Promise.all([
          app.inject({
            method: "POST",
            url: `/api/v1/admin/refunds/${refundId}/transition`,
            headers: { authorization: `Bearer ${superadmin.accessToken}` },
            payload: { targetStatus: "SUCCEEDED", notes: "Batch refund transition" }
          }),
          app.inject({
            method: "POST",
            url: `/api/v1/admin/refunds/${refundId}/transition`,
            headers: { authorization: `Bearer ${superadmin.accessToken}` },
            payload: { targetStatus: "SUCCEEDED", notes: "Batch refund transition" }
          }),
          app.inject({
            method: "POST",
            url: `/api/v1/admin/refunds/${refundId}/transition`,
            headers: { authorization: `Bearer ${superadmin.accessToken}` },
            payload: { targetStatus: "SUCCEEDED", notes: "Batch refund transition" }
          }),
          app.inject({
            method: "POST",
            url: `/api/v1/admin/refunds/${refundId}/transition`,
            headers: { authorization: `Bearer ${superadmin.accessToken}` },
            payload: { targetStatus: "SUCCEEDED", notes: "Batch refund transition" }
          }),
          app.inject({
            method: "POST",
            url: "/api/v1/payments/webhooks/payhere",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            payload: buildPayHereNotifyForm({
              orderId: pair.intent.providerOrderId,
              paymentId: `PH-REF-CB-${Date.now()}`,
              payhereAmount: "1000.00",
              payhereCurrency: "LKR",
              statusCode: "-3"
            })
          })
        ]);

        expect([tr1.statusCode, tr2.statusCode, tr3.statusCode, tr4.statusCode]).toEqual([
          200, 200, 200, 200
        ]);
        expect(replayWh.statusCode).toBe(200);

        const refundTxRows = await migratorPool.query(
          "SELECT provider, transaction_type FROM payment_transactions WHERE booking_id = $1 AND transaction_type = 'REFUND';",
          [pair.booking.id]
        );
        expect(refundTxRows.rows.length).toBe(1);
        expect(refundTxRows.rows[0].provider).toBe("PAYHERE");

        // Cancellation posts 1 REFUND liability reclassification group + concurrent disbursement posts exactly 1 disbursement group = 2 total
        const refundLedgerGroups = await migratorPool.query(
          "SELECT COUNT(DISTINCT transaction_group_id)::int AS groups FROM financial_ledger_entries WHERE booking_id = $1 AND reference_type = 'REFUND';",
          [pair.booking.id]
        );
        expect(refundLedgerGroups.rows[0].groups).toBe(2);

        const disbursementGroups = await migratorPool.query(
          "SELECT COUNT(DISTINCT transaction_group_id)::int AS groups FROM financial_ledger_entries WHERE booking_id = $1 AND reference_type = 'REFUND' AND account_code = '1010';",
          [pair.booking.id]
        );
        expect(disbursementGroups.rows[0].groups).toBe(1);
      });

      // 2. Concurrent 5x booking creation against remaining 2 pool units (1 large bag = 2 capacity units => only 1 booking succeeds)
      const win = futureColomboWindow(33);
      const bookResults = await Promise.all(
        Array.from({ length: 5 }, (_, idx) =>
          app.inject({
            method: "POST",
            url: "/api/v1/bookings",
            headers: { authorization: `Bearer ${traveller.accessToken}` },
            payload: {
              locationId,
              dropOffAt: win.dropOffAt,
              collectionAt: win.collectionAt,
              items: [{ bagCategory: "BAG_LARGE", quantity: 1 }],
              travellerNotes: `Attempt ${idx}`
            }
          })
        )
      );
      const created = bookResults.filter((r) => r.statusCode === 201);
      const conflicts = bookResults.filter((r) => r.statusCode === 409);
      expect(created.length).toBe(1);
      expect(conflicts.length).toBe(4);

      const winnerBookingId = JSON.parse(created[0].body).data.id as string;
      const winIntentRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { bookingId: winnerBookingId }
      });
      expect(winIntentRes.statusCode).toBe(201);
      const winIntentId = JSON.parse(winIntentRes.body).data.id as string;
      await app.inject({
        method: "POST",
        url: `/api/v1/payments/intents/${winIntentId}/sandbox-simulate`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { outcome: "SUCCEEDED" }
      });

      const passRes = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${winnerBookingId}/custody-pass`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { operation: "CHECK_IN" }
      });
      const pin = JSON.parse(passRes.body).data.verificationPin as string;

      // 3. Concurrent 4x check-in calls with the same single-use PIN
      const checkInRaces = await Promise.all(
        Array.from({ length: 4 }, (_, idx) =>
          app.inject({
            method: "POST",
            url: `/api/v1/hosts/custody/${winnerBookingId}/check-in`,
            headers: { authorization: `Bearer ${owner.accessToken}` },
            payload: {
              verificationPin: pin,
              bags: [{ bagTagCode: `RACE-TAG-${idx}`, bagCategory: "BAG_LARGE" }]
            }
          })
        )
      );
      expect(checkInRaces.filter((r) => r.statusCode === 200).length).toBe(1);
      expect(
        checkInRaces.filter((r) => r.statusCode === 401 || r.statusCode === 409).length
      ).toBe(3);

      const taggedCount = await migratorPool.query(
        `SELECT COUNT(*)::int AS cnt
         FROM bag_custody_items bci
         INNER JOIN custody_records cr ON cr.id = bci.custody_record_id
         WHERE cr.booking_id = $1;`,
        [winnerBookingId]
      );
      expect(taggedCount.rows[0].cnt).toBe(1);
    });
  });

  // ==========================================================================
  // 4. B4: Payment Intent Race Closure, DB-Clock Expiry & Idempotency Matrix
  // ==========================================================================
  describe("4. B4: Payment Intent Creation Race & Idempotency Matrix", () => {
    it("commits expired holds against DB NOW() before returning 409 and rejects ineligible booking states", async () => {
      const traveller = await createTestUser("TRAVELLER", "B4 Eligibility Traveller");
      const otherTraveller = await createTestUser("TRAVELLER", "B4 Other Traveller");
      const { owner, locationId } = await createActiveLocation({
        bookingMode: "INSTANT",
        baseRateMinor: 100000
      });

      const win1 = futureColomboWindow(35);
      const bExpRes = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          locationId,
          dropOffAt: win1.dropOffAt,
          collectionAt: win1.collectionAt,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
        }
      });
      const bExp = JSON.parse(bExpRes.body).data as { id: string };

      // Force hold expiry in PostgreSQL, bypassing createPaymentIntent pre-sweep by targeting bookings directly
      await migratorPool.query(
        "UPDATE bookings SET hold_expires_at = NOW() - INTERVAL '5 seconds' WHERE id = $1;",
        [bExp.id]
      );

      const expiredIntentRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { bookingId: bExp.id }
      });
      expect(expiredIntentRes.statusCode).toBe(409);

      // Verify booking is committed as EXPIRED even though HTTP returned 409
      const dbExpired = await migratorPool.query("SELECT status FROM bookings WHERE id = $1;", [
        bExp.id
      ]);
      expect(dbExpired.rows[0].status).toBe("EXPIRED");

      // Other user cannot create payment intent for traveller's booking (403)
      const b2Res = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          locationId,
          dropOffAt: futureColomboWindow(36).dropOffAt,
          collectionAt: futureColomboWindow(36).collectionAt,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
        }
      });
      const b2Id = JSON.parse(b2Res.body).data.id as string;

      const wrongOwnerIntent = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${otherTraveller.accessToken}` },
        payload: { bookingId: b2Id, idempotencyKey: "shared-key-test" }
      });
      expect(wrongOwnerIntent.statusCode).toBe(403);

      // Idempotency matrix on b2Id
      const intentA1 = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { bookingId: b2Id, idempotencyKey: "key-alpha-01" }
      });
      expect(intentA1.statusCode).toBe(201);
      const idA1 = JSON.parse(intentA1.body).data.id as string;

      // Same user + same idempotencyKey returns exact existing active intent
      const intentA2 = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { bookingId: b2Id, idempotencyKey: "key-alpha-01" }
      });
      expect(intentA2.statusCode).toBe(201);
      expect(JSON.parse(intentA2.body).data.id).toBe(idA1);

      // Simulate failure on idA1 -> FAILED
      const failSim = await app.inject({
        method: "POST",
        url: `/api/v1/payments/intents/${idA1}/sandbox-simulate`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { outcome: "FAILED", failureReason: "Insufficient funds" }
      });
      expect(failSim.statusCode).toBe(200);

      // Reusing closed key-alpha-01 must return 409 Conflict
      const reuseClosedKey = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { bookingId: b2Id, idempotencyKey: "key-alpha-01" }
      });
      expect(reuseClosedKey.statusCode).toBe(409);

      // Supplying new key-beta-02 creates a fresh active intent cleanly
      const intentB1 = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { bookingId: b2Id, idempotencyKey: "key-beta-02" }
      });
      expect(intentB1.statusCode).toBe(201);
      const idB1 = JSON.parse(intentB1.body).data.id as string;
      expect(idB1).not.toBe(idA1);

      // Confirm b2Id via sandbox payment; further intent creation rejected (409)
      await app.inject({
        method: "POST",
        url: `/api/v1/payments/intents/${idB1}/sandbox-simulate`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { outcome: "SUCCEEDED" }
      });
      const afterPaidRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { bookingId: b2Id, idempotencyKey: "key-gamma-03" }
      });
      expect(afterPaidRes.statusCode).toBe(409);

      // REJECTED HOST_APPROVAL booking returns 409 on createPaymentIntent
      const { owner: haOwner, locationId: haLocId } = await createActiveLocation({
        bookingMode: "HOST_APPROVAL"
      });
      const haRes = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          locationId: haLocId,
          dropOffAt: futureColomboWindow(37).dropOffAt,
          collectionAt: futureColomboWindow(37).collectionAt,
          items: [{ bagCategory: "BAG_SMALL", quantity: 1 }]
        }
      });
      const haId = JSON.parse(haRes.body).data.id as string;
      await app.inject({
        method: "POST",
        url: `/api/v1/hosts/bookings/${haId}/reject`,
        headers: { authorization: `Bearer ${haOwner.accessToken}` },
        payload: { reason: "Counter full for renovation" }
      });
      const rejectedPay = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { bookingId: haId }
      });
      expect(rejectedPay.statusCode).toBe(409);
      void owner;
    });

    it("eliminates concurrent createPaymentIntent races vs traveller/host cancellation and simultaneous key creation", async () => {
      const traveller = await createTestUser("TRAVELLER", "B4 Concurrency Traveller");
      const { owner, locationId } = await createActiveLocation({ baseRateMinor: 100000 });

      // 1. Intent creation racing traveller cancellation
      const b1 = JSON.parse(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/bookings",
            headers: { authorization: `Bearer ${traveller.accessToken}` },
            payload: {
              locationId,
              dropOffAt: futureColomboWindow(38).dropOffAt,
              collectionAt: futureColomboWindow(38).collectionAt,
              items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
            }
          })
        ).body
      ).data as { id: string };

      const [iRace1, cRace1] = await Promise.all([
        app.inject({
          method: "POST",
          url: "/api/v1/payments/intents",
          headers: { authorization: `Bearer ${traveller.accessToken}` },
          payload: { bookingId: b1.id, idempotencyKey: "race-cancel-1" }
        }),
        app.inject({
          method: "POST",
          url: `/api/v1/bookings/${b1.id}/cancel`,
          headers: { authorization: `Bearer ${traveller.accessToken}` },
          payload: { reason: "Traveller cancelled during checkout init" }
        })
      ]);
      expect(cRace1.statusCode).toBe(200);
      expect([201, 409]).toContain(iRace1.statusCode);

      const activeOnCancelled1 = await migratorPool.query(
        "SELECT COUNT(*)::int AS cnt FROM payment_intents WHERE booking_id = $1 AND status IN ('INITIATED', 'PENDING_GATEWAY');",
        [b1.id]
      );
      expect(activeOnCancelled1.rows[0].cnt).toBe(0);

      // 2. Intent creation racing host cancellation
      const b2 = JSON.parse(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/bookings",
            headers: { authorization: `Bearer ${traveller.accessToken}` },
            payload: {
              locationId,
              dropOffAt: futureColomboWindow(39).dropOffAt,
              collectionAt: futureColomboWindow(39).collectionAt,
              items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
            }
          })
        ).body
      ).data as { id: string };

      const [iRace2, hRace2] = await Promise.all([
        app.inject({
          method: "POST",
          url: "/api/v1/payments/intents",
          headers: { authorization: `Bearer ${traveller.accessToken}` },
          payload: { bookingId: b2.id, idempotencyKey: "race-host-cancel-2" }
        }),
        app.inject({
          method: "POST",
          url: `/api/v1/hosts/bookings/${b2.id}/cancel`,
          headers: { authorization: `Bearer ${owner.accessToken}` },
          payload: { reason: "Host cancelled simultaneously" }
        })
      ]);
      expect(hRace2.statusCode).toBe(200);
      expect([201, 409]).toContain(iRace2.statusCode);

      const activeOnCancelled2 = await migratorPool.query(
        "SELECT COUNT(*)::int AS cnt FROM payment_intents WHERE booking_id = $1 AND status IN ('INITIATED', 'PENDING_GATEWAY');",
        [b2.id]
      );
      expect(activeOnCancelled2.rows[0].cnt).toBe(0);

      // 3. Two simultaneous requests with SAME idempotencyKey + two with DIFFERENT idempotencyKeys
      const b3 = JSON.parse(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/bookings",
            headers: { authorization: `Bearer ${traveller.accessToken}` },
            payload: {
              locationId,
              dropOffAt: futureColomboWindow(40).dropOffAt,
              collectionAt: futureColomboWindow(40).collectionAt,
              items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
            }
          })
        ).body
      ).data as { id: string };

      const [sameA, sameB] = await Promise.all([
        app.inject({
          method: "POST",
          url: "/api/v1/payments/intents",
          headers: { authorization: `Bearer ${traveller.accessToken}` },
          payload: { bookingId: b3.id, idempotencyKey: "same-race-key" }
        }),
        app.inject({
          method: "POST",
          url: "/api/v1/payments/intents",
          headers: { authorization: `Bearer ${traveller.accessToken}` },
          payload: { bookingId: b3.id, idempotencyKey: "same-race-key" }
        })
      ]);
      expect(sameA.statusCode).toBe(201);
      expect(sameB.statusCode).toBe(201);
      expect(JSON.parse(sameA.body).data.id).toBe(JSON.parse(sameB.body).data.id);

      const [diffA, diffB] = await Promise.all([
        app.inject({
          method: "POST",
          url: "/api/v1/payments/intents",
          headers: { authorization: `Bearer ${traveller.accessToken}` },
          payload: { bookingId: b3.id, idempotencyKey: "diff-key-1" }
        }),
        app.inject({
          method: "POST",
          url: "/api/v1/payments/intents",
          headers: { authorization: `Bearer ${traveller.accessToken}` },
          payload: { bookingId: b3.id, idempotencyKey: "diff-key-2" }
        })
      ]);
      expect(diffA.statusCode).toBe(201);
      expect(diffB.statusCode).toBe(201);

      const activeCountB3 = await migratorPool.query(
        "SELECT COUNT(*)::int AS cnt FROM payment_intents WHERE booking_id = $1 AND status IN ('INITIATED', 'PENDING_GATEWAY');",
        [b3.id]
      );
      expect(activeCountB3.rows[0].cnt).toBe(1);

      // 4. Intent creation racing automatic hold expiry sweep
      const b4 = JSON.parse(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/bookings",
            headers: { authorization: `Bearer ${traveller.accessToken}` },
            payload: {
              locationId,
              dropOffAt: futureColomboWindow(41).dropOffAt,
              collectionAt: futureColomboWindow(41).collectionAt,
              items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
            }
          })
        ).body
      ).data as { id: string };
      await migratorPool.query(
        "UPDATE bookings SET hold_expires_at = NOW() - INTERVAL '1 second' WHERE id = $1;",
        [b4.id]
      );
      const [expIntentRes] = await Promise.all([
        app.inject({
          method: "POST",
          url: "/api/v1/payments/intents",
          headers: { authorization: `Bearer ${traveller.accessToken}` },
          payload: { bookingId: b4.id }
        }),
        quotationService.sweepExpiredHolds()
      ]);
      expect(expIntentRes.statusCode).toBe(409);
      const activeOnExpired = await migratorPool.query(
        "SELECT COUNT(*)::int AS cnt FROM payment_intents WHERE booking_id = $1 AND status IN ('INITIATED', 'PENDING_GATEWAY');",
        [b4.id]
      );
      expect(activeOnExpired.rows[0].cnt).toBe(0);
    });
  });

  // ==========================================================================
  // 5. B5: Failed Refund Recovery & Global Non-Escrow Ledger Balance Proof
  // ==========================================================================
  describe("5. B5: Failed Refund Recovery, Provider Attribution & Global Ledger Proof", () => {
    it("supports refund failure -> manual review -> authorization -> disbursement with accurate provider attribution and globally balanced ledger", async () => {
      const traveller = await createTestUser("TRAVELLER", "RefundRecovery Traveller");
      const superadmin = await createTestUser("SUPERADMIN", "RefundRecovery Admin");
      const { locationId } = await createActiveLocation({ baseRateMinor: 100000 });

      await withPayHereEnv(async () => {
        const pair = await createBookingAndIntent({
          travellerToken: traveller.accessToken,
          locationId,
          daysAhead: 45
        });

        await app.inject({
          method: "POST",
          url: "/api/v1/payments/webhooks/payhere",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: buildPayHereNotifyForm({
            orderId: pair.intent.providerOrderId,
            paymentId: `PH-REC-${Date.now()}`,
            payhereAmount: "1000.00",
            payhereCurrency: "LKR",
            statusCode: "2"
          })
        });

        const cxl = await app.inject({
          method: "POST",
          url: `/api/v1/bookings/${pair.booking.id}/cancel`,
          headers: { authorization: `Bearer ${traveller.accessToken}` },
          payload: { reason: "Refund failure recovery test" }
        });
        expect(cxl.statusCode).toBe(200);
        const refundId = JSON.parse(cxl.body).data.refundSummary.refundId as string;

        // AUTHORIZED -> FAILED -> MANUAL_REVIEW_REQUIRED -> AUTHORIZED -> SUCCEEDED
        const toFailed = await app.inject({
          method: "POST",
          url: `/api/v1/admin/refunds/${refundId}/transition`,
          headers: { authorization: `Bearer ${superadmin.accessToken}` },
          payload: { targetStatus: "FAILED", notes: "Card expired at bank" }
        });
        expect(toFailed.statusCode).toBe(200);

        const toReview = await app.inject({
          method: "POST",
          url: `/api/v1/admin/refunds/${refundId}/transition`,
          headers: { authorization: `Bearer ${superadmin.accessToken}` },
          payload: { targetStatus: "MANUAL_REVIEW_REQUIRED", notes: "Verify alternate bank account" }
        });
        expect(toReview.statusCode).toBe(200);

        const reAuth = await app.inject({
          method: "POST",
          url: `/api/v1/admin/refunds/${refundId}/transition`,
          headers: { authorization: `Bearer ${superadmin.accessToken}` },
          payload: { targetStatus: "AUTHORIZED", notes: "Re-authorized after bank confirmation" }
        });
        expect(reAuth.statusCode).toBe(200);

        const manualRefId = `PH-MANUAL-REF-${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const finalOk = await app.inject({
          method: "POST",
          url: `/api/v1/admin/refunds/${refundId}/transition`,
          headers: { authorization: `Bearer ${superadmin.accessToken}` },
          payload: {
            targetStatus: "SUCCEEDED",
            notes: "Settled manually via bank transfer",
            providerRefundId: manualRefId
          }
        });
        expect(finalOk.statusCode).toBe(200);
        expect(JSON.parse(finalOk.body).data.status).toBe("SUCCEEDED");

        // Idempotent retry on SUCCEEDED succeeds cleanly without double ledger posting
        const idempRetry = await app.inject({
          method: "POST",
          url: `/api/v1/admin/refunds/${refundId}/transition`,
          headers: { authorization: `Bearer ${superadmin.accessToken}` },
          payload: { targetStatus: "SUCCEEDED", notes: "Duplicate click" }
        });
        expect(idempRetry.statusCode).toBe(200);

        // Verify actual PAYHERE provider attribution on REFUND payment_transactions
        const refTx = await migratorPool.query(
          "SELECT provider, provider_transaction_id FROM payment_transactions WHERE booking_id = $1 AND transaction_type = 'REFUND';",
          [pair.booking.id]
        );
        expect(refTx.rows.length).toBe(1);
        expect(refTx.rows[0].provider).toBe("PAYHERE");
        expect(refTx.rows[0].provider_transaction_id).toBe(manualRefId);
      });

      // Global double-entry invariant check across ALL ledger groups in PostgreSQL
      const unbalanced = await migratorPool.query(
        `SELECT transaction_group_id,
                SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_minor ELSE 0 END)::bigint AS debits,
                SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_minor ELSE 0 END)::bigint AS credits
         FROM financial_ledger_entries
         GROUP BY transaction_group_id
         HAVING SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_minor ELSE 0 END)
             <> SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_minor ELSE 0 END)
             OR SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_minor ELSE 0 END) <= 0;`
      );
      expect(unbalanced.rows.length).toBe(0);
    });

    it("5.3 ledgerService enforces PG_INT_MAX bounds, refund <= paid guards, and custom snapshotted commissionRateBps", async () => {
      const dummyId = "00000000-0000-4000-8000-000000000501";
      const insertedPayables: Array<Record<string, unknown>> = [];
      const insertedLedgerBatches: Array<Array<Record<string, unknown>>> = [];

      const stubTx = {
        insert: () => ({
          values: (payload: Record<string, unknown> | Array<Record<string, unknown>>) => {
            if (Array.isArray(payload)) {
              insertedLedgerBatches.push(payload);
              return Promise.resolve([]);
            }
            insertedPayables.push(payload);
            return {
              onConflictDoNothing: () => ({
                returning: async () => [{ id: "00000000-0000-4000-8000-000000000777" }]
              })
            };
          }
        })
      };

      const overflowLines: JournalPostingLine[] = [
        {
          entryType: "DEBIT",
          accountCode: "1010",
          accountName: "Test Debit",
          amountMinor: 2_147_483_648,
          currency: "LKR",
          referenceType: "BOOKING",
          referenceId: dummyId,
          bookingId: dummyId,
          description: "Overflow test"
        },
        {
          entryType: "CREDIT",
          accountCode: "2010",
          accountName: "Test Credit",
          amountMinor: 2_147_483_648,
          currency: "LKR",
          referenceType: "BOOKING",
          referenceId: dummyId,
          bookingId: dummyId,
          description: "Overflow test"
        }
      ];
      await expect(ledgerService.postJournalGroup(stubTx, overflowLines)).rejects.toThrow(/32-bit integer/);

      const unbalancedLines: JournalPostingLine[] = [
        {
          entryType: "DEBIT",
          accountCode: "1010",
          accountName: "Debit",
          amountMinor: 10_000,
          currency: "LKR",
          referenceType: "BOOKING",
          referenceId: dummyId,
          bookingId: dummyId,
          description: "Unbalanced debit"
        },
        {
          entryType: "CREDIT",
          accountCode: "2010",
          accountName: "Credit",
          amountMinor: 9_000,
          currency: "LKR",
          referenceType: "BOOKING",
          referenceId: dummyId,
          bookingId: dummyId,
          description: "Unbalanced credit"
        }
      ];
      await expect(ledgerService.postJournalGroup(stubTx, unbalancedLines)).rejects.toThrow(/Unbalanced double-entry/);

      await expect(
        ledgerService.recordCancellationSettlement(stubTx, {
          bookingId: dummyId,
          businessId: dummyId,
          refundId: dummyId,
          paidAmountMinor: 50_000,
          refundAmountMinor: 60_000,
          commissionRateBps: 1500,
          currency: "LKR",
          referenceCode: "BKG-OVER-REFUND"
        })
      ).rejects.toThrow(/Invalid cancellation settlement amounts/);

      await expect(
        ledgerService.recordCancellationSettlement(stubTx, {
          bookingId: dummyId,
          businessId: dummyId,
          refundId: dummyId,
          paidAmountMinor: -100,
          refundAmountMinor: 0,
          commissionRateBps: 1500,
          currency: "LKR",
          referenceCode: "BKG-NEG"
        })
      ).rejects.toThrow(/Invalid cancellation settlement amounts/);

      // Custom 20% commissionRateBps (2000 bps) on retained 50,000 minor = 10,000 commission + 40,000 host net
      await ledgerService.recordCancellationSettlement(stubTx, {
        bookingId: dummyId,
        businessId: dummyId,
        refundId: dummyId,
        paidAmountMinor: 100_000,
        refundAmountMinor: 50_000,
        commissionRateBps: 2000,
        currency: "LKR",
        referenceCode: "BKG-CUSTOM-BPS"
      });

      expect(insertedPayables.length).toBe(1);
      expect(insertedPayables[0]?.grossSubtotalMinor).toBe(50_000);
      expect(insertedPayables[0]?.commissionMinor).toBe(10_000);
      expect(insertedPayables[0]?.netPayableMinor).toBe(40_000);

      expect(insertedLedgerBatches.length).toBe(1);
      const postedLines = insertedLedgerBatches[0] ?? [];
      const sumDebit = postedLines
        .filter((l) => l.entryType === "DEBIT")
        .reduce((acc, l) => acc + Number(l.amountMinor), 0);
      const sumCredit = postedLines
        .filter((l) => l.entryType === "CREDIT")
        .reduce((acc, l) => acc + Number(l.amountMinor), 0);
      expect(sumDebit).toBe(100_000);
      expect(sumCredit).toBe(100_000);
    });
  });
});
