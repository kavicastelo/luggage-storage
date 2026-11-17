import { expect, test } from "@playwright/test";
import { API_BASE, createActivatedUser, loginViaUi } from "./fixtures";

test.describe("Journey 6 — Authenticated Profile Management", () => {
  test("edits permitted profile fields, persists across reload, and rejects protected-field modifications", async ({
    page
  }) => {
    const user = await createActivatedUser("TRAVELLER", "Initial E2E User");

    await loginViaUi(page, user.email, user.password);
    await page.goto("/profile");

    await expect(page.getByRole("heading", { name: "Initial E2E User" })).toBeVisible();
    await expect(page.getByText("Active Session ID")).toHaveCount(0);
    await expect(page.getByText("Effective Permissions")).toHaveCount(0);

    await page.getByRole("button", { name: "Edit Profile" }).click();

    await page.getByLabel("Display Name *").fill("Nimali Fernando");
    await page.getByLabel("Phone Number").fill("+94771234567");
    await page.getByLabel("First Name").fill("Nimali");
    await page.getByLabel("Last Name").fill("Fernando");
    await page.getByLabel("Preferred Language").fill("en-LK");
    await page.getByLabel("Preferred Currency").selectOption("LKR");
    await page.getByLabel("Emergency Contact Name").fill("Ruwan Fernando");
    await page
      .getByLabel("Emergency Contact Phone (E.164, e.g. +94771234567)")
      .fill("+94779876543");

    await page.getByRole("button", { name: "Save Profile" }).click();
    await expect(page.getByText("Profile updated successfully")).toBeVisible();

    // Reload browser and confirm persisted values from PostgreSQL
    await page.reload();
    await expect(page.getByRole("heading", { name: "Nimali Fernando" })).toBeVisible();
    await expect(page.getByText("+94771234567")).toBeVisible();
    await expect(page.getByText("Ruwan Fernando (+94779876543)")).toBeVisible();

    // Attempt protected-field mass assignment directly against the API boundary
    const massAssignRes = await fetch(`${API_BASE}/identity/profile`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${user.accessToken}`
      },
      body: JSON.stringify({
        displayName: "Escalated",
        roles: ["SUPERADMIN"],
        status: "SUSPENDED"
      })
    });
    expect(massAssignRes.status).toBe(400);
  });
});

