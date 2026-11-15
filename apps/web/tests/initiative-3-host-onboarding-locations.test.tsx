import React from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SYSTEM_PERMISSIONS,
  type AuthenticatedUser,
  type HostBusiness,
  type HostStaffMemberDetail,
  type HostVerification,
  type LocationMedia,
  type OpeningHours,
  type OpeningHoursException,
  type PricingPolicy,
  type StorageCapacityPool,
  type StorageLocation,
  type StorageZone
} from "@luggage-storage/contracts";
import {
  HostBusinessProfileLegalPage,
  HostCapacityPoolsZonesPage,
  HostDashboardLayout,
  HostLocationManagementPage,
  HostLocationProfileEditorPage,
  HostOnboardingPage,
  HostPricingRulesMultipliersPage,
  HostScheduleCalendarEditorPage,
  HostStaffManagementRbacPage
} from "@/features/host";
import { BecomeAHostLandingPage } from "@/features/traveller/StaticInfoPages";
import { hostQueryKeys } from "@/hooks/queries/query-keys";
import { uploadFileToR2, validateFileForUpload } from "@/lib/r2-uploader";
import { marketplaceApi } from "@/services/marketplace-api";
import { useAuthStore } from "@/store/useAuthStore";
import { useHostContextStore } from "@/store/useHostContextStore";

const FORBIDDEN_DEVELOPER_PATTERN = /\b(PW|HD|AD|TM|HM)-\d{3}\b|\bWF-\d{3}\b|\bOQ-\d{3}\b/;
const DEMO_FORBIDDEN_MARKERS = [
  "Colombo Fort Counter #4",
  "Ceylon Transit Hospitality",
  "Colombo Fort Station Heritage Vault",
  "Roshan Fernando",
  "Priyantha Wickramasinghe",
  "DEC-001",
  "DEC-002",
  "Sample Verification Status",
  "Interactive Preview",
  "Sample Host Partner Profile"
];

const BIZ_ID = "11111111-1111-4111-8111-111111111101";
const LOC_ID = "22222222-2222-4222-8222-222222222202";
const ZONE_ID = "33333333-3333-4333-8333-333333333303";
const POOL_ID = "44444444-4444-4444-8444-444444444404";
const VERIF_ID = "55555555-5555-4555-8555-555555555505";
const DOC_ID = "66666666-6666-4666-8666-666666666606";
const MEDIA_ID = "77777777-7777-4777-8777-777777777707";
const EXCEPTION_ID = "88888888-8888-4888-8888-888888888808";
const POLICY_ID = "99999999-9999-4999-8999-999999999909";
const STAFF_MEMBERSHIP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const OWNER_USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const STAFF_USER_ID = "cccccccc-cccc-4ccc-8ccc-ccccccccccc3";

const NOW_ISO = "2027-01-15T08:00:00.000Z";

function makeAuthUser(overrides: Partial<AuthenticatedUser> & { roles: string[] }): AuthenticatedUser {
  return {
    id: OWNER_USER_ID,
    email: "nuwan.perera@lankastorage.lk",
    displayName: "Nuwan Perera",
    status: "ACTIVE",
    isEmailVerified: true,
    isPhoneVerified: true,
    roles: overrides.roles,
    permissions: overrides.permissions,
    lastLoginAt: NOW_ISO,
    ...overrides
  };
}

const ORIGINAL_AUTH_INITIAL_STATE = { ...useAuthStore.getInitialState() };
const ORIGINAL_HOST_CTX_INITIAL_STATE = { ...useHostContextStore.getInitialState() };

function setAuthenticatedState(user: AuthenticatedUser, permissions: string[] = []) {
  const patch = {
    user,
    sessionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    permissions,
    isAuthenticated: true,
    isInitializing: false,
    isLoading: false,
    error: null,
    logoutWarning: null
  };
  // React renderToString reads Zustand's getInitialState() via useSyncExternalStore getServerSnapshot
  Object.assign(useAuthStore.getInitialState(), patch);
  useAuthStore.setState(patch);
}

function setHostContextState(patch: { selectedBusinessId?: string; selectedLocationId?: string }) {
  Object.assign(useHostContextStore.getInitialState(), patch);
  useHostContextStore.setState(patch);
}

