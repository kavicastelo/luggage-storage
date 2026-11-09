import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  PublicLandingPage,
  WebSearchDiscoveryPage,
  LocationProfileDetailPage,
  WebCheckoutSchedulePage,
  WebPaymentConfirmationPage,
  BecomeAHostLandingPage,
  HowItWorksPage,
  HelpCentreFaqPage,
  ContactUsPage,
  TermsPrivacyLegalPage,
  TravellerWebPortalPage
} from "../src/pages/PublicMarketplacePages";

function renderWithRouter(ui: React.ReactElement, initialRoute = "/") {
  return renderToString(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/" element={ui} />
        <Route path="/search" element={ui} />
        <Route path="/locations/:slug" element={ui} />
        <Route path="/checkout/:locId" element={ui} />
        <Route path="/booking/confirm" element={ui} />
        <Route path="/become-a-host" element={ui} />
        <Route path="/how-it-works" element={ui} />
        <Route path="/help" element={ui} />
        <Route path="/contact" element={ui} />
        <Route path="/terms" element={ui} />
        <Route path="/portal/bookings" element={ui} />
      </Routes>
    </MemoryRouter>
  );
}

const FORBIDDEN_DEVELOPER_PATTERN = /\b(PW|HD|AD|TM|HM)-\d{3}\b|\bWF-\d{3}\b|\bOQ-\d{3}\b/;

