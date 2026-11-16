import React from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SYSTEM_PERMISSIONS,
  type AdminHostDirectoryDetail,
  type AdminHostDirectoryItem,
  type AdminMetricsSummary,
  type AdminUserDetail,
  type AdminUserSummary,
  type AuthenticatedUser,
  type BookingDetail,
  type CustodyRecordDetail,
  type HostVerification,
  type HostVerificationQueueItem,
  type LocationModerationQueueItem,
  type PricingPolicy,
  type RefundRecord,
  type RoleDetail,
  type SecurityAuditEvent,
  type StorageCapacityPool,
  type StorageLocation
} from "@luggage-storage/contracts";
import {
  AdminCommandDashboardPage,
  AdminDashboardLayout,
  AdminDoubleEntryFinancialLedgerPage,
  AdminGlobalBookingsLedgerPage,
  AdminHostDirectoryManagementPage,
  AdminHostVerificationQueuePage,
  AdminRefundManagementQueuePage,
  AdminSecurityComplianceAuditLogPage,
  AdminStaffRbacManagementPage,
  AdminStorageLocationModerationPage,
  AdminSupportTicketTriageQueuePage
} from "@/features/admin";
import { adminQueryKeys } from "@/hooks/queries/query-keys";
import { clearAccessToken, setAccessToken } from "@/lib/api-client";
import { authApi } from "@/services/auth-api";
import { marketplaceApi } from "@/services/marketplace-api";
import { useAuthStore } from "@/store/useAuthStore";

const FORBIDDEN_DEVELOPER_PATTERN = /\b(PW|HD|AD|TM|HM)-\d{3}\b|\bWF-\d{3}\b|\bOQ-\d{3}\b/;

const SUPER_USER_ID = "11111111-1111-4111-8111-111111111101";
const SUPPORT_USER_ID = "22222222-2222-4222-8222-222222222202";
const TARGET_USER_ID = "33333333-3333-4333-8333-333333333303";
const BIZ_ID = "44444444-4444-4444-8444-444444444404";
const VERIF_ID = "55555555-5555-4555-8555-555555555505";
const DOC_ID = "66666666-6666-4666-8666-666666666606";
const LOC_ID = "77777777-7777-4777-8777-777777777707";
const BOOKING_ID = "88888888-8888-4888-8888-888888888808";
const REFUND_FAILED_ID = "99999999-9999-4999-8999-999999999909";
const AUDIT_EVENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const NOW_ISO = "2027-02-01T10:00:00.000Z";

const ORIGINAL_AUTH_INITIAL_STATE = { ...useAuthStore.getInitialState() };

function setAuthSession(user: AuthenticatedUser, permissions: string[]) {
  const patch = {
    user,
    sessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    permissions,
    isAuthenticated: true,
    isInitializing: false,
    isLoading: false,
    error: null,
    logoutWarning: null
  };
  Object.assign(useAuthStore.getInitialState(), patch);
  useAuthStore.setState(patch);
}

function makeSuperUser(): AuthenticatedUser {
  return {
    id: SUPER_USER_ID,
    email: "super@luggagestorage.lk",
    displayName: "Platform Superadmin",
    status: "ACTIVE",
    isEmailVerified: true,
    isPhoneVerified: true,
    roles: ["SUPERADMIN"],
    permissions: Object.values(SYSTEM_PERMISSIONS),
    lastLoginAt: NOW_ISO
  };
}

function makeSupportUser(): { user: AuthenticatedUser; permissions: string[] } {
  const permissions = [
    SYSTEM_PERMISSIONS.ADMIN_USER_READ,
    SYSTEM_PERMISSIONS.ADMIN_USER_SUSPEND,
    SYSTEM_PERMISSIONS.ADMIN_USER_REINSTATE,
    SYSTEM_PERMISSIONS.ADMIN_USER_DEACTIVATE,
    SYSTEM_PERMISSIONS.ADMIN_USER_REACTIVATE,
    SYSTEM_PERMISSIONS.ADMIN_USER_VERIFY_EMAIL,
    SYSTEM_PERMISSIONS.ADMIN_ROLE_READ,
    SYSTEM_PERMISSIONS.ADMIN_PERMISSION_READ,
    SYSTEM_PERMISSIONS.ADMIN_HOST_READ,
    SYSTEM_PERMISSIONS.ADMIN_LOCATION_READ,
    SYSTEM_PERMISSIONS.ADMIN_BOOKING_READ,
    SYSTEM_PERMISSIONS.ADMIN_PAYMENT_READ,
    SYSTEM_PERMISSIONS.ADMIN_REFUND_READ,
    SYSTEM_PERMISSIONS.SUPPORT_TICKET_READ,
    SYSTEM_PERMISSIONS.SUPPORT_TICKET_UPDATE
  ];
  return {
    user: {
      id: SUPPORT_USER_ID,
      email: "support@luggagestorage.lk",
      displayName: "Support Specialist",
      status: "ACTIVE",
      isEmailVerified: true,
      isPhoneVerified: true,
      roles: ["SUPPORT"],
      permissions,
      lastLoginAt: NOW_ISO
    },
    permissions
  };
}

function createSeededAdminQueryClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } }
  });

  const metrics: AdminMetricsSummary = {
    currency: "LKR",
    activeUsersCount: 42,
    activeBusinessesCount: 6,
    suspendedBusinessesCount: 1,
    activeLocationsCount: 11,
    pendingVerificationsCount: 2,
    pendingLocationsCount: 3,
    activeBookingsCount: 8,
    disputedBookingsCount: 1,
    openRefundsCount: 2,
    grossCapturedVolumeMinor: 850000,
    platformCommissionMinor: 127500,
    unearnedBookingLiabilityMinor: 240000,
    eligibleHostPayablesMinor: 482500
  };
  qc.setQueryData(adminQueryKeys.metricsSummary(), metrics);

  const verifItem: HostVerificationQueueItem = {
    verificationId: VERIF_ID,
    businessId: BIZ_ID,
    legalBusinessName: "Ceylon Fort Depot Pvt Ltd",
    tradeName: "Fort Depot",
    businessRegistrationNumber: "PV-445566",
    businessStatus: "PENDING_VERIFICATION",
    ownerEmail: "owner@fortdepot.lk",
    ownerDisplayName: "Kasun Silva",
    status: "PENDING_REVIEW",
    documentCount: 1,
    submittedAt: NOW_ISO
  };
  qc.setQueryData(
    adminQueryKeys.verifications({ page: 1, limit: 20, status: "PENDING_REVIEW" }),
    { queue: [verifItem], total: 1 }
  );

  const verifDetail: HostVerification = {
    id: VERIF_ID,
    businessId: BIZ_ID,
    submittedBy: TARGET_USER_ID,
    status: "PENDING_REVIEW",
    submittedAt: NOW_ISO,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    documents: [
      {
        id: DOC_ID,
        verificationId: VERIF_ID,
        documentType: "BUSINESS_REGISTRATION",
        fileKey: "verifications/fort-br.pdf",
        fileName: "fort-br.pdf",
        fileSize: 204800,
        mimeType: "application/pdf",
        status: "PENDING",
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO
      }
    ]
  };
  qc.setQueryData(adminQueryKeys.verificationDetail(VERIF_ID), verifDetail);

  const hostItem: AdminHostDirectoryItem = {
    id: BIZ_ID,
    ownerUserId: TARGET_USER_ID,
    ownerEmail: "owner@fortdepot.lk",
    ownerDisplayName: "Kasun Silva",
    legalBusinessName: "Ceylon Fort Depot Pvt Ltd",
    tradeName: "Fort Depot",
    businessRegistrationNumber: "PV-445566",
    entityType: "PRIVATE_LIMITED",
    city: "Colombo",
    contactEmail: "desk@fortdepot.lk",
    contactPhone: "+94771234567",
    status: "ACTIVE",
    verificationStatus: "APPROVED",
    locationCount: 1,
    activeLocationCount: 1,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO
  };
  const hostDetail: AdminHostDirectoryDetail = {
    ...hostItem,
    taxIdentifier: "TIN-778899",
    addressLine1: "14 York Street",
    addressLine2: "Fort",
    postalCode: "00100",
    countryCode: "LK",
    latestVerification: verifDetail,
    locations: [
      {
        id: LOC_ID,
        name: "York Arcade Storage",
        city: "Colombo",
        status: "PENDING_REVIEW",
        bookingMode: "INSTANT",
        updatedAt: NOW_ISO
      }
    ]
  };
  qc.setQueryData(
    adminQueryKeys.hosts({ page: 1, limit: 20, status: undefined, search: undefined }),
    {
      hosts: [hostItem],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
    }
  );
  qc.setQueryData(adminQueryKeys.hostDetail(BIZ_ID), hostDetail);

  const locQueueItem: LocationModerationQueueItem = {
    locationId: LOC_ID,
    businessId: BIZ_ID,
    businessName: "Fort Depot",
    legalBusinessName: "Ceylon Fort Depot Pvt Ltd",
    businessStatus: "ACTIVE",
    ownerEmail: "owner@fortdepot.lk",
    ownerDisplayName: "Kasun Silva",
    name: "York Arcade Storage",
    city: "Colombo",
    addressLine1: "14 York Street",
    status: "PENDING_REVIEW",
    imageCount: 1,
    submittedAt: NOW_ISO
  };
  qc.setQueryData(
    adminQueryKeys.locationModeration({ page: 1, limit: 20, status: "PENDING_REVIEW" }),
    { queue: [locQueueItem], total: 1 }
  );

  const locDetail: StorageLocation = {
    id: LOC_ID,
    businessId: BIZ_ID,
    name: "York Arcade Storage",
    description: "24/7 guarded storage beside Colombo Fort Rail.",
    addressLine1: "14 York Street",
    addressLine2: "Suite 2",
    city: "Colombo",
    postalCode: "00100",
    countryCode: "LK",
    latitude: 6.9334,
    longitude: 79.8442,
    timezone: "Asia/Colombo",
    bookingMode: "INSTANT",
    acceptsOversized: true,
    amenities: ["CCTV", "STAFF_ON_DUTY"],
    status: "PENDING_REVIEW",
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    images: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
        locationId: LOC_ID,
        fileKey: "locations/york.jpg",
        url: "https://cdn.example.com/york.jpg",
        mediaType: "IMAGE",
        caption: "Front Vault Counter",
        isPrimary: true,
        sortOrder: 0,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO
      }
    ],
    zones: [],
    openingHours: [],
    exceptions: []
  };
  const pools: StorageCapacityPool[] = [
    {
      id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc2",
      locationId: LOC_ID,
      zoneId: null,
      poolType: "SHARED",
      dedicatedBagCategory: null,
      totalUnits: 30,
      isActive: true,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO
    }
  ];
  const pricing: PricingPolicy = {
    id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
    locationId: LOC_ID,
    currency: "LKR",
    pricingUnit: "CALENDAR_DAY",
    baseRateMinor: 120000,
    status: "ACTIVE",
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    tierRates: []
  };
  qc.setQueryData(adminQueryKeys.locationDetail(LOC_ID), locDetail);
  qc.setQueryData(adminQueryKeys.locationPools(LOC_ID), pools);
  qc.setQueryData(adminQueryKeys.locationPricing(LOC_ID), pricing);

  const bookingDetail: BookingDetail = {
    id: BOOKING_ID,
    referenceCode: "LS-2027-7701",
    travellerUserId: TARGET_USER_ID,
    travellerDisplayName: "Meena Fernando",
    travellerEmailMasked: "me***@example.com",
    businessId: BIZ_ID,
    businessName: "Fort Depot",
    locationId: LOC_ID,
    bookingMode: "INSTANT",
    status: "CONFIRMED",
    dropOffAt: NOW_ISO,
    collectionAt: "2027-02-01T18:00:00.000Z",
    totalBags: 1,
    totalCapacityUnits: 1,
    currency: "LKR",
    totalAmountMinor: 120000,
    holdExpiresAt: null,
    confirmedAt: NOW_ISO,
    checkedInAt: null,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    hostRejectionReason: null,
    exceptionReason: null,
    travellerNotes: null,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    location: {
      id: LOC_ID,
      name: "York Arcade Storage",
      city: "Colombo",
      countryCode: "LK",
      timezone: "Asia/Colombo",
      approximateArea: "Fort",
      approximateLatitude: 6.933,
      approximateLongitude: 79.844,
      addressDisclosed: true,
      addressLine1: "14 York Street",
      addressLine2: null,
      postalCode: "00100",
      directionsNotes: null,
      exactLatitude: 6.9334,
      exactLongitude: 79.8442
    },
    items: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc4",
        bookingId: BOOKING_ID,
        bagCategory: "BAG_MEDIUM",
        quantity: 1,
        capacityUnits: 1,
        unitRateMinor: 120000,
        lineTotalMinor: 120000
      }
    ],
    pricingSnapshot: null,
    paymentSummary: null,
    refundSummary: null,
    custodySummary: null,
    statusHistory: []
  };
  const custodyDetail: CustodyRecordDetail = {
    id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc5",
    bookingId: BOOKING_ID,
    referenceCode: "LS-2027-7701",
    locationId: LOC_ID,
    businessId: BIZ_ID,
    status: "IN_STORAGE",
    expectedBagCount: 1,
    checkedInBagCount: 1,
    releasedBagCount: null,
    zoneId: null,
    checkInAt: NOW_ISO,
    checkInStaffUserId: null,
    checkOutAt: null,
    checkOutStaffUserId: null,
    handoverCondition: "NORMAL",
    overdueMinutes: 0,
    overdueFeeMinor: 0,
    exceptionNotes: null,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    bags: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc6",
        custodyRecordId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc5",
        bagTagCode: "TAG-INIT5-01",
        bagCategory: "BAG_MEDIUM",
        securitySealNumber: "SEAL-99881",
        zoneId: null,
        photoFileKey: "custody/bag1.jpg",
        photoDownloadUrl: "https://cdn.example.com/signed-bag1.jpg",
        conditionNotes: "Intact hardshell suitcase",
        checkedInAt: NOW_ISO,
        releasedAt: null
      }
    ],
    events: []
  };
  qc.setQueryData(
    adminQueryKeys.bookings({ page: 1, limit: 20, status: undefined, search: undefined }),
    { bookings: [bookingDetail], total: 1 }
  );
  qc.setQueryData(adminQueryKeys.bookingDetail(BOOKING_ID), bookingDetail);
  qc.setQueryData(adminQueryKeys.custodyDetail(BOOKING_ID), custodyDetail);

  const failedRefund: RefundRecord = {
    id: REFUND_FAILED_ID,
    bookingId: BOOKING_ID,
    referenceCode: "LS-2027-7701",
    paymentIntentId: null,
    amountMinor: 120000,
    currency: "LKR",
    refundPercentage: 100,
    reasonCategory: "TRAVELLER_CANCELLATION",
    status: "FAILED",
    settlementMode: null,
    providerRefundId: null,
    manualReference: null,
    requestedByUserId: TARGET_USER_ID,
    authorizedByUserId: SUPER_USER_ID,
    settledByUserId: null,
    notes: "Gateway timeout",
    completedAt: null,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO
  };
  qc.setQueryData(
    adminQueryKeys.refunds({ page: 1, limit: 20, status: undefined, bookingId: undefined }),
    { refunds: [failedRefund], total: 1 }
  );

  qc.setQueryData(
    adminQueryKeys.ledger({
      page: 1,
      limit: 25,
      accountCode: undefined,
      bookingId: undefined,
      businessId: undefined
    }),
    {
      entries: [],
      totals: { currency: "LKR", totalDebitsMinor: 0, totalCreditsMinor: 0, isBalanced: true },
      pagination: { page: 1, limit: 25, total: 0, totalPages: 1 }
    }
  );

  const auditEvent: SecurityAuditEvent = {
    id: AUDIT_EVENT_ID,
    userId: SUPER_USER_ID,
    eventType: "HOST_BUSINESS_SUSPENDED",
    ipAddress: "203.94.12.5",
    userAgent: "Mozilla/5.0",
    metadata: { businessId: BIZ_ID, reason: "Compliance hold" },
    createdAt: NOW_ISO
  };
  qc.setQueryData(adminQueryKeys.auditEvents({ page: 1, limit: 25 }), {
    items: [auditEvent],
    pagination: { page: 1, limit: 25, total: 1, totalPages: 1 }
  });
  qc.setQueryData(adminQueryKeys.auditEventDetail(AUDIT_EVENT_ID), auditEvent);

  const userSummary: AdminUserSummary = {
    id: TARGET_USER_ID,
    email: "kasun@fortdepot.lk",
    displayName: "Kasun Silva",
    phoneNumber: "+94771234567",
    status: "ACTIVE",
    isEmailVerified: true,
    isPhoneVerified: true,
    roles: ["HOST_OWNER", "TRAVELLER"],
    lastLoginAt: NOW_ISO,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO
  };
  const userDetail: AdminUserDetail = {
    ...userSummary,
    normalizedEmail: "kasun@fortdepot.lk",
    passwordChangedAt: null,
    activeSessionCount: 2,
    travellerProfile: null,
    hostProfile: null
  };
  const roleRow: RoleDetail = {
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
    code: "SUPERADMIN",
    name: "Superadmin",
    description: "Full platform governance",
    isSystem: true,
    permissions: ["admin.user.read", "admin.role.assign"],
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO
  };
  qc.setQueryData(
    adminQueryKeys.users({
      page: 1,
      limit: 20,
      status: undefined,
      role: undefined,
      search: undefined
    }),
    { users: [userSummary], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }
  );
  qc.setQueryData(adminQueryKeys.roles(), [roleRow]);
  qc.setQueryData(adminQueryKeys.permissions(), []);
  qc.setQueryData(adminQueryKeys.userDetail(TARGET_USER_ID), userDetail);
  qc.setQueryData(adminQueryKeys.userPermissions(TARGET_USER_ID), {
    userId: TARGET_USER_ID,
    roles: ["HOST_OWNER", "TRAVELLER"],
    permissions: ["hosts.business.read_own"]
  });

  return qc;
}

