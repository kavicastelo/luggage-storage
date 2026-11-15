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
  type HostBusiness,
  type HostFinanceSummaryResponse,
  type StorageCapacityPool,
  type StorageLocation,
  type StorageZone
} from "@luggage-storage/contracts";
import {
  HostBookingManagementHubPage,
  HostDashboardLayout,
  HostFinancialRevenueLedgerPage,
  HostOverviewDashboardPage,
  HostPayoutAccountsHistoryPage,
  HostReviewManagementPage,
  HostWebCheckInOutOperationsPage
} from "@/features/host";
import { hostQueryKeys } from "@/hooks/queries/query-keys";
import { executeCounterCustodyHandover } from "@/lib/counter-custody";
import {
  downloadCsvFile,
  escapeCsvCell,
  sanitizeCsvFormula,
  serializeCsv
} from "@/lib/csv-export";
import { useAuthStore } from "@/store/useAuthStore";
import { useHostContextStore } from "@/store/useHostContextStore";

const FORBIDDEN_DEVELOPER_PATTERN = /\b(PW|HD|AD|TM|HM)-\d{3}\b|\bWF-\d{3}\b|\bOQ-\d{3}\b/;
const DEMO_FORBIDDEN_MARKERS = [
  "LS-2026-8841",
  "RACK-A",
  "BATCH-2026-W44",
  "Download Sample PDF",
  "Amaya Perera",
  "Ceylon Transit Hospitality",
  "Roshan Fernando"
];

const BIZ_ID = "11111111-1111-4111-8111-111111111101";
const LOC_ID = "22222222-2222-4222-8222-222222222202";
const ZONE_ID = "33333333-3333-4333-8333-333333333303";
const POOL_ID = "44444444-4444-4444-8444-444444444404";
const BOOKING_OVERDUE_ID = "55555555-5555-4555-8555-555555555505";
const BOOKING_PENDING_PAY_ID = "66666666-6666-4666-8666-666666666606";
const CUSTODY_ID = "77777777-7777-4777-8777-777777777707";
const OWNER_USER_ID = "88888888-8888-4888-8888-888888888808";
const STAFF_USER_ID = "99999999-9999-4999-8999-999999999909";
const TRAVELLER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const NOW_ISO = "2027-02-01T08:00:00.000Z";

const ORIGINAL_AUTH_INITIAL_STATE = { ...useAuthStore.getInitialState() };
const ORIGINAL_HOST_CTX_INITIAL_STATE = { ...useHostContextStore.getInitialState() };

