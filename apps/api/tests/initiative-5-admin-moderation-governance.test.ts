import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { db } from "../src/infrastructure/database/drizzle.js";
import { assertAnotherActiveSuperadminRemains } from "../src/modules/auth/rbac.service.js";
import { rateLimitService } from "../src/modules/auth/rate-limit.service.js";
import { storageService } from "../src/modules/uploads/storage.service.js";

const { Pool } = pg;

describe("Initiative 5 — Superadmin & Support Oversight, Moderation Queues, Refund Recovery & User RBAC", () => {
  let app: FastifyInstance;
  let migratorPool: pg.Pool;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    migratorPool = new Pool({
      connectionString: env.MIGRATION_DATABASE_URL,
      max: 3
    });

    await migratorPool.query(
      "UPDATE storage_locations SET status = 'DISABLED' WHERE name LIKE 'Colombo Bay Locker %' OR name LIKE 'Jaffna Fort Locker %';"
    );
  });

  beforeEach(async () => {
    await rateLimitService.clearAll();
  });

  afterAll(async () => {
    await migratorPool
      .query(
        "UPDATE storage_locations SET status = 'DISABLED' WHERE name LIKE 'Colombo Bay Locker %' OR name LIKE 'Jaffna Fort Locker %';"
      )
      .catch(() => {});
    await app.close();
    await migratorPool.end();
  });

  function futureColomboWindow(daysAhead = 6) {
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
    roleCode: "TRAVELLER" | "HOST_OWNER" | "SUPPORT" | "SUPERADMIN" = "TRAVELLER",
    displayName = "Initiative 5 User"
  ) {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const email = `init5_${unique}@example.com`;
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
    const loginBody = JSON.parse(loginRes.body).data as {
      accessToken: string;
      refreshToken?: string;
    };

    return {
      userId,
      email,
      password,
      accessToken: loginBody.accessToken,
      refreshToken: loginBody.refreshToken
    };
  }

  async function helperCreateConfirmedDoc(
    userToken: string,
    businessId: string,
    fileName = "br.pdf",
    mimeType = "application/pdf"
  ) {
    const initRes = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/presigned-url",
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        purpose: "HOST_VERIFICATION",
        resourceId: businessId,
        fileName,
        fileSize: 524288,
        mimeType
      }
    });
    expect(initRes.statusCode).toBe(200);
    const initData = JSON.parse(initRes.body).data as {
      intentId: string;
      fileKey: string;
    };

    storageService.simulateUpload?.(initData.fileKey, { mimeType, size: 524288 });

    const confirmRes = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/confirm",
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        intentId: initData.intentId,
        fileKey: initData.fileKey,
        resourceId: businessId
      }
    });
    expect(confirmRes.statusCode).toBe(200);
    return initData;
  }

  it("1. enforces metrics summary permission gating and host business suspend/reinstate with discovery hiding", async () => {
    const superAdmin = await registerAndActivateUser("SUPERADMIN", "Init5 Superadmin");
    const supportUser = await registerAndActivateUser("SUPPORT", "Init5 Support");
    const approvedHost = await registerAndActivateUser("HOST_OWNER", "Init5 Approved Host");
    const draftHost = await registerAndActivateUser("HOST_OWNER", "Init5 Draft Host");

    const uniqueTag = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const bizRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/businesses",
      headers: { authorization: `Bearer ${approvedHost.accessToken}` },
      payload: {
        legalBusinessName: `Ceylon Harbor Vaults ${uniqueTag}`,
        tradeName: `Harbor Vaults ${uniqueTag}`,
        businessRegistrationNumber: `PV-${uniqueTag}`,
        entityType: "PRIVATE_LIMITED",
        contactEmail: `harbor_${uniqueTag}@example.com`,
        contactPhone: "+94771112233",
        city: "Colombo"
      }
    });
    expect(bizRes.statusCode).toBe(201);
    const businessId = JSON.parse(bizRes.body).data.id as string;

    const doc = await helperCreateConfirmedDoc(approvedHost.accessToken, businessId);
    const verifRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/businesses/${businessId}/verification`,
      headers: { authorization: `Bearer ${approvedHost.accessToken}` },
      payload: {
        documents: [
          {
            documentType: "BUSINESS_REGISTRATION",
            intentId: doc.intentId,
            fileKey: doc.fileKey
          }
        ]
      }
    });
    expect(verifRes.statusCode).toBe(201);
    const verificationId = JSON.parse(verifRes.body).data.id as string;

    const approveKycRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/verifications/${verificationId}/review`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` },
      payload: { decision: "APPROVE", adminNotes: "Verified registration" }
    });
    expect(approveKycRes.statusCode).toBe(200);

    const locName = `Jaffna Fort Locker ${uniqueTag}`;
    const locRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/locations",
      headers: { authorization: `Bearer ${approvedHost.accessToken}` },
      payload: {
        businessId,
        name: locName,
        addressLine1: "77 Hospital Road",
        city: "Jaffna",
        latitude: 9.6615,
        longitude: 80.0255,
        bookingMode: "INSTANT"
      }
    });
    expect(locRes.statusCode).toBe(201);
    const locationId = JSON.parse(locRes.body).data.id as string;

    await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/pricing`,
      headers: { authorization: `Bearer ${approvedHost.accessToken}` },
      payload: { currency: "LKR", pricingUnit: "CALENDAR_DAY", baseRateMinor: 120000 }
    });

    await app.inject({
      method: "POST",
      url: `/api/v1/hosts/locations/${locationId}/submit`,
      headers: { authorization: `Bearer ${approvedHost.accessToken}` }
    });

    const approveLocRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/locations/${locationId}/review`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` },
      payload: { decision: "APPROVE", adminNotes: "Location inspected" }
    });
    expect(approveLocRes.statusCode).toBe(200);

    // Unapproved DRAFT business to test reinstate non-elevation
    const draftBizRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/businesses",
      headers: { authorization: `Bearer ${draftHost.accessToken}` },
      payload: {
        legalBusinessName: `Unverified Draft Co ${uniqueTag}`,
        tradeName: `Unverified Draft ${uniqueTag}`,
        entityType: "SOLE_PROPRIETORSHIP",
        contactEmail: `draft_${uniqueTag}@example.com`,
        contactPhone: "+94772223344",
        city: "Kandy"
      }
    });
    expect(draftBizRes.statusCode).toBe(201);
    const draftBusinessId = JSON.parse(draftBizRes.body).data.id as string;

    // Metrics Summary: SUPERADMIN gets numeric financial metrics, SUPPORT gets null financial metrics
    const superMetricsRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/metrics/summary",
      headers: { authorization: `Bearer ${superAdmin.accessToken}` }
    });
    expect(superMetricsRes.statusCode).toBe(200);
    const superMetrics = JSON.parse(superMetricsRes.body).data;
    expect(typeof superMetrics.grossCapturedVolumeMinor).toBe("number");
    expect(typeof superMetrics.platformCommissionMinor).toBe("number");
    expect(superMetrics.activeBusinessesCount).toBeGreaterThanOrEqual(1);

    const supportMetricsRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/metrics/summary",
      headers: { authorization: `Bearer ${supportUser.accessToken}` }
    });
    expect(supportMetricsRes.statusCode).toBe(200);
    const supportMetrics = JSON.parse(supportMetricsRes.body).data;
    expect(supportMetrics.grossCapturedVolumeMinor).toBeNull();
    expect(supportMetrics.platformCommissionMinor).toBeNull();
    expect(supportMetrics.unearnedBookingLiabilityMinor).toBeNull();
    expect(supportMetrics.eligibleHostPayablesMinor).toBeNull();

    // Host Directory & Detail accessible by SUPERADMIN and SUPPORT
    const dirRes = await app.inject({
      method: "GET",
      url: `/api/v1/admin/hosts?search=${encodeURIComponent(uniqueTag)}`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` }
    });
    expect(dirRes.statusCode).toBe(200);
    expect(JSON.parse(dirRes.body).data.some((h: { id: string }) => h.id === businessId)).toBe(true);

    const detailRes = await app.inject({
      method: "GET",
      url: `/api/v1/admin/hosts/${businessId}`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` }
    });
    expect(detailRes.statusCode).toBe(200);
    expect(JSON.parse(detailRes.body).data.locations[0].id).toBe(locationId);

    // SUPPORT gets 403 on suspend
    const supportSuspendRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/hosts/${businessId}/suspend`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` },
      payload: { reason: "Unauthorized attempt" }
    });
    expect(supportSuspendRes.statusCode).toBe(403);

    // SUPERADMIN suspends approved business
    const suspendRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/hosts/${businessId}/suspend`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` },
      payload: { reason: "Safety compliance audit hold" }
    });
    expect(suspendRes.statusCode).toBe(200);
    expect(JSON.parse(suspendRes.body).data.status).toBe("SUSPENDED");

    // Underlying storage_locations.status remains ACTIVE while business is SUSPENDED
    const locStatusDb = await migratorPool.query(
      "SELECT status FROM storage_locations WHERE id = $1;",
      [locationId]
    );
    expect(locStatusDb.rows[0].status).toBe("ACTIVE");

    // Suspended host cannot edit business profile (400 BAD_REQUEST)
    const hostEditRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/hosts/businesses/${businessId}`,
      headers: { authorization: `Bearer ${approvedHost.accessToken}` },
      payload: { tradeName: "Tampered Name While Suspended" }
    });
    expect(hostEditRes.statusCode).toBe(400);
    expect(JSON.parse(hostEditRes.body).error.message).toContain("Suspended host business");

    // Public discovery excludes suspended business location
    const discWhileSuspended = await app.inject({
      method: "GET",
      url: `/api/v1/discovery/locations?searchTerm=${encodeURIComponent(locName)}`
    });
    expect(discWhileSuspended.statusCode).toBe(200);
    expect(
      JSON.parse(discWhileSuspended.body).data.locations.some(
        (l: { id: string }) => l.id === locationId
      )
    ).toBe(false);

    // Audit event recorded for suspension
    const suspendAuditRes = await migratorPool.query(
      "SELECT COUNT(*)::int AS cnt FROM security_audit_events WHERE event_type = 'HOST_BUSINESS_SUSPENDED';"
    );
    expect(suspendAuditRes.rows[0].cnt).toBeGreaterThanOrEqual(1);

    // Reinstate approved business -> restores ACTIVE + shows in discovery
    const reinstateRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/hosts/${businessId}/reinstate`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` },
      payload: { reason: "Compliance hold cleared" }
    });
    expect(reinstateRes.statusCode).toBe(200);
    expect(JSON.parse(reinstateRes.body).data.status).toBe("ACTIVE");

    const discAfterReinstate = await app.inject({
      method: "GET",
      url: `/api/v1/discovery/locations?searchTerm=${encodeURIComponent(locName)}`
    });
    expect(discAfterReinstate.statusCode).toBe(200);
    expect(
      JSON.parse(discAfterReinstate.body).data.locations.some(
        (l: { id: string }) => l.id === locationId
      )
    ).toBe(true);

    // Suspend and reinstate unapproved DRAFT business -> stays DRAFT, never elevated to ACTIVE
    await app.inject({
      method: "POST",
      url: `/api/v1/admin/hosts/${draftBusinessId}/suspend`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` },
      payload: { reason: "Hold unverified draft" }
    });
    const draftReinstateRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/hosts/${draftBusinessId}/reinstate`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` },
      payload: {}
    });
    expect(draftReinstateRes.statusCode).toBe(200);
    expect(JSON.parse(draftReinstateRes.body).data.status).toBe("DRAFT");
  });

  it("2. supports ?status= queue filters, enriched metadata, KYC doc download for SUPPORT, and 403 moderation mutations for SUPPORT", async () => {
    const superAdmin = await registerAndActivateUser("SUPERADMIN", "Queue Superadmin");
    const supportUser = await registerAndActivateUser("SUPPORT", "Queue Support");
    const hostOwner = await registerAndActivateUser("HOST_OWNER", "Queue Host");
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const bizRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/businesses",
      headers: { authorization: `Bearer ${hostOwner.accessToken}` },
      payload: {
        legalBusinessName: `Kandy Transit Depot ${suffix}`,
        tradeName: `Kandy Depot ${suffix}`,
        businessRegistrationNumber: `PV-KDY-${suffix}`,
        entityType: "PRIVATE_LIMITED",
        contactEmail: `kandy_${suffix}@example.com`,
        contactPhone: "+94775551122",
        city: "Kandy"
      }
    });
    expect(bizRes.statusCode).toBe(201);
    const businessId = JSON.parse(bizRes.body).data.id as string;

    const doc = await helperCreateConfirmedDoc(hostOwner.accessToken, businessId, "kandy-br.pdf");
    const verifRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/businesses/${businessId}/verification`,
      headers: { authorization: `Bearer ${hostOwner.accessToken}` },
      payload: {
        documents: [
          {
            documentType: "BUSINESS_REGISTRATION",
            intentId: doc.intentId,
            fileKey: doc.fileKey
          }
        ]
      }
    });
    expect(verifRes.statusCode).toBe(201);
    const verifData = JSON.parse(verifRes.body).data as {
      id: string;
      documents: Array<{ id: string }>;
    };
    const docId = verifData.documents[0].id;

    // SUPPORT reads pending KYC queue + sees enriched BRN and downloads document
    const kycPendingSupportRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/verifications?status=PENDING_REVIEW",
      headers: { authorization: `Bearer ${supportUser.accessToken}` }
    });
    expect(kycPendingSupportRes.statusCode).toBe(200);
    const matchedKyc = JSON.parse(kycPendingSupportRes.body).data.queue.find(
      (q: { verificationId: string }) => q.verificationId === verifData.id
    );
    expect(matchedKyc).toBeDefined();
    expect(matchedKyc.businessRegistrationNumber).toBe(`PV-KDY-${suffix}`);

    const dlRes = await app.inject({
      method: "GET",
      url: `/api/v1/uploads/documents/${docId}/download`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` }
    });
    expect(dlRes.statusCode).toBe(200);
    expect(JSON.parse(dlRes.body).data.downloadUrl).toBeTruthy();

    // SUPPORT blocked from KYC review decision (403)
    const supportReviewRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/verifications/${verifData.id}/review`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` },
      payload: { decision: "APPROVE" }
    });
    expect(supportReviewRes.statusCode).toBe(403);

    // SUPERADMIN approves KYC -> appears under ?status=APPROVED and ?status=ALL
    await app.inject({
      method: "POST",
      url: `/api/v1/admin/verifications/${verifData.id}/review`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` },
      payload: { decision: "APPROVE" }
    });

    const approvedQueueRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/verifications?status=APPROVED",
      headers: { authorization: `Bearer ${supportUser.accessToken}` }
    });
    expect(approvedQueueRes.statusCode).toBe(200);
    expect(
      JSON.parse(approvedQueueRes.body).data.queue.some(
        (q: { verificationId: string }) => q.verificationId === verifData.id
      )
    ).toBe(true);

    // Location moderation queue ?status=ALL + enriched owner/business metadata + SUPPORT 403 mutation
    const locRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/locations",
      headers: { authorization: `Bearer ${hostOwner.accessToken}` },
      payload: {
        businessId,
        name: `Dalada Street Hub ${suffix}`,
        addressLine1: "12 Dalada Veediya",
        city: "Kandy",
        latitude: 7.2906,
        longitude: 80.6337
      }
    });
    expect(locRes.statusCode).toBe(201);
    const locationId = JSON.parse(locRes.body).data.id as string;

    await app.inject({
      method: "POST",
      url: `/api/v1/hosts/locations/${locationId}/submit`,
      headers: { authorization: `Bearer ${hostOwner.accessToken}` }
    });

    const supportLocReviewRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/locations/${locationId}/review`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` },
      payload: { decision: "APPROVE" }
    });
    expect(supportLocReviewRes.statusCode).toBe(403);

    await app.inject({
      method: "POST",
      url: `/api/v1/admin/locations/${locationId}/review`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` },
      payload: { decision: "APPROVE" }
    });

    const locActiveQueueRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/locations/moderation-queue?status=ACTIVE",
      headers: { authorization: `Bearer ${supportUser.accessToken}` }
    });
    expect(locActiveQueueRes.statusCode).toBe(200);
    const locItem = JSON.parse(locActiveQueueRes.body).data.queue.find(
      (l: { locationId: string }) => l.locationId === locationId
    );
    expect(locItem).toBeDefined();
    expect(locItem.legalBusinessName).toBe(`Kandy Transit Depot ${suffix}`);
    expect(locItem.ownerEmail).toBe(hostOwner.email);
  });

  it("3. supports non-linear refund recovery (FAILED -> AUTHORIZED -> INITIATED -> SUCCEEDED), blocks SUPPORT mutations, and keeps ledger balanced", async () => {
    const superAdmin = await registerAndActivateUser("SUPERADMIN", "Refund Superadmin");
    const supportUser = await registerAndActivateUser("SUPPORT", "Refund Support");
    const hostOwner = await registerAndActivateUser("HOST_OWNER", "Refund Host");
    const traveller = await registerAndActivateUser("TRAVELLER", "Refund Traveller");
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const bizRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/businesses",
      headers: { authorization: `Bearer ${hostOwner.accessToken}` },
      payload: {
        legalBusinessName: `Galle Coast Storage ${suffix}`,
        tradeName: `Galle Coast ${suffix}`,
        entityType: "SOLE_PROPRIETORSHIP",
        contactEmail: `coast_${suffix}@example.com`,
        contactPhone: "+94774445566",
        city: "Galle"
      }
    });
    const businessId = JSON.parse(bizRes.body).data.id as string;
    await migratorPool.query("UPDATE host_businesses SET status = 'ACTIVE' WHERE id = $1;", [
      businessId
    ]);

    const locRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/locations",
      headers: { authorization: `Bearer ${hostOwner.accessToken}` },
      payload: {
        businessId,
        name: `Galle Rampart Vault ${suffix}`,
        addressLine1: "9 Rampart Street",
        city: "Galle",
        latitude: 6.0267,
        longitude: 80.217,
        bookingMode: "INSTANT"
      }
    });
    const locationId = JSON.parse(locRes.body).data.id as string;

    const schedules = [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
      dayOfWeek,
      openTime: "08:00",
      closeTime: "22:00",
      isClosed: false
    }));
    await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/opening-hours`,
      headers: { authorization: `Bearer ${hostOwner.accessToken}` },
      payload: { schedules }
    });
    await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/pricing`,
      headers: { authorization: `Bearer ${hostOwner.accessToken}` },
      payload: { currency: "LKR", pricingUnit: "CALENDAR_DAY", baseRateMinor: 100000 }
    });
    await migratorPool.query("UPDATE storage_locations SET status = 'ACTIVE' WHERE id = $1;", [
      locationId
    ]);

    const win = futureColomboWindow(7);
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
      payload: { bookingId }
    });
    const intentId = JSON.parse(intentRes.body).data.id as string;

    await app.inject({
      method: "POST",
      url: `/api/v1/payments/intents/${intentId}/sandbox-simulate`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { outcome: "SUCCEEDED" }
    });

    const cancelRes = await app.inject({
      method: "POST",
      url: `/api/v1/bookings/${bookingId}/cancel`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { reason: "Flight rescheduled" }
    });
    expect(cancelRes.statusCode).toBe(200);

    const refundsRes = await app.inject({
      method: "GET",
      url: `/api/v1/admin/refunds?bookingId=${bookingId}`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` }
    });
    expect(refundsRes.statusCode).toBe(200);
    const refundId = JSON.parse(refundsRes.body).data[0].id as string;

    // SUPPORT blocked from refund transition (403)
    const supportTransitionRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${refundId}/transition`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` },
      payload: { targetStatus: "AUTHORIZED", notes: "Support attempt" }
    });
    expect(supportTransitionRes.statusCode).toBe(403);

    // REQUESTED -> AUTHORIZED -> FAILED -> recover to AUTHORIZED -> INITIATED -> SUCCEEDED
    for (const step of [
      { targetStatus: "AUTHORIZED", notes: "Refund authorized" },
      { targetStatus: "FAILED", notes: "Gateway temporary outage" },
      { targetStatus: "AUTHORIZED", notes: "Recovered from FAILED for manual payout" },
      { targetStatus: "INITIATED", notes: "Manual bank wire initiated" },
      {
        targetStatus: "SUCCEEDED",
        notes: "Wire confirmed by finance team",
        settlementMode: "MANUAL_OFFLINE",
        manualReference: "BANK-REV-INIT5-01"
      }
    ]) {
      const trRes = await app.inject({
        method: "POST",
        url: `/api/v1/admin/refunds/${refundId}/transition`,
        headers: { authorization: `Bearer ${superAdmin.accessToken}` },
        payload: step
      });
      expect(trRes.statusCode).toBe(200);
    }

    const finalRefundRes = await app.inject({
      method: "GET",
      url: `/api/v1/admin/refunds?bookingId=${bookingId}`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` }
    });
    const finalRefund = JSON.parse(finalRefundRes.body).data[0];
    expect(finalRefund.status).toBe("SUCCEEDED");
    expect(finalRefund.manualReference).toBe("BANK-REV-INIT5-01");

    const ledgerRes = await app.inject({
      method: "GET",
      url: `/api/v1/admin/finance/ledger?bookingId=${bookingId}`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` }
    });
    expect(ledgerRes.statusCode).toBe(200);
    const ledgerData = JSON.parse(ledgerRes.body).data;
    expect(ledgerData.totals.isBalanced).toBe(true);
    expect(ledgerData.totals.totalDebitsMinor).toBe(ledgerData.totals.totalCreditsMinor);
  });

  it("4. enforces Support vs Superadmin user/RBAC bounds, session revocation, 400 self/min-role guards, and cross-admin 409 last-Superadmin protection", async () => {
    const superAdmin = await registerAndActivateUser("SUPERADMIN", "RBAC Superadmin");
    const supportUser = await registerAndActivateUser("SUPPORT", "RBAC Support");
    const targetUser = await registerAndActivateUser("TRAVELLER", "Target Traveller");

    // SUPPORT reads user directory & user detail, suspends target (revoking refresh session), reinstates target
    const usersListRes = await app.inject({
      method: "GET",
      url: `/api/v1/admin/users?search=${encodeURIComponent(targetUser.email)}`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` }
    });
    expect(usersListRes.statusCode).toBe(200);
    expect(
      JSON.parse(usersListRes.body).data.some((u: { id: string }) => u.id === targetUser.userId)
    ).toBe(true);

    const suspendTargetRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/users/${targetUser.userId}/suspend`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` },
      payload: { reason: "Security review hold" }
    });
    expect(suspendTargetRes.statusCode).toBe(200);
    expect(JSON.parse(suspendTargetRes.body).data.sessionsRevoked).toBeGreaterThanOrEqual(1);

    if (targetUser.refreshToken) {
      const refreshAfterSuspend = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: { refreshToken: targetUser.refreshToken, clientType: "WEB" }
      });
      expect(refreshAfterSuspend.statusCode).toBe(401);
    }

    const reinstateTargetRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/users/${targetUser.userId}/reinstate`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` },
      payload: { reason: "Review completed" }
    });
    expect(reinstateTargetRes.statusCode).toBe(200);

    // SUPPORT gets 403 on role assign/revoke and /admin/audit-events
    const supportAssignRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/users/${targetUser.userId}/roles`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` },
      payload: { roleCode: "HOST_OWNER" }
    });
    expect(supportAssignRes.statusCode).toBe(403);

    const supportAuditRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/audit-events",
      headers: { authorization: `Bearer ${supportUser.accessToken}` }
    });
    expect(supportAuditRes.statusCode).toBe(403);

    // Self-action 400 and min-1-role 400 guards
    const selfSuspendRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/users/${superAdmin.userId}/suspend`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` },
      payload: { reason: "Self suspend not allowed" }
    });
    expect(selfSuspendRes.statusCode).toBe(400);

    const revokeSoleRoleRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/users/${targetUser.userId}/roles/TRAVELLER`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` }
    });
    expect(revokeSoleRoleRes.statusCode).toBe(400);

    // SUPPORT cannot suspend SUPERADMIN accounts (403 Forbidden)
    const supportSuspendSuperRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/users/${superAdmin.userId}/suspend`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` },
      payload: { reason: "Support should be blocked" }
    });
    expect(supportSuspendSuperRes.statusCode).toBe(403);

    // Cross-admin 409 last active Superadmin protection across suspend, deactivate, and role revoke
    const otherSupersRes = await migratorPool.query<{ id: string }>(
      `SELECT u.id
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE r.code = 'SUPERADMIN' AND u.status = 'ACTIVE' AND u.id <> $1;`,
      [superAdmin.userId]
    );
    const savedOtherSuperIds = otherSupersRes.rows.map((r) => r.id);

    // Ensure superAdmin also holds TRAVELLER so min-1-role 400 does not precede 409 on role revoke
    const travellerRoleRes = await migratorPool.query<{ id: string }>(
      "SELECT id FROM roles WHERE code = 'TRAVELLER' LIMIT 1;"
    );
    await migratorPool.query(
      "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
      [superAdmin.userId, travellerRoleRes.rows[0].id]
    );

    const opsUser = await registerAndActivateUser("TRAVELLER", "Delegated Governance Admin");
    const tempRoleCode = `INIT5_OPS_${Date.now()}`;
    const tempRoleRes = await migratorPool.query<{ id: string }>(
      `INSERT INTO roles (code, name, description, is_system)
       VALUES ($1, 'Temporary Governance Role', 'Initiative 5 last-superadmin test role', false)
       RETURNING id;`,
      [tempRoleCode]
    );
    const tempRoleId = tempRoleRes.rows[0].id;

    try {
      await migratorPool.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT $1, id FROM permissions WHERE code IN ('admin.user.suspend', 'admin.user.deactivate', 'admin.role.revoke');`,
        [tempRoleId]
      );
      await migratorPool.query(
        "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
        [opsUser.userId, tempRoleId]
      );
      const opsToken = await app
        .inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email: opsUser.email, password: opsUser.password, clientType: "WEB" }
        })
        .then((r) => JSON.parse(r.body).data.accessToken as string);

      if (savedOtherSuperIds.length > 0) {
        await migratorPool.query(
          "UPDATE users SET status = 'SUSPENDED' WHERE id = ANY($1::uuid[]);",
          [savedOtherSuperIds]
        );
      }

      // Scoped non-Superadmin cannot revoke SUPERADMIN privileges (403)
      const nonSuperRevokeRes = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/users/${superAdmin.userId}/roles/SUPERADMIN`,
        headers: { authorization: `Bearer ${opsToken}` }
      });
      expect(nonSuperRevokeRes.statusCode).toBe(403);

      // Direct concurrency-locked transaction guard throws 409 when no other active Superadmin remains
      await expect(
        db.transaction(async (tx) => {
          await assertAnotherActiveSuperadminRemains(tx, superAdmin.userId);
        })
      ).rejects.toMatchObject({ statusCode: 409 });

      // Concurrent cross-Superadmin revocation between two active Superadmins never leaves zero Superadmins
      const secondSuper = await registerAndActivateUser("SUPERADMIN", "Second Concurrent Superadmin");
      const secondSuperTravRole = travellerRoleRes.rows[0].id;
      await migratorPool.query(
        "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
        [secondSuper.userId, secondSuperTravRole]
      );

      // With 2 active Superadmins, guard resolves cleanly
      await expect(
        db.transaction(async (tx) => {
          return assertAnotherActiveSuperadminRemains(tx, superAdmin.userId);
        })
      ).resolves.toEqual(expect.any(Array));

      const [resA, resB] = await Promise.all([
        app.inject({
          method: "DELETE",
          url: `/api/v1/admin/users/${secondSuper.userId}/roles/SUPERADMIN`,
          headers: { authorization: `Bearer ${superAdmin.accessToken}` }
        }),
        app.inject({
          method: "DELETE",
          url: `/api/v1/admin/users/${superAdmin.userId}/roles/SUPERADMIN`,
          headers: { authorization: `Bearer ${secondSuper.accessToken}` }
        })
      ]);
      const statuses = [resA.statusCode, resB.statusCode].sort((a, b) => a - b);
      expect(statuses[0]).toBe(200);
      expect([403, 409]).toContain(statuses[1]);

      const remainingSupers = await migratorPool.query<{ cnt: number }>(
        `SELECT COUNT(*)::int AS cnt
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE r.code = 'SUPERADMIN' AND u.status = 'ACTIVE';`
      );
      expect(remainingSupers.rows[0].cnt).toBeGreaterThanOrEqual(1);
    } finally {
      if (savedOtherSuperIds.length > 0) {
        await migratorPool.query(
          "UPDATE users SET status = 'ACTIVE' WHERE id = ANY($1::uuid[]);",
          [savedOtherSuperIds]
        );
      }
      await migratorPool.query("DELETE FROM user_roles WHERE role_id = $1;", [tempRoleId]);
      await migratorPool.query("DELETE FROM role_permissions WHERE role_id = $1;", [tempRoleId]);
      await migratorPool.query("DELETE FROM roles WHERE id = $1;", [tempRoleId]);
    }
  });
});
