import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authApi } from "../src/services/auth-api";
import { marketplaceApi } from "../src/services/marketplace-api";

const BIZ_ID = "11111111-1111-4111-8111-111111111111";
const LOC_ID = "22222222-2222-4222-8222-222222222222";
const MEM_ID = "33333333-3333-4333-8333-333333333333";
const EX_ID = "44444444-4444-4444-8444-444444444444";
const TICKET_ID = "55555555-5555-4555-8555-555555555555";

describe("Initiative 7 Mobile — API Parity, Profile, Support & Staff Integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. authApi integrates GET and PATCH /identity/profile", async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: {
            profile: {
              id: BIZ_ID,
              email: "mobile@example.com",
              displayName: "Mobile User",
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

    const getRes = await authApi.getIdentityProfile();
    expect(getRes.profile.displayName).toBe("Mobile User");
    expect(fetchMock.mock.calls[0][0]).toContain("/identity/profile");

    const patchRes = await authApi.updateIdentityProfile({
      displayName: "Updated Mobile User",
      traveller: { preferredCurrency: "LKR" }
    });
    expect(patchRes.message).toBe("Profile updated successfully");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
  });

  it("2. marketplaceApi integrates Host Staff, Payout Batches, Exception Delete, and Support Tickets", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/staff")) {
        return new Response(
          JSON.stringify({ success: true, data: { staff: [], id: MEM_ID } }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.includes("/payout-batches")) {
        return new Response(
          JSON.stringify({ success: true, data: { batches: [] } }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.includes("/support/tickets/me/")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { id: TICKET_ID, referenceCode: "SUP-1", messages: [] }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.includes("/support/tickets/me")) {
        return new Response(
          JSON.stringify({ success: true, data: { tickets: [] } }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, data: { id: TICKET_ID, deleted: true } }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await marketplaceApi.getBusinessStaff(BIZ_ID);
    await marketplaceApi.inviteBusinessStaff(BIZ_ID, {
      email: "attendant@example.com",
      staffRole: "ATTENDANT",
      assignedLocationIds: [LOC_ID]
    });
    await marketplaceApi.updateBusinessStaff(BIZ_ID, MEM_ID, { isActive: false });
    await marketplaceApi.removeBusinessStaff(BIZ_ID, MEM_ID);
    await marketplaceApi.deleteOpeningHoursException(LOC_ID, EX_ID);
    await marketplaceApi.getHostPayoutBatches(BIZ_ID);
    await marketplaceApi.createSupportTicket({
      requesterName: "Kasun",
      requesterEmail: "kasun@example.com",
      category: "GENERAL_INQUIRY",
      subject: "Mobile inquiry",
      message: "Checking support ticket integration from mobile."
    });
    await marketplaceApi.getMySupportTickets();
    await marketplaceApi.getMySupportTicketDetail(TICKET_ID);
    await marketplaceApi.replyMySupportTicket(TICKET_ID, { message: "Follow up" });

    const calledUrls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes(`/hosts/businesses/${BIZ_ID}/staff`))).toBe(true);
    expect(calledUrls.some((u) => u.includes(`/hosts/locations/${LOC_ID}/exceptions/${EX_ID}`))).toBe(
      true
    );
    expect(calledUrls.some((u) => u.includes("/hosts/finance/payout-batches"))).toBe(true);
    expect(calledUrls.some((u) => u.includes("/support/tickets/me"))).toBe(true);
  });

  it("3. removes stale limitation copy, 08:00-20:00 checkout fallback, and internal debug fields from profile screen", () => {
    const mobileRoot = path.resolve(__dirname, "..");
    const profileSrc = fs.readFileSync(path.join(mobileRoot, "app/(account)/profile.tsx"), "utf8");
    const settingsSrc = fs.readFileSync(path.join(mobileRoot, "app/(host)/settings.tsx"), "utf8");
    const editorSrc = fs.readFileSync(
      path.join(mobileRoot, "app/(host)/location-editor.tsx"),
      "utf8"
    );
    const checkoutSrc = fs.readFileSync(
      path.join(mobileRoot, "app/(traveller)/checkout.tsx"),
      "utf8"
    );
    const supportSrc = fs.readFileSync(
      path.join(mobileRoot, "app/(traveller)/(tabs)/support.tsx"),
      "utf8"
    );

    expect(profileSrc).not.toContain("Self-service profile editing is not exposed");
    expect(profileSrc).not.toContain("Effective Permissions");
    expect(profileSrc).not.toContain("sessionId");
    expect(settingsSrc).not.toContain(
      "Dedicated self-service staff invitation links are not currently exposed in the API"
    );
    expect(editorSrc).not.toContain("Existing exceptions are read-only on mobile.");
    expect(checkoutSrc).not.toContain('"08:00 - 20:00"');
    expect(supportSrc).toContain("useMySupportTicketsQuery");
    expect(supportSrc).toContain("useCreateSupportTicketMutation");
  });
});
