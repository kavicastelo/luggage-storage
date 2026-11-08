import { describe, it, expect } from "vitest";
import {
  UserProfileDataSchema,
  UserProfileResponseDataSchema,
  UpdateProfileRequestSchema,
  UpdateProfileResponseDataSchema,
  TravellerProfileSchema,
  HostProfileSummarySchema
} from "../src/index.js";

describe("Identity & Profile Contracts", () => {
  const mockUserId = "123e4567-e89b-12d3-a456-426614174000";
  const mockTravellerId = "223e4567-e89b-12d3-a456-426614174001";
  const mockHostId = "323e4567-e89b-12d3-a456-426614174002";

  it("should validate full UserProfileData structures", () => {
    const profile = {
      id: mockUserId,
      email: "traveller@example.com",
      displayName: "Jane Traveller",
      phoneNumber: "+94771234567",
      status: "ACTIVE" as const,
      isEmailVerified: true,
      isPhoneVerified: true,
      roles: ["TRAVELLER"],
      permissions: ["identity.profile.read", "identity.profile.update"],
      lastLoginAt: "2026-11-08T06:00:00.000Z",
      passwordChangedAt: "2026-11-08T05:00:00.000Z",
      createdAt: "2026-11-07T12:00:00.000Z",
      updatedAt: "2026-11-08T06:00:00.000Z",
      travellerProfile: {
        id: mockTravellerId,
        userId: mockUserId,
        firstName: "Jane",
        lastName: "Traveller",
        preferredLanguage: "en",
        preferredCurrency: "LKR" as const,
        emergencyContactName: "John Traveller",
        emergencyContactPhone: "+94777654321",
        createdAt: "2026-11-07T12:00:00.000Z",
        updatedAt: "2026-11-08T06:00:00.000Z"
      },
      hostProfile: null
    };

    expect(UserProfileDataSchema.parse(profile)).toEqual(profile);

    const responseEnvelope = { profile };
    expect(UserProfileResponseDataSchema.parse(responseEnvelope)).toEqual(responseEnvelope);
  });

  it("should validate host profile summary when present", () => {
    const hostProfile = {
      id: mockHostId,
      userId: mockUserId,
      displayName: "Colombo Central Locker Hub",
      contactEmail: "hub@colombo-lockers.lk",
      contactPhone: "+94112345678",
      hostType: "BUSINESS" as const,
      status: "ACTIVE" as const,
      createdAt: "2026-11-07T12:00:00.000Z",
      updatedAt: "2026-11-08T06:00:00.000Z"
    };

    expect(HostProfileSummarySchema.parse(hostProfile)).toEqual(hostProfile);
  });

  it("should validate TravellerProfile independently", () => {
    const traveller = {
      id: mockTravellerId,
      userId: mockUserId,
      firstName: "Alice",
      lastName: "Smith",
      preferredLanguage: "si",
      preferredCurrency: "LKR" as const,
      emergencyContactName: null,
      emergencyContactPhone: null,
      createdAt: "2026-11-07T12:00:00.000Z",
      updatedAt: "2026-11-08T06:00:00.000Z"
    };

    expect(TravellerProfileSchema.parse(traveller)).toEqual(traveller);
  });

  it("should validate profile update requests with partial fields", () => {
    const updateRequest = {
      displayName: "Jane Updated",
      phoneNumber: "+94779998877",
      traveller: {
        firstName: "Jane",
        lastName: "Doe",
        preferredLanguage: "en-US",
        preferredCurrency: "USD" as const,
        emergencyContactName: "Emergency Bob",
        emergencyContactPhone: "+14155552671"
      }
    };

    expect(UpdateProfileRequestSchema.parse(updateRequest)).toEqual(updateRequest);

    // Empty object is valid (all optional)
    expect(UpdateProfileRequestSchema.parse({})).toEqual({});
  });

  it("should validate UpdateProfileResponseData envelope", () => {
    const response = {
      profile: {
        id: mockUserId,
        email: "traveller@example.com",
        displayName: "Jane Updated",
        phoneNumber: null,
        status: "ACTIVE" as const,
        isEmailVerified: true,
        isPhoneVerified: false,
        roles: ["TRAVELLER"],
        lastLoginAt: null,
        passwordChangedAt: null,
        createdAt: "2026-11-07T12:00:00.000Z",
        updatedAt: "2026-11-08T06:00:00.000Z",
        travellerProfile: null,
        hostProfile: null
      },
      message: "Profile updated successfully"
    };

    expect(UpdateProfileResponseDataSchema.parse(response)).toEqual(response);
  });
});

