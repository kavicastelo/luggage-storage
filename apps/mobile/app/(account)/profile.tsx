import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  CurrencyCodeSchema,
  UpdateProfileRequestSchema,
  type CurrencyCode,
  type UpdateProfileRequest,
  type UserProfileData
} from "@luggage-storage/contracts";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  MobileIcon,
  ScreenContainer,
  StatusBadge,
  TextInput
} from "../../src/components";
import { authApi } from "../../src/services/auth-api";
import { normalizeApiError } from "../../src/services/api-client";
import { useAuthStore } from "../../src/store/useAuthStore";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

const ROLE_DISPLAY_LABELS: Record<string, string> = {
  TRAVELLER: "Traveller",
  HOST_OWNER: "Host Partner",
  HOST_STAFF: "Host Staff",
  SUPPORT: "Support Specialist",
  SUPERADMIN: "Platform Administrator"
};

export default function MobileProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuthStore();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [preferredCurrency, setPreferredCurrency] = useState<CurrencyCode>("LKR");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const hydrateForm = (p: UserProfileData | null, fallbackName: string) => {
    setDisplayName(p?.displayName ?? fallbackName);
    setPhoneNumber(p?.phoneNumber ?? "");
    setFirstName(p?.travellerProfile?.firstName ?? "");
    setLastName(p?.travellerProfile?.lastName ?? "");
    setPreferredLanguage(p?.travellerProfile?.preferredLanguage ?? "en");
    setPreferredCurrency(p?.travellerProfile?.preferredCurrency ?? "LKR");
    setEmergencyContactName(p?.travellerProfile?.emergencyContactName ?? "");
    setEmergencyContactPhone(p?.travellerProfile?.emergencyContactPhone ?? "");
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) return;
      setIsLoadingProfile(true);
      setLoadError(null);
      try {
        const res = await authApi.getIdentityProfile();
        if (!cancelled) {
          setProfile(res.profile);
          hydrateForm(res.profile, user.displayName);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(normalizeApiError(err).message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Sign In Required"
          description="Sign in to view and manage your profile, preferences, and account security."
          icon="user"
          actionTitle="Sign In"
          onAction={() => router.replace("/(auth)/login")}
        />
      </ScreenContainer>
    );
  }

  const handleSaveProfile = async () => {
    setSaveError(null);
    setSaveSuccess(null);

    const payload: UpdateProfileRequest = {
      displayName: displayName.trim(),
      phoneNumber: phoneNumber.trim() ? phoneNumber.trim() : null,
      traveller: {
        firstName: firstName.trim() ? firstName.trim() : null,
        lastName: lastName.trim() ? lastName.trim() : null,
        preferredLanguage: preferredLanguage.trim() || "en",
        preferredCurrency,
        emergencyContactName: emergencyContactName.trim()
          ? emergencyContactName.trim()
          : null,
        emergencyContactPhone: emergencyContactPhone.trim()
          ? emergencyContactPhone.trim()
          : null
      }
    };

    const parsed = UpdateProfileRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setSaveError(parsed.error.issues[0]?.message ?? "Please check your profile inputs.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await authApi.updateIdentityProfile(parsed.data);
      setProfile(res.profile);
      hydrateForm(res.profile, res.profile.displayName);
      setIsEditing(false);
      setSaveSuccess(res.message || "Profile updated successfully.");
      await refreshUser();
    } catch (err) {
      setSaveError(normalizeApiError(err).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace("/");
    } finally {
      setIsLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  const effectiveDisplayName = profile?.displayName ?? user.displayName;
  const effectiveRoles = profile?.roles ?? user.roles;

  return (
    <ScreenContainer keyboardAvoiding testID="account-profile-screen">
      <Card variant="elevated" style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{effectiveDisplayName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.displayName}>{effectiveDisplayName}</Text>
        <Text style={styles.emailText}>{profile?.email ?? user.email}</Text>

        <View style={styles.badgeRow}>
          <StatusBadge status={profile?.status ?? user.status} size="sm" />
          <Badge
            label={
              (profile?.isEmailVerified ?? user.isEmailVerified)
                ? "Email Verified"
                : "Email Unverified"
            }
            variant={(profile?.isEmailVerified ?? user.isEmailVerified) ? "success" : "warning"}
            icon={
              (profile?.isEmailVerified ?? user.isEmailVerified)
                ? "check-circle"
                : "alert-circle"
            }
            size="sm"
          />
        </View>

        {!(profile?.isEmailVerified ?? user.isEmailVerified) ? (
          <View style={styles.verifyCallout}>
            <Text style={styles.verifyCalloutText}>
              Verify your email to create luggage bookings, change your password, or register as a
              host.
            </Text>
            <Button
              title="Verify Email Address"
              size="sm"
              onPress={() =>
                router.push({ pathname: "/(auth)/verify-email", params: { email: user.email } })
              }
              fullWidth
            />
          </View>
        ) : null}

        {!isEditing ? (
          <Button
            title="Edit Profile"
            size="sm"
            variant="outline"
            leftIcon={<MobileIcon name="edit" size="xs" />}
            onPress={() => {
              hydrateForm(profile, user.displayName);
              setSaveError(null);
              setSaveSuccess(null);
              setIsEditing(true);
            }}
            fullWidth
          />
        ) : null}
      </Card>

      {loadError ? (
        <Card variant="outlined" style={styles.errorCard}>
          <Text style={styles.errorText}>{loadError}</Text>
        </Card>
      ) : null}

      {saveSuccess ? (
        <Card variant="outlined" style={styles.successCard}>
          <Text style={styles.successText}>{saveSuccess}</Text>
        </Card>
      ) : null}

      {isEditing ? (
        <Card variant="default" style={styles.card}>
          <Text style={styles.sectionTitle}>Edit Profile</Text>
          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

          <TextInput
            label="Display Name *"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your display name"
          />
          <TextInput
            label="Phone Number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="+94771234567"
            keyboardType="phone-pad"
          />
          <TextInput
            label="First Name"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
          />
          <TextInput
            label="Last Name"
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
          />
          <TextInput
            label="Preferred Language"
            value={preferredLanguage}
            onChangeText={setPreferredLanguage}
            placeholder="en"
            autoCapitalize="none"
          />

          <Text style={styles.detailLabel}>Preferred Currency</Text>
          <View style={styles.chipsWrap}>
            {CurrencyCodeSchema.options.map((code) => {
              const selected = preferredCurrency === code;
              return (
                <TouchableOpacity
                  key={code}
                  style={[styles.currencyChip, selected ? styles.currencyChipActive : null]}
                  onPress={() => setPreferredCurrency(code)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.currencyChipText,
                      selected ? styles.currencyChipTextActive : null
                    ]}
                  >
                    {code}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            label="Emergency Contact Name"
            value={emergencyContactName}
            onChangeText={setEmergencyContactName}
            placeholder="Full name"
          />
          <TextInput
            label="Emergency Contact Phone (E.164)"
            value={emergencyContactPhone}
            onChangeText={setEmergencyContactPhone}
            placeholder="+94777654321"
            keyboardType="phone-pad"
          />

          <View style={styles.editActionsRow}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => {
                hydrateForm(profile, user.displayName);
                setSaveError(null);
                setIsEditing(false);
              }}
              disabled={isSaving}
            />
            <Button
              title="Save Changes"
              isLoading={isSaving}
              onPress={() => {
                void handleSaveProfile();
              }}
            />
          </View>
        </Card>
      ) : (
        <Card variant="default" style={styles.card}>
          <Text style={styles.sectionTitle}>Personal &amp; Traveller Details</Text>
          {isLoadingProfile ? (
            <Text style={styles.helperNote}>Loading profile details...</Text>
          ) : null}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Full Name</Text>
            <Text style={styles.detailValue}>
              {[profile?.travellerProfile?.firstName, profile?.travellerProfile?.lastName]
                .filter(Boolean)
                .join(" ") || "Not set"}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone Number</Text>
            <Text style={styles.detailValue}>{profile?.phoneNumber || "Not set"}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Preferences</Text>
            <Text style={styles.detailValue}>
              {profile?.travellerProfile?.preferredLanguage ?? "en"} •{" "}
              {profile?.travellerProfile?.preferredCurrency ?? "LKR"}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Emergency Contact</Text>
            <Text style={styles.detailValue}>
              {profile?.travellerProfile?.emergencyContactName ||
              profile?.travellerProfile?.emergencyContactPhone
                ? `${profile?.travellerProfile?.emergencyContactName ?? "Contact"} ${
                    profile?.travellerProfile?.emergencyContactPhone
                      ? `(${profile.travellerProfile.emergencyContactPhone})`
                      : ""
                  }`
                : "Not set"}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Account Access</Text>
            <View style={styles.chipsWrap}>
              {effectiveRoles.map((r) => (
                <Badge key={r} label={ROLE_DISPLAY_LABELS[r] ?? r} variant="navy" size="sm" />
              ))}
            </View>
          </View>
        </Card>
      )}

      <View style={styles.actions}>
        <Button
          title="Password & Security"
          variant="outline"
          leftIcon={<MobileIcon name="lock" size="sm" />}
          onPress={() => router.push("/(account)/security")}
          fullWidth
        />
        <Button
          title="Active Sessions"
          variant="outline"
          leftIcon={<MobileIcon name="smartphone" size="sm" />}
          onPress={() => router.push("/(account)/sessions")}
          fullWidth
        />
        <Button
          title="Sign Out"
          variant="danger"
          leftIcon={<MobileIcon name="log-out" size="sm" color={mobileColors.white} />}
          onPress={() => setConfirmLogout(true)}
          fullWidth
        />
      </View>

      <ConfirmDialog
        visible={confirmLogout}
        title="Sign Out"
        description="Sign out from this device?"
        confirmLabel="Sign Out"
        destructive
        icon="log-out"
        isLoading={isLoggingOut}
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    alignItems: "center",
    gap: mobileSpacing[2],
    marginBottom: mobileSpacing[4]
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.navy[900],
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    color: mobileColors.white,
    fontSize: 26,
    fontWeight: "800"
  },
  displayName: {
    ...mobileTypography.headingLg
  },
  emailText: {
    ...mobileTypography.bodyMd,
    color: mobileTextColors.muted
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: mobileSpacing[2],
    marginTop: mobileSpacing[1]
  },
  verifyCallout: {
    width: "100%",
    backgroundColor: mobileStatusTokens.warningBg,
    borderWidth: 1,
    borderColor: mobileStatusTokens.warningBorder,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing[3],
    gap: mobileSpacing[2],
    marginTop: mobileSpacing[2]
  },
  verifyCalloutText: {
    ...mobileTypography.bodySm,
    color: mobileStatusTokens.warning
  },
  card: {
    gap: mobileSpacing[3],
    marginBottom: mobileSpacing[4]
  },
  sectionTitle: {
    ...mobileTypography.headingSm
  },
  helperNote: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.muted
  },
  detailRow: {
    gap: 4,
    paddingVertical: mobileSpacing[1],
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.sand[100]
  },
  detailLabel: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.muted
  },
  detailValue: {
    ...mobileTypography.bodyMd,
    color: mobileColors.navy[950],
    fontWeight: "600"
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing[2]
  },
  currencyChip: {
    minHeight: 40,
    minWidth: 64,
    paddingHorizontal: mobileSpacing[3],
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.sand[100],
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    alignItems: "center",
    justifyContent: "center"
  },
  currencyChipActive: {
    backgroundColor: mobileColors.navy[900],
    borderColor: mobileColors.navy[900]
  },
  currencyChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileTextColors.primary
  },
  currencyChipTextActive: {
    color: mobileColors.white
  },
  editActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: mobileSpacing[2],
    marginTop: mobileSpacing[2]
  },
  errorCard: {
    borderColor: mobileStatusTokens.dangerBorder,
    backgroundColor: mobileStatusTokens.dangerBg,
    marginBottom: mobileSpacing[3]
  },
  errorText: {
    ...mobileTypography.bodySm,
    color: mobileStatusTokens.danger
  },
  successCard: {
    borderColor: mobileStatusTokens.successBorder,
    backgroundColor: mobileStatusTokens.successBg,
    marginBottom: mobileSpacing[3]
  },
  successText: {
    ...mobileTypography.bodySm,
    color: mobileStatusTokens.success
  },
  actions: {
    gap: mobileSpacing[3],
    marginBottom: mobileSpacing[6]
  }
});
