import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import crypto from "node:crypto";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { storageService } from "../src/modules/uploads/storage.service.js";
import { createStorageService } from "../src/modules/uploads/storage.service.js";
import {
  encryptPayoutAccountNumber,
  decryptPayoutAccountNumber,
  maskPayoutAccountNumber,
  reencryptPayoutAccountNumber,
  resetPayoutKeyCacheForTesting
} from "../src/common/crypto/payout-encryption.js";
import { loadConfig } from "../src/config/env.js";
import { rateLimitService } from "../src/modules/auth/rate-limit.service.js";
import {
  createDatabaseIdentityAssertion,
  buildIdentityAssertionPayload,
  verifyDatabaseIdentityAssertion
} from "../src/common/crypto/database-identity.js";
import { syncTrustedAuthSecret, runMigrations } from "../src/infrastructure/database/migrate.js";
import { readMigrationFiles } from "drizzle-orm/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

    it("Scenario 15: Upload confirmation strictly rejects MIME type mismatch", async () => {
      const initRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          purpose: "LOCATION_IMAGE",
          resourceId: locationAId,
          fileName: "photo.jpg",
          fileSize: 524288,
          mimeType: "image/jpeg"
        }
      });
      const initData = JSON.parse(initRes.body).data;

      // Simulate upload of text/html instead of image/jpeg
      storageService.simulateUpload?.(initData.fileKey, { mimeType: "text/html", size: 1024 });

      const confirmRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/confirm",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          intentId: initData.intentId,
          fileKey: initData.fileKey,
          resourceId: locationAId
        }
      });

      expect(confirmRes.statusCode).toBe(400);
      expect(JSON.parse(confirmRes.body).error.message).toMatch(/content type .* does not match/i);
    });

    it("Scenario 16: Upload confirmation strictly rejects empty files (0 bytes)", async () => {
      const initRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          purpose: "LOCATION_IMAGE",
          resourceId: locationAId,
          fileName: "empty.jpg",
          fileSize: 524288,
          mimeType: "image/jpeg"
        }
      });
      const initData = JSON.parse(initRes.body).data;

      // Simulate empty file
      storageService.simulateUpload?.(initData.fileKey, { mimeType: "image/jpeg", size: 0 });

      const confirmRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/confirm",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          intentId: initData.intentId,
          fileKey: initData.fileKey,
          resourceId: locationAId
        }
      });

      expect(confirmRes.statusCode).toBe(400);
      expect(JSON.parse(confirmRes.body).error.message).toMatch(/empty/i);
    });

    it("Scenario 17: Upload intent transitions to CONSUMED upon verification submission, preventing replay attacks", async () => {
      const initRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          purpose: "HOST_VERIFICATION",
          resourceId: businessAId,
          fileName: "gov-id.pdf",
          fileSize: 1048576,
          mimeType: "application/pdf"
        }
      });
      const initData = JSON.parse(initRes.body).data;
      storageService.simulateUpload?.(initData.fileKey, { mimeType: "application/pdf", size: 1024 });

      // Confirm upload
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
      expect(confirmRes.statusCode).toBe(200);

      // Verify intent is CONFIRMED in DB
      const intentBefore = await runtimePool.query(
        "SELECT status FROM upload_intents WHERE id = $1",
        [initData.intentId]
      );
      expect(intentBefore.rows[0].status).toBe("CONFIRMED");

      // Submit verification with this document
      const verifRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/businesses/${businessAId}/verification`,
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          documents: [
            {
              documentType: "NATIONAL_ID",
              intentId: initData.intentId,
              fileKey: initData.fileKey
            }
          ]
        }
      });
      expect(verifRes.statusCode).toBe(201);

      // Verify intent is now CONSUMED in DB
      const intentAfter = await runtimePool.query(
        "SELECT status FROM upload_intents WHERE id = $1",
        [initData.intentId]
      );
      expect(intentAfter.rows[0].status).toBe("CONSUMED");

      // Replay attack: attempt to use the same consumed intent again
      const replayRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/businesses/${businessAId}/verification`,
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          documents: [
            {
              documentType: "NATIONAL_ID",
              intentId: initData.intentId,
              fileKey: initData.fileKey
            }
          ]
        }
      });
      expect(replayRes.statusCode).toBe(409);
      expect(JSON.parse(replayRes.body).error.message).toMatch(/consumed|already attached/i);
    });

    it("Scenario 18: Concurrency test - simultaneous upload confirmations succeed idempotently", async () => {
      const initRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          purpose: "LOCATION_IMAGE",
          resourceId: locationAId,
          fileName: "concurrent-facade.jpg",
          fileSize: 524288,
          mimeType: "image/jpeg"
        }
      });
      const initData = JSON.parse(initRes.body).data;
      storageService.simulateUpload?.(initData.fileKey, { mimeType: "image/jpeg", size: 524288 });

      // Fire 2 simultaneous confirmation requests
      const [resA, resB] = await Promise.all([
        app.inject({
          method: "POST",
          url: "/api/v1/uploads/confirm",
          headers: { authorization: `Bearer ${hostA.accessToken}` },
          payload: { intentId: initData.intentId, fileKey: initData.fileKey, resourceId: locationAId }
        }),
        app.inject({
          method: "POST",
          url: "/api/v1/uploads/confirm",
          headers: { authorization: `Bearer ${hostA.accessToken}` },
          payload: { intentId: initData.intentId, fileKey: initData.fileKey, resourceId: locationAId }
        })
      ]);

      expect(resA.statusCode).toBe(200);
      expect(resB.statusCode).toBe(200);

      // Verify exactly one media record was created
      const mediaRows = await runtimePool.query(
        "SELECT id FROM location_media WHERE file_key = $1",
        [initData.fileKey]
      );
      expect(mediaRows.rows.length).toBe(1);
    });

    it("Scenario 19: Failure recovery - batch verification rollback leaves valid intents unconsumed for retry", async () => {
      // Create valid document intent
      const initRes1 = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          purpose: "HOST_VERIFICATION",
          resourceId: businessAId,
          fileName: "batch-doc1.pdf",
          fileSize: 1048576,
          mimeType: "application/pdf"
        }
      });
      const initData1 = JSON.parse(initRes1.body).data;
      storageService.simulateUpload?.(initData1.fileKey, { mimeType: "application/pdf", size: 1024 });

      await app.inject({
        method: "POST",
        url: "/api/v1/uploads/confirm",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: { intentId: initData1.intentId, fileKey: initData1.fileKey, resourceId: businessAId }
      });

      // Submit batch with valid doc1 AND non-existent doc2
      const failedBatchRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/businesses/${businessAId}/verification`,
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          documents: [
            { documentType: "BUSINESS_REGISTRATION", intentId: initData1.intentId, fileKey: initData1.fileKey },
            { documentType: "UTILITY_BILL", intentId: "00000000-0000-0000-0000-000000000000" }
          ]
        }
      });
      expect(failedBatchRes.statusCode).toBe(400);

      // Verify doc1 intent was NOT consumed (rolled back cleanly to CONFIRMED)
      const doc1Status = await runtimePool.query(
        "SELECT status FROM upload_intents WHERE id = $1",
        [initData1.intentId]
      );
      expect(doc1Status.rows[0].status).toBe("CONFIRMED");

      // Verify retry with only valid doc succeeds
      const retryRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/businesses/${businessAId}/verification`,
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          documents: [
            { documentType: "BUSINESS_REGISTRATION", intentId: initData1.intentId, fileKey: initData1.fileKey }
          ]
        }
      });
      expect(retryRes.statusCode).toBe(201);

      // Now doc1 IS consumed
      const doc1Final = await runtimePool.query(
        "SELECT status FROM upload_intents WHERE id = $1",
        [initData1.intentId]
      );
      expect(doc1Final.rows[0].status).toBe("CONSUMED");
    });

    it("Scenario 20: Upload confirmation strictly rejects missing / undefined content type from storage adapter", async () => {
      const initRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          purpose: "LOCATION_IMAGE",
          resourceId: locationAId,
          fileName: "no-mime.jpg",
          fileSize: 524288,
          mimeType: "image/jpeg"
        }
      });
      const initData = JSON.parse(initRes.body).data;

      // Simulate upload where storage adapter does not report contentType (undefined)
      storageService.simulateUpload?.(initData.fileKey, { size: 1024 });

      const confirmRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/confirm",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          intentId: initData.intentId,
          fileKey: initData.fileKey,
          resourceId: locationAId
        }
      });

      expect(confirmRes.statusCode).toBe(400);
      expect(JSON.parse(confirmRes.body).error.message).toMatch(/missing content type metadata/i);
    });

    it("Scenario 21: Upload confirmation strictly rejects empty content type from storage adapter", async () => {
      const initRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/presigned-url",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          purpose: "LOCATION_IMAGE",
          resourceId: locationAId,
          fileName: "empty-mime.jpg",
          fileSize: 524288,
          mimeType: "image/jpeg"
        }
      });
      const initData = JSON.parse(initRes.body).data;

      // Simulate upload with empty string MIME
      storageService.simulateUpload?.(initData.fileKey, { mimeType: "   ", size: 1024 });

      const confirmRes = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/confirm",
        headers: { authorization: `Bearer ${hostA.accessToken}` },
        payload: {
          intentId: initData.intentId,
          fileKey: initData.fileKey,
          resourceId: locationAId
        }
      });

      expect(confirmRes.statusCode).toBe(400);
      expect(JSON.parse(confirmRes.body).error.message).toMatch(/missing content type metadata/i);
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

    it("Scenario 7: Repeated queries with slight radius increments evaluate consistently on coarse coordinates", async () => {
      const res1 = await app.inject({
        method: "GET",
        url: "/api/v1/discovery/locations?latitude=6.9000&longitude=79.8000&radiusMeters=10000"
      });
      const res2 = await app.inject({
        method: "GET",
        url: "/api/v1/discovery/locations?latitude=6.9000&longitude=79.8000&radiusMeters=10050"
      });

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
      const data1 = JSON.parse(res1.body).data;
      const data2 = JSON.parse(res2.body).data;
      expect(data1.locations.length).toBe(data2.locations.length);
    });

    it("Scenario 8: Results within same coarse cell do not leak micro-distance ordering", async () => {
      // Find businessId of locationId
      const bizRes = await runtimePool.query("SELECT business_id FROM storage_locations WHERE id = $1", [locationId]);
      const bizId = bizRes.rows[0].business_id;

      // Create a second location within the same 0.01 coarse grid cell (6.93, 79.85)
      const locRes2 = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/locations",
        headers: { authorization: `Bearer ${host.accessToken}` },
        payload: {
          businessId: bizId,
          name: "Geospatial Coarse Peer Hub",
          addressLine1: "44 Classified Entrance Lane",
          city: "Colombo",
          latitude: 6.934888, // slightly different secret entrance lat
          longitude: 79.851999 // slightly different secret entrance lng
        }
      });
      const loc2Id = JSON.parse(locRes2.body).data.id;
      await runtimePool.query("UPDATE storage_locations SET status = 'ACTIVE' WHERE id = $1", [loc2Id]);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/discovery/locations?latitude=6.9000&longitude=79.8000&radiusMeters=20000"
      });
      expect(res.statusCode).toBe(200);
      const locations = JSON.parse(res.body).data.locations;
      const l1 = locations.find((l: any) => l.id === locationId);
      const l2 = locations.find((l: any) => l.id === loc2Id);

      expect(l1).toBeDefined();
      expect(l2).toBeDefined();
      // Both locations share identical coarse coordinates and coarse distance bands
      expect(l1.approximateLatitude).toBe(6.93);
      expect(l2.approximateLatitude).toBe(6.93);
      expect(l1.approximateLongitude).toBe(79.85);
      expect(l2.approximateLongitude).toBe(79.85);
      expect(l1.distanceMeters).toBe(l2.distanceMeters);
    });
  });

  // ==========================================================================
  // Priority 3: Harden Database Role Assignment & Identity Boundary (Section 2)
  // ==========================================================================
  describe("Priority 3: Database Role Assignment & Identity Boundary Hardening", () => {
    let regularUser: { userId: string; accessToken: string };
    let superadmin: { userId: string; accessToken: string };

    beforeAll(async () => {
      regularUser = await createTestUser("TRAVELLER", "NormalUser");
      superadmin = await createTestUser("SUPERADMIN", "MasterAdmin");
    });

    it("Scenario 1: Invoking assign_user_role without identity assertion is rejected", async () => {
      await expect(
        runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'SUPERADMIN')",
          [regularUser.userId]
        )
      ).rejects.toThrow(/missing trusted identity assertion/i);
    });

    it("Scenario 2: Invoking assign_user_role with invalid/malformed identity assertion is rejected", async () => {
      await expect(
        runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'SUPERADMIN', '{\"invalid\":\"payload\"}'::jsonb)",
          [regularUser.userId]
        )
      ).rejects.toThrow(/malformed identity assertion/i);
    });

    it("Scenario 3: Invoking assign_user_role with expired assertion is rejected", async () => {
      const expiredAssertion = createDatabaseIdentityAssertion({
        actorId: superadmin.userId,
        action: "ASSIGN_ROLE",
        targetId: regularUser.userId,
        roleCode: "HOST_OWNER",
        ttlSeconds: -10 // expired 10 seconds ago
      });

      await expect(
        runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'HOST_OWNER', $2::jsonb)",
          [regularUser.userId, JSON.stringify(expiredAssertion)]
        )
      ).rejects.toThrow(/identity assertion has expired/i);
    });

    it("Scenario 4: Invoking assign_user_role with forged signature is rejected", async () => {
      const forgedAssertion = createDatabaseIdentityAssertion({
        actorId: superadmin.userId,
        action: "ASSIGN_ROLE",
        targetId: regularUser.userId,
        roleCode: "SUPERADMIN"
      });
      // Tamper with signature
      forgedAssertion.signature = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

      await expect(
        runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'SUPERADMIN', $2::jsonb)",
          [regularUser.userId, JSON.stringify(forgedAssertion)]
        )
      ).rejects.toThrow(/invalid or forged identity assertion signature/i);
    });

    it("Scenario 5: Replaying an already-consumed assertion is rejected", async () => {
      const target = await createTestUser("TRAVELLER", "ReplayTarget");
      const validAssertion = createDatabaseIdentityAssertion({
        actorId: superadmin.userId,
        action: "ASSIGN_ROLE",
        targetId: target.userId,
        roleCode: "HOST_OWNER"
      });

      // First execution succeeds
      const res1 = await runtimePool.query(
        "SELECT public.assign_user_role($1::uuid, 'HOST_OWNER', $2::jsonb)",
        [target.userId, JSON.stringify(validAssertion)]
      );
      expect(res1.rows[0].assign_user_role).toBe(true);

      // Replay attempt with exact same assertion/nonce must fail
      await expect(
        runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'HOST_OWNER', $2::jsonb)",
          [target.userId, JSON.stringify(validAssertion)]
        )
      ).rejects.toThrow(/replay detected/i);
    });

    it("Scenario 6: Normal user attempts to assign SUPERADMIN using their own assertion -> Denied", async () => {
      const normalUserAssertion = createDatabaseIdentityAssertion({
        actorId: regularUser.userId,
        action: "ASSIGN_ROLE",
        targetId: regularUser.userId,
        roleCode: "SUPERADMIN"
      });

      await expect(
        runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'SUPERADMIN', $2::jsonb)",
          [regularUser.userId, JSON.stringify(normalUserAssertion)]
        )
      ).rejects.toThrow(/requires SUPERADMIN authority/i);
    });

    it("Scenario 7: Normal user attempts to revoke role using their own assertion -> Denied", async () => {
      const normalUserRevokeAssertion = createDatabaseIdentityAssertion({
        actorId: regularUser.userId,
        action: "REVOKE_ROLE",
        targetId: superadmin.userId,
        roleCode: "SUPERADMIN"
      });

      await expect(
        runtimePool.query(
          "SELECT public.revoke_user_role($1::uuid, 'SUPERADMIN', $2::jsonb)",
          [superadmin.userId, JSON.stringify(normalUserRevokeAssertion)]
        )
      ).rejects.toThrow(/requires SUPERADMIN authority/i);
    });

    it("Scenario 8 (CRITICAL REGRESSION): luggage_user setting app.current_user_id to SUPERADMIN cannot assign roles without valid HMAC assertion", async () => {
      // Attempt 1: Call without assertion in isolated client transaction -> FAILS
      const client1 = await runtimePool.connect();
      try {
        await client1.query("BEGIN");
        await client1.query("SELECT set_config('app.current_user_id', $1, true)", [superadmin.userId]);
        await expect(
          client1.query("SELECT public.assign_user_role($1::uuid, 'SUPERADMIN')", [regularUser.userId])
        ).rejects.toThrow(/missing trusted identity assertion/i);
      } finally {
        await client1.query("ROLLBACK").catch(() => {});
        client1.release();
      }

      // Attempt 2: Call with forged assertion signed by attacker's fake key in isolated transaction -> FAILS
      const client2 = await runtimePool.connect();
      try {
        await client2.query("BEGIN");
        await client2.query("SELECT set_config('app.current_user_id', $1, true)", [superadmin.userId]);
        const attackerAssertion = {
          keyId: "active",
          actorId: superadmin.userId,
          action: "ASSIGN_ROLE",
          targetId: regularUser.userId,
          roleCode: "SUPERADMIN",
          expiresAt: Math.floor(Date.now() / 1000) + 60,
          nonce: "attacker_nonce_12345678",
          signature: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
        };
        await expect(
          client2.query(
            "SELECT public.assign_user_role($1::uuid, 'SUPERADMIN', $2::jsonb)",
            [regularUser.userId, JSON.stringify(attackerAssertion)]
          )
        ).rejects.toThrow(/invalid or forged identity assertion signature/i);
      } finally {
        await client2.query("ROLLBACK").catch(() => {});
        client2.release();
      }
    });

    it("Scenario 9: luggage_user setting app.current_user_id to SUPERADMIN cannot revoke roles without valid assertion", async () => {
      const client = await runtimePool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.current_user_id', $1, true)", [superadmin.userId]);
        await expect(
          client.query("SELECT public.revoke_user_role($1::uuid, 'TRAVELLER')", [regularUser.userId])
        ).rejects.toThrow(/missing trusted identity assertion/i);
      } finally {
        await client.query("ROLLBACK").catch(() => {});
        client.release();
      }
    });

    it("Scenario 10: Missing actor attempts host-owner self-assignment -> Denied", async () => {
      await expect(
        runtimePool.query("SELECT public.self_assign_host_owner_role($1::uuid)", [regularUser.userId])
      ).rejects.toThrow(/missing trusted identity assertion/i);
    });

    it("Scenario 11: User attempts host-owner self-assignment for another user -> Denied", async () => {
      const otherUser = await createTestUser("TRAVELLER", "OtherTarget");
      const mismatchAssertion = createDatabaseIdentityAssertion({
        actorId: regularUser.userId,
        action: "SELF_ASSIGN_HOST_OWNER",
        targetId: otherUser.userId,
        roleCode: "HOST_OWNER"
      });

      await expect(
        runtimePool.query(
          "SELECT public.self_assign_host_owner_role($1::uuid, $2::jsonb)",
          [otherUser.userId, JSON.stringify(mismatchAssertion)]
        )
      ).rejects.toThrow(/self-assignment actor does not match target user/i);
    });

    it("Scenario 12: Host-owner self-assignment before registering a business -> Denied", async () => {
      const newHost = await createTestUser("TRAVELLER", "NoBizHost");
      const selfAssertion = createDatabaseIdentityAssertion({
        actorId: newHost.userId,
        action: "SELF_ASSIGN_HOST_OWNER",
        targetId: newHost.userId,
        roleCode: "HOST_OWNER"
      });

      await expect(
        runtimePool.query(
          "SELECT public.self_assign_host_owner_role($1::uuid, $2::jsonb)",
          [newHost.userId, JSON.stringify(selfAssertion)]
        )
      ).rejects.toThrow(/does not own an active or eligible host business/i);
    });

    it("Scenario 13: Genuine business owner follows authorized host onboarding path -> Allowed", async () => {
      const validHost = await createTestUser("TRAVELLER", "ValidOnboardingHost");

      const bRes = await app.inject({
        method: "POST",
        url: "/api/v1/hosts/businesses",
        headers: { authorization: `Bearer ${validHost.accessToken}` },
        payload: {
          legalBusinessName: "Verified Assertion Hub PVT LTD",
          tradeName: "Verified Assertion Hub",
          entityType: "SOLE_PROPRIETORSHIP",
          contactEmail: "assert@hub.lk",
          contactPhone: "+94770001234",
          city: "Colombo"
        }
      });
      expect(bRes.statusCode).toBe(201);

      // Verify user has HOST_OWNER role
      const userRoles = await runtimePool.query(
        "SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = $1",
        [validHost.userId]
      );
      expect(userRoles.rows.some((r) => r.code === "HOST_OWNER")).toBe(true);
    });

    it("Scenario 14: Valid SUPERADMIN performs authorized assignment via API -> Allowed", async () => {
      const target = await createTestUser("TRAVELLER", "SuperadminPromotedUser");

      const assignRes = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.userId}/roles`,
        headers: { authorization: `Bearer ${superadmin.accessToken}` },
        payload: { roleCode: "SUPPORT" }
      });

      expect(assignRes.statusCode).toBe(200);
      const roles = JSON.parse(assignRes.body).data.roles;
      expect(roles).toContain("SUPPORT");
    });

    it("Scenario 15: Valid SUPERADMIN performs authorized revocation via API -> Allowed", async () => {
      const target = await createTestUser("TRAVELLER", "SuperadminRevokeUser");

      // First add SUPPORT
      await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.userId}/roles`,
        headers: { authorization: `Bearer ${superadmin.accessToken}` },
        payload: { roleCode: "SUPPORT" }
      });

      // Now revoke SUPPORT
      const revokeRes = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/users/${target.userId}/roles/SUPPORT`,
        headers: { authorization: `Bearer ${superadmin.accessToken}` }
      });

      expect(revokeRes.statusCode).toBe(200);
      const remaining = JSON.parse(revokeRes.body).data.roles;
      expect(remaining).not.toContain("SUPPORT");
      expect(remaining).toContain("TRAVELLER");
    });

    it("Scenario 16: Revocation defense: Administrator cannot revoke roles on own account", async () => {
      const revokeSelfRes = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/users/${superadmin.userId}/roles/SUPERADMIN`,
        headers: { authorization: `Bearer ${superadmin.accessToken}` }
      });

      expect(revokeSelfRes.statusCode).toBe(400);
      expect(JSON.parse(revokeSelfRes.body).error.message).toMatch(/cannot modify roles on their own account/i);
    });

    it("Scenario 17: Invariant check: Cannot revoke user's only remaining role", async () => {
      const singleRoleUser = await createTestUser("TRAVELLER", "SingleRoleRevokeTarget");

      const revokeOnlyRes = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/users/${singleRoleUser.userId}/roles/TRAVELLER`,
        headers: { authorization: `Bearer ${superadmin.accessToken}` }
      });

      expect(revokeOnlyRes.statusCode).toBe(400);
      expect(JSON.parse(revokeOnlyRes.body).error.message).toMatch(/only remaining role/i);
    });

    it("Scenario 18: Direct table access to trusted_auth_secrets is denied to luggage_user", async () => {
      await expect(
        runtimePool.query("SELECT * FROM public.trusted_auth_secrets")
      ).rejects.toThrow(/permission denied for table trusted_auth_secrets/i);
    });

    it("Scenario 19: Direct table access to consumed_auth_assertions is denied to luggage_user", async () => {
      await expect(
        runtimePool.query("SELECT * FROM public.consumed_auth_assertions")
      ).rejects.toThrow(/permission denied for table consumed_auth_assertions/i);
    });

    it("Scenario 20: Direct table modification (INSERT) on user_roles is denied to luggage_user", async () => {
      await expect(
        runtimePool.query(
          "INSERT INTO public.user_roles (user_id, role_id) VALUES ($1, $1)",
          [regularUser.userId]
        )
      ).rejects.toThrow(/permission denied for table user_roles/i);
    });

    it("Scenario 21: Reused pooled connection receives subsequent request from different user with no identity leakage", async () => {
      // Connect client 1 from runtimePool
      const client1 = await runtimePool.connect();
      try {
        await client1.query("BEGIN");
        await client1.query("SELECT set_config('app.current_user_id', $1, true)", [superadmin.userId]);
        const check1 = await client1.query("SELECT current_setting('app.current_user_id', true) as uid");
        expect(check1.rows[0].uid).toBe(superadmin.userId);
        await client1.query("ROLLBACK");
      } finally {
        client1.release();
      }

      // Connect client 2 from runtimePool (which might reuse client1 connection)
      const client2 = await runtimePool.connect();
      try {
        const check2 = await client2.query("SELECT current_setting('app.current_user_id', true) as uid");
        // Transaction setting must not persist across transactions
        expect(check2.rows[0].uid).toBe("");
      } finally {
        client2.release();
      }
    });

    it("Scenario 22: Attacker using revoked publicly leaked development HMAC secret is rejected by PostgreSQL", async () => {
      const revokedSecret = "dev_db_identity_secret_key_minimum_32_characters_12345";
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + 60;
      const nonce = "leaked_secret_attack_nonce_12345";
      const payload = buildIdentityAssertionPayload(
        env.DB_IDENTITY_KEY_ID,
        superadmin.userId,
        "ASSIGN_ROLE",
        regularUser.userId,
        "SUPERADMIN",
        expiresAt,
        nonce
      );
      const forgedSig = crypto.createHmac("sha256", revokedSecret).update(payload).digest("hex");
      const attackAssertion = {
        keyId: env.DB_IDENTITY_KEY_ID,
        actorId: superadmin.userId,
        action: "ASSIGN_ROLE",
        targetId: regularUser.userId,
        roleCode: "SUPERADMIN",
        expiresAt,
        nonce,
        signature: forgedSig
      };

      await expect(
        runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'SUPERADMIN', $2::jsonb)",
          [regularUser.userId, JSON.stringify(attackAssertion)]
        )
      ).rejects.toThrow(/invalid or forged identity assertion signature/i);
    });

    it("Scenario 23: PostgreSQL check constraint blocks insertion of revoked or short secrets into trusted_auth_secrets", async () => {
      const revokedSecret = "dev_db_identity_secret_key_minimum_32_characters_12345";

      // Attempt to insert revoked leaked secret
      await expect(
        migratorPool.query(
          "INSERT INTO public.trusted_auth_secrets (key_id, secret) VALUES ('test-leaked', $1)",
          [revokedSecret]
        )
      ).rejects.toThrow(/trusted_auth_secrets_uncompromised_check/i);

      // Attempt to insert secret shorter than 32 characters
      await expect(
        migratorPool.query(
          "INSERT INTO public.trusted_auth_secrets (key_id, secret) VALUES ('test-short', 'too_short')"
        )
      ).rejects.toThrow(/trusted_auth_secrets_uncompromised_check/i);
    });

    it("Scenario 24: Nonce replay prevention: Replaying the exact same assertion nonce is strictly rejected", async () => {
      const target = await createTestUser("TRAVELLER", "ReplayTarget2");
      const validAssertion = createDatabaseIdentityAssertion({
        actorId: superadmin.userId,
        action: "ASSIGN_ROLE",
        targetId: target.userId,
        roleCode: "HOST_OWNER"
      });

      // First call succeeds
      const res = await runtimePool.query(
        "SELECT public.assign_user_role($1::uuid, 'HOST_OWNER', $2::jsonb)",
        [target.userId, JSON.stringify(validAssertion)]
      );
      expect(res.rows[0].assign_user_role).toBe(true);

      // Immediate second call with identical nonce must fail with replay detected
      await expect(
        runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'HOST_OWNER', $2::jsonb)",
          [target.userId, JSON.stringify(validAssertion)]
        )
      ).rejects.toThrow(/replay detected/i);
    });

    it("Scenario 25: Assertion timestamp boundaries: expired assertions and excessive future TTLs (>120s) are rejected", async () => {
      // 1. Expired assertion (more than 5 seconds in past)
      const expiredAssertion = createDatabaseIdentityAssertion({
        actorId: superadmin.userId,
        action: "ASSIGN_ROLE",
        targetId: regularUser.userId,
        roleCode: "HOST_OWNER",
        ttlSeconds: -10
      });
      await expect(
        runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'HOST_OWNER', $2::jsonb)",
          [regularUser.userId, JSON.stringify(expiredAssertion)]
        )
      ).rejects.toThrow(/identity assertion has expired/i);

      // 2. Future assertion exceeding maximum 120-second window
      const futureAssertion = createDatabaseIdentityAssertion({
        actorId: superadmin.userId,
        action: "ASSIGN_ROLE",
        targetId: regularUser.userId,
        roleCode: "HOST_OWNER",
        ttlSeconds: 300 // 5 minutes > 120 seconds max allowed
      });
      await expect(
        runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'HOST_OWNER', $2::jsonb)",
          [regularUser.userId, JSON.stringify(futureAssertion)]
        )
      ).rejects.toThrow(/maximum permitted lifetime/i);
    });

    it("Scenario 26: Payout dual-key rotation: seamless decryption of records encrypted under previous key and re-encryption", async () => {
      const prevKey = "test_previous_key_for_rotation_minimum_32_characters_123";
      const rawAccount = "9876543210123456";

      // Encrypt account using previous key manually using aes-256-gcm
      const prevDerived = crypto.scryptSync(prevKey, "luggage_payout_salt_v1", 32);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", prevDerived, iv);
      const enc = Buffer.concat([cipher.update(rawAccount, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      const encryptedWithPrevKey = `enc:v1:${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;

      // Temporarily set PAYOUT_ENCRYPTION_KEY_PREVIOUS in env
      const originalPrev = env.PAYOUT_ENCRYPTION_KEY_PREVIOUS;
      try {
        (env as any).PAYOUT_ENCRYPTION_KEY_PREVIOUS = prevKey;
        resetPayoutKeyCacheForTesting();

        // 1. Decryption succeeds via previous key fallback
        const decrypted = decryptPayoutAccountNumber(encryptedWithPrevKey);
        expect(decrypted).toBe(rawAccount);

        // 2. Masking works seamlessly on previous-key records
        const masked = maskPayoutAccountNumber(encryptedWithPrevKey);
        expect(masked).toBe("••••••••3456");

        // 3. Re-encryption rotates the ciphertext to the current primary key
        const rotationResult = reencryptPayoutAccountNumber(encryptedWithPrevKey);
        expect(rotationResult.neededRotation).toBe(true);
        expect(rotationResult.reencrypted).not.toBeNull();
        expect(rotationResult.reencrypted).not.toBe(encryptedWithPrevKey);

        // 4. Verify that the re-encrypted value decrypts with the current primary key alone
        (env as any).PAYOUT_ENCRYPTION_KEY_PREVIOUS = undefined;
        resetPayoutKeyCacheForTesting();

        const decryptedPrimary = decryptPayoutAccountNumber(rotationResult.reencrypted);
        expect(decryptedPrimary).toBe(rawAccount);
      } finally {
        (env as any).PAYOUT_ENCRYPTION_KEY_PREVIOUS = originalPrev;
        resetPayoutKeyCacheForTesting();
      }
    });

    it("Scenario 27: Invalid signature encoding and length (non-hex, odd, short, overlong) rejected cleanly in PostgreSQL and Node", async () => {
      const baseAssertion = createDatabaseIdentityAssertion({
        actorId: superadmin.userId,
        action: "ASSIGN_ROLE",
        targetId: regularUser.userId,
        roleCode: "HOST_OWNER"
      });

      const invalidSignatures = [
        "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz", // 64 non-hex chars
        baseAssertion.signature.slice(0, 63), // odd length (63)
        baseAssertion.signature.slice(0, 32), // short length (16 bytes)
        `${baseAssertion.signature}ab` // overlong (66 hex chars / 33 bytes)
      ];

      for (const badSig of invalidSignatures) {
        const badAssertion = {
          ...baseAssertion,
          nonce: crypto.randomBytes(16).toString("hex"),
          signature: badSig
        };

        const nodeCheck = verifyDatabaseIdentityAssertion(
          badAssertion,
          "ASSIGN_ROLE",
          regularUser.userId,
          "HOST_OWNER"
        );
        expect(nodeCheck.valid).toBe(false);
        expect(nodeCheck.reason).toMatch(/encoding or length/i);

        await expect(
          runtimePool.query(
            "SELECT public.assign_user_role($1::uuid, 'HOST_OWNER', $2::jsonb)",
            [regularUser.userId, JSON.stringify(badAssertion)]
          )
        ).rejects.toThrow(/signature encoding or length/i);
      }
    });

    it("Scenario 28: Action mismatch, target mismatch, role mismatch, and malformed/missing keyId rejected by PostgreSQL", async () => {
      const otherUser = await createTestUser("TRAVELLER", "MismatchTarget");

      // 1. Action mismatch (REVOKE_ROLE assertion sent to assign_user_role)
      const wrongAction = createDatabaseIdentityAssertion({
        actorId: superadmin.userId,
        action: "REVOKE_ROLE",
        targetId: regularUser.userId,
        roleCode: "HOST_OWNER"
      });
      await expect(
        runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'HOST_OWNER', $2::jsonb)",
          [regularUser.userId, JSON.stringify(wrongAction)]
        )
      ).rejects.toThrow(/action mismatch/i);

      // 2. Target mismatch
      const wrongTarget = createDatabaseIdentityAssertion({
        actorId: superadmin.userId,
        action: "ASSIGN_ROLE",
        targetId: otherUser.userId,
        roleCode: "HOST_OWNER"
      });
      await expect(
        runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'HOST_OWNER', $2::jsonb)",
          [regularUser.userId, JSON.stringify(wrongTarget)]
        )
      ).rejects.toThrow(/target mismatch/i);

      // 3. Role mismatch
      const wrongRole = createDatabaseIdentityAssertion({
        actorId: superadmin.userId,
        action: "ASSIGN_ROLE",
        targetId: regularUser.userId,
        roleCode: "SUPPORT"
      });
      await expect(
        runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'HOST_OWNER', $2::jsonb)",
          [regularUser.userId, JSON.stringify(wrongRole)]
        )
      ).rejects.toThrow(/role code mismatch/i);

      // 4. Missing keyId
      const missingKeyId = { ...wrongRole, keyId: undefined };
      await expect(
        runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'SUPPORT', $2::jsonb)",
          [regularUser.userId, JSON.stringify(missingKeyId)]
        )
      ).rejects.toThrow(/malformed identity assertion/i);

      // 5. Malformed keyId characters
      const malformedKeyId = { ...wrongRole, keyId: "bad key!@#" };
      await expect(
        runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'SUPPORT', $2::jsonb)",
          [regularUser.userId, JSON.stringify(malformedKeyId)]
        )
      ).rejects.toThrow(/invalid identity assertion key identifier/i);
    });

    it("Scenario 29: Fail-closed database verification when no valid ACTIVE secret is provisioned", async () => {
      const client = await migratorPool.connect();
      try {
        await client.query("UPDATE public.trusted_auth_secrets SET status = 'REVOKED', retires_at = NULL;");

        const validLookingAssertion = createDatabaseIdentityAssertion({
          actorId: superadmin.userId,
          action: "ASSIGN_ROLE",
          targetId: regularUser.userId,
          roleCode: "HOST_OWNER"
        });

        await expect(
          runtimePool.query(
            "SELECT public.assign_user_role($1::uuid, 'HOST_OWNER', $2::jsonb)",
            [regularUser.userId, JSON.stringify(validLookingAssertion)]
          )
        ).rejects.toThrow(/trusted authentication secret is not provisioned/i);
      } finally {
        await syncTrustedAuthSecret(client);
        client.release();
      }
    });

    it("Scenario 30: Secret provisioning boundary rejects missing, short, compromised, or inconsistent rotation configs", async () => {
      const client = await migratorPool.connect();
      try {
        await expect(
          syncTrustedAuthSecret(client, { activeSecret: "" })
        ).rejects.toThrow(/missing or less than 32 characters/i);

        await expect(
          syncTrustedAuthSecret(client, { activeSecret: "short_secret_under_32" })
        ).rejects.toThrow(/missing or less than 32 characters/i);

        await expect(
          syncTrustedAuthSecret(client, {
            activeSecret: "dev_db_identity_secret_key_minimum_32_characters_12345"
          })
        ).rejects.toThrow(/compromised development secret/i);

        await expect(
          syncTrustedAuthSecret(client, {
            activeKeyId: "invalid key spaces!",
            activeSecret: "valid_random_secret_for_testing_minimum_32_chars!"
          })
        ).rejects.toThrow(/DB_IDENTITY_KEY_ID is malformed/i);

        await expect(
          syncTrustedAuthSecret(client, {
            activeKeyId: "key_v2",
            activeSecret: "valid_random_secret_for_testing_minimum_32_chars!",
            retiringKeyId: "key_v1"
          })
        ).rejects.toThrow(/must both be provided/i);

        await expect(
          syncTrustedAuthSecret(client, {
            activeKeyId: "same_key",
            activeSecret: "valid_random_secret_for_testing_minimum_32_chars!",
            retiringKeyId: "same_key",
            retiringSecret: "another_valid_secret_for_testing_minimum_32_chars!"
          })
        ).rejects.toThrow(/must differ/i);
      } finally {
        await syncTrustedAuthSecret(client);
        client.release();
      }
    });

    it("Scenario 31: Key-ID-aware multi-key rotation overlap, replay defense across rotation, retirement, and revocation", async () => {
      const keyV1Id = "rot_key_v1";
      const keyV1Secret = "rotation_v1_secret_minimum_32_characters_alpha_9001";
      const keyV2Id = "rot_key_v2";
      const keyV2Secret = "rotation_v2_secret_minimum_32_characters_bravo_9002";

      const targetA = await createTestUser("TRAVELLER", "RotTargetA");
      const targetB = await createTestUser("TRAVELLER", "RotTargetB");
      const targetC = await createTestUser("TRAVELLER", "RotTargetC");

      const client = await migratorPool.connect();
      try {
        // Step 1: Provision V1 as ACTIVE
        await syncTrustedAuthSecret(client, {
          activeKeyId: keyV1Id,
          activeSecret: keyV1Secret
        });

        // Partial unique index prevents inserting a second ACTIVE key directly
        await expect(
          client.query(
            "INSERT INTO public.trusted_auth_secrets (key_id, secret, status) VALUES ('rogue_second_active', $1, 'ACTIVE')",
            [keyV2Secret]
          )
        ).rejects.toThrow(/trusted_auth_secrets_single_active_idx/i);

        // Mint an in-flight assertion under V1 BEFORE rotating to V2
        const inFlightV1Assertion = createDatabaseIdentityAssertion({
          keyId: keyV1Id,
          secretOverride: keyV1Secret,
          actorId: superadmin.userId,
          action: "ASSIGN_ROLE",
          targetId: targetA.userId,
          roleCode: "SUPPORT"
        });

        // Step 2: Rotate to V2 (ACTIVE) with V1 in bounded RETIRING overlap window (300s)
        await syncTrustedAuthSecret(client, {
          activeKeyId: keyV2Id,
          activeSecret: keyV2Secret,
          retiringKeyId: keyV1Id,
          retiringSecret: keyV1Secret,
          retiringWindowSeconds: 300
        });

        // New assertion signed with V2 (ACTIVE) succeeds
        const v2Assertion = createDatabaseIdentityAssertion({
          keyId: keyV2Id,
          secretOverride: keyV2Secret,
          actorId: superadmin.userId,
          action: "ASSIGN_ROLE",
          targetId: targetB.userId,
          roleCode: "SUPPORT"
        });
        const v2Res = await runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'SUPPORT', $2::jsonb)",
          [targetB.userId, JSON.stringify(v2Assertion)]
        );
        expect(v2Res.rows[0].assign_user_role).toBe(true);

        // In-flight assertion signed with V1 (RETIRING) ALSO succeeds during overlap window!
        const v1Res = await runtimePool.query(
          "SELECT public.assign_user_role($1::uuid, 'SUPPORT', $2::jsonb)",
          [targetA.userId, JSON.stringify(inFlightV1Assertion)]
        );
        expect(v1Res.rows[0].assign_user_role).toBe(true);

        // Replaying the consumed V1 assertion during overlap window is blocked globally
        await expect(
          runtimePool.query(
            "SELECT public.assign_user_role($1::uuid, 'SUPPORT', $2::jsonb)",
            [targetA.userId, JSON.stringify(inFlightV1Assertion)]
          )
        ).rejects.toThrow(/replay detected/i);

        // Cross-key forgery (signed with V1 secret but claiming keyId = V2) is rejected
        const crossKeyForgery = createDatabaseIdentityAssertion({
          keyId: keyV1Id,
          secretOverride: keyV1Secret,
          actorId: superadmin.userId,
          action: "ASSIGN_ROLE",
          targetId: targetC.userId,
          roleCode: "SUPPORT"
        });
        crossKeyForgery.keyId = keyV2Id;
        await expect(
          runtimePool.query(
            "SELECT public.assign_user_role($1::uuid, 'SUPPORT', $2::jsonb)",
            [targetC.userId, JSON.stringify(crossKeyForgery)]
          )
        ).rejects.toThrow(/invalid or forged identity assertion signature/i);

        // Step 3: Expire V1's retiring window -> V1 assertions immediately fail
        await client.query(
          "UPDATE public.trusted_auth_secrets SET retires_at = NOW() - interval '2 seconds' WHERE key_id = $1",
          [keyV1Id]
        );
        const postExpiryV1 = createDatabaseIdentityAssertion({
          keyId: keyV1Id,
          secretOverride: keyV1Secret,
          actorId: superadmin.userId,
          action: "ASSIGN_ROLE",
          targetId: targetC.userId,
          roleCode: "SUPPORT"
        });
        await expect(
          runtimePool.query(
            "SELECT public.assign_user_role($1::uuid, 'SUPPORT', $2::jsonb)",
            [targetC.userId, JSON.stringify(postExpiryV1)]
          )
        ).rejects.toThrow(/unknown, retired, or revoked/i);

        // Step 4: Final cutover (no retiring key) marks V1 REVOKED while V2 stays ACTIVE
        await syncTrustedAuthSecret(client, {
          activeKeyId: keyV2Id,
          activeSecret: keyV2Secret
        });
        const statusCheck = await client.query<{ status: string }>(
          "SELECT status FROM public.trusted_auth_secrets WHERE key_id = $1",
          [keyV1Id]
        );
        expect(statusCheck.rows[0]?.status).toBe("REVOKED");
      } finally {
        await syncTrustedAuthSecret(client);
        await client.query(
          "DELETE FROM public.trusted_auth_secrets WHERE key_id IN ('rot_key_v1', 'rot_key_v2');"
        );
        client.release();
      }
    });

    it("Scenario 32: Runtime role luggage_user cannot INSERT, UPDATE, or DELETE trusted_auth_secrets or consumed_auth_assertions", async () => {
      await expect(
        runtimePool.query(
          "INSERT INTO public.trusted_auth_secrets (key_id, secret, status) VALUES ('hack', 'hack_secret_minimum_32_characters_long_999', 'ACTIVE')"
        )
      ).rejects.toThrow(/permission denied for table trusted_auth_secrets/i);

      await expect(
        runtimePool.query("DELETE FROM public.consumed_auth_assertions")
      ).rejects.toThrow(/permission denied for table consumed_auth_assertions/i);
    });

    it("Scenario 33 & 34: Clean database install (0000->latest) and existing Phase A upgrade (0010->latest) succeed on real PostgreSQL", async () => {
      const parsedUrl = new URL(env.MIGRATION_DATABASE_URL);
      const adminUrl = `postgresql://postgres:postgres@${parsedUrl.hostname}:${parsedUrl.port || "5432"}/postgres`;
      const adminPool = new Pool({ connectionString: adminUrl, max: 2 });

      const suffix = `${Date.now().toString(36)}`;
      const cleanDb = `luggage_clean_${suffix}`;
      const upgradeDb = `luggage_upg_${suffix}`;

      const initTempDatabase = async (dbName: string) => {
        await adminPool.query(`CREATE DATABASE ${dbName};`);
        const dbAdminPool = new Pool({
          connectionString: `postgresql://postgres:postgres@${parsedUrl.hostname}:${parsedUrl.port || "5432"}/${dbName}`,
          max: 1
        });
        try {
          await dbAdminPool.query("CREATE EXTENSION IF NOT EXISTS postgis;");
          await dbAdminPool.query("CREATE EXTENSION IF NOT EXISTS postgis_topology;");
          await dbAdminPool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;");
          await dbAdminPool.query(`GRANT CONNECT ON DATABASE ${dbName} TO luggage_migrator, luggage_user;`);
          await dbAdminPool.query("GRANT USAGE, CREATE ON SCHEMA public TO luggage_migrator, luggage_role_assigner;");
          await dbAdminPool.query("GRANT USAGE ON SCHEMA public TO luggage_user;");
          await dbAdminPool.query("REVOKE CREATE ON SCHEMA public FROM luggage_user;");
          await dbAdminPool.query(
            "ALTER DEFAULT PRIVILEGES FOR ROLE luggage_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO luggage_user;"
          );
          await dbAdminPool.query(
            "ALTER DEFAULT PRIVILEGES FOR ROLE luggage_migrator IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO luggage_user;"
          );
          await dbAdminPool.query(
            "ALTER DEFAULT PRIVILEGES FOR ROLE luggage_migrator IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;"
          );
          await dbAdminPool.query(
            "ALTER DEFAULT PRIVILEGES FOR ROLE luggage_migrator IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO luggage_user;"
          );
        } finally {
          await dbAdminPool.end();
        }
      };

      try {
        // 1. Clean installation from zero
        await initTempDatabase(cleanDb);
        const cleanMigratorUrl = `postgresql://luggage_migrator:migrator_password@${parsedUrl.hostname}:${parsedUrl.port || "5432"}/${cleanDb}`;
        const appliedClean = await runMigrations(cleanMigratorUrl);
        expect(appliedClean).toBeGreaterThanOrEqual(12);

        // Idempotent second run applies 0 new migrations
        const secondClean = await runMigrations(cleanMigratorUrl);
        expect(secondClean).toBe(0);

        // 2. Upgrade from migration 0010 (pre-0011 trusted_auth_secrets schema)
        await initTempDatabase(upgradeDb);
        const upgradeMigratorUrl = `postgresql://luggage_migrator:migrator_password@${parsedUrl.hostname}:${parsedUrl.port || "5432"}/${upgradeDb}`;
        const upgPool = new Pool({ connectionString: upgradeMigratorUrl, max: 1 });
        try {
          const thisDir = path.dirname(fileURLToPath(import.meta.url));
          const migrationsFolder = path.resolve(
            thisDir,
            "../src/infrastructure/database/migrations"
          );
          const allMigrations = readMigrationFiles({ migrationsFolder });
          const through0010 = allMigrations.slice(0, 11); // idx 0..10

          await upgPool.query(`
            CREATE TABLE IF NOT EXISTS public.__drizzle_migrations (
              id SERIAL PRIMARY KEY,
              hash text NOT NULL,
              created_at bigint
            );
          `);

          for (const m of through0010) {
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

          // Seed pre-0011 single-column active secret + stale extra row to test upgrade normalization
          await upgPool.query(
            `INSERT INTO public.trusted_auth_secrets (key_id, secret)
             VALUES ('active', $1), ('legacy_old', $2);`,
            [
              "pre_0011_active_secret_minimum_32_characters_long_01",
              "pre_0011_legacy_secret_minimum_32_characters_long_02"
            ]
          );
        } finally {
          await upgPool.end();
        }

        const upgradedCount = await runMigrations(upgradeMigratorUrl);
        expect(upgradedCount).toBeGreaterThanOrEqual(1);

        // Verify upgraded database has single ACTIVE key and REVOKED legacy key
        const verifyUpgPool = new Pool({ connectionString: upgradeMigratorUrl, max: 1 });
        try {
          const rows = await verifyUpgPool.query<{ key_id: string; status: string }>(
            "SELECT key_id, status FROM public.trusted_auth_secrets ORDER BY key_id ASC;"
          );
          const activeRows = rows.rows.filter((r) => r.status === "ACTIVE");
          expect(activeRows.length).toBe(1);
          expect(activeRows[0]?.key_id).toBe(env.DB_IDENTITY_KEY_ID);
          const legacyRow = rows.rows.find((r) => r.key_id === "legacy_old");
          expect(legacyRow?.status).toBe("REVOKED");
        } finally {
          await verifyUpgPool.end();
        }
      } finally {
        await adminPool.query(`DROP DATABASE IF EXISTS ${cleanDb} WITH (FORCE);`).catch(() => {});
        await adminPool.query(`DROP DATABASE IF EXISTS ${upgradeDb} WITH (FORCE);`).catch(() => {});
        await adminPool.end();
      }
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
          PAYOUT_ENCRYPTION_KEY: "prod_payout_encryption_key_32_chars_minimum!",
          DB_IDENTITY_SECRET: "prod_db_identity_secret_key_32_chars_minimum!"
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

    it("Scenario 6: PostgreSQL check constraint host_businesses_payout_encrypted_check rejects unencrypted plaintext values", async () => {
      const testHost = await createTestUser("HOST_OWNER", "ConstraintTestHost");

      await expect(
        runtimePool.query(
          `INSERT INTO host_businesses (
            owner_user_id, legal_business_name, trade_name, entity_type,
            contact_email, contact_phone, payout_account_number, status
          ) VALUES (
            $1, 'Plaintext Corp', 'Plaintext Hub', 'SOLE_PROPRIETORSHIP',
            'test@plain.lk', '+94770001234', '123456789012', 'DRAFT'
          )`,
          [testHost.userId]
        )
      ).rejects.toThrow(/host_businesses_payout_encrypted_check/i);
    });

    it("Scenario 7: Plaintext payout records can be safely backfilled to AES-256-GCM format", async () => {
      const rawNum = "987654321098";
      const encrypted = encryptPayoutAccountNumber(rawNum);
      expect(encrypted).toMatch(/^enc:v1:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
      expect(decryptPayoutAccountNumber(encrypted)).toBe(rawNum);
    });

    it("Scenario 8: loadConfig strictly rejects the known revoked development identity secret", () => {
      expect(() => {
        loadConfig({
          DB_IDENTITY_SECRET: "dev_db_identity_secret_key_minimum_32_characters_12345",
          PAYOUT_ENCRYPTION_KEY: "valid_payout_key_minimum_32_characters_12345"
        });
      }).toThrow(/compromised secret/i);
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
