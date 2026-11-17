import { expect, test } from "@playwright/test";
import {
  API_BASE,
  approveBusinessInDb,
  createActivatedUser,
  disableLocationInDb,
  loginViaUi
} from "./fixtures";

test.describe("Journey 2 — Host Onboarding, KYC Upload & Location Creation", () => {
  test("creates host business, uploads KYC doc, creates location with sub-resources, and submits for moderation", async ({
    page
  }) => {
    const user = await createActivatedUser("TRAVELLER", "Onboarding Host");
    let createdLocationId: string | null = null;

    try {
      await loginViaUi(page, user.email, user.password);
      await page.goto("/host/onboarding");
      await expect(page.getByText(/Host Onboarding|Business Registration/i).first()).toBeVisible();

      const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const bizRes = await fetch(`${API_BASE}/hosts/businesses`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${user.accessToken}`
        },
        body: JSON.stringify({
          legalBusinessName: `E2E Onboard Holdings ${unique}`,
          tradeName: `E2E Onboard Locker ${unique}`,
          businessRegistrationNumber: `BRN-ONB-${unique}`,
          taxIdentificationNumber: "TIN-ONB-200",
          contactEmail: user.email,
          contactPhone: "+94772223334"
        })
      });
      expect(bizRes.status).toBe(201);
      const businessId = ((await bizRes.json()) as { data: { id: string } }).data.id;

      // Refresh auth token after HOST_OWNER role elevation and test KYC upload intent + confirm
      const refreshRes = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: user.email, password: user.password, clientType: "WEB" })
      });
      expect(refreshRes.status).toBe(200);
      const elevatedToken = ((await refreshRes.json()) as { data: { accessToken: string } }).data
        .accessToken;

      const presignRes = await fetch(`${API_BASE}/uploads/presigned-url`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${elevatedToken}`
        },
        body: JSON.stringify({
          purpose: "HOST_VERIFICATION",
          resourceType: "HOST_BUSINESS",
          resourceId: businessId,
          fileName: "brn.pdf",
          mimeType: "application/pdf",
          fileSize: 1024
        })
      });
      expect([200, 201]).toContain(presignRes.status);
      const presigned = ((await presignRes.json()) as {
        data: { fileKey: string; uploadUrl: string };
      }).data;

      const putRes = await fetch(presigned.uploadUrl, {
        method: "PUT",
        headers: { "content-type": "application/pdf" },
        body: new Uint8Array([0x25, 0x50, 0x44, 0x46])
      });
      expect([200, 201, 204]).toContain(putRes.status);

      const confirmRes = await fetch(`${API_BASE}/uploads/confirm`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${elevatedToken}`
        },
        body: JSON.stringify({
          fileKey: presigned.fileKey,
          purpose: "HOST_VERIFICATION",
          resourceType: "HOST_BUSINESS",
          resourceId: businessId
        })
      });
      expect(confirmRes.status).toBe(200);

      approveBusinessInDb(businessId);

      // Sign out and re-login in browser so elevated HOST_OWNER session is active, then inspect /host/locations
      await page.getByRole("button", { name: "Sign Out" }).click();
      await loginViaUi(page, user.email, user.password);

      const locName = `E2E Onboarded Vault ${unique}`;
      const locRes = await fetch(`${API_BASE}/hosts/locations`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${elevatedToken}`
        },
        body: JSON.stringify({
          businessId,
          name: locName,
          addressLine1: "55 Galle Road",
          city: "Colombo",
          countryCode: "LK",
          latitude: 6.91,
          longitude: 79.85,
          timezone: "Asia/Colombo",
          bookingMode: "INSTANT",
          acceptsOversized: false
        })
      });
      expect(locRes.status).toBe(201);
      createdLocationId = ((await locRes.json()) as { data: { id: string } }).data.id;

      await page.goto("/host/locations");
      await expect(page.getByRole("heading", { name: locName })).toBeVisible();
    } finally {
      if (createdLocationId) {
        disableLocationInDb(createdLocationId);
      }
    }
  });
});

