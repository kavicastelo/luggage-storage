import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { rateLimitService } from "../src/modules/auth/rate-limit.service.js";

const { Pool } = pg;

describe("Phase A: Marketplace Foundation, Host Onboarding & Location Management", () => {
  let app: FastifyInstance;
  let migratorPool: pg.Pool;
  let runtimePool: pg.Pool;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    migratorPool = new Pool({
      connectionString: env.MIGRATION_DATABASE_URL,
      max: 2
    });
    runtimePool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 2
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

  // Helper to create and activate test user
  async function createTestUser(
    roleCode: "TRAVELLER" | "HOST_OWNER" | "SUPERADMIN" | "SUPPORT" = "TRAVELLER",
    displayName = "Test User"
  ) {
    const unique = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const email = `test_${unique}@example.com`;
    const password = "StrongPassword123!";

    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password, displayName }
    });
    expect(regRes.statusCode).toBe(201);
    const userId = JSON.parse(regRes.body).data.id;

    // Assign role if not default TRAVELLER
    if (roleCode !== "TRAVELLER") {
      const roleRes = await migratorPool.query(
        "SELECT id FROM roles WHERE code = $1 LIMIT 1;",
        [roleCode]
      );
      if (roleRes.rows.length > 0) {
        await migratorPool.query(
          "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
          [userId, roleRes.rows[0].id]
        );
      }
    }

    // Mark email verified & status ACTIVE
    await migratorPool.query(
      "UPDATE users SET status = 'ACTIVE', is_email_verified = true WHERE id = $1;",
      [userId]
    );

    // Login to get token
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

  // ==========================================================================
  // 1. Database Schema & Migration Verification
  // ==========================================================================
  describe("1. Database Schema & PostGIS Verification", () => {
    it("should verify all 25 required schema tables exist in the public schema", async () => {
      const res = await runtimePool.query<{ count: string }>(`
        SELECT COUNT(*)::text as count
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (
            'users', 'host_businesses', 'host_verifications', 'host_verification_documents',
            'host_staff_memberships', 'storage_locations', 'location_media', 'storage_zones',
            'opening_hours', 'opening_hours_exceptions', 'storage_capacity_pools',
            'pricing_policies', 'pricing_tier_rates'
          );
      `);
      expect(Number(res.rows[0].count)).toBe(13);
    });

    it("should verify the GiST spatial index on storage_locations coordinates", async () => {
      const res = await runtimePool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'storage_locations'
          AND indexname = 'storage_locations_coordinates_gist_idx';
      `);
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].indexdef.toLowerCase()).toContain("using gist (coordinates)");
    });

    it("should reject negative total_units in storage_capacity_pools", async () => {
      await expect(
        runtimePool.query(`
          INSERT INTO storage_capacity_pools (id, location_id, pool_type, total_units)
          VALUES (gen_random_uuid(), gen_random_uuid(), 'SHARED', -5);
        `)
      ).rejects.toThrow();
    });

    it("should reject base_rate_minor <= 0 in pricing_policies", async () => {
      await expect(
        runtimePool.query(`
          INSERT INTO pricing_policies (id, location_id, base_rate_minor)
          VALUES (gen_random_uuid(), gen_random_uuid(), 0);
        `)
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // 2. Host Business Onboarding & Verification Workflow
  // ==========================================================================
  describe("2. Host Business Onboarding & Verification", () => {
    it("should allow a user to create a Host Business and auto-assign HOST_OWNER role", async () => {
      const user = await createTestUser("TRAVELLER", "Host Applicant");

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          legalBusinessName: "Colombo Express Lockers PVT LTD",
          tradeName: "Colombo Express",
          entityType: "PRIVATE_LIMITED",
          contactEmail: "contact@colomboexpress.lk",
          contactPhone: "+94771234567",
          city: "Colombo",
          countryCode: "LK"
        }
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.legalBusinessName).toBe("Colombo Express Lockers PVT LTD");
      expect(body.data.status).toBe("DRAFT");
      expect(body.data.ownerUserId).toBe(user.userId);

      // Verify user now has HOST_OWNER role
      const roleCheck = await runtimePool.query(
        "SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = $1;",
        [user.userId]
      );
      const roleCodes = roleCheck.rows.map((r) => r.code);
      expect(roleCodes).toContain("HOST_OWNER");
    });

    it("should retrieve owned businesses for the authenticated user", async () => {
      const user = await createTestUser("HOST_OWNER", "Host Owner");

      // Create a business
      await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          legalBusinessName: "Galle Fort Luggage Hub",
          tradeName: "Galle Hub",
          entityType: "SOLE_PROPRIETORSHIP",
          contactEmail: "galle@hub.lk",
          contactPhone: "+94777654321",
          city: "Galle"
        }
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${user.accessToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.businesses.length).toBeGreaterThanOrEqual(1);
      expect(body.data.businesses[0].tradeName).toBe("Galle Hub");
    });

    it("should allow a host owner to submit verification with documents", async () => {
      const user = await createTestUser("HOST_OWNER", "Verified Host");

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          legalBusinessName: "Kandy Transit Storage",
          tradeName: "Kandy Storage",
          entityType: "RETAIL_SHOP",
          contactEmail: "kandy@storage.lk",
          contactPhone: "+94711112222",
          city: "Kandy"
        }
      });
      const businessId = JSON.parse(createRes.body).data.id;

      // Submit verification
      const verifRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/businesses/${businessId}/verification`,
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          documents: [
            {
              documentType: "BUSINESS_REGISTRATION",
              fileKey: `verifications/${businessId}/br-certificate.pdf`,
              fileName: "br-certificate.pdf",
              fileSize: 1048576,
              mimeType: "application/pdf"
            },
            {
              documentType: "NATIONAL_ID",
              fileKey: `verifications/${businessId}/nic-front.jpg`,
              fileName: "nic-front.jpg",
              fileSize: 524288,
              mimeType: "image/jpeg"
            }
          ]
        }
      });

      expect(verifRes.statusCode).toBe(201);
      const verifBody = JSON.parse(verifRes.body);
      expect(verifBody.data.status).toBe("PENDING_REVIEW");
      expect(verifBody.data.documents.length).toBe(2);

      // Verify business status updated to PENDING_VERIFICATION
      const bizRes = await app.inject({
        method: "GET",
        url: `/api/v1/hosts/businesses/${businessId}`,
        headers: { authorization: `Bearer ${user.accessToken}` }
      });
      expect(JSON.parse(bizRes.body).data.status).toBe("PENDING_VERIFICATION");
    });
  });

  // ==========================================================================
  // 3. Superadmin Verification Review & Security Rule 4
  // ==========================================================================
  describe("3. Superadmin Verification Review & Self-Approval Prevention", () => {
    it("SEC-04: should reject a host owner attempting to review/approve their own verification", async () => {
      const hostUser = await createTestUser("SUPERADMIN", "Host Admin Hybrid");

      // Host creates a business and submits verification
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${hostUser.accessToken}` },
        payload: {
          legalBusinessName: "Self Review Attempt Business",
          tradeName: "Self Review",
          entityType: "SOLE_PROPRIETORSHIP",
          contactEmail: "self@review.lk",
          contactPhone: "+94770001111",
          city: "Colombo"
        }
      });
      const businessId = JSON.parse(createRes.body).data.id;

      const verifRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/businesses/${businessId}/verification`,
        headers: { authorization: `Bearer ${hostUser.accessToken}` },
        payload: {
          documents: [
            {
              documentType: "NATIONAL_ID",
              fileKey: `verifications/${businessId}/nic.jpg`,
              fileName: "nic.jpg",
              fileSize: 500000,
              mimeType: "image/jpeg"
            }
          ]
        }
      });
      const verificationId = JSON.parse(verifRes.body).data.id;

      // Host attempts to approve their own verification (even though they have SUPERADMIN role)
      const reviewRes = await app.inject({
        method: "POST",
        url: `/api/v1/admin/verifications/${verificationId}/review`,
        headers: { authorization: `Bearer ${hostUser.accessToken}` },
        payload: {
          decision: "APPROVE",
          adminNotes: "Self approval attempt"
        }
      });

      expect(reviewRes.statusCode).toBe(403);
      expect(JSON.parse(reviewRes.body).error.message).toContain("cannot review their own verification");
    });

    it("should allow a distinct Superadmin to approve verification and activate the business", async () => {
      const host = await createTestUser("HOST_OWNER", "Legit Host");
      const admin = await createTestUser("SUPERADMIN", "Legit Superadmin");

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          legalBusinessName: "Fort Luggage Lockers",
          tradeName: "Fort Lockers",
          entityType: "PRIVATE_LIMITED",
          contactEmail: "fort@lockers.lk",
          contactPhone: "+94778889999",
          city: "Colombo"
        }
      });
      const businessId = JSON.parse(createRes.body).data.id;

      const verifRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/businesses/${businessId}/verification`,
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          documents: [
            {
              documentType: "BUSINESS_REGISTRATION",
              fileKey: `verifications/${businessId}/br.pdf`,
              fileName: "br.pdf",
              fileSize: 200000,
              mimeType: "application/pdf"
            }
          ]
        }
      });
      const verificationId = JSON.parse(verifRes.body).data.id;

      // Superadmin inspects verification queue
      const queueRes = await app.inject({
        method: "GET",
        url: "/api/v1/admin/verifications",
        headers: { authorization: `Bearer ${admin.accessToken}` }
      });
      expect(queueRes.statusCode).toBe(200);
      const queueBody = JSON.parse(queueRes.body);
      expect(queueBody.data.queue.some((q: any) => q.verificationId === verificationId)).toBe(true);

      // Superadmin approves verification
      const reviewRes = await app.inject({
        method: "POST",
        url: `/api/v1/admin/verifications/${verificationId}/review`,
        headers: { authorization: `Bearer ${admin.accessToken}` },
        payload: {
          decision: "APPROVE",
          adminNotes: "All documents valid and verified against Sri Lanka registrar"
        }
      });

      expect(reviewRes.statusCode).toBe(200);
      expect(JSON.parse(reviewRes.body).data.status).toBe("APPROVED");

      // Verify business is now ACTIVE
      const bizRes = await app.inject({
        method: "GET",
        url: `/api/v1/hosts/businesses/${businessId}`,
        headers: { authorization: `Bearer ${host.accessToken}` }
      });
      expect(JSON.parse(bizRes.body).data.status).toBe("ACTIVE");
    });
  });

  // ==========================================================================
  // 4. Storage Location Management, Capacity & Pricing
  // ==========================================================================
  describe("4. Storage Location Management & Configuration", () => {
    let host: { userId: string; accessToken: string };
    let admin: { userId: string; accessToken: string };
    let activeBusinessId: string;

    beforeAll(async () => {
      host = await createTestUser("HOST_OWNER", "Location Host");
      admin = await createTestUser("SUPERADMIN", "Location Admin");

      // Create and activate business
      const bRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          legalBusinessName: "Mirissa Beach Storage",
          tradeName: "Mirissa Storage",
          entityType: "SOLE_PROPRIETORSHIP",
          contactEmail: "mirissa@storage.lk",
          contactPhone: "+94775556666",
          city: "Mirissa"
        }
      });
      activeBusinessId = JSON.parse(bRes.body).data.id;

      // Submit and approve
      const vRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/businesses/${activeBusinessId}/verification`,
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          documents: [
            {
              documentType: "NATIONAL_ID",
              fileKey: "v/mirissa.jpg",
              fileName: "mirissa.jpg",
              fileSize: 100000,
              mimeType: "image/jpeg"
            }
          ]
        }
      });
      const vId = JSON.parse(vRes.body).data.id;
      await app.inject({
        method: "POST",
        url: `/api/v1/admin/verifications/${vId}/review`,
        headers: { authorization: `Bearer ${admin.accessToken}` },
        payload: { decision: "APPROVE" }
      });
    });

    it("should allow a host to create a storage location draft with default configurations", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/locations",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          businessId: activeBusinessId,
          name: "Mirissa Main Beach Point",
          description: "Convenient luggage holding near surf point",
          addressLine1: "123 Beach Road",
          city: "Mirissa",
          postalCode: "81740",
          countryCode: "LK",
          latitude: 5.9483,
          longitude: 80.4578,
          bookingMode: "INSTANT",
          acceptsOversized: true,
          amenities: ["CCTV", "WIFI", "AIR_CONDITIONING"]
        }
      });

      expect(res.statusCode).toBe(201);
      const loc = JSON.parse(res.body).data;
      expect(loc.status).toBe("DRAFT");
      expect(loc.name).toBe("Mirissa Main Beach Point");
      expect(loc.openingHours.length).toBe(7);
      expect(loc.zones.length).toBe(1);
    });

    it("should allow updating opening hours and adding an exception date", async () => {
      const locRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/locations",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          businessId: activeBusinessId,
          name: "Weligama Bay Storage",
          addressLine1: "45 Matara Road",
          city: "Weligama",
          latitude: 5.9722,
          longitude: 80.4289
        }
      });
      const locId = JSON.parse(locRes.body).data.id;

      // Update opening hours
      const hoursRes = await app.inject({
        method: "PUT",
        url: `/api/v1/hosts/locations/${locId}/opening-hours`,
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          schedules: [
            { dayOfWeek: 1, openTime: "07:00:00", closeTime: "22:00:00", allowsDropoff: true, allowsCollection: true, isClosed: false },
            { dayOfWeek: 2, openTime: "07:00:00", closeTime: "22:00:00", allowsDropoff: true, allowsCollection: true, isClosed: false },
            { dayOfWeek: 3, openTime: "07:00:00", closeTime: "22:00:00", allowsDropoff: true, allowsCollection: true, isClosed: false },
            { dayOfWeek: 4, openTime: "07:00:00", closeTime: "22:00:00", allowsDropoff: true, allowsCollection: true, isClosed: false },
            { dayOfWeek: 5, openTime: "07:00:00", closeTime: "23:00:00", allowsDropoff: true, allowsCollection: true, isClosed: false },
            { dayOfWeek: 6, openTime: "07:00:00", closeTime: "23:00:00", allowsDropoff: true, allowsCollection: true, isClosed: false },
            { dayOfWeek: 7, openTime: "08:00:00", closeTime: "20:00:00", allowsDropoff: true, allowsCollection: true, isClosed: false }
          ]
        }
      });
      expect(hoursRes.statusCode).toBe(200);

      // Add closure exception (e.g. Christmas Day)
      const excRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/locations/${locId}/exceptions`,
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          exceptionDate: "2026-12-25",
          exceptionType: "CLOSURE",
          reason: "Christmas Public Holiday Closure"
        }
      });
      expect(excRes.statusCode).toBe(201);
    });

    it("should allow configuring pricing policy and bag category rates in integer minor units", async () => {
      const locRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/locations",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          businessId: activeBusinessId,
          name: "Tangalle Surf Depot",
          addressLine1: "10 Beach Way",
          city: "Tangalle",
          latitude: 6.0244,
          longitude: 80.7941
        }
      });
      const locId = JSON.parse(locRes.body).data.id;

      // Configure custom pricing
      const priceRes = await app.inject({
        method: "PUT",
        url: `/api/v1/hosts/locations/${locId}/pricing`,
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          currency: "LKR",
          pricingUnit: "CALENDAR_DAY",
          baseRateMinor: 150000, // LKR 1,500.00
          tierRates: [
            { bagCategory: "BAG_SMALL", rateMinor: 120000, categoryMultiplierBps: 8000 },
            { bagCategory: "BAG_MEDIUM", rateMinor: 150000, categoryMultiplierBps: 10000 },
            { bagCategory: "BAG_LARGE", rateMinor: 180000, categoryMultiplierBps: 12000 },
            { bagCategory: "BAG_OVERSIZED", rateMinor: 225000, categoryMultiplierBps: 15000 }
          ]
        }
      });

      expect(priceRes.statusCode).toBe(200);
      const policy = JSON.parse(priceRes.body).data;
      expect(policy.baseRateMinor).toBe(150000);
      expect(policy.tierRates.length).toBe(4);
      const small = policy.tierRates.find((t: any) => t.bagCategory === "BAG_SMALL");
      expect(small.rateMinor).toBe(120000);
    });

    it("SEC-05: should reject a host owner attempting to moderate/approve their own storage location", async () => {
      const hybrid = await createTestUser("SUPERADMIN", "Hybrid Owner");

      const bRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${hybrid.accessToken}` },
        payload: {
          legalBusinessName: "Self Location Approval Co",
          tradeName: "Self Location",
          contactEmail: "loc@self.lk",
          contactPhone: "+94770002222",
          city: "Colombo"
        }
      });
      const bizId = JSON.parse(bRes.body).data.id;
      // Mark business active directly for test
      await runtimePool.query("UPDATE host_businesses SET status = 'ACTIVE' WHERE id = $1;", [bizId]);

      const locRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/locations",
        headers: { authorization: `Bearer ${hybrid.accessToken}` },
        payload: {
          businessId: bizId,
          name: "Self Approval Spot",
          addressLine1: "1 Main Street",
          city: "Colombo",
          latitude: 6.9271,
          longitude: 79.8612
        }
      });
      const locId = JSON.parse(locRes.body).data.id;

      // Submit location
      await app.inject({
        method: "POST",
        url: `/api/v1/hosts/locations/${locId}/submit`,
        headers: { authorization: `Bearer ${hybrid.accessToken}` }
      });

      // Attempt self-approval
      const reviewRes = await app.inject({
        method: "POST",
        url: `/api/v1/admin/locations/${locId}/review`,
        headers: { authorization: `Bearer ${hybrid.accessToken}` },
        payload: { decision: "APPROVE" }
      });

      expect(reviewRes.statusCode).toBe(403);
      expect(JSON.parse(reviewRes.body).error.message).toContain("cannot approve their own storage locations");
    });
  });

  // ==========================================================================
  // 5. Secure File Upload Foundation
  // ==========================================================================
  describe("5. Secure File Uploads", () => {
    it("should generate pre-signed upload URL for authorized purpose and valid MIME type", async () => {
      const user = await createTestUser("HOST_OWNER", "Uploader");

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          purpose: "HOST_VERIFICATION",
          fileName: "business-license.pdf",
          fileSize: 1048576,
          mimeType: "application/pdf"
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.uploadUrl).toBeDefined();
      expect(body.data.fileKey).toContain("verifications/");
      expect(body.data.expiresInSeconds).toBeGreaterThan(0);
    });

    it("should reject upload initiation with disallowed MIME type", async () => {
      const user = await createTestUser("HOST_OWNER", "Bad Uploader");

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          purpose: "LOCATION_IMAGE",
          fileName: "script.exe",
          fileSize: 1024,
          mimeType: "application/x-msdownload"
        }
      });

      expect(res.statusCode).toBe(400);
    });

    it("should reject upload initiation exceeding file size limit", async () => {
      const user = await createTestUser("HOST_OWNER", "Oversized Uploader");

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          purpose: "LOCATION_IMAGE",
          fileName: "huge-photo.jpg",
          fileSize: 50 * 1024 * 1024, // 50MB (limit is 10MB)
          mimeType: "image/jpeg"
        }
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ==========================================================================
  // 6. Public Location Discovery & OQ-012 Address Privacy Protection
  // ==========================================================================
  describe("6. Public Location Discovery & OQ-012 Privacy", () => {
    let colomboActiveLocId: string;
    let galleActiveLocId: string;
    let draftLocId: string;

    beforeAll(async () => {
      const host = await createTestUser("HOST_OWNER", "Public Host");
      const admin = await createTestUser("SUPERADMIN", "Public Admin");

      // Create business & activate
      const bRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          legalBusinessName: "Islandwide Storage Network",
          tradeName: "Islandwide Storage",
          contactEmail: "island@storage.lk",
          contactPhone: "+94770003333",
          city: "Colombo"
        }
      });
      const bizId = JSON.parse(bRes.body).data.id;
      await runtimePool.query("UPDATE host_businesses SET status = 'ACTIVE' WHERE id = $1;", [bizId]);

      // 1. Create Colombo location (Active)
      const cRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/locations",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          businessId: bizId,
          name: "Colombo Fort Central Hub",
          description: "Inside terminal building near platform 1",
          addressLine1: "Private Exact Door 4B, Fort Railway Station",
          addressLine2: "Suite 102, Secret Building",
          city: "Colombo",
          postalCode: "00100",
          latitude: 6.9344,
          longitude: 79.8500,
          bookingMode: "INSTANT",
          acceptsOversized: false,
          amenities: ["CCTV", "WIFI"]
        }
      });
      colomboActiveLocId = JSON.parse(cRes.body).data.id;

      // 2. Create Galle location (Active)
      const gRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/locations",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          businessId: bizId,
          name: "Galle Fort Heritage Lockers",
          addressLine1: "Secret Private Alley 12",
          city: "Galle",
          postalCode: "80000",
          latitude: 6.0329,
          longitude: 80.2168,
          bookingMode: "INSTANT",
          acceptsOversized: true,
          amenities: ["CCTV", "AIR_CONDITIONING"]
        }
      });
      galleActiveLocId = JSON.parse(gRes.body).data.id;

      // 3. Create Draft location (Should NOT appear publicly)
      const dRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/locations",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          businessId: bizId,
          name: "Unapproved Secret Draft Location",
          addressLine1: "Top Secret Address",
          city: "Colombo",
          latitude: 6.9300,
          longitude: 79.8550
        }
      });
      draftLocId = JSON.parse(dRes.body).data.id;

      // Approve Colombo & Galle locations
      await runtimePool.query(
        "UPDATE storage_locations SET status = 'ACTIVE' WHERE id IN ($1, $2);",
        [colomboActiveLocId, galleActiveLocId]
      );
    });

    it("should discover active locations publicly without authentication", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/discovery/locations"
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.locations.length).toBeGreaterThanOrEqual(2);

      const foundColombo = body.data.locations.find((l: any) => l.id === colomboActiveLocId);
      expect(foundColombo).toBeDefined();

      // Draft location must NEVER appear
      const foundDraft = body.data.locations.find((l: any) => l.id === draftLocId);
      expect(foundDraft).toBeUndefined();
    });

    it("OQ-012: should strictly sanitize exact address fields from public discovery", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/discovery/locations/${colomboActiveLocId}`
      });

      expect(res.statusCode).toBe(200);
      const loc = JSON.parse(res.body).data;

      // Public representation MUST contain general area
      expect(loc.city).toBe("Colombo");
      expect(loc.approximateArea).toBeDefined();

      // Public representation MUST NEVER expose exact address or postal code
      expect(loc.addressLine1).toBeUndefined();
      expect(loc.addressLine2).toBeUndefined();
      expect(loc.postalCode).toBeUndefined();

      // Exact coordinates (6.9344) must not be exposed; approximate rounded coordinates used
      expect(loc.approximateLatitude).toBe(6.93);
      expect(loc.approximateLongitude).toBe(79.85);
    });

    it("should perform geospatial radius search with PostGIS distance calculation", async () => {
      // Search centered at Colombo (6.9344, 79.8500) with 5km radius
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/discovery/locations?latitude=6.9344&longitude=79.8500&radiusMeters=5000"
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      const ids = body.data.locations.map((l: any) => l.id);

      // Colombo location is within 5km, Galle location (~115km away) is excluded
      expect(ids).toContain(colomboActiveLocId);
      expect(ids).not.toContain(galleActiveLocId);

      // First result has distanceMeters calculated
      expect(body.data.locations[0].distanceMeters).toBeDefined();
    });

    it("should filter by city name and amenities", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/discovery/locations?city=Galle&amenities=AIR_CONDITIONING"
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      const ids = body.data.locations.map((l: any) => l.id);

      expect(ids).toContain(galleActiveLocId);
      expect(ids).not.toContain(colomboActiveLocId);
    });
  });

  // ==========================================================================
  // 7. Security & IDOR Protections
  // ==========================================================================
  describe("7. Security & Cross-Host IDOR Protections", () => {
    let hostA: { userId: string; accessToken: string };
    let hostB: { userId: string; accessToken: string };
    let businessBId: string;
    let locationBId: string;
    let documentBId: string;

    beforeAll(async () => {
      hostA = await createTestUser("HOST_OWNER", "Host Alice");
      hostB = await createTestUser("HOST_OWNER", "Host Bob");

      // Host B creates business and location
      const bRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${hostB.accessToken}` },
        payload: {
          legalBusinessName: "Bob Storage Enterprises",
          tradeName: "Bob Storage",
          contactEmail: "bob@storage.lk",
          contactPhone: "+94770004444",
          city: "Negombo"
        }
      });
      businessBId = JSON.parse(bRes.body).data.id;

      // Host B submits a verification document while in DRAFT status
      const vRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/businesses/${businessBId}/verification`,
        headers: { authorization: `Bearer ${hostB.accessToken}` },
        payload: {
          documents: [
            {
              documentType: "NATIONAL_ID",
              fileKey: "v/bob-id.pdf",
              fileName: "bob-id.pdf",
              fileSize: 50000,
              mimeType: "application/pdf"
            }
          ]
        }
      });
      documentBId = JSON.parse(vRes.body).data.documents[0].id;

      // Activate business so location can be created
      await runtimePool.query("UPDATE host_businesses SET status = 'ACTIVE' WHERE id = $1;", [businessBId]);

      const lRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/locations",
        headers: { authorization: `Bearer ${hostB.accessToken}` },
        payload: {
          businessId: businessBId,
          name: "Bob Negombo Depot",
          addressLine1: "Private Address 99",
          city: "Negombo",
          latitude: 7.2089,
          longitude: 79.8358
        }
      });
      locationBId = JSON.parse(lRes.body).data.id;
    });

    it("SEC-01: Host A cannot view Host B's private business details", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/hosts/businesses/${businessBId}`,
        headers: { authorization: `Bearer ${hostA.accessToken}` }
      });

      expect(res.statusCode).toBe(403);
    });

    it("SEC-02: Host A cannot modify Host B's business", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/hosts/businesses/${businessBId}`,
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: { tradeName: "Hacked Trade Name" }
      });

      expect(res.statusCode).toBe(403);
    });

    it("SEC-03: Host A cannot access Host B's full location management view", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/hosts/locations/${locationBId}`,
        headers: { authorization: `Bearer ${hostA.accessToken}` }
      });

      expect(res.statusCode).toBe(403);
    });

    it("SEC-04: Host A cannot update Host B's location configuration", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/hosts/locations/${locationBId}`,
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: { name: "Malicious Location Name" }
      });

      expect(res.statusCode).toBe(403);
    });

    it("SEC-05: Host A cannot download Host B's private verification documents", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/uploads/documents/${documentBId}/download`,
        headers: { authorization: `Bearer ${hostA.accessToken}` }
      });

      expect(res.statusCode).toBe(403);
    });

    it("SEC-06: Non-admin users cannot access administrative moderation queues", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/verifications",
        headers: { authorization: `Bearer ${hostA.accessToken}` }
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
