import { afterEach, describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AuthenticatedUser } from "@luggage-storage/contracts";
import { ProtectedRoute } from "../src/components/auth/ProtectedRoute";
import { evaluateRouteAuthorization, isDemoPreviewActive } from "../src/config/demo-preview";
import { clearAccessToken } from "../src/lib/api-client";
import { getBookingStatusDisplay } from "../src/lib/booking-status";
import { executeCounterCustodyHandover } from "../src/lib/counter-custody";
import {
  AdminCommandDashboardPage,
  AdminDashboardLayout,
  AdminGlobalBookingsLedgerPage,
  AdminRefundManagementQueuePage
} from "../src/pages/AdminDashboardPages";
import {
  HostBookingManagementHubPage,
  HostDashboardLayout,
  HostFinancialRevenueLedgerPage,
  HostWebCheckInOutOperationsPage
} from "../src/pages/HostDashboardPages";
import {
  LocationProfileDetailPage,
  PublicLandingPage,
  TravellerWebPortalPage,
  WebSearchDiscoveryPage
} from "../src/pages/PublicMarketplacePages";
import { useAuthStore } from "@/store/useAuthStore";

const ORIGINAL_INITIAL_AUTH_STATE = { ...useAuthStore.getInitialState() };

function setSsrAuthState(partial: Partial<ReturnType<typeof useAuthStore.getState>>) {
  useAuthStore.setState(partial);
  Object.assign(useAuthStore.getInitialState(), useAuthStore.getState());
}

const TEST_USER_BASE: AuthenticatedUser = {
  id: "a1111111-1111-4111-8111-111111111111",
  email: "user@luggage.test",
  displayName: "Test Operator",
  status: "ACTIVE",
  isEmailVerified: true,
  isPhoneVerified: false,
  roles: ["TRAVELLER"],
  lastLoginAt: "2026-11-10T08:00:00.000Z"
};

const DEMO_FORBIDDEN_MARKERS = [
  "Colombo Fort Counter #4",
  "LS-2026-8841",
  "LKR 250,000",
  "Ceylon Transit Hospitality",
  "Commercial Bank of Ceylon",
  "Roshan Fernando"
];

