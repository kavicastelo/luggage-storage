import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { rateLimitService } from "../src/modules/auth/rate-limit.service.js";

const { Pool } = pg;

describe("Initiative 6 — Dispute Adjudication, Payout Batches, Support Tickets & Cross-Initiative E2E Acceptance", () => {
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
      "UPDATE storage_locations SET status = 'DISABLED' WHERE name LIKE 'Trincomalee Harbor Locker %';"
    );
  });

  beforeEach(async () => {
    await rateLimitService.clearAll();
  });

  afterAll(async () => {
    await migratorPool
      .query(
        "UPDATE storage_locations SET status = 'DISABLED' WHERE name LIKE 'Trincomalee Harbor Locker %';"
      )
      .catch(() => {});
    await app.close();
    await migratorPool.end();
  });

  function futureColomboWindow(daysAhead = 8) {
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
    displayName = "Initiative 6 User"
  ) {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const email = `init6_${unique}@example.com`;
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

  async function setupActiveTrincomaleeHub(ownerToken: string) {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const bizRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/businesses",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        legalBusinessName: `Trincomalee Maritime Storage Pvt Ltd ${unique}`,
        tradeName: `Trinco Harbor Concierge ${unique}`,
        businessRegistrationNumber: `PV-${unique}`,
        entityType: "PRIVATE_LIMITED",
        contactEmail: `trinco_${unique}@example.com`,
        contactPhone: "+94772345678",
        city: "Trincomalee",
        payoutBankName: "Commercial Bank of Ceylon PLC",
        payoutBranchCode: "001",
        payoutAccountName: `Trinco Harbor Concierge ${unique}`,
        payoutAccountNumber: "1029384756"
      }
    });
    expect(bizRes.statusCode).toBe(201);
    const businessId = JSON.parse(bizRes.body).data.id as string;

    await migratorPool.query("UPDATE host_businesses SET status = 'ACTIVE' WHERE id = $1;", [
      businessId
    ]);

    const locRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/locations",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        businessId,
        name: `Trincomalee Harbor Locker ${unique}`,
        description: "Coastal vault near Fort Frederick ferry pier",
        addressLine1: "42 Dockyard Road",
        city: "Trincomalee",
        postalCode: "31000",
        latitude: 8.5711,
        longitude: 81.2335,
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
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { schedules }
    });
    expect(hoursRes.statusCode).toBe(200);

    const zoneRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/locations/${locationId}/zones`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: "Vault Locker B", zoneType: "LOCKER" }
    });
    expect(zoneRes.statusCode).toBe(201);
    const zoneId = JSON.parse(zoneRes.body).data.id as string;

    const poolsRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/locations/${locationId}/capacity-pools`,
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    expect(poolsRes.statusCode).toBe(200);
    const pools = JSON.parse(poolsRes.body).data.pools as Array<{ id: string }>;

    const capRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/hosts/capacity-pools/${pools[0].id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { zoneId, totalUnits: 30, isActive: true }
    });
    expect(capRes.statusCode).toBe(200);

    const priceRes = await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/pricing`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        currency: "LKR",
        pricingUnit: "CALENDAR_DAY",
        baseRateMinor: 120000,
        tierRates: [
          { bagCategory: "BAG_SMALL", rateMinor: 80000, categoryMultiplierBps: 8000 },
          { bagCategory: "BAG_MEDIUM", rateMinor: 120000, categoryMultiplierBps: 10000 },
          { bagCategory: "BAG_LARGE", rateMinor: 160000, categoryMultiplierBps: 13000 },
          { bagCategory: "BAG_OVERSIZED", rateMinor: 220000, categoryMultiplierBps: 18000 }
        ]
      }
    });
    expect(priceRes.statusCode).toBe(200);

    await migratorPool.query("UPDATE storage_locations SET status = 'ACTIVE' WHERE id = $1;", [
      locationId
    ]);

    return { businessId, locationId, zoneId };
  }

  async function assignStaffMember(
    ownerToken: string,
    businessId: string,
    assignedLocationIds: string[],
    displayName: string
  ) {
    const staff = await registerAndActivateUser("TRAVELLER", displayName);
    const addRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/businesses/${businessId}/staff`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { email: staff.email, assignedLocationIds }
    });
    expect(addRes.statusCode).toBe(201);
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: staff.email, password: staff.password, clientType: "WEB" }
    });
    expect(loginRes.statusCode).toBe(200);
    return {
      ...staff,
      accessToken: JSON.parse(loginRes.body).data.accessToken as string
    };
  }

  async function createAndConfirmBooking(
    travellerToken: string,
    locationId: string,
    daysAhead = 8
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
        items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
      }
    });
    expect(createRes.statusCode).toBe(201);
    const booking = JSON.parse(createRes.body).data as {
      id: string;
      referenceCode: string;
      status: string;
      location: { addressDisclosed: boolean; addressLine1: string | null };
    };

    // OQ-012: Exact street address masked before payment confirmation
    expect(booking.location.addressDisclosed).toBe(false);
    expect(booking.location.addressLine1).toBeNull();

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

  async function checkInAndMaybeReleaseDisputed(
    travellerToken: string,
    hostToken: string,
    bookingId: string,
    zoneId: string,
    exceptionNotes?: string
  ) {
    const inPassRes = await app.inject({
      method: "POST",
      url: `/api/v1/bookings/${bookingId}/custody-pass`,
      headers: { authorization: `Bearer ${travellerToken}` },
      payload: { operation: "CHECK_IN" }
    });
    expect(inPassRes.statusCode).toBe(200);
    const inPin = JSON.parse(inPassRes.body).data.verificationPin as string;

    const ciRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/custody/${bookingId}/check-in`,
      headers: { authorization: `Bearer ${hostToken}` },
      payload: {
        verificationPin: inPin,
        zoneId,
        bags: [{ bagTagCode: `TRN-${bookingId.slice(0, 6)}`, bagCategory: "BAG_MEDIUM" }]
      }
    });
    expect(ciRes.statusCode).toBe(200);

    if (exceptionNotes) {
      const outPassRes = await app.inject({
        method: "POST",
        url: `/api/v1/bookings/${bookingId}/custody-pass`,
        headers: { authorization: `Bearer ${travellerToken}` },
        payload: { operation: "COLLECTION" }
      });
      expect(outPassRes.statusCode).toBe(200);
      const outPin = JSON.parse(outPassRes.body).data.verificationPin as string;

      const coRes = await app.inject({
        method: "POST",
        url: `/api/v1/hosts/custody/${bookingId}/check-out`,
        headers: { authorization: `Bearer ${hostToken}` },
        payload: {
          verificationPin: outPin,
          releasedBagCount: 1,
          exceptionNotes
        }
      });
      expect(coRes.statusCode).toBe(200);
      expect(JSON.parse(coRes.body).data.status).toBe("DISPUTED_RELEASE");
    }
  }

  it("1. adjudicates disputes end-to-end (UPHOLD_HOST & full/partial REFUND_TRAVELLER), executes payout batch lifecycle with concurrency protection & OQ-017 RBAC", async () => {
    const superAdmin = await registerAndActivateUser("SUPERADMIN", "Init6 Superadmin");
    const supportUser = await registerAndActivateUser("SUPPORT", "Init6 Support");
    const hostOwner = await registerAndActivateUser("HOST_OWNER", "Init6 Host Owner");
    const traveller = await registerAndActivateUser("TRAVELLER", "Init6 Traveller");

    const { businessId, locationId, zoneId } = await setupActiveTrincomaleeHub(
      hostOwner.accessToken
    );
    const staffMember = await assignStaffMember(
      hostOwner.accessToken,
      businessId,
      [locationId],
      "Trinco Desk Clerk"
    );

    // Three bookings to test all dispute outcomes + subsequent batch payout
    const bUphold = await createAndConfirmBooking(traveller.accessToken, locationId, 8);
    const bFullRefund = await createAndConfirmBooking(traveller.accessToken, locationId, 9);
    const bPartialPreCollection = await createAndConfirmBooking(
      traveller.accessToken,
      locationId,
      10
    );

    // bUphold & bFullRefund: checked in + disputed release -> DISPUTED + ON_HOLD payable (102,000 net)
    await checkInAndMaybeReleaseDisputed(
      traveller.accessToken,
      staffMember.accessToken,
      bUphold.id,
      zoneId,
      "Traveller questioned minor corner scuff during pickup"
    );
    await checkInAndMaybeReleaseDisputed(
      traveller.accessToken,
      staffMember.accessToken,
      bFullRefund.id,
      zoneId,
      "Missing zipper lock reported on release"
    );

    // bPartialPreCollection: CONFIRMED -> DISPUTED via POST /bookings/:id/exceptions
    const excRes = await app.inject({
      method: "POST",
      url: `/api/v1/bookings/${bPartialPreCollection.id}/exceptions`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { category: "HOST_NO_SHOW", reason: "Delayed counter opening at drop-off" }
    });
    expect(excRes.statusCode).toBe(200);
    expect(JSON.parse(excRes.body).data.status).toBe("DISPUTED");

    // SUPPORT must be forbidden from adjudicating disputes
    const supportResolveRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/bookings/${bUphold.id}/resolve-dispute`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` },
      payload: { outcome: "UPHOLD_HOST", notes: "Support attempt should fail" }
    });
    expect(supportResolveRes.statusCode).toBe(403);

    // Case 1A: SUPERADMIN resolves bUphold -> UPHOLD_HOST (COMPLETED, RELEASED_TO_TRAVELLER, ELIGIBLE 102000)
    const upholdRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/bookings/${bUphold.id}/resolve-dispute`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` },
      payload: {
        outcome: "UPHOLD_HOST",
        notes: "Check-in bag photo confirms corner scuff pre-existed prior to drop-off"
      }
    });
    expect(upholdRes.statusCode).toBe(200);
    expect(JSON.parse(upholdRes.body).data.status).toBe("COMPLETED");

    const upholdCustodyRes = await app.inject({
      method: "GET",
      url: `/api/v1/admin/bookings/${bUphold.id}/custody`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` }
    });
    expect(JSON.parse(upholdCustodyRes.body).data.status).toBe("RELEASED_TO_TRAVELLER");

    const upholdLedgerRes = await app.inject({
      method: "GET",
      url: `/api/v1/admin/finance/ledger?bookingId=${bUphold.id}`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` }
    });
    const upholdLedger = JSON.parse(upholdLedgerRes.body).data;
    expect(upholdLedger.totals.isBalanced).toBe(true);
    expect(upholdLedger.totals.totalDebitsMinor).toBe(240000);

    // Case 1B: SUPERADMIN resolves bFullRefund -> REFUND_TRAVELLER 100% (claws back post-settlement payable)
    const fullRefundRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/bookings/${bFullRefund.id}/resolve-dispute`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` },
      payload: {
        outcome: "REFUND_TRAVELLER",
        refundPercentage: 100,
        notes: "Zipper damage substantiated via counter evidence inspection"
      }
    });
    expect(fullRefundRes.statusCode).toBe(200);
    const fullRefundBooking = JSON.parse(fullRefundRes.body).data;
    expect(fullRefundBooking.status).toBe("CANCELLED_BY_PLATFORM");
    expect(fullRefundBooking.refundSummary.amountMinor).toBe(120000);
    expect(fullRefundBooking.refundSummary.reasonCategory).toBe("DISPUTE_RESOLUTION");

    // Transition AUTHORIZED -> INITIATED -> SUCCEEDED and confirm balanced ledger
    const fullRefundId = fullRefundBooking.refundSummary.refundId as string;
    for (const step of [
      { targetStatus: "INITIATED", notes: "Dispute refund wire queued" },
      {
        targetStatus: "SUCCEEDED",
        notes: "Settled manually via bank transfer",
        settlementMode: "MANUAL_OFFLINE",
        manualReference: "BANK-DISP-100"
      }
    ]) {
      const trRes = await app.inject({
        method: "POST",
        url: `/api/v1/admin/refunds/${fullRefundId}/transition`,
        headers: { authorization: `Bearer ${superAdmin.accessToken}` },
        payload: step
      });
      expect(trRes.statusCode).toBe(200);
    }

    const fullRefundLedgerRes = await app.inject({
      method: "GET",
      url: `/api/v1/admin/finance/ledger?bookingId=${bFullRefund.id}`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` }
    });
    expect(JSON.parse(fullRefundLedgerRes.body).data.totals.isBalanced).toBe(true);

    // Case 1C: SUPERADMIN resolves pre-collection dispute with 50% partial refund -> retained 60000 (85% = 51000 ELIGIBLE)
    const partialRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/bookings/${bPartialPreCollection.id}/resolve-dispute`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` },
      payload: {
        outcome: "REFUND_TRAVELLER",
        refundPercentage: 50,
        notes: "Partial 50% compensation awarded per late counter opening agreement"
      }
    });
    expect(partialRes.statusCode).toBe(200);
    const partialBooking = JSON.parse(partialRes.body).data;
    expect(partialBooking.status).toBe("CANCELLED_BY_PLATFORM");
    expect(partialBooking.refundSummary.amountMinor).toBe(60000);

    const auditDisputeRes = await migratorPool.query(
      "SELECT COUNT(*)::int AS cnt FROM security_audit_events WHERE event_type = 'BOOKING_DISPUTE_RESOLVED';"
    );
    expect(auditDisputeRes.rows[0].cnt).toBeGreaterThanOrEqual(3);

    // Verify eligible payables grouped for businessId: 102000 + 51000 = 153000 with masked bank account
    const eligibleRes = await app.inject({
      method: "GET",
      url: `/api/v1/admin/payouts/eligible-payables?businessId=${businessId}`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` }
    });
    expect(eligibleRes.statusCode).toBe(200);
    const groups = JSON.parse(eligibleRes.body).data.groups;
    expect(groups).toHaveLength(1);
    expect(groups[0].eligibleCount).toBe(2);
    expect(groups[0].totalNetPayableMinor).toBe(153000);
    expect(groups[0].payoutAccountMasked).toContain("4756");
    expect(groups[0].payoutAccountMasked).not.toContain("102938");
    expect(groups[0].payoutAccountMasked).not.toContain("enc:v1:");

    // SUPPORT and HOST_OWNER must receive 403 on admin payout batch endpoints
    const supportPayoutRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/payouts/eligible-payables",
      headers: { authorization: `Bearer ${supportUser.accessToken}` }
    });
    expect(supportPayoutRes.statusCode).toBe(403);

    const hostAdminPayoutRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/payouts/batches",
      headers: { authorization: `Bearer ${hostOwner.accessToken}` },
      payload: { businessId }
    });
    expect(hostAdminPayoutRes.statusCode).toBe(403);

    // Generate Payout Batch (201) -> GENERATED
    const createBatchRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/payouts/batches",
      headers: { authorization: `Bearer ${superAdmin.accessToken}` },
      payload: {
        businessId,
        payoutMethod: "CEFT_SLIPS",
        notes: "Weekly Trincomalee CEFT Settlement Run"
      }
    });
    expect(createBatchRes.statusCode).toBe(201);
    const batch = JSON.parse(createBatchRes.body).data;
    expect(batch.status).toBe("GENERATED");
    expect(batch.itemCount).toBe(2);
    expect(batch.totalNetPayableMinor).toBe(153000);
    expect(batch.batchCode).toMatch(/^PB-\d{8}-[A-Z0-9]+$/);
    expect(batch.payoutAccountMasked).toContain("4756");
    expect(batch.payoutAccountMasked).not.toContain("enc:v1:");

    // Duplicate batching must fail cleanly with 409 Conflict
    const dupBatchRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/payouts/batches",
      headers: { authorization: `Bearer ${superAdmin.accessToken}` },
      payload: {
        businessId,
        payableIds: batch.items.map((i: { payableId: string }) => i.payableId)
      }
    });
    expect(dupBatchRes.statusCode).toBe(409);

    // Disburse Batch with CEFT wire proof -> DISBURSED + balanced 2020 DEBIT / 1010 CREDIT journal group
    const disburseRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/payouts/batches/${batch.id}/disburse`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` },
      payload: {
        payoutReference: "CEFT-TRN-20261116-01",
        payoutMethod: "CEFT_SLIPS",
        notes: "Settled to Commercial Bank 4756"
      }
    });
    expect(disburseRes.statusCode).toBe(200);
    const disbursedBatch = JSON.parse(disburseRes.body).data;
    expect(disbursedBatch.status).toBe("DISBURSED");
    expect(disbursedBatch.payoutReference).toBe("CEFT-TRN-20261116-01");
    expect(disbursedBatch.ledgerTransactionGroupId).toBeTruthy();

    // Disbursing twice returns 409 Conflict
    const secondDisburseRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/payouts/batches/${batch.id}/disburse`,
      headers: { authorization: `Bearer ${superAdmin.accessToken}` },
      payload: { payoutReference: "DUPLICATE-ATTEMPT" }
    });
    expect(secondDisburseRes.statusCode).toBe(409);

    // Host Owner summary shows PAID = 153000, ELIGIBLE = 0 and lists batch statement
    const hostSummaryRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/finance/summary?businessId=${businessId}`,
      headers: { authorization: `Bearer ${hostOwner.accessToken}` }
    });
    expect(hostSummaryRes.statusCode).toBe(200);
    const hostSummary = JSON.parse(hostSummaryRes.body).data;
    expect(hostSummary.totalPaidMinor).toBe(153000);
    expect(hostSummary.totalEligibleMinor).toBe(0);

    const hostBatchesRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/finance/payout-batches?businessId=${businessId}`,
      headers: { authorization: `Bearer ${hostOwner.accessToken}` }
    });
    expect(hostBatchesRes.statusCode).toBe(200);
    const hostBatches = JSON.parse(hostBatchesRes.body).data.batches;
    expect(hostBatches.map((b: { id: string }) => b.id)).toContain(batch.id);

    // OQ-017: HOST_STAFF strictly denied host payout statements (403)
    const staffPayoutRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/finance/payout-batches?businessId=${businessId}`,
      headers: { authorization: `Bearer ${staffMember.accessToken}` }
    });
    expect(staffPayoutRes.statusCode).toBe(403);

    // Global platform double-entry ledger balance proof
    const globalLedgerRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/finance/ledger",
      headers: { authorization: `Bearer ${superAdmin.accessToken}` }
    });
    expect(globalLedgerRes.statusCode).toBe(200);
    expect(JSON.parse(globalLedgerRes.body).data.totals.isBalanced).toBe(true);
  });

  it("2. manages full support ticket lifecycle (guest/authenticated intake, internal notes confidentiality, triage & rate limits)", async () => {
    const supportUser = await registerAndActivateUser("SUPPORT", "Desk Agent Kasun");
    const hostOwner = await registerAndActivateUser("HOST_OWNER", "Ticket Host Owner");
    const traveller = await registerAndActivateUser("TRAVELLER", "Ticket Traveller");

    const { locationId } = await setupActiveTrincomaleeHub(hostOwner.accessToken);
    const booking = await createAndConfirmBooking(traveller.accessToken, locationId, 11);

    // Unauthenticated guest ticket creation never discloses internal booking existence
    const guestTicketRes = await app.inject({
      method: "POST",
      url: "/api/v1/support/tickets",
      payload: {
        requesterName: "Anon Visitor",
        requesterEmail: `guest_${Date.now()}@example.com`,
        category: "GENERAL_INQUIRY",
        subject: "Question about Trincomalee oversized surfboard rules",
        message: "Do lockers near Dockyard Road fit 7-foot surfboard bags?",
        bookingReference: booking.referenceCode
      }
    });
    expect(guestTicketRes.statusCode).toBe(201);
    const guestTicket = JSON.parse(guestTicketRes.body).data;
    expect(guestTicket.referenceCode).toMatch(/^SUP-\d{8}-[A-Z0-9]+$/);
    expect(guestTicket.bookingId).toBeUndefined();

    // Authenticated traveller creates ticket linked to booking
    const myTicketCreateRes = await app.inject({
      method: "POST",
      url: "/api/v1/support/tickets",
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: {
        requesterName: traveller.displayName,
        requesterEmail: traveller.email,
        category: "CUSTODY_INCIDENT",
        subject: "Need urgent pickup window adjustment",
        message: "My ferry from Pigeon Island was delayed by 45 minutes.",
        bookingReference: booking.referenceCode
      }
    });
    expect(myTicketCreateRes.statusCode).toBe(201);
    const myCreated = JSON.parse(myTicketCreateRes.body).data;
    expect(myCreated.priority).toBe("HIGH");

    // Non-admin roles cannot access admin support routes (403)
    const travellerAdminAttempt = await app.inject({
      method: "GET",
      url: "/api/v1/admin/support/tickets",
      headers: { authorization: `Bearer ${traveller.accessToken}` }
    });
    expect(travellerAdminAttempt.statusCode).toBe(403);

    const hostAdminAttempt = await app.inject({
      method: "GET",
      url: "/api/v1/admin/support/tickets",
      headers: { authorization: `Bearer ${hostOwner.accessToken}` }
    });
    expect(hostAdminAttempt.statusCode).toBe(403);

    // SUPPORT inspects triage queue and ticket by SUP-... reference code -> sees linkedBooking
    const queueRes = await app.inject({
      method: "GET",
      url: `/api/v1/admin/support/tickets?search=${encodeURIComponent(myCreated.referenceCode)}`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` }
    });
    expect(queueRes.statusCode).toBe(200);
    expect(JSON.parse(queueRes.body).data).toHaveLength(1);

    const adminDetailRes = await app.inject({
      method: "GET",
      url: `/api/v1/admin/support/tickets/${myCreated.referenceCode}`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` }
    });
    expect(adminDetailRes.statusCode).toBe(200);
    const adminDetail = JSON.parse(adminDetailRes.body).data;
    expect(adminDetail.linkedBooking).toBeTruthy();
    expect(adminDetail.linkedBooking.id).toBe(booking.id);

    // Agent posts confidential internal note AND public reply, then marks RESOLVED
    const internalRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/support/tickets/${myCreated.id}/messages`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` },
      payload: {
        message: "CONFIDENTIAL_AGENT_NOTE_DO_NOT_LEAK",
        isInternalNote: true
      }
    });
    expect(internalRes.statusCode).toBe(200);

    const publicReplyRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/support/tickets/${myCreated.id}/messages`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` },
      payload: {
        message: "No worries — present your collection PIN on arrival and bags will be released.",
        isInternalNote: false
      }
    });
    expect(publicReplyRes.statusCode).toBe(200);
    expect(JSON.parse(publicReplyRes.body).data.status).toBe("AWAITING_CUSTOMER");

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/support/tickets/${myCreated.id}`,
      headers: { authorization: `Bearer ${supportUser.accessToken}` },
      payload: {
        status: "RESOLVED",
        resolutionSummary: "Confirmed grace window & release protocol to traveller"
      }
    });
    expect(patchRes.statusCode).toBe(200);
    expect(JSON.parse(patchRes.body).data.status).toBe("RESOLVED");

    // Traveller inspecting their ticket MUST see public reply but NEVER see internal note
    const myTicketsRes = await app.inject({
      method: "GET",
      url: "/api/v1/support/tickets/me",
      headers: { authorization: `Bearer ${traveller.accessToken}` }
    });
    expect(myTicketsRes.statusCode).toBe(200);
    expect(JSON.parse(myTicketsRes.body).data.tickets.length).toBeGreaterThanOrEqual(1);

    const myDetailRes = await app.inject({
      method: "GET",
      url: `/api/v1/support/tickets/me/${myCreated.id}`,
      headers: { authorization: `Bearer ${traveller.accessToken}` }
    });
    expect(myDetailRes.statusCode).toBe(200);
    const myDetail = JSON.parse(myDetailRes.body).data;
    expect(myDetail.messages.some((m: { isInternalNote: boolean }) => m.isInternalNote)).toBe(false);
    expect(
      myDetail.messages.some((m: { body: string }) =>
        m.body.includes("CONFIDENTIAL_AGENT_NOTE_DO_NOT_LEAK")
      )
    ).toBe(false);
    expect(
      myDetail.messages.some((m: { body: string }) =>
        m.body.includes("present your collection PIN")
      )
    ).toBe(true);

    // Traveller follow-up reopens RESOLVED ticket to OPEN
    const reopenRes = await app.inject({
      method: "POST",
      url: `/api/v1/support/tickets/me/${myCreated.id}/messages`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { message: "Thank you, confirming I reached the counter." }
    });
    expect(reopenRes.statusCode).toBe(200);
    expect(JSON.parse(reopenRes.body).data.status).toBe("OPEN");

    // Rate limit enforcement: 6th request with same email exceeds support_ticket_email limit (5)
    const rlEmail = `ratelimit_support_${Date.now()}@example.com`;
    for (let i = 1; i <= 5; i++) {
      const okRes = await app.inject({
        method: "POST",
        url: "/api/v1/support/tickets",
        remoteAddress: `10.10.20.${i}`,
        payload: {
          requesterName: "Rate Limit Check",
          requesterEmail: rlEmail,
          category: "GENERAL_INQUIRY",
          subject: `Inquiry #${i}`,
          message: "Checking PostgreSQL rate limit enforcement for public support intake."
        }
      });
      expect(okRes.statusCode).toBe(201);
    }
    const blockedRes = await app.inject({
      method: "POST",
      url: "/api/v1/support/tickets",
      remoteAddress: "10.10.20.99",
      payload: {
        requesterName: "Rate Limit Check",
        requesterEmail: rlEmail,
        category: "GENERAL_INQUIRY",
        subject: "Inquiry #6 blocked",
        message: "This sixth inquiry within 15 minutes should hit 429 RATE_LIMITED."
      }
    });
    expect(blockedRes.statusCode).toBe(429);
  });

  it("3. verifies cross-initiative E2E guarantees: OQ-012 address unlock, OQ-014 replay block & OQ-015 zero possessory lien", async () => {
    const hostOwner = await registerAndActivateUser("HOST_OWNER", "E2E Host Owner");
    const traveller = await registerAndActivateUser("TRAVELLER", "E2E Traveller");
    const { locationId, zoneId } = await setupActiveTrincomaleeHub(hostOwner.accessToken);

    const booking = await createAndConfirmBooking(traveller.accessToken, locationId, 12);

    // Post-payment address disclosure (OQ-012)
    const postPayDetailRes = await app.inject({
      method: "GET",
      url: `/api/v1/bookings/${booking.id}`,
      headers: { authorization: `Bearer ${traveller.accessToken}` }
    });
    expect(postPayDetailRes.statusCode).toBe(200);
    const postPayBooking = JSON.parse(postPayDetailRes.body).data;
    expect(postPayBooking.status).toBe("CONFIRMED");
    expect(postPayBooking.location.addressDisclosed).toBe(true);
    expect(postPayBooking.location.addressLine1).toBe("42 Dockyard Road");

    // Issue CHECK_IN pass & execute check-in; verify single-use replay rejection (OQ-014)
    const inPassRes = await app.inject({
      method: "POST",
      url: `/api/v1/bookings/${booking.id}/custody-pass`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { operation: "CHECK_IN" }
    });
    const inPin = JSON.parse(inPassRes.body).data.verificationPin as string;

    const ciRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/custody/${booking.id}/check-in`,
      headers: { authorization: `Bearer ${hostOwner.accessToken}` },
      payload: {
        verificationPin: inPin,
        zoneId,
        bags: [{ bagTagCode: "E2E-TRN-01", bagCategory: "BAG_MEDIUM" }]
      }
    });
    expect(ciRes.statusCode).toBe(200);

    const replayVerifyRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/custody/verify",
      headers: { authorization: `Bearer ${hostOwner.accessToken}` },
      payload: { bookingId: booking.id, operation: "CHECK_IN", verificationPin: inPin }
    });
    expect(replayVerifyRes.statusCode).toBe(401);

    // Overdue simulation (3 hours past scheduled collection_at) -> OQ-015 Zero Possessory Lien still releases bags!
    await migratorPool.query(
      `UPDATE bookings
       SET drop_off_at = NOW() - INTERVAL '8 hours',
           collection_at = NOW() - INTERVAL '3 hours'
       WHERE id = $1;`,
      [booking.id]
    );

    const outPassRes = await app.inject({
      method: "POST",
      url: `/api/v1/bookings/${booking.id}/custody-pass`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { operation: "COLLECTION" }
    });
    expect(outPassRes.statusCode).toBe(200);
    const outPin = JSON.parse(outPassRes.body).data.verificationPin as string;

    const coRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/custody/${booking.id}/check-out`,
      headers: { authorization: `Bearer ${hostOwner.accessToken}` },
      payload: {
        verificationPin: outPin,
        releasedBagCount: 1,
        collectionNotes: "Released promptly upon valid PIN despite 3h ferry delay"
      }
    });
    expect(coRes.statusCode).toBe(200);
    const releasedCustody = JSON.parse(coRes.body).data;
    expect(releasedCustody.status).toBe("RELEASED_TO_TRAVELLER");
    expect(releasedCustody.overdueMinutes).toBeGreaterThan(30);
    expect(releasedCustody.overdueFeeMinor).toBeGreaterThan(0);
    expect(releasedCustody.handoverCondition).toBe("UNPAID_FEES_PENDING");
  });
});
