import { expect, test } from "@playwright/test";
import {
  API_BASE,
  createActivatedUser,
  disableLocationInDb,
  loginViaUi,
  provisionActiveLocation
} from "./fixtures";

test.describe("Journey 4 — Superadmin Governance, Dispute Adjudication & RBAC", () => {
  test("superadmin moderates location, adjudicates dispute, and ordinary traveller is blocked from admin", async ({
    browser,
    page
  }) => {
    const superadmin = await createActivatedUser("SUPERADMIN", "Superadmin E2E");
    const owner = await createActivatedUser("HOST_OWNER", "Moderation Host");
    const traveller = await createActivatedUser("TRAVELLER", "Dispute Traveller");
    const { locationId } = await provisionActiveLocation(
      owner.accessToken,
      owner.email,
      "Negombo"
    );

    try {
      // Create & pay booking, then raise exception so booking becomes DISPUTED
      const future = new Date(Date.now() + 7 * 86400_000);
      const yyyy = future.getUTCFullYear();
      const mm = String(future.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(future.getUTCDate()).padStart(2, "0");

      const bookingRes = await fetch(`${API_BASE}/bookings`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${traveller.accessToken}`
        },
        body: JSON.stringify({
          locationId,
          dropOffAt: `${yyyy}-${mm}-${dd}T04:30:00.000Z`,
          collectionAt: `${yyyy}-${mm}-${dd}T10:30:00.000Z`,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }],
          idempotencyKey: `e2e-j4-${Date.now()}`
        })
      });
      expect(bookingRes.status).toBe(201);
      const booking = ((await bookingRes.json()) as {
        data: { id: string; referenceCode: string };
      }).data;

      const intentRes = await fetch(`${API_BASE}/payments/intents`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${traveller.accessToken}`
        },
        body: JSON.stringify({
          bookingId: booking.id,
          channel: "WEB",
          idempotencyKey: `e2e-j4-pay-${Date.now()}`,
          customerDetails: {
            firstName: "Dispute",
            lastName: "Traveller",
            email: traveller.email,
            phone: "+94771234567",
            address: "100 Main Street",
            city: "Negombo",
            country: "Sri Lanka"
          }
        })
      });
      const intentId = ((await intentRes.json()) as { data: { id: string } }).data.id;
      await fetch(`${API_BASE}/payments/intents/${intentId}/sandbox-simulate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${traveller.accessToken}`
        },
        body: JSON.stringify({ outcome: "SUCCEEDED" })
      });

      const excRes = await fetch(`${API_BASE}/bookings/${booking.id}/exceptions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${traveller.accessToken}`
        },
        body: JSON.stringify({
          category: "OTHER",
          reason: "Playwright E2E dispute adjudication check"
        })
      });
      expect(excRes.status).toBe(200);

      // Superadmin opens /admin/locations and /admin/incidents
      await loginViaUi(page, superadmin.email, superadmin.password);
      await page.goto("/admin/locations");
      await expect(page.getByRole("heading", { name: /Location Moderation/i })).toBeVisible();

      await page.goto(`/admin/incidents?inspect=${booking.id}`);
      await expect(page.getByText(booking.referenceCode).first()).toBeVisible();

      await page
        .getByPlaceholder("Document seal evidence review and binding settlement outcome...")
        .fill("Verified seal integrity and upheld host payout in Playwright E2E.");
      await page.getByRole("button", { name: "Execute Dispute Ruling" }).click();
      await expect(page.getByText(/resolved|COMPLETED/i).first()).toBeVisible();

      // Ordinary traveller cannot access /admin
      const travCtx = await browser.newContext();
      const travPage = await travCtx.newPage();
      try {
        await loginViaUi(travPage, traveller.email, traveller.password);
        await travPage.goto("/admin");
        await expect(travPage).toHaveURL(/\/(forbidden|portal|$)/);
      } finally {
        await travCtx.close();
      }
    } finally {
      disableLocationInDb(locationId);
    }
  });
});

