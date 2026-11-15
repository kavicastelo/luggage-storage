import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AuthenticatedUser, BookingDetail } from "@luggage-storage/contracts";
import { CustodyQrPassCard, buildQrMatrixPath } from "../src/components/custody/CustodyQrPassCard";
import {
  classifyTravellerPortalTab,
  clearCheckoutDraft,
  evaluateTravellerCancellationPreview,
  hasBookingRefundRecord,
  loadCheckoutDraft,
  parseTravellerScheduleParams,
  buildTravellerScheduleQuery,
  saveCheckoutDraft,
  EMPTY_BILLING_STATE
} from "../src/features/traveller/traveller-utils";
import {
  ContactUsPage,
  LocationProfileDetailPage,
  TravellerWebPortalPage,
  WebPaymentConfirmationPage,
  WebSearchDiscoveryPage
} from "../src/pages/PublicMarketplacePages";
import { useAuthStore } from "@/store/useAuthStore";

const ORIGINAL_INITIAL_AUTH_STATE = { ...useAuthStore.getInitialState() };

function setSsrAuthState(partial: Partial<ReturnType<typeof useAuthStore.getState>>) {
  useAuthStore.setState(partial);
  Object.assign(useAuthStore.getInitialState(), useAuthStore.getState());
}

const TRAVELLER_USER: AuthenticatedUser = {
  id: "a1111111-1111-4111-8111-111111111111",
  email: "traveller@luggage.lk",
  displayName: "Saman Perera",
  status: "ACTIVE",
  isEmailVerified: true,
  isPhoneVerified: false,
  roles: ["TRAVELLER"],
  lastLoginAt: "2026-11-15T10:00:00.000Z"
};

const FORBIDDEN_DEVELOPER_PATTERN = /\b(PW|HD|AD|TM|HM)-\d{3}\b|\bWF-\d{3}\b|\bOQ-\d{3}\b/;
const DEMO_FORBIDDEN_MARKERS = [
  "Colombo Fort Counter #4",
  "LS-2026-8841",
  "LKR 250,000",
  "Ceylon Transit Hospitality",
  "Commercial Bank of Ceylon",
  "Roshan Fernando"
];

function makeMinimalBookingDetail(overrides: Partial<BookingDetail>): BookingDetail {
  return {
    id: "22222222-3333-4444-8555-666666666666",
    referenceCode: "LSB-20261115-ABC123",
    travellerUserId: TRAVELLER_USER.id,
    businessId: "33333333-4444-4555-8666-777777777777",
    locationId: "44444444-5555-4666-8777-888888888888",
    bookingMode: "INSTANT",
    status: "CONFIRMED",
    dropOffAt: "2026-11-20T09:00:00.000Z",
    collectionAt: "2026-11-20T17:00:00.000Z",
    totalBags: 1,
    totalCapacityUnits: 1,
    currency: "LKR",
    totalAmountMinor: 120000,
    holdExpiresAt: null,
    confirmedAt: "2026-11-15T10:00:00.000Z",
    checkedInAt: null,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    hostRejectionReason: null,
    exceptionReason: null,
    travellerNotes: null,
    createdAt: "2026-11-15T10:00:00.000Z",
    updatedAt: "2026-11-15T10:00:00.000Z",
    location: {
      id: "44444444-5555-4666-8777-888888888888",
      name: "Kandy Hub",
      city: "Kandy",
      countryCode: "LK",
      timezone: "Asia/Colombo",
      approximateArea: "Kandy Station Precinct",
      approximateLatitude: 7.2906,
      approximateLongitude: 80.6337,
      addressDisclosed: true,
      addressLine1: "42 Dalada Veediya",
      addressLine2: null,
      postalCode: "20000",
      directionsNotes: "Counter inside arcade",
      exactLatitude: 7.2906,
      exactLongitude: 80.6337
    },
    items: [],
    pricingSnapshot: null,
    paymentSummary: null,
    refundSummary: null,
    custodySummary: null,
    statusHistory: [],
    ...overrides
  };
}

