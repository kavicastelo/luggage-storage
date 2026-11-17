import { eq } from "drizzle-orm";
import {
  CurrencyCode,
  HostProfileSummary,
  TravellerProfile,
  UpdateProfileRequest,
  UpdateProfileRequestSchema,
  UpdateProfileResponseData,
  UserProfileData,
  UserStatus
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";
import { auditService, AuditClientInfo, SecurityEventType } from "../audit/audit.service.js";
import { rbacService } from "../auth/rbac.service.js";

export class IdentityService {
  /**
   * Returns the authenticated user's profile, roles, permissions, and traveller/host sub-profiles.
   */
  async getProfile(userId: string): Promise<UserProfileData> {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw AppError.notFound("User profile not found");
    }

    const [roleRows, permissions, travellerRows, hostRows] = await Promise.all([
      db
        .select({ code: schema.roles.code })
        .from(schema.userRoles)
        .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
        .where(eq(schema.userRoles.userId, userId)),
      rbacService.getEffectivePermissions(userId),
      db
        .select()
        .from(schema.travellerProfiles)
        .where(eq(schema.travellerProfiles.userId, userId))
        .limit(1),
      db
        .select()
        .from(schema.hostProfiles)
        .where(eq(schema.hostProfiles.userId, userId))
        .limit(1)
    ]);

    const tRow = travellerRows[0];
    const hRow = hostRows[0];

    const travellerProfile: TravellerProfile | null = tRow
      ? {
          id: tRow.id,
          userId: tRow.userId,
          firstName: tRow.firstName,
          lastName: tRow.lastName,
          preferredLanguage: tRow.preferredLanguage,
          preferredCurrency: tRow.preferredCurrency as CurrencyCode,
          emergencyContactName: tRow.emergencyContactName,
          emergencyContactPhone: tRow.emergencyContactPhone,
          createdAt: tRow.createdAt.toISOString(),
          updatedAt: tRow.updatedAt.toISOString()
        }
      : null;

    const hostProfile: HostProfileSummary | null = hRow
      ? {
          id: hRow.id,
          userId: hRow.userId,
          displayName: hRow.displayName,
          contactEmail: hRow.contactEmail,
          contactPhone: hRow.contactPhone,
          hostType: hRow.hostType as HostProfileSummary["hostType"],
          status: hRow.status as HostProfileSummary["status"],
          createdAt: hRow.createdAt.toISOString(),
          updatedAt: hRow.updatedAt.toISOString()
        }
      : null;

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      phoneNumber: user.phoneNumber,
      status: user.status as UserStatus,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      roles: roleRows.map((r: { code: string }) => r.code),
      permissions,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      passwordChangedAt: user.passwordChangedAt ? user.passwordChangedAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      travellerProfile,
      hostProfile
    };
  }

  /**
   * Updates explicitly permitted profile fields for the authenticated user only.
   */
  async updateProfile(
    userId: string,
    rawInput: UpdateProfileRequest,
    clientInfo?: AuditClientInfo
  ): Promise<UpdateProfileResponseData> {
    const input = UpdateProfileRequestSchema.parse(rawInput);

    const [existingUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!existingUser) {
      throw AppError.notFound("User profile not found");
    }

    const now = new Date();
    const updatedUserFields: string[] = [];
    const updatedTravellerFields: string[] = [];

    await db.transaction(async (tx) => {
      if (input.displayName !== undefined || input.phoneNumber !== undefined) {
        const userPatch: {
          displayName?: string;
          phoneNumber?: string | null;
          updatedAt: Date;
        } = { updatedAt: now };

        if (input.displayName !== undefined) {
          userPatch.displayName = input.displayName;
          updatedUserFields.push("displayName");
        }
        if (input.phoneNumber !== undefined) {
          const normalizedPhone = input.phoneNumber ? input.phoneNumber.trim() : "";
          userPatch.phoneNumber = normalizedPhone.length > 0 ? normalizedPhone : null;
          updatedUserFields.push("phoneNumber");
        }

        await tx
          .update(schema.users)
          .set(userPatch)
          .where(eq(schema.users.id, userId));
      }

      if (input.traveller !== undefined) {
        const t = input.traveller;
        const travellerPatch: {
          firstName?: string | null;
          lastName?: string | null;
          preferredLanguage?: string;
          preferredCurrency?: string;
          emergencyContactName?: string | null;
          emergencyContactPhone?: string | null;
          updatedAt: Date;
        } = { updatedAt: now };

        if (t.firstName !== undefined) {
          travellerPatch.firstName = t.firstName;
          updatedTravellerFields.push("firstName");
        }
        if (t.lastName !== undefined) {
          travellerPatch.lastName = t.lastName;
          updatedTravellerFields.push("lastName");
        }
        if (t.preferredLanguage !== undefined) {
          travellerPatch.preferredLanguage = t.preferredLanguage;
          updatedTravellerFields.push("preferredLanguage");
        }
        if (t.preferredCurrency !== undefined) {
          travellerPatch.preferredCurrency = t.preferredCurrency;
          updatedTravellerFields.push("preferredCurrency");
        }
        if (t.emergencyContactName !== undefined) {
          travellerPatch.emergencyContactName = t.emergencyContactName;
          updatedTravellerFields.push("emergencyContactName");
        }
        if (t.emergencyContactPhone !== undefined) {
          travellerPatch.emergencyContactPhone = t.emergencyContactPhone;
          updatedTravellerFields.push("emergencyContactPhone");
        }

        await tx
          .insert(schema.travellerProfiles)
          .values({
            userId,
            firstName: t.firstName ?? null,
            lastName: t.lastName ?? null,
            preferredLanguage: t.preferredLanguage ?? "en",
            preferredCurrency: t.preferredCurrency ?? "LKR",
            emergencyContactName: t.emergencyContactName ?? null,
            emergencyContactPhone: t.emergencyContactPhone ?? null,
            updatedAt: now
          })
          .onConflictDoUpdate({
            target: schema.travellerProfiles.userId,
            set: travellerPatch
          });
      }

      await auditService.recordEvent({
        eventType: SecurityEventType.IDENTITY_PROFILE_UPDATED,
        userId,
        clientInfo,
        tx,
        metadata: {
          updatedUserFields,
          updatedTravellerFields
        }
      });
    });

    const profile = await this.getProfile(userId);
    return {
      profile,
      message: "Profile updated successfully"
    };
  }
}

export const identityService = new IdentityService();
