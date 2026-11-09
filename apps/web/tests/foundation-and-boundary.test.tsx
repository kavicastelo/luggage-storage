import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { Button } from "../src/components/ui/Button";
import { Input } from "../src/components/ui/Input";
import { Badge } from "../src/components/ui/Badge";
import { Alert } from "../src/components/ui/Alert";
import { MascotIllustration } from "../src/components/ui/MascotIllustration";
import { AppShell } from "../src/components/layout/AppShell";
import { DeveloperDrawer } from "../src/components/layout/DeveloperDrawer";



describe("CWCP Shared Foundation & Production Boundary Verification", () => {
  describe("Button Component Primitives", () => {
    it("renders primary button with accessible terracotta token and 44px min-touch target", () => {
      const html = renderToString(<Button variant="primary">Book Now</Button>);
      expect(html).toContain("bg-terracotta-500");
      expect(html).toContain("text-white");
      expect(html).toContain("min-h-[44px]");
      expect(html).toContain("Book Now");
    });

    it("renders secondary button with coastal navy grounding token", () => {
      const html = renderToString(<Button variant="secondary">Host Portal</Button>);
      expect(html).toContain("bg-navy-900");
      expect(html).toContain("text-white");
    });

    it("renders loading spinner and sets aria-busy when isLoading is true", () => {
      const html = renderToString(<Button isLoading>Submitting</Button>);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("animate-spin");
      expect(html).toContain("disabled");
    });
  });

  describe("Input Component Primitives", () => {
    it("renders input with accessible label and 44px min-height", () => {
      const html = renderToString(
        <Input label="Pickup Location" placeholder="Search station" />
      );
      expect(html).toContain("Pickup Location");
      expect(html).toContain("min-h-[44px]");
      expect(html).toContain('placeholder="Search station"');
    });

    it("renders accessible error message with role='alert' and aria-invalid", () => {
      const html = renderToString(
        <Input label="Luggage Count" error="Maximum 10 bags allowed" />
      );
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('role="alert"');
      expect(html).toContain("Maximum 10 bags allowed");
      expect(html).toContain("border-rose-500");
    });
  });

  describe("Badge & Alert Component Primitives", () => {
    it("renders semantic status badges with corresponding CWCP tokens", () => {
      const successHtml = renderToString(<Badge variant="success">Active Custody</Badge>);
      expect(successHtml).toContain("bg-emerald-50");
      expect(successHtml).toContain("text-emerald-800");

      const brandHtml = renderToString(<Badge variant="brand" dot>Featured</Badge>);
      expect(brandHtml).toContain("bg-terracotta-100");
      expect(brandHtml).toContain("text-terracotta-800");
    });

    it("renders alerts with appropriate ARIA roles", () => {
      const dangerAlert = renderToString(
        <Alert variant="danger" title="Payment Failed">
          Please check your card details.
        </Alert>
      );
      expect(dangerAlert).toContain('role="alert"');
      expect(dangerAlert).toContain("bg-rose-50");
      expect(dangerAlert).toContain("Payment Failed");

      const infoAlert = renderToString(
        <Alert variant="info" title="Store Operating Hours">
          Open 8:00 AM - 10:00 PM daily.
        </Alert>
      );
      expect(infoAlert).toContain('role="status"');
      expect(infoAlert).toContain("bg-sky-50");
    });
  });

  describe("Mascot Asset Derivative Integration", () => {
    it("renders responsive <picture> with WebP source and fallback original PNG", () => {
      const html = renderToString(<MascotIllustration mascot="wave" size="md" />);
      expect(html).toContain("<picture>");
      expect(html).toContain('/assets/mascots/webp/LS-mascot_01_wave.webp');
      expect(html).toContain('type="image/webp"');
      expect(html).toContain('src="/assets/mascots/LS-mascot_01_wave.png"');
      expect(html).toContain('alt="Kiri the Sri Lankan palm squirrel mascot waving warmly with an LS luggage satchel"');
    });
  });

  describe("Production Boundary & Developer Code Suppression", () => {
    it("guarantees customer-facing AppShell does not leak internal tracking codes in production", () => {
      const html = renderToString(
        <MemoryRouter>
          <AppShell />
        </MemoryRouter>
      );

      // Verify clean customer-facing copy exists
      expect(html).toContain("Find Storage");
      expect(html).toContain("How It Works");
      expect(html).toContain("Become a Host");
      expect(html).toContain("LuggageStorage");

      // Verify internal tracking codes are NOT leaked in customer-facing links
      expect(html).not.toContain("Find Storage (PW-002)");
      expect(html).not.toContain("Traveller Web (11)");
      expect(html).not.toContain("Host Hub (14)");
      expect(html).not.toContain("Admin Hub (18)");
      expect(html).not.toContain("PW-001 Landing Page");
      expect(html).not.toContain("HD-001 Host Overview");
      expect(html).not.toContain("AD-001 Command Dashboard");
    });

    it("verifies DeveloperDrawer has DEV compile-time guard", () => {
      // In this test environment, import.meta.env.DEV is boolean
      const html = renderToString(
        <MemoryRouter>
          <DeveloperDrawer />
        </MemoryRouter>
      );
      // If DEV is false, it must render empty string
      if (!import.meta.env.DEV) {
        expect(html).toBe("");
      } else {
        expect(html).toContain("Developer Diagnostics");
      }
    });
  });

});
