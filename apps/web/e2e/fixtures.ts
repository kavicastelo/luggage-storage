import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const API_BASE = "http://127.0.0.1:3000/api/v1";
const REPO_ROOT = path.resolve(process.cwd(), "../..");

export interface E2EUser {
  userId: string;
  email: string;
  password: string;
  displayName: string;
  accessToken: string;
}

function runDbHelper(args: string[]): string {
  const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  return execFileSync(
    pnpmCmd,
    ["--filter", "@luggage-storage/api", "exec", "tsx", "scripts/e2e-db-helper.ts", ...args],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32"
    }
  );
}

export async function createActivatedUser(
  roleCode: "TRAVELLER" | "HOST_OWNER" | "SUPPORT" | "SUPERADMIN" = "TRAVELLER",
  displayName = "E2E Test User"
): Promise<E2EUser> {
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e_${unique}@example.com`;
  const password = "StrongPassword123!";

  const encodedName = Buffer.from(displayName, "utf8").toString("base64");
  const out = runDbHelper(["create-user", email, password, encodedName, roleCode]);
  const parsed = JSON.parse(out.trim().split(/\r?\n/).pop() || "{}") as { userId: string };
  const userId = parsed.userId;
  expect(userId).toBeTruthy();

  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, clientType: "WEB" })
  });
  expect(loginRes.status).toBe(200);
  const loginJson = (await loginRes.json()) as { data: { accessToken: string } };

  return {
    userId,
    email,
    password,
    displayName,
    accessToken: loginJson.data.accessToken
  };
}

export function approveBusinessInDb(businessId: string): void {
  runDbHelper(["approve-business", businessId]);
}

export function approveLocationInDb(locationId: string): void {
  runDbHelper(["approve-location", locationId]);
}

export function disableLocationInDb(locationId: string): void {
  runDbHelper(["disable-location", locationId]);
}

export async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

export async function provisionActiveLocation(
  ownerToken: string,
  ownerEmail: string,
  city = "Colombo"
): Promise<{ businessId: string; locationId: string; locationName: string; zoneId: string }> {
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const bizRes = await fetch(`${API_BASE}/hosts/businesses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      legalBusinessName: `E2E Storage Co ${unique}`,
      tradeName: `E2E Locker ${unique}`,
      businessRegistrationNumber: `BRN-E2E-${unique}`,
      taxIdentificationNumber: "TIN-E2E-100",
      contactEmail: ownerEmail,
      contactPhone: "+94771234567"
    })
  });
  expect(bizRes.status).toBe(201);
  const businessId = ((await bizRes.json()) as { data: { id: string } }).data.id;
  approveBusinessInDb(businessId);

  const locationName = `E2E Central Vault ${unique}`;
  const locRes = await fetch(`${API_BASE}/hosts/locations`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      businessId,
      name: locationName,
      description: "Automated Playwright E2E test vault",
      addressLine1: "100 York Street",
      city,
      countryCode: "LK",
      latitude: 6.9344,
      longitude: 79.8428,
      timezone: "Asia/Colombo",
      bookingMode: "INSTANT",
      acceptsOversized: true,
      amenities: ["CCTV"]
    })
  });
  expect(locRes.status).toBe(201);
  const locationId = ((await locRes.json()) as { data: { id: string } }).data.id;

  const zoneRes = await fetch(`${API_BASE}/hosts/locations/${locationId}/zones`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ownerToken}`
    },
    body: JSON.stringify({ name: "E2E Locker A", zoneType: "LOCKER" })
  });
  expect(zoneRes.status).toBe(201);
  const zoneId = ((await zoneRes.json()) as { data: { id: string } }).data.id;

  const poolsRes = await fetch(`${API_BASE}/hosts/locations/${locationId}/capacity-pools`, {
    headers: { authorization: `Bearer ${ownerToken}` }
  });
  expect(poolsRes.status).toBe(200);
  const pools = ((await poolsRes.json()) as { data: { pools: Array<{ id: string }> } }).data.pools;

  const capRes = await fetch(`${API_BASE}/hosts/capacity-pools/${pools[0].id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ownerToken}`
    },
    body: JSON.stringify({ zoneId, totalUnits: 25, isActive: true })
  });
  expect(capRes.status).toBe(200);

  const priceRes = await fetch(`${API_BASE}/hosts/locations/${locationId}/pricing`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      currency: "LKR",
      pricingUnit: "CALENDAR_DAY",
      baseRateMinor: 120000
    })
  });
  expect(priceRes.status).toBe(200);

  approveLocationInDb(locationId);
  return { businessId, locationId, locationName, zoneId };
}

