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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Active
          </span>
        );
      case "PENDING_VERIFICATION":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" />
            Pending Verification
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            <XCircle className="h-3.5 w-3.5" />
            Suspended
          </span>
        );
      case "DEACTIVATED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
            <XCircle className="h-3.5 w-3.5" />
            Deactivated
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Header Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 border-2 border-blue-200 flex items-center justify-center text-blue-600 font-bold text-2xl">
              {effectiveDisplayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{effectiveDisplayName}</h1>
                {getStatusBadge(effectiveStatus)}
              </div>
              <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                <Mail className="h-4 w-4" />
                <span>{effectiveEmail}</span>
                {effectiveEmailVerified ? (
                  <span className="inline-flex items-center gap-0.5 text-xs text-green-600 font-medium">
                    (Verified)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                    (Unverified)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {!isEditing && (
              <button
                type="button"
                onClick={handleStartEdit}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
              >
                <Edit3 className="h-4 w-4" />
                <span>Edit Profile</span>
              </button>
            )}
            <Link
              to="/settings/security"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              <KeyRound className="h-4 w-4" />
              <span>Change Password</span>
            </Link>
            <Link
              to="/settings/sessions"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              <Laptop className="h-4 w-4" />
              <span>Active Sessions</span>
            </Link>
          </div>
        </div>

        {/* Verification Warning Banner if Unverified */}
        {!effectiveEmailVerified && (
          <div className="mt-6 p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 leading-relaxed">
              <strong className="font-semibold">Email confirmation pending:</strong> Your email
              address is not yet verified. Check your inbox for the verification message. While in
              pending status, publishing luggage storage locations is restricted.
            </div>
          </div>
        )}

        {loadError && (
          <div
            role="alert"
            className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
          >
            {loadError}
          </div>
        )}

        {saveSuccess && (
          <div
            role="status"
            className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800 flex items-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}
      </div>

      {/* Self-Service Profile Editor */}
      {isEditing ? (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Edit Personal Details</h2>
              <p className="text-xs text-slate-500">
                Update your contact information, emergency contact, and travel preferences.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              <X className="h-4 w-4" />
              <span>Cancel</span>
            </button>
          </div>

          {saveError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
            >
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">Display Name *</span>
              <input
                type="text"
                required
                maxLength={128}
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">Phone Number</span>
              <input
                type="tel"
                maxLength={32}
                placeholder="+94771234567"
                value={form.phoneNumber}
                onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">First Name</span>
              <input
                type="text"
                maxLength={64}
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">Last Name</span>
              <input
                type="text"
                maxLength={64}
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">Preferred Language</span>
              <input
                type="text"
                maxLength={10}
                placeholder="en"
                value={form.preferredLanguage}
                onChange={(e) => setForm((f) => ({ ...f, preferredLanguage: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">Preferred Currency</span>
              <select
                value={form.preferredCurrency}
                onChange={(e) =>
                  setForm((f) => ({ ...f, preferredCurrency: e.target.value as CurrencyCode }))
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CurrencyCodeSchema.options.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">Emergency Contact Name</span>
              <input
                type="text"
                maxLength={128}
                value={form.emergencyContactName}
                onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                Emergency Contact Phone (E.164, e.g. +94771234567)
              </span>
              <input
                type="tel"
                maxLength={32}
                placeholder="+94777654321"
                value={form.emergencyContactPhone}
                onChange={(e) => setForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? "Saving..." : "Save Profile"}</span>
            </button>
          </div>
        </form>
      ) : (
        /* Account & Traveller Details Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              <span>Personal &amp; Contact Details</span>
            </h2>
            {isLoading ? (
              <p className="text-xs text-slate-500">Loading profile details...</p>
            ) : (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Full Name</dt>
                  <dd className="text-slate-800 font-medium">
                    {[profile?.travellerProfile?.firstName, profile?.travellerProfile?.lastName]
                      .filter(Boolean)
                      .join(" ") || "Not set"}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500 flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>Phone</span>
                  </dt>
                  <dd className="text-slate-800 font-medium">
                    {profile?.phoneNumber || "Not set"}{" "}
                    <span className="text-xs text-slate-500">
                      ({effectivePhoneVerified ? "Verified" : "Unverified"})
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Emergency Contact</dt>
                  <dd className="text-slate-800 text-right">
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
                  <dt className="text-slate-500">Last Login</dt>
                  <dd className="text-slate-800 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {effectiveLastLogin
                        ? new Date(effectiveLastLogin).toLocaleString()
                        : "Current session"}
                    </span>
                  </dd>
                </div>
              </dl>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-600" />
                <span>Preferences</span>
              </h2>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <dt className="text-slate-500">Language</dt>
                  <dd className="text-slate-800 font-medium">
                    {profile?.travellerProfile?.preferredLanguage ?? "en"}
                  </dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-slate-500">Currency</dt>
                  <dd className="text-slate-800 font-medium">
                    {profile?.travellerProfile?.preferredCurrency ?? "LKR"}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <span>Account Access</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {effectiveRoles.length > 0 ? (
                  effectiveRoles.map((role) => (
                    <span
                      key={role}
                      className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold rounded-lg"
                    >
                      {ROLE_DISPLAY_LABELS[role] ?? role}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">Standard Account</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
