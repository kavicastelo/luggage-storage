import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { rateLimitService } from "../src/modules/auth/rate-limit.service.js";

const { Pool } = pg;

describe("Initiative 1 — API Security, RBAC, Privacy & Custody Hardening", () => {
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
    displayName = "Initiative 1 User"
  ) {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const email = `init1_${unique}@example.com`;
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

    const setCookieHeader = loginRes.headers["set-cookie"];
    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : setCookieHeader
        ? [setCookieHeader]
        : [];
    const refreshCookie = cookies
      .map((entry) => entry.split(";")[0])
      .find((kv) => kv.startsWith("refresh_token="));

    return {
      userId,
      email,
      password,
      accessToken: JSON.parse(loginRes.body).data.accessToken as string,
      refreshCookie
    };
  }

  async function createHostLocationFixture(
    owner?: Awaited<ReturnType<typeof createTestUser>>,
    activate = true
  ) {
    const resolvedOwner = owner ?? (await createTestUser("HOST_OWNER", "Host Owner"));

    const bizRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/businesses",
      headers: { authorization: `Bearer ${resolvedOwner.accessToken}` },
      payload: {
        legalBusinessName: `Harbor Vault Ltd ${Date.now()}`,
        tradeName: "Harbor Storage Counter",
        entityType: "RETAIL_SHOP",
        contactEmail: `harbor_${Date.now()}@vault.lk`,
        contactPhone: "+94771234567",
        city: "Colombo"
      }
    });
    expect(bizRes.statusCode).toBe(201);
    const businessId = JSON.parse(bizRes.body).data.id as string;

    if (activate) {
      await migratorPool.query(
        "UPDATE host_businesses SET status = 'ACTIVE' WHERE id = $1;",
        [businessId]
      );
    }

    const locRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/locations",
      headers: { authorization: `Bearer ${resolvedOwner.accessToken}` },
      payload: {
        businessId,
        name: "Galle Face Arcade Vault",
        description: "Ground floor manned luggage counter",
        addressLine1: "88 Galle Road, Colombo 03",
        addressLine2: "Unit G2",
        city: "Colombo",
        postalCode: "00300",
        latitude: 6.9219,
        longitude: 79.8487,
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
    const hoursRes = await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/opening-hours`,
      headers: { authorization: `Bearer ${resolvedOwner.accessToken}` },
      payload: { schedules }
    });
    expect(hoursRes.statusCode).toBe(200);

    const zoneRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/locations/${locationId}/zones`,
      headers: { authorization: `Bearer ${resolvedOwner.accessToken}` },
      payload: { name: "Rack A", zoneType: "RACK" }
    });
    expect(zoneRes.statusCode).toBe(201);
    const zoneId = JSON.parse(zoneRes.body).data.id as string;

    const poolsRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/locations/${locationId}/capacity-pools`,
      headers: { authorization: `Bearer ${resolvedOwner.accessToken}` }
    });
    expect(poolsRes.statusCode).toBe(200);
    const poolId = JSON.parse(poolsRes.body).data.pools[0].id as string;

    const capRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/hosts/capacity-pools/${poolId}`,
      headers: { authorization: `Bearer ${resolvedOwner.accessToken}` },
      payload: { zoneId, totalUnits: 15, isActive: true }
    });
    expect(capRes.statusCode).toBe(200);

    const priceRes = await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/pricing`,
      headers: { authorization: `Bearer ${resolvedOwner.accessToken}` },
      payload: {
        currency: "LKR",
        pricingUnit: "CALENDAR_DAY",
        baseRateMinor: 100000,
        tierRates: [
          { bagCategory: "BAG_SMALL", rateMinor: 70000, categoryMultiplierBps: 7000 },
          { bagCategory: "BAG_MEDIUM", rateMinor: 100000, categoryMultiplierBps: 10000 },
          { bagCategory: "BAG_LARGE", rateMinor: 130000, categoryMultiplierBps: 13000 },
          { bagCategory: "BAG_OVERSIZED", rateMinor: 200000, categoryMultiplierBps: 20000 }
        ]
      }
    });
    expect(priceRes.statusCode).toBe(200);

    if (activate) {
      await migratorPool.query(
        "UPDATE storage_locations SET status = 'ACTIVE' WHERE id = $1;",
        [locationId]
      );
    }

    return { owner: resolvedOwner, businessId, locationId, zoneId, poolId };
  }

  function futureColomboWindow(daysAhead = 4) {
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

  it("1. Workstream A: accepts bodyless POST /logout with Content-Type: application/json and prevents session resurrection", async () => {
    const user = await createTestUser("TRAVELLER", "Session Logout Traveller");
    expect(user.refreshCookie).toBeDefined();

    const logoutRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${user.accessToken}`,
        cookie: user.refreshCookie!
      }
    });
    expect(logoutRes.statusCode).toBe(200);

    const activeSessionsRes = await runtimePool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM auth_sessions WHERE user_id = $1 AND revoked_at IS NULL;",
      [user.userId]
    );
    expect(Number(activeSessionsRes.rows[0].count)).toBe(0);

    const meAfterLogout = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${user.accessToken}` }
    });
    expect(meAfterLogout.statusCode).toBe(401);

    const refreshAfterLogout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { cookie: user.refreshCookie! },
      payload: { clientType: "WEB" }
    });
    expect(refreshAfterLogout.statusCode).toBe(401);
  });

  it("2. Workstream B: blocks SUPPORT writes to host entities and enforces cross-host IDOR isolation", async () => {
    const hostA = await createHostLocationFixture(undefined, false);
    const hostB = await createTestUser("HOST_OWNER", "Host B Attacker");
    const support = await createTestUser("SUPPORT", "Platform Support Agent");

    const supportMutations = [
      app.inject({
        method: "POST",
        url: "/api/v1/hosts/locations",
        headers: { authorization: `Bearer ${support.accessToken}` },
        payload: {
          businessId: hostA.businessId,
          name: "Support Created Counter",
          addressLine1: "1 Main Rd",
          city: "Colombo",
          latitude: 6.92,
          longitude: 79.85
        }
      }),
      app.inject({
        method: "PATCH",
        url: `/api/v1/hosts/locations/${hostA.locationId}`,
        headers: { authorization: `Bearer ${support.accessToken}` },
        payload: { name: "Tampered By Support" }
      }),
      app.inject({
        method: "PUT",
        url: `/api/v1/hosts/locations/${hostA.locationId}/opening-hours`,
        headers: { authorization: `Bearer ${support.accessToken}` },
        payload: {
          schedules: [{ dayOfWeek: 1, openTime: "09:00", closeTime: "18:00", isClosed: false }]
        }
      }),
      app.inject({
        method: "POST",
        url: `/api/v1/hosts/locations/${hostA.locationId}/zones`,
        headers: { authorization: `Bearer ${support.accessToken}` },
        payload: { name: "Support Zone", zoneType: "RACK" }
      }),
      app.inject({
        method: "PATCH",
        url: `/api/v1/hosts/capacity-pools/${hostA.poolId}`,
        headers: { authorization: `Bearer ${support.accessToken}` },
        payload: { totalUnits: 99 }
      }),
      app.inject({
        method: "PUT",
        url: `/api/v1/hosts/locations/${hostA.locationId}/pricing`,
        headers: { authorization: `Bearer ${support.accessToken}` },
        payload: {
          currency: "LKR",
          pricingUnit: "CALENDAR_DAY",
          baseRateMinor: 50000,
          tierRates: [{ bagCategory: "BAG_MEDIUM", rateMinor: 50000, categoryMultiplierBps: 10000 }]
        }
      })
    ];

    const supportResponses = await Promise.all(supportMutations);
    for (const res of supportResponses) {
      expect(res.statusCode).toBe(403);
    }

    const crossHostCalls = [
      app.inject({
        method: "GET",
        url: `/api/v1/hosts/businesses/${hostA.businessId}`,
        headers: { authorization: `Bearer ${hostB.accessToken}` }
      }),
      app.inject({
        method: "PATCH",
        url: `/api/v1/hosts/businesses/${hostA.businessId}`,
        headers: { authorization: `Bearer ${hostB.accessToken}` },
        payload: { tradeName: "Hijacked Business" }
      }),
      app.inject({
        method: "GET",
        url: `/api/v1/hosts/locations/${hostA.locationId}`,
        headers: { authorization: `Bearer ${hostB.accessToken}` }
      }),
      app.inject({
        method: "PATCH",
        url: `/api/v1/hosts/locations/${hostA.locationId}`,
        headers: { authorization: `Bearer ${hostB.accessToken}` },
        payload: { name: "Hijacked Location" }
      }),
      app.inject({
        method: "PATCH",
        url: `/api/v1/hosts/capacity-pools/${hostA.poolId}`,
        headers: { authorization: `Bearer ${hostB.accessToken}` },
        payload: { totalUnits: 1 }
      }),
      app.inject({
        method: "PUT",
        url: `/api/v1/hosts/locations/${hostA.locationId}/pricing`,
        headers: { authorization: `Bearer ${hostB.accessToken}` },
        payload: {
          currency: "LKR",
          pricingUnit: "CALENDAR_DAY",
          baseRateMinor: 25000,
          tierRates: [{ bagCategory: "BAG_MEDIUM", rateMinor: 25000, categoryMultiplierBps: 10000 }]
        }
      }),
      app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostB.accessToken}` },
        payload: {
          purpose: "HOST_VERIFICATION",
          resourceType: "HOST_BUSINESS",
          resourceId: hostA.businessId,
          fileName: "kyc.pdf",
          fileSize: 1024,
          mimeType: "application/pdf"
        }
      })
    ];

    const crossHostResponses = await Promise.all(crossHostCalls);
    for (const res of crossHostResponses) {
      expect(res.statusCode).toBe(403);
    }

    const ownerReadRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/businesses/${hostA.businessId}`,
      headers: { authorization: `Bearer ${hostA.owner.accessToken}` }
    });
    expect(ownerReadRes.statusCode).toBe(200);
  });

  it("3. Workstream C: redacts commission and host-payable fields from public quotes/availability and non-owner booking detail", async () => {
    const fixture = await createHostLocationFixture(undefined, true);
    const staff = await createTestUser("HOST_STAFF", "Desk Attendant");
    const traveller = await createTestUser("TRAVELLER", "Privacy Traveller");
    const support = await createTestUser("SUPPORT", "Support Reader");
    const superadmin = await createTestUser("SUPERADMIN", "Superadmin Auditor");

    await migratorPool.query(
      `INSERT INTO host_staff_memberships (business_id, user_id, staff_role, assigned_location_ids, is_active)
       VALUES ($1, $2, 'ATTENDANT', $3::jsonb, true);`,
      [fixture.businessId, staff.userId, JSON.stringify([fixture.locationId])]
    );

    const win = futureColomboWindow(5);

    const quoteRes = await app.inject({
      method: "POST",
      url: "/api/v1/bookings/quote",
      payload: {
        locationId: fixture.locationId,
        dropOffAt: win.dropOffAt,
        collectionAt: win.collectionAt,
        items: [{ bagCategory: "BAG_MEDIUM", quantity: 2 }]
      }
    });
    expect(quoteRes.statusCode).toBe(200);
    const quote = JSON.parse(quoteRes.body).data;
    expect(quote.storageSubtotalMinor).toBeGreaterThan(0);
    expect(quote.commissionRateBps).toBeUndefined();
    expect(quote.platformCommissionMinor).toBeUndefined();
    expect(quote.hostPayableMinor).toBeUndefined();

    const searchUrl = `/api/v1/availability/search?dropOffAt=${encodeURIComponent(
      win.dropOffAt
    )}&collectionAt=${encodeURIComponent(win.collectionAt)}&locationId=${fixture.locationId}&mediumBags=2`;
    const availRes = await app.inject({ method: "GET", url: searchUrl });
    expect(availRes.statusCode).toBe(200);
    const availQuotes = JSON.parse(availRes.body).data.quotes as Array<Record<string, unknown>>;
    expect(availQuotes.length).toBeGreaterThanOrEqual(1);
    for (const q of availQuotes) {
      expect(q.commissionRateBps).toBeUndefined();
      expect(q.platformCommissionMinor).toBeUndefined();
      expect(q.hostPayableMinor).toBeUndefined();
    }

    const bookRes = await app.inject({
      method: "POST",
      url: "/api/v1/bookings",
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: {
        locationId: fixture.locationId,
        dropOffAt: win.dropOffAt,
        collectionAt: win.collectionAt,
        items: [{ bagCategory: "BAG_MEDIUM", quantity: 2 }]
      }
    });
    expect(bookRes.statusCode).toBe(201);
    const bookingId = JSON.parse(bookRes.body).data.id as string;

    for (const viewer of [traveller, staff, support]) {
      const detailRes = await app.inject({
        method: "GET",
        url: `/api/v1/bookings/${bookingId}`,
        headers: { authorization: `Bearer ${viewer.accessToken}` }
      });
      expect(detailRes.statusCode).toBe(200);
      const snap = JSON.parse(detailRes.body).data.pricingSnapshot;
      expect(snap.commissionRateBps).toBeUndefined();
      expect(snap.platformCommissionMinor).toBeUndefined();
      expect(snap.hostPayableMinor).toBeUndefined();
    }

    for (const privilegedViewer of [fixture.owner, superadmin]) {
      const detailRes = await app.inject({
        method: "GET",
        url: `/api/v1/bookings/${bookingId}`,
        headers: { authorization: `Bearer ${privilegedViewer.accessToken}` }
      });
      expect(detailRes.statusCode).toBe(200);
      const snap = JSON.parse(detailRes.body).data.pricingSnapshot;
      expect(snap.commissionRateBps).toEqual(expect.any(Number));
      expect(snap.platformCommissionMinor).toEqual(expect.any(Number));
      expect(snap.hostPayableMinor).toEqual(expect.any(Number));
    }
  });

  it("4. Workstream E: transitions normal collection with collectionNotes to COMPLETED and exception collection to DISPUTED", async () => {
    const fixture = await createHostLocationFixture(undefined, true);
    const traveller = await createTestUser("TRAVELLER", "Collection Test Traveller");

    async function createPaidCheckedInBooking(daysAhead: number) {
      const win = futureColomboWindow(daysAhead);
      const bookRes = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          locationId: fixture.locationId,
          dropOffAt: win.dropOffAt,
          collectionAt: win.collectionAt,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
        }
      });
      expect(bookRes.statusCode).toBe(201);
      const bookingId = JSON.parse(bookRes.body).data.id as string;

      const intentRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { bookingId }
      });
      expect(intentRes.statusCode).toBe(201);
      const intentId = JSON.parse(intentRes.body).data.id as string;

      const simRes = await app.inject({
        method: "POST",
        url: `/api/v1/payments/intents/${intentId}/sandbox-simulate`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { outcome: "SUCCEEDED" }
      });
      expect(simRes.statusCode).toBe(200);

      const inPassRes = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${bookingId}/custody-pass`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { operation: "CHECK_IN" }
      });
      expect(inPassRes.statusCode).toBe(200);
      const inPass = JSON.parse(inPassRes.body).data;

      const checkInRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/custody/${bookingId}/check-in`,
        headers: { authorization: `Bearer ${fixture.owner.accessToken}` },
        payload: {
          qrToken: inPass.qrToken,
          zoneId: fixture.zoneId,
          bags: [
            {
              bagTagCode: "TAG-1",
              bagCategory: "BAG_MEDIUM",
              securitySealNumber: "SEAL-1001"
            }
          ]
        }
      });
      expect(checkInRes.statusCode).toBe(200);

      const outPassRes = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${bookingId}/custody-pass`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { operation: "COLLECTION" }
      });
      expect(outPassRes.statusCode).toBe(200);
      return {
        bookingId,
        collectionQr: JSON.parse(outPassRes.body).data.qrToken as string
      };
    }

    // Normal collection with collectionNotes -> COMPLETED + RELEASED_TO_TRAVELLER + ELIGIBLE payable
    const normalBooking = await createPaidCheckedInBooking(6);
    const normalOutRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/custody/${normalBooking.bookingId}/check-out`,
      headers: { authorization: `Bearer ${fixture.owner.accessToken}` },
      payload: {
        qrToken: normalBooking.collectionQr,
        releasedBagCount: 1,
        collectionNotes: "All seals intact at counter"
      }
    });
    expect(normalOutRes.statusCode).toBe(200);
    const normalCustody = JSON.parse(normalOutRes.body).data;
    expect(normalCustody.status).toBe("RELEASED_TO_TRAVELLER");
    expect(normalCustody.handoverCondition).toBe("NORMAL");

    const normalDbBooking = await runtimePool.query<{ status: string }>(
      "SELECT status FROM bookings WHERE id = $1;",
      [normalBooking.bookingId]
    );
    expect(normalDbBooking.rows[0].status).toBe("COMPLETED");

    const normalEventRes = await runtimePool.query<{ metadata: { collectionNotes?: string } }>(
      "SELECT metadata FROM custody_events WHERE booking_id = $1 AND event_type = 'BAGS_RELEASED_TO_TRAVELLER' LIMIT 1;",
      [normalBooking.bookingId]
    );
    expect(normalEventRes.rows[0].metadata.collectionNotes).toBe("All seals intact at counter");

    const financeAfterNormal = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/finance/summary?businessId=${fixture.businessId}`,
      headers: { authorization: `Bearer ${fixture.owner.accessToken}` }
    });
    expect(financeAfterNormal.statusCode).toBe(200);
    expect(JSON.parse(financeAfterNormal.body).data.totalEligibleMinor).toBeGreaterThan(0);
    expect(JSON.parse(financeAfterNormal.body).data.totalOnHoldMinor).toBe(0);

    // Exception collection with exceptionNotes -> DISPUTED + DISPUTED_RELEASE + ON_HOLD payable
    const excBooking = await createPaidCheckedInBooking(7);
    const excOutRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/custody/${excBooking.bookingId}/check-out`,
      headers: { authorization: `Bearer ${fixture.owner.accessToken}` },
      payload: {
        qrToken: excBooking.collectionQr,
        releasedBagCount: 1,
        exceptionNotes: "Corner wheel cracked"
      }
    });
    expect(excOutRes.statusCode).toBe(200);
    const excCustody = JSON.parse(excOutRes.body).data;
    expect(excCustody.status).toBe("DISPUTED_RELEASE");
    expect(excCustody.handoverCondition).toBe("EXCEPTION_RECORDED");

    const excDbBooking = await runtimePool.query<{ status: string }>(
      "SELECT status FROM bookings WHERE id = $1;",
      [excBooking.bookingId]
    );
    expect(excDbBooking.rows[0].status).toBe("DISPUTED");

    const financeAfterException = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/finance/summary?businessId=${fixture.businessId}`,
      headers: { authorization: `Bearer ${fixture.owner.accessToken}` }
    });
    expect(financeAfterException.statusCode).toBe(200);
    expect(JSON.parse(financeAfterException.body).data.totalOnHoldMinor).toBeGreaterThan(0);
  });
});