function makeUser(overrides: Partial<AuthenticatedUser> & { roles: string[] }): AuthenticatedUser {
  return {
    id: OWNER_USER_ID,
    email: "owner@galleconcierge.lk",
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

function setAuthSession(user: AuthenticatedUser, permissions: string[] = []) {
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

function setHostContext(patch: { selectedBusinessId?: string; selectedLocationId?: string }) {
  Object.assign(useHostContextStore.getInitialState(), patch);
  useHostContextStore.setState(patch);
}

function makeBookingDetail(overrides: Partial<BookingDetail> & { id: string; referenceCode: string }): BookingDetail {
  return {
    id: overrides.id,
    referenceCode: overrides.referenceCode,
    travellerUserId: TRAVELLER_ID,
    travellerDisplayName: "Anushka Bandara",
    travellerEmailMasked: "an***@example.com",
    businessId: BIZ_ID,
    businessName: "Southern Locker Concierge",
    locationId: LOC_ID,
    bookingMode: "INSTANT",
    status: "IN_STORAGE",
    dropOffAt: "2024-01-10T04:30:00.000Z",
    collectionAt: "2024-01-10T10:30:00.000Z",
    totalBags: 2,
    totalCapacityUnits: 2,
    currency: "LKR",
    totalAmountMinor: 200000,
    holdExpiresAt: null,
    confirmedAt: "2024-01-09T12:00:00.000Z",
    checkedInAt: "2024-01-10T04:35:00.000Z",
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    hostRejectionReason: null,
    exceptionReason: null,
    travellerNotes: null,
    createdAt: "2024-01-09T11:55:00.000Z",
    updatedAt: "2024-01-10T04:35:00.000Z",
    location: {
      id: LOC_ID,
      name: "Pedlar Square Baggage Lounge",
      city: "Galle",
      countryCode: "LK",
      timezone: "Asia/Colombo",
      approximateArea: "Fort Quarter",
      approximateLatitude: 6.027,
      approximateLongitude: 80.217,
      addressDisclosed: true,
      addressLine1: "22 Pedlar Street",
      addressLine2: "Ground Floor",
      postalCode: "80000",
      directionsNotes: "Beside clocktower entrance",
      exactLatitude: 6.0267,
      exactLongitude: 80.217
    },
    items: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
        bookingId: overrides.id,
        bagCategory: "BAG_MEDIUM",
        quantity: 2,
        capacityUnits: 2,
        unitRateMinor: 100000,
        lineTotalMinor: 200000
      }
    ],
    pricingSnapshot: {
      id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd4",
      bookingId: overrides.id,
      policyId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5",
      currency: "LKR",
      currencyExponent: 2,
      pricingUnit: "CALENDAR_DAY",
      baseRateMinor: 100000,
      durationUnits: 1,
      itemsBreakdown: [
        {
          bagCategory: "BAG_MEDIUM",
          quantity: 2,
          capacityUnits: 2,
          unitRateMinor: 100000,
          lineTotalMinor: 200000
        }
      ],
      grossStorageMinor: 200000,
      discountMinor: 0,
      storageSubtotalMinor: 200000,
      commissionRateBps: 1500,
      platformCommissionMinor: 30000,
      hostPayableMinor: 170000,
      taxRateBps: 0,
      taxAmountMinor: 0,
      totalAmountMinor: 200000,
      cancellationPolicyCode: "STANDARD_24H",
      createdAt: "2024-01-09T11:55:00.000Z"
    },
    paymentSummary: {
      intentId: "ffffffff-ffff-4fff-8fff-fffffffffff6",
      provider: "SANDBOX",
      providerOrderId: "SBX-ORD-01",
      status: "SUCCEEDED",
      amountMinor: 200000,
      verifiedAt: "2024-01-09T12:00:00.000Z",
      failureReason: null
    },
    refundSummary: null,
    custodySummary: {
      custodyRecordId: CUSTODY_ID,
      status: "IN_STORAGE",
      expectedBagCount: 2,
      checkedInBagCount: 2,
      releasedBagCount: null,
      checkInAt: "2024-01-10T04:35:00.000Z",
      checkOutAt: null,
      handoverCondition: "NORMAL",
      overdueMinutes: 0,
      overdueFeeMinor: 0
    },
    statusHistory: [
      {
        id: "12121212-1212-4121-8121-121212121210",
        bookingId: overrides.id,
        previousStatus: "CONFIRMED",
        newStatus: "IN_STORAGE",
        actorUserId: STAFF_USER_ID,
        actorRole: "HOST_STAFF",
        reason: "Physical check-in completed",
        metadata: {},
        createdAt: "2024-01-10T04:35:00.000Z"
      }
    ],
    ...overrides
  };
}

function seedHostPortalQueryClient(options?: {
  emptyFinance?: boolean;
  zeroCapacityPool?: boolean;
  redactSnapshotForStaff?: boolean;
}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } }
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
    payoutAccountName: "Galle Fort Luggage Concierge Pvt Ltd",
    payoutBranchCode: "0042",
    status: "ACTIVE",
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO
  };

  const zones: StorageZone[] = [
    {
      id: ZONE_ID,
      locationId: LOC_ID,
      name: "Vault Cage North",
      zoneType: "LOCKED_ROOM",
      securityTier: "HIGH",
      isActive: true,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO
    }
  ];

  const location: StorageLocation = {
    id: LOC_ID,
    businessId: BIZ_ID,
    name: "Pedlar Square Baggage Lounge",
    description: "Insured air-conditioned luggage vault beside clocktower.",
    addressLine1: "22 Pedlar Street",
    addressLine2: "Ground Floor",
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
    amenities: ["CCTV", "STAFF_ON_DUTY"],
    rejectionReason: null,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    images: [],
    zones
  };

  const pools: StorageCapacityPool[] = [
    {
      id: POOL_ID,
      locationId: LOC_ID,
      zoneId: ZONE_ID,
      poolType: "SHARED",
      dedicatedBagCategory: null,
      totalUnits: options?.zeroCapacityPool ? 0 : 20,
      isActive: true,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO
    }
  ];

  const overdueBooking = makeBookingDetail({
    id: BOOKING_OVERDUE_ID,
    referenceCode: "LSB-OVERDUE-01",
    status: "IN_STORAGE",
    collectionAt: "2024-01-10T10:30:00.000Z"
  });

  const pendingPayBooking = makeBookingDetail({
    id: BOOKING_PENDING_PAY_ID,
    referenceCode: "LSB-PENDING-02",
    status: "PENDING_PAYMENT",
    checkedInAt: null,
    custodySummary: null
  });

  if (options?.redactSnapshotForStaff) {
    if (overdueBooking.pricingSnapshot) {
      delete overdueBooking.pricingSnapshot.commissionRateBps;
      delete overdueBooking.pricingSnapshot.platformCommissionMinor;
      delete overdueBooking.pricingSnapshot.hostPayableMinor;
    }
    if (pendingPayBooking.pricingSnapshot) {
      delete pendingPayBooking.pricingSnapshot.commissionRateBps;
      delete pendingPayBooking.pricingSnapshot.platformCommissionMinor;
      delete pendingPayBooking.pricingSnapshot.hostPayableMinor;
    }
  }

  const custodyDetail: CustodyRecordDetail = {
    id: CUSTODY_ID,
    bookingId: BOOKING_OVERDUE_ID,
    referenceCode: "LSB-OVERDUE-01",
    locationId: LOC_ID,
    businessId: BIZ_ID,
    status: "IN_STORAGE",
    expectedBagCount: 2,
    checkedInBagCount: 2,
    releasedBagCount: null,
    zoneId: ZONE_ID,
    checkInAt: "2024-01-10T04:35:00.000Z",
    checkInStaffUserId: STAFF_USER_ID,
    checkOutAt: null,
    checkOutStaffUserId: null,
    handoverCondition: "NORMAL",
    overdueMinutes: 0,
    overdueFeeMinor: 0,
    exceptionNotes: null,
    createdAt: "2024-01-10T04:35:00.000Z",
    updatedAt: "2024-01-10T04:35:00.000Z",
    bags: [
      {
        id: "13131313-1313-4131-8131-131313131313",
        custodyRecordId: CUSTODY_ID,
        bagTagCode: "GAL-001",
        bagCategory: "BAG_MEDIUM",
        securitySealNumber: "SEAL-GL-771",
        zoneId: ZONE_ID,
        photoFileKey: `custody/${BOOKING_OVERDUE_ID}/intake-1.jpg`,
        photoDownloadUrl: `http://localhost:3000/api/v1/uploads/mock-storage/custody/${BOOKING_OVERDUE_ID}/intake-1.jpg?token=mock-read-token`,
        conditionNotes: "All zips intact",
        checkedInAt: "2024-01-10T04:35:00.000Z",
        releasedAt: null
      }
    ],
    events: [
      {
        id: "14141414-1414-4141-8141-141414141414",
        custodyRecordId: CUSTODY_ID,
        bookingId: BOOKING_OVERDUE_ID,
        eventType: "BAGS_CHECKED_IN",
        previousStatus: "EXPECTED",
        newStatus: "IN_STORAGE",
        actorUserId: STAFF_USER_ID,
        actorRole: "HOST_STAFF",
        metadata: { zoneName: "Vault Cage North" },
        createdAt: "2024-01-10T04:35:00.000Z"
      }
    ]
  };

  const populatedFinance: HostFinanceSummaryResponse = {
    currency: "LKR",
    totalEligibleMinor: 170000,
    totalAccruedMinor: 85000,
    totalOnHoldMinor: 42500,
    totalPaidMinor: 340000,
    payables: [
      {
        id: "15151515-1515-4151-8151-151515151501",
        businessId: BIZ_ID,
        businessName: "Southern Locker Concierge",
        bookingId: BOOKING_OVERDUE_ID,
        referenceCode: "LSB-ELIG-01",
        grossSubtotalMinor: 200000,
        commissionMinor: 30000,
        netPayableMinor: 170000,
        currency: "LKR",
        status: "ELIGIBLE",
        accruedAt: "2026-10-20T10:00:00.000Z",
        eligibleAt: "2026-10-20T18:00:00.000Z",
        updatedAt: "2026-10-20T18:00:00.000Z"
      },
      {
        id: "15151515-1515-4151-8151-151515151502",
        businessId: BIZ_ID,
        businessName: "Southern Locker Concierge",
        bookingId: BOOKING_PENDING_PAY_ID,
        referenceCode: "LSB-ACCR-02",
        grossSubtotalMinor: 100000,
        commissionMinor: 15000,
        netPayableMinor: 85000,
        currency: "LKR",
        status: "ACCRUED",
        accruedAt: "2026-10-21T09:00:00.000Z",
        eligibleAt: null,
        updatedAt: "2026-10-21T09:00:00.000Z"
      },
      {
        id: "15151515-1515-4151-8151-151515151503",
        businessId: BIZ_ID,
        businessName: "Southern Locker Concierge",
        bookingId: "16161616-1616-4161-8161-161616161603",
        referenceCode: "LSB-HOLD-03",
        grossSubtotalMinor: 50000,
        commissionMinor: 7500,
        netPayableMinor: 42500,
        currency: "LKR",
        status: "ON_HOLD",
        accruedAt: "2026-10-22T09:00:00.000Z",
        eligibleAt: null,
        updatedAt: "2026-10-22T12:00:00.000Z"
      },
      {
        id: "15151515-1515-4151-8151-151515151504",
        businessId: BIZ_ID,
        businessName: "Southern Locker Concierge",
        bookingId: "17171717-1717-4171-8171-171717171704",
        referenceCode: "LSB-PAID-04",
        grossSubtotalMinor: 400000,
        commissionMinor: 60000,
        netPayableMinor: 340000,
        currency: "LKR",
        status: "PAID",
        accruedAt: "2026-10-10T09:00:00.000Z",
        eligibleAt: "2026-10-10T18:00:00.000Z",
        updatedAt: "2026-10-15T12:00:00.000Z"
      }
    ]
  };

  const emptyFinance: HostFinanceSummaryResponse = {
    currency: "LKR",
    totalEligibleMinor: 0,
    totalAccruedMinor: 0,
    totalOnHoldMinor: 0,
    totalPaidMinor: 0,
    payables: []
  };

  const bookingsList = [overdueBooking, pendingPayBooking];

  qc.setQueryData(hostQueryKeys.businesses(), [business]);
  qc.setQueryData(hostQueryKeys.locations(), [location]);
  qc.setQueryData(hostQueryKeys.zones(LOC_ID), zones);
  qc.setQueryData(hostQueryKeys.capacityPools(LOC_ID), pools);
  qc.setQueryData(hostQueryKeys.bookings({ locationId: LOC_ID, limit: 50 }), {
    bookings: bookingsList,
    total: bookingsList.length,
    page: 1,
    limit: 50
  });
  qc.setQueryData(hostQueryKeys.bookings({ limit: 50 }), {
    bookings: bookingsList,
    total: bookingsList.length,
    page: 1,
    limit: 50
  });
  qc.setQueryData(
    hostQueryKeys.bookings({ locationId: LOC_ID, search: "LSB-OVERDUE-01", limit: 20 }),
    {
      bookings: [overdueBooking],
      total: 1,
      page: 1,
      limit: 20
    }
  );
  qc.setQueryData(hostQueryKeys.bookingDetail(BOOKING_OVERDUE_ID), overdueBooking);
  qc.setQueryData(hostQueryKeys.bookingDetail(BOOKING_PENDING_PAY_ID), pendingPayBooking);
  qc.setQueryData(hostQueryKeys.custodyDetail(BOOKING_OVERDUE_ID), custodyDetail);
  qc.setQueryData(hostQueryKeys.payoutDetails(BIZ_ID), {
    payoutBankName: "Hatton National Bank",
    payoutBranchCode: "0042",
    payoutAccountName: "Galle Fort Luggage Concierge Pvt Ltd",
    payoutAccountNumber: "004210094321",
    payoutAccountNumberMasked: "****4321"
  });

  const summary = options?.emptyFinance ? emptyFinance : populatedFinance;
  qc.setQueryData(hostQueryKeys.financeSummary(BIZ_ID), summary);
  qc.setQueryData(hostQueryKeys.financeSummary(undefined), summary);

  return qc;
}

