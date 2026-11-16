import React from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SYSTEM_PERMISSIONS,
  type AuthenticatedUser,
  type BookingDetail,
  type CustodyRecordDetail,
  type EligibleHostPayablesGroup,
  type HostBusiness,
  type HostFinanceSummaryResponse,
  type PayoutBatchDetail,
  type PayoutBatchSummary,
  type SupportTicketAdminDetail,
  type SupportTicketCustomerDetail,
  type SupportTicketSummary
} from "@luggage-storage/contracts";
import {
  isFeaturePromotionsEnabled,
  isFeatureReviewsEnabled
} from "@/config/feature-flags";
import {
  AdminDashboardLayout,
  AdminHostPayoutBatchGenerationPage,
  AdminIncidentDisputeInvestigationPage,
  AdminManualPayoutDisbursementPage,
  AdminPlatformSystemConfigurationPage,
  AdminPromotionMarketingEnginePage,
  AdminReviewModerationQueuePage,
  AdminSupportTicketResolutionViewPage,
  AdminSupportTicketTriageQueuePage
} from "@/features/admin";
import {
  HostDashboardLayout,
  HostPayoutAccountsHistoryPage
} from "@/features/host";
import { ContactUsPage } from "@/features/traveller/StaticInfoPages";
import { adminQueryKeys, hostQueryKeys, travellerQueryKeys } from "@/hooks/queries/query-keys";
import { clearAccessToken, setAccessToken } from "@/lib/api-client";
import { marketplaceApi } from "@/services/marketplace-api";
import { useAuthStore } from "@/store/useAuthStore";

const FORBIDDEN_DEVELOPER_PATTERN = /\b(PW|HD|AD|TM|HM)-\d{3}\b|\bWF-\d{3}\b|\bOQ-\d{3}\b/;

const SUPER_USER_ID = "11111111-1111-4111-8111-111111111101";
const SUPPORT_USER_ID = "22222222-2222-4222-8222-222222222202";
const OWNER_USER_ID = "33333333-3333-4333-8333-333333333303";
const TRAVELLER_USER_ID = "44444444-4444-4444-8444-444444444404";
const BIZ_ID = "55555555-5555-4555-8555-555555555505";
const LOC_ID = "66666666-6666-4666-8666-666666666606";
const BOOKING_ID = "77777777-7777-4777-8777-777777777707";
const PAYABLE_ID = "88888888-8888-4888-8888-888888888808";
const BATCH_ID = "99999999-9999-4999-8999-999999999909";
const TICKET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const NOW_ISO = "2027-03-01T10:00:00.000Z";

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

function makeUser(role: "SUPERADMIN" | "SUPPORT" | "HOST_OWNER" | "TRAVELLER"): AuthenticatedUser {
  const idMap = {
    SUPERADMIN: SUPER_USER_ID,
    SUPPORT: SUPPORT_USER_ID,
    HOST_OWNER: OWNER_USER_ID,
    TRAVELLER: TRAVELLER_USER_ID
  };
  const perms =
    role === "SUPERADMIN"
      ? Object.values(SYSTEM_PERMISSIONS)
      : role === "SUPPORT"
        ? [
            SYSTEM_PERMISSIONS.ADMIN_HOST_READ,
            SYSTEM_PERMISSIONS.ADMIN_LOCATION_READ,
            SYSTEM_PERMISSIONS.ADMIN_BOOKING_READ,
            SYSTEM_PERMISSIONS.ADMIN_PAYMENT_READ,
            SYSTEM_PERMISSIONS.ADMIN_REFUND_READ,
            SYSTEM_PERMISSIONS.ADMIN_USER_READ,
            SYSTEM_PERMISSIONS.SUPPORT_TICKET_READ,
            SYSTEM_PERMISSIONS.SUPPORT_TICKET_UPDATE
          ]
        : role === "HOST_OWNER"
          ? [
              SYSTEM_PERMISSIONS.HOSTS_BOOKINGS_READ_OWN,
              SYSTEM_PERMISSIONS.HOSTS_FINANCE_READ_OWN
            ]
          : [SYSTEM_PERMISSIONS.BOOKINGS_READ_OWN];

  return {
    id: idMap[role],
    email: `${role.toLowerCase()}@luggagestorage.lk`,
    displayName: `Test ${role}`,
    status: "ACTIVE",
    isEmailVerified: true,
    isPhoneVerified: true,
    roles: [role],
    permissions: perms,
    lastLoginAt: NOW_ISO
  };
}

