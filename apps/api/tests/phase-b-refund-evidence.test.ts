import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import { readMigrationFiles } from "drizzle-orm/migrator";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { runMigrations } from "../src/infrastructure/database/migrate.js";
import { rateLimitService } from "../src/modules/auth/rate-limit.service.js";
import {
  PayHereGatewayAdapter,
  SandboxSignedGatewayAdapter
} from "../src/modules/payments/payment-gateway.port.js";

const { Pool } = pg;

const TEST_PAYHERE_MERCHANT_ID = "1218888";
const TEST_PAYHERE_MERCHANT_SECRET = "payhere_refund_b9_test_secret_key_32_chars!";

describe("Phase B9 — Refund Transaction Evidence Integrity & Settlement Auditability", () => {
  let app: FastifyInstance;
  let migratorPool: pg.Pool;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    migratorPool = new Pool({
      connectionString: env.MIGRATION_DATABASE_URL,
      max: 8
    });
  });

  beforeEach(async () => {
    await rateLimitService.clearAll();
  });

  afterAll(async () => {
    await app.close();
    await migratorPool.end();
  });

  async function withPayHereEnv<T>(fn: () => Promise<T>): Promise<T> {
    const prevProvider = env.PAYMENT_PROVIDER;
    const prevMerchantId = env.PAYHERE_MERCHANT_ID;
    const prevMerchantSecret = env.PAYHERE_MERCHANT_SECRET;
    const prevSandboxMode = env.PAYHERE_SANDBOX_MODE;
    const prevNotifyUrl = env.PAYHERE_NOTIFY_URL;
    const prevReturnUrl = env.PAYHERE_RETURN_URL;
    const prevCancelUrl = env.PAYHERE_CANCEL_URL;

    env.PAYMENT_PROVIDER = "payhere";
    env.PAYHERE_MERCHANT_ID = TEST_PAYHERE_MERCHANT_ID;
    env.PAYHERE_MERCHANT_SECRET = TEST_PAYHERE_MERCHANT_SECRET;
    env.PAYHERE_SANDBOX_MODE = true;
    env.PAYHERE_NOTIFY_URL = "https://api.luggagevault.lk/api/v1/payments/webhooks/payhere";
    env.PAYHERE_RETURN_URL = "https://app.luggagevault.lk/booking/confirm";
    env.PAYHERE_CANCEL_URL = "https://app.luggagevault.lk/booking/confirm?cancelled=1";

    try {
      return await fn();
    } finally {
      env.PAYMENT_PROVIDER = prevProvider;
      env.PAYHERE_MERCHANT_ID = prevMerchantId;
      env.PAYHERE_MERCHANT_SECRET = prevMerchantSecret;
      env.PAYHERE_SANDBOX_MODE = prevSandboxMode;
      env.PAYHERE_NOTIFY_URL = prevNotifyUrl;
      env.PAYHERE_RETURN_URL = prevReturnUrl;
      env.PAYHERE_CANCEL_URL = prevCancelUrl;
    }
  }

  async function createTestUser(
    roleCode: "TRAVELLER" | "HOST_OWNER" | "SUPERADMIN" | "SUPPORT" = "TRAVELLER",
    displayName = "Refund B9 User"
  ) {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const email = `rf_b9_${unique}@example.com`;
    const password = "StrongPassword123!";

    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password, displayName }
    });
    expect(regRes.statusCode).toBe(201);
    const userId = JSON.parse(regRes.body).data.id as string;

    if (roleCode !== "TRAVELLER") {
      const roleRes = await migratorPool.query("SELECT id FROM roles WHERE code = $1 LIMIT 1;", [
        roleCode
      ]);
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

  async function createActiveLocation() {
    const owner = await createTestUser("HOST_OWNER", "Host B9");
    const bizRes = await app.inject({
      method: "POST",
      url: "/api/v1/hosts/businesses",
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        legalBusinessName: `B9 Refund Storage Ltd ${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        tradeName: "Galle Fort Vaults",
        entityType: "RETAIL_SHOP",
        contactEmail: `biz_b9_${Date.now()}@galle.lk`,
        contactPhone: "+94771234567",
        city: "Galle"
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
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        businessId,
        name: `Galle Hub ${Math.random().toString(36).slice(2, 6)}`,
        description: "Verified storage locker near Galle Fort Gate",
        addressLine1: "14 Church Street, Galle",
        city: "Galle",
        postalCode: "80000",
        latitude: 6.0267,
        longitude: 80.217,
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
    await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/opening-hours`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { schedules }
    });

    const zoneRes = await app.inject({
      method: "POST",
      url: `/api/v1/hosts/locations/${locationId}/zones`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { name: "Galle Zone A", zoneType: "LOCKER" }
    });
    const zoneId = JSON.parse(zoneRes.body).data.id as string;

    const poolsRes = await app.inject({
      method: "GET",
      url: `/api/v1/hosts/locations/${locationId}/capacity-pools`,
      headers: { authorization: `Bearer ${owner.accessToken}` }
    });
    const pools = JSON.parse(poolsRes.body).data.pools as Array<{ id: string }>;
    await app.inject({
      method: "PATCH",
      url: `/api/v1/hosts/capacity-pools/${pools[0].id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { zoneId, totalUnits: 30, isActive: true }
    });

    await app.inject({
      method: "PUT",
      url: `/api/v1/hosts/locations/${locationId}/pricing`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        currency: "LKR",
        pricingUnit: "CALENDAR_DAY",
        baseRateMinor: 150000,
        tierRates: [
          { bagCategory: "BAG_SMALL", rateMinor: 90000, categoryMultiplierBps: 7000 },
          { bagCategory: "BAG_MEDIUM", rateMinor: 150000, categoryMultiplierBps: 10000 },
          { bagCategory: "BAG_LARGE", rateMinor: 190000, categoryMultiplierBps: 13000 },
          { bagCategory: "BAG_OVERSIZED", rateMinor: 250000, categoryMultiplierBps: 20000 }
        ]
      }
    });

    await migratorPool.query("UPDATE storage_locations SET status = 'ACTIVE' WHERE id = $1;", [
      locationId
    ]);
    return { owner, businessId, locationId };
  }

  async function createPaidCancelledRefundWithPayHere(
    locationId: string,
    traveller: { accessToken: string; email: string },
    options?: { daysAhead?: number; paymentId?: string }
  ) {
    const base = new Date();
    base.setUTCDate(base.getUTCDate() + (options?.daysAhead ?? 12));
    const yyyy = base.getUTCFullYear();
    const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(base.getUTCDate()).padStart(2, "0");

    const bookingRes = await app.inject({
      method: "POST",
      url: "/api/v1/bookings",
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: {
        locationId,
        dropOffAt: `${yyyy}-${mm}-${dd}T04:30:00.000Z`,
        collectionAt: `${yyyy}-${mm}-${dd}T11:30:00.000Z`,
        items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
      }
    });
    expect(bookingRes.statusCode).toBe(201);
    const booking = JSON.parse(bookingRes.body).data as {
      id: string;
      referenceCode: string;
      totalAmountMinor: number;
      currency: string;
    };

    const intent = await withPayHereEnv(async () => {
      const intentRes = await app.inject({
        method: "POST",
        url: "/api/v1/payments/intents",
        headers: { authorization: `Bearer ${traveller.accessToken}` },
        payload: {
          bookingId: booking.id,
          customerDetails: {
            firstName: "Nimal",
            lastName: "Fernando",
            email: traveller.email,
            phone: "+94771234567",
            address: "14 Church Street",
            city: "Galle",
            country: "Sri Lanka"
          }
        }
      });
      expect(intentRes.statusCode).toBe(201);
      return JSON.parse(intentRes.body).data as {
        id: string;
        providerOrderId: string;
        amountMinor: number;
      };
    });

    const chargePaymentId =
      options?.paymentId ??
      `PH-CHG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const md5sig = PayHereGatewayAdapter.computeNotifyMd5Sig({
      merchantId: TEST_PAYHERE_MERCHANT_ID,
      orderId: intent.providerOrderId,
      payhereAmount: "1500.00",
      payhereCurrency: "LKR",
      statusCode: "2",
      merchantSecret: TEST_PAYHERE_MERCHANT_SECRET
    });
    const notifyBody = new URLSearchParams({
      merchant_id: TEST_PAYHERE_MERCHANT_ID,
      order_id: intent.providerOrderId,
      payment_id: chargePaymentId,
      payhere_amount: "1500.00",
      payhere_currency: "LKR",
      status_code: "2",
      md5sig,
      custom_1: intent.id,
      custom_2: booking.id
    }).toString();

    const whRes = await withPayHereEnv(async () =>
      app.inject({
        method: "POST",
        url: "/api/v1/payments/webhooks/payhere",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: notifyBody
      })
    );
    expect(whRes.statusCode).toBe(200);

    const cancelRes = await app.inject({
      method: "POST",
      url: `/api/v1/bookings/${booking.id}/cancel`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { reason: "Travel plans changed before drop-off" }
    });
    expect(cancelRes.statusCode).toBe(200);
    const refundId = JSON.parse(cancelRes.body).data.refundSummary.refundId as string;

    return {
      bookingId: booking.id,
      referenceCode: booking.referenceCode,
      intentId: intent.id,
      providerOrderId: intent.providerOrderId,
      chargePaymentId,
      amountMinor: intent.amountMinor,
      refundId,
      notifyBody
    };
  }

  it("1-5. rejects missing/mismatched settlement modes with zero synthetic rfnd_* IDs, enforces RBAC, and persists PROVIDER_CONFIRMED & MANUAL_OFFLINE with balanced ledgers", async () => {
    const { locationId } = await createActiveLocation();
    const traveller = await createTestUser("TRAVELLER", "Kavinda Silva");
    const superadmin = await createTestUser("SUPERADMIN", "Superadmin B9");
    const support = await createTestUser("SUPPORT", "Support B9");

    // Booking A: PROVIDER_CONFIRMED flow + validation errors (cases 1, 2, 3)
    const caseA = await createPaidCancelledRefundWithPayHere(locationId, traveller, {
      daysAhead: 10
    });

    // SUPPORT forbidden from refund transitions
    const supportForbidden = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${caseA.refundId}/transition`,
      headers: { authorization: `Bearer ${support.accessToken}` },
      payload: { targetStatus: "AUTHORIZED", notes: "Support attempt" }
    });
    expect(supportForbidden.statusCode).toBe(403);

    // Move REQUESTED -> AUTHORIZED
    const authRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${caseA.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: { targetStatus: "AUTHORIZED", notes: "Verified eligibility for full refund" }
    });
    expect(authRes.statusCode).toBe(200);

    // Case 1: SUCCEEDED without settlementMode -> 400 and zero synthetic rfnd_*
    const noModeRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${caseA.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: { targetStatus: "SUCCEEDED", notes: "Missing settlement mode" }
    });
    expect(noModeRes.statusCode).toBe(400);

    // Case 2: PROVIDER_CONFIRMED missing / blank providerRefundId or supplying manualReference -> 400
    const missingProviderRef = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${caseA.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "PROVIDER_CONFIRMED",
        notes: "Missing provider refund reference"
      }
    });
    expect(missingProviderRef.statusCode).toBe(400);

    const blankProviderRef = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${caseA.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "PROVIDER_CONFIRMED",
        providerRefundId: "   ",
        notes: "Blank provider refund reference"
      }
    });
    expect(blankProviderRef.statusCode).toBe(400);

    const crossFieldProvider = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${caseA.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "PROVIDER_CONFIRMED",
        providerRefundId: "PH-RF-INVALID-MIX",
        manualReference: "SLIP-INVALID-MIX",
        notes: "Both references must fail"
      }
    });
    expect(crossFieldProvider.statusCode).toBe(400);

    // Verify still AUTHORIZED and zero synthetic rows created
    const beforeSettleTx = await migratorPool.query(
      "SELECT COUNT(*)::int AS cnt FROM payment_transactions WHERE booking_id = $1 AND transaction_type = 'REFUND';",
      [caseA.bookingId]
    );
    expect(beforeSettleTx.rows[0].cnt).toBe(0);
    const synthCheck = await migratorPool.query(
      "SELECT COUNT(*)::int AS cnt FROM refund_records WHERE booking_id = $1 AND provider_refund_id LIKE 'rfnd_%';",
      [caseA.bookingId]
    );
    expect(synthCheck.rows[0].cnt).toBe(0);

    const runTag = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const providerRef1 = `PH-RF-1001-${runTag}`;
    const manualRef1 = `CEFT-LKR-${runTag}`;

    // Case 3: Valid PROVIDER_CONFIRMED transition
    const providerOkRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${caseA.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "PROVIDER_CONFIRMED",
        providerRefundId: providerRef1,
        notes: "PayHere merchant portal refund confirmation verified"
      }
    });
    expect(providerOkRes.statusCode).toBe(200);
    const providerOkBody = JSON.parse(providerOkRes.body).data;
    expect(providerOkBody.status).toBe("SUCCEEDED");
    expect(providerOkBody.settlementMode).toBe("PROVIDER_CONFIRMED");
    expect(providerOkBody.providerRefundId).toBe(providerRef1);
    expect(providerOkBody.manualReference).toBeNull();
    expect(providerOkBody.settledByUserId).toBe(superadmin.userId);

    const dbProviderTx = await migratorPool.query(
      `SELECT provider_transaction_id, evidence_source, signature_verified, manual_reference, settled_by_user_id, refund_id
       FROM payment_transactions
       WHERE refund_id = $1 AND transaction_type = 'REFUND';`,
      [caseA.refundId]
    );
    expect(dbProviderTx.rows.length).toBe(1);
    expect(dbProviderTx.rows[0].provider_transaction_id).toBe(providerRef1);
    expect(dbProviderTx.rows[0].evidence_source).toBe("ADMIN_PROVIDER_ATTESTED");
    expect(dbProviderTx.rows[0].signature_verified).toBe(false);
    expect(dbProviderTx.rows[0].manual_reference).toBeNull();
    expect(dbProviderTx.rows[0].settled_by_user_id).toBe(superadmin.userId);

    // Balanced double-entry refund ledger (Group 1 cancellation reclassification + Group 2 disbursement)
    const ledgerA = await migratorPool.query(
      `SELECT COUNT(DISTINCT transaction_group_id)::int AS groups,
              COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_minor ELSE 0 END), 0)::int AS debits,
              COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_minor ELSE 0 END), 0)::int AS credits
       FROM financial_ledger_entries
       WHERE reference_type = 'REFUND' AND reference_id = $1;`,
      [caseA.refundId]
    );
    expect(ledgerA.rows[0].groups).toBe(2);
    expect(ledgerA.rows[0].debits).toBe(caseA.amountMinor * 2);
    expect(ledgerA.rows[0].credits).toBe(caseA.amountMinor * 2);

    // Admin list endpoints reflect true fields
    const adminRefundsRes = await app.inject({
      method: "GET",
      url: `/api/v1/admin/refunds?bookingId=${caseA.bookingId}`,
      headers: { authorization: `Bearer ${support.accessToken}` }
    });
    expect(adminRefundsRes.statusCode).toBe(200);
    const listedRefund = JSON.parse(adminRefundsRes.body).data[0];
    expect(listedRefund.settlementMode).toBe("PROVIDER_CONFIRMED");
    expect(listedRefund.providerRefundId).toBe(providerRef1);
    expect(listedRefund.settledByUserId).toBe(superadmin.userId);

    const adminTxRes = await app.inject({
      method: "GET",
      url: `/api/v1/admin/payments/transactions?bookingId=${caseA.bookingId}`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` }
    });
    expect(adminTxRes.statusCode).toBe(200);
    const txsA = JSON.parse(adminTxRes.body).data as Array<Record<string, unknown>>;
    const refundTxApi = txsA.find((t) => t.transactionType === "REFUND");
    const chargeTxApi = txsA.find((t) => t.transactionType === "CHARGE");
    expect(chargeTxApi?.evidenceSource).toBe("PROVIDER_WEBHOOK");
    expect(chargeTxApi?.signatureVerified).toBe(true);
    expect(refundTxApi?.evidenceSource).toBe("ADMIN_PROVIDER_ATTESTED");
    expect(refundTxApi?.signatureVerified).toBe(false);
    expect(refundTxApi?.providerTransactionId).toBe(providerRef1);

    // Booking B: MANUAL_OFFLINE validation errors + settlement (cases 4, 5)
    const caseB = await createPaidCancelledRefundWithPayHere(locationId, traveller, {
      daysAhead: 14
    });

    await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${caseB.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: { targetStatus: "AUTHORIZED", notes: "Authorize manual bank transfer refund" }
    });

    // Case 4: MANUAL_OFFLINE missing manualReference or supplying providerRefundId -> 400
    const missingManualRef = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${caseB.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "MANUAL_OFFLINE",
        notes: "No bank transfer reference"
      }
    });
    expect(missingManualRef.statusCode).toBe(400);

    const blankManualRef = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${caseB.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "MANUAL_OFFLINE",
        manualReference: "   ",
        notes: "Blank bank reference"
      }
    });
    expect(blankManualRef.statusCode).toBe(400);

    const crossFieldManual = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${caseB.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "MANUAL_OFFLINE",
        manualReference: "CEFT-REF-99",
        providerRefundId: "PH-RF-99",
        notes: "Cross-field rejection"
      }
    });
    expect(crossFieldManual.statusCode).toBe(400);

    // Case 5: Valid MANUAL_OFFLINE settlement -> provider_transaction_id = NULL, ADMIN_MANUAL_OFFLINE, signature_verified = false
    const manualOkRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${caseB.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "MANUAL_OFFLINE",
        manualReference: manualRef1,
        notes: "Settled manually via Sampath Bank corporate CEFT transfer"
      }
    });
    expect(manualOkRes.statusCode).toBe(200);
    const manualOkBody = JSON.parse(manualOkRes.body).data;
    expect(manualOkBody.status).toBe("SUCCEEDED");
    expect(manualOkBody.settlementMode).toBe("MANUAL_OFFLINE");
    expect(manualOkBody.providerRefundId).toBeNull();
    expect(manualOkBody.manualReference).toBe(manualRef1);
    expect(manualOkBody.settledByUserId).toBe(superadmin.userId);

    const dbManualTx = await migratorPool.query(
      `SELECT provider_transaction_id, evidence_source, signature_verified, manual_reference, settled_by_user_id
       FROM payment_transactions
       WHERE refund_id = $1 AND transaction_type = 'REFUND';`,
      [caseB.refundId]
    );
    expect(dbManualTx.rows.length).toBe(1);
    expect(dbManualTx.rows[0].provider_transaction_id).toBeNull();
    expect(dbManualTx.rows[0].evidence_source).toBe("ADMIN_MANUAL_OFFLINE");
    expect(dbManualTx.rows[0].signature_verified).toBe(false);
    expect(dbManualTx.rows[0].manual_reference).toBe(manualRef1);
    expect(dbManualTx.rows[0].settled_by_user_id).toBe(superadmin.userId);

    const ledgerB = await migratorPool.query(
      `SELECT COUNT(DISTINCT transaction_group_id)::int AS groups,
              COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_minor ELSE 0 END), 0)::int AS debits,
              COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_minor ELSE 0 END), 0)::int AS credits
       FROM financial_ledger_entries
       WHERE reference_type = 'REFUND' AND reference_id = $1;`,
      [caseB.refundId]
    );
    expect(ledgerB.rows[0].groups).toBe(2);
    expect(ledgerB.rows[0].debits).toBe(caseB.amountMinor * 2);
    expect(ledgerB.rows[0].credits).toBe(caseB.amountMinor * 2);
  });

  it("6. enforces PostgreSQL CHECK constraints against forged signature_verified=true and verifies SANDBOX webhook vs simulator evidence sources", async () => {
    const { locationId } = await createActiveLocation();
    const traveller = await createTestUser("TRAVELLER", "Evidence Proof User");

    // Verified SANDBOX webhook -> PROVIDER_WEBHOOK + signature_verified = true
    const base = new Date();
    base.setUTCDate(base.getUTCDate() + 16);
    const yyyy = base.getUTCFullYear();
    const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(base.getUTCDate()).padStart(2, "0");

    const bWhRes = await app.inject({
      method: "POST",
      url: "/api/v1/bookings",
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: {
        locationId,
        dropOffAt: `${yyyy}-${mm}-${dd}T04:30:00.000Z`,
        collectionAt: `${yyyy}-${mm}-${dd}T11:30:00.000Z`,
        items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
      }
    });
    expect(bWhRes.statusCode).toBe(201);
    const bWh = JSON.parse(bWhRes.body).data as { id: string; totalAmountMinor: number };

    const iWhRes = await app.inject({
      method: "POST",
      url: "/api/v1/payments/intents",
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { bookingId: bWh.id }
    });
    expect(iWhRes.statusCode).toBe(201);
    const iWh = JSON.parse(iWhRes.body).data as { id: string; providerOrderId: string };

    const sandboxAdapter = new SandboxSignedGatewayAdapter(env.PAYMENT_WEBHOOK_SECRET);
    const sbxBody = JSON.stringify({
      eventId: `evt_sbx_b9_${Date.now()}`,
      providerOrderId: iWh.providerOrderId,
      providerTransactionId: `TX-SBX-B9-${Date.now()}`,
      status: "SUCCEEDED",
      amountMinor: bWh.totalAmountMinor,
      currency: "LKR",
      timestamp: Math.floor(Date.now() / 1000)
    });
    const sbxWhRes = await app.inject({
      method: "POST",
      url: "/api/v1/payments/webhooks/sandbox",
      headers: {
        "content-type": "application/json",
        "x-sandbox-signature": sandboxAdapter.signWebhookPayload(sbxBody)
      },
      payload: sbxBody
    });
    expect(sbxWhRes.statusCode).toBe(200);

    const whTxRow = await migratorPool.query(
      "SELECT evidence_source, signature_verified FROM payment_transactions WHERE payment_intent_id = $1;",
      [iWh.id]
    );
    expect(whTxRow.rows[0].evidence_source).toBe("PROVIDER_WEBHOOK");
    expect(whTxRow.rows[0].signature_verified).toBe(true);

    // SANDBOX_SIMULATOR -> evidence_source = 'SANDBOX_SIMULATOR' and signature_verified = false
    const bSimRes = await app.inject({
      method: "POST",
      url: "/api/v1/bookings",
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: {
        locationId,
        dropOffAt: `${yyyy}-${mm}-${dd}T04:30:00.000Z`,
        collectionAt: `${yyyy}-${mm}-${dd}T11:30:00.000Z`,
        items: [{ bagCategory: "BAG_SMALL", quantity: 1 }]
      }
    });
    const bSim = JSON.parse(bSimRes.body).data as { id: string };
    const iSimRes = await app.inject({
      method: "POST",
      url: "/api/v1/payments/intents",
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { bookingId: bSim.id }
    });
    const iSim = JSON.parse(iSimRes.body).data as { id: string };
    const simOk = await app.inject({
      method: "POST",
      url: `/api/v1/payments/intents/${iSim.id}/sandbox-simulate`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { outcome: "SUCCEEDED" }
    });
    expect(simOk.statusCode).toBe(200);

    const simTxRow = await migratorPool.query(
      "SELECT evidence_source, signature_verified FROM payment_transactions WHERE payment_intent_id = $1;",
      [iSim.id]
    );
    expect(simTxRow.rows[0].evidence_source).toBe("SANDBOX_SIMULATOR");
    expect(simTxRow.rows[0].signature_verified).toBe(false);

    // Direct SQL CHECK proofs via migratorPool:
    // (a) ADMIN_PROVIDER_ATTESTED with signature_verified=true MUST fail
    await expect(
      migratorPool.query(
        `INSERT INTO payment_transactions (
           payment_intent_id, booking_id, provider, provider_transaction_id,
           transaction_type, status, amount_minor, currency, evidence_source, signature_verified
         ) VALUES ($1, $2, 'PAYHERE', 'FORGED-SIG-1', 'REFUND', 'SUCCEEDED', 1000, 'LKR', 'ADMIN_PROVIDER_ATTESTED', true);`,
        [iWh.id, bWh.id]
      )
    ).rejects.toThrow(/payment_transactions_sig_evidence_check/);

    // (b) SANDBOX_SIMULATOR with signature_verified=true MUST fail
    await expect(
      migratorPool.query(
        `INSERT INTO payment_transactions (
           payment_intent_id, booking_id, provider, provider_transaction_id,
           transaction_type, status, amount_minor, currency, evidence_source, signature_verified
         ) VALUES ($1, $2, 'SANDBOX_GATEWAY', 'FORGED-SIG-2', 'CHARGE', 'SUCCEEDED', 1000, 'LKR', 'SANDBOX_SIMULATOR', true);`,
        [iWh.id, bWh.id]
      )
    ).rejects.toThrow(/payment_transactions_sig_evidence_check/);

    // (c) ADMIN_MANUAL_OFFLINE with signature_verified=true MUST fail
    await expect(
      migratorPool.query(
        `INSERT INTO payment_transactions (
           payment_intent_id, booking_id, provider, provider_transaction_id,
           transaction_type, status, amount_minor, currency, evidence_source, manual_reference, signature_verified
         ) VALUES ($1, $2, 'PAYHERE', NULL, 'REFUND', 'SUCCEEDED', 1000, 'LKR', 'ADMIN_MANUAL_OFFLINE', 'SLIP-1', true);`,
        [iWh.id, bWh.id]
      )
    ).rejects.toThrow(/payment_transactions_sig_evidence_check/);

    // (d) ADMIN_MANUAL_OFFLINE with non-null provider_transaction_id MUST fail
    await expect(
      migratorPool.query(
        `INSERT INTO payment_transactions (
           payment_intent_id, booking_id, provider, provider_transaction_id,
           transaction_type, status, amount_minor, currency, evidence_source, manual_reference, signature_verified
         ) VALUES ($1, $2, 'PAYHERE', 'NOT-NULL-TX', 'REFUND', 'SUCCEEDED', 1000, 'LKR', 'ADMIN_MANUAL_OFFLINE', 'SLIP-2', false);`,
        [iWh.id, bWh.id]
      )
    ).rejects.toThrow(/payment_transactions_provider_tx_presence_check/);

    // (e) ADMIN_PROVIDER_ATTESTED on CHARGE transaction_type MUST fail
    await expect(
      migratorPool.query(
        `INSERT INTO payment_transactions (
           payment_intent_id, booking_id, provider, provider_transaction_id,
           transaction_type, status, amount_minor, currency, evidence_source, signature_verified
         ) VALUES ($1, $2, 'PAYHERE', 'FORGED-CHG-1', 'CHARGE', 'SUCCEEDED', 1000, 'LKR', 'ADMIN_PROVIDER_ATTESTED', false);`,
        [iWh.id, bWh.id]
      )
    ).rejects.toThrow(/payment_transactions_admin_refund_only_check/);

    // (f) refund_records SUCCEEDED without settlement_mode MUST fail
    await expect(
      migratorPool.query(
        `INSERT INTO refund_records (
           booking_id, payment_intent_id, amount_minor, currency, refund_percentage,
           reason_category, status, settlement_mode
         ) VALUES ($1, $2, 1000, 'LKR', 100, 'TRAVELLER_CANCELLATION', 'SUCCEEDED', NULL);`,
        [bWh.id, iWh.id]
      )
    ).rejects.toThrow(/refund_records_succeeded_evidence_check/);
  });

  it("7-8. blocks duplicate providerRefundId across refunds or charges (409) and blocks refunds lacking sufficient captured charges (409)", async () => {
    const { locationId } = await createActiveLocation();
    const traveller = await createTestUser("TRAVELLER", "Duplicate & Charge Bound User");
    const superadmin = await createTestUser("SUPERADMIN", "Superadmin Bound");

    const runTag = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const dupChargeTxId = `PH-CHARGE-DUP-${runTag}`;
    const sharedRefundRef = `PH-UNIQUE-RF-${runTag}`;

    // Case 7a: Cross-refund duplicate providerRefundId -> 409
    const rA = await createPaidCancelledRefundWithPayHere(locationId, traveller, { daysAhead: 18 });
    const rB = await createPaidCancelledRefundWithPayHere(locationId, traveller, { daysAhead: 19 });
    const rC = await createPaidCancelledRefundWithPayHere(locationId, traveller, {
      daysAhead: 20,
      paymentId: dupChargeTxId
    });

    for (const rid of [rA.refundId, rB.refundId, rC.refundId]) {
      const auth = await app.inject({
        method: "POST",
        url: `/api/v1/admin/refunds/${rid}/transition`,
        headers: { authorization: `Bearer ${superadmin.accessToken}` },
        payload: { targetStatus: "AUTHORIZED", notes: "Ready for settlement checks" }
      });
      expect(auth.statusCode).toBe(200);
    }

    const firstOk = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${rA.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "PROVIDER_CONFIRMED",
        providerRefundId: sharedRefundRef,
        notes: "First refund settlement"
      }
    });
    expect(firstOk.statusCode).toBe(200);

    const dupRefundIdRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${rB.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "PROVIDER_CONFIRMED",
        providerRefundId: sharedRefundRef,
        notes: "Reusing rA refund reference must conflict"
      }
    });
    expect(dupRefundIdRes.statusCode).toBe(409);

    // Case 7b: Reusing captured CHARGE providerTransactionId on refund -> 409
    const reuseChargeTxRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${rC.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "PROVIDER_CONFIRMED",
        providerRefundId: dupChargeTxId,
        notes: "Reusing charge payment_id must conflict"
      }
    });
    expect(reuseChargeTxRes.statusCode).toBe(409);

    // Case 8a: Unpaid / FAILED intent with no captured CHARGE -> 409
    const base = new Date();
    base.setUTCDate(base.getUTCDate() + 21);
    const yyyy = base.getUTCFullYear();
    const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(base.getUTCDate()).padStart(2, "0");

    const unpaidBRes = await app.inject({
      method: "POST",
      url: "/api/v1/bookings",
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: {
        locationId,
        dropOffAt: `${yyyy}-${mm}-${dd}T04:30:00.000Z`,
        collectionAt: `${yyyy}-${mm}-${dd}T11:30:00.000Z`,
        items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
      }
    });
    expect(unpaidBRes.statusCode).toBe(201);
    const unpaidB = JSON.parse(unpaidBRes.body).data as { id: string };

    const failIntentRes = await app.inject({
      method: "POST",
      url: "/api/v1/payments/intents",
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { bookingId: unpaidB.id }
    });
    expect(failIntentRes.statusCode).toBe(201);
    const failIntent = JSON.parse(failIntentRes.body).data as { id: string };

    await app.inject({
      method: "POST",
      url: `/api/v1/payments/intents/${failIntent.id}/sandbox-simulate`,
      headers: { authorization: `Bearer ${traveller.accessToken}` },
      payload: { outcome: "FAILED" }
    });

    const unpaidRefundInsert = await migratorPool.query<{ id: string }>(
      `INSERT INTO refund_records (
         booking_id, payment_intent_id, amount_minor, currency, refund_percentage,
         reason_category, status, notes
       ) VALUES ($1, $2, 150000, 'LKR', 100, 'DISPUTE_RESOLUTION', 'AUTHORIZED', 'Test unpaid refund')
       RETURNING id;`,
      [unpaidB.id, failIntent.id]
    );
    const unpaidRefundId = unpaidRefundInsert.rows[0].id;

    const unpaidSettleAttempt = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${unpaidRefundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "MANUAL_OFFLINE",
        manualReference: "BANK-UNPAID-99",
        notes: "Must be rejected without SUCCEEDED charge"
      }
    });
    expect(unpaidSettleAttempt.statusCode).toBe(409);

    // Case 8b: Refund amount exceeding captured charge -> 409
    const overRefundInsert = await migratorPool.query<{ id: string }>(
      `INSERT INTO refund_records (
         booking_id, payment_intent_id, amount_minor, currency, refund_percentage,
         reason_category, status, notes
       ) VALUES ($1, $2, 200000, 'LKR', 100, 'DISPUTE_RESOLUTION', 'AUTHORIZED', 'Exceeds captured 150000')
       RETURNING id;`,
      [rB.bookingId, rB.intentId]
    );
    const overRefundId = overRefundInsert.rows[0].id;

    const overSettleAttempt = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${overRefundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "MANUAL_OFFLINE",
        manualReference: "BANK-OVER-REFUND-1",
        notes: "Cannot refund more than captured charge"
      }
    });
    expect(overSettleAttempt.statusCode).toBe(409);
  });

  it("9-11. supports idempotent settlement retry (409 on mode/ref conflict), serializes 5x concurrent SUCCEEDED transitions, and resists stale webhook replay", async () => {
    const { locationId } = await createActiveLocation();
    const traveller = await createTestUser("TRAVELLER", "Idempotency & Race User");
    const superadmin = await createTestUser("SUPERADMIN", "Superadmin Race");

    const runTag = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const idemRef1 = `PH-IDEM-${runTag}-1`;
    const idemRef2 = `PH-IDEM-${runTag}-2`;
    const raceRef = `PH-RACE-${runTag}`;
    const staleManualRef = `CEFT-STALE-${runTag}-1`;
    const staleDiffRef = `CEFT-STALE-${runTag}-2`;

    // Case 9: Idempotent replay vs conflict for PROVIDER_CONFIRMED and MANUAL_OFFLINE
    const pCase = await createPaidCancelledRefundWithPayHere(locationId, traveller, {
      daysAhead: 23
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${pCase.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: { targetStatus: "AUTHORIZED", notes: "Ready for idempotency test" }
    });

    const settle1 = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${pCase.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "PROVIDER_CONFIRMED",
        providerRefundId: idemRef1,
        notes: "Initial settlement"
      }
    });
    expect(settle1.statusCode).toBe(200);

    // Same mode & same ref -> 200 idempotent, zero duplicate tx or ledger groups
    const replaySame = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${pCase.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "PROVIDER_CONFIRMED",
        providerRefundId: idemRef1,
        notes: "Idempotent retry"
      }
    });
    expect(replaySame.statusCode).toBe(200);

    // Different providerRefundId -> 409
    const replayDiffRef = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${pCase.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "PROVIDER_CONFIRMED",
        providerRefundId: idemRef2,
        notes: "Changed reference must conflict"
      }
    });
    expect(replayDiffRef.statusCode).toBe(409);

    // Different settlementMode -> 409
    const replayDiffMode = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${pCase.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "MANUAL_OFFLINE",
        manualReference: "SLIP-DIFF-001",
        notes: "Changed mode must conflict"
      }
    });
    expect(replayDiffMode.statusCode).toBe(409);

    const pTxCount = await migratorPool.query(
      "SELECT COUNT(*)::int AS cnt FROM payment_transactions WHERE refund_id = $1 AND transaction_type = 'REFUND';",
      [pCase.refundId]
    );
    expect(pTxCount.rows[0].cnt).toBe(1);
    const pLedgerGroups = await migratorPool.query(
      "SELECT COUNT(DISTINCT transaction_group_id)::int AS cnt FROM financial_ledger_entries WHERE reference_type = 'REFUND' AND reference_id = $1;",
      [pCase.refundId]
    );
    expect(pLedgerGroups.rows[0].cnt).toBe(2);

    // Case 10: Concurrent 5x adminTransitionRefund -> SUCCEEDED race
    const raceCase = await createPaidCancelledRefundWithPayHere(locationId, traveller, {
      daysAhead: 25
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${raceCase.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: { targetStatus: "AUTHORIZED", notes: "Ready for 5x race" }
    });

    const raceResponses = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        app.inject({
          method: "POST",
          url: `/api/v1/admin/refunds/${raceCase.refundId}/transition`,
          headers: { authorization: `Bearer ${superadmin.accessToken}` },
          payload: {
            targetStatus: "SUCCEEDED",
            settlementMode: "PROVIDER_CONFIRMED",
            providerRefundId: raceRef,
            notes: `Concurrent settlement worker #${i + 1}`
          }
        })
      )
    );
    for (const res of raceResponses) {
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.status).toBe("SUCCEEDED");
    }

    const raceTxCnt = await migratorPool.query(
      "SELECT COUNT(*)::int AS cnt FROM payment_transactions WHERE refund_id = $1 AND transaction_type = 'REFUND' AND status = 'SUCCEEDED';",
      [raceCase.refundId]
    );
    expect(raceTxCnt.rows[0].cnt).toBe(1);

    const raceLedgerGroups = await migratorPool.query(
      `SELECT COUNT(DISTINCT transaction_group_id)::int AS groups,
              COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_minor ELSE 0 END), 0)::int AS debits,
              COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_minor ELSE 0 END), 0)::int AS credits
       FROM financial_ledger_entries
       WHERE reference_type = 'REFUND' AND reference_id = $1;`,
      [raceCase.refundId]
    );
    expect(raceLedgerGroups.rows[0].groups).toBe(2);
    expect(raceLedgerGroups.rows[0].debits).toBe(raceCase.amountMinor * 2);
    expect(raceLedgerGroups.rows[0].credits).toBe(raceCase.amountMinor * 2);

    // Case 11: Stale webhook replay & out-of-order failed webhook after MANUAL_OFFLINE settlement
    const staleCase = await createPaidCancelledRefundWithPayHere(locationId, traveller, {
      daysAhead: 27
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${staleCase.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: { targetStatus: "AUTHORIZED", notes: "Approve manual refund" }
    });
    const staleSettle = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${staleCase.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "MANUAL_OFFLINE",
        manualReference: staleManualRef,
        notes: "Manual settlement before delayed webhooks"
      }
    });
    expect(staleSettle.statusCode).toBe(200);

    // Also confirm MANUAL_OFFLINE exact replay returns 200 and mismatch returns 409
    const manualReplaySame = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${staleCase.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "MANUAL_OFFLINE",
        manualReference: staleManualRef,
        notes: "Manual idempotent replay"
      }
    });
    expect(manualReplaySame.statusCode).toBe(200);

    const manualDiffRef = await app.inject({
      method: "POST",
      url: `/api/v1/admin/refunds/${staleCase.refundId}/transition`,
      headers: { authorization: `Bearer ${superadmin.accessToken}` },
      payload: {
        targetStatus: "SUCCEEDED",
        settlementMode: "MANUAL_OFFLINE",
        manualReference: staleDiffRef,
        notes: "Changed manual reference"
      }
    });
    expect(manualDiffRef.statusCode).toBe(409);

    const ledgerBeforeReplay = await migratorPool.query(
      "SELECT COUNT(*)::int AS cnt FROM financial_ledger_entries WHERE booking_id = $1;",
      [staleCase.bookingId]
    );

    // Replay original PayHere success webhook & delayed out-of-order failure webhook
    const staleFailSig = PayHereGatewayAdapter.computeNotifyMd5Sig({
      merchantId: TEST_PAYHERE_MERCHANT_ID,
      orderId: staleCase.providerOrderId,
      payhereAmount: "1500.00",
      payhereCurrency: "LKR",
      statusCode: "-2",
      merchantSecret: TEST_PAYHERE_MERCHANT_SECRET
    });
    const staleFailBody = new URLSearchParams({
      merchant_id: TEST_PAYHERE_MERCHANT_ID,
      order_id: staleCase.providerOrderId,
      payment_id: `PH-DELAYED-FAIL-${Date.now()}`,
      payhere_amount: "1500.00",
      payhere_currency: "LKR",
      status_code: "-2",
      status_message: "Delayed failed event",
      md5sig: staleFailSig,
      custom_1: staleCase.intentId,
      custom_2: staleCase.bookingId
    }).toString();

    await withPayHereEnv(async () => {
      const r1 = await app.inject({
        method: "POST",
        url: "/api/v1/payments/webhooks/payhere",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: staleCase.notifyBody
      });
      expect(r1.statusCode).toBe(200);

      const r2 = await app.inject({
        method: "POST",
        url: "/api/v1/payments/webhooks/payhere",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: staleFailBody
      });
      expect(r2.statusCode).toBe(200);
    });

    const bookingAfter = await migratorPool.query(
      "SELECT status FROM bookings WHERE id = $1;",
      [staleCase.bookingId]
    );
    expect(bookingAfter.rows[0].status).toBe("CANCELLED_BY_TRAVELLER");

    const refundAfter = await migratorPool.query(
      "SELECT status, settlement_mode, provider_refund_id, manual_reference FROM refund_records WHERE id = $1;",
      [staleCase.refundId]
    );
    expect(refundAfter.rows[0].status).toBe("SUCCEEDED");
    expect(refundAfter.rows[0].settlement_mode).toBe("MANUAL_OFFLINE");
    expect(refundAfter.rows[0].provider_refund_id).toBeNull();
    expect(refundAfter.rows[0].manual_reference).toBe(staleManualRef);

    const refundTxAfter = await migratorPool.query(
      "SELECT evidence_source, signature_verified, provider_transaction_id, manual_reference FROM payment_transactions WHERE refund_id = $1;",
      [staleCase.refundId]
    );
    expect(refundTxAfter.rows.length).toBe(1);
    expect(refundTxAfter.rows[0].evidence_source).toBe("ADMIN_MANUAL_OFFLINE");
    expect(refundTxAfter.rows[0].signature_verified).toBe(false);
    expect(refundTxAfter.rows[0].provider_transaction_id).toBeNull();

    const ledgerAfterReplay = await migratorPool.query(
      "SELECT COUNT(*)::int AS cnt FROM financial_ledger_entries WHERE booking_id = $1;",
      [staleCase.bookingId]
    );
    expect(ledgerAfterReplay.rows[0].cnt).toBe(ledgerBeforeReplay.rows[0].cnt);
  });

  it("12. executes clean 0000->0014 and upgrade 0000->0013->0014 migrations preserving webhooks and downgrading legacy synthetic refund rows", async () => {
    const parsed = new URL(env.MIGRATION_DATABASE_URL!);
    const superUrl = new URL(env.MIGRATION_DATABASE_URL!);
    superUrl.username = "postgres";
    superUrl.password = "postgres";
    superUrl.pathname = "/postgres";

    const adminPool = new Pool({ connectionString: superUrl.toString(), max: 2 });
    const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const cleanDb = `b9_clean_0014_${suffix}`;
    const upgradeDb = `b9_upgrade_0014_${suffix}`;

    const createRoleGrantedDb = async (dbName: string) => {
      await adminPool.query(`CREATE DATABASE ${dbName} OWNER postgres;`);
      await adminPool.query(`REVOKE ALL ON DATABASE ${dbName} FROM PUBLIC;`);
      await adminPool.query(
        `GRANT CONNECT, TEMPORARY ON DATABASE ${dbName} TO luggage_migrator, luggage_user;`
      );

      const dbSuperUrl = new URL(superUrl.toString());
      dbSuperUrl.pathname = `/${dbName}`;
      const dbSuperPool = new Pool({ connectionString: dbSuperUrl.toString(), max: 1 });
      try {
        await dbSuperPool.query(`CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;`);
        await dbSuperPool.query(`CREATE EXTENSION IF NOT EXISTS postgis_topology;`);
        await dbSuperPool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;`);
        await dbSuperPool.query(
          `GRANT USAGE, CREATE ON SCHEMA public TO luggage_migrator, luggage_role_assigner;`
        );
        await dbSuperPool.query(`GRANT USAGE ON SCHEMA public TO luggage_user;`);
        await dbSuperPool.query(`REVOKE CREATE ON SCHEMA public FROM luggage_user;`);
        await dbSuperPool.query(
          `ALTER DEFAULT PRIVILEGES FOR ROLE luggage_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO luggage_user;`
        );
        await dbSuperPool.query(
          `ALTER DEFAULT PRIVILEGES FOR ROLE luggage_migrator IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO luggage_user;`
        );
        await dbSuperPool.query(
          `ALTER DEFAULT PRIVILEGES FOR ROLE luggage_migrator IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;`
        );
        await dbSuperPool.query(
          `ALTER DEFAULT PRIVILEGES FOR ROLE luggage_migrator IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO luggage_user;`
        );
      } finally {
        await dbSuperPool.end();
      }
    };

    try {
      // 1. Clean 0000 -> 0014
      await createRoleGrantedDb(cleanDb);
      const cleanMigUrl = new URL(parsed.toString());
      cleanMigUrl.pathname = `/${cleanDb}`;
      const appliedClean = await runMigrations(cleanMigUrl.toString());
      expect(appliedClean).toBeGreaterThanOrEqual(15);

      const secondClean = await runMigrations(cleanMigUrl.toString());
      expect(secondClean).toBe(0);

      // 2. Upgrade 0000..0013 -> 0014
      await createRoleGrantedDb(upgradeDb);
      const upgMigUrl = new URL(parsed.toString());
      upgMigUrl.pathname = `/${upgradeDb}`;
      const upgPool = new Pool({ connectionString: upgMigUrl.toString(), max: 1 });

      const ids = {
        travellerId: crypto.randomUUID(),
        hostId: crypto.randomUUID(),
        bizId: crypto.randomUUID(),
        locId: crypto.randomUUID(),
        bChargeId: crypto.randomUUID(),
        bSynthId: crypto.randomUUID(),
        bRealId: crypto.randomUUID(),
        iChargeId: crypto.randomUUID(),
        iSynthId: crypto.randomUUID(),
        iRealId: crypto.randomUUID(),
        rSynthId: crypto.randomUUID(),
        rRealId: crypto.randomUUID()
      };

      try {
        const currentDir = path.dirname(fileURLToPath(import.meta.url));
        const migrationsFolder = path.resolve(
          currentDir,
          "../src/infrastructure/database/migrations"
        );
        const allMigrations = readMigrationFiles({ migrationsFolder });
        const through0013 = allMigrations.slice(0, 14);

        await upgPool.query(`
          CREATE TABLE IF NOT EXISTS public.__drizzle_migrations (
            id SERIAL PRIMARY KEY,
            hash text NOT NULL,
            created_at bigint
          );
        `);

        for (const m of through0013) {
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

        // Seed 0013 baseline data (with pre-0014 legacy synthetic rfnd_* & verified PayHere charge)
        await upgPool.query(
          `INSERT INTO users (id, email, normalized_email, password_hash, display_name, status, is_email_verified)
           VALUES
             ($1, 't13@example.com', 't13@example.com', '$argon2id$v=19$m=65536,t=3,p=4$test$test', 'T13', 'ACTIVE', true),
             ($2, 'h13@example.com', 'h13@example.com', '$argon2id$v=19$m=65536,t=3,p=4$test$test', 'H13', 'ACTIVE', true);`,
          [ids.travellerId, ids.hostId]
        );
        await upgPool.query(
          `INSERT INTO host_businesses (id, owner_user_id, legal_business_name, trade_name, contact_email, contact_phone, status)
           VALUES ($1, $2, 'Upg Co', 'Upg Co', 'h13@example.com', '+94771234567', 'ACTIVE');`,
          [ids.bizId, ids.hostId]
        );
        await upgPool.query(
          `INSERT INTO storage_locations (
             id, business_id, name, address_line1, city, latitude, longitude, coordinates, coarse_coordinates, status
           ) VALUES (
             $1, $2, 'Upg Counter', '10 Main St', 'Colombo', 6.9271, 79.8612,
             ST_SetSRID(ST_MakePoint(79.8612, 6.9271), 4326)::geography,
             ST_SetSRID(ST_MakePoint(79.86, 6.93), 4326)::geography,
             'ACTIVE'
           );`,
          [ids.locId, ids.bizId]
        );

        await upgPool.query(
          `INSERT INTO bookings (
             id, reference_code, traveller_user_id, business_id, location_id,
             booking_mode, status, drop_off_at, collection_at,
             total_bags, total_capacity_units, currency, total_amount_minor
           ) VALUES
             ($1, 'LUG-U01', $4, $5, $6, 'INSTANT', 'CONFIRMED', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days', 1, 2, 'LKR', 150000),
             ($2, 'LUG-U02', $4, $5, $6, 'INSTANT', 'CANCELLED_BY_TRAVELLER', NOW() + INTERVAL '4 days', NOW() + INTERVAL '5 days', 1, 2, 'LKR', 150000),
             ($3, 'LUG-U03', $4, $5, $6, 'INSTANT', 'CANCELLED_BY_TRAVELLER', NOW() + INTERVAL '6 days', NOW() + INTERVAL '7 days', 1, 2, 'LKR', 150000);`,
          [ids.bChargeId, ids.bSynthId, ids.bRealId, ids.travellerId, ids.bizId, ids.locId]
        );

        await upgPool.query(
          `INSERT INTO payment_intents (
             id, booking_id, traveller_user_id, provider, provider_order_id,
             amount_minor, currency, status, expires_at
           ) VALUES
             ($1, $4, $7, 'PAYHERE', 'ord_u1', 150000, 'LKR', 'SUCCEEDED', NOW() + INTERVAL '1 hour'),
             ($2, $5, $7, 'PAYHERE', 'ord_u2', 150000, 'LKR', 'SUCCEEDED', NOW() + INTERVAL '1 hour'),
             ($3, $6, $7, 'PAYHERE', 'ord_u3', 150000, 'LKR', 'SUCCEEDED', NOW() + INTERVAL '1 hour');`,
          [
            ids.iChargeId,
            ids.iSynthId,
            ids.iRealId,
            ids.bChargeId,
            ids.bSynthId,
            ids.bRealId,
            ids.travellerId
          ]
        );

        await upgPool.query(
          `INSERT INTO payment_transactions (
             payment_intent_id, booking_id, provider, provider_transaction_id,
             transaction_type, status, amount_minor, currency, signature_verified, metadata
           ) VALUES
             ($1, $4, 'PAYHERE', 'PH-PRE0014-CHG', 'CHARGE', 'SUCCEEDED', 150000, 'LKR', true, '{}'),
             ($2, $5, 'PAYHERE', 'PH-PRE0014-CHG2', 'CHARGE', 'SUCCEEDED', 150000, 'LKR', true, '{}'),
             ($2, $5, 'PAYHERE', 'rfnd_legacy_123456', 'REFUND', 'SUCCEEDED', 150000, 'LKR', true, '{}'),
             ($3, $6, 'PAYHERE', 'PH-PRE0014-CHG3', 'CHARGE', 'SUCCEEDED', 150000, 'LKR', true, '{}'),
             ($3, $6, 'PAYHERE', 'PH-PRE0014-RFD', 'REFUND', 'SUCCEEDED', 150000, 'LKR', true, '{}');`,
          [ids.iChargeId, ids.iSynthId, ids.iRealId, ids.bChargeId, ids.bSynthId, ids.bRealId]
        );

        await upgPool.query(
          `INSERT INTO refund_records (
             id, booking_id, payment_intent_id, amount_minor, currency,
             refund_percentage, reason_category, status, provider_refund_id,
             requested_by_user_id, authorized_by_user_id, notes, completed_at
           ) VALUES
             ($1, $3, $5, 150000, 'LKR', 100, 'TRAVELLER_CANCELLATION', 'SUCCEEDED', 'rfnd_legacy_123456', $7, $7, 'Pre-0014 synthetic ref', NOW()),
             ($2, $4, $6, 150000, 'LKR', 100, 'TRAVELLER_CANCELLATION', 'SUCCEEDED', 'PH-PRE0014-RFD', $7, $7, 'Pre-0014 provider ref', NOW());`,
          [
            ids.rSynthId,
            ids.rRealId,
            ids.bSynthId,
            ids.bRealId,
            ids.iSynthId,
            ids.iRealId,
            ids.travellerId
          ]
        );
      } finally {
        await upgPool.end();
      }

      // Apply 0014 via runMigrations()
      const appliedUpgrade = await runMigrations(upgMigUrl.toString());
      expect(appliedUpgrade).toBeGreaterThanOrEqual(1);

      const postUpgPool = new Pool({ connectionString: upgMigUrl.toString(), max: 1 });
      try {
        // Pre-0014 verified PayHere CHARGE preserved as PROVIDER_WEBHOOK + signature_verified = true
        const chargeRow = await postUpgPool.query(
          `SELECT evidence_source, signature_verified, provider_transaction_id
           FROM payment_transactions
           WHERE booking_id = $1 AND transaction_type = 'CHARGE';`,
          [ids.bChargeId]
        );
        expect(chargeRow.rows[0].evidence_source).toBe("PROVIDER_WEBHOOK");
        expect(chargeRow.rows[0].signature_verified).toBe(true);
        expect(chargeRow.rows[0].provider_transaction_id).toBe("PH-PRE0014-CHG");

        // Legacy synthetic rfnd_* moved to MANUAL_OFFLINE + signature_verified = false + NULL provider ID
        const synthRefRec = await postUpgPool.query(
          "SELECT settlement_mode, provider_refund_id, manual_reference FROM refund_records WHERE id = $1;",
          [ids.rSynthId]
        );
        expect(synthRefRec.rows[0].settlement_mode).toBe("MANUAL_OFFLINE");
        expect(synthRefRec.rows[0].provider_refund_id).toBeNull();
        expect(synthRefRec.rows[0].manual_reference).toBe("rfnd_legacy_123456");

        const synthTx = await postUpgPool.query(
          `SELECT evidence_source, signature_verified, provider_transaction_id, manual_reference
           FROM payment_transactions
           WHERE booking_id = $1 AND transaction_type = 'REFUND';`,
          [ids.bSynthId]
        );
        expect(synthTx.rows[0].evidence_source).toBe("ADMIN_MANUAL_OFFLINE");
        expect(synthTx.rows[0].signature_verified).toBe(false);
        expect(synthTx.rows[0].provider_transaction_id).toBeNull();
        expect(synthTx.rows[0].manual_reference).toBe("rfnd_legacy_123456");

        // Legacy non-synthetic provider refund preserved as PROVIDER_CONFIRMED / ADMIN_PROVIDER_ATTESTED + signature_verified = false
        const realRefRec = await postUpgPool.query(
          "SELECT settlement_mode, provider_refund_id, manual_reference FROM refund_records WHERE id = $1;",
          [ids.rRealId]
        );
        expect(realRefRec.rows[0].settlement_mode).toBe("PROVIDER_CONFIRMED");
        expect(realRefRec.rows[0].provider_refund_id).toBe("PH-PRE0014-RFD");
        expect(realRefRec.rows[0].manual_reference).toBeNull();

        const realTx = await postUpgPool.query(
          `SELECT evidence_source, signature_verified, provider_transaction_id
           FROM payment_transactions
           WHERE booking_id = $1 AND transaction_type = 'REFUND';`,
          [ids.bRealId]
        );
        expect(realTx.rows[0].evidence_source).toBe("ADMIN_PROVIDER_ATTESTED");
        expect(realTx.rows[0].signature_verified).toBe(false);
        expect(realTx.rows[0].provider_transaction_id).toBe("PH-PRE0014-RFD");
      } finally {
        await postUpgPool.end();
      }
    } finally {
      await adminPool.query(`DROP DATABASE IF EXISTS ${cleanDb} WITH (FORCE);`).catch(() => {});
      await adminPool.query(`DROP DATABASE IF EXISTS ${upgradeDb} WITH (FORCE);`).catch(() => {});
      await adminPool.end();
    }
  });
});

