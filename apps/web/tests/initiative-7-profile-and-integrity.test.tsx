import React from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_PERMISSIONS, type AuthenticatedUser } from "@luggage-storage/contracts";
import { HostLocationManagementPage } from "@/features/host";
import { LocationProfileDetailPage } from "@/features/traveller/LocationDetailPage";
import { authApi } from "@/services/auth-api";
import { marketplaceApi } from "@/services/marketplace-api";
import { ProfilePage } from "@/pages/ProfilePage";
import { useAuthStore } from "@/store/useAuthStore";

const ORIGINAL_AUTH_INITIAL_STATE = { ...useAuthStore.getInitialState() };

function setAuth(user: AuthenticatedUser, permissions: string[]) {
  const patch = {
    user,
    sessionId: "sess-internal-secret-uuid",
    permissions,
    isAuthenticated: true,
    isInitializing: false,
    isLoading: false,
    error: null,
    logoutWarning: null
  };
  Object.assign(useAuthStore.getInitialState(), patch);
  useAuthStore.setState(patch);
}

describe("Initiative 7 Web — Profile Completion & Data Integrity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.assign(useAuthStore.getInitialState(), ORIGINAL_AUTH_INITIAL_STATE);
    useAuthStore.setState(ORIGINAL_AUTH_INITIAL_STATE);
  });

  it("1. authApi exposes getIdentityProfile and updateIdentityProfile against /identity/profile", async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(
        JSON.stringify({
          success: true,
          data: {
            profile: {
              id: "11111111-1111-4111-8111-111111111111",
              email: "traveller@example.com",
              displayName: "Kasun",
              phoneNumber: "+94771234567",
              status: "ACTIVE",
              isEmailVerified: true,
              isPhoneVerified: false,
              roles: ["TRAVELLER"],
              lastLoginAt: null,
              passwordChangedAt: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
              travellerProfile: null,
              hostProfile: null
            },
            message: "Profile updated successfully"
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const fetched = await authApi.getIdentityProfile();
    expect(fetched.profile.displayName).toBe("Kasun");
    expect(fetchMock.mock.calls[0][0]).toContain("/identity/profile");

    const updated = await authApi.updateIdentityProfile({
      displayName: "Kasun Perera",
      traveller: { preferredCurrency: "LKR" }
    });
    expect(updated.message).toBe("Profile updated successfully");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
  });

  it("2. ProfilePage renders Edit Profile controls and hides internal sessionId and raw permission codes", () => {
    setAuth(
      {
        id: "11111111-1111-4111-8111-111111111111",
        email: "traveller@example.com",
        displayName: "Nimali",
        status: "ACTIVE",
        isEmailVerified: true,
        isPhoneVerified: false,
        roles: ["TRAVELLER"],
        lastLoginAt: null
      },
      [SYSTEM_PERMISSIONS.ADMIN_AUDIT_READ]
    );

    const html = renderToString(
      <MemoryRouter initialEntries={["/profile"]}>
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(html).toContain("Nimali");
    expect(html).toContain("Edit Profile");
    expect(html).toContain("Personal &amp; Contact Details");
    expect(html).toContain("Traveller");
    expect(html).not.toContain("sess-internal-secret-uuid");
    expect(html).not.toContain("Active Session ID");
    expect(html).not.toContain("Effective Permissions");
    expect(html).not.toContain(SYSTEM_PERMISSIONS.ADMIN_AUDIT_READ);
  });

  it("3. LocationDetailPage and HostLocationsListPage do not render fabricated 08:00-20:00 or LKR 250k Protection", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(marketplaceApi, "getPublicLocationDetails").mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Galle Unconfigured Hub",
      description: "Test venue",
      city: "Galle",
      countryCode: "LK",
      approximateArea: "Galle District",
      approximateLatitude: 6.05,
      approximateLongitude: 80.22,
      timezone: "Asia/Colombo",
      bookingMode: "INSTANT",
      acceptsOversized: false,
      amenities: [],
      status: "ACTIVE",
      primaryImageUrl: null,
      images: [],
      currency: "LKR",
      averageRating: null,
      reviewCount: 0,
      is24Hours: false,
      operatingHoursStatus: "UNCONFIGURED",
      operatingHoursSummary: null,
      openingHours: [],
      upcomingExceptions: [],
      pricingPolicy: null,
      capacitySummary: null
    });

    const detailHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/locations/22222222-2222-4222-8222-222222222222"]}>
          <Routes>
            <Route path="/locations/:id" element={<LocationProfileDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(detailHtml).not.toContain("08:00 - 20:00");

    const hostHtml = renderToString(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/host/locations"]}>
          <Routes>
            <Route path="/host/locations" element={<HostLocationManagementPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(hostHtml).not.toContain("LKR 250k Protection");
    expect(hostHtml).not.toContain("08:00 - 20:00 IST");
  });
});