function createSeededInitiative6QueryClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } }
  });

  const eligibleGroup: EligibleHostPayablesGroup = {
    businessId: BIZ_ID,
    legalBusinessName: "Trincomalee Maritime Storage Pvt Ltd",
    tradeName: "Trinco Harbor Concierge",
    payoutBankName: "Commercial Bank of Ceylon PLC",
    payoutBranchCode: "001",
    payoutAccountName: "Trinco Harbor Concierge",
    payoutAccountMasked: "••••••4756",
    currency: "LKR",
    eligibleCount: 1,
    totalGrossMinor: 120000,
    totalCommissionMinor: 18000,
    totalNetPayableMinor: 102000,
    payables: [
      {
        id: PAYABLE_ID,
        businessId: BIZ_ID,
        businessName: "Trinco Harbor Concierge",
        bookingId: BOOKING_ID,
        referenceCode: "LSB-20270301-TRN01",
        grossSubtotalMinor: 120000,
        commissionMinor: 18000,
        netPayableMinor: 102000,
        currency: "LKR",
        status: "ELIGIBLE",
        accruedAt: NOW_ISO,
        eligibleAt: NOW_ISO,
        updatedAt: NOW_ISO
      }
    ]
  };
  qc.setQueryData(adminQueryKeys.eligiblePayables(undefined), [eligibleGroup]);

  const batchSummary: PayoutBatchSummary = {
    id: BATCH_ID,
    batchCode: "PB-20270301-TRN01",
    businessId: BIZ_ID,
    businessName: "Trinco Harbor Concierge",
    legalBusinessName: "Trincomalee Maritime Storage Pvt Ltd",
    currency: "LKR",
    itemCount: 1,
    totalGrossMinor: 120000,
    totalCommissionMinor: 18000,
    totalNetPayableMinor: 102000,
    status: "GENERATED",
    payoutBankName: "Commercial Bank of Ceylon PLC",
    payoutBranchCode: "001",
    payoutAccountName: "Trinco Harbor Concierge",
    payoutAccountMasked: "••••••4756",
    payoutMethod: "CEFT_SLIPS",
    payoutReference: null,
    notes: "Weekly Friday Run",
    ledgerTransactionGroupId: null,
    generatedByUserId: SUPER_USER_ID,
    disbursedByUserId: null,
    disbursedAt: null,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO
  };

  const batchDetail: PayoutBatchDetail = {
    ...batchSummary,
    items: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
        batchId: BATCH_ID,
        payableId: PAYABLE_ID,
        bookingId: BOOKING_ID,
        referenceCode: "LSB-20270301-TRN01",
        grossSubtotalMinor: 120000,
        commissionMinor: 18000,
        netPayableMinor: 102000,
        currency: "LKR",
        payableStatus: "ELIGIBLE",
        createdAt: NOW_ISO
      }
    ]
  };

  qc.setQueryData(adminQueryKeys.payoutBatches({ page: 1, limit: 10 }), {
    batches: [batchSummary],
    total: 1,
    pagination: { page: 1, limit: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false }
  });
  qc.setQueryData(
    adminQueryKeys.payoutBatches({ page: 1, limit: 20, status: undefined }),
    {
      batches: [batchSummary],
      total: 1,
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false }
    }
  );
  qc.setQueryData(adminQueryKeys.payoutBatchDetail(BATCH_ID), batchDetail);

  const disputedBooking: BookingDetail = {
    id: BOOKING_ID,
    referenceCode: "LSB-20270301-TRN01",
    travellerUserId: TRAVELLER_USER_ID,
    travellerDisplayName: "Nadeesha Perera",
    travellerEmailMasked: "na***@example.com",
    businessId: BIZ_ID,
    businessName: "Trinco Harbor Concierge",
    locationId: LOC_ID,
    bookingMode: "INSTANT",
    status: "DISPUTED",
    dropOffAt: NOW_ISO,
    collectionAt: "2027-03-01T18:00:00.000Z",
    totalBags: 1,
    totalCapacityUnits: 1,
    currency: "LKR",
    totalAmountMinor: 120000,
    holdExpiresAt: null,
    confirmedAt: NOW_ISO,
    checkedInAt: NOW_ISO,
    completedAt: NOW_ISO,
    cancelledAt: null,
    cancellationReason: null,
    hostRejectionReason: null,
    exceptionReason: "[DAMAGE_REPORTED] Zipper puller broken at counter pickup",
    travellerNotes: null,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    location: {
      id: LOC_ID,
      name: "Dockyard Road Vault",
      city: "Trincomalee",
      countryCode: "LK",
      timezone: "Asia/Colombo",
      approximateArea: "Trincomalee Harbour",
      approximateLatitude: 8.57,
      approximateLongitude: 81.23,
      addressDisclosed: true,
      addressLine1: "42 Dockyard Road",
      addressLine2: null,
      postalCode: "31000",
      directionsNotes: null,
      exactLatitude: 8.5711,
      exactLongitude: 81.2335
    },
    items: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc2",
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

  const disputedCustody: CustodyRecordDetail = {
    id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
    bookingId: BOOKING_ID,
    referenceCode: "LSB-20270301-TRN01",
    locationId: LOC_ID,
    businessId: BIZ_ID,
    status: "DISPUTED_RELEASE",
    expectedBagCount: 1,
    checkedInBagCount: 1,
    releasedBagCount: 1,
    zoneId: null,
    checkInAt: NOW_ISO,
    checkInStaffUserId: null,
    checkOutAt: NOW_ISO,
    checkOutStaffUserId: null,
    handoverCondition: "EXCEPTION_RECORDED",
    overdueMinutes: 0,
    overdueFeeMinor: 0,
    exceptionNotes: "Seal intact; zipper puller reported loose",
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    bags: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc4",
        custodyRecordId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
        bagTagCode: "TRN-SEAL-441",
        bagCategory: "BAG_MEDIUM",
        securitySealNumber: "SEAL-TRN-901",
        zoneId: null,
        photoFileKey: "custody/trn-bag.jpg",
        photoDownloadUrl: "https://cdn.example.com/signed-trn-bag.jpg",
        conditionNotes: "Side handle intact",
        checkedInAt: NOW_ISO,
        releasedAt: NOW_ISO
      }
    ],
    events: []
  };

  qc.setQueryData(
    adminQueryKeys.bookings({ page: 1, limit: 20, status: "DISPUTED" }),
    { bookings: [disputedBooking], total: 1 }
  );
  qc.setQueryData(adminQueryKeys.bookingDetail(BOOKING_ID), disputedBooking);
  qc.setQueryData(adminQueryKeys.custodyDetail(BOOKING_ID), disputedCustody);

  const ticketSummary: SupportTicketSummary = {
    id: TICKET_ID,
    referenceCode: "SUP-20270301-ABC123",
    requesterUserId: TRAVELLER_USER_ID,
    requesterName: "Nadeesha Perera",
    requesterEmail: "nadeesha@example.com",
    category: "CUSTODY_INCIDENT",
    priority: "HIGH",
    status: "OPEN",
    subject: "Delayed ferry arrival before Trincomalee pickup",
    bookingReferenceInput: "LSB-20270301-TRN01",
    bookingId: BOOKING_ID,
    assignedToUserId: SUPPORT_USER_ID,
    assignedToDisplayName: "Test SUPPORT",
    resolutionSummary: null,
    resolvedAt: null,
    lastMessageAt: NOW_ISO,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO
  };

  const adminTicketDetail: SupportTicketAdminDetail = {
    ...ticketSummary,
    linkedBooking: {
      id: BOOKING_ID,
      referenceCode: "LSB-20270301-TRN01",
      status: "DISPUTED",
      totalAmountMinor: 120000,
      currency: "LKR",
      locationName: "Dockyard Road Vault",
      businessName: "Trinco Harbor Concierge"
    },
    messages: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc5",
        ticketId: TICKET_ID,
        senderUserId: TRAVELLER_USER_ID,
        senderRole: "TRAVELLER",
        senderDisplayName: "Nadeesha Perera",
        body: "Will the counter remain available until 19:00?",
        isInternalNote: false,
        createdAt: NOW_ISO
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc6",
        ticketId: TICKET_ID,
        senderUserId: SUPPORT_USER_ID,
        senderRole: "SUPPORT",
        senderDisplayName: "Test SUPPORT",
        body: "Called Trinco desk; confirmed late counter coverage.",
        isInternalNote: true,
        createdAt: NOW_ISO
      }
    ]
  };

  const customerTicketDetail: SupportTicketCustomerDetail = {
    ...ticketSummary,
    assignedToUserId: null,
    assignedToDisplayName: null,
    messages: [adminTicketDetail.messages[0]]
  };

  qc.setQueryData(
    adminQueryKeys.supportTickets({
      page: 1,
      limit: 20,
      status: undefined,
      priority: undefined,
      category: undefined,
      search: undefined
    }),
    {
      tickets: [ticketSummary],
      total: 1,
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false }
    }
  );
  qc.setQueryData(adminQueryKeys.supportTicketDetail(TICKET_ID), adminTicketDetail);
  qc.setQueryData(travellerQueryKeys.supportTickets(), [ticketSummary]);
  qc.setQueryData(travellerQueryKeys.supportTicketDetail(TICKET_ID), customerTicketDetail);

  const hostBusiness: HostBusiness = {
    id: BIZ_ID,
    ownerUserId: OWNER_USER_ID,
    legalBusinessName: "Trincomalee Maritime Storage Pvt Ltd",
    tradeName: "Trinco Harbor Concierge",
    businessRegistrationNumber: "PV-990011",
    entityType: "PRIVATE_LIMITED",
    taxIdentifier: null,
    contactEmail: "desk@trincoconcierge.lk",
    contactPhone: "+94772345678",
    addressLine1: "42 Dockyard Road",
    addressLine2: null,
    city: "Trincomalee",
    postalCode: "31000",
    countryCode: "LK",
    payoutBankName: "Commercial Bank of Ceylon PLC",
    payoutBranchCode: "001",
    payoutAccountName: "Trinco Harbor Concierge",
    payoutAccountNumberMasked: "••••••4756",
    status: "ACTIVE",
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO
  };

  const disbursedHostBatch: PayoutBatchSummary = {
    ...batchSummary,
    status: "DISBURSED",
    payoutReference: "CEFT-TRN-88001",
    disbursedByUserId: SUPER_USER_ID,
    disbursedAt: NOW_ISO,
    ledgerTransactionGroupId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1"
  };

  const hostFinanceSummary: HostFinanceSummaryResponse = {
    currency: "LKR",
    totalAccruedMinor: 0,
    totalEligibleMinor: 0,
    totalOnHoldMinor: 0,
    totalPaidMinor: 102000,
    payables: [{ ...eligibleGroup.payables[0], status: "PAID" }]
  };

  qc.setQueryData(hostQueryKeys.businesses(), [hostBusiness]);
  qc.setQueryData(hostQueryKeys.payoutDetails(BIZ_ID), {
    payoutBankName: "Commercial Bank of Ceylon PLC",
    payoutBranchCode: "001",
    payoutAccountName: "Trinco Harbor Concierge",
    payoutAccountNumberMasked: "••••••4756",
    payoutAccountNumber: null
  });
  qc.setQueryData(hostQueryKeys.financeSummary(BIZ_ID), hostFinanceSummary);
  qc.setQueryData(hostQueryKeys.payoutBatches(BIZ_ID), [disbursedHostBatch]);

  return qc;
}

