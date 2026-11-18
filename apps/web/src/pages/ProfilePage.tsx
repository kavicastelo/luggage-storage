import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CurrencyCodeSchema,
  UpdateProfileRequestSchema,
  type CurrencyCode,
  type UpdateProfileRequest,
  type UserProfileData
} from "@luggage-storage/contracts";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Clock,
  Edit3,
  Globe,
  KeyRound,
  Laptop,
  Mail,
  Phone,
  Save,
  Shield,
  User,
  X,
  XCircle
} from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { authApi } from "../services/auth-api";
import { useAuthStore } from "../store/useAuthStore";

const ROLE_DISPLAY_LABELS: Record<string, string> = {
  TRAVELLER: "Traveller",
  HOST_OWNER: "Host Partner",
  HOST_STAFF: "Host Staff",
  SUPPORT: "Support Specialist",
  SUPERADMIN: "Platform Administrator"
};

interface ProfileFormState {
  displayName: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  preferredLanguage: string;
  preferredCurrency: CurrencyCode;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

function buildFormState(profile: UserProfileData | null, fallbackDisplayName: string): ProfileFormState {
  return {
    displayName: profile?.displayName ?? fallbackDisplayName,
    phoneNumber: profile?.phoneNumber ?? "",
    firstName: profile?.travellerProfile?.firstName ?? "",
    lastName: profile?.travellerProfile?.lastName ?? "",
    preferredLanguage: profile?.travellerProfile?.preferredLanguage ?? "en",
    preferredCurrency: profile?.travellerProfile?.preferredCurrency ?? "LKR",
    emergencyContactName: profile?.travellerProfile?.emergencyContactName ?? "",
    emergencyContactPhone: profile?.travellerProfile?.emergencyContactPhone ?? ""
  };
}

export function ProfilePage() {
  const { user, refreshUser } = useAuthStore();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileFormState>(() =>
    buildFormState(null, user?.displayName ?? "")
  );

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      if (!user) return;
      setIsLoading(true);
      setLoadError(null);
      try {
        const res = await authApi.getIdentityProfile();
        if (!cancelled) {
          setProfile(res.profile);
          setForm(buildFormState(res.profile, user.displayName));
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load profile details.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user) {
    return null;
  }

  const effectiveDisplayName = profile?.displayName ?? user.displayName;
  const effectiveEmail = profile?.email ?? user.email;
  const effectiveStatus = profile?.status ?? user.status;
  const effectiveEmailVerified = profile?.isEmailVerified ?? user.isEmailVerified;
  const effectivePhoneVerified = profile?.isPhoneVerified ?? user.isPhoneVerified;
  const effectiveLastLogin = profile?.lastLoginAt ?? user.lastLoginAt ?? null;
  const effectiveRoles = profile?.roles ?? user.roles ?? [];

  const handleStartEdit = () => {
    setForm(buildFormState(profile, user.displayName));
    setSaveError(null);
    setSaveSuccess(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setForm(buildFormState(profile, user.displayName));
    setSaveError(null);
    setIsEditing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);

    const payload: UpdateProfileRequest = {
      displayName: form.displayName.trim(),
      phoneNumber: form.phoneNumber.trim() ? form.phoneNumber.trim() : null,
      traveller: {
        firstName: form.firstName.trim() ? form.firstName.trim() : null,
        lastName: form.lastName.trim() ? form.lastName.trim() : null,
        preferredLanguage: form.preferredLanguage.trim() || "en",
        preferredCurrency: form.preferredCurrency,
        emergencyContactName: form.emergencyContactName.trim()
          ? form.emergencyContactName.trim()
          : null,
        emergencyContactPhone: form.emergencyContactPhone.trim()
          ? form.emergencyContactPhone.trim()
          : null
      }
    };

    const parsed = UpdateProfileRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setSaveError(parsed.error.issues[0]?.message ?? "Please check your profile details.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await authApi.updateIdentityProfile(parsed.data);
      setProfile(res.profile);
      setForm(buildFormState(res.profile, res.profile.displayName));
      setIsEditing(false);
      setSaveSuccess(res.message || "Profile updated successfully.");
      await refreshUser();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save profile changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge variant="success" size="sm" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
            Active
          </Badge>
        );
      case "PENDING_VERIFICATION":
        return (
          <Badge variant="warning" size="sm" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
            Pending Verification
          </Badge>
        );
      case "SUSPENDED":
        return (
          <Badge variant="danger" size="sm" icon={<XCircle className="h-3.5 w-3.5" />}>
            Suspended
          </Badge>
        );
      case "DEACTIVATED":
        return (
          <Badge variant="neutral" size="sm" icon={<XCircle className="h-3.5 w-3.5" />}>
            Deactivated
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" size="sm">
            {status.replace(/_/g, " ")}
          </Badge>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* Profile Header Card */}
      <Card className="bg-white p-6 sm:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-terracotta-100 border-2 border-terracotta-200 flex items-center justify-center text-terracotta-700 font-extrabold text-2xl shrink-0">
              {effectiveDisplayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-extrabold text-navy-950">{effectiveDisplayName}</h1>
                {getStatusBadge(effectiveStatus)}
              </div>
              <p className="text-sm text-sand-700 flex items-center gap-1.5 mt-1 flex-wrap">
                <Mail className="h-4 w-4 text-sand-500" />
                <span>{effectiveEmail}</span>
                {effectiveEmailVerified ? (
                  <span className="inline-flex items-center gap-0.5 text-xs text-emerald-700 font-semibold">
                    (Verified)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-xs text-amber-700 font-semibold">
                    (Unverified)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {!isEditing && (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleStartEdit}
                className="flex-1 sm:flex-none"
              >
                <Edit3 className="h-4 w-4" />
                <span>Edit Profile</span>
              </Button>
            )}
            <Link
              to="/portal/bookings"
              className="min-h-[44px] flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-navy-900 bg-sand-100 hover:bg-sand-200 rounded-xl transition-colors"
            >
              <Briefcase className="h-4 w-4 text-terracotta-600" />
              <span>My Bookings</span>
            </Link>
            <Link
              to="/settings/security"
              className="min-h-[44px] flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-navy-900 bg-sand-100 hover:bg-sand-200 rounded-xl transition-colors"
            >
              <KeyRound className="h-4 w-4" />
              <span>Change Password</span>
            </Link>
            <Link
              to="/settings/sessions"
              className="min-h-[44px] flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-navy-900 bg-sand-100 hover:bg-sand-200 rounded-xl transition-colors"
            >
              <Laptop className="h-4 w-4" />
              <span>Active Sessions</span>
            </Link>
          </div>
        </div>

        {/* Verification Warning Banner if Unverified */}
        {!effectiveEmailVerified && (
          <Alert variant="warning" title="Email confirmation pending" className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs leading-relaxed">
              <span>
                Your email address is not yet verified. Check your inbox for the verification
                message. While in pending status, publishing luggage storage locations is restricted.
              </span>
              <Link
                to={`/verify-email?email=${encodeURIComponent(effectiveEmail)}`}
                className="min-h-[36px] inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-900 text-white font-bold hover:bg-amber-950 transition-colors whitespace-nowrap"
              >
                Verify Email Now
              </Link>
            </div>
          </Alert>
        )}

        {loadError && (
          <Alert variant="danger" className="mt-4">
            {loadError}
          </Alert>
        )}

        {saveSuccess && (
          <Alert variant="success" className="mt-4">
            {saveSuccess}
          </Alert>
        )}
      </Card>

      {/* Self-Service Profile Editor */}
      {isEditing ? (
        <Card className="bg-white p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center justify-between border-b border-sand-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-navy-950">Edit Personal Details</h2>
                <p className="text-xs text-sand-700">
                  Update your contact information, emergency contact, and travel preferences.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="min-h-[44px] px-3 inline-flex items-center gap-1 text-xs font-semibold text-sand-700 hover:text-navy-950 rounded-lg hover:bg-sand-100 transition-colors"
              >
                <X className="h-4 w-4" />
                <span>Cancel</span>
              </button>
            </div>

            {saveError && <Alert variant="danger">{saveError}</Alert>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-navy-900">Display Name *</span>
                <input
                  type="text"
                  required
                  maxLength={128}
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm text-navy-950 border border-sand-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-navy-900">Phone Number</span>
                <input
                  type="tel"
                  maxLength={32}
                  placeholder="+94771234567"
                  value={form.phoneNumber}
                  onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm text-navy-950 border border-sand-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-navy-900">First Name</span>
                <input
                  type="text"
                  maxLength={64}
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm text-navy-950 border border-sand-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-navy-900">Last Name</span>
                <input
                  type="text"
                  maxLength={64}
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm text-navy-950 border border-sand-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-navy-900">Preferred Language</span>
                <input
                  type="text"
                  maxLength={10}
                  placeholder="en"
                  value={form.preferredLanguage}
                  onChange={(e) => setForm((f) => ({ ...f, preferredLanguage: e.target.value }))}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm text-navy-950 border border-sand-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-navy-900">Preferred Currency</span>
                <select
                  value={form.preferredCurrency}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, preferredCurrency: e.target.value as CurrencyCode }))
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm text-navy-950 border border-sand-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                >
                  {CurrencyCodeSchema.options.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-navy-900">Emergency Contact Name</span>
                <input
                  type="text"
                  maxLength={128}
                  value={form.emergencyContactName}
                  onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm text-navy-950 border border-sand-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-navy-900">
                  Emergency Contact Phone (E.164, e.g. +94771234567)
                </span>
                <input
                  type="tel"
                  maxLength={32}
                  placeholder="+94777654321"
                  value={form.emergencyContactPhone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm text-navy-950 border border-sand-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-sand-200">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isSaving}>
                <Save className="h-4 w-4" />
                <span>{isSaving ? "Saving..." : "Save Profile"}</span>
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        /* Account & Traveller Details Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-white p-6">
            <h2 className="text-base font-bold text-navy-950 mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-terracotta-600" />
              <span>Personal &amp; Contact Details</span>
            </h2>
            {isLoading ? (
              <div className="space-y-3">
                <LoadingSkeleton variant="text" className="w-3/4" />
                <LoadingSkeleton variant="text" className="w-2/3" />
                <LoadingSkeleton variant="text" className="w-5/6" />
                <LoadingSkeleton variant="text" className="w-1/2" />
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-sand-100">
                  <dt className="text-sand-700">Full Name</dt>
                  <dd className="text-navy-950 font-semibold">
                    {[profile?.travellerProfile?.firstName, profile?.travellerProfile?.lastName]
                      .filter(Boolean)
                      .join(" ") || "Not set"}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-sand-100">
                  <dt className="text-sand-700 flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-sand-500" />
                    <span>Phone</span>
                  </dt>
                  <dd className="text-navy-950 font-semibold">
                    {profile?.phoneNumber || "Not set"}{" "}
                    <span className="text-xs text-sand-600 font-normal">
                      ({effectivePhoneVerified ? "Verified" : "Unverified"})
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-sand-100">
                  <dt className="text-sand-700">Emergency Contact</dt>
                  <dd className="text-navy-950 text-right font-medium">
                    {profile?.travellerProfile?.emergencyContactName ||
                    profile?.travellerProfile?.emergencyContactPhone ? (
                      <span>
                        {profile?.travellerProfile?.emergencyContactName || "Contact"}{" "}
                        {profile?.travellerProfile?.emergencyContactPhone
                          ? `(${profile.travellerProfile.emergencyContactPhone})`
                          : ""}
                      </span>
                    ) : (
                      "Not set"
                    )}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-sand-700">Last Login</dt>
                  <dd className="text-navy-950 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-sand-500" />
                    <span>
                      {effectiveLastLogin
                        ? new Date(effectiveLastLogin).toLocaleString()
                        : "Current session"}
                    </span>
                  </dd>
                </div>
              </dl>
            )}
          </Card>

          <Card className="bg-white p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-navy-950 mb-3 flex items-center gap-2">
                <Globe className="h-5 w-5 text-terracotta-600" />
                <span>Preferences</span>
              </h2>
              {isLoading ? (
                <div className="space-y-2.5">
                  <LoadingSkeleton variant="text" className="w-1/2" />
                  <LoadingSkeleton variant="text" className="w-1/3" />
                </div>
              ) : (
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between py-1 border-b border-sand-100">
                    <dt className="text-sand-700">Language</dt>
                    <dd className="text-navy-950 font-semibold">
                      {profile?.travellerProfile?.preferredLanguage ?? "en"}
                    </dd>
                  </div>
                  <div className="flex justify-between py-1">
                    <dt className="text-sand-700">Currency</dt>
                    <dd className="text-navy-950 font-semibold">
                      {profile?.travellerProfile?.preferredCurrency ?? "LKR"}
                    </dd>
                  </div>
                </dl>
              )}
            </div>

            <div>
              <h2 className="text-base font-bold text-navy-950 mb-3 flex items-center gap-2">
                <Shield className="h-5 w-5 text-terracotta-600" />
                <span>Account Access</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {effectiveRoles.length > 0 ? (
                  effectiveRoles.map((role) => (
                    <Badge key={role} variant="brand" size="md">
                      {ROLE_DISPLAY_LABELS[role] ?? role}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-sand-600">Standard Account</span>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
