import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mobileQueryClient } from "../src/lib/query-client";
import { clearAccessToken } from "../src/services/api-client";
import { marketplaceApi } from "../src/services/marketplace-api";
import { secureStorage } from "../src/services/secure-storage.service";
import { useAuthStore } from "../src/store/useAuthStore";
import { useMobileStore } from "../src/store/useMobileStore";

describe("Phase C — Host Partner End-to-End Integration Journey (Mocked API Boundary)", () => {
  const userId = "h0000001-0000-4000-8000-000000000001";
  const businessId = "biz00001-0000-4000-8000-000000000001";
  const locationId = "loc00001-0000-4000-8000-000000000001";
  const zoneId = "zne00001-0000-4000-8000-000000000001";
  const bookingId = "b0000001-0000-4000-8000-000000000001";
  const rejectBookingId = "b0000002-0000-4000-8000-000000000002";
  const checkInQrToken = "LGS-QR-COLOMBO-" + "A".repeat(49);
  const collectionQrToken = "LGS-QR-COLLECT-" + "B".repeat(49);

  beforeEach(async () => {
    vi.restoreAllMocks();
    clearAccessToken();
    mobileQueryClient.clear();
    useMobileStore.getState().resetTransientState();
    await secureStorage.deleteRefreshToken();
    await useAuthStore.getState().clearAuth();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("completes full partner journey: business onboarding -> KYC 3-step upload -> hub configuration -> bookings -> intake/vault -> LKR payouts", async () => {
    let businessCreated = false;
    let putUploadCalled = false;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";

        if (url === "file:///tmp/br-cert.jpg") {
          return new Response(new Blob(["mock-jpeg-bytes"], { type: "image/jpeg" }), {
            status: 200
          });
        }
        if (url.startsWith("https://r2.storage.example/upload/") && method === "PUT") {
          putUploadCalled = true;
          return new Response(null, { status: 200 });
        }

        const json = (data: unknown, status = 200) =>
          new Response(JSON.stringify({ success: true, data }), {
            status,
            headers: { "Content-Type": "application/json" }
          });

        if (url.endsWith("/auth/login")) {
          return json({
            accessToken: "initial-jwt",
            refreshToken: "initial-refresh",
            expiresIn: 900,
            tokenType: "Bearer"
          });
        }
        if (url.endsWith("/auth/refresh")) {
          return json({
            accessToken: "promoted-host-jwt",
            refreshToken: "rotated-host-refresh",
            expiresIn: 900,
            tokenType: "Bearer"
          });
        }
        if (url.endsWith("/auth/me")) {
          return json({
            user: {
              id: userId,
              email: "owner@colombovault.lk",
              displayName: "Nimal Jayawardena",
              status: "ACTIVE",
              isEmailVerified: true,
              isPhoneVerified: true,
              roles: businessCreated ? ["TRAVELLER", "HOST_OWNER"] : ["TRAVELLER"],
              lastLoginAt: "2026-11-15T01:00:00.000Z"
            },
            sessionId: "sess-host-1",
            permissions: businessCreated
              ? ["host.business.manage", "host.location.manage", "host.custody.operate", "host.finance.read"]
              : ["discovery.read"]
          });
        }
        if (url.endsWith("/hosts/businesses") && method === "POST") {
          businessCreated = true;
          return json({
            id: businessId,
            ownerUserId: userId,
            legalBusinessName: "Colombo Vault Holdings (Pvt) Ltd",
            tradeName: "Colombo Fort Vault",
            entityType: "PRIVATE_LIMITED",
            contactEmail: "owner@colombovault.lk",
            contactPhone: "+94112345678",
            countryCode: "LK",
            verificationStatus: "PENDING_SUBMISSION"
          });
        }
        if (url.endsWith("/uploads/presigned-url") && method === "POST") {
          return json({
            intentId: "int00001-0000-4000-8000-000000000001",
            uploadUrl: "https://r2.storage.example/upload/kyc-br-cert",
            fileKey: "kyc/biz00001/br-cert.jpg",
            expiresAt: "2026-11-15T01:20:00.000Z"
          });
        }
        if (url.endsWith("/uploads/confirm") && method === "POST") {
          return json({
            intentId: "int00001-0000-4000-8000-000000000001",
            fileKey: "kyc/biz00001/br-cert.jpg",
            verifiedMimeType: "image/jpeg",
            verifiedSizeBytes: 20480
          });
        }
        if (url.endsWith(`/hosts/businesses/${businessId}/verification`) && method === "POST") {
          return json({
            id: "ver00001-0000-4000-8000-000000000001",
            businessId,
            status: "SUBMITTED",
            documents: [{ documentType: "BUSINESS_REGISTRATION", fileKey: "kyc/biz00001/br-cert.jpg" }]
          });
        }
        if (url.endsWith("/hosts/locations") && method === "POST") {
          return json({
            id: locationId,
            businessId,
            name: "Fort Station Express Vault",
            addressLine1: "42 Olcott Mawatha",
            city: "Colombo",
            countryCode: "LK",
            latitude: 6.9336,
            longitude: 79.8501,
            timezone: "Asia/Colombo",
            bookingMode: "INSTANT",
            acceptsOversized: true,
            amenities: ["CCTV", "LOCKERS"],
            status: "DRAFT",
            zones: [],
            exceptions: []
          });
        }
        if (url.endsWith(`/hosts/locations/${locationId}/opening-hours`) && method === "PUT") {
          return json({ success: true });
        }
        if (url.endsWith(`/hosts/locations/${locationId}/exceptions`) && method === "POST") {
          return json({ success: true });
        }
        if (url.endsWith(`/hosts/locations/${locationId}/zones`) && method === "POST") {
          return json({
            id: zoneId,
            locationId,
            name: "Main Locker Bank A",
            zoneType: "LOCKER",
            isActive: true
          });
        }
        if (url.endsWith(`/hosts/locations/${locationId}/capacity-pools`) && method === "POST") {
          return json({
            id: "pool0001-0000-4000-8000-000000000001",
            locationId,
            zoneId,
            poolType: "SHARED",
            totalUnits: 40,
            isActive: true,
            createdAt: "2026-11-15T01:00:00.000Z",
            updatedAt: "2026-11-15T01:00:00.000Z"
          });
        }
        if (url.endsWith(`/hosts/locations/${locationId}/pricing`) && method === "PUT") {
          return json({
            id: "prc00001-0000-4000-8000-000000000001",
            locationId,
            currency: "LKR",
            pricingUnit: "CALENDAR_DAY",
            baseRateMinor: 120000
          });
        }
        if (url.endsWith(`/hosts/locations/${locationId}/submit`) && method === "POST") {
          return json({
            id: locationId,
            businessId,
            name: "Fort Station Express Vault",
            status: "PENDING_REVIEW"
          });
        }
        if (url.endsWith(`/hosts/bookings/${bookingId}/accept`) && method === "POST") {
          return json({ id: bookingId, status: "PENDING_PAYMENT" });
        }
        if (url.endsWith(`/hosts/bookings/${rejectBookingId}/reject`) && method === "POST") {
          return json({ id: rejectBookingId, status: "REJECTED" });
        }
        if (url.endsWith("/hosts/custody/verify") && method === "POST") {
          return json({
            verified: true,
            bookingId,
            referenceCode: "BGBX-LK-1001",
            operation: "CHECK_IN",
            expectedBagCount: 1,
            checkedInBagCount: null,
            custodyStatus: "AWAITING_DROP_OFF"
          });
        }
        if (url.endsWith(`/hosts/custody/${bookingId}/check-in`) && method === "POST") {
          return json({
            id: "c0000001-0000-4000-8000-000000000001",
            bookingId,
            status: "IN_STORAGE",
            checkedInBagCount: 1,
            bags: [
              {
                id: "bag00001-0000-4000-8000-000000000001",
                custodyRecordId: "c0000001-0000-4000-8000-000000000001",
                bagTagCode: "TAG-1001-1",
                bagCategory: "BAG_MEDIUM",
                securitySealNumber: "SEAL-001",
                zoneId,
                photoFileKey: null,
                conditionNotes: null,
                checkedInAt: "2026-11-16T04:10:00.000Z",
                releasedAt: null
              }
            ]
          });
        }
        if (url.endsWith(`/hosts/custody/${bookingId}`) && method === "GET") {
          return json({
            id: "c0000001-0000-4000-8000-000000000001",
            bookingId,
            status: "IN_STORAGE",
            expectedBagCount: 1,
            checkedInBagCount: 1,
            releasedBagCount: null,
            bags: [
              {
                id: "bag00001-0000-4000-8000-000000000001",
                custodyRecordId: "c0000001-0000-4000-8000-000000000001",
                bagTagCode: "TAG-1001-1",
                bagCategory: "BAG_MEDIUM",
                securitySealNumber: "SEAL-001",
                zoneId,
                photoFileKey: null,
                conditionNotes: null,
                checkedInAt: "2026-11-16T04:10:00.000Z",
                releasedAt: null
              }
            ]
          });
        }
        if (url.endsWith(`/hosts/custody/${bookingId}/check-out`) && method === "POST") {
          return json({
            id: "c0000001-0000-4000-8000-000000000001",
            bookingId,
            status: "RELEASED_TO_TRAVELLER",
            releasedBagCount: 1
          });
        }
        if (url.includes("/hosts/finance/summary")) {
          return json({
            currency: "LKR",
            totalAccruedMinor: 204000,
            totalEligibleMinor: 204000,
            totalOnHoldMinor: 0,
            totalPaidMinor: 0,
            payables: [
              {
                id: "pay00001-0000-4000-8000-000000000001",
                businessId,
                bookingId,
                referenceCode: "BGBX-LK-1001",
                grossSubtotalMinor: 240000,
                commissionMinor: 36000,
                netPayableMinor: 204000,
                currency: "LKR",
                status: "ELIGIBLE",
                accruedAt: "2026-11-16T04:10:00.000Z",
                eligibleAt: "2026-11-16T11:45:00.000Z",
                updatedAt: "2026-11-16T11:45:00.000Z"
              }
            ]
          });
        }
        if (url.endsWith(`/bookings/${bookingId}/exceptions`) && method === "POST") {
          return json({
            id: bookingId,
            status: "DISPUTED",
            exceptionReason: "Outer zipper wear reported after collection"
          });
        }

        throw new Error(`Unhandled host fetch call: ${method} ${url}`);
      })
    );

    // 1. Login -> Create Host Business -> Refresh Session Claims (HOST_OWNER)
    await useAuthStore.getState().login({
      email: "owner@colombovault.lk",
      password: "StrongPassword123!"
    });
    expect(useAuthStore.getState().user?.roles).toEqual(["TRAVELLER"]);

    const business = await marketplaceApi.createBusiness({
      legalBusinessName: "Colombo Vault Holdings (Pvt) Ltd",
      tradeName: "Colombo Fort Vault",
      entityType: "PRIVATE_LIMITED",
      contactEmail: "owner@colombovault.lk",
      contactPhone: "+94112345678",
      countryCode: "LK"
    });
    expect(business.id).toBe(businessId);

    await useAuthStore.getState().refreshSessionAndUser();
    expect(useAuthStore.getState().user?.roles).toContain("HOST_OWNER");

    // 2. 3-Step KYC Document Upload -> Verification Submission
    const intent = await marketplaceApi.initiateUpload({
      purpose: "HOST_VERIFICATION",
      resourceType: "HOST_BUSINESS",
      resourceId: business.id,
      fileName: "br-cert.jpg",
      fileSize: 20480,
      mimeType: "image/jpeg"
    });
    await marketplaceApi.uploadFileToPresignedUrl({
      uploadUrl: intent.uploadUrl,
      fileUri: "file:///tmp/br-cert.jpg",
      mimeType: "image/jpeg"
    });
    expect(putUploadCalled).toBe(true);

    const confirmed = await marketplaceApi.confirmUpload({
      intentId: intent.intentId,
      fileKey: intent.fileKey,
      purpose: "HOST_VERIFICATION",
      resourceId: business.id,
      documentType: "BUSINESS_REGISTRATION",
      isPrimary: false
    });
    const verification = await marketplaceApi.submitVerification(business.id, {
      documents: [
        {
          documentType: "BUSINESS_REGISTRATION",
          fileKey: confirmed.fileKey
        }
      ]
    });
    expect(verification.status).toBe("SUBMITTED");

    // 3. Location -> Hours -> Exception -> Zone -> Capacity Pool -> LKR Pricing -> Submit for Review
    const loc = await marketplaceApi.createLocation({
      businessId: business.id,
      name: "Fort Station Express Vault",
      addressLine1: "42 Olcott Mawatha",
      city: "Colombo",
      countryCode: "LK",
      latitude: 6.9336,
      longitude: 79.8501,
      timezone: "Asia/Colombo",
      bookingMode: "INSTANT",
      acceptsOversized: true,
      amenities: ["CCTV", "LOCKERS"]
    });
    await marketplaceApi.setOpeningHours(loc.id, [
      {
        dayOfWeek: 1,
        openTime: "08:00",
        closeTime: "20:00",
        allowsDropoff: true,
        allowsCollection: true,
        isClosed: false
      }
    ]);
    await marketplaceApi.addOpeningHoursException(loc.id, {
      exceptionDate: "2026-12-25",
      exceptionType: "CLOSURE",
      reason: "Public holiday"
    });
    const zone = await marketplaceApi.createStorageZone(loc.id, {
      name: "Main Locker Bank A",
      zoneType: "LOCKER",
      securityTier: "STANDARD",
      isActive: true
    });
    const pool = await marketplaceApi.createCapacityPool(loc.id, {
      zoneId: zone.id,
      poolType: "SHARED",
      totalUnits: 40,
      isActive: true
    });
    expect(pool.totalUnits).toBe(40);
    const pricing = await marketplaceApi.configurePricingPolicy(loc.id, {
      currency: "LKR",
      pricingUnit: "CALENDAR_DAY",
      baseRateMinor: 120000
    });
    expect(pricing.baseRateMinor).toBe(120000);
    const submittedLoc = await marketplaceApi.submitLocationForReview(loc.id);
    expect(submittedLoc.status).toBe("PENDING_REVIEW");

    // 4. Booking Approval / Rejection
    const accepted = await marketplaceApi.acceptHostBooking(bookingId, {});
    expect(accepted.status).toBe("PENDING_PAYMENT");
    const rejected = await marketplaceApi.rejectHostBooking(rejectBookingId, {
      reason: "Facility closed for maintenance"
    });
    expect(rejected.status).toBe("REJECTED");

    // 5. Verify Pass -> Check-In Intake -> Vault Inspection -> Unconditional Release
    const verified = await marketplaceApi.verifyCustodyPass({
      bookingId,
      operation: "CHECK_IN",
      qrToken: checkInQrToken
    });
    expect(verified.verified).toBe(true);
    const checkedIn = await marketplaceApi.completeCheckIn(bookingId, {
      qrToken: checkInQrToken,
      bags: [
        {
          bagTagCode: "TAG-1001-1",
          bagCategory: "BAG_MEDIUM",
          securitySealNumber: "SEAL-001",
          zoneId: zone.id
        }
      ]
    });
    expect(checkedIn.status).toBe("IN_STORAGE");

    const vaultDetail = await marketplaceApi.getCustodyDetail(bookingId);
    expect(vaultDetail.bags).toHaveLength(1);
    const released = await marketplaceApi.completeCollection(bookingId, {
      qrToken: collectionQrToken,
      releasedBagCount: 1
    });
    expect(released.status).toBe("RELEASED_TO_TRAVELLER");

    // 6. LKR Payouts Summary & Exception Report
    const finance = await marketplaceApi.getHostFinanceSummary(business.id);
    expect(finance.currency).toBe("LKR");
    expect(finance.totalEligibleMinor).toBe(204000);
    const disputed = await marketplaceApi.reportBookingException(bookingId, {
      category: "DAMAGE_REPORTED",
      reason: "Outer zipper wear reported after collection"
    });
    expect(disputed.status).toBe("DISPUTED");
  });
});
