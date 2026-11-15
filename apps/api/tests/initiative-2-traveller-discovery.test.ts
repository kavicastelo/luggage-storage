import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { rateLimitService } from "../src/modules/auth/rate-limit.service.js";

const { Pool } = pg;

describe("Initiative 2 — Traveller Discovery, Custody Pass Regeneration, Cancellation Tiers & Exceptions", () => {
  let app: FastifyInstance;
  let migratorPool: pg.Pool;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    migratorPool = new Pool({
      connectionString: env.MIGRATION_DATABASE_URL,
      max: 2
    });
  });

  beforeEach(async () => {
    await rateLimitService.clearAll();
  });

  afterAll(async () => {
    await app.close();
    await migratorPool.end();
  });

  async function createActiveUser(
    roleCode: "TRAVELLER" | "HOST_OWNER" = "TRAVELLER",
    label = "Init2 User"
  ) {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const email = `init2_${suffix}@example.com`;
    const password = "StrongPassword123!";

    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password, displayName: label }
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
      dateStr: `${yyyy}-${mm}-${dd}`,
      dropOffAt: `${yyyy}-${mm}-${dd}T04:30:00.000Z`,
      collectionAt: `${yyyy}-${mm}-${dd}T11:30:00.000Z`
    };
  }

  async function seedActiveHostLocation(params?: {
    name?: string;
    city?: string;
    acceptsOversized?: boolean;
    baseRateMinor?: number;
    amenities?: string[];
    totalUnits?: number;
    withMediaAndException?: boolean;
  }) {
    const host = await createActiveUser("HOST_OWNER", "Init2 Host Owner");
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const bizRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/businesses",
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: {
        legalBusinessName: `Transit Storage Holdings ${unique}`,
        tradeName: `Hub ${unique}`,
        entityType: "RETAIL_SHOP",
        contactEmail: `biz_${unique}@storage.lk`,
        contactPhone: "+94772345678",
        city: params?.city ?? "Galle"
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
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: {
        businessId,
        name: params?.name ?? `Fort Station Vault ${unique}`,
        description: "Verified custody desk near station entrance",
        addressLine1: "99 Rampart Street Secret Door",
        addressLine2: "Level 2 Vault",
        city: params?.city ?? "Galle",
        postalCode: "80000",
        latitude: 6.0329,
        longitude: 80.2168,
        timezone: "Asia/Colombo",
        bookingMode: "INSTANT",
        acceptsOversized: params?.acceptsOversized ?? true,
        amenities: params?.amenities ?? ["CCTV", "CLIMATE_CONTROLLED"]
      }
    });
    expect(locRes.statusCode).toBe(201);
    const locationId = JSON.parse(locRes.body).data.id as string;

    const schedules = [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
      dayOfWeek,
      openTime: "06:00",
      closeTime: "23:00",
      isClosed: false
    }));
    const hoursRes = await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/opening-hours`,
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: { schedules }
    });
    expect(hoursRes.statusCode).toBe(200);

    const poolsRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/locations/${locationId}/capacity-pools`,
      headers: { authorization: `Bearer ${host.accessToken}` }
    });
    const poolId = (JSON.parse(poolsRes.body).data.pools as Array<{ id: string }>)[0].id;
    const capRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/hosts/capacity-pools/${poolId}`,
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: {
        totalUnits: params?.totalUnits ?? 25,
        isActive: true
      }
    });
    expect(capRes.statusCode).toBe(200);

    const baseRate = params?.baseRateMinor ?? 120000;
    const priceRes = await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/pricing`,
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: {
        currency: "LKR",
        pricingUnit: "CALENDAR_DAY",
        baseRateMinor: baseRate,
        tierRates: [
          { bagCategory: "BAG_SMALL", rateMinor: Math.round(baseRate * 0.8), categoryMultiplierBps: 8000 },
          { bagCategory: "BAG_MEDIUM", rateMinor: baseRate, categoryMultiplierBps: 10000 },
          { bagCategory: "BAG_LARGE", rateMinor: Math.round(baseRate * 1.2), categoryMultiplierBps: 12000 },
          { bagCategory: "BAG_OVERSIZED", rateMinor: Math.round(baseRate * 1.5), categoryMultiplierBps: 15000 }
        ]
      }
    });
    expect(priceRes.statusCode).toBe(200);

    if (params?.withMediaAndException) {
      const exWindow = futureColomboWindow(3);
      const exRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/locations/${locationId}/exceptions`,
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          exceptionDate: exWindow.dateStr,
          exceptionType: "SPECIAL_HOURS",
          openTime: "09:00",
          closeTime: "18:00",
          reason: "Poya holiday schedule"
        }
      });
      expect(exRes.statusCode).toBe(201);

      const media1Res = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/locations/${locationId}/media`,
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          fileKey: `locations/${locationId}/gallery-2.jpg`,
          url: "https://cdn.example.lk/gallery-2.jpg",
          caption: "Storage Rack View",
          isPrimary: false,
          sortOrder: 1
        }
      });
      expect(media1Res.statusCode).toBe(201);

      const media0Res = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/locations/${locationId}/media`,
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          fileKey: `locations/${locationId}/gallery-1.jpg`,
          url: "https://cdn.example.lk/gallery-1.jpg",
          caption: "Check-in Desk",
          isPrimary: true,
          sortOrder: 0
        }
      });
      expect(media0Res.statusCode).toBe(201);
    }

    await migratorPool.query(
      "UPDATE storage_locations SET status = 'ACTIVE' WHERE id = $1;",
      [locationId]
    );

    return { host, businessId, locationId };
  }

  it("enriches public location details with hours, exceptions, pricing tiers, capacity summary, and sorted media while enforcing OQ-012 privacy", async () => {
    const { locationId } = await seedActiveHostLocation({
      baseRateMinor: 110000,
      totalUnits: 25,
      withMediaAndException: true
    });

    const detailRes = await app.inject({
      method: "GET",
      url: `/api/v1/discovery/locations/${locationId}`
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = JSON.parse(detailRes.body).data;

    expect(detail.openingHours).toHaveLength(7);
    expect(detail.openingHours.map((h: { dayOfWeek: number }) => h.dayOfWeek)).toEqual([
      1, 2, 3, 4, 5, 6, 7
    ]);
    expect(detail.upcomingExceptions.length).toBeGreaterThanOrEqual(1);
    expect(detail.upcomingExceptions[0].exceptionType).toBe("SPECIAL_HOURS");
    expect(detail.upcomingExceptions[0].reason).toBe("Poya holiday schedule");

    expect(detail.pricingPolicy).toBeTruthy();
    expect(detail.pricingPolicy.baseRateMinor).toBe(110000);
    expect(detail.pricingPolicy.tierRates).toHaveLength(4);

    expect(detail.capacitySummary.activePoolCount).toBeGreaterThanOrEqual(1);
    expect(detail.capacitySummary.totalMaxCapacityUnits).toBe(25);
    expect(detail.capacitySummary.supportedBagCategories.length).toBeGreaterThanOrEqual(1);

    expect(detail.images).toHaveLength(2);
    expect(detail.images[0].sortOrder).toBe(0);
    expect(detail.images[1].sortOrder).toBe(1);

    // OQ-012 privacy invariants strictly preserved
    expect(detail.addressLine1).toBeUndefined();
    expect(detail.addressLine2).toBeUndefined();
    expect(detail.postalCode).toBeUndefined();
    expect(detail.exactLatitude).toBeUndefined();
    expect(detail.exactLongitude).toBeUndefined();
    expect(detail.directionsNotes).toBeUndefined();
    expect(detail.averageRating).toBeNull();
    expect(detail.reviewCount).toBe(0);
  });

  it("supports server-side sortBy (price_asc, price_desc, newest) and acceptsOversized filtering on public discovery", async () => {
    const uniqueCity = `SortCity${Date.now()}`;
    const budgetLoc = await seedActiveHostLocation({
      name: "Budget Compact Lockers",
      city: uniqueCity,
      acceptsOversized: false,
      baseRateMinor: 80000
    });
    const premiumLoc = await seedActiveHostLocation({
      name: "Premium Oversized Lounge",
      city: uniqueCity,
      acceptsOversized: true,
      baseRateMinor: 210000
    });

    const ascRes = await app.inject({
      method: "GET",
      url: `/api/v1/discovery/locations?city=${encodeURIComponent(uniqueCity)}&sortBy=price_asc`
    });
    expect(ascRes.statusCode).toBe(200);
    const ascIds = (JSON.parse(ascRes.body).data.locations as Array<{ id: string }>).map((l) => l.id);
    expect(ascIds).toEqual([budgetLoc.locationId, premiumLoc.locationId]);

    const descRes = await app.inject({
      method: "GET",
      url: `/api/v1/discovery/locations?city=${encodeURIComponent(uniqueCity)}&sortBy=price_desc`
    });
    expect(descRes.statusCode).toBe(200);
    const descIds = (JSON.parse(descRes.body).data.locations as Array<{ id: string }>).map(
      (l) => l.id
    );
    expect(descIds).toEqual([premiumLoc.locationId, budgetLoc.locationId]);

    const oversizedRes = await app.inject({
      method: "GET",
      url: `/api/v1/discovery/locations?city=${encodeURIComponent(uniqueCity)}&acceptsOversized=true`
    });
    expect(oversizedRes.statusCode).toBe(200);
    const oversizedIds = (
      JSON.parse(oversizedRes.body).data.locations as Array<{ id: string }>
    ).map((l) => l.id);
    expect(oversizedIds).toEqual([premiumLoc.locationId]);
  });

  it("regenerates single-use traveller QR custody passes, revokes prior tokens, and verifies fresh 64-char qrToken at host counter", async () => {
    const { host, locationId } = await seedActiveHostLocation();
    const traveller = await createActiveUser("TRAVELLER", "Init2 Traveller");
    const win = futureColomboWindow(6);

    const bookRes = await app.inject({
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
    expect(bookRes.statusCode).toBe(201);
    const bookingId = JSON.parse(bookRes.body).data.id as string;

    const intentRes = await app.inject({
      method: "POST",
      url: "/api/v1/payments/intents",
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { bookingId, channel: "WEB" }
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

    const statusRes = await app.inject({
      method: "GET",
      url: `/api/v1/payments/checkout-status?bookingId=${bookingId}`,
      headers: { authorization: `Bearer ${traveller.accessToken}` }
    });
    expect(statusRes.statusCode).toBe(200);
    const checkoutStatus = JSON.parse(statusRes.body).data;
    expect(checkoutStatus.bookingStatus).toBe("CONFIRMED");
    expect(checkoutStatus.custodyReady).toBe(true);

    const detailRes = await app.inject({
      method: "GET",
      url: `/api/v1/bookings/${bookingId}`,
      headers: { authorization: `Bearer ${traveller.accessToken}` }
    });
    const confirmedDetail = JSON.parse(detailRes.body).data;
    expect(confirmedDetail.location.addressDisclosed).toBe(true);
    expect(confirmedDetail.location.addressLine1).toBe("99 Rampart Street Secret Door");

    // Issue pass #1 then regenerate pass #2
    const pass1Res = await app.inject({
      method: "POST",
      url: `/api/v1/bookings/${bookingId}/custody-pass`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { operation: "CHECK_IN" }
    });
    expect(pass1Res.statusCode).toBe(200);
    const pass1 = JSON.parse(pass1Res.body).data;
    expect(pass1.qrToken).toHaveLength(64);
    expect(pass1.verificationPin).toMatch(/^\d{6}$/);

    const pass2Res = await app.inject({
      method: "POST",
      url: `/api/v1/bookings/${bookingId}/custody-pass`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { operation: "CHECK_IN" }
    });
    expect(pass2Res.statusCode).toBe(200);
    const pass2 = JSON.parse(pass2Res.body).data;
    expect(pass2.qrToken).toHaveLength(64);
    expect(pass2.qrToken).not.toBe(pass1.qrToken);

    // Revoked token #1 must fail host counter verification
    const verifyOldRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/custody/verify",
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: { bookingId, operation: "CHECK_IN", qrToken: pass1.qrToken }
    });
    expect(verifyOldRes.statusCode).toBeGreaterThanOrEqual(400);

    // Latest raw qrToken #2 succeeds cleanly at host counter
    const verifyNewRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/custody/verify",
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: { bookingId, operation: "CHECK_IN", qrToken: pass2.qrToken }
    });
    expect(verifyNewRes.statusCode).toBe(200);
    expect(JSON.parse(verifyNewRes.body).data.verified).toBe(true);
  });

  it("enforces <=2h 50% cancellation refund tier, reference search, exception recording (DISPUTED), and BR-095 commission redaction", async () => {
    const { locationId } = await seedActiveHostLocation({ baseRateMinor: 100000 });
    const traveller = await createActiveUser("TRAVELLER", "Refund & Exception Traveller");
    const win = futureColomboWindow(7);

    // Booking A: cancel within <= 2h window -> 50% refund
    const bookARes = await app.inject({
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
    expect(bookARes.statusCode).toBe(201);
    const bookingA = JSON.parse(bookARes.body).data;

    const intentARes = await app.inject({
      method: "POST",
      url: "/api/v1/payments/intents",
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { bookingId: bookingA.id, channel: "WEB" }
    });
    const intentAId = JSON.parse(intentARes.body).data.id as string;
    await app.inject({
      method: "POST",
      url: `/api/v1/payments/intents/${intentAId}/sandbox-simulate`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { outcome: "SUCCEEDED" }
    });

    // Deterministically move drop_off_at to NOW() + 75 minutes so <=2h refund tier applies reliably at all hours
    await migratorPool.query(
      "UPDATE bookings SET drop_off_at = NOW() + interval '75 minutes' WHERE id = $1;",
      [bookingA.id]
    );

    const cancelRes = await app.inject({
      method: "POST",
      url: `/api/v1/bookings/${bookingA.id}/cancel`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { reason: "Flight rescheduled within two hours of check-in" }
    });
    expect(cancelRes.statusCode).toBe(200);
    const cancelledA = JSON.parse(cancelRes.body).data;
    expect(cancelledA.status).toBe("CANCELLED_BY_TRAVELLER");
    expect(cancelledA.refundSummary).toBeTruthy();
    expect(cancelledA.refundSummary.refundPercentage).toBe(50);
    expect(cancelledA.refundSummary.amountMinor).toBe(
      Math.floor((cancelledA.totalAmountMinor * 50) / 100)
    );
    expect(cancelledA.pricingSnapshot.platformCommissionMinor).toBeUndefined();
    expect(cancelledA.pricingSnapshot.hostPayableMinor).toBeUndefined();

    // Booking B: search filter + traveller exception -> DISPUTED
    const bookBRes = await app.inject({
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
    expect(bookBRes.statusCode).toBe(201);
    const bookingB = JSON.parse(bookBRes.body).data;

    const intentBRes = await app.inject({
      method: "POST",
      url: "/api/v1/payments/intents",
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { bookingId: bookingB.id, channel: "WEB" }
    });
    const intentBId = JSON.parse(intentBRes.body).data.id as string;
    await app.inject({
      method: "POST",
      url: `/api/v1/payments/intents/${intentBId}/sandbox-simulate`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { outcome: "SUCCEEDED" }
    });

    const listSearchRes = await app.inject({
      method: "GET",
      url: `/api/v1/bookings?search=${encodeURIComponent(bookingB.referenceCode)}`,
      headers: { authorization: `Bearer ${traveller.accessToken}` }
    });
    expect(listSearchRes.statusCode).toBe(200);
    const searchedRows = JSON.parse(listSearchRes.body).data as Array<{ id: string }>;
    expect(searchedRows.map((r) => r.id)).toEqual([bookingB.id]);

    const exReportRes = await app.inject({
      method: "POST",
      url: `/api/v1/bookings/${bookingB.id}/exceptions`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: {
        category: "DAMAGE_REPORTED",
        reason: "Zipper handle scuffed on suitcase transfer at counter"
      }
    });
    expect(exReportRes.statusCode).toBe(200);
    const disputedB = JSON.parse(exReportRes.body).data;
    expect(disputedB.status).toBe("DISPUTED");
    expect(disputedB.exceptionReason).toBe(
      "[DAMAGE_REPORTED] Zipper handle scuffed on suitcase transfer at counter"
    );
    expect(disputedB.pricingSnapshot.platformCommissionMinor).toBeUndefined();
    expect(disputedB.pricingSnapshot.hostPayableMinor).toBeUndefined();
  });
});
