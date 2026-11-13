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
import { SandboxSignedGatewayAdapter } from "../src/modules/payments/payment-gateway.port.js";

const { Pool } = pg;

describe("Phase B: Booking, Non-Escrow Settlement Ledger & Custody Engine", () => {
  let app: FastifyInstance;
  let migratorPool: pg.Pool;
  let runtimePool: pg.Pool;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    migratorPool = new Pool({
      connectionString: env.MIGRATION_DATABASE_URL,
      max: 3
    });
    runtimePool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 3
    });

    await migratorPool.query(
      "UPDATE storage_locations SET status = 'DISABLED' WHERE name = 'Colombo Fort Counter #4';"
    );
  });

  beforeEach(async () => {
    await rateLimitService.clearAll();
  });

  afterAll(async () => {
    await migratorPool
      .query(
        "UPDATE storage_locations SET status = 'DISABLED' WHERE name = 'Colombo Fort Counter #4';"
      )
      .catch(() => {});
    await app.close();
    await migratorPool.end();
    await runtimePool.end();
  });

  async function createTestUser(
    roleCode: "TRAVELLER" | "HOST_OWNER" | "HOST_STAFF" | "SUPERADMIN" | "SUPPORT" = "TRAVELLER",
    displayName = "Phase B User"
  ) {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const email = `phaseb_${unique}@example.com`;
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

  /**
   * Creates an ACTIVE host business, ACTIVE storage location, 7-day 08:00-22:00 opening hours,
   * storage zone, capacity pool, and active LKR pricing policy.
   */
  async function createActiveStorageLocation(options?: {
    hostOwner?: { userId: string; accessToken: string };
    bookingMode?: "INSTANT" | "HOST_APPROVAL";
    acceptsOversized?: boolean;
    sharedPoolUnits?: number;
    pricingUnit?: "CALENDAR_DAY" | "24_HOUR_BLOCK";
    baseRateMinor?: number;
  }) {
    const owner = options?.hostOwner ?? (await createTestUser("HOST_OWNER", "Colombo Host"));

    const bizRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/businesses",
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        legalBusinessName: `Kandy Vault Pvt Ltd ${Date.now()}`,
        tradeName: "Kandy Station Luggage Hub",
        entityType: "RETAIL_SHOP",
        contactEmail: `host_${Date.now()}@kandyvault.lk`,
        contactPhone: "+94771234567",
        city: "Kandy"
      }
    });
    expect(bizRes.statusCode).toBe(201);
    const businessId = JSON.parse(bizRes.body).data.id as string;

    await migratorPool.query(
      "UPDATE host_businesses SET status = 'ACTIVE' WHERE id = $1;",
      [businessId]
    );

    const locRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/locations",
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        businessId,
        name: "Kandy Railway Counter #4",
        description: "Inside main arcade beside Platform 1 entrance",
        addressLine1: "42 Dalada Veediya, Kandy",
        addressLine2: "Ground Floor Unit B",
        city: "Kandy",
        postalCode: "20000",
        latitude: 7.2906,
        longitude: 80.6337,
        timezone: "Asia/Colombo",
        bookingMode: options?.bookingMode ?? "INSTANT",
        acceptsOversized: options?.acceptsOversized ?? true
      }
    });
    expect(locRes.statusCode).toBe(201);
    const locationId = JSON.parse(locRes.body).data.id as string;

    // Configure 7-day opening hours (ISO 1..7) 08:00 - 22:00 Asia/Colombo
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

    // Create storage zone
    const zoneRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/locations/${locationId}/zones`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        name: "Vault Rack A",
        zoneType: "RACK"
      }
    });
    expect(zoneRes.statusCode).toBe(201);
    const zoneId = JSON.parse(zoneRes.body).data.id as string;

    // Update the default shared capacity pool created by createLocation so totalUnits is exact
    const listPoolsRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/locations/${locationId}/capacity-pools`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(listPoolsRes.statusCode).toBe(200);
    const existingPools = JSON.parse(listPoolsRes.body).data.pools as Array<{ id: string }>;
    expect(existingPools.length).toBeGreaterThanOrEqual(1);

    const capRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/hosts/capacity-pools/${existingPools[0].id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        zoneId,
        totalUnits: options?.sharedPoolUnits ?? 20,
        isActive: true
      }
    });
    expect(capRes.statusCode).toBe(200);

    // Configure LKR pricing policy
    const baseRateMinor = options?.baseRateMinor ?? 100000; // LKR 1,000.00
    const priceRes = await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/pricing`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        currency: "LKR",
        pricingUnit: options?.pricingUnit ?? "CALENDAR_DAY",
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

    await migratorPool.query(
      "UPDATE storage_locations SET status = 'ACTIVE' WHERE id = $1;",
      [locationId]
    );

    return { owner, businessId, locationId, zoneId };
  }

  /**
   * Helper returning future UTC ISO timestamps falling inside 10:00 - 17:00 Asia/Colombo (+05:30).
   * 10:00 Asia/Colombo = 04:30 UTC; 17:00 Asia/Colombo = 11:30 UTC.
   */
  function futureColomboWindow(daysAhead = 5) {
    const base = new Date();
    base.setUTCDate(base.getUTCDate() + daysAhead);
    const yyyy = base.getUTCFullYear();
    const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(base.getUTCDate()).padStart(2, "0");
    return {
      dateStr: `${yyyy}-${mm}-${dd}`,
      dropOffAt: `${yyyy}-${mm}-${dd}T04:30:00.000Z`,
      collectionAt: `${yyyy}-${mm}-${dd}T11:30:00.000Z`
    };
  }

  // ==========================================================================
  // 1. Schema, Clean/Upgrade Migrations & Append-Only Database Immutability
  // ==========================================================================
  describe("1. Database Schema, Migrations & Append-Only Audit Immutability", () => {
    it("verifies all 15 Phase B tables exist in public schema (43 total marketplace tables)", async () => {
      const phaseBTables = [
        "bookings",
        "booking_items",
        "booking_status_history",
        "capacity_reservations",
        "booking_pricing_snapshots",
        "payment_intents",
        "payment_transactions",
        "payment_webhook_events",
        "refund_records",
        "financial_ledger_entries",
        "host_payables",
        "custody_records",
        "custody_tokens",
        "bag_custody_items",
        "custody_events"
      ];

      const res = await runtimePool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = ANY($1::text[]);`,
        [phaseBTables]
      );
      expect(Number(res.rows[0].count)).toBe(15);
    });

    it("rejects production configuration using sandbox payment provider or PayHere sandbox mode", () => {
      const baseProdEnv = {
        NODE_ENV: "production",
        STORAGE_PROVIDER: "r2",
        R2_ACCOUNT_ID: "acc_123",
        R2_ACCESS_KEY_ID: "key_123",
        R2_SECRET_ACCESS_KEY: "secret_123",
        R2_BUCKET_NAME: "prod-bucket",
        DATABASE_URL: "postgresql://luggage_user:strong_prod_pw@db.example.com:5432/luggage_prod",
        DATABASE_SSL: "true",
        DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
        JWT_SECRET: "prod_jwt_secret_minimum_32_characters_long_001!",
        COOKIE_SECRET: "prod_cookie_secret_minimum_32_characters_long_02!",
        RATE_LIMIT_HASH_SECRET: "prod_rate_limit_secret_minimum_32_chars_long_03!",
        PAYOUT_ENCRYPTION_KEY: "prod_payout_encryption_key_32_chars_long_0004!",
        DB_IDENTITY_SECRET: "prod_db_identity_secret_key_32_chars_long_0005!",
        PAYMENT_WEBHOOK_SECRET: "prod_payment_webhook_secret_32_chars_long_0006!",
        EMAIL_PROVIDER: "zoho",
        ZOHO_SMTP_HOST: "smtp.zoho.eu",
        ZOHO_SMTP_PORT: "587",
        ZOHO_SMTP_USER: "no-reply@luggagestorage.lk",
        ZOHO_SMTP_PASSWORD: "ProdZohoPassword123!"
      };

      expect(() =>
        loadConfig({
          ...baseProdEnv,
          PAYMENT_PROVIDER: "sandbox"
        })
      ).toThrow(/PAYMENT_PROVIDER cannot be 'sandbox' in production/i);

      expect(() =>
        loadConfig({
          ...baseProdEnv,
          PAYMENT_PROVIDER: "payhere",
          PAYHERE_MERCHANT_ID: "1229999",
          PAYHERE_MERCHANT_SECRET: "live_merchant_secret_1234567890",
          PAYHERE_SANDBOX_MODE: "true"
        })
      ).toThrow(/PAYHERE_SANDBOX_MODE must be false in production/i);
    });

    it("executes clean install (0000->0012) and upgrade (0011->0012) migrations on ephemeral PostgreSQL databases", async () => {
      const parsed = new URL(env.MIGRATION_DATABASE_URL!);
      const superUrl = new URL(env.MIGRATION_DATABASE_URL!);
      superUrl.username = "postgres";
      superUrl.password = "postgres";
      superUrl.pathname = "/postgres";

      const adminPool = new Pool({ connectionString: superUrl.toString(), max: 2 });
      const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const cleanDb = `test_phaseb_clean_${suffix}`;
      const upgradeDb = `test_phaseb_upg_${suffix}`;

      async function prepareTempDb(dbName: string) {
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
      }

      try {
        await prepareTempDb(cleanDb);
        await prepareTempDb(upgradeDb);

        const cleanMigUrl = new URL(parsed.toString());
        cleanMigUrl.pathname = `/${cleanDb}`;
        const appliedClean = await runMigrations(cleanMigUrl.toString());
        expect(appliedClean).toBeGreaterThanOrEqual(13);

        // Prepare upgrade DB through 0011 (first 12 migrations: 0000..0011), then upgrade -> 0012
        const upgMigUrl = new URL(parsed.toString());
        upgMigUrl.pathname = `/${upgradeDb}`;
        const upgPool = new Pool({ connectionString: upgMigUrl.toString(), max: 1 });
        try {
          const currentDir = path.dirname(fileURLToPath(import.meta.url));
          const migrationsFolder = path.resolve(
            currentDir,
            "../src/infrastructure/database/migrations"
          );
          const allMigrations = readMigrationFiles({ migrationsFolder });
          const through0011 = allMigrations.slice(0, 12); // 0000..0011

          await upgPool.query(`
            CREATE TABLE IF NOT EXISTS public.__drizzle_migrations (
              id SERIAL PRIMARY KEY,
              hash text NOT NULL,
              created_at bigint
            );
          `);

          for (const m of through0011) {
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
        } finally {
          await upgPool.end();
        }

        const upgradedCount = await runMigrations(upgMigUrl.toString());
        expect(upgradedCount).toBe(1);
      } finally {
        await adminPool.query(`DROP DATABASE IF EXISTS ${cleanDb} WITH (FORCE);`).catch(() => {});
        await adminPool.query(`DROP DATABASE IF EXISTS ${upgradeDb} WITH (FORCE);`).catch(() => {});
        await adminPool.end();
      }
    }, 60000);
  });

  // ==========================================================================
  // 2. Quotation, Operating Hours, Holiday Closures & Pool Concurrency
  // ==========================================================================
  describe("2. Quotation, Operating Hours, Closures & Concurrent Pool Reservation", () => {
    it("calculates exact LKR minor-unit quotes and enforces operating hours, holiday closures, and oversized restrictions", async () => {
      const { owner, locationId } = await createActiveStorageLocation({
        acceptsOversized: false,
        sharedPoolUnits: 10,
        pricingUnit: "CALENDAR_DAY",
        baseRateMinor: 100000
      });

      const win = futureColomboWindow(6);

      // 1. Valid quote: 2 medium bags (2 * 100000 = 200000) + 1 small bag (70000) = 270000 LKR cents
      const quoteRes = await app.inject({
        method: "POST",
        url: "/api/v1/bookings/quote",
        payload: {
          locationId,
          dropOffAt: win.dropOffAt,
          collectionAt: win.collectionAt,
          items: [
            { bagCategory: "BAG_MEDIUM", quantity: 2 },
            { bagCategory: "BAG_SMALL", quantity: 1 }
          ]
        }
      });
      expect(quoteRes.statusCode).toBe(200);
      const quote = JSON.parse(quoteRes.body).data;
      expect(quote.available).toBe(true);
      expect(quote.currency).toBe("LKR");
      expect(quote.totalBags).toBe(3);
      expect(quote.requestedCapacityUnits).toBe(3); // 2*1 (medium) + 1*1 (small)
      expect(quote.storageSubtotalMinor).toBe(270000);
      expect(quote.commissionRateBps).toBe(1500);
      expect(quote.platformCommissionMinor).toBe(40500); // 15%
      expect(quote.hostPayableMinor).toBe(229500); // 85%
      expect(quote.platformCommissionMinor + quote.hostPayableMinor).toBe(quote.storageSubtotalMinor);

      // 2. Oversized bag rejected when acceptsOversized = false
      const oversizedQuote = await app.inject({
        method: "POST",
        url: "/api/v1/bookings/quote",
        payload: {
          locationId,
          dropOffAt: win.dropOffAt,
          collectionAt: win.collectionAt,
          items: [{ bagCategory: "BAG_OVERSIZED", quantity: 1 }]
        }
      });
      expect(oversizedQuote.statusCode).toBe(200);
      expect(JSON.parse(oversizedQuote.body).data.available).toBe(false);
      expect(JSON.parse(oversizedQuote.body).data.unavailabilityReason).toMatch(/oversized/i);

      // 3. Outside operating hours (06:00 Asia/Colombo = 00:30 UTC, before 08:00 open)
      const closedHoursQuote = await app.inject({
        method: "POST",
        url: "/api/v1/bookings/quote",
        payload: {
          locationId,
          dropOffAt: `${win.dateStr}T00:30:00.000Z`,
          collectionAt: win.collectionAt,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
        }
      });
      expect(closedHoursQuote.statusCode).toBe(200);
      expect(JSON.parse(closedHoursQuote.body).data.available).toBe(false);

      // 4. Holiday closure exception blocks booking creation with 409 Conflict
      const holidayWin = futureColomboWindow(9);
      const excRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/locations/${locationId}/exceptions`,
        headers: { authorization: `Bearer ${owner.accessToken}` },
        payload: {
          exceptionDate: holidayWin.dateStr,
          exceptionType: "CLOSURE",
          reason: "Poya Day Closure"
        }
      });
      expect(excRes.statusCode).toBe(201);

      const traveller = await createTestUser("TRAVELLER", "Holiday Traveller");
      const blockedBooking = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          locationId,
          dropOffAt: holidayWin.dropOffAt,
          collectionAt: holidayWin.collectionAt,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
        }
      });
      expect(blockedBooking.statusCode).toBe(409);

      // 5. Public availability search endpoint returns quote
      const searchRes = await app.inject({
        method: "GET",
        url: `/api/v1/availability/search?locationId=${locationId}&dropOffAt=${encodeURIComponent(
          win.dropOffAt
        )}&collectionAt=${encodeURIComponent(win.collectionAt)}&mediumBags=1`
      });
      expect(searchRes.statusCode).toBe(200);
      expect(JSON.parse(searchRes.body).data.quotes.length).toBe(1);
    });

    it("prevents overbooking under simultaneous concurrent requests and reclaims capacity when holds expire", async () => {
      // Finite pool of 3 units; 1 BAG_MEDIUM = 1 unit -> max 3 overlapping bookings
      const { locationId } = await createActiveStorageLocation({
        sharedPoolUnits: 3,
        bookingMode: "INSTANT"
      });
      const win = futureColomboWindow(7);

      const travellers = await Promise.all(
        Array.from({ length: 6 }, (_, idx) =>
          createTestUser("TRAVELLER", `Concurrent Traveller ${idx + 1}`)
        )
      );

      // Fire 6 simultaneous booking requests against a 3-slot pool
      const responses = await Promise.all(
        travellers.map((t, idx) =>
          app.inject({
            method: "POST",
            url: "/api/v1/bookings",
            headers: { authorization: `Bearer ${t.accessToken}` },
            payload: {
              locationId,
              dropOffAt: win.dropOffAt,
              collectionAt: win.collectionAt,
              items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }],
              idempotencyKey: `conc-key-${idx}`
            }
          })
        )
      );

      const succeeded = responses.filter((r) => r.statusCode === 201);
      const conflicts = responses.filter((r) => r.statusCode === 409);
      expect(succeeded.length).toBe(3);
      expect(conflicts.length).toBe(3);

      // Idempotent replay of a succeeded booking returns same booking ID without extra reservation
      const firstSuccessBody = JSON.parse(succeeded[0].body).data;
      const winningTravellerIdx = responses.findIndex((r) => r.statusCode === 201);
      const replayRes = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { authorization: `Bearer ${travellers[winningTravellerIdx].accessToken}` },
        payload: {
          locationId,
          dropOffAt: win.dropOffAt,
          collectionAt: win.collectionAt,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }],
          idempotencyKey: `conc-key-${winningTravellerIdx}`
        }
      });
      expect(replayRes.statusCode).toBe(201);
      expect(JSON.parse(replayRes.body).data.id).toBe(firstSuccessBody.id);

      // Expire one hold in DB -> capacity is atomically reclaimed on next booking attempt
      await migratorPool.query(
        `UPDATE bookings SET hold_expires_at = NOW() - INTERVAL '2 minutes' WHERE id = $1;`,
        [firstSuccessBody.id]
      );
      await migratorPool.query(
        `UPDATE capacity_reservations SET expires_at = NOW() - INTERVAL '2 minutes' WHERE booking_id = $1;`,
        [firstSuccessBody.id]
      );

      const losingTravellerIdx = responses.findIndex((r) => r.statusCode === 409);
      const reclaimedRes = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { authorization: `Bearer ${travellers[losingTravellerIdx].accessToken}` },
        payload: {
          locationId,
          dropOffAt: win.dropOffAt,
          collectionAt: win.collectionAt,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
        }
      });
      expect(reclaimedRes.statusCode).toBe(201);

      // Verify first booking transitioned to EXPIRED
      const expiredCheck = await app.inject({
        method: "GET",
        url: `/api/v1/bookings/${firstSuccessBody.id}`,
        headers: { authorization: `Bearer ${travellers[winningTravellerIdx].accessToken}` }
      });
      expect(JSON.parse(expiredCheck.body).data.status).toBe("EXPIRED");
    });

    it("enforces HOST_APPROVAL workflow (accept -> PENDING_PAYMENT, reject -> REJECTED) and pricing snapshot immutability", async () => {
      const { owner, locationId } = await createActiveStorageLocation({
        bookingMode: "HOST_APPROVAL",
        sharedPoolUnits: 4,
        baseRateMinor: 100000
      });
      const traveller = await createTestUser("TRAVELLER", "Approval Traveller");
      const win = futureColomboWindow(8);

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          locationId,
          dropOffAt: win.dropOffAt,
          collectionAt: win.collectionAt,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
        }
      });
      expect(createRes.statusCode).toBe(201);
      const booking = JSON.parse(createRes.body).data;
      expect(booking.status).toBe("PENDING_HOST_APPROVAL");
      expect(booking.totalAmountMinor).toBe(100000);

      // Payment intent before host approval must fail with 409
      const prematurePay = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { bookingId: booking.id }
      });
      expect(prematurePay.statusCode).toBe(409);

      // Host doubles location pricing -> existing booking's snapshot MUST remain immutable at 100000
      const updatePriceRes = await app.inject({
        method: "PUT",
        url: `/api/v1/hosts/locations/${locationId}/pricing`,
        headers: { authorization: `Bearer ${owner.accessToken}` },
        payload: {
          currency: "LKR",
          pricingUnit: "CALENDAR_DAY",
          baseRateMinor: 250000,
          tierRates: [
            { bagCategory: "BAG_MEDIUM", rateMinor: 250000, categoryMultiplierBps: 10000 }
          ]
        }
      });
      expect(updatePriceRes.statusCode).toBe(200);

      // Host accepts booking -> transitions to PENDING_PAYMENT with original 100000 snapshot
      const acceptRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/bookings/${booking.id}/accept`,
        headers: { authorization: `Bearer ${owner.accessToken}` },
        payload: { reason: "Ready to welcome traveller" }
      });
      expect(acceptRes.statusCode).toBe(200);
      const accepted = JSON.parse(acceptRes.body).data;
      expect(accepted.status).toBe("PENDING_PAYMENT");
      expect(accepted.pricingSnapshot.totalAmountMinor).toBe(100000);

      // Create a second HOST_APPROVAL booking and reject it -> capacity released immediately
      const secondRes = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          locationId,
          dropOffAt: win.dropOffAt,
          collectionAt: win.collectionAt,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
        }
      });
      expect(secondRes.statusCode).toBe(201);
      const secondId = JSON.parse(secondRes.body).data.id;

      const rejectRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/bookings/${secondId}/reject`,
        headers: { authorization: `Bearer ${owner.accessToken}` },
        payload: { reason: "Staff shift unavailable" }
      });
      expect(rejectRes.statusCode).toBe(200);
      expect(JSON.parse(rejectRes.body).data.status).toBe("REJECTED");

      // Direct SQL mutation on append-only booking_pricing_snapshots & booking_status_history MUST fail
      await expect(
        runtimePool.query(
          "UPDATE booking_pricing_snapshots SET total_amount_minor = 999 WHERE booking_id = $1;",
          [booking.id]
        )
      ).rejects.toThrow();

      await expect(
        runtimePool.query(
          "DELETE FROM booking_status_history WHERE booking_id = $1;",
          [booking.id]
        )
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // 3. Payment Intents, Signed Webhooks, Address Unlocking & Late Webhooks
  // ==========================================================================
  describe("3. Payment Verification, Replay Deduplication, OQ-012 Privacy & Late Webhooks", () => {
    it("rejects unsigned/tampered/wrong-amount webhooks, unlocks exact address only post-payment, and deduplicates replays", async () => {
      const { locationId } = await createActiveStorageLocation({
        bookingMode: "INSTANT",
        baseRateMinor: 120000
      });
      const traveller = await createTestUser("TRAVELLER", "Paying Traveller");
      const otherTraveller = await createTestUser("TRAVELLER", "Stranger Traveller");
      const win = futureColomboWindow(5);

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          locationId,
          dropOffAt: win.dropOffAt,
          collectionAt: win.collectionAt,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
        }
      });
      expect(createRes.statusCode).toBe(201);
      const createdBooking = JSON.parse(createRes.body).data;

      // OQ-012: Before payment confirmation, exact street address & exact coordinates MUST be null
      expect(createdBooking.location.addressDisclosed).toBe(false);
      expect(createdBooking.location.addressLine1).toBeNull();
      expect(createdBooking.location.exactLatitude).toBeNull();
      expect(createdBooking.location.exactLongitude).toBeNull();

      // Create payment intent (idempotent)
      const intentRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { bookingId: createdBooking.id, idempotencyKey: "pay-idem-1" }
      });
      expect(intentRes.statusCode).toBe(201);
      const intent = JSON.parse(intentRes.body).data;
      expect(intent.amountMinor).toBe(120000);

      const adapter = new SandboxSignedGatewayAdapter(env.PAYMENT_WEBHOOK_SECRET);

      // 1. Unsigned webhook -> 401
      const validPayloadObj = {
        eventId: `evt_valid_${Date.now()}`,
        providerOrderId: intent.providerOrderId,
        providerTransactionId: `tx_${Date.now()}`,
        status: "SUCCEEDED" as const,
        amountMinor: 120000,
        currency: "LKR",
        timestamp: Math.floor(Date.now() / 1000)
      };
      const rawValid = JSON.stringify(validPayloadObj);

      const unsignedRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/webhooks/sandbox",
        headers: { "content-type": "application/json" },
        payload: rawValid
      });
      expect(unsignedRes.statusCode).toBe(401);

      // 2. Forged signature -> 401
      const forgedAdapter = new SandboxSignedGatewayAdapter(
        "wrong_secret_that_does_not_match_server_32c!"
      );
      const forgedRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/webhooks/sandbox",
        headers: {
          "content-type": "application/json",
          "x-sandbox-signature": forgedAdapter.signWebhookPayload(rawValid)
        },
        payload: rawValid
      });
      expect(forgedRes.statusCode).toBe(401);

      // 3. Signed webhook with tampered/wrong amount -> 400
      const wrongAmountBody = JSON.stringify({
        ...validPayloadObj,
        eventId: `evt_wrong_amt_${Date.now()}`,
        amountMinor: 50000
      });
      const wrongAmtRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/webhooks/sandbox",
        headers: {
          "content-type": "application/json",
          "x-sandbox-signature": adapter.signWebhookPayload(wrongAmountBody)
        },
        payload: wrongAmountBody
      });
      expect(wrongAmtRes.statusCode).toBe(400);

      // 4. Valid HMAC-signed webhook -> confirms booking & unlocks OQ-012 exact address
      const okWebhookRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/webhooks/sandbox",
        headers: {
          "content-type": "application/json",
          "x-sandbox-signature": adapter.signWebhookPayload(rawValid)
        },
        payload: rawValid
      });
      expect(okWebhookRes.statusCode).toBe(200);
      expect(JSON.parse(okWebhookRes.body).data.outcome).toBe("BOOKING_CONFIRMED");

      // 5. Replayed identical signed webhook -> deduplicated cleanly with zero duplicate ledger rows
      const replayWebhookRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/webhooks/sandbox",
        headers: {
          "content-type": "application/json",
          "x-sandbox-signature": adapter.signWebhookPayload(rawValid)
        },
        payload: rawValid
      });
      expect(replayWebhookRes.statusCode).toBe(200);
      expect(JSON.parse(replayWebhookRes.body).data.duplicate).toBe(true);

      const ledgerCountRes = await runtimePool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM financial_ledger_entries WHERE booking_id = $1;",
        [createdBooking.id]
      );
      expect(Number(ledgerCountRes.rows[0].count)).toBe(2); // 1 DEBIT + 1 CREDIT only

      // Append-only immutability on financial_ledger_entries
      await expect(
        runtimePool.query(
          "UPDATE financial_ledger_entries SET amount_minor = 1 WHERE booking_id = $1;",
          [createdBooking.id]
        )
      ).rejects.toThrow();

      // 6. Owner now sees exact street address & coordinates; stranger gets 403
      const ownerDetail = await app.inject({
        method: "GET",
        url: `/api/v1/bookings/${createdBooking.id}`,
        headers: { authorization: `Bearer ${traveller.accessToken}` }
      });
      expect(ownerDetail.statusCode).toBe(200);
      const confirmedData = JSON.parse(ownerDetail.body).data;
      expect(confirmedData.status).toBe("CONFIRMED");
      expect(confirmedData.location.addressDisclosed).toBe(true);
      expect(confirmedData.location.addressLine1).toBe("42 Dalada Veediya, Kandy");
      expect(confirmedData.location.exactLatitude).toBeCloseTo(7.2906, 4);

      const strangerDetail = await app.inject({
        method: "GET",
        url: `/api/v1/bookings/${createdBooking.id}`,
        headers: { authorization: `Bearer ${otherTraveller.accessToken}` }
      });
      expect(strangerDetail.statusCode).toBe(403);
    });

    it("handles late payment webhook after booking hold expiration without overbooking and authorizes 100% refund", async () => {
      // Single-slot pool (1 unit = 1 medium bag)
      const { locationId } = await createActiveStorageLocation({
        sharedPoolUnits: 1,
        baseRateMinor: 150000
      });
      const travellerA = await createTestUser("TRAVELLER", "Late Payer A");
      const travellerB = await createTestUser("TRAVELLER", "Timely Payer B");
      const win = futureColomboWindow(6);

      // Traveller A creates booking + payment intent
      const bARes = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { authorization: `Bearer ${travellerA.accessToken}` },
        payload: {
          locationId,
          dropOffAt: win.dropOffAt,
          collectionAt: win.collectionAt,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
        }
      });
      const bookingA = JSON.parse(bARes.body).data;

      const intentARes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${travellerA.accessToken}` },
        payload: { bookingId: bookingA.id }
      });
      const intentA = JSON.parse(intentARes.body).data;

      // Booking A hold expires
      await migratorPool.query(
        "UPDATE bookings SET hold_expires_at = NOW() - INTERVAL '5 minutes' WHERE id = $1;",
        [bookingA.id]
      );
      await migratorPool.query(
        "UPDATE capacity_reservations SET expires_at = NOW() - INTERVAL '5 minutes' WHERE booking_id = $1;",
        [bookingA.id]
      );

      // Traveller B books and pays for the single capacity slot
      const bBRes = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { authorization: `Bearer ${travellerB.accessToken}` },
        payload: {
          locationId,
          dropOffAt: win.dropOffAt,
          collectionAt: win.collectionAt,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
        }
      });
      expect(bBRes.statusCode).toBe(201);
      const bookingB = JSON.parse(bBRes.body).data;
      const intentBRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${travellerB.accessToken}` },
        payload: { bookingId: bookingB.id }
      });
      const intentB = JSON.parse(intentBRes.body).data;
      const simB = await app.inject({
        method: "POST",
        url: `/api/v1/payments/intents/${intentB.id}/sandbox-simulate`,
        headers: { authorization: `Bearer ${travellerB.accessToken}` },
        payload: { outcome: "SUCCEEDED" }
      });
      expect(simB.statusCode).toBe(200);

      // Now late payment webhook arrives for Traveller A's expired hold!
      const adapter = new SandboxSignedGatewayAdapter(env.PAYMENT_WEBHOOK_SECRET);
      const lateWebhookRaw = JSON.stringify({
        eventId: `evt_late_${Date.now()}`,
        providerOrderId: intentA.providerOrderId,
        providerTransactionId: `tx_late_${Date.now()}`,
        status: "SUCCEEDED",
        amountMinor: 150000,
        currency: "LKR",
        timestamp: Math.floor(Date.now() / 1000)
      });
      const lateRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/webhooks/sandbox",
        headers: {
          "content-type": "application/json",
          "x-sandbox-signature": adapter.signWebhookPayload(lateWebhookRaw)
        },
        payload: lateWebhookRaw
      });
      expect(lateRes.statusCode).toBe(200);
      expect(JSON.parse(lateRes.body).data.outcome).toBe("LATE_CAPTURE_AUTO_REFUND_QUEUED");

      // Verify Booking A stays EXPIRED (no overbooking!) and has an AUTHORIZED 100% refund
      const detailARes = await app.inject({
        method: "GET",
        url: `/api/v1/bookings/${bookingA.id}`,
        headers: { authorization: `Bearer ${travellerA.accessToken}` }
      });
      const detailA = JSON.parse(detailARes.body).data;
      expect(detailA.status).toBe("EXPIRED");
      expect(detailA.paymentSummary.status).toBe("ORPHANED_SUCCEEDED");
      expect(detailA.refundSummary.status).toBe("AUTHORIZED");
      expect(detailA.refundSummary.amountMinor).toBe(150000);
      expect(detailA.refundSummary.reasonCategory).toBe("LATE_WEBHOOK_EXPIRED_HOLD");
    });
  });

  // ==========================================================================
  // 4. Cancellation Tiers (OQ-009), Support vs Superadmin RBAC (OQ-011) & Ledger
  // ==========================================================================
  describe("4. Cancellation Policy Tiers, Refund Queue Governance & Double-Entry Balance", () => {
    it("enforces 100% (>2h) and 50% (<2h) cancellation tiers, SUPPORT read-only boundary, and balanced ledger", async () => {
      const { locationId } = await createActiveStorageLocation({
        sharedPoolUnits: 20,
        baseRateMinor: 200000
      });
      const traveller = await createTestUser("TRAVELLER", "Cancel Traveller");
      const support = await createTestUser("SUPPORT", "Support Agent");
      const superadmin = await createTestUser("SUPERADMIN", "Platform Superadmin");

      // Booking 1: Paid booking >2h in future -> 100% refund
      const winFar = futureColomboWindow(4);
      const b1Res = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          locationId,
          dropOffAt: winFar.dropOffAt,
          collectionAt: winFar.collectionAt,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
        }
      });
      const b1 = JSON.parse(b1Res.body).data;
      const i1 = JSON.parse(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/payments/intents",
            headers: { authorization: `Bearer ${traveller.accessToken}` },
            payload: { bookingId: b1.id }
          })
        ).body
      ).data;
      await app.inject({
        method: "POST",
        url: `/api/v1/payments/intents/${i1.id}/sandbox-simulate`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { outcome: "SUCCEEDED" }
      });

      const cancel1Res = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${b1.id}/cancel`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { reason: "Flight rescheduled" }
      });
      expect(cancel1Res.statusCode).toBe(200);
      const cancelled1 = JSON.parse(cancel1Res.body).data;
      expect(cancelled1.status).toBe("CANCELLED_BY_TRAVELLER");
      expect(cancelled1.refundSummary.refundPercentage).toBe(100);
      expect(cancelled1.refundSummary.amountMinor).toBe(200000);

      // Booking 2: Paid booking moved within 90m of drop-off -> 50% refund + 50% retained split
      const b2Res = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          locationId,
          dropOffAt: winFar.dropOffAt,
          collectionAt: winFar.collectionAt,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
        }
      });
      const b2 = JSON.parse(b2Res.body).data;
      const i2 = JSON.parse(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/payments/intents",
            headers: { authorization: `Bearer ${traveller.accessToken}` },
            payload: { bookingId: b2.id }
          })
        ).body
      ).data;
      await app.inject({
        method: "POST",
        url: `/api/v1/payments/intents/${i2.id}/sandbox-simulate`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { outcome: "SUCCEEDED" }
      });

      // Set drop_off_at to NOW() + 60 minutes (inside <2h window)
      await migratorPool.query(
        "UPDATE bookings SET drop_off_at = NOW() + INTERVAL '60 minutes' WHERE id = $1;",
        [b2.id]
      );

      const cancel2Res = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${b2.id}/cancel`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { reason: "Late itinerary change within 2h" }
      });
      expect(cancel2Res.statusCode).toBe(200);
      const cancelled2 = JSON.parse(cancel2Res.body).data;
      expect(cancelled2.refundSummary.refundPercentage).toBe(50);
      expect(cancelled2.refundSummary.amountMinor).toBe(100000);

      // OQ-011: SUPPORT can read bookings & refunds (with masked email), but CANNOT mutate refunds or read financial ledger
      const supportBookingsRes = await app.inject({
        method: "GET",
        url: "/api/v1/admin/bookings",
        headers: { authorization: `Bearer ${support.accessToken}` }
      });
      expect(supportBookingsRes.statusCode).toBe(200);
      const firstForSupport = JSON.parse(supportBookingsRes.body).data[0];
      expect(firstForSupport.travellerEmail).toBeUndefined();
      expect(firstForSupport.travellerEmailMasked).toContain("***@");

      const supportRefundRead = await app.inject({
        method: "GET",
        url: "/api/v1/admin/refunds",
        headers: { authorization: `Bearer ${support.accessToken}` }
      });
      expect(supportRefundRead.statusCode).toBe(200);

      const refundId = cancelled1.refundSummary.refundId;
      const supportMutateDenied = await app.inject({
        method: "POST",
        url: `/api/v1/admin/refunds/${refundId}/transition`,
        headers: { authorization: `Bearer ${support.accessToken}` },
        payload: { targetStatus: "SUCCEEDED", notes: "Support trying to disburse" }
      });
      expect(supportMutateDenied.statusCode).toBe(403);

      const supportLedgerDenied = await app.inject({
        method: "GET",
        url: "/api/v1/admin/finance/ledger",
        headers: { authorization: `Bearer ${support.accessToken}` }
      });
      expect(supportLedgerDenied.statusCode).toBe(403);

      // SUPERADMIN transitions refund AUTHORIZED -> INITIATED -> PROCESSING -> SUCCEEDED
      for (const stage of ["INITIATED", "PROCESSING", "SUCCEEDED"] as const) {
        const trRes = await app.inject({
          method: "POST",
          url: `/api/v1/admin/refunds/${refundId}/transition`,
          headers: { authorization: `Bearer ${superadmin.accessToken}` },
          payload: { targetStatus: stage, notes: `Advancing refund to ${stage}` }
        });
        expect(trRes.statusCode).toBe(200);
        expect(JSON.parse(trRes.body).data.status).toBe(stage);
      }

      // Verify double-entry ledger balance across the entire platform
      const ledgerRes = await app.inject({
        method: "GET",
        url: "/api/v1/admin/finance/ledger",
        headers: { authorization: `Bearer ${superadmin.accessToken}` }
      });
      expect(ledgerRes.statusCode).toBe(200);
      const ledgerData = JSON.parse(ledgerRes.body).data;
      expect(ledgerData.totals.isBalanced).toBe(true);
      expect(ledgerData.totals.totalDebitsMinor).toBeGreaterThan(0);
      expect(ledgerData.totals.totalDebitsMinor).toBe(ledgerData.totals.totalCreditsMinor);
    });
  });

  // ==========================================================================
  // 5. Custody Handover, Staff Scoping (OQ-017), Bag Reconciliation & Zero Possessory Lien (OQ-015)
  // ==========================================================================
  describe("5. Custody Verification, Staff RBAC, Rate-Limiting & Zero Possessory Lien", () => {
    it("enforces hashed single-use custody passes, staff location/finance boundaries, bag reconciliation, overdue release without lien, and brute-force rate limits", async () => {
      const { owner, businessId, locationId, zoneId } = await createActiveStorageLocation({
        sharedPoolUnits: 10,
        baseRateMinor: 100000
      });
      const otherHost = await createActiveStorageLocation({ sharedPoolUnits: 4 });
      const assignedStaff = await createTestUser("HOST_STAFF", "Assigned Counter Attendant");
      const unassignedStaff = await createTestUser("HOST_STAFF", "Unassigned Counter Attendant");
      const traveller = await createTestUser("TRAVELLER", "Custody Traveller");
      const stranger = await createTestUser("TRAVELLER", "Stranger");

      // Provision host_staff_memberships: assignedStaff -> [locationId], unassignedStaff -> [otherLoc]
      const secondLocRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/locations",
        headers: { authorization: `Bearer ${owner.accessToken}` },
        payload: {
          businessId,
          name: "Galle Branch",
          addressLine1: "10 Church St",
          city: "Galle",
          latitude: 6.0267,
          longitude: 80.217
        }
      });
      const secondLocationId = JSON.parse(secondLocRes.body).data.id;

      await migratorPool.query(
        `INSERT INTO host_staff_memberships (business_id, user_id, staff_role, assigned_location_ids, is_active)
         VALUES
           ($1, $2, 'ATTENDANT', $4::jsonb, true),
           ($1, $3, 'ATTENDANT', $5::jsonb, true);`,
        [
          businessId,
          assignedStaff.userId,
          unassignedStaff.userId,
          JSON.stringify([locationId]),
          JSON.stringify([secondLocationId])
        ]
      );

      // OQ-017: Assigned HOST_STAFF MUST be blocked from host financial settlement summary
      const staffFinanceRes = await app.inject({
        method: "GET",
        url: "/api/v1/hosts/finance/summary",
        headers: { authorization: `Bearer ${assignedStaff.accessToken}` }
      });
      expect(staffFinanceRes.statusCode).toBe(403);

      // Create & confirm a 2-bag booking
      const win = futureColomboWindow(3);
      const bookRes = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          locationId,
          dropOffAt: win.dropOffAt,
          collectionAt: win.collectionAt,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: 2 }]
        }
      });
      const booking = JSON.parse(bookRes.body).data;

      const intent = JSON.parse(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/payments/intents",
            headers: { authorization: `Bearer ${traveller.accessToken}` },
            payload: { bookingId: booking.id }
          })
        ).body
      ).data;
      await app.inject({
        method: "POST",
        url: `/api/v1/payments/intents/${intent.id}/sandbox-simulate`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { outcome: "SUCCEEDED" }
      });

      // Stranger cannot issue custody pass
      const strangerPass = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${booking.id}/custody-pass`,
        headers: { authorization: `Bearer ${stranger.accessToken}` },
        payload: { operation: "CHECK_IN" }
      });
      expect(strangerPass.statusCode).toBe(403);

      //COLLECTION pass cannot be issued before CHECK_IN
      const prematureCollectionPass = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${booking.id}/custody-pass`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { operation: "COLLECTION" }
      });
      expect(prematureCollectionPass.statusCode).toBe(409);

      // Issue first CHECK_IN pass, then issue second CHECK_IN pass (revoking the first)
      const pass1Res = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${booking.id}/custody-pass`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { operation: "CHECK_IN" }
      });
      expect(pass1Res.statusCode).toBe(200);
      const pass1 = JSON.parse(pass1Res.body).data;

      const pass2Res = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${booking.id}/custody-pass`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { operation: "CHECK_IN" }
      });
      expect(pass2Res.statusCode).toBe(200);
      const pass2 = JSON.parse(pass2Res.body).data;

      // Verify DB stores ONLY 64-char SHA-256 hex hashes — never raw qrToken or verificationPin
      const dbTokens = await runtimePool.query<{ token_hash: string; pin_hash: string }>(
        "SELECT token_hash, pin_hash FROM custody_tokens WHERE booking_id = $1;",
        [booking.id]
      );
      for (const row of dbTokens.rows) {
        expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(row.pin_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(row.token_hash).not.toBe(pass2.qrToken);
        expect(row.pin_hash).not.toBe(pass2.verificationPin);
      }

      // Revoked pass1 fails verification (401)
      const revokedVerify = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/custody/verify",
        headers: { authorization: `Bearer ${assignedStaff.accessToken}` },
        payload: {
          bookingId: booking.id,
          operation: "CHECK_IN",
          qrToken: pass1.qrToken
        }
      });
      expect(revokedVerify.statusCode).toBe(401);

      // Cross-business host & unassigned staff fail with 403
      const crossHostVerify = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/custody/verify",
        headers: { authorization: `Bearer ${otherHost.owner.accessToken}` },
        payload: {
          bookingId: booking.id,
          operation: "CHECK_IN",
          verificationPin: pass2.verificationPin
        }
      });
      expect(crossHostVerify.statusCode).toBe(403);

      const unassignedVerify = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/custody/verify",
        headers: { authorization: `Bearer ${unassignedStaff.accessToken}` },
        payload: {
          bookingId: booking.id,
          operation: "CHECK_IN",
          verificationPin: pass2.verificationPin
        }
      });
      expect(unassignedVerify.statusCode).toBe(403);

      // Assigned staff pre-verifies pass2 successfully
      const okVerify = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/custody/verify",
        headers: { authorization: `Bearer ${assignedStaff.accessToken}` },
        payload: {
          bookingId: booking.id,
          operation: "CHECK_IN",
          verificationPin: pass2.verificationPin
        }
      });
      expect(okVerify.statusCode).toBe(200);
      expect(JSON.parse(okVerify.body).data.expectedBagCount).toBe(2);

      // OQ-014: Bag count mismatch (1 bag submitted for 2-bag booking without exception reason) -> 400
      const mismatchCheckIn = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/custody/${booking.id}/check-in`,
        headers: { authorization: `Bearer ${assignedStaff.accessToken}` },
        payload: {
          verificationPin: pass2.verificationPin,
          zoneId,
          bags: [{ bagTagCode: "TAG-001", bagCategory: "BAG_MEDIUM" }]
        }
      });
      expect(mismatchCheckIn.statusCode).toBe(400);

      // Valid 2-bag check-in consumes pass2 and transitions booking -> IN_STORAGE
      const okCheckIn = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/custody/${booking.id}/check-in`,
        headers: { authorization: `Bearer ${assignedStaff.accessToken}` },
        payload: {
          qrToken: pass2.qrToken,
          zoneId,
          bags: [
            {
              bagTagCode: "TAG-FORT-101",
              bagCategory: "BAG_MEDIUM",
              securitySealNumber: "SEAL-9001"
            },
            {
              bagTagCode: "TAG-FORT-102",
              bagCategory: "BAG_MEDIUM",
              securitySealNumber: "SEAL-9002"
            }
          ]
        }
      });
      expect(okCheckIn.statusCode).toBe(200);
      expect(JSON.parse(okCheckIn.body).data.status).toBe("IN_STORAGE");

      // Append-only immutability on custody_events
      await expect(
        runtimePool.query(
          "DELETE FROM custody_events WHERE booking_id = $1;",
          [booking.id]
        )
      ).rejects.toThrow();

      // Replaying consumed CHECK_IN pass for COLLECTION fails (401)
      const wrongOpCheckOut = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/custody/${booking.id}/check-out`,
        headers: { authorization: `Bearer ${assignedStaff.accessToken}` },
        payload: {
          qrToken: pass2.qrToken,
          releasedBagCount: 2
        }
      });
      expect(wrongOpCheckOut.statusCode).toBe(401);

      // OQ-015 Overdue Collection & Zero Possessory Lien:
      // Move scheduled collection_at 5 hours into the past (>30m grace period)
      await migratorPool.query(
        `UPDATE bookings
         SET drop_off_at = NOW() - INTERVAL '10 hours',
             collection_at = NOW() - INTERVAL '5 hours'
         WHERE id = $1;`,
        [booking.id]
      );

      const collPassRes = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${booking.id}/custody-pass`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { operation: "COLLECTION" }
      });
      expect(collPassRes.statusCode).toBe(200);
      const collPass = JSON.parse(collPassRes.body).data;

      const checkOutRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/custody/${booking.id}/check-out`,
        headers: { authorization: `Bearer ${assignedStaff.accessToken}` },
        payload: {
          verificationPin: collPass.verificationPin,
          releasedBagCount: 2
        }
      });
      expect(checkOutRes.statusCode).toBe(200);
      const releasedCustody = JSON.parse(checkOutRes.body).data;
      expect(releasedCustody.status).toBe("RELEASED_TO_TRAVELLER");
      expect(releasedCustody.overdueMinutes).toBeGreaterThanOrEqual(299);
      expect(releasedCustody.overdueFeeMinor).toBeGreaterThan(0);
      expect(releasedCustody.handoverCondition).toBe("UNPAID_FEES_PENDING");

      // Duplicate collection attempt fails with 409 Conflict
      await rateLimitService.clearAll();
      const dupCheckOut = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/custody/${booking.id}/check-out`,
        headers: { authorization: `Bearer ${assignedStaff.accessToken}` },
        payload: {
          verificationPin: collPass.verificationPin,
          releasedBagCount: 2
        }
      });
      expect(dupCheckOut.statusCode).toBe(409);

      // HOST_OWNER sees accrued payable in /api/v1/hosts/finance/summary (85% of 200000 = 170000)
      const ownerFinanceRes = await app.inject({
        method: "GET",
        url: `/api/v1/hosts/finance/summary?businessId=${businessId}`,
        headers: { authorization: `Bearer ${owner.accessToken}` }
      });
      expect(ownerFinanceRes.statusCode).toBe(200);
      const financeSummary = JSON.parse(ownerFinanceRes.body).data;
      expect(financeSummary.totalEligibleMinor).toBe(170000);
      expect(financeSummary.payables[0].netPayableMinor).toBe(170000);

      // Operational exception places host payable ON_HOLD
      const exceptionRes = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${booking.id}/exceptions`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          category: "DAMAGE_REPORTED",
          reason: "Scratch noticed on outer hard-shell suitcase corner"
        }
      });
      expect(exceptionRes.statusCode).toBe(200);
      expect(JSON.parse(exceptionRes.body).data.status).toBe("DISPUTED");

      const heldFinanceRes = await app.inject({
        method: "GET",
        url: `/api/v1/hosts/finance/summary?businessId=${businessId}`,
        headers: { authorization: `Bearer ${owner.accessToken}` }
      });
      expect(JSON.parse(heldFinanceRes.body).data.totalOnHoldMinor).toBe(170000);

      // Rate-limit brute-force protection on repeated invalid PIN attempts (custody_verify_booking max = 8)
      const rateBookingRes = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          locationId,
          dropOffAt: win.dropOffAt,
          collectionAt: win.collectionAt,
          items: [{ bagCategory: "BAG_SMALL", quantity: 1 }]
        }
      });
      const rateBooking = JSON.parse(rateBookingRes.body).data;
      const rateIntent = JSON.parse(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/payments/intents",
            headers: { authorization: `Bearer ${traveller.accessToken}` },
            payload: { bookingId: rateBooking.id }
          })
        ).body
      ).data;
      await app.inject({
        method: "POST",
        url: `/api/v1/payments/intents/${rateIntent.id}/sandbox-simulate`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { outcome: "SUCCEEDED" }
      });
      await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${rateBooking.id}/custody-pass`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { operation: "CHECK_IN" }
      });

      await rateLimitService.clearAll();
      let lastStatus = 200;
      for (let attempt = 0; attempt < 9; attempt++) {
        const badPinRes = await app.inject({
          method: "POST",
          url: "/api/v1/hosts/custody/verify",
          headers: { authorization: `Bearer ${assignedStaff.accessToken}` },
          payload: {
            bookingId: rateBooking.id,
            operation: "CHECK_IN",
            verificationPin: "000000"
          }
        });
        lastStatus = badPinRes.statusCode;
      }
      expect(lastStatus).toBe(429);
    });
  });
});