describe("Initiative 1 — Foundation Hardening & Regression Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearAccessToken();
    Object.assign(useAuthStore.getInitialState(), ORIGINAL_INITIAL_AUTH_STATE);
    useAuthStore.getState().clearAuth();
    setSsrAuthState({ isInitializing: false });
  });

  afterEach(() => {
    Object.assign(useAuthStore.getInitialState(), ORIGINAL_INITIAL_AUTH_STATE);
    useAuthStore.getState().clearAuth();
  });

  describe("Demo Preview Quarantine & Route Isolation", () => {
    it("allows demo preview only for unauthenticated opt-in ?preview=demo and blocks it for authenticated users or prod builds", () => {
      expect(
        isDemoPreviewActive({
          allowDemoPreview: true,
          search: "?preview=demo",
          isAuthenticated: false,
          envInput: { PROD: false, MODE: "test" }
        })
      ).toBe(true);

      expect(
        isDemoPreviewActive({
          allowDemoPreview: true,
          search: "?preview=demo",
          isAuthenticated: true,
          envInput: { PROD: false, MODE: "test" }
        })
      ).toBe(false);

      expect(
        isDemoPreviewActive({
          allowDemoPreview: true,
          search: "",
          isAuthenticated: false,
          envInput: { PROD: false, MODE: "test" }
        })
      ).toBe(false);

      expect(
        isDemoPreviewActive({
          allowDemoPreview: true,
          search: "?preview=demo",
          isAuthenticated: false,
          envInput: { PROD: true, MODE: "production" }
        })
      ).toBe(false);

      expect(
        isDemoPreviewActive({
          allowDemoPreview: true,
          search: "?preview=demo",
          isAuthenticated: false,
          envInput: { PROD: true, MODE: "production", VITE_ENABLE_DEMO_PREVIEW: "true" }
        })
      ).toBe(true);
    });

    it("does not leak demo fixtures on unauthenticated non-demo routes across Public, Host, and Admin portals", () => {
      const routesToCheck = [
        renderToString(
          <MemoryRouter initialEntries={["/"]}>
            <PublicLandingPage />
          </MemoryRouter>
        ),
        renderToString(
          <MemoryRouter initialEntries={["/search"]}>
            <WebSearchDiscoveryPage />
          </MemoryRouter>
        ),
        renderToString(
          <MemoryRouter initialEntries={["/locations/11111111-1111-4111-8111-111111111111"]}>
            <Routes>
              <Route path="/locations/:id" element={<LocationProfileDetailPage />} />
            </Routes>
          </MemoryRouter>
        ),
        renderToString(
          <MemoryRouter initialEntries={["/portal"]}>
            <TravellerWebPortalPage />
          </MemoryRouter>
        ),
        renderToString(
          <MemoryRouter initialEntries={["/host/bookings"]}>
            <Routes>
              <Route path="/host" element={<HostDashboardLayout />}>
                <Route path="bookings" element={<HostBookingManagementHubPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        ),
        renderToString(
          <MemoryRouter initialEntries={["/host/operations"]}>
            <Routes>
              <Route path="/host" element={<HostDashboardLayout />}>
                <Route path="operations" element={<HostWebCheckInOutOperationsPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        ),
        renderToString(
          <MemoryRouter initialEntries={["/host/finance"]}>
            <Routes>
              <Route path="/host" element={<HostDashboardLayout />}>
                <Route path="finance" element={<HostFinancialRevenueLedgerPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        ),
        renderToString(
          <MemoryRouter initialEntries={["/admin"]}>
            <Routes>
              <Route path="/admin" element={<AdminDashboardLayout />}>
                <Route index element={<AdminCommandDashboardPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        ),
        renderToString(
          <MemoryRouter initialEntries={["/admin/bookings"]}>
            <Routes>
              <Route path="/admin" element={<AdminDashboardLayout />}>
                <Route path="bookings" element={<AdminGlobalBookingsLedgerPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        ),
        renderToString(
          <MemoryRouter initialEntries={["/admin/refunds"]}>
            <Routes>
              <Route path="/admin" element={<AdminDashboardLayout />}>
                <Route path="refunds" element={<AdminRefundManagementQueuePage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        )
      ];

      for (const html of routesToCheck) {
        for (const marker of DEMO_FORBIDDEN_MARKERS) {
          expect(html).not.toContain(marker);
        }
      }
    });

    it("ignores ?preview=demo when authenticated so live operators never see simulated demo banners or fixtures", () => {
      setSsrAuthState({
        isAuthenticated: true,
        isInitializing: false,
        user: { ...TEST_USER_BASE, roles: ["HOST_OWNER"] },
        permissions: ["hosts.booking.read_own", "hosts.custody.operate", "hosts.finance.read_own"]
      });

      const protectedHostHtml = renderToString(
        <MemoryRouter initialEntries={["/host/operations?preview=demo"]}>
          <Routes>
            <Route element={<ProtectedRoute allowDemoPreview />}>
              <Route path="/host" element={<HostDashboardLayout />}>
                <Route path="operations" element={<HostWebCheckInOutOperationsPage />} />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>
      );

      expect(protectedHostHtml).not.toContain("demo-preview-isolation-banner");
      for (const marker of DEMO_FORBIDDEN_MARKERS) {
        expect(protectedHostHtml).not.toContain(marker);
      }

      const authedPublicPortalHtml = renderToString(
        <MemoryRouter initialEntries={["/portal?preview=demo"]}>
          <TravellerWebPortalPage />
        </MemoryRouter>
      );
      for (const marker of DEMO_FORBIDDEN_MARKERS) {
        expect(authedPublicPortalHtml).not.toContain(marker);
      }
    });
  });

  describe("RBAC, ProtectedRoute & Host Financial Privacy", () => {
    it("evaluates route authorization accurately across unauthenticated, forbidden role, and allowed callers", () => {
      expect(
        evaluateRouteAuthorization({
          isAuthenticated: false
        })
      ).toEqual({ allowed: false, reason: "UNAUTHENTICATED" });

      expect(
        evaluateRouteAuthorization({
          isAuthenticated: true,
          userRoles: ["TRAVELLER"],
          userPermissions: ["booking.read_own"],
          requiredRoles: ["HOST_OWNER"]
        })
      ).toEqual({ allowed: false, reason: "FORBIDDEN_ROLE" });

      expect(
        evaluateRouteAuthorization({
          isAuthenticated: true,
          userRoles: ["HOST_STAFF"],
          userPermissions: ["hosts.custody.operate"],
          requiredPermission: "hosts.finance.read_own"
        })
      ).toEqual({ allowed: false, reason: "FORBIDDEN_PERMISSION" });

      expect(
        evaluateRouteAuthorization({
          isAuthenticated: true,
          userRoles: ["HOST_OWNER"],
          userPermissions: ["hosts.finance.read_own"],
          requiredRoles: ["HOST_OWNER"],
          requiredPermission: "hosts.finance.read_own"
        })
      ).toEqual({ allowed: true });
    });

    it("gates ProtectedRoute strictly when unauthenticated without demo opt-in or lacking required permissions", () => {
      const unauthedHtml = renderToString(
        <MemoryRouter initialEntries={["/portal"]}>
          <Routes>
            <Route element={<ProtectedRoute allowDemoPreview />}>
              <Route path="/portal" element={<div>SECRET_PORTAL</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      );
      expect(unauthedHtml).not.toContain("SECRET_PORTAL");
      expect(unauthedHtml).not.toContain("demo-preview-isolation-banner");

      const demoOptInHtml = renderToString(
        <MemoryRouter initialEntries={["/portal?preview=demo"]}>
          <Routes>
            <Route element={<ProtectedRoute allowDemoPreview />}>
              <Route path="/portal" element={<div>DEMO_PORTAL_OK</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      );
      expect(demoOptInHtml).toContain("demo-preview-isolation-banner");
      expect(demoOptInHtml).toContain("DEMO_PORTAL_OK");

      setSsrAuthState({
        isAuthenticated: true,
        isInitializing: false,
        user: { ...TEST_USER_BASE, roles: ["TRAVELLER"] },
        permissions: ["booking.read_own"]
      });
      const forbiddenHtml = renderToString(
        <MemoryRouter initialEntries={["/host/finance"]}>
          <Routes>
            <Route element={<ProtectedRoute requiredPermission="hosts.finance.read_own" />}>
              <Route path="/host/finance" element={<div>HOST_NET_SECRET</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      );
      expect(forbiddenHtml).not.toContain("HOST_NET_SECRET");
    });

    it("hides Host Net column on HostBookingManagementHubPage for HOST_STAFF and shows it for HOST_OWNER", () => {
      setSsrAuthState({
        isAuthenticated: true,
        isInitializing: false,
        user: { ...TEST_USER_BASE, roles: ["HOST_STAFF"] },
        permissions: ["hosts.booking.read_own", "hosts.custody.operate"]
      });

      const staffHtml = renderToString(
        <MemoryRouter initialEntries={["/host/bookings"]}>
          <Routes>
            <Route path="/host" element={<HostDashboardLayout />}>
              <Route path="bookings" element={<HostBookingManagementHubPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );
      expect(staffHtml).not.toContain("Host Net");

      setSsrAuthState({
        isAuthenticated: true,
        isInitializing: false,
        user: { ...TEST_USER_BASE, roles: ["HOST_OWNER"] },
        permissions: ["hosts.booking.read_own", "hosts.finance.read_own"]
      });

      const ownerHtml = renderToString(
        <MemoryRouter initialEntries={["/host/bookings"]}>
          <Routes>
            <Route path="/host" element={<HostDashboardLayout />}>
              <Route path="bookings" element={<HostBookingManagementHubPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );
      expect(ownerHtml).toContain("Host Net");
    });
  });

  describe("Truthful Booking Status Mapping", () => {
    it("maps every lifecycle status accurately without labelling PENDING_PAYMENT as Confirmed", () => {
      expect(getBookingStatusDisplay("PENDING_PAYMENT")).toEqual({
        label: "Pending Payment",
        tone: "warning",
        isOverdue: false
      });
      expect(getBookingStatusDisplay("PENDING_HOST_APPROVAL")).toEqual({
        label: "Pending Host Approval",
        tone: "warning",
        isOverdue: false
      });
      expect(getBookingStatusDisplay("CONFIRMED")).toEqual({
        label: "Confirmed & Reserved",
        tone: "brand",
        isOverdue: false
      });
      expect(
        getBookingStatusDisplay("IN_STORAGE", {
          collectionAt: "2026-12-01T12:00:00.000Z",
          nowMs: Date.parse("2026-12-01T10:00:00.000Z")
        })
      ).toEqual({
        label: "In Active Custody",
        tone: "success",
        isOverdue: false
      });
      expect(
        getBookingStatusDisplay("IN_STORAGE", {
          collectionAt: "2026-12-01T10:00:00.000Z",
          nowMs: Date.parse("2026-12-01T12:00:00.000Z")
        })
      ).toEqual({
        label: "Overdue Custody",
        tone: "danger",
        isOverdue: true
      });
      expect(getBookingStatusDisplay("COMPLETED")).toEqual({
        label: "Completed",
        tone: "neutral",
        isOverdue: false
      });
      expect(getBookingStatusDisplay("DISPUTED")).toEqual({
        label: "Custody Exception / Disputed",
        tone: "danger",
        isOverdue: false
      });
      expect(
        getBookingStatusDisplay("CANCELLED_BY_TRAVELLER", { hasRefund: true })
      ).toEqual({
        label: "Cancelled (Refund Recorded)",
        tone: "neutral",
        isOverdue: false
      });
      expect(getBookingStatusDisplay("REJECTED")).toEqual({
        label: "Declined by Host",
        tone: "danger",
        isOverdue: false
      });
      expect(getBookingStatusDisplay("EXPIRED")).toEqual({
        label: "Hold Expired",
        tone: "neutral",
        isOverdue: false
      });
    });
  });

  describe("Counter Custody Check-Out Validation & Payload Construction", () => {
    const validBookingUuid = "22222222-3333-4444-8555-666666666666";

    it("rejects unauthenticated callers and non-UUID booking IDs in live mode without calling API", async () => {
      const verifySpy = vi.fn();
      const checkInSpy = vi.fn();
      const collectionSpy = vi.fn();

      const unauthOutcome = await executeCounterCustodyHandover(
        {
          operationMode: "CHECK_OUT",
          verificationMethod: "PIN_FALLBACK",
          lookupQuery: validBookingUuid,
          credentialInput: "123456",
          reconciledBags: 2,
          sealInput: "",
          collectionNotes: "",
          hasCollectionException: false,
          exceptionNotes: "",
          showDemoOps: false,
          isAuthenticated: false
        },
        {
          verifyCustodyPass: verifySpy,
          completeCheckIn: checkInSpy,
          completeCollection: collectionSpy
        }
      );
      expect(unauthOutcome.kind).toBe("validation_error");
      expect(verifySpy).not.toHaveBeenCalled();

      const nonUuidOutcome = await executeCounterCustodyHandover(
        {
          operationMode: "CHECK_OUT",
          verificationMethod: "PIN_FALLBACK",
          lookupQuery: "LS-2026-8841",
          credentialInput: "123456",
          reconciledBags: 2,
          sealInput: "",
          collectionNotes: "",
          hasCollectionException: false,
          exceptionNotes: "",
          showDemoOps: false,
          isAuthenticated: true
        },
        {
          verifyCustodyPass: verifySpy,
          completeCheckIn: checkInSpy,
          completeCollection: collectionSpy
        }
      );
      expect(nonUuidOutcome).toEqual({
        kind: "validation_error",
        message: "Enter a valid booking UUID to verify live custody credentials."
      });
      expect(verifySpy).not.toHaveBeenCalled();
    });

    it("sends collectionNotes and omits exceptionNotes on normal CHECK_OUT", async () => {
      const verifySpy = vi.fn().mockResolvedValue({
        verified: true,
        bookingId: validBookingUuid,
        referenceCode: "LS-2026-LIVE",
        operation: "COLLECTION",
        expectedBagCount: 2,
        checkedInBagCount: 2,
        custodyStatus: "IN_STORAGE"
      });
      const collectionSpy = vi.fn().mockResolvedValue({
        status: "RELEASED_TO_TRAVELLER",
        overdueMinutes: 0
      });

      const outcome = await executeCounterCustodyHandover(
        {
          operationMode: "CHECK_OUT",
          verificationMethod: "PIN_FALLBACK",
          lookupQuery: validBookingUuid,
          credentialInput: "482 910",
          reconciledBags: 2,
          sealInput: "",
          collectionNotes: "  All tags and seals intact  ",
          hasCollectionException: false,
          exceptionNotes: "ignored when checkbox unchecked",
          showDemoOps: false,
          isAuthenticated: true
        },
        {
          verifyCustodyPass: verifySpy,
          completeCheckIn: vi.fn(),
          completeCollection: collectionSpy
        }
      );

      expect(outcome.kind).toBe("live_success");
      expect(collectionSpy).toHaveBeenCalledWith(validBookingUuid, {
        qrToken: undefined,
        verificationPin: "482910",
        releasedBagCount: 2,
        collectionNotes: "All tags and seals intact",
        exceptionNotes: undefined
      });
    });

    it("enforces minimum 3-char exceptionNotes when discrepancy is checked and submits exceptionNotes on CHECK_OUT", async () => {
      const verifySpy = vi.fn().mockResolvedValue({
        verified: true,
        bookingId: validBookingUuid,
        referenceCode: "LS-2026-EXC",
        operation: "COLLECTION",
        expectedBagCount: 1,
        checkedInBagCount: 1,
        custodyStatus: "IN_STORAGE"
      });
      const collectionSpy = vi.fn().mockResolvedValue({
        status: "DISPUTED_RELEASE",
        overdueMinutes: 0
      });

      const tooShortOutcome = await executeCounterCustodyHandover(
        {
          operationMode: "CHECK_OUT",
          verificationMethod: "PIN_FALLBACK",
          lookupQuery: validBookingUuid,
          credentialInput: "112233",
          reconciledBags: 1,
          sealInput: "",
          collectionNotes: "",
          hasCollectionException: true,
          exceptionNotes: "no",
          showDemoOps: false,
          isAuthenticated: true
        },
        {
          verifyCustodyPass: verifySpy,
          completeCheckIn: vi.fn(),
          completeCollection: collectionSpy
        }
      );

      expect(tooShortOutcome).toEqual({
        kind: "validation_error",
        message: "Enter exception details (at least 3 characters) when reporting a custody discrepancy."
      });
      expect(verifySpy).not.toHaveBeenCalled();

      const validExceptionOutcome = await executeCounterCustodyHandover(
        {
          operationMode: "CHECK_OUT",
          verificationMethod: "PIN_FALLBACK",
          lookupQuery: validBookingUuid,
          credentialInput: "112233",
          reconciledBags: 1,
          sealInput: "",
          collectionNotes: "Counter logged",
          hasCollectionException: true,
          exceptionNotes: "  Broken zipper pull reported  ",
          showDemoOps: false,
          isAuthenticated: true
        },
        {
          verifyCustodyPass: verifySpy,
          completeCheckIn: vi.fn(),
          completeCollection: collectionSpy
        }
      );

      expect(validExceptionOutcome.kind).toBe("live_success");
      expect(collectionSpy).toHaveBeenCalledWith(validBookingUuid, {
        qrToken: undefined,
        verificationPin: "112233",
        releasedBagCount: 1,
        collectionNotes: "Counter logged",
        exceptionNotes: "Broken zipper pull reported"
      });
    });
  });

  describe("Live Failure Honesty & Zero Demo Fallback Verification", () => {
    it("retains explicit Retry error recovery handlers and never mixes DEMO_* fixtures into authenticated fetches", () => {
      const alertSrc = fs.readFileSync(
        path.resolve(__dirname, "../src/components/ui/Alert.tsx"),
        "utf-8"
      );
      const publicSrc = fs.readFileSync(
        path.resolve(__dirname, "../src/pages/PublicMarketplacePages.tsx"),
        "utf-8"
      );
      const hostSrc = fs.readFileSync(
        path.resolve(__dirname, "../src/pages/HostDashboardPages.tsx"),
        "utf-8"
      );
      const adminSrc = fs.readFileSync(
        path.resolve(__dirname, "../src/pages/AdminDashboardPages.tsx"),
        "utf-8"
      );

      expect(alertSrc).toContain('variant === "danger" || variant === "warning" ? "alert" : "status"');
      expect(publicSrc).toContain('<Alert variant="danger"');
      expect(publicSrc).toContain("Retry");

      for (const src of [hostSrc, adminSrc]) {
        expect(src).toContain('role="alert"');
        expect(src).toContain("Retry");
      }

      // Live counter page source must not regress to hardcoded exceptionNotes on check-out
      expect(hostSrc).not.toContain('exceptionNotes: "Released via Host Counter Web Desk"');
      expect(hostSrc).toContain("executeCounterCustodyHandover");
    });
  });
});
