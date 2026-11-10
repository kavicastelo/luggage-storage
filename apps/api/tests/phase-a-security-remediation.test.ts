import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { storageService } from "../src/modules/uploads/storage.service.js";
import { createStorageService } from "../src/modules/uploads/storage.service.js";
import {
  encryptPayoutAccountNumber,
  decryptPayoutAccountNumber,
  maskPayoutAccountNumber
} from "../src/common/crypto/payout-encryption.js";
import { loadConfig } from "../src/config/env.js";
import { rateLimitService } from "../src/modules/auth/rate-limit.service.js";

const { Pool } = pg;

describe("Phase A Security & Correctness Remediation Suite", () => {
  let app: FastifyInstance;
  let migratorPool: pg.Pool;
  let runtimePool: pg.Pool;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    migratorPool = new Pool({
      connectionString: env.MIGRATION_DATABASE_URL,
      max: 5
    });
    runtimePool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 5
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

  async function createTestUser(role: "TRAVELLER" | "HOST_OWNER" | "SUPERADMIN", namePrefix: string) {
    await rateLimitService.clearAll();
    const email = `${namePrefix.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
    const password = "SecurePassword123!";
    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email,
        password,
        displayName: `${namePrefix} User`
      }
    });

    const regBody = JSON.parse(regRes.body);
    const userId = regBody.data.id;

    if (role !== "TRAVELLER") {
      const roleRow = await migratorPool.query("SELECT id FROM roles WHERE code = $1 LIMIT 1;", [role]);
      if (roleRow.rows.length > 0) {
        await migratorPool.query(
          "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
          [userId, roleRow.rows[0].id]
        );
      }
    }

    await migratorPool.query(
      "UPDATE users SET status = 'ACTIVE', is_email_verified = true WHERE id = $1;",
      [userId]
    );

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email,
        password,
        clientType: "WEB"
      }
    });

    const loginBody = JSON.parse(loginRes.body);
    return {
      userId,
      email,
      accessToken: loginBody.data.accessToken as string
    };
  }

  // ==========================================================================
  // Priority 1: Secure Upload Ownership & File Validation (Section 3.8)
  // ==========================================================================
  describe("Priority 1: Secure Upload Ownership & Intent Validation", () => {
    let hostA: { userId: string; accessToken: string };
    let hostB: { userId: string; accessToken: string };
    let traveller: { userId: string; accessToken: string };
    let businessAId: string;
    let businessBId: string;
    let locationAId: string;

    beforeAll(async () => {
      hostA = await createTestUser("HOST_OWNER", "HostA");
      hostB = await createTestUser("HOST_OWNER", "HostB");
      traveller = await createTestUser("TRAVELLER", "Traveller");

      // Host A creates Business A
      const bResA = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          legalBusinessName: "Alpha Logistics PVT LTD",
          tradeName: "Alpha Luggage Hub",
          entityType: "PRIVATE_LIMITED",
          contactEmail: "alpha@hub.lk",
          contactPhone: "+94771112222",
          city: "Colombo"
        }
      });
      businessAId = JSON.parse(bResA.body).data.id;

      // Host B creates Business B
      const bResB = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${hostB.accessToken}` },
        payload: {
          legalBusinessName: "Beta Storage PVT LTD",
          tradeName: "Beta Storage",
          entityType: "SOLE_PROPRIETORSHIP",
          contactEmail: "beta@storage.lk",
          contactPhone: "+94773334444",
          city: "Galle"
        }
      });
      businessBId = JSON.parse(bResB.body).data.id;

      // Host A creates Location A
      const locRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/locations",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          businessId: businessAId,
          name: "Alpha Fort Station Hub",
          addressLine1: "123 Main Street",
          city: "Colombo",
          latitude: 6.9344,
          longitude: 79.8500
        }
      });
      locationAId = JSON.parse(locRes.body).data.id;
    });

    it("Scenario 1: A host owner can initiate an authorized verification upload", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          purpose: "HOST_VERIFICATION",
          resourceId: businessAId,
          fileName: "business-registration.pdf",
          fileSize: 1048576,
          mimeType: "application/pdf"
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body).data;
      expect(body.intentId).toBeDefined();
      expect(body.fileKey).toContain(`verifications/${businessAId}/`);
      expect(body.uploadUrl).toBeDefined();

      // Verify intent exists in database
      const intentRow = await runtimePool.query(
        "SELECT * FROM upload_intents WHERE id = $1",
        [body.intentId]
      );
      expect(intentRow.rows.length).toBe(1);
      expect(intentRow.rows[0].status).toBe("PENDING");
      expect(intentRow.rows[0].user_id).toBe(hostA.userId);
    });

    it("Scenario 2: A host owner cannot upload against another host's business", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          purpose: "HOST_VERIFICATION",
          resourceId: businessBId, // Host B's business!
          fileName: "hack.pdf",
          fileSize: 1048576,
          mimeType: "application/pdf"
        }
      });

      expect(res.statusCode).toBe(403);
    });

    it("Scenario 3: A host owner cannot upload against another host's location", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostB.accessToken}` },
        payload: {
          purpose: "LOCATION_IMAGE",
          resourceId: locationAId, // Host A's location!
          fileName: "photo.jpg",
          fileSize: 524288,
          mimeType: "image/jpeg"
        }
      });

      expect(res.statusCode).toBe(403);
    });

    it("Scenario 4: A traveller cannot initiate a host verification upload", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          purpose: "HOST_VERIFICATION",
          resourceId: businessAId,
          fileName: "fake-id.pdf",
          fileSize: 1048576,
          mimeType: "application/pdf"
        }
      });

      // Revoked upload.initiate from TRAVELLER role or forbidden
      expect([403]).toContain(res.statusCode);
    });

    it("Scenario 5: A traveller cannot initiate a location image upload without authorization", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          purpose: "LOCATION_IMAGE",
          resourceId: locationAId,
          fileName: "photo.jpg",
          fileSize: 524288,
          mimeType: "image/jpeg"
        }
      });

      expect([403]).toContain(res.statusCode);
    });

    it("Scenario 6: A user cannot confirm an upload created by another user", async () => {
      // Host A initiates
      const initRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          purpose: "HOST_VERIFICATION",
          resourceId: businessAId,
          fileName: "alpha-br.pdf",
          fileSize: 1048576,
          mimeType: "application/pdf"
        }
      });
      const initData = JSON.parse(initRes.body).data;

      // Host B attempts to confirm Host A's intent
      const confirmRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/confirm",
        headers: { authorization: `Bearer ${hostB.accessToken}` },
        payload: {
          intentId: initData.intentId,
          fileKey: initData.fileKey,
          resourceId: businessAId
        }
      });

      expect(confirmRes.statusCode).toBe(403);
    });

    it("Scenario 7: A user cannot confirm an arbitrary file key without a valid intent", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/confirm",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          fileKey: "arbitrary/unregistered/key.pdf",
          resourceId: businessAId
        }
      });

      expect(res.statusCode).toBe(404);
    });

    it("Scenario 8: A user cannot confirm an upload with a mismatched target resource", async () => {
      const initRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          purpose: "HOST_VERIFICATION",
          resourceId: businessAId,
          fileName: "cert.pdf",
          fileSize: 1048576,
          mimeType: "application/pdf"
        }
      });
      const initData = JSON.parse(initRes.body).data;

      const confirmRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/confirm",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          intentId: initData.intentId,
          fileKey: initData.fileKey,
          resourceId: businessBId // Mismatched!
        }
      });

      expect(confirmRes.statusCode).toBe(400);
    });

    it("Scenario 9: A user cannot confirm an expired intent", async () => {
      const initRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          purpose: "HOST_VERIFICATION",
          resourceId: businessAId,
          fileName: "cert-expire.pdf",
          fileSize: 1048576,
          mimeType: "application/pdf"
        }
      });
      const initData = JSON.parse(initRes.body).data;

      // Manually set expiration in past
      await runtimePool.query(
        "UPDATE upload_intents SET expires_at = NOW() - INTERVAL '1 hour' WHERE id = $1",
        [initData.intentId]
      );

      const confirmRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/confirm",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          intentId: initData.intentId,
          fileKey: initData.fileKey,
          resourceId: businessAId
        }
      });

      expect(confirmRes.statusCode).toBe(400);
      expect(JSON.parse(confirmRes.body).error.message).toContain("expired");
    });

    it("Scenario 10: A user cannot confirm an upload that has not reached object storage", async () => {
      const initRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          purpose: "HOST_VERIFICATION",
          resourceId: businessAId,
          fileName: "ghost-file.pdf",
          fileSize: 1048576,
          mimeType: "application/pdf"
        }
      });
      const initData = JSON.parse(initRes.body).data;

      // Do NOT simulate upload in storage adapter -> file missing!
      const confirmRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/confirm",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          intentId: initData.intentId,
          fileKey: initData.fileKey,
          resourceId: businessAId
        }
      });

      expect(confirmRes.statusCode).toBe(400);
      expect(JSON.parse(confirmRes.body).error.message).toContain("not exist in object storage");
    });

    it("Scenario 11: A user cannot confirm an object with invalid metadata (size exceeded)", async () => {
      const initRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          purpose: "HOST_VERIFICATION",
          resourceId: businessAId,
          fileName: "oversize-actual.pdf",
          fileSize: 1048576, // 1MB max requested
          mimeType: "application/pdf"
        }
      });
      const initData = JSON.parse(initRes.body).data;

      // Simulate object uploaded with actual size of 5MB (exceeds authorized maxFileSize)
      storageService.simulateUpload?.(initData.fileKey, {
        mimeType: "application/pdf",
        size: 5 * 1048576
      });

      const confirmRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/confirm",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          intentId: initData.intentId,
          fileKey: initData.fileKey,
          resourceId: businessAId
        }
      });

      expect(confirmRes.statusCode).toBe(400);
      expect(JSON.parse(confirmRes.body).error.message).toContain("exceeds the authorized maximum");
    });

    it("Scenario 12: A verification submission cannot associate an unconfirmed upload", async () => {
      const initRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          purpose: "HOST_VERIFICATION",
          resourceId: businessAId,
          fileName: "unconfirmed-doc.pdf",
          fileSize: 1048576,
          mimeType: "application/pdf"
        }
      });
      const initData = JSON.parse(initRes.body).data;

      // Attempt to submit verification without confirming upload first
      const verifRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/businesses/${businessAId}/verification`,
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          documents: [
            {
              documentType: "BUSINESS_REGISTRATION",
              intentId: initData.intentId,
              fileKey: initData.fileKey
            }
          ]
        }
      });

      expect(verifRes.statusCode).toBe(400);
      expect(JSON.parse(verifRes.body).error.message).toContain("not confirmed");
    });

    it("Scenario 13: A verification submission cannot reuse another business's upload", async () => {
      // Host B initiates and confirms an upload for Business B
      const initRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostB.accessToken}` },
        payload: {
          purpose: "HOST_VERIFICATION",
          resourceId: businessBId,
          fileName: "beta-doc.pdf",
          fileSize: 1048576,
          mimeType: "application/pdf"
        }
      });
      const initData = JSON.parse(initRes.body).data;
      storageService.simulateUpload?.(initData.fileKey, { mimeType: "application/pdf", size: 1024 });

      await app.inject({
        method: "POST",
        url: "/api/v1/uploads/confirm",
        headers: { authorization: `Bearer ${hostB.accessToken}` },
        payload: {
          intentId: initData.intentId,
          fileKey: initData.fileKey,
          resourceId: businessBId
        }
      });

      // Host A attempts to attach Host B's confirmed document to Business A
      const verifRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/businesses/${businessAId}/verification`,
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          documents: [
            {
              documentType: "BUSINESS_REGISTRATION",
              intentId: initData.intentId,
              fileKey: initData.fileKey
            }
          ]
        }
      });

      expect(verifRes.statusCode).toBe(403);
    });

    it("Scenario 14: Repeated confirmation does not create duplicate associations", async () => {
      const initRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          purpose: "LOCATION_IMAGE",
          resourceId: locationAId,
          fileName: "facade.jpg",
          fileSize: 524288,
          mimeType: "image/jpeg"
        }
      });
      const initData = JSON.parse(initRes.body).data;
      storageService.simulateUpload?.(initData.fileKey, { mimeType: "image/jpeg", size: 524288 });

      // First confirmation
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/confirm",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          intentId: initData.intentId,
          fileKey: initData.fileKey,
          resourceId: locationAId
        }
      });
      expect(res1.statusCode).toBe(200);

      // Repeated confirmation
      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/confirm",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          intentId: initData.intentId,
          fileKey: initData.fileKey,
          resourceId: locationAId
        }
      });
      expect(res2.statusCode).toBe(200);

      // Verify only ONE media record exists for this fileKey
      const mediaCount = await runtimePool.query(
        "SELECT COUNT(*)::integer as count FROM location_media WHERE file_key = $1",
        [initData.fileKey]
      );
      expect(mediaCount.rows[0].count).toBe(1);
    });
  });

  // ==========================================================================
  // Priority 2: Eliminate Exact Location Distance Leakage (Section 4.3)
  // ==========================================================================
  describe("Priority 2: Location Privacy & Distance Leakage Prevention", () => {
    let host: { accessToken: string };
    let locationId: string;
    const exactLat = 6.934444; // Exact entrance
    const exactLng = 79.851111;

    beforeAll(async () => {
      host = await createTestUser("HOST_OWNER", "GeoHost");

      const bRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          legalBusinessName: "Geo Test PVT LTD",
          tradeName: "Geo Safe Hub",
          entityType: "RETAIL_SHOP",
          contactEmail: "geo@safe.lk",
          contactPhone: "+94770008888",
          city: "Colombo"
        }
      });
      const bizId = JSON.parse(bRes.body).data.id;

      const locRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/locations",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          businessId: bizId,
          name: "Geospatial Privacy Test Hub",
          addressLine1: "42 Classified Entrance Lane",
          city: "Colombo",
          latitude: exactLat,
          longitude: exactLng
        }
      });
      locationId = JSON.parse(locRes.body).data.id;

      // Activate business and location
      await runtimePool.query("UPDATE host_businesses SET status = 'ACTIVE' WHERE id = $1", [bizId]);
      await runtimePool.query("UPDATE storage_locations SET status = 'ACTIVE' WHERE id = $1", [locationId]);
    });

    it("Scenario 1 & 2: Public discovery never returns exact stored coordinates or street address", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/discovery/locations/${locationId}`
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;

      // Address fields stripped
      expect(data.addressLine1).toBeUndefined();
      expect(data.addressLine2).toBeUndefined();
      expect(data.postalCode).toBeUndefined();

      // Coordinates coarse (rounded to 2 decimals)
      expect(data.approximateLatitude).toBe(6.93);
      expect(data.approximateLongitude).toBe(79.85);
      expect(data.approximateLatitude).not.toBe(exactLat);
      expect(data.approximateLongitude).not.toBe(exactLng);
    });

    it("Scenario 3 & 4: Public distance is calculated from public coarse coordinates (prevents triangulation)", async () => {
      // Search from origin (6.9000, 79.8000)
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/discovery/locations?latitude=6.9000&longitude=79.8000&radiusMeters=20000"
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      const loc = body.data.locations.find((l: any) => l.id === locationId);
      expect(loc).toBeDefined();

      // The returned distance must match the distance calculated from the coarse public coordinates
      // (6.93, 79.85) to (6.9000, 79.8000) rounded to 100m, NOT the exact hidden coordinates
      const R = 6371000;
      const dLat = ((6.93 - 6.9) * Math.PI) / 180;
      const dLon = ((79.85 - 79.8) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((6.9 * Math.PI) / 180) * Math.cos((6.93 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const expectedCoarseDistance = Math.round((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) / 100) * 100;

      expect(loc.distanceMeters).toBe(expectedCoarseDistance);
    });

    it("Scenario 6: Authorized internal host operations retain exact coordinates", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/hosts/locations/${locationId}`,
        headers: { authorization: `Bearer ${host.accessToken}` }
      });

      expect(res.statusCode).toBe(200);
      const loc = JSON.parse(res.body).data;
      expect(loc.latitude).toBe(exactLat);
      expect(loc.longitude).toBe(exactLng);
      expect(loc.addressLine1).toBe("42 Classified Entrance Lane");
    });
  });

  // ==========================================================================
  // Priority 3: Harden Database Role Assignment (Section 5.6)
  // ==========================================================================
  describe("Priority 3: Database Role Assignment Hardening", () => {
    let regularUser: { userId: string; accessToken: string };
    let superadmin: { userId: string; accessToken: string };

    beforeAll(async () => {
      regularUser = await createTestUser("TRAVELLER", "NormalUser");
      superadmin = await createTestUser("SUPERADMIN", "MasterAdmin");
    });

    it("Scenario 1: A normal user cannot assign themselves SUPERADMIN via SQL function", async () => {
      await expect(
        runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'SUPERADMIN', $1::uuid)",
          [regularUser.userId]
        )
      ).rejects.toThrow(/requires SUPERADMIN authority/i);
    });

    it("Scenario 2: A normal user cannot assign another user SUPERADMIN", async () => {
      const target = await createTestUser("TRAVELLER", "VictimUser");
      await expect(
        runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'SUPERADMIN', $2::uuid)",
          [target.userId, regularUser.userId]
        )
      ).rejects.toThrow(/requires SUPERADMIN authority/i);
    });

    it("Scenario 4: A forged p_assigned_by does not grant authority if assigning actor does not have SUPERADMIN", async () => {
      const fakeAdminId = "00000000-0000-0000-0000-000000000000";
      await expect(
        runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'SUPERADMIN', $2::uuid)",
          [regularUser.userId, fakeAdminId]
        )
      ).rejects.toThrow(/requires SUPERADMIN authority/i);
    });

    it("Scenario 5: Normal host onboarding path can self-assign HOST_OWNER via self_assign_host_owner_role", async () => {
      const newHost = await createTestUser("TRAVELLER", "OnboardingHost");

      // Attempt self-assign before creating business -> should fail
      await expect(
        runtimePool.query("SELECT public.self_assign_host_owner_role($1::uuid)", [newHost.userId])
      ).rejects.toThrow(/does not own a registered host business/i);

      // Create a business
      const bRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${newHost.accessToken}` },
        payload: {
          legalBusinessName: "Self Assign Verified Hub",
          tradeName: "Verified Hub",
          entityType: "SOLE_PROPRIETORSHIP",
          contactEmail: "selfassign@hub.lk",
          contactPhone: "+94770005555",
          city: "Colombo"
        }
      });
      expect(bRes.statusCode).toBe(201);

      // Verify user now has HOST_OWNER role
      const userRoles = await runtimePool.query(
        "SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = $1",
        [newHost.userId]
      );
      expect(userRoles.rows.some((r) => r.code === "HOST_OWNER")).toBe(true);
    });

    it("Scenario 6: An authorized SUPERADMIN can assign permitted roles", async () => {
      const target = await createTestUser("TRAVELLER", "PromotedUser");
      const res = await runtimePool.query(
        "SELECT public.assign_user_role($1::uuid, 'HOST_OWNER', $2::uuid)",
        [target.userId, superadmin.userId]
      );
      expect(res.rows[0].assign_user_role).toBe(true);
    });
  });

  // ==========================================================================
  // Priority 4: Fail Safely When Production R2 Is Not Configured (Section 6.3)
  // ==========================================================================
  describe("Priority 4: Fail Safely When Storage Is Not Configured", () => {
    it("Scenario 1 & 2: Production environment fails validation when R2 configuration is incomplete", () => {
      expect(() => {
        loadConfig({
          NODE_ENV: "production",
          STORAGE_PROVIDER: "memory", // Ephemeral storage forbidden in production
          DATABASE_URL: "postgresql://luggage_user:luggage_password@localhost:5432/luggage_storage_dev",
          DATABASE_SSL: "true",
          DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
          JWT_SECRET: "a_very_long_production_jwt_secret_key_32_chars!",
          COOKIE_SECRET: "a_very_long_production_cookie_secret_key_32!",
          RATE_LIMIT_HASH_SECRET: "a_very_long_production_rate_limit_secret_32!",
          EMAIL_PROVIDER: "zoho",
          ZOHO_SMTP_HOST: "smtp.zoho.eu",
          ZOHO_SMTP_PORT: "587",
          ZOHO_SMTP_USER: "admin@luggage.lk",
          ZOHO_SMTP_PASSWORD: "RealPassword123!",
          PAYOUT_ENCRYPTION_KEY: "prod_payout_encryption_key_32_chars_minimum!"
        });
      }).toThrow(/STORAGE_PROVIDER must be 'r2' in production/i);
    });

    it("Scenario 3: Test environment cleanly supports in-memory storage adapter", () => {
      const adapter = createStorageService();
      expect(adapter).toBeDefined();
    });
  });

  // ==========================================================================
  // Priority 5: Enforce Pricing Policy Integrity in PostgreSQL (Section 7.4)
  // ==========================================================================
  describe("Priority 5: Pricing Policy Integrity & Database Uniqueness", () => {
    let host: { accessToken: string };
    let locationId: string;

    beforeAll(async () => {
      host = await createTestUser("HOST_OWNER", "PricingHost");
      const bRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          legalBusinessName: "Pricing Hub PVT LTD",
          tradeName: "Pricing Hub",
          entityType: "RETAIL_SHOP",
          contactEmail: "pricing@hub.lk",
          contactPhone: "+94770009999",
          city: "Colombo"
        }
      });
      const bId = JSON.parse(bRes.body).data.id;

      const locRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/locations",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          businessId: bId,
          name: "Pricing Integrity Location",
          addressLine1: "1 Pricing Street",
          city: "Colombo",
          latitude: 6.93,
          longitude: 79.85
        }
      });
      locationId = JSON.parse(locRes.body).data.id;
    });

    it("Scenario 1: Creates a valid pricing policy and tier rates", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/hosts/locations/${locationId}/pricing`,
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          currency: "LKR",
          pricingUnit: "CALENDAR_DAY",
          baseRateMinor: 150000,
          tierRates: [
            { bagCategory: "BAG_MEDIUM", rateMinor: 150000, categoryMultiplierBps: 10000 },
            { bagCategory: "BAG_SMALL", rateMinor: 105000, categoryMultiplierBps: 7000 }
          ]
        }
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      expect(data.baseRateMinor).toBe(150000);
      expect(data.status).toBe("ACTIVE");
    });

    it("Scenario 2: Prevents duplicate active policies for the same location at the database level", async () => {
      // Direct raw query attempting to insert a second active policy for the same location
      await expect(
        runtimePool.query(
          "INSERT INTO pricing_policies (location_id, currency, pricing_unit, base_rate_minor, status) VALUES ($1, 'LKR', 'CALENDAR_DAY', 200000, 'ACTIVE')",
          [locationId]
        )
      ).rejects.toThrow(/pricing_policies_location_active_unique/i);
    });

    it("Scenario 3: Updating a pricing policy replaces the existing active policy cleanly", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/hosts/locations/${locationId}/pricing`,
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          currency: "LKR",
          pricingUnit: "CALENDAR_DAY",
          baseRateMinor: 180000
        }
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.baseRateMinor).toBe(180000);

      // Verify only 1 active policy exists for this location in PostgreSQL
      const activePolicies = await runtimePool.query(
        "SELECT COUNT(*)::integer as count FROM pricing_policies WHERE location_id = $1 AND status = 'ACTIVE'",
        [locationId]
      );
      expect(activePolicies.rows[0].count).toBe(1);
    });
  });

  // ==========================================================================
  // Priority 6: Represent Unrated Locations Honestly (Section 8)
  // ==========================================================================
  describe("Priority 6: Unrated Locations Representation", () => {
    let host: { accessToken: string };
    let unratedLocationId: string;

    beforeAll(async () => {
      host = await createTestUser("HOST_OWNER", "UnratedHost");
      const bRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          legalBusinessName: "New Unrated Storage PVT LTD",
          tradeName: "New Unrated Storage",
          entityType: "RETAIL_SHOP",
          contactEmail: "new@unrated.lk",
          contactPhone: "+94770007777",
          city: "Colombo"
        }
      });
      const bId = JSON.parse(bRes.body).data.id;

      const locRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/locations",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          businessId: bId,
          name: "Brand New Unrated Hub",
          addressLine1: "10 New Hub Lane",
          city: "Colombo",
          latitude: 6.92,
          longitude: 79.86
        }
      });
      unratedLocationId = JSON.parse(locRes.body).data.id;

      await runtimePool.query("UPDATE host_businesses SET status = 'ACTIVE' WHERE id = $1", [bId]);
      await runtimePool.query("UPDATE storage_locations SET status = 'ACTIVE' WHERE id = $1", [unratedLocationId]);
    });

    it("Scenario 1: A location with no reviews returns averageRating: null and reviewCount: 0", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/discovery/locations/${unratedLocationId}`
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      expect(data.averageRating).toBeNull();
      expect(data.reviewCount).toBe(0);
    });

    it("Scenario 2: Discovery search does not fabricate a 5.0 star rating for unrated locations", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/discovery/locations?searchTerm=Brand%20New%20Unrated"
      });

      expect(res.statusCode).toBe(200);
      const loc = JSON.parse(res.body).data.locations.find((l: any) => l.id === unratedLocationId);
      expect(loc).toBeDefined();
      expect(loc.averageRating).toBeNull();
      expect(loc.reviewCount).toBe(0);
    });
  });

  // ==========================================================================
  // Priority 7: Protect Host Banking & Payout Information (Section 9.4)
  // ==========================================================================
  describe("Priority 7: Banking & Payout Data Protection", () => {
    let host: { userId: string; accessToken: string };
    let superadmin: { userId: string; accessToken: string };
    let businessId: string;
    const rawAccountNumber = "1092847291029384";

    beforeAll(async () => {
      host = await createTestUser("HOST_OWNER", "BankHost");
      superadmin = await createTestUser("SUPERADMIN", "BankAdmin");

      const bRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          legalBusinessName: "Banking Protection PVT LTD",
          tradeName: "Bank Safe Hub",
          entityType: "PRIVATE_LIMITED",
          contactEmail: "bank@safe.lk",
          contactPhone: "+94770002222",
          city: "Colombo",
          payoutBankName: "Bank of Ceylon",
          payoutAccountNumber: rawAccountNumber,
          payoutAccountName: "Banking Protection PVT LTD",
          payoutBranchCode: "001"
        }
      });
      businessId = JSON.parse(bRes.body).data.id;
    });

    it("Scenario 1: Ordinary host profile responses never expose raw account numbers (masked)", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/hosts/businesses/${businessId}`,
        headers: { authorization: `Bearer ${host.accessToken}` }
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      expect(data.payoutAccountNumber).not.toBe(rawAccountNumber);
      expect(data.payoutAccountNumber).toContain("9384");
      expect(data.payoutAccountNumber).toMatch(/^[•*]+9384$/);
    });

    it("Scenario 3: Sensitive account numbers are encrypted at rest in PostgreSQL", async () => {
      const dbRow = await runtimePool.query(
        "SELECT payout_account_number FROM host_businesses WHERE id = $1",
        [businessId]
      );
      const stored = dbRow.rows[0].payout_account_number;
      expect(stored).not.toBe(rawAccountNumber);
      expect(stored).toContain("enc:v1:");
    });

    it("Scenario 4: Authorized owner can retrieve decrypted payout details via secure endpoint", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/hosts/businesses/${businessId}/payout-details`,
        headers: { authorization: `Bearer ${host.accessToken}` }
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      expect(data.payoutAccountNumber).toBe(rawAccountNumber);
      expect(data.payoutAccountNumberMasked).toMatch(/^[•*]+9384$/);
    });

    it("Scenario 5: Unauthorized third party cannot retrieve sensitive payout details", async () => {
      const otherHost = await createTestUser("HOST_OWNER", "IntruderHost");
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/hosts/businesses/${businessId}/payout-details`,
        headers: { authorization: `Bearer ${otherHost.accessToken}` }
      });

      expect(res.statusCode).toBe(403);
    });

    it("Crypto unit tests: encrypt, decrypt, mask work deterministically", () => {
      const raw = "9876543210123456";
      const encrypted = encryptPayoutAccountNumber(raw);
      expect(encrypted).toContain("enc:v1:");

      const decrypted = decryptPayoutAccountNumber(encrypted);
      expect(decrypted).toBe(raw);

      const masked = maskPayoutAccountNumber(raw);
      expect(masked).toBe("••••••••3456");
    });
  });

  // ==========================================================================
  // Section 10: Host Lifecycle & Re-verification Rules
  // ==========================================================================
  describe("Section 10: Host Lifecycle & Re-verification Invariants", () => {
    let host: { accessToken: string };
    let businessId: string;

    beforeAll(async () => {
      host = await createTestUser("HOST_OWNER", "LifecycleHost");
      const bRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          legalBusinessName: "Lifecycle Test Hub",
          tradeName: "Lifecycle Hub",
          businessRegistrationNumber: "PV-100200",
          entityType: "PRIVATE_LIMITED",
          contactEmail: "life@hub.lk",
          contactPhone: "+94770003333",
          city: "Colombo"
        }
      });
      businessId = JSON.parse(bRes.body).data.id;
    });

    it("Scenario 1: Suspended business cannot create locations", async () => {
      await runtimePool.query("UPDATE host_businesses SET status = 'SUSPENDED' WHERE id = $1", [businessId]);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/locations",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          businessId,
          name: "Suspended Business Location",
          addressLine1: "1 Suspended Way",
          city: "Colombo",
          latitude: 6.93,
          longitude: 79.85
        }
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.message).toContain("suspended");

      // Reset to ACTIVE
      await runtimePool.query("UPDATE host_businesses SET status = 'ACTIVE' WHERE id = $1", [businessId]);
    });

    it("Scenario 3: Changing legal name on an ACTIVE business triggers re-verification (PENDING_VERIFICATION)", async () => {
      // Ensure business is ACTIVE
      await runtimePool.query("UPDATE host_businesses SET status = 'ACTIVE' WHERE id = $1", [businessId]);

      const updateRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/hosts/businesses/${businessId}`,
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          legalBusinessName: "Brand New Legal Name PVT LTD"
        }
      });

      expect(updateRes.statusCode).toBe(200);
      const data = JSON.parse(updateRes.body).data;
      expect(data.status).toBe("PENDING_VERIFICATION");
    });
  });
});
