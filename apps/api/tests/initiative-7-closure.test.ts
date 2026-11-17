import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import { summarizeOpeningHours } from "@luggage-storage/contracts";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { rateLimitService } from "../src/modules/auth/rate-limit.service.js";

const { Pool } = pg;

describe("Initiative 7 — WS-7.1 Data Integrity & WS-7.2 Identity Profile", () => {
  let app: FastifyInstance;
  let migratorPool: pg.Pool;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    migratorPool = new Pool({
      connectionString: env.MIGRATION_DATABASE_URL,
      max: 3
    });
  });

  beforeEach(async () => {
    await rateLimitService.clearAll();
  });

  afterAll(async () => {
    await app.close();
    await migratorPool.end();
  });

  async function registerAndActivateUser(
    roleCode: "TRAVELLER" | "HOST_OWNER" | "SUPPORT" | "SUPERADMIN" = "TRAVELLER",
    displayName = "Initiative 7 User"
  ) {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const email = `init7_${unique}@example.com`;
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
      password,
      displayName,
      accessToken: JSON.parse(loginRes.body).data.accessToken as string
    };
  }

  it("1. summarizeOpeningHours distinguishes unconfigured, partial, closed, 24h, and configured schedules without inventing 08:00-20:00", () => {
    expect(summarizeOpeningHours([])).toEqual({
      is24Hours: false,
      operatingHoursStatus: "UNCONFIGURED",
      operatingHoursSummary: null
    });

    const fullStandard = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i + 1,
      openTime: "09:00:00",
      closeTime: "18:00:00",
      isClosed: false
    }));
    expect(summarizeOpeningHours(fullStandard)).toEqual({
      is24Hours: false,
      operatingHoursStatus: "CONFIGURED",
      operatingHoursSummary: "09:00 - 18:00"
    });

    const mixedDays = fullStandard.map((d, idx) =>
      idx === 6 ? { ...d, openTime: "10:00:00", closeTime: "16:00:00" } : d
    );
    expect(summarizeOpeningHours(mixedDays)).toEqual({
      is24Hours: false,
      operatingHoursStatus: "CONFIGURED",
      operatingHoursSummary: "09:00 - 18:00 (Varies by day)"
    });

    const full24h = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i + 1,
      openTime: "00:00:00",
      closeTime: "23:59:59",
      isClosed: false
    }));
    expect(summarizeOpeningHours(full24h)).toEqual({
      is24Hours: true,
      operatingHoursStatus: "OPEN_24_HOURS",
      operatingHoursSummary: "24/7 Open"
    });

    const allClosed = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i + 1,
      openTime: "00:00:00",
      closeTime: "00:00:00",
      isClosed: true
    }));
    expect(summarizeOpeningHours(allClosed)).toEqual({
      is24Hours: false,
      operatingHoursStatus: "CLOSED",
      operatingHoursSummary: "Closed"
    });

    const partial = [
      { dayOfWeek: 1, openTime: "08:30:00", closeTime: "17:30:00", isClosed: false },
      { dayOfWeek: 2, openTime: "08:30:00", closeTime: "17:30:00", isClosed: false }
    ];
    expect(summarizeOpeningHours(partial)).toEqual({
      is24Hours: false,
      operatingHoursStatus: "PARTIAL",
      operatingHoursSummary: "08:30 - 17:30 (Partial schedule)"
    });
  });

  it("2. discovery & availability reject fabricated 08:00-20:00 fallback when opening_hours rows are absent", async () => {
    const owner = await registerAndActivateUser("HOST_OWNER", "Schedule Audit Host");

    const bizRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/businesses",
      headers: { Authorization: `Bearer ${owner.accessToken}` },
      payload: {
        legalBusinessName: `Schedule Test Biz ${Date.now()}`,
        tradeName: "Schedule Test Locker",
        businessRegistrationNumber: `BRN-I7-${Date.now()}`,
        taxIdentificationNumber: "TIN-I7-001",
        contactEmail: owner.email,
        contactPhone: "+94771234567"
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
      headers: { Authorization: `Bearer ${owner.accessToken}` },
      payload: {
        businessId,
        name: `Unconfigured Hours Hub ${Date.now()}`,
        addressLine1: "42 Station Road",
        city: "Galle",
        countryCode: "LK",
        latitude: 6.0535,
        longitude: 80.221,
        timezone: "Asia/Colombo",
        bookingMode: "INSTANT",
        acceptsOversized: true
      }
    });
    expect(locRes.statusCode).toBe(201);
    const locationId = JSON.parse(locRes.body).data.id as string;

    // Configure zone, capacity pool, and pricing via API, then remove opening_hours rows directly
    const zoneRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/locations/${locationId}/zones`,
      headers: { Authorization: `Bearer ${owner.accessToken}` },
      payload: { name: "Vault A", zoneType: "LOCKER" }
    });
    expect(zoneRes.statusCode).toBe(201);
    const zoneId = JSON.parse(zoneRes.body).data.id as string;

    const poolsRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/locations/${locationId}/capacity-pools`,
      headers: { Authorization: `Bearer ${owner.accessToken}` }
    });
    expect(poolsRes.statusCode).toBe(200);
    const pools = JSON.parse(poolsRes.body).data.pools as Array<{ id: string }>;

    const capRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/hosts/capacity-pools/${pools[0].id}`,
      headers: { Authorization: `Bearer ${owner.accessToken}` },
      payload: { zoneId, totalUnits: 10, isActive: true }
    });
    expect(capRes.statusCode).toBe(200);

    const priceRes = await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/pricing`,
      headers: { Authorization: `Bearer ${owner.accessToken}` },
      payload: {
        currency: "LKR",
        pricingUnit: "CALENDAR_DAY",
        baseRateMinor: 100000
      }
    });
    expect(priceRes.statusCode).toBe(200);

    await migratorPool.query("DELETE FROM opening_hours WHERE location_id = $1;", [locationId]);
    await migratorPool.query(
      "UPDATE storage_locations SET status = 'ACTIVE' WHERE id = $1;",
      [locationId]
    );

    try {
      const searchRes = await app.inject({
        method: "GET",
        url: "/api/v1/discovery/locations?city=Galle&limit=50"
      });
      expect(searchRes.statusCode).toBe(200);
      const found = (
        JSON.parse(searchRes.body).data.locations as Array<Record<string, unknown>>
      ).find(
        (l) => l.id === locationId
      );
      expect(found).toBeDefined();
      expect(found?.operatingHoursStatus).toBe("UNCONFIGURED");
      expect(found?.operatingHoursSummary).toBeNull();
      expect(found?.is24Hours).toBe(false);

      const detailRes = await app.inject({
        method: "GET",
        url: `/api/v1/discovery/locations/${locationId}`
      });
      expect(detailRes.statusCode).toBe(200);
      const detail = JSON.parse(detailRes.body).data;
      expect(detail.operatingHoursStatus).toBe("UNCONFIGURED");
      expect(detail.operatingHoursSummary).toBeNull();
      expect(detail.openingHours).toEqual([]);

      const future = new Date(Date.now() + 5 * 86400_000);
      const yyyy = future.getUTCFullYear();
      const mm = String(future.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(future.getUTCDate()).padStart(2, "0");
      const quoteRes = await app.inject({
        method: "POST",
        url: "/api/v1/bookings/quote",
        payload: {
          locationId,
          dropOffAt: `${yyyy}-${mm}-${dd}T04:30:00.000Z`,
          collectionAt: `${yyyy}-${mm}-${dd}T10:30:00.000Z`,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
        }
      });
      expect(quoteRes.statusCode).toBe(200);
      const quoteData = JSON.parse(quoteRes.body).data;
      expect(quoteData.available).toBe(false);
      expect(quoteData.unavailabilityReason).toContain("Operating hours are not configured");
    } finally {
      await migratorPool.query(
        "UPDATE storage_locations SET status = 'DISABLED' WHERE id = $1;",
        [locationId]
      );
    }
  });

  it("3. support ticket assignment rejects nonexistent, inactive, traveller, and host users, while allowing active SUPPORT/SUPERADMIN", async () => {
    const traveller = await registerAndActivateUser("TRAVELLER", "Ticket Requester");
    const hostOwner = await registerAndActivateUser("HOST_OWNER", "Host Not Support");
    const activeSupport = await registerAndActivateUser("SUPPORT", "Active Support Agent");
    const suspendedSupport = await registerAndActivateUser("SUPPORT", "Suspended Support Agent");
    const superadmin = await registerAndActivateUser("SUPERADMIN", "Active Superadmin");

    await migratorPool.query("UPDATE users SET status = 'SUSPENDED' WHERE id = $1;", [
      suspendedSupport.userId
    ]);

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/support/tickets",
      headers: { Authorization: `Bearer ${traveller.accessToken}` },
      payload: {
        requesterName: traveller.displayName,
        requesterEmail: traveller.email,
        category: "BOOKING_ISSUE",
        subject: "Need help with booking pickup",
        message: "Please verify my drop-off window and locker availability."
      }
    });
    expect(createRes.statusCode).toBe(201);
    const ticketId = JSON.parse(createRes.body).data.id as string;

    // 1) Nonexistent UUID -> 404
    const missingRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/support/tickets/${ticketId}`,
      headers: { Authorization: `Bearer ${activeSupport.accessToken}` },
      payload: { assignedToUserId: "00000000-0000-4000-8000-000000000099" }
    });
    expect(missingRes.statusCode).toBe(404);

    // 2) Ordinary TRAVELLER -> 400
    const travellerAssignRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/support/tickets/${ticketId}`,
      headers: { Authorization: `Bearer ${activeSupport.accessToken}` },
      payload: { assignedToUserId: traveller.userId }
    });
    expect(travellerAssignRes.statusCode).toBe(400);

    // 3) HOST_OWNER without support role -> 400
    const hostAssignRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/support/tickets/${ticketId}`,
      headers: { Authorization: `Bearer ${activeSupport.accessToken}` },
      payload: { assignedToUserId: hostOwner.userId }
    });
    expect(hostAssignRes.statusCode).toBe(400);

    // 4) Suspended SUPPORT -> 400
    const suspendedAssignRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/support/tickets/${ticketId}`,
      headers: { Authorization: `Bearer ${activeSupport.accessToken}` },
      payload: { assignedToUserId: suspendedSupport.userId }
    });
    expect(suspendedAssignRes.statusCode).toBe(400);

    // 5) Unauthorized TRAVELLER caller -> 403
    const unauthCallerRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/support/tickets/${ticketId}`,
      headers: { Authorization: `Bearer ${traveller.accessToken}` },
      payload: { assignedToUserId: activeSupport.userId }
    });
    expect(unauthCallerRes.statusCode).toBe(403);

    // 6) Active SUPPORT assignee -> 200
    const validSupportRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/support/tickets/${ticketId}`,
      headers: { Authorization: `Bearer ${activeSupport.accessToken}` },
      payload: { assignedToUserId: activeSupport.userId, status: "IN_PROGRESS" }
    });
    expect(validSupportRes.statusCode).toBe(200);
    expect(JSON.parse(validSupportRes.body).data.assignedToUserId).toBe(activeSupport.userId);

    // 7) Active SUPERADMIN assignee -> 200
    const validAdminRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/support/tickets/${ticketId}`,
      headers: { Authorization: `Bearer ${superadmin.accessToken}` },
      payload: { assignedToUserId: superadmin.userId }
    });
    expect(validAdminRes.statusCode).toBe(200);
    expect(JSON.parse(validAdminRes.body).data.assignedToUserId).toBe(superadmin.userId);

    // 8) Clear assignment (null) -> 200
    const unassignRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/support/tickets/${ticketId}`,
      headers: { Authorization: `Bearer ${activeSupport.accessToken}` },
      payload: { assignedToUserId: null }
    });
    expect(unassignRes.statusCode).toBe(200);
    expect(JSON.parse(unassignRes.body).data.assignedToUserId).toBeNull();
  });

  it("4. GET and PATCH /api/v1/identity/profile persist allowed fields and reject mass assignment / unauthenticated calls", async () => {
    const unauthGet = await app.inject({ method: "GET", url: "/api/v1/identity/profile" });
    expect(unauthGet.statusCode).toBe(401);

    const unauthPatch = await app.inject({
      method: "PATCH",
      url: "/api/v1/identity/profile",
      payload: { displayName: "Hacker" }
    });
    expect(unauthPatch.statusCode).toBe(401);

    const user = await registerAndActivateUser("TRAVELLER", "Initial Traveller Name");
    const otherUser = await registerAndActivateUser("TRAVELLER", "Other Traveller");

    const getRes1 = await app.inject({
      method: "GET",
      url: "/api/v1/identity/profile",
      headers: { Authorization: `Bearer ${user.accessToken}` }
    });
    expect(getRes1.statusCode).toBe(200);
    const p1 = JSON.parse(getRes1.body).data.profile;
    expect(p1.id).toBe(user.userId);
    expect(p1.displayName).toBe("Initial Traveller Name");
    expect(p1.travellerProfile).toBeNull();

    // Valid update
    const patchRes = await app.inject({
      method: "PATCH",
      url: "/api/v1/identity/profile",
      headers: { Authorization: `Bearer ${user.accessToken}` },
      payload: {
        displayName: "Kasun Perera",
        phoneNumber: "+94771234567",
        traveller: {
          firstName: "Kasun",
          lastName: "Perera",
          preferredLanguage: "en-LK",
          preferredCurrency: "LKR",
          emergencyContactName: "Nimali Perera",
          emergencyContactPhone: "+94777654321"
        }
      }
    });
    expect(patchRes.statusCode).toBe(200);
    const updated = JSON.parse(patchRes.body).data.profile;
    expect(updated.displayName).toBe("Kasun Perera");
    expect(updated.phoneNumber).toBe("+94771234567");
    expect(updated.travellerProfile.firstName).toBe("Kasun");
    expect(updated.travellerProfile.lastName).toBe("Perera");
    expect(updated.travellerProfile.preferredLanguage).toBe("en-LK");
    expect(updated.travellerProfile.emergencyContactName).toBe("Nimali Perera");
    expect(updated.travellerProfile.emergencyContactPhone).toBe("+94777654321");

    // Verify persistence on fresh GET
    const getRes2 = await app.inject({
      method: "GET",
      url: "/api/v1/identity/profile",
      headers: { Authorization: `Bearer ${user.accessToken}` }
    });
    expect(getRes2.statusCode).toBe(200);
    expect(JSON.parse(getRes2.body).data.profile.travellerProfile.emergencyContactPhone).toBe(
      "+94777654321"
    );

    // Reject mass-assignment attempts (roles, status, userId)
    const massAssignRes = await app.inject({
      method: "PATCH",
      url: "/api/v1/identity/profile",
      headers: { Authorization: `Bearer ${user.accessToken}` },
      payload: {
        displayName: "Should Not Apply",
        roles: ["SUPERADMIN"],
        status: "SUSPENDED"
      }
    });
    expect(massAssignRes.statusCode).toBe(400);

    const targetIdRes = await app.inject({
      method: "PATCH",
      url: "/api/v1/identity/profile",
      headers: { Authorization: `Bearer ${user.accessToken}` },
      payload: {
        id: otherUser.userId,
        displayName: "Overwrite Other"
      }
    });
    expect(targetIdRes.statusCode).toBe(400);

    // Verify invalid emergency phone format fails
    const badPhoneRes = await app.inject({
      method: "PATCH",
      url: "/api/v1/identity/profile",
      headers: { Authorization: `Bearer ${user.accessToken}` },
      payload: {
        traveller: { emergencyContactPhone: "not-a-phone" }
      }
    });
    expect(badPhoneRes.statusCode).toBe(400);

    // Verify audit log recorded IDENTITY_PROFILE_UPDATED
    const auditRes = await migratorPool.query(
      "SELECT event_type FROM security_audit_events WHERE user_id = $1 AND event_type = 'IDENTITY_PROFILE_UPDATED';",
      [user.userId]
    );
    expect(auditRes.rows.length).toBeGreaterThanOrEqual(1);
  });
});
