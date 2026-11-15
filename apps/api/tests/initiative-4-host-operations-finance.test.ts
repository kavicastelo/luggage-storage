import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { rateLimitService } from "../src/modules/auth/rate-limit.service.js";

const { Pool } = pg;

describe("Initiative 4 — Host Counter Custody, Bookings Desk & Owner Finance", () => {
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

  async function registerAndActivateUser(
    roleCode: "TRAVELLER" | "HOST_OWNER" | "SUPERADMIN" = "TRAVELLER",
    displayName = "Initiative 4 User"
  ) {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const email = `init4_${unique}@example.com`;
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
      accessToken: JSON.parse(loginRes.body).data.accessToken as string
    };
  }

  async function loginUser(email: string, password: string) {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password, clientType: "WEB" }
    });
    expect(loginRes.statusCode).toBe(200);
    return JSON.parse(loginRes.body).data.accessToken as string;
  }

  async function setupActiveLocation(
    bookingMode: "INSTANT" | "HOST_APPROVAL" = "INSTANT",
    locationName = "Galle Fort Luggage Locker"
  ) {
    const owner = await registerAndActivateUser("HOST_OWNER", "Initiative 4 Owner");
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const bizRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/businesses",
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        legalBusinessName: `Initiative 4 Holdings ${uniqueSuffix}`,
        tradeName: `Initiative 4 Concierge ${uniqueSuffix}`,
        entityType: "PRIVATE_LIMITED",
        contactEmail: `biz_${uniqueSuffix}@example.com`,
        contactPhone: "+94771239999",
        city: "Galle"
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
        name: `${locationName} ${uniqueSuffix}`,
        description: "Secure indoor storage room with digital custody tracking",
        addressLine1: "18 Pedlar Street, Fort",
        city: "Galle",
        postalCode: "80000",
        latitude: 6.0267,
        longitude: 80.217,
        timezone: "Asia/Colombo",
        bookingMode,
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
      payload: {
        name: "Vault Rack North",
        zoneType: "LOCKER"
      }
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
      payload: { zoneId, totalUnits: 20, isActive: true }
    });
    expect(capRes.statusCode).toBe(200);

    const priceRes = await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/pricing`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
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

    // Secondary sibling location for unassigned-staff scoping tests
    const siblingLocRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/locations",
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        businessId,
        name: `Unawatuna Beach Annex ${uniqueSuffix}`,
        addressLine1: "45 Yaddehimulla Rd",
        city: "Galle",
        latitude: 6.0094,
        longitude: 80.2496,
        timezone: "Asia/Colombo",
        bookingMode: "INSTANT",
        acceptsOversized: true
      }
    });
    expect(siblingLocRes.statusCode).toBe(201);
    const siblingLocationId = JSON.parse(siblingLocRes.body).data.id as string;

    await migratorPool.query(
      "UPDATE storage_locations SET status = 'ACTIVE' WHERE id IN ($1, $2);",
      [locationId, siblingLocationId]
    );

    return { owner, businessId, locationId, siblingLocationId, zoneId };
  }

  async function assignStaffMember(
    ownerToken: string,
    businessId: string,
    assignedLocationIds: string[],
    displayName: string
  ) {
    const user = await registerAndActivateUser("TRAVELLER", displayName);
    const assignRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/businesses/${businessId}/staff`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        email: user.email,
        staffRole: "ATTENDANT",
        assignedLocationIds
      }
    });
    expect(assignRes.statusCode).toBe(201);
    const accessToken = await loginUser(user.email, user.password);
    return { ...user, accessToken };
  }

  async function createAndConfirmBooking(
    travellerToken: string,
    locationId: string,
    bagCount = 2,
    daysAhead = 4
  ) {
    const win = futureColomboWindow(daysAhead);
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/bookings",
      headers: { authorization: `Bearer ${travellerToken}` },
      payload: {
        locationId,
        dropOffAt: win.dropOffAt,
        collectionAt: win.collectionAt,
        items: [{ bagCategory: "BAG_MEDIUM", quantity: bagCount }]
      }
    });
    expect(createRes.statusCode).toBe(201);
    const booking = JSON.parse(createRes.body).data as {
      id: string;
      referenceCode: string;
      status: string;
    };

    const intentRes = await app.inject({
      method: "POST",
      url: "/api/v1/payments/intents",
      headers: { authorization: `Bearer ${travellerToken}` },
      payload: { bookingId: booking.id }
    });
    expect(intentRes.statusCode).toBe(201);
    const intent = JSON.parse(intentRes.body).data as { id: string };

    const payRes = await app.inject({
      method: "POST",
      url: `/api/v1/payments/intents/${intent.id}/sandbox-simulate`,
      headers: { authorization: `Bearer ${travellerToken}` },
      payload: { outcome: "SUCCEEDED" }
    });
    expect(payRes.statusCode).toBe(200);

    return booking;
  }

  it("1. enforces host bookings filtering, HOST_APPROVAL accept/reject, host cancel refund, and OQ-017 snapshot privacy", async () => {
    const { owner, businessId, locationId, siblingLocationId } = await setupActiveLocation(
      "HOST_APPROVAL",
      "Ella Station Lounge"
    );
    const assignedStaff = await assignStaffMember(
      owner.accessToken,
      businessId,
      [locationId],
      "Ella Desk Attendant"
    );
    const unassignedStaff = await assignStaffMember(
      owner.accessToken,
      businessId,
      [siblingLocationId],
      "Unassigned Beach Attendant"
    );
    const traveller = await registerAndActivateUser("TRAVELLER", "Approval Traveller");
    const win = futureColomboWindow(6);

    // Create two HOST_APPROVAL requests + one accepted & paid booking
    const createReq = async (qty: number) => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          locationId,
          dropOffAt: win.dropOffAt,
          collectionAt: win.collectionAt,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: qty }]
        }
      });
      expect(res.statusCode).toBe(201);
      return JSON.parse(res.body).data as { id: string; referenceCode: string; status: string };
    };

    const reqAccept = await createReq(1);
    const reqReject = await createReq(1);
    const reqPaidCancel = await createReq(1);
    expect(reqAccept.status).toBe("PENDING_HOST_APPROVAL");

    // Assigned HOST_STAFF sees bookings filtered by referenceCode and status
    const searchRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/bookings?locationId=${locationId}&status=PENDING_HOST_APPROVAL&search=${encodeURIComponent(reqAccept.referenceCode)}`,
      headers: { authorization: `Bearer ${assignedStaff.accessToken}` }
    });
    expect(searchRes.statusCode).toBe(200);
    const searchData = JSON.parse(searchRes.body).data as Array<{ id: string }>;
    expect(searchData.map((b) => b.id)).toEqual([reqAccept.id]);

    // Unassigned staff requesting locationId outside assignment gets 403
    const deniedFilterRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/bookings?locationId=${locationId}`,
      headers: { authorization: `Bearer ${unassignedStaff.accessToken}` }
    });
    expect(deniedFilterRes.statusCode).toBe(403);

    // OQ-017: HOST_OWNER sees pricing commission/payable fields; HOST_STAFF has them omitted
    const ownerDetailRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/bookings/${reqAccept.id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(ownerDetailRes.statusCode).toBe(200);
    const ownerSnapshot = JSON.parse(ownerDetailRes.body).data.pricingSnapshot;
    expect(ownerSnapshot.commissionRateBps).toBe(1500);
    expect(ownerSnapshot.platformCommissionMinor).toBeGreaterThan(0);
    expect(ownerSnapshot.hostPayableMinor).toBeGreaterThan(0);

    const staffDetailRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/bookings/${reqAccept.id}`,
      headers: { authorization: `Bearer ${assignedStaff.accessToken}` }
    });
    expect(staffDetailRes.statusCode).toBe(200);
    const staffSnapshot = JSON.parse(staffDetailRes.body).data.pricingSnapshot;
    expect(staffSnapshot.commissionRateBps).toBeUndefined();
    expect(staffSnapshot.platformCommissionMinor).toBeUndefined();
    expect(staffSnapshot.hostPayableMinor).toBeUndefined();

    // Accept first request -> PENDING_PAYMENT
    const acceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/bookings/${reqAccept.id}/accept`,
      headers: { authorization: `Bearer ${assignedStaff.accessToken}` },
      payload: { reason: "Space verified in Rack North" }
    });
    expect(acceptRes.statusCode).toBe(200);
    expect(JSON.parse(acceptRes.body).data.status).toBe("PENDING_PAYMENT");

    // Reject second request -> REJECTED
    const rejectRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/bookings/${reqReject.id}/reject`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { reason: "Scheduled locker maintenance during afternoon window" }
    });
    expect(rejectRes.statusCode).toBe(200);
    expect(JSON.parse(rejectRes.body).data.status).toBe("REJECTED");

    // Accept, pay, and then host-cancel third booking -> CANCELLED_BY_HOST with 100% refund
    const acceptPaidRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/bookings/${reqPaidCancel.id}/accept`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {}
    });
    expect(acceptPaidRes.statusCode).toBe(200);

    const intentRes = await app.inject({
      method: "POST",
      url: "/api/v1/payments/intents",
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { bookingId: reqPaidCancel.id }
    });
    expect(intentRes.statusCode).toBe(201);
    const intentId = JSON.parse(intentRes.body).data.id as string;

    await app.inject({
      method: "POST",
      url: `/api/v1/payments/intents/${intentId}/sandbox-simulate`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { outcome: "SUCCEEDED" }
    });

    const hostCancelRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/bookings/${reqPaidCancel.id}/cancel`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { reason: "Emergency pipe repair near storage room" }
    });
    expect(hostCancelRes.statusCode).toBe(200);
    const cancelledData = JSON.parse(hostCancelRes.body).data;
    expect(cancelledData.status).toBe("CANCELLED_BY_HOST");
    expect(cancelledData.refundSummary.refundPercentage).toBe(100);
  });

  it("2. enforces CUSTODY_EVIDENCE upload scoping, signed download protection, non-consuming verify, duplicate bag tag guard (AC-15), and one-time intent consumption", async () => {
    const { owner, businessId, locationId, siblingLocationId, zoneId } = await setupActiveLocation(
      "INSTANT",
      "Matara Station Hub"
    );
    const assignedStaff = await assignStaffMember(
      owner.accessToken,
      businessId,
      [locationId],
      "Matara Attendant"
    );
    const unassignedStaff = await assignStaffMember(
      owner.accessToken,
      businessId,
      [siblingLocationId],
      "Unassigned Staff"
    );
    const traveller = await registerAndActivateUser("TRAVELLER", "Photo Evidence Traveller");

    const booking1 = await createAndConfirmBooking(traveller.accessToken, locationId, 2, 4);
    const booking2 = await createAndConfirmBooking(traveller.accessToken, locationId, 1, 5);

    const jpegBytes = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9
    ]);

    // Assigned HOST_STAFF cannot initiate HOST_VERIFICATION or LOCATION_IMAGE uploads
    const deniedKycUpload = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/presigned-url",
      headers: { authorization: `Bearer ${assignedStaff.accessToken}` },
      payload: {
        purpose: "HOST_VERIFICATION",
        resourceType: "HOST_BUSINESS",
        resourceId: businessId,
        fileName: "kyc.pdf",
        fileSize: 2048,
        mimeType: "application/pdf"
      }
    });
    expect(deniedKycUpload.statusCode).toBe(403);

    const deniedLocUpload = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/presigned-url",
      headers: { authorization: `Bearer ${assignedStaff.accessToken}` },
      payload: {
        purpose: "LOCATION_IMAGE",
        resourceType: "STORAGE_LOCATION",
        resourceId: locationId,
        fileName: "front.jpg",
        fileSize: jpegBytes.byteLength,
        mimeType: "image/jpeg"
      }
    });
    expect(deniedLocUpload.statusCode).toBe(403);

    // Unassigned HOST_STAFF cannot initiate CUSTODY_EVIDENCE for another location's booking
    const unassignedEvidenceRes = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/presigned-url",
      headers: { authorization: `Bearer ${unassignedStaff.accessToken}` },
      payload: {
        purpose: "CUSTODY_EVIDENCE",
        resourceType: "BOOKING",
        resourceId: booking1.id,
        fileName: "bag-1.jpg",
        fileSize: jpegBytes.byteLength,
        mimeType: "image/jpeg"
      }
    });
    expect(unassignedEvidenceRes.statusCode).toBe(403);

    // Assigned HOST_STAFF initiates CUSTODY_EVIDENCE upload, PUTs binary to mock storage, confirms intent
    const initEvidenceRes = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/presigned-url",
      headers: { authorization: `Bearer ${assignedStaff.accessToken}` },
      payload: {
        purpose: "CUSTODY_EVIDENCE",
        resourceType: "BOOKING",
        resourceId: booking1.id,
        fileName: "bag-intake-1.jpg",
        fileSize: jpegBytes.byteLength,
        mimeType: "image/jpeg"
      }
    });
    expect(initEvidenceRes.statusCode).toBe(200);
    const uploadInit = JSON.parse(initEvidenceRes.body).data as {
      intentId: string;
      uploadUrl: string;
      fileKey: string;
    };
    expect(uploadInit.fileKey.startsWith(`custody/${booking1.id}/`)).toBe(true);

    const putParsed = new URL(uploadInit.uploadUrl, "http://localhost");
    const putRes = await app.inject({
      method: "PUT",
      url: `${putParsed.pathname}${putParsed.search}`,
      headers: { "content-type": "image/jpeg" },
      payload: jpegBytes
    });
    expect(putRes.statusCode).toBe(200);

    // Unsigned mock-storage GET on custody/ prefix MUST return 403
    const unsignedGetRes = await app.inject({
      method: "GET",
      url: putParsed.pathname
    });
    expect(unsignedGetRes.statusCode).toBe(403);

    const confirmRes = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/confirm",
      headers: { authorization: `Bearer ${assignedStaff.accessToken}` },
      payload: {
        intentId: uploadInit.intentId,
        fileKey: uploadInit.fileKey,
        purpose: "CUSTODY_EVIDENCE",
        resourceType: "BOOKING",
        resourceId: booking1.id
      }
    });
    expect(confirmRes.statusCode).toBe(200);

    // Traveller issues CHECK_IN custody pass
    const passRes = await app.inject({
      method: "POST",
      url: `/api/v1/bookings/${booking1.id}/custody-pass`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { operation: "CHECK_IN" }
    });
    expect(passRes.statusCode).toBe(200);
    const pass = JSON.parse(passRes.body).data as {
      qrToken: string;
      verificationPin: string;
    };

    // Counter pre-verify succeeds WITHOUT consuming the single-use pass
    const preVerifyRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/custody/verify",
      headers: { authorization: `Bearer ${assignedStaff.accessToken}` },
      payload: {
        bookingId: booking1.id,
        operation: "CHECK_IN",
        qrToken: pass.qrToken
      }
    });
    expect(preVerifyRes.statusCode).toBe(200);
    expect(JSON.parse(preVerifyRes.body).data.verified).toBe(true);

    // AC-15: Duplicate bagTagCode (case-insensitive) fails with 400 and preserves pass/upload intent
    const dupCheckInRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/custody/${booking1.id}/check-in`,
      headers: { authorization: `Bearer ${assignedStaff.accessToken}` },
      payload: {
        qrToken: pass.qrToken,
        zoneId,
        bags: [
          {
            bagTagCode: "DUP-TAG-01",
            bagCategory: "BAG_MEDIUM",
            securitySealNumber: "SEAL-01",
            photoFileKey: uploadInit.fileKey
          },
          {
            bagTagCode: "dup-tag-01",
            bagCategory: "BAG_MEDIUM",
            securitySealNumber: "SEAL-02"
          }
        ]
      }
    });
    expect(dupCheckInRes.statusCode).toBe(400);

    // Retry with distinct bagTagCodes -> 200 IN_STORAGE
    const okCheckInRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/custody/${booking1.id}/check-in`,
      headers: { authorization: `Bearer ${assignedStaff.accessToken}` },
      payload: {
        qrToken: pass.qrToken,
        zoneId,
        bags: [
          {
            bagTagCode: "MTR-TAG-01",
            bagCategory: "BAG_MEDIUM",
            securitySealNumber: "SEAL-101",
            photoFileKey: uploadInit.fileKey
          },
          {
            bagTagCode: "MTR-TAG-02",
            bagCategory: "BAG_MEDIUM",
            securitySealNumber: "SEAL-102"
          }
        ]
      }
    });
    expect(okCheckInRes.statusCode).toBe(200);
    expect(JSON.parse(okCheckInRes.body).data.status).toBe("IN_STORAGE");

    // Fetch custody detail and verify signed photoDownloadUrl streams exact uploaded bytes
    const custodyDetailRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/custody/${booking1.id}`,
      headers: { authorization: `Bearer ${assignedStaff.accessToken}` }
    });
    expect(custodyDetailRes.statusCode).toBe(200);
    const custodyDetail = JSON.parse(custodyDetailRes.body).data as {
      bags: Array<{ bagTagCode: string; photoDownloadUrl: string | null }>;
    };
    const taggedBag1 = custodyDetail.bags.find((b) => b.bagTagCode === "MTR-TAG-01");
    expect(taggedBag1?.photoDownloadUrl).toContain("token=mock-read-token");

    const signedDownloadUrl = new URL(taggedBag1!.photoDownloadUrl!, "http://localhost");
    const signedDownloadRes = await app.inject({
      method: "GET",
      url: `${signedDownloadUrl.pathname}${signedDownloadUrl.search}`
    });
    expect(signedDownloadRes.statusCode).toBe(200);
    expect(Buffer.from(signedDownloadRes.rawPayload).equals(jpegBytes)).toBe(true);

    // Consumed photoFileKey cannot be reused on booking2
    const pass2Res = await app.inject({
      method: "POST",
      url: `/api/v1/bookings/${booking2.id}/custody-pass`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { operation: "CHECK_IN" }
    });
    const pass2 = JSON.parse(pass2Res.body).data as { verificationPin: string };

    const reusePhotoRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/custody/${booking2.id}/check-in`,
      headers: { authorization: `Bearer ${assignedStaff.accessToken}` },
      payload: {
        verificationPin: pass2.verificationPin,
        zoneId,
        bags: [
          {
            bagTagCode: "MTR-REUSE-01",
            bagCategory: "BAG_MEDIUM",
            photoFileKey: uploadInit.fileKey
          }
        ]
      }
    });
    expect(reusePhotoRes.statusCode).toBe(400);
  });

  it("3. enforces OQ-015 Zero Possessory Lien, whitespace exceptionNotes normalization, DISPUTED exception ON_HOLD payable, and balanced double-entry ledger (DI-01 / AC-16 / VRF-10)", async () => {
    const { owner, locationId, zoneId } = await setupActiveLocation(
      "INSTANT",
      "Anuradhapura Transit Vault"
    );
    const traveller = await registerAndActivateUser("TRAVELLER", "Collection Traveller");
    const superadmin = await registerAndActivateUser("SUPERADMIN", "Finance Auditor");

    const bOverdue = await createAndConfirmBooking(traveller.accessToken, locationId, 2, 3);
    const bDisputeCheckOut = await createAndConfirmBooking(traveller.accessToken, locationId, 2, 4);
    const bException = await createAndConfirmBooking(traveller.accessToken, locationId, 1, 5);

    const checkInBooking = async (bookingId: string, bagCount: number, prefix: string) => {
      const pRes = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${bookingId}/custody-pass`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { operation: "CHECK_IN" }
      });
      expect(pRes.statusCode).toBe(200);
      const pass = JSON.parse(pRes.body).data as { verificationPin: string };
      const bags = Array.from({ length: bagCount }, (_, i) => ({
        bagTagCode: `${prefix}-${i + 1}`,
        bagCategory: "BAG_MEDIUM" as const
      }));
      const ciRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/custody/${bookingId}/check-in`,
        headers: { authorization: `Bearer ${owner.accessToken}` },
        payload: {
          verificationPin: pass.verificationPin,
          zoneId,
          bags
        }
      });
      expect(ciRes.statusCode).toBe(200);
    };

    await checkInBooking(bOverdue.id, 2, "ANU-OVR");
    await checkInBooking(bDisputeCheckOut.id, 2, "ANU-DSP");
    await checkInBooking(bException.id, 1, "ANU-EXC");

    // Simulate overdue pickup window (>30m grace period) for bOverdue
    await migratorPool.query(
      `UPDATE bookings
       SET drop_off_at = NOW() - INTERVAL '10 hours',
           collection_at = NOW() - INTERVAL '4 hours'
       WHERE id = $1;`,
      [bOverdue.id]
    );

    const collPass1Res = await app.inject({
      method: "POST",
      url: `/api/v1/bookings/${bOverdue.id}/custody-pass`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { operation: "COLLECTION" }
    });
    expect(collPass1Res.statusCode).toBe(200);
    const collPass1 = JSON.parse(collPass1Res.body).data as { verificationPin: string };

    // Clean check-out with whitespace-only exceptionNotes MUST release luggage & mark COMPLETED + ELIGIBLE
    const cleanOverdueOut = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/custody/${bOverdue.id}/check-out`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        verificationPin: collPass1.verificationPin,
        releasedBagCount: 2,
        exceptionNotes: "   "
      }
    });
    expect(cleanOverdueOut.statusCode).toBe(200);
    expect(JSON.parse(cleanOverdueOut.body).data.status).toBe("RELEASED_TO_TRAVELLER");

    const overdueBookingAfterRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/bookings/${bOverdue.id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(overdueBookingAfterRes.statusCode).toBe(200);
    expect(JSON.parse(overdueBookingAfterRes.body).data.status).toBe("COMPLETED");

    const overdueCustodyRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/custody/${bOverdue.id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    const overdueCustody = JSON.parse(overdueCustodyRes.body).data;
    expect(overdueCustody.status).toBe("RELEASED_TO_TRAVELLER");
    expect(overdueCustody.overdueMinutes).toBeGreaterThan(0);
    expect(overdueCustody.handoverCondition).toBe("UNPAID_FEES_PENDING");
    expect(overdueCustody.exceptionNotes).toBeNull();

    // Disputed collection release -> DISPUTED + DISPUTED_RELEASE + ON_HOLD payable
    const collPass2Res = await app.inject({
      method: "POST",
      url: `/api/v1/bookings/${bDisputeCheckOut.id}/custody-pass`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { operation: "COLLECTION" }
    });
    const collPass2 = JSON.parse(collPass2Res.body).data as { qrToken: string };

    const disputedOutRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/custody/${bDisputeCheckOut.id}/check-out`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        qrToken: collPass2.qrToken,
        releasedBagCount: 1,
        exceptionNotes: "Only 1 bag collected; handle zipper tear reported"
      }
    });
    expect(disputedOutRes.statusCode).toBe(200);
    expect(JSON.parse(disputedOutRes.body).data.status).toBe("DISPUTED_RELEASE");

    const disputeBookingAfterRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/bookings/${bDisputeCheckOut.id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(disputeBookingAfterRes.statusCode).toBe(200);
    expect(JSON.parse(disputeBookingAfterRes.body).data.status).toBe("DISPUTED");

    const disputedCustodyRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/custody/${bDisputeCheckOut.id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(JSON.parse(disputedCustodyRes.body).data.status).toBe("DISPUTED_RELEASE");

    // Operational exception recorded while in storage -> DISPUTED, forcing ON_HOLD payable on collection
    const exceptionRes = await app.inject({
      method: "POST",
      url: `/api/v1/bookings/${bException.id}/exceptions`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        category: "DAMAGE_REPORTED",
        reason: "Minor water spill near locker base prior to pickup"
      }
    });
    expect(exceptionRes.statusCode).toBe(200);
    expect(JSON.parse(exceptionRes.body).data.status).toBe("DISPUTED");

    const collPass3Res = await app.inject({
      method: "POST",
      url: `/api/v1/bookings/${bException.id}/custody-pass`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { operation: "COLLECTION" }
    });
    const collPass3 = JSON.parse(collPass3Res.body).data as { verificationPin: string };

    const exceptionReleaseRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/custody/${bException.id}/check-out`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        verificationPin: collPass3.verificationPin,
        releasedBagCount: 1
      }
    });
    expect(exceptionReleaseRes.statusCode).toBe(200);
    expect(JSON.parse(exceptionReleaseRes.body).data.status).toBe("DISPUTED_RELEASE");

    // Verify 85%/15% payables state + balanced double-entry ledger
    const finRes = await app.inject({
      method: "GET",
      url: "/api/v1/hosts/finance/summary",
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(finRes.statusCode).toBe(200);
    const payables = JSON.parse(finRes.body).data.payables as Array<{
      bookingId: string;
      status: string;
      grossSubtotalMinor: number;
      commissionMinor: number;
      netPayableMinor: number;
    }>;
    const pOverdue = payables.find((p) => p.bookingId === bOverdue.id);
    const pDispute = payables.find((p) => p.bookingId === bDisputeCheckOut.id);
    const pExc = payables.find((p) => p.bookingId === bException.id);
    expect(pOverdue?.status).toBe("ELIGIBLE");
    expect(pOverdue!.commissionMinor + pOverdue!.netPayableMinor).toBe(pOverdue!.grossSubtotalMinor);
    expect(pDispute?.status).toBe("ON_HOLD");
    expect(pExc?.status).toBe("ON_HOLD");

    const ledgerRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/finance/ledger",
      headers: { authorization: `Bearer ${superadmin.accessToken}` }
    });
    expect(ledgerRes.statusCode).toBe(200);
    const totals = JSON.parse(ledgerRes.body).data.totals;
    expect(totals.isBalanced).toBe(true);
    expect(totals.totalDebitsMinor).toBe(totals.totalCreditsMinor);
  });

  it("4. enforces OQ-017 financial privacy for HOST_STAFF and updates bank beneficiary details without resetting ACTIVE status", async () => {
    const { owner, businessId, locationId, zoneId } = await setupActiveLocation(
      "INSTANT",
      "Jaffna Central Vault"
    );
    const staff = await assignStaffMember(
      owner.accessToken,
      businessId,
      [locationId],
      "Jaffna Counter Staff"
    );
    const traveller = await registerAndActivateUser("TRAVELLER", "Finance Summary Traveller");

    // One CONFIRMED (not yet checked out -> no payable yet), one COMPLETED (ELIGIBLE), one DISPUTED release (ON_HOLD)
    const confirmedOnlyBooking = await createAndConfirmBooking(traveller.accessToken, locationId, 1, 3);
    const completedBooking = await createAndConfirmBooking(traveller.accessToken, locationId, 1, 4);
    const onHoldBooking = await createAndConfirmBooking(traveller.accessToken, locationId, 1, 5);

    const checkInAndOut = async (bookingId: string, bagTag: string, exceptionNotes?: string) => {
      const ciPassRes = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${bookingId}/custody-pass`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { operation: "CHECK_IN" }
      });
      const ciPin = JSON.parse(ciPassRes.body).data.verificationPin as string;

      await app.inject({
        method: "POST",
        url: `/api/v1/hosts/custody/${bookingId}/check-in`,
        headers: { authorization: `Bearer ${owner.accessToken}` },
        payload: {
          verificationPin: ciPin,
          zoneId,
          bags: [{ bagTagCode: bagTag, bagCategory: "BAG_MEDIUM" }]
        }
      });

      const coPassRes = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${bookingId}/custody-pass`,
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: { operation: "COLLECTION" }
      });
      const coPin = JSON.parse(coPassRes.body).data.verificationPin as string;

      await app.inject({
        method: "POST",
        url: `/api/v1/hosts/custody/${bookingId}/check-out`,
        headers: { authorization: `Bearer ${owner.accessToken}` },
        payload: {
          verificationPin: coPin,
          releasedBagCount: 1,
          ...(exceptionNotes ? { exceptionNotes } : {})
        }
      });
    };

    await checkInAndOut(completedBooking.id, "JAF-BAG-01");
    await checkInAndOut(onHoldBooking.id, "JAF-BAG-02", "Disputed strap condition on release");

    // OQ-017: HOST_STAFF is forbidden from host finance summary AND business payout details
    const staffFinanceRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/finance/summary?businessId=${businessId}`,
      headers: { authorization: `Bearer ${staff.accessToken}` }
    });
    expect(staffFinanceRes.statusCode).toBe(403);

    const staffPayoutRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/businesses/${businessId}/payout-details`,
      headers: { authorization: `Bearer ${staff.accessToken}` }
    });
    expect(staffPayoutRes.statusCode).toBe(403);

    // HOST_OWNER retrieves accurate summary totals across ELIGIBLE + ON_HOLD payables
    const ownerFinRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/finance/summary?businessId=${businessId}`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(ownerFinRes.statusCode).toBe(200);
    const finData = JSON.parse(ownerFinRes.body).data as {
      currency: string;
      totalEligibleMinor: number;
      totalAccruedMinor: number;
      totalOnHoldMinor: number;
      totalPaidMinor: number;
      payables: Array<{ bookingId: string; status: string }>;
    };
    expect(finData.currency).toBe("LKR");
    expect(finData.totalEligibleMinor).toBe(85000);
    expect(finData.totalAccruedMinor).toBe(0);
    expect(finData.totalOnHoldMinor).toBe(85000);
    expect(finData.totalPaidMinor).toBe(0);
    expect(finData.payables.find((p) => p.bookingId === confirmedOnlyBooking.id)).toBeUndefined();
    expect(finData.payables.find((p) => p.bookingId === completedBooking.id)?.status).toBe(
      "ELIGIBLE"
    );
    expect(finData.payables.find((p) => p.bookingId === onHoldBooking.id)?.status).toBe("ON_HOLD");

    // HOST_OWNER updates bank payout details via PATCH without downgrading business ACTIVE status
    const updateBankRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/hosts/businesses/${businessId}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        payoutBankName: "Bank of Ceylon",
        payoutBranchCode: "0018",
        payoutAccountName: "Jaffna Concierge Holdings Pvt Ltd",
        payoutAccountNumber: "8004567890"
      }
    });
    expect(updateBankRes.statusCode).toBe(200);
    expect(JSON.parse(updateBankRes.body).data.status).toBe("ACTIVE");

    const ownerPayoutRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/businesses/${businessId}/payout-details`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(ownerPayoutRes.statusCode).toBe(200);
    const payoutDetails = JSON.parse(ownerPayoutRes.body).data as {
      payoutBankName: string;
      payoutBranchCode: string;
      payoutAccountName: string;
      payoutAccountNumberMasked: string;
    };
    expect(payoutDetails.payoutBankName).toBe("Bank of Ceylon");
    expect(payoutDetails.payoutBranchCode).toBe("0018");
    expect(payoutDetails.payoutAccountName).toBe("Jaffna Concierge Holdings Pvt Ltd");
    expect(payoutDetails.payoutAccountNumberMasked.endsWith("7890")).toBe(true);
  });
});
