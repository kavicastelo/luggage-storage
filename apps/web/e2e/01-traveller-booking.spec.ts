import { expect, test } from "@playwright/test";
import {
  API_BASE,
  createActivatedUser,
  disableLocationInDb,
  loginViaUi,
  provisionActiveLocation
} from "./fixtures";

test.describe("Journey 1 — Traveller Discovery, Booking, Payment & QR Custody Pass", () => {
  test("authenticates traveller, discovers live location, completes sandbox payment, and renders QR/PIN custody pass", async ({
    page
  }) => {
    const owner = await createActivatedUser("HOST_OWNER", "Colombo E2E Host");
    const traveller = await createActivatedUser("TRAVELLER", "Colombo E2E Traveller");
    const { locationId, locationName } = await provisionActiveLocation(
      owner.accessToken,
      owner.email,
      "Colombo"
    );

    try {
      await loginViaUi(page, traveller.email, traveller.password);

      // 1. Discovery & Location Detail
      await page.goto("/search?city=Colombo");
      await expect(page.getByRole("heading", { name: locationName })).toBeVisible();
      await page.getByRole("heading", { name: locationName }).click();

      await page.goto(`/locations/${locationId}`);
      await expect(page.getByRole("heading", { name: locationName })).toBeVisible();

      // 2. Create booking + sandbox payment simulation (deterministic external boundary)
      const future = new Date(Date.now() + 4 * 86400_000);
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
          idempotencyKey: `e2e-j1-${Date.now()}`
        })
      });
      expect(bookingRes.status).toBe(201);
      const booking = ((await bookingRes.json()) as {
        data: { id: string; referenceCode: string };
      }).data;

      // Verify unpaid booking state first in portal
      await page.goto(`/portal?bookingId=${booking.id}`);
      await expect(page.getByText(booking.referenceCode)).toBeVisible();

      const intentRes = await fetch(`${API_BASE}/payments/intents`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${traveller.accessToken}`
        },
        body: JSON.stringify({
          bookingId: booking.id,
          channel: "WEB",
          idempotencyKey: `e2e-j1-pay-${Date.now()}`,
          customerDetails: {
            firstName: "Colombo",
            lastName: "Traveller",
            email: traveller.email,
            phone: "+94771234567",
            address: "100 Main Street",
            city: "Colombo",
            country: "Sri Lanka"
          }
        })
      });
      expect(intentRes.status).toBe(201);
      const intentId = ((await intentRes.json()) as { data: { id: string } }).data.id;

      const simRes = await fetch(`${API_BASE}/payments/intents/${intentId}/sandbox-simulate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${traveller.accessToken}`
        },
        body: JSON.stringify({ outcome: "SUCCEEDED" })
      });
      expect(simRes.status).toBe(200);

      // 3. Reload portal, verify confirmed state & exact street address reveal, and issue QR/PIN pass
      await page.goto(`/portal?bookingId=${booking.id}`);
      await expect(page.getByText("100 York Street")).toBeVisible();

      const issuePassBtn = page.getByRole("button", { name: /Issue|Custody Pass|Generate/i }).first();
      if (await issuePassBtn.isVisible()) {
        await issuePassBtn.click();
      }
      await expect(page.getByText(/PIN|Drop-Off/i).first()).toBeVisible();
    } finally {
      disableLocationInDb(locationId);
    }
  });
});

