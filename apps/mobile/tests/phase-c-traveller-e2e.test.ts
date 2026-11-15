import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildQrMatrixPath } from "../src/components/ui/QrCodeMatrix";
import { launchPayHereNativeCheckout } from "../src/lib/payhere-native";
import { isPayHereNativeSdkHandoff } from "../src/lib/payment-handoff";
import { mobileQueryClient } from "../src/lib/query-client";
import { clearAccessToken } from "../src/services/api-client";
import { marketplaceApi } from "../src/services/marketplace-api";
import { secureStorage } from "../src/services/secure-storage.service";
import { useAuthStore } from "../src/store/useAuthStore";
import { useMobileStore } from "../src/store/useMobileStore";
import { useSavedLocationsStore } from "../src/store/useSavedLocationsStore";

describe("Phase C — Traveller End-to-End Integration Journey (Mocked API Boundary)", () => {
  const userId = "t0000001-0000-4000-8000-000000000001";
  const locId = "loc00001-0000-4000-8000-000000000001";
  const bookingId = "b0000001-0000-4000-8000-000000000001";
  const secondBookingId = "b0000002-0000-4000-8000-000000000002";
  const intentId = "p0000001-0000-4000-8000-000000000001";
  const qrToken = "LGS-QR-COLOMBO-" + "A".repeat(49);

  beforeEach(async () => {
    vi.restoreAllMocks();
    clearAccessToken();
    mobileQueryClient.clear();
    useMobileStore.getState().resetTransientState();
    await useSavedLocationsStore.getState().clearSaved();
    await secureStorage.deleteRefreshToken();
    await useAuthStore.getState().clearAuth();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("executes full Colombo LKR traveller flow from login -> search -> save -> quote -> PayHere -> custody pass -> completion -> cancel", async () => {
    let checkoutPollCount = 0;
    let bookingPollCount = 0;
    const seenRequests: Array<{ url: string; method: string; body: string | null }> = [];

    const mockCheckoutHandoff = {
      mode: "PAYHERE_NATIVE_SANDBOX",
      provider: "PAYHERE",
      method: "NATIVE_SDK",
      sdkPayload: {
        sandbox: true,
        merchant_id: "1220001",
        notify_url: "https://api.example.com/api/v1/payments/webhooks/payhere",
        order_id: "BGBX-PAY-1001",
        items: "Fort Station Express Vault Storage",
        currency: "LKR",
        amount: "2640.00",
        first_name: "Dilshan",
        last_name: "Fernando",
        email: "dilshan@example.lk",
        phone: "+94771234567",
        address: "Colombo Fort",
        city: "Colombo",
        country: "Sri Lanka",
        custom_1: intentId,
        custom_2: "BGBX-LK-1001"
      }
    };

    const mockPaymentIntent = {
      id: intentId,
      bookingId,
      travellerUserId: userId,
      provider: "PAYHERE",
      checkoutChannel: "MOBILE_APP",
      providerOrderId: "BGBX-PAY-1001",
      amountMinor: 264000,
      currency: "LKR",
      status: "PENDING_GATEWAY",
      nextAction: "LAUNCH_NATIVE_SDK",
      checkoutHandoff: mockCheckoutHandoff,
      checkoutPayload: {},
      expiresAt: "2026-11-15T01:30:00.000Z",
      verifiedAt: null,
      failureReason: null,
      createdAt: "2026-11-15T01:00:00.000Z",
      updatedAt: "2026-11-15T01:00:00.000Z"
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        const body = typeof init?.body === "string" ? init.body : null;
        seenRequests.push({ url, method, body });

        const json = (data: unknown, status = 200) =>
          new Response(JSON.stringify({ success: true, data }), {
            status,
            headers: { "Content-Type": "application/json" }
          });

        if (url.endsWith("/auth/login")) {
          return json({
            accessToken: "traveller-jwt-1",
            refreshToken: "traveller-refresh-1",
            expiresIn: 900,
            tokenType: "Bearer"
          });
        }
        if (url.endsWith("/auth/me")) {
          return json({
            user: {
              id: userId,
              email: "dilshan@example.lk",
              displayName: "Dilshan Fernando",
              status: "ACTIVE",
              isEmailVerified: true,
              isPhoneVerified: true,
              roles: ["TRAVELLER"],
              lastLoginAt: "2026-11-15T01:00:00.000Z"
            },
            sessionId: "sess-1",
            permissions: ["discovery.read", "booking.create", "booking.read_own"]
          });
        }
        if (url.includes("/discovery/locations?")) {
          return json({
            locations: [
              {
                id: locId,
                name: "Fort Station Express Vault",
                city: "Colombo",
                countryCode: "LK",
                approximateArea: "Fort Station Precinct",
                approximateLatitude: 6.934,
                approximateLongitude: 79.85,
                timezone: "Asia/Colombo",
                bookingMode: "INSTANT",
                acceptsOversized: true,
                amenities: ["CCTV", "LOCKERS"],
                approximateDistanceMeters: 350,
                distanceLabel: "~350 m away",
                currency: "LKR",
                baseRateMinor: 120000
              }
            ],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
          });
        }
        if (url.endsWith(`/discovery/locations/${locId}`)) {
          return json({
            id: locId,
            name: "Fort Station Express Vault",
            city: "Colombo",
            countryCode: "LK",
            approximateArea: "Fort Station Precinct",
            approximateLatitude: 6.934,
            approximateLongitude: 79.85,
            timezone: "Asia/Colombo",
            bookingMode: "INSTANT",
            acceptsOversized: true,
            amenities: ["CCTV", "LOCKERS"],
            images: [],
            openingHours: [],
            exceptions: []
          });
        }
        if (url.endsWith("/bookings/quote")) {
          return json({
            locationId: locId,
            locationName: "Fort Station Express Vault",
            bookingMode: "INSTANT",
            timezone: "Asia/Colombo",
            available: true,
            unavailabilityReason: null,
            remainingCapacityUnits: 12,
            requestedCapacityUnits: 2,
            totalBags: 2,
            currency: "LKR",
            currencyExponent: 2,
            pricingUnit: "CALENDAR_DAY",
            durationUnits: 1,
            baseRateMinor: 120000,
            items: [],
            grossStorageMinor: 240000,
            discountMinor: 0,
            storageSubtotalMinor: 240000,
            commissionRateBps: 1500,
            platformCommissionMinor: 36000,
            hostPayableMinor: 204000,
            taxRateBps: 0,
            taxAmountMinor: 0,
            totalAmountMinor: 264000,
            cancellationPolicyCode: "FLEXIBLE_24H",
            cancellationPolicySummary: "Free cancellation up to 24 hours before drop-off."
          });
        }
        if (url.endsWith("/bookings") && method === "POST") {
          return json({
            id: bookingId,
            referenceCode: "BGBX-LK-1001",
            locationId: locId,
            locationName: "Fort Station Express Vault",
            travellerUserId: userId,
            status: "PENDING_PAYMENT",
            bookingMode: "INSTANT",
            dropOffAt: "2026-11-16T04:00:00.000Z",
            collectionAt: "2026-11-16T12:00:00.000Z",
            totalBags: 2,
            currency: "LKR",
            totalAmountMinor: 264000,
            items: [],
            custodySummary: null
          });
        }
        if (url.endsWith("/payments/intents") && method === "POST") {
          return json(mockPaymentIntent);
        }
        if (url.includes("/payments/checkout-status")) {
          checkoutPollCount += 1;
          if (checkoutPollCount === 1) {
            return json({
              bookingId,
              referenceCode: "BGBX-LK-1001",
              bookingStatus: "PENDING_PAYMENT",
              holdExpiresAt: "2026-11-15T01:30:00.000Z",
              confirmedAt: null,
              canRetryPayment: true,
              custodyReady: false,
              pollRecommended: true,
              paymentIntent: mockPaymentIntent
            });
          }
          return json({
            bookingId,
            referenceCode: "BGBX-LK-1001",
            bookingStatus: "CONFIRMED",
            holdExpiresAt: null,
            confirmedAt: "2026-11-15T01:02:30.000Z",
            canRetryPayment: false,
            custodyReady: true,
            pollRecommended: false,
            paymentIntent: {
              ...mockPaymentIntent,
              status: "SUCCEEDED",
              verifiedAt: "2026-11-15T01:02:30.000Z"
            }
          });
        }
        if (url.endsWith(`/bookings/${bookingId}/custody-pass`)) {
          return json({
            bookingId,
            referenceCode: "BGBX-LK-1001",
            operation: "CHECK_IN",
            qrToken,
            verificationPin: "482910",
            expiresAt: "2026-11-16T05:00:00.000Z"
          });
        }
        if (url.endsWith(`/bookings/${bookingId}`)) {
          bookingPollCount += 1;
          return json({
            id: bookingId,
            referenceCode: "BGBX-LK-1001",
            locationId: locId,
            locationName: "Fort Station Express Vault",
            travellerUserId: userId,
            status: bookingPollCount === 1 ? "IN_STORAGE" : "COMPLETED",
            bookingMode: "INSTANT",
            dropOffAt: "2026-11-16T04:00:00.000Z",
            collectionAt: "2026-11-16T12:00:00.000Z",
            totalBags: 2,
            currency: "LKR",
            totalAmountMinor: 264000,
            items: [],
            custodySummary: {
              custodyRecordId: "c0000001-0000-4000-8000-000000000001",
              status: bookingPollCount === 1 ? "IN_STORAGE" : "RELEASED_TO_TRAVELLER",
              expectedBagCount: 2,
              checkedInBagCount: 2,
              releasedBagCount: bookingPollCount === 1 ? null : 2,
              checkInAt: "2026-11-16T04:10:00.000Z",
              checkOutAt: bookingPollCount === 1 ? null : "2026-11-16T11:45:00.000Z"
            }
          });
        }
        if (url.endsWith(`/bookings/${secondBookingId}/cancel`) && method === "POST") {
          return json({
            id: secondBookingId,
            referenceCode: "BGBX-LK-1002",
            locationId: locId,
            locationName: "Fort Station Express Vault",
            travellerUserId: userId,
            status: "CANCELLED_BY_TRAVELLER",
            bookingMode: "INSTANT",
            dropOffAt: "2026-11-18T04:00:00.000Z",
            collectionAt: "2026-11-18T12:00:00.000Z",
            totalBags: 1,
            currency: "LKR",
            totalAmountMinor: 132000,
            items: [],
            custodySummary: null
          });
        }

        throw new Error(`Unhandled fetch request in E2E mock: ${method} ${url}`);
      })
    );

    // 1. Traveller Login
    await useAuthStore.getState().login({
      email: "dilshan@example.lk",
      password: "StrongPassword123!"
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.roles).toContain("TRAVELLER");

    // 2. Discovery Search & Public Detail (privacy-masked coordinates)
    const searchRes = await marketplaceApi.searchLocations({
      searchTerm: "Colombo",
      city: "Colombo"
    });
    expect(searchRes.locations).toHaveLength(1);
    expect(searchRes.locations[0].currency).toBe("LKR");

    const publicLoc = await marketplaceApi.getPublicLocationDetails(locId);
    expect(publicLoc.name).toBe("Fort Station Express Vault");

    // 3. Device Saved Toggle
    const nowSaved = await useSavedLocationsStore.getState().toggleSaved(locId);
    expect(nowSaved).toBe(true);
    expect(useSavedLocationsStore.getState().isSaved(locId)).toBe(true);

    // 4. Quote Calculation (LKR minor units)
    const quote = await marketplaceApi.quoteBooking({
      locationId: locId,
      dropOffAt: "2026-11-16T04:00:00.000Z",
      collectionAt: "2026-11-16T12:00:00.000Z",
      items: [{ bagCategory: "BAG_MEDIUM", quantity: 2 }]
    });
    expect(quote.totalAmountMinor).toBe(264000);

    // 5. Booking Creation with Idempotency Key
    const idempotencyKey = "traveller-e2e-booking-key-001";
    const booking = await marketplaceApi.createBooking({
      locationId: locId,
      dropOffAt: "2026-11-16T04:00:00.000Z",
      collectionAt: "2026-11-16T12:00:00.000Z",
      items: [{ bagCategory: "BAG_MEDIUM", quantity: 2 }],
      idempotencyKey
    });
    expect(booking.status).toBe("PENDING_PAYMENT");
    const createCall = seenRequests.find((r) => r.url.endsWith("/bookings") && r.method === "POST");
    expect(JSON.parse(createCall?.body ?? "{}")).toMatchObject({ idempotencyKey });

    // 6. Initiate Payment Intent -> Launch PayHere Native SDK (untrusted callback triggers poll)
    const intent = await marketplaceApi.createPaymentIntent({
      bookingId: booking.id,
      channel: "MOBILE_APP",
      idempotencyKey: "pay-intent-key-001"
    });
    expect(intent.checkoutChannel).toBe("MOBILE_APP");
    expect(isPayHereNativeSdkHandoff(intent.checkoutHandoff)).toBe(true);
    if (isPayHereNativeSdkHandoff(intent.checkoutHandoff)) {
      const outcome = await launchPayHereNativeCheckout(intent.checkoutHandoff.sdkPayload, {
        platformOs: "android",
        hasNativeBridge: true,
        sdkModule: {
          startPayment: (_payload, onCompleted) => onCompleted("PH-ANDROID-9001")
        }
      });
      expect(outcome).toEqual({ status: "COMPLETED", paymentId: "PH-ANDROID-9001" });
    }

    // 7. Checkout Status Poll: PENDING -> PAID/CONFIRMED
    const pendingStatus = await marketplaceApi.getCheckoutStatus({ bookingId: booking.id });
    expect(pendingStatus.custodyReady).toBe(false);
    expect(pendingStatus.bookingStatus).toBe("PENDING_PAYMENT");

    const paidStatus = await marketplaceApi.getCheckoutStatus({ bookingId: booking.id });
    expect(paidStatus.custodyReady).toBe(true);
    expect(paidStatus.bookingStatus).toBe("CONFIRMED");

    // 8. Custody Pass Issuance + Real QR Matrix Construction
    const pass = await marketplaceApi.issueCustodyPass(booking.id, { operation: "CHECK_IN" });
    expect(pass.verificationPin).toBe("482910");
    const matrix = buildQrMatrixPath(pass.qrToken, 2);
    expect(matrix.moduleCount).toBeGreaterThanOrEqual(21);

    // 9. Lifecycle Transitions: IN_STORAGE -> COMPLETED
    const inStorage = await marketplaceApi.getBookingDetail(booking.id);
    expect(inStorage.status).toBe("IN_STORAGE");
    const completed = await marketplaceApi.getBookingDetail(booking.id);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.custodySummary?.releasedBagCount).toBe(2);

    // 10. Cancel Second Booking
    const cancelled = await marketplaceApi.cancelBooking(secondBookingId, {
      reason: "Flight rescheduled from CMB to Mattala"
    });
    expect(cancelled.status).toBe("CANCELLED_BY_TRAVELLER");
  });
});