describe("Initiative 5 — Web Admin Moderation Drawers, Refund Recovery, Audit Trail & User RBAC", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearAccessToken();
    Object.assign(useAuthStore.getInitialState(), ORIGINAL_AUTH_INITIAL_STATE);
    useAuthStore.setState(ORIGINAL_AUTH_INITIAL_STATE);
  });

  it("1. wires authApi and marketplaceApi admin governance wrappers with correct endpoints and 404 custody handling", async () => {
    setAccessToken("superadmin-jwt");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            currency: "LKR",
            activeUsersCount: 10,
            activeBusinessesCount: 2,
            suspendedBusinessesCount: 0,
            activeLocationsCount: 4,
            pendingVerificationsCount: 1,
            pendingLocationsCount: 1,
            activeBookingsCount: 2,
            disputedBookingsCount: 0,
            openRefundsCount: 0,
            grossCapturedVolumeMinor: 100000,
            platformCommissionMinor: 15000,
            unearnedBookingLiabilityMinor: 0,
            eligibleHostPayablesMinor: 85000
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { queue: [], total: 0 }
        })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          error: { code: "NOT_FOUND", message: "No custody record yet" }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { roles: [] }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const summary = await marketplaceApi.getAdminMetricsSummary();
    expect(summary.grossCapturedVolumeMinor).toBe(100000);

    await authApi.listAdminUsers({ status: "ACTIVE", page: 1, limit: 20 });
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/admin/users?page=1&limit=20&status=ACTIVE"),
      expect.anything()
    );

    await marketplaceApi.getPendingVerifications({ page: 1, limit: 20, status: "APPROVED" });
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/admin/verifications?page=1&limit=20&status=APPROVED"),
      expect.anything()
    );

    const missingCustody = await marketplaceApi.getAdminCustodyDetailOrNull(BOOKING_ID);
    expect(missingCustody).toBeNull();

    const roles = await authApi.listAdminRoles();
    expect(roles).toEqual([]);
  });

  it("2. enforces strict SUPPORT vs SUPERADMIN nav visibility, /admin redirect, and mutation gating", () => {
    const qc = createSeededAdminQueryClient();
    const { user: supportUser, permissions: supportPermissions } = makeSupportUser();
    setAuthSession(supportUser, supportPermissions);

    const supportRedirectHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin"]}>
          <Routes>
            <Route path="/admin" element={<AdminDashboardLayout />}>
              <Route index element={<AdminCommandDashboardPage />} />
              <Route path="bookings" element={<AdminGlobalBookingsLedgerPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    // SUPPORT hitting /admin redirects via <Navigate to="/admin/bookings" /> (renders empty during SSR)
    expect(supportRedirectHtml).toBe("");

    const supportBookingHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/admin/bookings/${BOOKING_ID}`]}>
          <Routes>
            <Route path="/admin" element={<AdminDashboardLayout />}>
              <Route path="bookings/:id" element={<AdminGlobalBookingsLedgerPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(supportBookingHtml).toContain("Authenticated Role: SUPPORT");
    expect(supportBookingHtml).toContain("lucide-lock");
    expect(supportBookingHtml).toContain("Read-Only Support View");
    expect(supportBookingHtml).not.toContain("Admin Cancel Booking");

    setAuthSession(makeSuperUser(), Object.values(SYSTEM_PERMISSIONS));
    const superBookingHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/admin/bookings/${BOOKING_ID}`]}>
          <Routes>
            <Route path="/admin" element={<AdminDashboardLayout />}>
              <Route path="bookings/:id" element={<AdminGlobalBookingsLedgerPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(superBookingHtml).toContain("Authenticated Role: SUPERADMIN");
    expect(superBookingHtml).not.toContain("lucide-lock");
    expect(superBookingHtml).toContain("Admin Cancel Booking");
  });

  it("3. renders KYC, Host Directory, Location Moderation, and Booking-Custody inspection drawers from seeded cache", () => {
    const qc = createSeededAdminQueryClient();
    setAuthSession(makeSuperUser(), Object.values(SYSTEM_PERMISSIONS));

    const kycHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/admin/hosts/review?inspect=${VERIF_ID}`]}>
          <Routes>
            <Route path="/admin/hosts/review" element={<AdminHostVerificationQueuePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(kycHtml).toContain("PV-445566");
    expect(kycHtml).toContain("fort-br.pdf");
    expect(kycHtml).toContain("Open Protected Document");
    expect(kycHtml).toContain("Approve Partner KYC");

    const hostDirHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/admin/hosts?inspect=${BIZ_ID}`]}>
          <Routes>
            <Route path="/admin/hosts" element={<AdminHostDirectoryManagementPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(hostDirHtml).toContain("Ceylon Fort Depot Pvt Ltd");
    expect(hostDirHtml).toContain("Suspend Host Business");
    expect(hostDirHtml).toContain("/admin/hosts/review");
    expect(hostDirHtml).not.toContain("/admin/hosts/verification");

    const locModHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/admin/locations?inspect=${LOC_ID}`]}>
          <Routes>
            <Route path="/admin/locations" element={<AdminStorageLocationModerationPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(locModHtml).toContain("14 York Street");
    expect(locModHtml).toContain("6.933400");
    expect(locModHtml).toContain("79.844200");
    expect(locModHtml).toContain("Approve Location");

    const bookingCustodyHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/admin/bookings/${BOOKING_ID}`]}>
          <Routes>
            <Route path="/admin/bookings/:id" element={<AdminGlobalBookingsLedgerPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(bookingCustodyHtml).toContain("TAG-INIT5-01");
    expect(bookingCustodyHtml).toContain("SEAL-99881");
    expect(bookingCustodyHtml).toContain("View Evidence Photo");
  });

  it("4. renders non-linear refund recovery, clean empty states, audit drawer, users RBAC, and zero developer codes", () => {
    const qc = createSeededAdminQueryClient();
    setAuthSession(makeSuperUser(), Object.values(SYSTEM_PERMISSIONS));

    const refundHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/refunds"]}>
          <Routes>
            <Route path="/admin/refunds" element={<AdminRefundManagementQueuePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(refundHtml).toContain("Recover to AUTHORIZED");
    expect(refundHtml).toContain("Transition to MANUAL_REVIEW_REQUIRED");

    const ledgerHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/finance/ledger"]}>
          <Routes>
            <Route path="/admin/finance/ledger" element={<AdminDoubleEntryFinancialLedgerPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(ledgerHtml).toContain("non-escrow marketplace settlement ledger");
    expect(ledgerHtml).toContain("PLATFORM_CLEARING_RECEIVABLE");
    expect(ledgerHtml).not.toContain("JRN-901");

    const auditHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/admin/audit?inspect=${AUDIT_EVENT_ID}`]}>
          <Routes>
            <Route path="/admin/audit" element={<AdminSecurityComplianceAuditLogPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(auditHtml).toContain("HOST_BUSINESS_SUSPENDED");
    expect(auditHtml).toContain("203.94.12.5");
    expect(auditHtml).not.toContain("[AUTH_LOGIN_SUCCESS]");

    const usersHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/admin/staff?inspect=${TARGET_USER_ID}`]}>
          <Routes>
            <Route path="/admin/staff" element={<AdminStaffRbacManagementPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(usersHtml).toContain("kasun@fortdepot.lk");
    expect(usersHtml).toContain("Assign Role");
    expect(usersHtml).toContain("Revoke");

    const liveSupportHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/support"]}>
          <Routes>
            <Route path="/admin/support" element={<AdminSupportTicketTriageQueuePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(liveSupportHtml).not.toContain("#TKT-9042");

    for (const html of [refundHtml, ledgerHtml, auditHtml, usersHtml, liveSupportHtml]) {
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("data-screen-id");
    }

    clearAccessToken();
    Object.assign(useAuthStore.getInitialState(), ORIGINAL_AUTH_INITIAL_STATE);
    useAuthStore.setState(ORIGINAL_AUTH_INITIAL_STATE);

    const demoSupportHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/support?preview=demo"]}>
          <Routes>
            <Route path="/admin/support" element={<AdminSupportTicketTriageQueuePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(demoSupportHtml).toContain("#TKT-9042");
  });
});
