import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { marketplaceApi } from "../src/services/marketplace-api";
import { setAccessToken, clearAccessToken } from "../src/services/api-client";

describe("Phase B — Mobile Traveller & Host Booking, Payment & Custody Flows", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearAccessToken();
  });

  it("quotes LKR minor-unit storage pricing, creates booking, simulates sandbox payment, and issues single-use pass", async () => {
    setAccessToken("mobile-traveller-jwt");
    const locId = "11111111-2222-4333-8444-555555555555";
    const bookingId = "22222222-3333-4444-8555-666666666666";
    const intentId = "33333333-4444-4555-8666-777777777777";
    const qrToken = "f".repeat(64);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            locationId: locId,
            bookingMode: "INSTANT",
            currency: "LKR",
            currencyExponent: 2,
            pricingUnit: "CALENDAR_DAY",
            durationHours: 9,
            durationUnits: 1,
            totalBags: 2,
            totalCapacityUnits: 2,
            grossStorageMinor: 180000,
            discountMinor: 0,
            storageSubtotalMinor: 180000,
            commissionRateBps: 1500,
            platformCommissionMinor: 27000,
            hostPayableMinor: 153000,
            taxRateBps: 0,
            taxAmountMinor: 0,
            totalAmountMinor: 180000,
            available: true,
            unavailabilityReason: null,
            itemsBreakdown: [],
            cancellationPolicySummary: ">=24h 100% refund; <24h 50% refund"
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            id: bookingId,
            referenceCode: "LS-2026-9101",
            status: "PENDING_PAYMENT",
            totalBags: 2,
            totalAmountMinor: 180000
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            id: intentId,
            bookingId,
            status: "PENDING",
            amountMinor: 180000
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            duplicate: false,
            outcome: "BOOKING_CONFIRMED",
            bookingId,
            bookingStatus: "CONFIRMED"
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            bookingId,
            referenceCode: "LS-2026-9101",
            operation: "CHECK_IN",
            qrToken,
            verificationPin: "604921",
            expiresAt: "2026-12-05T00:00:00.000Z"
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const quote = await marketplaceApi.quoteBooking({
      locationId: locId,
      dropOffAt: "2026-12-04T09:00:00.000Z",
      collectionAt: "2026-12-04T18:00:00.000Z",
      items: [{ bagCategory: "BAG_MEDIUM", quantity: 2 }]
    });
    expect(quote.available).toBe(true);
    expect(quote.totalAmountMinor).toBe(180000);

    const booking = await marketplaceApi.createBooking({
      locationId: locId,
      dropOffAt: "2026-12-04T09:00:00.000Z",
      collectionAt: "2026-12-04T18:00:00.000Z",
      items: [{ bagCategory: "BAG_MEDIUM", quantity: 2 }]
    });
    expect(booking.referenceCode).toBe("LS-2026-9101");

    const intent = await marketplaceApi.createPaymentIntent({ bookingId });
    const sim = await marketplaceApi.simulateSandboxPayment(intent.id, { outcome: "SUCCEEDED" });
    expect(sim.outcome).toBe("BOOKING_CONFIRMED");

    const pass = await marketplaceApi.issueCustodyPass(bookingId, { operation: "CHECK_IN" });
    expect(pass.verificationPin).toBe("604921");
    expect(pass.qrToken).toBe(qrToken);
  });

  it("executes host mobile booking acceptance, pass verification, check-in, collection release, and finance summary", async () => {
    setAccessToken("mobile-host-jwt");
    const bookingId = "44444444-5555-4666-8777-888888888888";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { id: bookingId, referenceCode: "LS-2026-9102", status: "PENDING_PAYMENT" }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            verified: true,
            bookingId,
            referenceCode: "LS-2026-9102",
            operation: "CHECK_IN",
            expectedBagCount: 2,
            checkedInBagCount: null,
            custodyStatus: "EXPECTED"
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            id: "55555555-6666-4777-8888-999999999999",
            bookingId,
            status: "IN_STORAGE",
            expectedBagCount: 2,
            checkedInBagCount: 2,
            releasedBagCount: null,
            overdueMinutes: 0,
            overdueFeeMinor: 0,
            bags: [],
            events: []
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            id: "55555555-6666-4777-8888-999999999999",
            bookingId,
            status: "RELEASED_TO_TRAVELLER",
            expectedBagCount: 2,
            checkedInBagCount: 2,
            releasedBagCount: 2,
            overdueMinutes: 45,
            overdueFeeMinor: 50000,
            bags: [],
            events: []
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            currency: "LKR",
            totalAccruedMinor: 0,
            totalEligibleMinor: 153000,
            totalOnHoldMinor: 0,
            totalPaidMinor: 0,
            payables: []
          }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const accepted = await marketplaceApi.acceptHostBooking(bookingId, {
      reason: "Accepted at mobile desk"
    });
    expect(accepted.status).toBe("PENDING_PAYMENT");

    const verified = await marketplaceApi.verifyCustodyPass({
      bookingId,
      operation: "CHECK_IN",
      verificationPin: "604921"
    });
    expect(verified.verified).toBe(true);

    const checkedIn = await marketplaceApi.completeCheckIn(bookingId, {
      verificationPin: "604921",
      bags: [
        { bagTagCode: "TAG-1", bagCategory: "BAG_MEDIUM", securitySealNumber: "SEAL-LK-10001" },
        { bagTagCode: "TAG-2", bagCategory: "BAG_MEDIUM", securitySealNumber: "SEAL-LK-10002" }
      ]
    });
    expect(checkedIn.status).toBe("IN_STORAGE");

    const released = await marketplaceApi.completeCollection(bookingId, {
      verificationPin: "992014",
      releasedBagCount: 2
    });
    expect(released.status).toBe("RELEASED_TO_TRAVELLER");
    expect(released.overdueMinutes).toBe(45);

    const finance = await marketplaceApi.getHostFinanceSummary();
    expect(finance.totalEligibleMinor).toBe(153000);
  });

  it("wires live marketplaceApi calls across Traveller and Host Phase B mobile screens", () => {
    const checkoutSrc = fs.readFileSync(
      path.resolve(__dirname, "../app/(traveller)/checkout.tsx"),
      "utf-8"
    );
    expect(checkoutSrc).toContain(".quoteBooking(");
    expect(checkoutSrc).toContain(".createBooking(");
    expect(checkoutSrc).toContain(".createPaymentIntent(");

    const passSrc = fs.readFileSync(
      path.resolve(__dirname, "../app/(traveller)/pass.tsx"),
      "utf-8"
    );
    expect(passSrc).toContain(".issueCustodyPass(");

    const bookingsSrc = fs.readFileSync(
      path.resolve(__dirname, "../app/(traveller)/bookings.tsx"),
      "utf-8"
    );
    expect(bookingsSrc).toContain(".getMyBookings(");
    expect(bookingsSrc).toContain(".cancelBooking(");

    const requestsSrc = fs.readFileSync(
      path.resolve(__dirname, "../app/(host)/requests.tsx"),
      "utf-8"
    );
    expect(requestsSrc).toContain(".getHostBookings(");
    expect(requestsSrc).toContain(".acceptHostBooking(");

    const intakeSrc = fs.readFileSync(
      path.resolve(__dirname, "../app/(host)/intake.tsx"),
      "utf-8"
    );
    expect(intakeSrc).toContain(".completeCheckIn(");

    const vaultSrc = fs.readFileSync(
      path.resolve(__dirname, "../app/(host)/vault.tsx"),
      "utf-8"
    );
    expect(vaultSrc).toContain(".completeCollection(");

    const earningsSrc = fs.readFileSync(
      path.resolve(__dirname, "../app/(host)/earnings.tsx"),
      "utf-8"
    );
    expect(earningsSrc).toContain(".getHostFinanceSummary(");
  });
});