describe("Initiative 2 — Traveller Discovery, Scannable QR Pass & Portal Regression Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.assign(useAuthStore.getInitialState(), ORIGINAL_INITIAL_AUTH_STATE);
    useAuthStore.getState().clearAuth();
    setSsrAuthState({ isInitializing: false });
  });

  afterEach(() => {
    Object.assign(useAuthStore.getInitialState(), ORIGINAL_INITIAL_AUTH_STATE);
    useAuthStore.getState().clearAuth();
  });

  describe("1. Scannable CustodyQrPassCard & Raw Token Integrity", () => {
    it("encodes raw 64-char qrToken directly into SVG QR matrix without mutating payload format", () => {
      const rawToken = "a1b2c3d4".repeat(8);
      expect(rawToken).toHaveLength(64);

      const matrix = buildQrMatrixPath(rawToken);
      expect(matrix).not.toBeNull();
      expect(matrix!.size).toBeGreaterThanOrEqual(29);
      expect(matrix!.path).toContain("M0,0h1v1h-1z");

      const html = renderToString(
        <CustodyQrPassCard
          referenceCode="LSB-20261115-XYZ999"
          operation="CHECK_IN"
          qrPayload={rawToken}
          verificationPin="839201"
          expiresAt={new Date(Date.now() + 10 * 60_000).toISOString()}
          locationName="Kandy Station Counter"
          onRegenerate={() => {}}
        />
      );

      expect(html).toContain("<svg");
      expect(html).toContain(`data-qr-payload="${rawToken}"`);
      expect(html).toContain("839 201");
      expect(html).toContain("#LSB-20261115-XYZ999");
      expect(html).toContain("Regenerate Pass");
      expect(html).toContain("Print / Save Pass");
      expect(html).not.toContain(`LS-CUSTODY://${rawToken}`);
    });

    it("renders expiration alert banner when single-use custody pass TTL has elapsed", () => {
      const expiredHtml = renderToString(
        <CustodyQrPassCard
          referenceCode="LSB-20261115-EXP001"
          operation="COLLECTION"
          qrPayload={"f".repeat(64)}
          verificationPin="412908"
          expiresAt="2020-01-01T00:00:00.000Z"
          onRegenerate={() => {}}
        />
      );

      expect(expiredHtml).toContain("Custody Pass Expired");
      expect(expiredHtml).toContain("Collection Release");
      expect(expiredHtml).toContain("412 908");
    });
  });

  describe("2. Traveller Utils: Schedule Query Sync, Checkout Drafts, Refund Tiers & Portal Classification", () => {
    it("round-trips schedule dates, bag counts, acceptsOversized, and sortBy query parameters", () => {
      const qs = buildTravellerScheduleQuery({
        city: "Galle",
        searchTerm: "Fort",
        dropOffAt: "2026-12-05T09:00:00+05:30",
        collectionAt: "2026-12-05T17:00:00+05:30",
        bags: { BAG_SMALL: 1, BAG_MEDIUM: 2, BAG_LARGE: 0, BAG_OVERSIZED: 1 },
        acceptsOversized: true,
        sortBy: "price_asc",
        latitude: 6.0329,
        longitude: 80.2168
      });

      const parsed = parseTravellerScheduleParams(`?${qs}`);
      expect(parsed.city).toBe("Galle");
      expect(parsed.searchTerm).toBe("Fort");
      expect(parsed.bags).toEqual({
        BAG_SMALL: 1,
        BAG_MEDIUM: 2,
        BAG_LARGE: 0,
        BAG_OVERSIZED: 1
      });
      expect(parsed.acceptsOversized).toBe(true);
      expect(parsed.sortBy).toBe("price_asc");
      expect(parsed.latitude).toBeCloseTo(6.0329, 3);
      expect(parsed.longitude).toBeCloseTo(80.2168, 3);
    });

    it("persists, restores, and clears checkout draft safely around login round-trips", () => {
      const store = new Map<string, string>();
      const mockStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        }
      };

      const locId = "11111111-2222-4333-8444-555555555555";
      saveCheckoutDraft(
        {
          locId,
          dropOffLocal: "2026-12-10T09:00",
          collectionLocal: "2026-12-10T18:00",
          bags: { BAG_SMALL: 1, BAG_MEDIUM: 1, BAG_LARGE: 0, BAG_OVERSIZED: 0 },
          travellerNotes: "Arriving on Kandy intercity express",
          billing: { ...EMPTY_BILLING_STATE, firstName: "Saman", city: "Colombo" },
          savedAt: "2026-11-15T12:00:00.000Z"
        },
        mockStorage
      );

      const loaded = loadCheckoutDraft(locId, mockStorage);
      expect(loaded).not.toBeNull();
      expect(loaded!.travellerNotes).toBe("Arriving on Kandy intercity express");
      expect(loaded!.bags.BAG_SMALL).toBe(1);
      expect(loaded!.billing.firstName).toBe("Saman");

      clearCheckoutDraft(locId, mockStorage);
      expect(loadCheckoutDraft(locId, mockStorage)).toBeNull();
    });

    it("mirrors OQ-009 cancellation tiers (unpaid, 100%, 50%, 0%) and preserves EXPIRED/DISPUTED statuses across portal tabs", () => {
      const nowMs = Date.parse("2026-11-20T10:00:00.000Z");

      expect(
        evaluateTravellerCancellationPreview({
          status: "PENDING_PAYMENT",
          dropOffAt: "2026-11-20T15:00:00.000Z",
          totalAmountMinor: 100000,
          paymentSucceeded: false,
          nowMs
        })
      ).toMatchObject({ cancellable: true, requiresRefund: false, refundPercentage: 0 });

      expect(
        evaluateTravellerCancellationPreview({
          status: "CONFIRMED",
          dropOffAt: "2026-11-20T13:00:00.000Z",
          totalAmountMinor: 100000,
          paymentSucceeded: true,
          nowMs
        })
      ).toMatchObject({ refundPercentage: 100, estimatedRefundMinor: 100000 });

      expect(
        evaluateTravellerCancellationPreview({
          status: "CONFIRMED",
          dropOffAt: "2026-11-20T11:30:00.000Z",
          totalAmountMinor: 100000,
          paymentSucceeded: true,
          nowMs
        })
      ).toMatchObject({ refundPercentage: 50, estimatedRefundMinor: 50000 });

      expect(
        evaluateTravellerCancellationPreview({
          status: "CONFIRMED",
          dropOffAt: "2026-11-20T09:30:00.000Z",
          totalAmountMinor: 100000,
          paymentSucceeded: true,
          nowMs
        })
      ).toMatchObject({ refundPercentage: 0, estimatedRefundMinor: 0 });

      expect(classifyTravellerPortalTab(makeMinimalBookingDetail({ status: "PENDING_PAYMENT" }))).toBe("active");
      expect(classifyTravellerPortalTab(makeMinimalBookingDetail({ status: "DISPUTED" }))).toBe("active");
      expect(classifyTravellerPortalTab(makeMinimalBookingDetail({ status: "EXPIRED" }))).toBe("past");
      expect(classifyTravellerPortalTab(makeMinimalBookingDetail({ status: "REJECTED" }))).toBe("past");
      expect(
        classifyTravellerPortalTab(
          makeMinimalBookingDetail({ status: "CANCELLED_BY_TRAVELLER", refundSummary: null })
        )
      ).toBe("past");
      expect(
        hasBookingRefundRecord(
          makeMinimalBookingDetail({
            refundSummary: {
              refundId: "55555555-6666-4777-8888-999999999999",
              amountMinor: 50000,
              refundPercentage: 50,
              status: "AUTHORIZED",
              reasonCategory: "TRAVELLER_CANCELLATION"
            }
          })
        )
      ).toBe(true);
    });
  });

  describe("3. Live Surface Honesty, Routes, Non-Tax Receipt & Contact Cleanup", () => {
    it("renders live search filters, PayHere return/cancel routes, and portal without fabricated tickets, VAT invoices, or demo leaks", () => {
      const searchHtml = renderToString(
        <MemoryRouter initialEntries={["/search?city=Kandy"]}>
          <Routes>
            <Route path="/search" element={<WebSearchDiscoveryPage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(searchHtml).toContain("Near Me");
      expect(searchHtml).toContain("Reset Filters");
      expect(searchHtml).toContain("Accepts Oversized Gear");
      expect(searchHtml).toContain("Sri Lanka Transit Corridor Map");

      const returnHtml = renderToString(
        <MemoryRouter
          initialEntries={["/checkout/payhere/return?order_id=ORD-123&status_code=2"]}
        >
          <Routes>
            <Route path="/checkout/payhere/return" element={<WebPaymentConfirmationPage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(returnHtml).toContain("Verifying Authoritative Payment Record");
      expect(returnHtml).not.toContain("#LS-2026-8841");

      const cancelHtml = renderToString(
        <MemoryRouter initialEntries={["/checkout/payhere/cancel?bookingId=22222222-3333-4444-8555-666666666666"]}>
          <Routes>
            <Route path="/checkout/payhere/cancel" element={<WebPaymentConfirmationPage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(cancelHtml).toContain("Checkout Session Returned Without Completion");

      const contactHtml = renderToString(
        <MemoryRouter initialEntries={["/contact"]}>
          <Routes>
            <Route path="/contact" element={<ContactUsPage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(contactHtml).toContain("support@luggagestorage.lk");
      expect(contactHtml).not.toContain("#TKT-COL-2026-441");

      setSsrAuthState({ user: TRAVELLER_USER, isAuthenticated: true, isInitializing: false });
      const portalHtml = renderToString(
        <MemoryRouter initialEntries={["/portal/bookings"]}>
          <Routes>
            <Route path="/portal/bookings" element={<TravellerWebPortalPage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(portalHtml).toContain("Traveller Account Portal");
      expect(portalHtml).toContain("Saman Perera");
      expect(portalHtml).not.toContain("VAT Invoice");

      const staticInfoSrc = fs.readFileSync(
        path.resolve(__dirname, "../src/features/traveller/StaticInfoPages.tsx"),
        "utf-8"
      );
      const portalSrc = fs.readFileSync(
        path.resolve(__dirname, "../src/features/traveller/BookingsPortalPage.tsx"),
        "utf-8"
      );
      expect(staticInfoSrc).not.toContain("#TKT-COL-2026-441");
      expect(portalSrc).toContain("Booking Summary Receipt");
      expect(portalSrc).not.toContain("Download VAT Invoice");

      const detailHtml = renderToString(
        <MemoryRouter initialEntries={["/locations/11111111-2222-4333-8444-555555555555"]}>
          <Routes>
            <Route path="/locations/:slug" element={<LocationProfileDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      for (const html of [searchHtml, returnHtml, cancelHtml, contactHtml, portalHtml, detailHtml]) {
        expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
        for (const marker of DEMO_FORBIDDEN_MARKERS) {
          expect(html).not.toContain(marker);
        }
      }
    });
  });
});
