import { expect, test } from "@playwright/test";
import {
  API_BASE,
  createActivatedUser,
  disableLocationInDb,
  loginViaUi,
  provisionActiveLocation
} from "./fixtures";

test.describe("Journey 3 — Host Custody Operations & Staff RBAC", () => {
  test("performs check-in and clean check-out via Operations Desk and blocks staff from restricted finance", async ({
    browser,
    page
  }) => {
    const owner = await createActivatedUser("HOST_OWNER", "Custody E2E Host");
    const traveller = await createActivatedUser("TRAVELLER", "Custody E2E Traveller");
    const staffUser = await createActivatedUser("TRAVELLER", "Custody Counter Staff");
    const { businessId, locationId } = await provisionActiveLocation(
      owner.accessToken,
      owner.email,
      "Kandy"
    );

    try {
      // Assign staffUser as ATTENDANT
      const addStaffRes = await fetch(`${API_BASE}/hosts/businesses/${businessId}/staff`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${owner.accessToken}`
        },
        body: JSON.stringify({
          email: staffUser.email,
          staffRole: "ATTENDANT",
          assignedLocationIds: [locationId]
        })
      });
      expect(addStaffRes.status).toBe(201);

      // Create & pay booking
      const future = new Date(Date.now() + 6 * 86400_000);
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
          idempotencyKey: `e2e-j3-${Date.now()}`
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
          idempotencyKey: `e2e-j3-pay-${Date.now()}`,
          customerDetails: {
            firstName: "Custody",
            lastName: "Traveller",
            email: traveller.email,
            phone: "+94771234567",
            address: "100 Main Street",
            city: "Kandy",
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

      // Issue DROP_OFF custody pass
      const dropPassRes = await fetch(`${API_BASE}/bookings/${booking.id}/custody-pass`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${traveller.accessToken}`
        },
        body: JSON.stringify({ operation: "CHECK_IN" })
      });
      expect([200, 201]).toContain(dropPassRes.status);
      const dropPass = ((await dropPassRes.json()) as { data: { qrToken: string; pin: string } })
        .data;

      // Host Owner opens /host/operations and performs Check-In
      await loginViaUi(page, owner.email, owner.password);
      await page.goto(`/host/operations?ref=${encodeURIComponent(booking.referenceCode)}`);

      await page.getByPlaceholder("64-char QR hex token").fill(dropPass.qrToken);
      await page.getByRole("button", { name: "Confirm Check-In Handover" }).click();
      await expect(page.getByText(/IN_STORAGE|Checked In|Check-in completed/i).first()).toBeVisible();

      // Issue COLLECTION pass and perform clean Check-Out
      const collectPassRes = await fetch(`${API_BASE}/bookings/${booking.id}/custody-pass`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${traveller.accessToken}`
        },
        body: JSON.stringify({ operation: "COLLECTION" })
      });
      expect([200, 201]).toContain(collectPassRes.status);
      const collectPass = ((await collectPassRes.json()) as {
        data: { qrToken: string; pin: string };
      }).data;

      await page.getByRole("button", { name: "Release Pick-Up" }).click();
      await page.getByPlaceholder("64-char QR hex token").fill(collectPass.qrToken);
      await page.getByRole("button", { name: "Verify & Release Bags" }).click();
      await expect(page.getByText(/COMPLETED|Released|released/i).first()).toBeVisible();

      // Verify clean release did not create DISPUTED status
      const verifyBookingRes = await fetch(`${API_BASE}/bookings/${booking.id}`, {
        headers: { authorization: `Bearer ${traveller.accessToken}` }
      });
      const finalBooking = ((await verifyBookingRes.json()) as { data: { status: string } }).data;
      expect(finalBooking.status).toBe("COMPLETED");

      // Verify HOST_STAFF cannot access /host/finance
      const staffCtx = await browser.newContext();
      const staffPage = await staffCtx.newPage();
      try {
        await loginViaUi(staffPage, staffUser.email, staffUser.password);
        await staffPage.goto("/host/finance");
        await expect(staffPage.getByText(/Owner Access Required|Restricted/i).first()).toBeVisible();
      } finally {
        await staffCtx.close();
      }
    } finally {
      disableLocationInDb(locationId);
    }
  });
});