function createSeededHostQueryClient(options?: { verificationStatus?: "PENDING" | "REJECTED" | "APPROVED" }) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity }
    }
  });

  const business: HostBusiness = {
    id: BIZ_ID,
    ownerUserId: OWNER_USER_ID,
    legalBusinessName: "Galle Fort Luggage Concierge Pvt Ltd",
    tradeName: "Southern Locker Concierge",
    businessRegistrationNumber: "PV-998877",
    entityType: "PRIVATE_LIMITED",
    taxIdentifier: "TIN-445566",
    contactEmail: "desk@galleconcierge.lk",
    contactPhone: "+94912244556",
    addressLine1: "14 Church Street",
    addressLine2: "Fort Quarter",
    city: "Galle",
    postalCode: "80000",
    countryCode: "LK",
    payoutBankName: "Hatton National Bank",
    payoutAccountNumberMasked: "****4321",
    payoutAccountName: "Galle Fort Luggage Concierge",
    payoutBranchCode: "0042",
    status: options?.verificationStatus === "REJECTED" ? "PENDING_VERIFICATION" : "ACTIVE",
    verificationStatus: options?.verificationStatus ?? "APPROVED",
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO
  };

  const verification: HostVerification = {
    id: VERIF_ID,
    businessId: BIZ_ID,
    status: options?.verificationStatus ?? "APPROVED",
    reviewedBy: null,
    reviewedAt: options?.verificationStatus === "REJECTED" ? NOW_ISO : null,
    rejectionReason:
      options?.verificationStatus === "REJECTED"
        ? "Uploaded Form 1 scan is cropped; upload full 2027 certificate."
        : null,
    adminNotes: null,
    submittedAt: NOW_ISO,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    documents: [
      {
        id: DOC_ID,
        verificationId: VERIF_ID,
        documentType: "BUSINESS_REGISTRATION",
        fileKey: `verifications/${BIZ_ID}/doc-form1.pdf`,
        fileName: "galle-concierge-brn.pdf",
        fileSize: 20480,
        mimeType: "application/pdf",
        status: options?.verificationStatus === "REJECTED" ? "REJECTED" : "APPROVED",
        rejectionReason: null,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO
      }
    ]
  };

  const zones: StorageZone[] = [
    {
      id: ZONE_ID,
      locationId: LOC_ID,
      name: "Rampart Steel Vault Alpha",
      zoneType: "LOCKED_ROOM",
      securityTier: "HIGH",
      isActive: true,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO
    }
  ];

  const media: LocationMedia[] = [
    {
      id: MEDIA_ID,
      locationId: LOC_ID,
      fileKey: `locations/${LOC_ID}/storefront.jpg`,
      url: `http://localhost:3000/api/v1/uploads/public/locations/${LOC_ID}/storefront.jpg`,
      mediaType: "IMAGE",
      caption: "Galle Pedlar Concierge Reception",
      isPrimary: true,
      sortOrder: 0,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO
    }
  ];

  const location: StorageLocation = {
    id: LOC_ID,
    businessId: BIZ_ID,
    name: "Pedlar Square Baggage Lounge",
    description: "Insured air-conditioned luggage check beside Pedlar Street clocktower.",
    addressLine1: "22 Pedlar Street",
    addressLine2: "Ground Floor Courtyard",
    city: "Galle",
    postalCode: "80000",
    countryCode: "LK",
    latitude: 6.0267,
    longitude: 80.217,
    approximateLatitude: 6.027,
    approximateLongitude: 80.217,
    timezone: "Asia/Colombo",
    status: "ACTIVE",
    bookingMode: "INSTANT",
    acceptsOversized: true,
    amenities: ["CCTV", "AIR_CONDITIONING", "STAFF_ON_DUTY"],
    rejectionReason: null,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    images: media,
    zones
  };

  const openingHours: OpeningHours[] = [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
    id: `00000000-0000-4000-8000-00000000000${dayOfWeek}`,
    locationId: LOC_ID,
    dayOfWeek,
    openTime: "07:00",
    closeTime: "21:30",
    allowsDropoff: true,
    allowsCollection: true,
    isClosed: false,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO
  }));

  const exceptions: OpeningHoursException[] = [
    {
      id: EXCEPTION_ID,
      locationId: LOC_ID,
      exceptionDate: "2027-04-14",
      exceptionType: "CLOSURE",
      openTime: null,
      closeTime: null,
      reason: "Sinhala & Tamil New Year Closure",
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO
    }
  ];

  const pools: StorageCapacityPool[] = [
    {
      id: POOL_ID,
      locationId: LOC_ID,
      zoneId: ZONE_ID,
      poolType: "SHARED",
      dedicatedBagCategory: null,
      totalUnits: 48,
      isActive: true,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO
    }
  ];

  const policy: PricingPolicy = {
    id: POLICY_ID,
    locationId: LOC_ID,
    currency: "LKR",
    pricingUnit: "CALENDAR_DAY",
    baseRateMinor: 165000,
    status: "ACTIVE",
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    tierRates: [
      {
        id: "12121212-1212-4121-8121-121212121201",
        policyId: POLICY_ID,
        bagCategory: "BAG_SMALL",
        rateMinor: 120000,
        categoryMultiplierBps: 10000,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO
      },
      {
        id: "12121212-1212-4121-8121-121212121202",
        policyId: POLICY_ID,
        bagCategory: "BAG_MEDIUM",
        rateMinor: 165000,
        categoryMultiplierBps: 12500,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO
      }
    ]
  };

  const staffList: HostStaffMemberDetail[] = [
    {
      id: STAFF_MEMBERSHIP_ID,
      businessId: BIZ_ID,
      userId: STAFF_USER_ID,
      staffRole: "ATTENDANT",
      assignedLocationIds: [LOC_ID],
      isActive: true,
      invitedAt: NOW_ISO,
      acceptedAt: NOW_ISO,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
      email: "chaminda.desk@galleconcierge.lk",
      displayName: "Chaminda De Silva",
      userStatus: "ACTIVE"
    }
  ];

  qc.setQueryData(hostQueryKeys.businesses(), [business]);
  qc.setQueryData(hostQueryKeys.businessDetail(BIZ_ID), business);
  qc.setQueryData(hostQueryKeys.verification(BIZ_ID), verification);
  qc.setQueryData(hostQueryKeys.payoutDetails(BIZ_ID), {
    payoutBankName: "Hatton National Bank",
    payoutAccountNumber: "004210094321",
    payoutAccountNumberMasked: "****4321",
    payoutAccountName: "Galle Fort Luggage Concierge",
    payoutBranchCode: "0042"
  });
  qc.setQueryData(hostQueryKeys.staff(BIZ_ID), staffList);
  qc.setQueryData(hostQueryKeys.locations(), [location]);
  qc.setQueryData(hostQueryKeys.locationDetail(LOC_ID), location);
  qc.setQueryData(hostQueryKeys.openingHours(LOC_ID), openingHours);
  qc.setQueryData(hostQueryKeys.exceptions(LOC_ID), exceptions);
  qc.setQueryData(hostQueryKeys.zones(LOC_ID), zones);
  qc.setQueryData(hostQueryKeys.media(LOC_ID), media);
  qc.setQueryData(hostQueryKeys.capacityPools(LOC_ID), pools);
  qc.setQueryData(hostQueryKeys.pricingPolicy(LOC_ID), policy);

  return qc;
}

