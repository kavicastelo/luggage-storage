import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { rateLimitService } from "../src/modules/auth/rate-limit.service.js";

const { Pool } = pg;

describe("Initiative 3 — Host Onboarding, KYC R2 Uploads, Location Sub-Resources & Staff RBAC", () => {
  let app: FastifyInstance;
  let migratorPool: pg.Pool;
  const runSuffix = randomUUID().slice(0, 8);
  let counter = 0;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    migratorPool = new Pool({
      connectionString: env.MIGRATION_DATABASE_URL,
      max: 2
    });
  });

  afterAll(async () => {
    await app.close();
    await migratorPool.end();
  });

  beforeEach(async () => {
    await rateLimitService.clearAll();
  });

  async function createActiveUser(roles: string[], displayName: string) {
    counter += 1;
    const email = `init3_${runSuffix}_${counter}_${Date.now()}@test.luggagestorage.lk`;
    const password = "Init3StrongPassword!2026";

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email,
        password,
        displayName,
        phoneNumber: "+94771234567"
      }
    });
    expect(registerRes.statusCode).toBe(201);
    const userId = JSON.parse(registerRes.body).data.id as string;

    await migratorPool.query(
      "UPDATE users SET status = 'ACTIVE', is_email_verified = true, email_verified_at = NOW() WHERE id = $1;",
      [userId]
    );

    for (const roleCode of roles) {
      await migratorPool.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE code = $2
         ON CONFLICT DO NOTHING;`,
        [userId, roleCode]
      );
    }

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email,
        password,
        clientType: "WEB"
      }
    });
    expect(loginRes.statusCode).toBe(200);
    const body = JSON.parse(loginRes.body).data;
    const refreshCookie = loginRes.cookies.find((c) => c.name === "refresh_token")?.value;
    expect(refreshCookie).toBeTruthy();

    return {
      userId,
      email,
      password,
      accessToken: body.accessToken as string,
      refreshCookie: refreshCookie as string
    };
  }

  function decodeJwtPayload(token: string): { sub: string; roles: string[] } {
    const [, payloadSegment] = token.split(".");
    const json = Buffer.from(payloadSegment, "base64url").toString("utf8");
    return JSON.parse(json);
  }

  it("advertises PUT, PATCH, and DELETE in CORS preflight headers (SEC-10)", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/v1/hosts/locations",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "PUT",
        "access-control-request-headers": "content-type,authorization"
      }
    });

    expect([200, 204]).toContain(res.statusCode);
    const allowMethods = String(res.headers["access-control-allow-methods"] || "");
    expect(allowMethods).toContain("PUT");
    expect(allowMethods).toContain("PATCH");
    expect(allowMethods).toContain("DELETE");
  });

  it("promotes TRAVELLER via business creation + /auth/refresh, handles private KYC R2 PUT without auth, and supports REJECTED KYC re-upload & approval", async () => {
    const applicant = await createActiveUser(["TRAVELLER"], "Colombo Host Applicant");
    const superadmin = await createActiveUser(["SUPERADMIN"], "Platform Reviewer");

    // 1. Traveller creates first host business -> promoted in DB
    const createBizRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/businesses",
      headers: { authorization: `Bearer ${applicant.accessToken}` },
      payload: {
        legalBusinessName: `Lanka Station Lockers Pvt Ltd ${runSuffix}`,
        tradeName: `Fort Bag Drop ${runSuffix}`,
        businessRegistrationNumber: `PV-${runSuffix}`,
        entityType: "PRIVATE_LIMITED",
        contactEmail: applicant.email,
        contactPhone: "+94112345678",
        addressLine1: "42 Olcott Mawatha",
        city: "Colombo",
        countryCode: "LK"
      }
    });
    expect(createBizRes.statusCode).toBe(201);
    const businessId = JSON.parse(createBizRes.body).data.id as string;

    // 2. Refresh cookie issues rotated token containing HOST_OWNER role
    const refreshRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      cookies: { refresh_token: applicant.refreshCookie }
    });
    expect(refreshRes.statusCode).toBe(200);
    const refreshedToken = JSON.parse(refreshRes.body).data.accessToken as string;
    const jwtClaims = decodeJwtPayload(refreshedToken);
    expect(jwtClaims.roles).toContain("HOST_OWNER");

    const listBizRes = await app.inject({
      method: "GET",
      url: "/api/v1/hosts/businesses",
      headers: { authorization: `Bearer ${refreshedToken}` }
    });
    expect(listBizRes.statusCode).toBe(200);
    expect(
      (JSON.parse(listBizRes.body).data.businesses as Array<{ id: string }>).some(
        (b) => b.id === businessId
      )
    ).toBe(true);

    // 3. Initiate KYC PDF upload, PUT raw binary without Authorization header, confirm upload
    const pdfBytes1 = Buffer.from("%PDF-1.4 First BRN Certificate Submission\n%%EOF", "utf8");
    const initRes1 = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/presigned-url",
      headers: { authorization: `Bearer ${refreshedToken}` },
      payload: {
        purpose: "HOST_VERIFICATION",
        resourceId: businessId,
        documentType: "BUSINESS_REGISTRATION",
        fileName: "brn-v1.pdf",
        mimeType: "application/pdf",
        fileSize: pdfBytes1.byteLength
      }
    });
    expect(initRes1.statusCode).toBe(200);
    const initData1 = JSON.parse(initRes1.body).data;
    expect(initData1.publicUrl).toBeUndefined();

    const uploadUrl1 = new URL(initData1.uploadUrl);
    const putRes1 = await app.inject({
      method: "PUT",
      url: `${uploadUrl1.pathname}${uploadUrl1.search}`,
      headers: { "content-type": "application/pdf" },
      payload: pdfBytes1
    });
    expect(putRes1.statusCode).toBe(200);

    const confirmRes1 = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/confirm",
      headers: { authorization: `Bearer ${refreshedToken}` },
      payload: {
        intentId: initData1.intentId,
        fileKey: initData1.fileKey,
        purpose: "HOST_VERIFICATION",
        resourceId: businessId,
        documentType: "BUSINESS_REGISTRATION"
      }
    });
    expect(confirmRes1.statusCode).toBe(200);

    // SEC-10: Private KYC keys must never be readable via /uploads/public/*
    const publicAttemptRes = await app.inject({
      method: "GET",
      url: `/api/v1/uploads/public/${encodeURIComponent(initData1.fileKey)}`
    });
    expect(publicAttemptRes.statusCode).toBe(403);

    // Submit KYC verification package
    const submitVerifRes1 = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/businesses/${businessId}/verification`,
      headers: { authorization: `Bearer ${refreshedToken}` },
      payload: {
        documents: [
          {
            documentType: "BUSINESS_REGISTRATION",
            intentId: initData1.intentId,
            fileKey: initData1.fileKey,
            fileName: "brn-v1.pdf",
            fileSize: pdfBytes1.byteLength,
            mimeType: "application/pdf"
          }
        ]
      }
    });
    expect(submitVerifRes1.statusCode).toBe(201);
    const verif1 = JSON.parse(submitVerifRes1.body).data;
    expect(verif1.status).toBe("PENDING_REVIEW");
    expect(verif1.documents).toHaveLength(1);
    const docId1 = verif1.documents[0].id as string;

    // Authorized owner can request temporary read URL and download exact PDF bytes
    const downloadAuthRes = await app.inject({
      method: "GET",
      url: `/api/v1/uploads/documents/${docId1}/download`,
      headers: { authorization: `Bearer ${refreshedToken}` }
    });
    expect(downloadAuthRes.statusCode).toBe(200);
    const downloadUrl = new URL(JSON.parse(downloadAuthRes.body).data.downloadUrl);
    const downloadBytesRes = await app.inject({
      method: "GET",
      url: `${downloadUrl.pathname}${downloadUrl.search}`
    });
    expect(downloadBytesRes.statusCode).toBe(200);
    expect(downloadBytesRes.rawPayload.equals(pdfBytes1)).toBe(true);

    // 4. Superadmin rejects KYC submission -> host owner re-uploads & resubmits (GAP-017)
    const rejectRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/verifications/${verif1.id}/review`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        decision: "REJECT",
        rejectionReason: "Submitted BRN scan is expired; upload current 2026 certificate."
      }
    });
    expect(rejectRes.statusCode).toBe(200);

    const statusAfterReject = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/businesses/${businessId}/verification`,
      headers: { authorization: `Bearer ${refreshedToken}` }
    });
    expect(statusAfterReject.statusCode).toBe(200);
    const rejectedData = JSON.parse(statusAfterReject.body).data;
    expect(rejectedData.status).toBe("REJECTED");
    expect(rejectedData.rejectionReason).toContain("2026 certificate");

    // Re-upload replacement KYC PDF on REJECTED business
    const pdfBytes2 = Buffer.from("%PDF-1.4 Renewed 2026 BRN Certificate\n%%EOF", "utf8");
    const initRes2 = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/presigned-url",
      headers: { authorization: `Bearer ${refreshedToken}` },
      payload: {
        purpose: "HOST_VERIFICATION",
        resourceId: businessId,
        documentType: "BUSINESS_REGISTRATION",
        fileName: "brn-v2.pdf",
        mimeType: "application/pdf",
        fileSize: pdfBytes2.byteLength
      }
    });
    expect(initRes2.statusCode).toBe(200);
    const initData2 = JSON.parse(initRes2.body).data;

    const uploadUrl2 = new URL(initData2.uploadUrl);
    const putRes2 = await app.inject({
      method: "PUT",
      url: `${uploadUrl2.pathname}${uploadUrl2.search}`,
      headers: { "content-type": "application/pdf" },
      payload: pdfBytes2
    });
    expect(putRes2.statusCode).toBe(200);

    const confirmRes2 = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/confirm",
      headers: { authorization: `Bearer ${refreshedToken}` },
      payload: {
        intentId: initData2.intentId,
        fileKey: initData2.fileKey,
        purpose: "HOST_VERIFICATION",
        resourceId: businessId,
        documentType: "BUSINESS_REGISTRATION"
      }
    });
    expect(confirmRes2.statusCode).toBe(200);

    const resubmitRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/businesses/${businessId}/verification`,
      headers: { authorization: `Bearer ${refreshedToken}` },
      payload: {
        documents: [
          {
            documentType: "BUSINESS_REGISTRATION",
            intentId: initData2.intentId,
            fileKey: initData2.fileKey,
            fileName: "brn-v2.pdf",
            fileSize: pdfBytes2.byteLength,
            mimeType: "application/pdf"
          }
        ]
      }
    });
    expect(resubmitRes.statusCode).toBe(201);
    const verif2 = JSON.parse(resubmitRes.body).data;
    expect(verif2.id).not.toBe(verif1.id);
    expect(verif2.status).toBe("PENDING_REVIEW");

    const approveRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/verifications/${verif2.id}/review`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: { decision: "APPROVE", adminNotes: "Verified 2026 certificate" }
    });
    expect(approveRes.statusCode).toBe(200);

    const bizAfterApprove = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/businesses/${businessId}`,
      headers: { authorization: `Bearer ${refreshedToken}` }
    });
    expect(bizAfterApprove.statusCode).toBe(200);
    expect(JSON.parse(bizAfterApprove.body).data.status).toBe("ACTIVE");
  });

  it("enforces SUPPORT read access, full location sub-resource CRUD, 409 custody/reservation delete guards, image-free submission, and atomic primary media", async () => {
    const owner = await createActiveUser(["HOST_OWNER"], "Kandy Station Host");
    const supportUser = await createActiveUser(["SUPPORT"], "Platform Support Agent");
    const traveller = await createActiveUser(["TRAVELLER"], "Custody Guard Traveller");

    const createBizRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/businesses",
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        legalBusinessName: `Kandy Clocktower Storage ${runSuffix}`,
        tradeName: `Kandy Bag Hub ${runSuffix}`,
        entityType: "SOLE_PROPRIETORSHIP",
        contactEmail: owner.email,
        contactPhone: "+94812223344",
        city: "Kandy"
      }
    });
    expect(createBizRes.statusCode).toBe(201);
    const businessId = JSON.parse(createBizRes.body).data.id as string;

    await migratorPool.query(
      "UPDATE host_businesses SET status = 'ACTIVE' WHERE id = $1;",
      [businessId]
    );

    const createLocRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/locations",
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        businessId,
        name: `Kandy Peradeniya Drop Point ${runSuffix}`,
        description: "Secure locker facility beside station forecourt.",
        addressLine1: "18 William Gopallawa Mawatha",
        city: "Kandy",
        latitude: 7.2906,
        longitude: 80.6337,
        timezone: "Asia/Colombo",
        bookingMode: "INSTANT",
        acceptsOversized: true,
        amenities: ["CCTV", "24_7_ACCESS"]
      }
    });
    expect(createLocRes.statusCode).toBe(201);
    const locationId = JSON.parse(createLocRes.body).data.id as string;

    // SUPPORT user can inspect single location via ADMIN_LOCATION_READ, but cannot edit
    const supportGetRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/locations/${locationId}`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` }
    });
    expect(supportGetRes.statusCode).toBe(200);
    expect(JSON.parse(supportGetRes.body).data.addressLine1).toBe("18 William Gopallawa Mawatha");

    const supportPatchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/hosts/locations/${locationId}`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` },
      payload: { city: "Gampola" }
    });
    expect(supportPatchRes.statusCode).toBe(403);

    // Clear open schedules (mark all 7 days closed) so readiness validation rejects premature submit
    const closeHoursRes = await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/opening-hours`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        schedules: [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
          dayOfWeek,
          openTime: "08:00",
          closeTime: "20:00",
          allowsDropoff: false,
          allowsCollection: false,
          isClosed: true
        }))
      }
    });
    expect(closeHoursRes.statusCode).toBe(200);

    // Premature submission without active open hours fails readiness validation
    const prematureSubmit = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/locations/${locationId}/submit`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(prematureSubmit.statusCode).toBe(400);

    // Opening Hours + Exceptions CRUD
    const schedules = [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
      dayOfWeek,
      openTime: "07:00",
      closeTime: "21:00",
      allowsDropoff: true,
      allowsCollection: true,
      isClosed: false
    }));
    const putHoursRes = await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/opening-hours`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { schedules }
    });
    expect(putHoursRes.statusCode).toBe(200);

    const getHoursRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/locations/${locationId}/opening-hours`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(getHoursRes.statusCode).toBe(200);
    expect(JSON.parse(getHoursRes.body).data.schedules).toHaveLength(7);

    const addClosureRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/locations/${locationId}/exceptions`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        exceptionDate: "2027-05-21",
        exceptionType: "CLOSURE",
        reason: "Vesak Poya Holiday"
      }
    });
    expect(addClosureRes.statusCode).toBe(201);
    const closureExceptionId = JSON.parse(addClosureRes.body).data.exception.id as string;

    const addSpecialRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/locations/${locationId}/exceptions`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        exceptionDate: "2027-08-12",
        exceptionType: "SPECIAL_HOURS",
        openTime: "06:00",
        closeTime: "23:30",
        reason: "Esala Perahera Extended Hours"
      }
    });
    expect(addSpecialRes.statusCode).toBe(201);

    const listExRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/locations/${locationId}/exceptions`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(listExRes.statusCode).toBe(200);
    expect(JSON.parse(listExRes.body).data.exceptions).toHaveLength(2);

    const delExRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/hosts/locations/${locationId}/exceptions/${closureExceptionId}`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(delExRes.statusCode).toBe(200);

    // Storage Zones + Capacity Pools CRUD
    const zone1Res = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/locations/${locationId}/zones`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { name: "Vault Room A", zoneType: "LOCKER", securityTier: "HIGH_SECURITY" }
    });
    expect(zone1Res.statusCode).toBe(201);
    const zone1Id = JSON.parse(zone1Res.body).data.id as string;

    const zone2Res = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/locations/${locationId}/zones`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { name: "Oversized Rack B", zoneType: "RACK", securityTier: "STANDARD" }
    });
    expect(zone2Res.statusCode).toBe(201);
    const zone2Id = JSON.parse(zone2Res.body).data.id as string;

    const patchZone1 = await app.inject({
      method: "PATCH",
      url: `/api/v1/hosts/locations/${locationId}/zones/${zone1Id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { name: "Vault Room A - CCTV", securityTier: "HIGH_SECURITY" }
    });
    expect(patchZone1.statusCode).toBe(200);
    expect(JSON.parse(patchZone1.body).data.name).toBe("Vault Room A - CCTV");

    const pool1Res = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/locations/${locationId}/capacity-pools`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { zoneId: zone1Id, poolType: "SHARED", totalUnits: 30, isActive: true }
    });
    expect(pool1Res.statusCode).toBe(201);
    const pool1Id = JSON.parse(pool1Res.body).data.id as string;

    const pool2Res = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/locations/${locationId}/capacity-pools`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        zoneId: zone2Id,
        poolType: "DEDICATED",
        dedicatedBagCategory: "BAG_OVERSIZED",
        totalUnits: 8,
        isActive: true
      }
    });
    expect(pool2Res.statusCode).toBe(201);
    const pool2Id = JSON.parse(pool2Res.body).data.id as string;

    const patchPool1 = await app.inject({
      method: "PATCH",
      url: `/api/v1/hosts/capacity-pools/${pool1Id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { totalUnits: 36 }
    });
    expect(patchPool1.statusCode).toBe(200);
    expect(JSON.parse(patchPool1.body).data.totalUnits).toBe(36);

    const delUnusedPool2 = await app.inject({
      method: "DELETE",
      url: `/api/v1/hosts/capacity-pools/${pool2Id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(delUnusedPool2.statusCode).toBe(200);

    // Seed active booking + reservation + custody record referencing zone1 & pool1 -> 409 guards
    const bookingId = randomUUID();
    await migratorPool.query(
      `INSERT INTO bookings (
        id, reference_code, traveller_user_id, business_id, location_id,
        booking_mode, status, drop_off_at, collection_at,
        total_bags, total_capacity_units, currency, total_amount_minor
      ) VALUES (
        $1, $2, $3, $4, $5,
        'INSTANT', 'IN_STORAGE', NOW(), NOW() + interval '4 hours',
        1, 1, 'LKR', 150000
      );`,
      [bookingId, `LS-${runSuffix}-C1`, traveller.userId, businessId, locationId]
    );

    await migratorPool.query(
      `INSERT INTO capacity_reservations (
        id, booking_id, location_id, pool_id, bag_category, units_reserved, status
      ) VALUES ($1, $2, $3, $4, 'BAG_MEDIUM', 1, 'CONFIRMED');`,
      [randomUUID(), bookingId, locationId, pool1Id]
    );

    await migratorPool.query(
      `INSERT INTO custody_records (
        id, booking_id, location_id, business_id, status, expected_bag_count, zone_id, handover_condition
      ) VALUES ($1, $2, $3, $4, 'IN_STORAGE', 1, $5, 'NORMAL');`,
      [randomUUID(), bookingId, locationId, businessId, zone1Id]
    );

    const delActiveZoneRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/hosts/locations/${locationId}/zones/${zone1Id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(delActiveZoneRes.statusCode).toBe(409);

    const deactivateActiveZoneRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/hosts/locations/${locationId}/zones/${zone1Id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { isActive: false }
    });
    expect(deactivateActiveZoneRes.statusCode).toBe(409);

    const delReservedPoolRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/hosts/capacity-pools/${pool1Id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(delReservedPoolRes.statusCode).toBe(409);

    const delUnusedZone2 = await app.inject({
      method: "DELETE",
      url: `/api/v1/hosts/locations/${locationId}/zones/${zone2Id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(delUnusedZone2.statusCode).toBe(200);

    // Pricing policy sets status = 'ACTIVE'
    const putPricingRes = await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/pricing`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        currency: "LKR",
        pricingUnit: "24_HOUR_BLOCK",
        baseRateMinor: 120000
      }
    });
    expect(putPricingRes.statusCode).toBe(200);
    expect(JSON.parse(putPricingRes.body).data.status).toBe("ACTIVE");

    const getPricingRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/locations/${locationId}/pricing`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(getPricingRes.statusCode).toBe(200);
    expect(JSON.parse(getPricingRes.body).data.status).toBe("ACTIVE");

    // Submit location WITHOUT images -> moderation readiness passes (GAP-018)
    const submitRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/locations/${locationId}/submit`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(submitRes.statusCode).toBe(200);
    expect(JSON.parse(submitRes.body).data.status).toBe("PENDING_REVIEW");

    // Upload two public LOCATION_IMAGE files -> atomic single isPrimary + public fetch
    async function uploadLocationImage(fileName: string, content: string, isPrimary: boolean) {
      const buf = Buffer.from(content, "utf8");
      const initRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${owner.accessToken}` },
        payload: {
          purpose: "LOCATION_IMAGE",
          resourceId: locationId,
          fileName,
          mimeType: "image/jpeg",
          fileSize: buf.byteLength
        }
      });
      expect(initRes.statusCode).toBe(200);
      const initData = JSON.parse(initRes.body).data;
      const u = new URL(initData.uploadUrl);
      const putRes = await app.inject({
        method: "PUT",
        url: `${u.pathname}${u.search}`,
        headers: { "content-type": "image/jpeg" },
        payload: buf
      });
      expect(putRes.statusCode).toBe(200);

      const confirmRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/confirm",
        headers: { authorization: `Bearer ${owner.accessToken}` },
        payload: {
          intentId: initData.intentId,
          fileKey: initData.fileKey,
          purpose: "LOCATION_IMAGE",
          resourceId: locationId,
          caption: fileName,
          isPrimary
        }
      });
      expect(confirmRes.statusCode).toBe(200);
      return { buf, ...JSON.parse(confirmRes.body).data };
    }

    const img1 = await uploadLocationImage("counter-front.jpg", "jpeg-bytes-first-hub-photo", true);
    const img2 = await uploadLocationImage("vault-interior.jpg", "jpeg-bytes-second-hub-photo", true);

    const mediaListAfterSecond = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/locations/${locationId}/media`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(mediaListAfterSecond.statusCode).toBe(200);
    const mediaRows = JSON.parse(mediaListAfterSecond.body).data.media as Array<{
      id: string;
      isPrimary: boolean;
    }>;
    expect(mediaRows).toHaveLength(2);
    expect(mediaRows.find((m) => m.id === img2.id)?.isPrimary).toBe(true);
    expect(mediaRows.find((m) => m.id === img1.id)?.isPrimary).toBe(false);

    // Swap primary back to img1 via PATCH /media/:mediaId
    const swapPrimaryRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/hosts/locations/${locationId}/media/${img1.id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { isPrimary: true, caption: "Primary Storefront" }
    });
    expect(swapPrimaryRes.statusCode).toBe(200);

    const mediaListSwapped = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/locations/${locationId}/media`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    const swappedRows = JSON.parse(mediaListSwapped.body).data.media as Array<{
      id: string;
      isPrimary: boolean;
    }>;
    expect(swappedRows.find((m) => m.id === img1.id)?.isPrimary).toBe(true);
    expect(swappedRows.find((m) => m.id === img2.id)?.isPrimary).toBe(false);

    // Public image route serves image bytes without Authorization header
    const publicImgRes = await app.inject({
      method: "GET",
      url: `/api/v1/uploads/public/${img1.fileKey}`
    });
    expect(publicImgRes.statusCode).toBe(200);
    expect(publicImgRes.rawPayload.equals(img1.buf)).toBe(true);

    const delImg2Res = await app.inject({
      method: "DELETE",
      url: `/api/v1/hosts/locations/${locationId}/media/${img2.id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    expect(delImg2Res.statusCode).toBe(200);
  });

  it("enforces multi-business HOST_STAFF location scoping, blocks owner-only actions, and revokes HOST_STAFF only after last active membership is removed", async () => {
    const ownerA = await createActiveUser(["HOST_OWNER"], "Host Owner Alpha");
    const ownerB = await createActiveUser(["HOST_OWNER"], "Host Owner Beta");
    const staffCandidate = await createActiveUser(["TRAVELLER"], "Colombo Attendant");

    const createBiz = async (accessToken: string, name: string, email: string) => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          legalBusinessName: `${name} Legal`,
          tradeName: name,
          entityType: "PRIVATE_LIMITED",
          contactEmail: email,
          contactPhone: "+94112223344",
          city: "Colombo"
        }
      });
      expect(res.statusCode).toBe(201);
      return JSON.parse(res.body).data.id as string;
    };

    const createLoc = async (accessToken: string, businessId: string, name: string) => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/locations",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          businessId,
          name,
          addressLine1: `100 ${name} Rd`,
          city: "Colombo",
          latitude: 6.9271,
          longitude: 79.8612,
          timezone: "Asia/Colombo",
          bookingMode: "INSTANT",
          acceptsOversized: false,
          amenities: []
        }
      });
      expect(res.statusCode).toBe(201);
      return JSON.parse(res.body).data.id as string;
    };

    const businessA = await createBiz(ownerA.accessToken, `Alpha Storage ${runSuffix}`, ownerA.email);
    const businessB = await createBiz(ownerB.accessToken, `Beta Storage ${runSuffix}`, ownerB.email);
    const locationA1 = await createLoc(ownerA.accessToken, businessA, `Alpha Main ${runSuffix}`);
    const locationA2 = await createLoc(ownerA.accessToken, businessA, `Alpha Unassigned ${runSuffix}`);
    const locationB1 = await createLoc(ownerB.accessToken, businessB, `Beta Harbour ${runSuffix}`);

    // Invite staffCandidate to Business A (scoped to locationA1) and Business B (scoped to locationB1)
    const inviteARes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/businesses/${businessA}/staff`,
      headers: { authorization: `Bearer ${ownerA.accessToken}` },
      payload: {
        email: staffCandidate.email,
        staffRole: "ATTENDANT",
        assignedLocationIds: [locationA1]
      }
    });
    expect(inviteARes.statusCode).toBe(201);
    const membershipAId = JSON.parse(inviteARes.body).data.staffMember.id as string;

    const inviteBRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/businesses/${businessB}/staff`,
      headers: { authorization: `Bearer ${ownerB.accessToken}` },
      payload: {
        email: staffCandidate.email,
        staffRole: "ATTENDANT",
        assignedLocationIds: [locationB1]
      }
    });
    expect(inviteBRes.statusCode).toBe(201);
    const membershipBId = JSON.parse(inviteBRes.body).data.staffMember.id as string;

    // Staff sees only assigned locations across businesses (locationA1 & locationB1, not locationA2)
    const staffLocationsRes = await app.inject({
      method: "GET",
      url: "/api/v1/hosts/locations",
      headers: { authorization: `Bearer ${staffCandidate.accessToken}` }
    });
    expect(staffLocationsRes.statusCode).toBe(200);
    const staffLocIds = (
      JSON.parse(staffLocationsRes.body).data.locations as Array<{ id: string }>
    ).map((l) => l.id);
    expect(staffLocIds).toContain(locationA1);
    expect(staffLocIds).toContain(locationB1);
    expect(staffLocIds).not.toContain(locationA2);

    // Staff receives 403 on owner-only endpoints
    const staffPatchLocRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/hosts/locations/${locationA1}`,
      headers: { authorization: `Bearer ${staffCandidate.accessToken}` },
      payload: { name: "Tampered Name" }
    });
    expect(staffPatchLocRes.statusCode).toBe(403);

    const staffPutPricingRes = await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationA1}/pricing`,
      headers: { authorization: `Bearer ${staffCandidate.accessToken}` },
      payload: { currency: "LKR", pricingUnit: "CALENDAR_DAY", baseRateMinor: 99900 }
    });
    expect(staffPutPricingRes.statusCode).toBe(403);

    const staffListStaffRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/businesses/${businessA}/staff`,
      headers: { authorization: `Bearer ${staffCandidate.accessToken}` }
    });
    expect(staffListStaffRes.statusCode).toBe(403);

    const staffPayoutRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/businesses/${businessA}/payout-details`,
      headers: { authorization: `Bearer ${staffCandidate.accessToken}` }
    });
    expect(staffPayoutRes.statusCode).toBe(403);

    // Owner A updates staff role to MANAGER then removes membership A -> HOST_STAFF remains due to Business B
    const patchStaffARes = await app.inject({
      method: "PATCH",
      url: `/api/v1/hosts/businesses/${businessA}/staff/${membershipAId}`,
      headers: { authorization: `Bearer ${ownerA.accessToken}` },
      payload: { staffRole: "MANAGER" }
    });
    expect(patchStaffARes.statusCode).toBe(200);
    expect(JSON.parse(patchStaffARes.body).data.staffMember.staffRole).toBe("MANAGER");

    const removeStaffARes = await app.inject({
      method: "DELETE",
      url: `/api/v1/hosts/businesses/${businessA}/staff/${membershipAId}`,
      headers: { authorization: `Bearer ${ownerA.accessToken}` }
    });
    expect(removeStaffARes.statusCode).toBe(200);

    const rolesAfterPartialRemove = await migratorPool.query<{ code: string }>(
      `SELECT r.code
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1;`,
      [staffCandidate.userId]
    );
    const codesMid = rolesAfterPartialRemove.rows.map((r) => r.code);
    expect(codesMid).toContain("HOST_STAFF");
    expect(codesMid).toContain("TRAVELLER");

    // Owner B removes last active membership -> HOST_STAFF revoked, TRAVELLER preserved
    const removeStaffBRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/hosts/businesses/${businessB}/staff/${membershipBId}`,
      headers: { authorization: `Bearer ${ownerB.accessToken}` }
    });
    expect(removeStaffBRes.statusCode).toBe(200);

    const rolesAfterFullRemove = await migratorPool.query<{ code: string }>(
      `SELECT r.code
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1;`,
      [staffCandidate.userId]
    );
    const codesEnd = rolesAfterFullRemove.rows.map((r) => r.code);
    expect(codesEnd).not.toContain("HOST_STAFF");
    expect(codesEnd).toContain("TRAVELLER");
  });
});