describe("Initiative 6 — Dispute Adjudication, Payout Batches, Support Desk, Feature Gating & E2E Acceptance", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearAccessToken();
    Object.assign(useAuthStore.getInitialState(), ORIGINAL_AUTH_INITIAL_STATE);
    useAuthStore.setState(ORIGINAL_AUTH_INITIAL_STATE);
  });

  it("1. exercises Initiative 6 marketplaceApi client wrappers across disputes, payouts, host batches, and support tickets", async () => {
    setAccessToken("superadmin-jwt");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { id: BOOKING_ID, status: "COMPLETED" } })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { groups: [] } })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: { id: BATCH_ID, batchCode: "PB-20270301-TRN01", status: "GENERATED" }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { id: BATCH_ID, batchCode: "PB-20270301-TRN01", status: "DISBURSED" }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { batches: [] } })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: { id: TICKET_ID, referenceCode: "SUP-20270301-ABC123", status: "OPEN" }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { tickets: [] } })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 1, hasNext: false, hasPrev: false }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { id: TICKET_ID, status: "RESOLVED" } })
      });
    vi.stubGlobal("fetch", fetchMock);

    const resolved = await marketplaceApi.adminResolveBookingDispute(BOOKING_ID, {
      outcome: "UPHOLD_HOST",
      notes: "Seal intact on arrival"
    });
    expect(resolved.status).toBe("COMPLETED");

    const groups = await marketplaceApi.getAdminEligiblePayables(BIZ_ID);
    expect(groups).toEqual([]);

    const batch = await marketplaceApi.createAdminPayoutBatch({
      businessId: BIZ_ID,
      payoutMethod: "CEFT_SLIPS"
    });
    expect(batch.status).toBe("GENERATED");

    const disbursed = await marketplaceApi.disburseAdminPayoutBatch(BATCH_ID, {
      payoutReference: "CEFT-9012"
    });
    expect(disbursed.status).toBe("DISBURSED");

    const hostBatches = await marketplaceApi.getHostPayoutBatches(BIZ_ID);
    expect(hostBatches).toEqual([]);

    const createdTicket = await marketplaceApi.createSupportTicket({
      requesterName: "Nadeesha",
      requesterEmail: "nadeesha@example.com",
      category: "GENERAL_INQUIRY",
      subject: "Question about storage",
      message: "Can I update my drop-off window by one hour?"
    });
    expect(createdTicket.referenceCode).toBe("SUP-20270301-ABC123");

    const myTickets = await marketplaceApi.getMySupportTickets();
    expect(myTickets).toEqual([]);

    const adminTickets = await marketplaceApi.getAdminSupportTickets({ status: "OPEN" });
    expect(adminTickets.tickets).toEqual([]);

    const patched = await marketplaceApi.updateAdminSupportTicket(TICKET_ID, {
      status: "RESOLVED"
    });
    expect(patched.status).toBe("RESOLVED");
  });

  it("2. enforces feature flag evaluation and hides post-MVP Reviews/Promotions in live authenticated sidebars", () => {
    expect(isFeatureReviewsEnabled({})).toBe(false);
    expect(isFeaturePromotionsEnabled({})).toBe(false);
    expect(isFeatureReviewsEnabled({ VITE_FEATURE_REVIEWS: "true" })).toBe(true);
    expect(isFeaturePromotionsEnabled({ VITE_FEATURE_PROMOTIONS: "1" })).toBe(true);

    const qc = createSeededInitiative6QueryClient();

    // Live SUPERADMIN layout hides Review Moderation & Promotions Engine, with zero lock icons
    const superUser = makeUser("SUPERADMIN");
    setAuthSession(superUser, superUser.permissions!);
    const adminLiveHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/settings"]}>
          <Routes>
            <Route path="/admin" element={<AdminDashboardLayout />}>
              <Route path="settings" element={<AdminPlatformSystemConfigurationPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(adminLiveHtml).not.toContain("Review Moderation");
    expect(adminLiveHtml).not.toContain("Promotions Engine");
    expect(adminLiveHtml).not.toContain("lucide-lock");

    // Live HOST_OWNER layout hides Customer Reviews when VITE_FEATURE_REVIEWS is disabled
    const ownerUser = makeUser("HOST_OWNER");
    setAuthSession(ownerUser, ownerUser.permissions!);
    const hostLiveHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/host/payouts"]}>
          <Routes>
            <Route path="/host" element={<HostDashboardLayout />}>
              <Route path="payouts" element={<HostPayoutAccountsHistoryPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(hostLiveHtml).not.toContain("Customer Reviews");
    expect(hostLiveHtml).toContain("Settlement Payout Batches");
    expect(hostLiveHtml).toContain("PB-20270301-TRN01");
    expect(hostLiveHtml).toContain("CEFT-TRN-88001");
  });

  it("3. renders live AD-008, AD-009, AD-011, AD-012, AD-013 (SUPERADMIN vs SUPPORT RBAC), AD-014..AD-016 & PW-009 cleanly", () => {
    const qc = createSeededInitiative6QueryClient();

    const superUser = makeUser("SUPERADMIN");
    setAuthSession(superUser, superUser.permissions!);

    const batchGenHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/payouts/batches"]}>
          <Routes>
            <Route path="/admin/payouts/batches" element={<AdminHostPayoutBatchGenerationPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(batchGenHtml).toContain("Trinco Harbor Concierge");
    expect(batchGenHtml).toContain("••••••4756");
    expect(batchGenHtml).toContain("Generate Payout Batch");

    const disburseHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/admin/payouts/disburse?batch=${BATCH_ID}`]}>
          <Routes>
            <Route path="/admin/payouts/disburse" element={<AdminManualPayoutDisbursementPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(disburseHtml).toContain("PB-20270301-TRN01");
    expect(disburseHtml).toContain("Record Manual Bank Wire / CEFT Proof");
    expect(disburseHtml).toContain("LSB-20270301-TRN01");

    const supportQueueHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/support"]}>
          <Routes>
            <Route path="/admin/support" element={<AdminSupportTicketTriageQueuePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(supportQueueHtml).toContain("SUP-20270301-ABC123");
    expect(supportQueueHtml).toContain("Delayed ferry arrival before Trincomalee pickup");
    expect(supportQueueHtml).not.toContain("#TKT-9042");

    const supportDetailHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/admin/support/${TICKET_ID}`]}>
          <Routes>
            <Route
              path="/admin/support/:id"
              element={<AdminSupportTicketResolutionViewPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(supportDetailHtml).toContain("Internal Support Note");
    expect(supportDetailHtml).toContain("Called Trinco desk; confirmed late counter coverage.");
    expect(supportDetailHtml).toContain("LSB-20270301-TRN01");

    const superIncidentHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/admin/incidents?inspect=${BOOKING_ID}`]}>
          <Routes>
            <Route path="/admin/incidents" element={<AdminIncidentDisputeInvestigationPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(superIncidentHtml).toContain("SEAL-TRN-901");
    expect(superIncidentHtml).toContain("View Evidence Photo");
    expect(superIncidentHtml).toContain("Execute Dispute Ruling");

    const supportUser = makeUser("SUPPORT");
    setAuthSession(supportUser, supportUser.permissions!);
    const supportIncidentHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/admin/incidents?inspect=${BOOKING_ID}`]}>
          <Routes>
            <Route path="/admin/incidents" element={<AdminIncidentDisputeInvestigationPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(supportIncidentHtml).toContain("Read-Only Support View");
    expect(supportIncidentHtml).not.toContain("Execute Dispute Ruling");

    // AD-016 authoritative read-only config + AD-014/AD-015 feature-gated live messages
    setAuthSession(superUser, superUser.permissions!);
    const configHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/settings"]}>
          <Routes>
            <Route path="/admin/settings" element={<AdminPlatformSystemConfigurationPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(configHtml).toContain("15% Commission / 85% Host Share");
    expect(configHtml).toContain("1500 bps");
    expect(configHtml).toContain("STANDARD_FLEX_2H");
    expect(configHtml).toContain("Zero Possessory Lien");
    expect(configHtml).toContain("4010");
    expect(configHtml).not.toContain("<input");
    expect(configHtml).not.toContain("<select");
    expect(configHtml).not.toContain("<textarea");

    const gatedReviewsHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/reviews"]}>
          <Routes>
            <Route path="/admin/reviews" element={<AdminReviewModerationQueuePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(gatedReviewsHtml).toContain("VITE_FEATURE_REVIEWS");

    const gatedPromosHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/promotions"]}>
          <Routes>
            <Route path="/admin/promotions" element={<AdminPromotionMarketingEnginePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(gatedPromosHtml).toContain("VITE_FEATURE_PROMOTIONS");

    const travellerUser = makeUser("TRAVELLER");
    setAuthSession(travellerUser, travellerUser.permissions!);
    const contactHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/contact"]}>
          <Routes>
            <Route path="/contact" element={<ContactUsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(contactHtml).toContain("Submit a Tracked Support Ticket");
    expect(contactHtml).toContain("Your Recent Support Tickets");
    expect(contactHtml).toContain("SUP-20270301-ABC123");

    for (const html of [
      batchGenHtml,
      disburseHtml,
      supportQueueHtml,
      supportDetailHtml,
      superIncidentHtml,
      supportIncidentHtml,
      configHtml,
      gatedReviewsHtml,
      gatedPromosHtml,
      contactHtml
    ]) {
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("data-screen-id");
    }
  });
});