function assertCleanLiveRender(html: string, pageLabel: string) {
  expect(html, `${pageLabel} leaked developer codes`).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
  for (const marker of DEMO_FORBIDDEN_MARKERS) {
    expect(html, `${pageLabel} leaked demo marker "${marker}"`).not.toContain(marker);
  }
}

describe("Initiative 3 — Web R2 Uploader, Host Onboarding, Sidebar RBAC & Sub-Resource Pages", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.assign(useAuthStore.getInitialState(), ORIGINAL_AUTH_INITIAL_STATE);
    useAuthStore.setState(ORIGINAL_AUTH_INITIAL_STATE);
    Object.assign(useHostContextStore.getInitialState(), ORIGINAL_HOST_CTX_INITIAL_STATE);
    useHostContextStore.setState(ORIGINAL_HOST_CTX_INITIAL_STATE);
  });

  it("validates upload constraints and executes direct R2 PUT with credentials omit and no Authorization header", async () => {
    const emptyFile = { size: 0, name: "empty.pdf", type: "application/pdf" } as unknown as File;
    expect(() => validateFileForUpload(emptyFile, "HOST_VERIFICATION")).toThrow();

    const wrongMime = { size: 1024, name: "notes.txt", type: "text/plain" } as unknown as File;
    expect(() => validateFileForUpload(wrongMime, "HOST_VERIFICATION")).toThrow();

    const oversizedKyc = {
      size: 16 * 1024 * 1024,
      name: "huge-brn.pdf",
      type: "application/pdf"
    } as unknown as File;
    expect(() => validateFileForUpload(oversizedKyc, "HOST_VERIFICATION")).toThrow();

    const oversizedImage = {
      size: 11 * 1024 * 1024,
      name: "huge-photo.jpg",
      type: "image/jpeg"
    } as unknown as File;
    expect(() => validateFileForUpload(oversizedImage, "LOCATION_IMAGE")).toThrow();

    const initSpy = vi.spyOn(marketplaceApi, "initiateUpload").mockResolvedValue({
      intentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      uploadUrl: "http://localhost:3000/api/v1/uploads/mock-storage/verifications%2Fbrn.pdf?signature=sig",
      fileKey: `verifications/${BIZ_ID}/brn.pdf`,
      expiresInSeconds: 900
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const confirmSpy = vi.spyOn(marketplaceApi, "confirmUpload").mockResolvedValue({
      success: true,
      intentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      fileKey: `verifications/${BIZ_ID}/brn.pdf`,
      id: MEDIA_ID,
      url: `http://localhost:3000/api/v1/uploads/public/verifications/${BIZ_ID}/brn.pdf`,
      message: "Confirmed"
    });

    const validFile = new File([new Uint8Array([37, 80, 68, 70])], "brn.pdf", {
      type: "application/pdf"
    });
    const uploaded = await uploadFileToR2({
      file: validFile,
      purpose: "HOST_VERIFICATION",
      resourceId: BIZ_ID,
      documentType: "BUSINESS_REGISTRATION"
    });

    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [putUrl, putInit] = fetchSpy.mock.calls[0];
    expect(putUrl).toContain("mock-storage");
    expect(putInit?.method).toBe("PUT");
    expect(putInit?.credentials).toBe("omit");
    const putHeaders = (putInit?.headers ?? {}) as Record<string, string>;
    expect(putHeaders["Content-Type"]).toBe("application/pdf");
    expect(putHeaders.Authorization).toBeUndefined();
    expect(putHeaders.authorization).toBeUndefined();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(uploaded.fileKey).toBe(`verifications/${BIZ_ID}/brn.pdf`);
  });

  it("renders BecomeAHostLandingPage CTAs accurately per auth state and renders HostOnboardingPage steps 1 & 2 (including REJECTED feedback)", () => {
    const qcEmpty = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // 1. Logged out landing CTA -> /host/onboarding & /register
    const guestLanding = renderToString(
      <QueryClientProvider client={qcEmpty}>
        <MemoryRouter initialEntries={["/become-a-host"]}>
          <BecomeAHostLandingPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(guestLanding).toContain('href="/host/onboarding"');
    expect(guestLanding).toContain('href="/register"');

    // 2. Logged in TRAVELLER -> /host/onboarding + Step 1 Business form
    setAuthenticatedState(makeAuthUser({ roles: ["TRAVELLER"] }));
    const travellerLanding = renderToString(
      <QueryClientProvider client={qcEmpty}>
        <MemoryRouter initialEntries={["/become-a-host"]}>
          <BecomeAHostLandingPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(travellerLanding).toContain('href="/host/onboarding"');

    const onboardingStep1 = renderToString(
      <QueryClientProvider client={qcEmpty}>
        <MemoryRouter initialEntries={["/host/onboarding"]}>
          <HostOnboardingPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(onboardingStep1).toContain("Register Host Business Entity");
    expect(onboardingStep1).toContain("Register Business &amp; Continue");

    // 3. HOST_OWNER -> landing goes to /host/dashboard; onboarding with REJECTED verification opens Step 2 re-upload
    setAuthenticatedState(makeAuthUser({ roles: ["TRAVELLER", "HOST_OWNER"] }));
    const ownerLanding = renderToString(
      <QueryClientProvider client={qcEmpty}>
        <MemoryRouter initialEntries={["/become-a-host"]}>
          <BecomeAHostLandingPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(ownerLanding).toContain('href="/host/dashboard"');

    const qcRejected = createSeededHostQueryClient({ verificationStatus: "REJECTED" });
    const onboardingStep2 = renderToString(
      <QueryClientProvider client={qcRejected}>
        <MemoryRouter initialEntries={["/host/onboarding"]}>
          <HostOnboardingPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(onboardingStep2).toContain("Upload KYC Verification Documents");
    expect(onboardingStep2).toContain("Verification Status: <!-- -->REJECTED");
    expect(onboardingStep2).toContain("Uploaded Form 1 scan is cropped; upload full 2027 certificate.");
    expect(onboardingStep2).toContain("Upload Document");
    assertCleanLiveRender(onboardingStep2, "HostOnboardingPage Step 2");
  });

  it("enforces HostDashboardLayout live role isolation, exact sidebar highlighting, and strict HOST_STAFF owner-route blocking", () => {
    const qc = createSeededHostQueryClient();
    setHostContextState({ selectedBusinessId: BIZ_ID, selectedLocationId: LOC_ID });

    // Authenticated HOST_OWNER at /host/locations/:id/schedule
    setAuthenticatedState(makeAuthUser({ roles: ["TRAVELLER", "HOST_OWNER"] }));
    const ownerScheduleHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/host/locations/${LOC_ID}/schedule`]}>
          <Routes>
            <Route path="/host" element={<HostDashboardLayout />}>
              <Route path="locations/:id/schedule" element={<HostScheduleCalendarEditorPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    assertCleanLiveRender(ownerScheduleHtml, "HostDashboardLayout Schedule");

    const linkRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/g;
    const links: Array<{ attrs: string; text: string }> = [];
    for (const match of ownerScheduleHtml.matchAll(linkRegex)) {
      links.push({ attrs: match[1], text: match[2] });
    }
    const scheduleLink = links.find((l) => l.text.includes("Hours &amp; Calendar"));
    const profileLink = links.find((l) => l.text.includes("Location Profile"));
    const hubsLink = links.find((l) => l.text.includes("Storage Hubs"));
    expect(scheduleLink?.attrs).toContain("bg-navy-900 text-white");
    expect(profileLink?.attrs).not.toContain("bg-navy-900 text-white");
    expect(hubsLink?.attrs).not.toContain("bg-terracotta-500 text-white");

    // Authenticated HOST_STAFF blocked from /host/staff & /host/locations/:id without preview bypass
    setAuthenticatedState(
      makeAuthUser({
        id: STAFF_USER_ID,
        email: "chaminda.desk@galleconcierge.lk",
        displayName: "Chaminda De Silva",
        roles: ["TRAVELLER", "HOST_STAFF"]
      })
    );

    const staffBlockedStaffHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/host/staff"]}>
          <Routes>
            <Route path="/host" element={<HostDashboardLayout />}>
              <Route path="staff" element={<HostStaffManagementRbacPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(staffBlockedStaffHtml).toContain("Host Owner Authorization Required");
    expect(staffBlockedStaffHtml).toContain("Logged in as Staff (Counter Scope)");
    expect(staffBlockedStaffHtml).not.toContain("Switch to Host Owner Role");
    expect(staffBlockedStaffHtml).not.toContain("Host Business Onboarding Incomplete");
    assertCleanLiveRender(staffBlockedStaffHtml, "HostDashboardLayout HOST_STAFF /staff");

    const staffBlockedLocationEditHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/host/locations/${LOC_ID}`]}>
          <Routes>
            <Route path="/host" element={<HostDashboardLayout />}>
              <Route path="locations/:id" element={<HostLocationProfileEditorPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(staffBlockedLocationEditHtml).toContain("Host Owner Authorization Required");
    expect(staffBlockedLocationEditHtml).not.toContain("Switch to Host Owner Role");
    assertCleanLiveRender(staffBlockedLocationEditHtml, "HostDashboardLayout HOST_STAFF /locations/:id");
  });

  it("renders HD-002 through HD-006, HD-013, and HD-014 from live seeded queries with zero demo or developer leakage", () => {
    const qc = createSeededHostQueryClient();
    setHostContextState({ selectedBusinessId: BIZ_ID, selectedLocationId: LOC_ID });
    setAuthenticatedState(
      makeAuthUser({ roles: ["TRAVELLER", "HOST_OWNER"] }),
      [SYSTEM_PERMISSIONS.HOSTS_STAFF_MANAGE_OWN]
    );

    const renderHostRoute = (initialPath: string, routePath: string, element: React.ReactElement) =>
      renderToString(
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route path="/host" element={<HostDashboardLayout />}>
                <Route path={routePath} element={element} />
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

    // HD-002: Storage Hubs List
    const locationsHtml = renderHostRoute("/host/locations", "locations", <HostLocationManagementPage />);
    expect(locationsHtml).toContain("Pedlar Square Baggage Lounge");
    assertCleanLiveRender(locationsHtml, "HD-002 HostLocationManagementPage");

    // HD-003: Location Profile & Media
    const editorHtml = renderHostRoute(
      `/host/locations/${LOC_ID}`,
      "locations/:id",
      <HostLocationProfileEditorPage />
    );
    expect(editorHtml).toContain("Pedlar Square Baggage Lounge");
    expect(editorHtml).toContain("Galle Pedlar Concierge Reception");
    assertCleanLiveRender(editorHtml, "HD-003 HostLocationProfileEditorPage");

    // HD-004: Opening Hours & Exceptions
    const scheduleHtml = renderHostRoute(
      `/host/locations/${LOC_ID}/schedule`,
      "locations/:id/schedule",
      <HostScheduleCalendarEditorPage />
    );
    expect(scheduleHtml).toContain("Pedlar Square Baggage Lounge");
    expect(scheduleHtml).toContain("2027-04-14");
    expect(scheduleHtml).toContain("Sinhala &amp; Tamil New Year Closure");
    assertCleanLiveRender(scheduleHtml, "HD-004 HostScheduleCalendarEditorPage");

    // HD-005: Capacity & Zones
    const capacityHtml = renderHostRoute(
      `/host/locations/${LOC_ID}/capacity`,
      "locations/:id/capacity",
      <HostCapacityPoolsZonesPage />
    );
    expect(capacityHtml).toContain("Rampart Steel Vault Alpha");
    expect(capacityHtml).toContain("48");
    assertCleanLiveRender(capacityHtml, "HD-005 HostCapacityPoolsZonesPage");

    // HD-006: Pricing Rules
    const pricingHtml = renderHostRoute(
      `/host/locations/${LOC_ID}/pricing`,
      "locations/:id/pricing",
      <HostPricingRulesMultipliersPage />
    );
    expect(pricingHtml).toContain("Pedlar Square Baggage Lounge");
    expect(pricingHtml).toContain("Pricing Rules &amp; Multipliers");
    assertCleanLiveRender(pricingHtml, "HD-006 HostPricingRulesMultipliersPage");

    // HD-013: Staff & RBAC
    const staffHtml = renderHostRoute("/host/staff", "staff", <HostStaffManagementRbacPage />);
    expect(staffHtml).toContain("Chaminda De Silva");
    expect(staffHtml).toContain("chaminda.desk@galleconcierge.lk");
    assertCleanLiveRender(staffHtml, "HD-013 HostStaffManagementRbacPage");

    // HD-014: Business Profile, KYC & Payouts
    const settingsHtml = renderHostRoute("/host/settings", "settings", <HostBusinessProfileLegalPage />);
    expect(settingsHtml).toContain("Galle Fort Luggage Concierge Pvt Ltd");
    expect(settingsHtml).toContain("PV-998877");
    expect(settingsHtml).toContain("****4321");
    expect(settingsHtml).toContain("Payout Settlement Bank Details");
    assertCleanLiveRender(settingsHtml, "HD-014 HostBusinessProfileLegalPage");
  });
});