function renderHostRoute(qc: QueryClient, initialRoute: string): string {
  return renderToString(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/host" element={<HostDashboardLayout />}>
            <Route path="dashboard" element={<HostOverviewDashboardPage />} />
            <Route path="bookings" element={<HostBookingManagementHubPage />} />
            <Route path="bookings/:id" element={<HostBookingManagementHubPage />} />
            <Route path="operations" element={<HostWebCheckInOutOperationsPage />} />
            <Route path="finance" element={<HostFinancialRevenueLedgerPage />} />
            <Route path="payouts" element={<HostPayoutAccountsHistoryPage />} />
            <Route path="reviews" element={<HostReviewManagementPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function assertNoLeaks(html: string, label: string) {
  expect(html, `${label} leaked tracking codes`).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
  expect(html, `${label} leaked data-screen-id`).not.toContain("data-screen-id");
  for (const marker of DEMO_FORBIDDEN_MARKERS) {
    expect(html, `${label} leaked demo marker "${marker}"`).not.toContain(marker);
  }
}

describe("Initiative 4 — CSV Export, Counter Handover & Live Host Dashboard Surfaces", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.assign(useAuthStore.getInitialState(), ORIGINAL_AUTH_INITIAL_STATE);
    useAuthStore.setState(ORIGINAL_AUTH_INITIAL_STATE);
    Object.assign(useHostContextStore.getInitialState(), ORIGINAL_HOST_CTX_INITIAL_STATE);
    useHostContextStore.setState(ORIGINAL_HOST_CTX_INITIAL_STATE);
  });

  it("1. neutralizes CSV formula injection (CWE-1236) while preserving numeric negatives, escapes RFC-4180 cells, and guards SSR downloads", () => {
    expect(sanitizeCsvFormula("=SUM(A1:A5)")).toBe("'=SUM(A1:A5)");
    expect(sanitizeCsvFormula("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(sanitizeCsvFormula("@HYPERLINK(\"http://evil\")")).toBe("'@HYPERLINK(\"http://evil\")");
    expect(sanitizeCsvFormula("-2+3+cmd")).toBe("'-2+3+cmd");
    expect(sanitizeCsvFormula("\t=1+1")).toBe("'\t=1+1");
    expect(sanitizeCsvFormula("-225.50")).toBe("-225.50");
    expect(sanitizeCsvFormula("-100")).toBe("-100");

    expect(escapeCsvCell('Galle, "Fort" Hub')).toBe('"Galle, ""Fort"" Hub"');
    expect(escapeCsvCell("line1\r\nline2")).toBe('"line1\r\nline2"');
    expect(escapeCsvCell(null)).toBe("");

    const csv = serializeCsv(
      ["Ref", "Notes", "Amount"],
      [
        ["LSB-1", 'Hold, "fragile"', "-225.50"],
        ["LSB-2", "=1+1", "850.00"]
      ]
    );
    expect(csv).toBe(
      ['Ref,Notes,Amount', 'LSB-1,"Hold, ""fragile""",-225.50', "LSB-2,'=1+1,850.00"].join("\r\n")
    );
    expect(downloadCsvFile("host-ledger.csv", csv)).toBe(false);
  });

  it("2. executes counter handover helper validation/zone/evidence payloads and SSR-renders live HostWebCheckInOutOperationsPage with Zero Possessory Lien notice", async () => {
    const verifyCustodyPass = vi.fn().mockResolvedValue({
      verified: true,
      bookingId: BOOKING_OVERDUE_ID,
      referenceCode: "LSB-OVERDUE-01",
      operation: "CHECK_IN",
      expectedBagCount: 2,
      checkedInBagCount: null,
      custodyStatus: "EXPECTED"
    });
    const completeCheckIn = vi.fn().mockResolvedValue({
      id: CUSTODY_ID,
      status: "IN_STORAGE"
    });
    const completeCollection = vi.fn().mockResolvedValue({
      id: CUSTODY_ID,
      status: "RELEASED_TO_TRAVELLER",
      overdueMinutes: 45
    });

    // Reject duplicate bagTagCode case-insensitively before API call
    const dupRes = await executeCounterCustodyHandover(
      {
        operationMode: "CHECK_IN",
        verificationMethod: "PIN_FALLBACK",
        lookupQuery: BOOKING_OVERDUE_ID,
        credentialInput: "123456",
        reconciledBags: 2,
        sealInput: "SEAL",
        collectionNotes: "",
        hasCollectionException: false,
        exceptionNotes: "",
        showDemoOps: false,
        isAuthenticated: true,
        zoneId: ZONE_ID,
        bags: [
          { bagTagCode: "GAL-01", bagCategory: "BAG_MEDIUM" },
          { bagTagCode: "gal-01", bagCategory: "BAG_MEDIUM" }
        ]
      },
      { verifyCustodyPass, completeCheckIn, completeCollection }
    );
    expect(dupRes.kind).toBe("validation_error");
    expect(verifyCustodyPass).not.toHaveBeenCalled();

    // Reject bag count mismatch without >=5-char reason after pre-verify
    const mismatchRes = await executeCounterCustodyHandover(
      {
        operationMode: "CHECK_IN",
        verificationMethod: "PIN_FALLBACK",
        lookupQuery: BOOKING_OVERDUE_ID,
        credentialInput: "123456",
        reconciledBags: 1,
        sealInput: "SEAL",
        collectionNotes: "",
        hasCollectionException: false,
        exceptionNotes: "",
        showDemoOps: false,
        isAuthenticated: true,
        zoneId: ZONE_ID,
        bagCountExceptionReason: "ok",
        bags: [{ bagTagCode: "GAL-01", bagCategory: "BAG_MEDIUM" }]
      },
      { verifyCustodyPass, completeCheckIn, completeCollection }
    );
    expect(mismatchRes.kind).toBe("validation_error");
    expect(completeCheckIn).not.toHaveBeenCalled();

    // Valid custom check-in passes bags, zoneId, photoFileKey, and exception reason
    const okInRes = await executeCounterCustodyHandover(
      {
        operationMode: "CHECK_IN",
        verificationMethod: "QR_SCAN",
        lookupQuery: BOOKING_OVERDUE_ID,
        credentialInput: "a".repeat(64),
        reconciledBags: 1,
        sealInput: "SEAL",
        collectionNotes: "",
        hasCollectionException: false,
        exceptionNotes: "",
        showDemoOps: false,
        isAuthenticated: true,
        zoneId: ZONE_ID,
        bagCountExceptionReason: "Traveller checked 1 backpack at desk",
        bags: [
          {
            bagTagCode: "GAL-01",
            bagCategory: "BAG_LARGE",
            securitySealNumber: "SEAL-91",
            photoFileKey: `custody/${BOOKING_OVERDUE_ID}/bag1.jpg`
          }
        ]
      },
      { verifyCustodyPass, completeCheckIn, completeCollection }
    );
    expect(okInRes.kind).toBe("live_success");
    expect(completeCheckIn).toHaveBeenCalledWith(
      BOOKING_OVERDUE_ID,
      expect.objectContaining({
        zoneId: ZONE_ID,
        bagCountExceptionReason: "Traveller checked 1 backpack at desk"
      })
    );

    // Overdue clean release includes non-possessory-lien message
    const outRes = await executeCounterCustodyHandover(
      {
        operationMode: "CHECK_OUT",
        verificationMethod: "PIN_FALLBACK",
        lookupQuery: BOOKING_OVERDUE_ID,
        credentialInput: "654321",
        reconciledBags: 2,
        sealInput: "",
        collectionNotes: "Released smoothly",
        hasCollectionException: false,
        exceptionNotes: "",
        showDemoOps: false,
        isAuthenticated: true
      },
      { verifyCustodyPass, completeCheckIn, completeCollection }
    );
    expect(outRes.kind).toBe("live_success");
    if (outRes.kind === "live_success") {
      expect(outRes.message).toContain("without possessory lien");
    }

    // SSR live operations desk as HOST_STAFF on overdue booking
    setAuthSession(
      makeUser({ id: STAFF_USER_ID, roles: ["HOST_STAFF"], displayName: "Kasun Attendant" }),
      [SYSTEM_PERMISSIONS.HOSTS_BOOKINGS_READ_OWN, SYSTEM_PERMISSIONS.HOSTS_CUSTODY_OPERATE]
    );
    setHostContext({ selectedLocationId: LOC_ID });
    const qc = seedHostPortalQueryClient({ redactSnapshotForStaff: true });
    const html = renderHostRoute(qc, "/host/operations?ref=LSB-OVERDUE-01&mode=checkout");

    expect(html).toContain("Vault Cage North");
    expect(html).toContain("LSB-OVERDUE-01");
    expect(html).toContain("Zero Possessory Lien Policy");
    assertNoLeaks(html, "Live HostWebCheckInOutOperationsPage");
  });

  it("3. enforces OQ-017 financial privacy on HostOverviewDashboardPage and HostBookingManagementHubPage and renders live custody evidence", () => {
    // HOST_OWNER on /host/dashboard with zero-capacity pool (renders 0% configured, never NaN%) + Net Cleared Earnings
    setAuthSession(makeUser({ roles: ["HOST_OWNER"] }), [
      SYSTEM_PERMISSIONS.HOSTS_BUSINESS_READ_OWN,
      SYSTEM_PERMISSIONS.HOSTS_FINANCE_READ_OWN,
      SYSTEM_PERMISSIONS.HOSTS_BOOKINGS_READ_OWN
    ]);
    setHostContext({ selectedBusinessId: BIZ_ID, selectedLocationId: LOC_ID });
    const ownerQc = seedHostPortalQueryClient({ zeroCapacityPool: true });

    const ownerDashHtml = renderHostRoute(ownerQc, "/host/dashboard");
    expect(ownerDashHtml).toContain("Net Cleared Earnings");
    expect(ownerDashHtml).toContain("0% configured");
    expect(ownerDashHtml).not.toContain("NaN%");
    assertNoLeaks(ownerDashHtml, "Owner HostOverviewDashboardPage");

    // HOST_STAFF on /host/dashboard MUST NOT see Net Cleared Earnings (OQ-017)
    setAuthSession(
      makeUser({ id: STAFF_USER_ID, roles: ["HOST_STAFF"], displayName: "Staff Operator" }),
      [SYSTEM_PERMISSIONS.HOSTS_BOOKINGS_READ_OWN, SYSTEM_PERMISSIONS.HOSTS_CUSTODY_OPERATE]
    );
    setHostContext({ selectedLocationId: LOC_ID });
    const staffQc = seedHostPortalQueryClient({ redactSnapshotForStaff: true });

    const staffDashHtml = renderHostRoute(staffQc, "/host/dashboard");
    expect(staffDashHtml).not.toContain("Net Cleared Earnings");
    assertNoLeaks(staffDashHtml, "Staff HostOverviewDashboardPage");

    // HOST_OWNER inspecting /host/bookings/:id sees Pending Payment (never Confirmed for PENDING_PAYMENT), Host Net, Payable, & Evidence Photo link
    setAuthSession(makeUser({ roles: ["HOST_OWNER"] }), [
      SYSTEM_PERMISSIONS.HOSTS_BUSINESS_READ_OWN,
      SYSTEM_PERMISSIONS.HOSTS_FINANCE_READ_OWN,
      SYSTEM_PERMISSIONS.HOSTS_BOOKINGS_READ_OWN
    ]);
    setHostContext({ selectedBusinessId: BIZ_ID, selectedLocationId: LOC_ID });

    const ownerBookingsHtml = renderHostRoute(ownerQc, `/host/bookings/${BOOKING_OVERDUE_ID}`);
    expect(ownerBookingsHtml).toContain("Pending Payment");
    expect(ownerBookingsHtml).toContain("Host Net");
    expect(ownerBookingsHtml).toContain("Payable LKR");
    expect(ownerBookingsHtml).toContain("BAGS_CHECKED_IN");
    expect(ownerBookingsHtml).toContain("View Evidence Photo");
    assertNoLeaks(ownerBookingsHtml, "Owner HostBookingManagementHubPage");

    // HOST_STAFF inspecting /host/bookings?inspect=:id MUST NOT see Host Net column or Payable snapshot
    setAuthSession(
      makeUser({ id: STAFF_USER_ID, roles: ["HOST_STAFF"], displayName: "Staff Operator" }),
      [SYSTEM_PERMISSIONS.HOSTS_BOOKINGS_READ_OWN, SYSTEM_PERMISSIONS.HOSTS_CUSTODY_OPERATE]
    );
    setHostContext({ selectedLocationId: LOC_ID });

    const staffBookingsHtml = renderHostRoute(
      staffQc,
      `/host/bookings?inspect=${BOOKING_OVERDUE_ID}`
    );
    expect(staffBookingsHtml).toContain("Pending Payment");
    expect(staffBookingsHtml).toContain("View Evidence Photo");
    expect(staffBookingsHtml).not.toContain("Host Net");
    expect(staffBookingsHtml).not.toContain("Payable LKR");
    assertNoLeaks(staffBookingsHtml, "Staff HostBookingManagementHubPage");
  });

  it("4. renders live HostFinancialRevenueLedgerPage, HostPayoutAccountsHistoryPage, and post-MVP HostReviewManagementPage cleanly", () => {
    setAuthSession(makeUser({ roles: ["HOST_OWNER"] }), [
      SYSTEM_PERMISSIONS.HOSTS_BUSINESS_READ_OWN,
      SYSTEM_PERMISSIONS.HOSTS_FINANCE_READ_OWN
    ]);
    setHostContext({ selectedBusinessId: BIZ_ID, selectedLocationId: LOC_ID });

    // Empty payables ledger renders clean zero metrics without demo numbers
    const emptyFinQc = seedHostPortalQueryClient({ emptyFinance: true });
    const emptyFinHtml = renderHostRoute(emptyFinQc, "/host/finance");
    expect(emptyFinHtml).toContain("LKR 0");
    expect(emptyFinHtml).toContain("Export CSV Ledger");
    assertNoLeaks(emptyFinHtml, "Empty HostFinancialRevenueLedgerPage");

    // Populated payables ledger displays all 4 live payable buckets + ON_HOLD dispute badge
    const popQc = seedHostPortalQueryClient();
    const popFinHtml = renderHostRoute(popQc, "/host/finance");
    expect(popFinHtml).toContain("Eligible for Payout");
    expect(popFinHtml).toContain("Accrued (Pending Collection)");
    expect(popFinHtml).toContain("On Hold (Disputed)");
    expect(popFinHtml).toContain("On Hold (Dispute Review)");
    expect(popFinHtml).toContain("Paid to Date");
    expect(popFinHtml).toContain("LSB-ELIG-01");
    assertNoLeaks(popFinHtml, "Populated HostFinancialRevenueLedgerPage");

    // Live Payouts page renders bank beneficiary & settlement rows without fabricated BATCH-2026-W44 or dead PDF button
    const payoutsHtml = renderHostRoute(popQc, "/host/payouts");
    expect(payoutsHtml).toContain("Hatton National Bank");
    expect(payoutsHtml).toContain("****4321");
    expect(payoutsHtml).toContain("Beneficiary On File");
    expect(payoutsHtml).toContain("Host Settlement Payables Overview");
    expect(payoutsHtml).toContain("LSB-ELIG-01");
    assertNoLeaks(payoutsHtml, "Live HostPayoutAccountsHistoryPage");

    // Live Reviews page displays post-MVP feature gate notice without mock reviewer names
    const reviewsHtml = renderHostRoute(popQc, "/host/reviews");
    expect(reviewsHtml).toContain("Verified Traveller Reviews Coming Post-MVP");
    assertNoLeaks(reviewsHtml, "Live HostReviewManagementPage");
  });
});