describe("Phase 2C.2 — Public Traveller Web Experience Verification", () => {
  describe("PW-001: Public Landing Page", () => {
    it("renders hospitality hero, search form, and transit hubs", () => {
      const html = renderWithRouter(<PublicLandingPage />, "/");
      expect(html).toContain("Explore Sri Lanka Hands-Free");
      expect(html).toContain("Verified Custody");
      expect(html).toContain("Colombo Fort &amp; Pettah");
      expect(html).toContain("Find Storage");
      expect(html).toContain("LKR 250,000 Protection");
      expect(html).toContain("How Verified Luggage Custody Works");
    });

    it("strictly suppresses internal developer tracking codes from customer DOM", () => {
      const html = renderWithRouter(<PublicLandingPage />, "/");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("PW-001");
      expect(html).not.toContain("data-screen-id");
    });
  });

  describe("PW-002: Web Search & Discovery", () => {
    it("renders city filter pills, listing cards, and interactive transit canvas", () => {
      const html = renderWithRouter(<WebSearchDiscoveryPage />, "/search?city=Colombo");
      expect(html).toContain("Find Luggage Storage in Sri Lanka");
      expect(html).toContain("All Sri Lanka");
      expect(html).toContain("Colombo");
      expect(html).toContain("Sri Lanka Transit Corridor Map");
      expect(html).toContain("Book Now");
      expect(html).toContain("Details");
    });

    it("suppresses developer tracking codes from search view", () => {
      const html = renderWithRouter(<WebSearchDiscoveryPage />, "/search");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("PW-002");
    });
  });

  describe("PW-003: Location Profile Detail", () => {
    it("renders location dossier, transparent LKR pricing, and privacy masking note", () => {
      const html = renderWithRouter(<LocationProfileDetailPage />, "/locations/colombo-fort-railway-hub");
      expect(html).toContain("About This Storage Facility");
      expect(html).toContain("Operating Hours");
      expect(html).toContain("Privacy-Preserving Address Masking");
      expect(html).toContain("Transparent LKR Pricing Card");
      expect(html).toContain("Dedicated Storage Compartments");
      expect(html).toContain("Book This Hub");
    });

    it("suppresses developer tracking codes from location profile", () => {
      const html = renderWithRouter(<LocationProfileDetailPage />, "/locations/colombo-fort-railway-hub");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("PW-003");
    });
  });

  describe("PW-004: Web Checkout & Schedule", () => {
    it("renders schedule inputs, bag selectors, itemized breakdown, and prototype notice", () => {
      const html = renderWithRouter(<WebCheckoutSchedulePage />, "/checkout/loc-cmb-fort-01");
      expect(html).toContain("Checkout &amp; Custody Schedule");
      expect(html).toContain("1. Drop-off &amp; Pick-up Schedule");
      expect(html).toContain("2. Select Bag Sizes &amp; Quantities");
      expect(html).toContain("Price Breakdown");
      expect(html).toContain("Total Payable");
      expect(html).toContain("Demo &amp; Prototype Mode");
      expect(html).toContain("Confirm Reservation &amp; View Custody Pass");
    });

    it("suppresses developer tracking codes from checkout flow", () => {
      const html = renderWithRouter(<WebCheckoutSchedulePage />, "/checkout/loc-cmb-fort-01");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("PW-004");
    });
  });

  describe("PW-005: Web Payment & Confirmation Pass", () => {
    it("renders printable Digital Custody Pass with QR payload, 6-digit PIN, and seal info", () => {
      const html = renderWithRouter(<WebPaymentConfirmationPage />, "/booking/confirm?loc=loc-cmb-fort-01");
      expect(html).toContain("Your Digital Custody Pass Is Ready");
      expect(html).toContain("Digital Custody Pass");
      expect(html).toContain("#LS-2026-8841");
      expect(html).toContain("482 910");
      expect(html).toContain("LS-CUSTODY://LS-2026-8841/HMAC-9F8A72B");
      expect(html).toContain("#SL-88410");
      expect(html).toContain("Print / Save Pass");
    });

    it("does not render artificial developer simulation state toggles", () => {
      const html = renderWithRouter(<WebPaymentConfirmationPage />, "/booking/confirm");
      expect(html).not.toContain("State: GATEWAY");
      expect(html).not.toContain("State: POLLING");
      expect(html).not.toContain("State: CONFIRMED");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("PW-005");
    });
  });

  describe("PW-006: Become a Host Landing", () => {
    it("renders host value proposition and 85% revenue share simulator", () => {
      const html = renderWithRouter(<BecomeAHostLandingPage />, "/become-a-host");
      expect(html).toContain("Monetize Unused Space");
      expect(html).toContain("85% net revenue");
      expect(html).toContain("Estimate Your Monthly Partner Earnings");
      expect(html).toContain("Why Host With Us?");
      expect(html).toContain("Apply to Host in Sri Lanka");
    });

    it("suppresses developer tracking codes from host landing", () => {
      const html = renderWithRouter(<BecomeAHostLandingPage />, "/become-a-host");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("PW-006");
      expect(html).not.toContain("HD-001");
    });
  });

  describe("PW-007: How It Works", () => {
    it("renders 4-step custody guide and decoupled return charter", () => {
      const html = renderWithRouter(<HowItWorksPage />, "/how-it-works");
      expect(html).toContain("How Our Custody &amp; Protection Protocol Works");
      expect(html).toContain("STEP 01");
      expect(html).toContain("Discover &amp; Reserve Storage Online");
      expect(html).toContain("Drop Off &amp; Apply Tamper-Evident Seals");
      expect(html).toContain("Decoupled Luggage Return");
    });

    it("suppresses developer tracking codes from how it works page", () => {
      const html = renderWithRouter(<HowItWorksPage />, "/how-it-works");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("PW-007");
    });
  });

  describe("PW-008: Help Centre & FAQs", () => {
    it("renders searchable FAQs and answers on offline PINs and refunds", () => {
      const html = renderWithRouter(<HelpCentreFaqPage />, "/help");
      expect(html).toContain("Help Centre &amp; Frequently Asked Questions");
      expect(html).toContain("What happens if counter QR scanning is unavailable");
      expect(html).toContain("What is the cancellation and refund policy");
      expect(html).toContain("Contact Support");
    });

    it("suppresses developer tracking codes from help centre", () => {
      const html = renderWithRouter(<HelpCentreFaqPage />, "/help");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("PW-008");
    });
  });

  describe("PW-009: Contact Us & Support", () => {
    it("renders customer care form, 24/7 hotline, and emergency protection info", () => {
      const html = renderWithRouter(<ContactUsPage />, "/contact");
      expect(html).toContain("Contact Customer Care &amp; Support");
      expect(html).toContain("Colombo Operations Desk");
      expect(html).toContain("+94 11 234 5678");
      expect(html).toContain("support@luggagestorage.lk");
      expect(html).toContain("Submit Support Request");
    });

    it("suppresses developer tracking codes from contact page", () => {
      const html = renderWithRouter(<ContactUsPage />, "/contact");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("PW-009");
    });
  });

  describe("PW-010: Terms, Privacy & Legal", () => {
    it("renders terms of service, PDPA notice, and mandatory release charter", () => {
      const html = renderWithRouter(<TermsPrivacyLegalPage />, "/terms");
      expect(html).toContain("Terms of Service, Privacy &amp; Legal Charter");
      expect(html).toContain("Marketplace Terms of Service");
      expect(html).toContain("Privacy &amp; PDPA Policy");
      expect(html).toContain("Custody &amp; Mandatory Release Charter");
    });

    it("suppresses developer tracking codes from legal page", () => {
      const html = renderWithRouter(<TermsPrivacyLegalPage />, "/terms");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("PW-010");
    });
  });

  describe("PW-011: Traveller Web Portal", () => {
    it("renders booking tabs, status pills, and 7-stage refund pipeline", () => {
      const html = renderWithRouter(<TravellerWebPortalPage />, "/portal/bookings");
      expect(html).toContain("Traveller Account Portal");
      expect(html).toContain("Active &amp; Upcoming");
      expect(html).toContain("Past Trips");
      expect(html).toContain("Refunds &amp; Settlements");
      expect(html).toContain("View Digital Custody Pass");
    });

    it("suppresses developer tracking codes from traveller portal", () => {
      const html = renderWithRouter(<TravellerWebPortalPage />, "/portal/bookings");
      expect(html).not.toMatch(FORBIDDEN_DEVELOPER_PATTERN);
      expect(html).not.toContain("PW-011");
    });
  });
});
