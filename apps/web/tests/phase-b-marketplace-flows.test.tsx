import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { marketplaceApi } from "../src/services/marketplace-api";
import { setAccessToken, clearAccessToken } from "../src/lib/api-client";
import {
  LocationProfileDetailPage,
  WebCheckoutSchedulePage,
  WebPaymentConfirmationPage,
  TravellerWebPortalPage
} from "../src/pages/PublicMarketplacePages";
import {
  HostBookingManagementHubPage,
  HostWebCheckInOutOperationsPage,
  HostFinancialRevenueLedgerPage
} from "../src/pages/HostDashboardPages";
import {
  AdminGlobalBookingsLedgerPage,
  AdminPaymentTransactionsLogPage,
  AdminRefundManagementQueuePage,
  AdminDoubleEntryFinancialLedgerPage
} from "../src/pages/AdminDashboardPages";

const FORBIDDEN_DEVELOPER_PATTERN = /\b(PW|HD|AD|TM|HM)-\d{3}\b|\bWF-\d{3}\b|\bOQ-\d{3}\b/;

describe("Phase B — Web Booking, Non-Escrow Settlement Ledger & Custody Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearAccessToken();
  });

  describe("1. Traveller Booking, Payment Intent & Custody Pass API Client Wiring", () => {
    it("quotes LKR minor-unit storage pricing and checks capacity availability", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            locationId: "11111111-2222-4333-8444-555555555555",
            bookingMode: "INSTANT",
            currency: "LKR",
            currencyExponent: 2,
            pricingUnit: "CALENDAR_DAY",
            durationHours: 8,
            durationUnits: 1,
            totalBags: 2,
            totalCapacityUnits: 2,
            grossStorageMinor: 240000,
            discountMinor: 0,
            storageSubtotalMinor: 240000,
            commissionRateBps: 1500,
            platformCommissionMinor: 36000,
            hostPayableMinor: 204000,
            taxRateBps: 0,
            taxAmountMinor: 0,
            totalAmountMinor: 240000,
            available: true,
            unavailabilityReason: null,
            itemsBreakdown: [],
            cancellationPolicySummary: ">=24h 100% refund; <24h 50% refund"
          }
        })
      });
      vi.stubGlobal("fetch", fetchMock);

      const quote = await marketplaceApi.quoteBooking({
        locationId: "11111111-2222-4333-8444-555555555555",
        dropOffAt: "2026-12-01T09:00:00.000Z",
        collectionAt: "2026-12-01T17:00:00.000Z",
        items: [{ bagCategory: "BAG_MEDIUM", quantity: 2 }]
      });

      expect(quote.totalAmountMinor).toBe(240000);
      expect(quote.platformCommissionMinor + quote.hostPayableMinor).toBe(quote.totalAmountMinor);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/bookings/quote"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("creates booking, initializes sandbox payment intent, and issues single-use custody pass", async () => {
      setAccessToken("traveller-jwt");
      const bookingId = "22222222-3333-4444-8555-666666666666";
      const intentId = "33333333-4444-4555-8666-777777777777";
      const sampleQrToken = "a".repeat(64);

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: { id: bookingId, referenceCode: "LS-2026-9001", status: "PENDING_PAYMENT" }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: { id: intentId, bookingId, status: "PENDING", amountMinor: 240000 }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { duplicate: false, outcome: "BOOKING_CONFIRMED", bookingId }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              bookingId,
              referenceCode: "LS-2026-9001",
              operation: "CHECK_IN",
              qrToken: sampleQrToken,
              verificationPin: "839201",
              expiresAt: "2026-12-02T00:00:00.000Z"
            }
          })
        });
      vi.stubGlobal("fetch", fetchMock);

      const created = await marketplaceApi.createBooking({
        locationId: "11111111-2222-4333-8444-555555555555",
        dropOffAt: "2026-12-01T09:00:00.000Z",
        collectionAt: "2026-12-01T17:00:00.000Z",
        items: [{ bagCategory: "BAG_MEDIUM", quantity: 2 }]
      });
      expect(created.status).toBe("PENDING_PAYMENT");

      const intent = await marketplaceApi.createPaymentIntent({ bookingId });
      expect(intent.id).toBe(intentId);

      const simulated = await marketplaceApi.simulateSandboxPayment(intentId, {
        outcome: "SUCCEEDED"
      });
      expect(simulated.outcome).toBe("BOOKING_CONFIRMED");

      const pass = await marketplaceApi.issueCustodyPass(bookingId, { operation: "CHECK_IN" });
      expect(pass.verificationPin).toBe("839201");
      expect(pass.qrToken).toHaveLength(64);
    });
  });

  describe("2. Host Booking Approval, Custody Handover & Finance Payables API Wiring", () => {
    it("executes host booking approval, counter check-in, baggage collection, and finance summary queries", async () => {
      setAccessToken("host-jwt");
      const bookingId = "55555555-6666-4777-8888-999999999999";

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { id: bookingId, referenceCode: "LS-2026-9002", status: "PENDING_PAYMENT" }
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
              referenceCode: "LS-2026-9002",
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
              id: "77777777-8888-4999-8000-111111111111",
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
              currency: "LKR",
              totalAccruedMinor: 0,
              totalEligibleMinor: 204000,
              totalOnHoldMinor: 0,
              totalPaidMinor: 0,
              payables: []
            }
          })
        });
      vi.stubGlobal("fetch", fetchMock);

      const accepted = await marketplaceApi.acceptHostBooking(bookingId, { reason: "Approved" });
      expect(accepted.status).toBe("PENDING_PAYMENT");

      const verified = await marketplaceApi.verifyCustodyPass({
        bookingId,
        operation: "CHECK_IN",
        verificationPin: "839201"
      });
      expect(verified.verified).toBe(true);

      const checkedIn = await marketplaceApi.completeCheckIn(bookingId, {
        verificationPin: "839201",
        bags: [
          { bagCategory: "BAG_MEDIUM", bagTagCode: "TAG-1", securitySealNumber: "SEAL-1" },
          { bagCategory: "BAG_MEDIUM", bagTagCode: "TAG-2", securitySealNumber: "SEAL-2" }
        ]
      });
      expect(checkedIn.status).toBe("IN_STORAGE");

      const finance = await marketplaceApi.getHostFinanceSummary();
      expect(finance.totalEligibleMinor).toBe(204000);
    });
  });

  describe("3. UI Surface Honesty, Non-Escrow Terminology & Developer Code Suppression", () => {
    it("renders live UUID checkout mode with Sandbox Payment Gateway notice and zero developer codes", () => {
      const uuidLocRoute = "/checkout/11111111-2222-4333-8444-555555555555";
      const html = renderToString(
        <MemoryRouter initialEntries={[uuidLocRoute]}>
          <Routes>
            <Route path="/checkout/:locId" element={<WebCheckoutSchedulePage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(html).toContain("Sandbox Payment Gateway Active");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
    });

    it("ensures Location Profile & Admin Double-Entry Ledger use accurate non-escrow terminology", () => {
      const profileHtml = renderToString(
        <MemoryRouter initialEntries={["/locations/colombo-fort-railway-hub"]}>
          <Routes>
            <Route path="/locations/:slug" element={<LocationProfileDetailPage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(profileHtml).toContain("ledger-backed marketplace settlement");
      expect(profileHtml).not.toContain("secure platform escrow");
      expect(profileHtml).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);

      const adminLedgerHtml = renderToString(
        <MemoryRouter initialEntries={["/admin/finance/ledger"]}>
          <Routes>
            <Route path="/admin/finance/ledger" element={<AdminDoubleEntryFinancialLedgerPage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(adminLedgerHtml).toContain("non-escrow marketplace settlement ledger");
      expect(adminLedgerHtml).toContain("PLATFORM_CLEARING_RECEIVABLE");
      expect(adminLedgerHtml).not.toContain("1100_ESCROW_CASH_ASSET");
    });

    it("renders Traveller, Host, and Admin Phase B surfaces cleanly without regressions", () => {
      const confirmHtml = renderToString(
        <MemoryRouter initialEntries={["/booking/confirm"]}>
          <Routes>
            <Route path="/booking/confirm" element={<WebPaymentConfirmationPage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(confirmHtml).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);

      const portalHtml = renderToString(
        <MemoryRouter initialEntries={["/portal/bookings"]}>
          <Routes>
            <Route path="/portal/bookings" element={<TravellerWebPortalPage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(portalHtml).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);

      const hostBookingsHtml = renderToString(
        <MemoryRouter initialEntries={["/host/bookings"]}>
          <Routes>
            <Route path="/host/bookings" element={<HostBookingManagementHubPage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(hostBookingsHtml).toContain("Pending Approval");
      expect(hostBookingsHtml).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);

      const hostOpsHtml = renderToString(
        <MemoryRouter initialEntries={["/host/operations"]}>
          <Routes>
            <Route path="/host/operations" element={<HostWebCheckInOutOperationsPage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(hostOpsHtml).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);

      const hostFinanceHtml = renderToString(
        <MemoryRouter initialEntries={["/host/finance"]}>
          <Routes>
            <Route path="/host/finance" element={<HostFinancialRevenueLedgerPage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(hostFinanceHtml).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);

      const adminBookingsHtml = renderToString(
        <MemoryRouter initialEntries={["/admin/bookings"]}>
          <Routes>
            <Route path="/admin/bookings" element={<AdminGlobalBookingsLedgerPage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(adminBookingsHtml).toContain("Global Platform Bookings");

      const adminPaymentsHtml = renderToString(
        <MemoryRouter initialEntries={["/admin/payments"]}>
          <Routes>
            <Route path="/admin/payments" element={<AdminPaymentTransactionsLogPage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(adminPaymentsHtml).toContain("Payment Gateway Transactions");

      const adminRefundsHtml = renderToString(
        <MemoryRouter initialEntries={["/admin/refunds"]}>
          <Routes>
            <Route path="/admin/refunds" element={<AdminRefundManagementQueuePage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(adminRefundsHtml).toContain("Refund Management");
    });
  });
});
