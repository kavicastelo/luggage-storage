import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  HostDashboardLayout,
  HostOverviewDashboardPage,
  HostLocationManagementPage,
  HostLocationProfileEditorPage,
  HostScheduleCalendarEditorPage,
  HostCapacityPoolsZonesPage,
  HostPricingRulesMultipliersPage,
  HostBookingManagementHubPage,
  HostWebCheckInOutOperationsPage,
  HostFinancialRevenueLedgerPage,
  HostPayoutAccountsHistoryPage,
  HostReviewManagementPage,
  HostStaffManagementRbacPage,
  HostBusinessProfileLegalPage
} from "../src/pages/HostDashboardPages";
import { useAuthStore } from "@/store/useAuthStore";
import { AuthenticatedUser } from "@luggage-storage/contracts";

function renderWithRouter(ui: React.ReactElement, initialRoute = "/host/dashboard") {
  return renderToString(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/host" element={<HostDashboardLayout />}>
          <Route index element={<HostOverviewDashboardPage />} />
          <Route path="dashboard" element={<HostOverviewDashboardPage />} />
          <Route path="locations" element={<HostLocationManagementPage />} />
          <Route path="locations/:id" element={<HostLocationProfileEditorPage />} />
          <Route path="locations/:id/schedule" element={<HostScheduleCalendarEditorPage />} />
          <Route path="locations/:id/capacity" element={<HostCapacityPoolsZonesPage />} />
          <Route path="locations/:id/pricing" element={<HostPricingRulesMultipliersPage />} />
          <Route path="bookings" element={<HostBookingManagementHubPage />} />
          <Route path="operations" element={<HostWebCheckInOutOperationsPage />} />
          <Route path="finance" element={<HostFinancialRevenueLedgerPage />} />
          <Route path="payouts" element={<HostPayoutAccountsHistoryPage />} />
          <Route path="reviews" element={<HostReviewManagementPage />} />
          <Route path="staff" element={<HostStaffManagementRbacPage />} />
          <Route path="settings" element={<HostBusinessProfileLegalPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

// Strict suppression pattern for all developer tracking codes
const FORBIDDEN_DEVELOPER_PATTERN = /\b(PW|HD|AD|TM|HM)-\d{3}\b|\bWF-\d{3}\b|\bOQ-\d{3}\b/;

describe("Phase 2C.4 — Host Web Dashboard Experience Verification", () => {
  describe("Host Portal Shell & Layout Navigation", () => {
    it("renders host partner portal with clean business labels and venue selector", () => {
      const html = renderWithRouter(<HostOverviewDashboardPage />, "/host/dashboard");
      expect(html).toContain("Host Partner Portal");
      expect(html).toContain("Active Storage Hub");
      expect(html).toContain("Overview");
      expect(html).toContain("Check-In &amp; Out Desk");
      expect(html).toContain("Bookings Hub");
      expect(html).toContain("Storage Hubs");
      expect(html).toContain("Customer Reviews");
      expect(html).toContain("Location Setup");
      expect(html).toContain("Finance &amp; Administration");
      expect(html).toContain("Host Support Desk");
    });

    it("strictly suppresses internal developer tracking codes from customer/host DOM", () => {
      const html = renderWithRouter(<HostOverviewDashboardPage />, "/host/dashboard");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("HD-001");
      expect(html).not.toContain("data-screen-id");
    });
  });

  describe("HD-001: Host Overview Dashboard", () => {
    it("renders live operational metrics, movement queue, and overdue notice", () => {
      const html = renderWithRouter(<HostOverviewDashboardPage />, "/host/dashboard");
      expect(html).toContain("Bags in Vault");
      expect(html).toContain("28");
      expect(html).toContain("Today&#x27;s Arrivals");
      expect(html).toContain("Today&#x27;s Pickups");
      expect(html).toContain("Net Cleared Earnings");
      expect(html).toContain("184,500");
      expect(html).toContain("Today&#x27;s Custody Movement Queue");
      expect(html).toContain("Overdue Custody Notice");
      expect(html).toContain("Physical Zone Capacity");
      expect(html).toContain("Staff on Counter Duty");
    });

    it("suppresses developer tracking codes from overview dashboard", () => {
      const html = renderWithRouter(<HostOverviewDashboardPage />, "/host/dashboard");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("HD-001");
    });
  });

  describe("HD-002: Location Management", () => {
    it("renders multi-hub directory across Sri Lankan transit corridors", () => {
      const html = renderWithRouter(<HostLocationManagementPage />, "/host/locations");
      expect(html).toContain("Storage Locations");
      expect(html).toContain("Register New Storage Hub");
      expect(html).toContain("Colombo Fort Station Heritage Vault");
      expect(html).toContain("Ella Railway &amp; Nine Arch Trail Hub");
      expect(html).toContain("Kandy Lake &amp; Temple Quarter Concierge");
      expect(html).toContain("Public Masked Address:");
      expect(html).toContain("Edit Profile");
      expect(html).toContain("Hours &amp; Calendar");
      expect(html).toContain("Capacity &amp; Zones");
      expect(html).toContain("Pricing Rules");
    });

    it("suppresses developer tracking codes from location management", () => {
      const html = renderWithRouter(<HostLocationManagementPage />, "/host/locations");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("HD-002");
    });
  });

  describe("HD-003: Location Profile Editor", () => {
    it("renders profile form, address privacy masking, and security amenities", () => {
      const html = renderWithRouter(
        <HostLocationProfileEditorPage />,
        "/host/locations/loc-cmb-fort-01"
      );
      expect(html).toContain("Location Profile Editor");
      expect(html).toContain("Public Profile Information");
      expect(html).toContain("Address Privacy &amp; Masked Coordinates");
      expect(html).toContain("Check-in Photo Evidence Requirement");
      expect(html).toContain("Save Location Profile");
    });

    it("suppresses developer tracking codes from profile editor", () => {
      const html = renderWithRouter(
        <HostLocationProfileEditorPage />,
        "/host/locations/loc-cmb-fort-01"
      );
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("HD-003");
    });
  });

  describe("HD-004: Schedule & Calendar Editor", () => {
    it("renders weekly schedule matrix and Sri Lankan Poya & public holiday exceptions", () => {
      const html = renderWithRouter(
        <HostScheduleCalendarEditorPage />,
        "/host/locations/loc-cmb-fort-01/schedule"
      );
      expect(html).toContain("Operating Hours &amp; Holiday Exceptions");
      expect(html).toContain("Standard Weekly Schedule");
      expect(html).toContain("Monday");
      expect(html).toContain("Sunday");
      expect(html).toContain("Sri Lankan Poya &amp; Mercantile Exceptions");
      expect(html).toContain("Unduvap Full Moon Poya");
      expect(html).toContain("National Independence Day");
    });

    it("suppresses developer tracking codes from schedule editor", () => {
      const html = renderWithRouter(
        <HostScheduleCalendarEditorPage />,
        "/host/locations/loc-cmb-fort-01/schedule"
      );
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("HD-004");
    });
  });

  describe("HD-005: Capacity Pools & Zones", () => {
    it("renders capacity aggregate, physical zone cards, and slot weight multipliers", () => {
      const html = renderWithRouter(
        <HostCapacityPoolsZonesPage />,
        "/host/locations/loc-cmb-fort-01/capacity"
      );
      expect(html).toContain("Capacity Pools &amp; Storage Zones");
      expect(html).toContain("Aggregate Venue Capacity");
      expect(html).toContain("Bag Category Slot Weight Equivalents");
      expect(html).toContain("Small Backpack:");
      expect(html).toContain("Cabin Trolley:");
      expect(html).toContain("Main Locked Steel Rack A");
      expect(html).toContain("Add Storage Zone");
    });

    it("suppresses developer tracking codes from capacity editor", () => {
      const html = renderWithRouter(
        <HostCapacityPoolsZonesPage />,
        "/host/locations/loc-cmb-fort-01/capacity"
      );
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("HD-005");
    });
  });

  describe("HD-006: Pricing Rules & Multipliers", () => {
    it("renders tiered rate matrix, configurable grace period, and late fee policies", () => {
      const html = renderWithRouter(
        <HostPricingRulesMultipliersPage />,
        "/host/locations/loc-cmb-fort-01/pricing"
      );
      expect(html).toContain("Pricing Rules &amp; Multipliers");
      expect(html).toContain("Standard Tiered Storage Rates (LKR)");
      expect(html).toContain("SMALL");
      expect(html).toContain("MEDIUM");
      expect(html).toContain("LARGE");
      expect(html).toContain("OVERSIZED");
      expect(html).toContain("Late Collection Grace Period &amp; Fee Policy");
      expect(html).toContain("Configurable Grace Period (Minutes)");
      expect(html).toContain("Late Collection Surcharge Policy");
    });

    it("suppresses developer tracking codes from pricing rules", () => {
      const html = renderWithRouter(
        <HostPricingRulesMultipliersPage />,
        "/host/locations/loc-cmb-fort-01/pricing"
      );
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("HD-006");
    });
  });

  describe("HD-007 & HD-008: Booking Management Hub & Custody Investigation Drawer", () => {
    it("renders bookings table, status filter pills, and search input", () => {
      const html = renderWithRouter(<HostBookingManagementHubPage />, "/host/bookings");
      expect(html).toContain("Booking Management Hub");
      expect(html).toContain("Inspect Custody Evidence");
      expect(html).toContain("All Bookings");
      expect(html).toContain("Amaya Perera");
      expect(html).toContain("Liam O&#x27;Connor");
      expect(html).toContain("Investigate Custody");
    });

    it("renders custody audit timeline and seal details when inspecting booking", () => {
      const html = renderWithRouter(<HostBookingManagementHubPage />, "/host/bookings?inspect=bkg-1001");
      expect(html).toContain("Custody Evidence");
      expect(html).toContain("Custody Lifecycle Events");
      expect(html).toContain("Physical Intake Handover");
      expect(html).toContain("Tamper-Evident Security Seals Applied");
      expect(html).toContain("SEAL-LK-90211");
      expect(html).toContain("Traveller Information");
      expect(html).toContain("Amaya Perera");
      expect(html).toContain("Close Audit Dossier");
    });

    it("suppresses developer tracking codes from bookings hub and investigation drawer", () => {
      const html = renderWithRouter(<HostBookingManagementHubPage />, "/host/bookings?inspect=bkg-1001");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("HD-007");
      expect(html).not.toContain("HD-008");
    });
  });

  describe("HD-009: Check-In & Check-Out Desk", () => {
    it("renders counter kiosk, desktop prototype note, mode toggles, and seal input", () => {
      const html = renderWithRouter(<HostWebCheckInOutOperationsPage />, "/host/operations");
      expect(html).toContain("Check-In &amp; Check-Out Desk");
      expect(html).toContain("Desk Counter Active");
      expect(html).toContain("Intake Handover");
      expect(html).toContain("Release Pick-Up");
      expect(html).toContain("Desktop Counter Workstation (Local Prototype Simulation):");
      expect(html).toContain("Quick Test Records:");
      expect(html).toContain("Dynamic QR Scan Token (Primary)");
      expect(html).toContain("6-Digit Backup PIN (Rate-Limited Fallback)");
      expect(html).toContain("Reconciled Physical Bag Count");
      expect(html).toContain("Tamper-Evident Security Seal Serial");
      expect(html).toContain("Confirm Check-In Handover");
    });

    it("suppresses developer tracking codes from operations desk", () => {
      const html = renderWithRouter(<HostWebCheckInOutOperationsPage />, "/host/operations");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("HD-009");
    });
  });

  describe("HD-010: Financial Revenue & Ledger", () => {
    it("renders 85% net host earnings split, fee breakdown, and transaction ledger", () => {
      const html = renderWithRouter(<HostFinancialRevenueLedgerPage />, "/host/finance");
      expect(html).toContain("Financial Revenue &amp; Commission Ledger");
      expect(html).toContain("Gross Booking Volume");
      expect(html).toContain("Platform Fee (15%)");
      expect(html).toContain("Net Host Payout (85%)");
      expect(html).toContain("184,500");
      expect(html).toContain("Export CSV Ledger");
      expect(html).toContain("Recent Completed &amp; Cleared Bookings");
    });

    it("suppresses developer tracking codes from financial ledger", () => {
      const html = renderWithRouter(<HostFinancialRevenueLedgerPage />, "/host/finance");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("HD-010");
    });
  });

  describe("HD-011: Payout Accounts & History", () => {
    it("renders Commercial Bank of Ceylon account card and weekly CEFT batch statements", () => {
      const html = renderWithRouter(<HostPayoutAccountsHistoryPage />, "/host/payouts");
      expect(html).toContain("Payout Accounts &amp; Settlement History");
      expect(html).toContain("Commercial Bank of Ceylon PLC");
      expect(html).toContain("Colombo Fort Corporate Branch");
      expect(html).toContain("**** **** **** 8821");
      expect(html).toContain("CEFT / SLIPS");
      expect(html).toContain("Recent Weekly Batch Transfers");
      expect(html).toContain("BATCH-2026-W44");
    });

    it("suppresses developer tracking codes from payout accounts", () => {
      const html = renderWithRouter(<HostPayoutAccountsHistoryPage />, "/host/payouts");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("HD-011");
    });
  });

  describe("HD-012: Customer Reviews", () => {
    it("renders verified review list, star ratings, and host reply composer", () => {
      const html = renderWithRouter(<HostReviewManagementPage />, "/host/reviews");
      expect(html).toContain("Customer Reviews &amp; Reputation");
      expect(html).toContain("214 Verified Reviews");
      expect(html).toContain("Amaya Perera");
      expect(html).toContain("Liam O&#x27;Connor");
      expect(html).toContain("Official Host Response:");
      expect(html).toContain("Reply to");
      expect(html).toContain("Type official reply...");
    });

    it("suppresses developer tracking codes from customer reviews", () => {
      const html = renderWithRouter(<HostReviewManagementPage />, "/host/reviews");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("HD-012");
    });
  });

  describe("HD-013: Staff Management & RBAC", () => {
    it("renders active team directory, role scopes guide, and invite staff action", () => {
      const html = renderWithRouter(<HostStaffManagementRbacPage />, "/host/staff");
      expect(html).toContain("Staff Management &amp; Operational Access");
      expect(html).toContain("Invite Staff Member");
      expect(html).toContain("Host Owner Scope");
      expect(html).toContain("Host Staff Scope");
      expect(html).toContain("Active Team Directory");
      expect(html).toContain("Roshan Fernando");
      expect(html).toContain("Priyantha Wickramasinghe");
    });

    it("suppresses developer tracking codes from staff management", () => {
      const html = renderWithRouter(<HostStaffManagementRbacPage />, "/host/staff");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("HD-013");
    });
  });

  describe("HD-014: Business Profile & Legal", () => {
    it("renders corporate registration certificate (BRN), TIN/VAT status, and verified KYC", () => {
      const html = renderWithRouter(<HostBusinessProfileLegalPage />, "/host/settings");
      expect(html).toContain("Business Profile &amp; Legal Compliance");
      expect(html).toContain("KYC Profile Preview (Demo Simulation)");
      expect(html).toContain("Ceylon Transit Hospitality (Pvt) Ltd");
      expect(html).toContain("PV-00294812");
      expect(html).toContain("TIN-10928472-0001");
      expect(html).toContain("VAT-10928472-7000");
      expect(html).toContain("Certificate of Incorporation (Form 1 / Form 20)");
      expect(html).toContain("LKR 10,000,000 Public Liability Insurance Policy");
    });

    it("suppresses developer tracking codes from business settings", () => {
      const html = renderWithRouter(<HostBusinessProfileLegalPage />, "/host/settings");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("HD-014");
    });
  });

  describe("Product Governance & Audit Verifications (WS-4-HOST-WEB)", () => {
    it("enforces absence of unsupported claims across all surfaces", () => {
      const layoutHtml = renderWithRouter(<HostOverviewDashboardPage />, "/host/dashboard");
      expect(layoutHtml).not.toContain("Verified Commercial Storage Partner");
      expect(layoutHtml).toContain("Sample Host Partner Profile (Demo Preview)");

      const custodyHtml = renderWithRouter(
        <HostBookingManagementHubPage />,
        "/host/bookings?inspect=bkg-1001"
      );
      expect(custodyHtml).not.toContain("Server verified with QR primary scan");
      expect(custodyHtml).toContain("Prototype Intake: Handover recorded against demo session fixture");

      const payoutsHtml = renderWithRouter(<HostPayoutAccountsHistoryPage />, "/host/payouts");
      expect(payoutsHtml).not.toContain("Verified &amp; Active");
      expect(payoutsHtml).toContain("Sample Bank Record (Demo)");

      const kycHtml = renderWithRouter(<HostBusinessProfileLegalPage />, "/host/settings");
      expect(kycHtml).not.toContain("KYC Verified &amp; Compliant");
      expect(kycHtml).toContain("KYC Profile Preview (Demo Simulation)");
      expect(kycHtml).not.toContain(">Approved<");
      expect(kycHtml).toContain("Sample Verification Status");
    });

    it("renders explicit honest prototype notices across custody, operations, finance, and settings", () => {
      const opsHtml = renderWithRouter(<HostWebCheckInOutOperationsPage />, "/host/operations");
      expect(opsHtml).toContain("Desktop Counter Workstation (Local Prototype Simulation):");

      const financeHtml = renderWithRouter(<HostFinancialRevenueLedgerPage />, "/host/finance");
      expect(financeHtml).toContain("Financial Ledger (Demo Figures):");
      expect(financeHtml).toContain("Illustrative Friday batch estimate (DEC-006)");

      const payoutsHtml = renderWithRouter(<HostPayoutAccountsHistoryPage />, "/host/payouts");
      expect(payoutsHtml).toContain("Payout Accounts (Demo Record):");
      expect(payoutsHtml).toContain("Download Sample PDF (Demo Action)");

      const reviewsHtml = renderWithRouter(<HostReviewManagementPage />, "/host/reviews");
      expect(reviewsHtml).toContain("Customer Reviews (Demo Data):");

      const staffHtml = renderWithRouter(<HostStaffManagementRbacPage />, "/host/staff");
      expect(staffHtml).toContain("Team Management (Demo State):");

      const legalHtml = renderWithRouter(<HostBusinessProfileLegalPage />, "/host/settings");
      expect(legalHtml).toContain("Business Profile &amp; KYC (Demo Simulation):");
    });

    it("reconciles pending product decisions DEC-001, DEC-002, and DEC-006 with clear prototype labels", () => {
      const locationProfileHtml = renderWithRouter(
        <HostLocationProfileEditorPage />,
        "/host/locations/loc-cmb-fort-01"
      );
      expect(locationProfileHtml).toContain("Prototype Option: DEC-001 Pending PO Sign-Off");

      const pricingHtml = renderWithRouter(
        <HostPricingRulesMultipliersPage />,
        "/host/locations/loc-cmb-fort-01/pricing"
      );
      expect(pricingHtml).toContain("DEC-002 Pending PO Sign-Off");
      expect(pricingHtml).toContain("baggage release is never withheld for overdue fee collection");
      expect(pricingHtml).toContain("Late Collection Surcharge Policy (Illustrative Prototype)");

      const financeHtml = renderWithRouter(<HostFinancialRevenueLedgerPage />, "/host/finance");
      expect(financeHtml).toContain("DEC-006 Pending PO Sign-Off");

      const payoutsHtml = renderWithRouter(<HostPayoutAccountsHistoryPage />, "/host/payouts");
      expect(payoutsHtml).toContain("DEC-006 Pending PO Sign-Off");
    });

    it("enforces staff role restriction guard with MascotIllustration on owner-only routes", () => {
      // Simulate authenticated HOST_STAFF user
      const mockStaffUser: AuthenticatedUser = {
        id: "usr-staff-test",
        email: "staff@example.com",
        displayName: "Staff Counter User",
        status: "ACTIVE",
        isEmailVerified: true,
        isPhoneVerified: false,
        roles: ["HOST_STAFF"],
        lastLoginAt: new Date().toISOString()
      };

      useAuthStore.setState({
        isAuthenticated: true,
        user: mockStaffUser
      });

      try {
        const staffRestrictedHtml = renderWithRouter(
          <HostFinancialRevenueLedgerPage />,
          "/host/finance?role=staff"
        );
        expect(staffRestrictedHtml).toContain("Host Owner Authorization Required");
        expect(staffRestrictedHtml).toContain(
          "Staff account permissions restricted to counter operations."
        );
        expect(staffRestrictedHtml).toContain("Return to Check-In &amp; Out Desk");
      } finally {
        useAuthStore.getState().clearAuth();
      }
    });
  });
});
