import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  LOCATION_AMENITIES,
  type BookingMode,
  type LocationAmenity
} from "@luggage-storage/contracts";
import { CheckCircle2, ImagePlus, Send, Star, Trash2 } from "lucide-react";
import { Alert, Card, LoadingSkeleton, MascotIllustration } from "@/components/ui";
import { DEMO_LOCATIONS } from "@/data/mock-marketplace";
import { uploadFileToR2, validateFileForUpload } from "@/lib/r2-uploader";
import { useAuthStore } from "@/store/useAuthStore";
import { hostQueryKeys, useResolvedQueryClient } from "@/hooks/queries/query-keys";
import {
  useDeleteLocationMediaMutation,
  useHostLocationDetailQuery,
  useLocationMediaQuery,
  useSubmitLocationForReviewMutation,
  useUpdateLocationMediaMutation,
  useUpdateLocationMutation
} from "@/hooks/queries/use-host-portal";
import {
  HostLocationSetupTabs,
  HostQueryErrorAlert,
  isUuid,
  NoLocationSelectedCard
} from "./host-helpers";
import { useHostVenue } from "./HostDashboardLayout";
import { LocationDiscoveryMap } from "../traveller/LocationDiscoveryMap";

const AMENITY_LABELS: Record<LocationAmenity, string> = {
  CCTV: "24/7 Monitored CCTV Recording",
  WIFI: "Complimentary Counter Wi-Fi",
  AIR_CONDITIONING: "Climate-Controlled & Dehumidified Air",
  GROUND_FLOOR: "Ground Floor Easy Luggage Access",
  SECURITY_SEALS: "Tamper-Evident Security Seals Supplied",
  LOCKERS: "Individual Locked Steel Compartments",
  STAFF_ON_DUTY: "Dedicated Attendant On Duty",
  WHEELCHAIR_ACCESSIBLE: "Step-Free / Wheelchair Accessible"
};

export function HostLocationProfileEditorPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useResolvedQueryClient();
  const { allLocations, selectedLocationId, isDemoActive, querySuffix } = useHostVenue();
  const { isAuthenticated } = useAuthStore();

  const targetLocationId = id || selectedLocationId || allLocations[0]?.id || "";
  const liveLocationId = isAuthenticated && isUuid(targetLocationId) ? targetLocationId : undefined;

  const detailQuery = useHostLocationDetailQuery(liveLocationId, { enabled: isAuthenticated });
  const mediaQuery = useLocationMediaQuery(liveLocationId, { enabled: isAuthenticated });
  const updateLocationMutation = useUpdateLocationMutation();
  const submitReviewMutation = useSubmitLocationForReviewMutation();
  const updateMediaMutation = useUpdateLocationMediaMutation();
  const deleteMediaMutation = useDeleteLocationMediaMutation();

  // Demo mode fallback
  const showDemoLoc = !isAuthenticated && isDemoActive;
  const demoLoc = showDemoLoc
    ? DEMO_LOCATIONS.find((l) => l.id === id) || DEMO_LOCATIONS[0]
    : null;

  // Live form state
  const detail = detailQuery.data ?? null;
  const [name, setName] = useState(demoLoc?.name ?? "");
  const [landmark, setLandmark] = useState(demoLoc?.landmark ?? "");
  const [description, setDescription] = useState(demoLoc?.description ?? "");
  const [addressMasked, setAddressMasked] = useState(demoLoc?.addressMasked ?? "");
  const [addressLine1, setAddressLine1] = useState(demoLoc?.addressExact ?? "");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState(demoLoc?.city ?? "Colombo");
  const [postalCode, setPostalCode] = useState("");
  const [latitude, setLatitude] = useState<number>(6.9344);
  const [longitude, setLongitude] = useState<number>(79.8428);
  const [bookingMode, setBookingMode] = useState<BookingMode>("INSTANT");
  const [acceptsOversized, setAcceptsOversized] = useState(false);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [photoPolicy, setPhotoPolicy] = useState<string>(
    demoLoc?.photoEvidencePolicy ?? "OPTIONAL_BY_DEFAULT"
  );

  // Media upload state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoIsPrimary, setPhotoIsPrimary] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !detail) return;
    setName(detail.name);
    setDescription(detail.description ?? "");
    setAddressLine1(detail.addressLine1);
    setAddressLine2(detail.addressLine2 ?? "");
    setCity(detail.city);
    setPostalCode(detail.postalCode ?? "");
    setLatitude(Number(detail.latitude));
    setLongitude(Number(detail.longitude));
    setBookingMode(detail.bookingMode);
    setAcceptsOversized(detail.acceptsOversized);
    setAmenities(detail.amenities ?? []);
    setHasUnsavedChanges(false);
  }, [isAuthenticated, detail]);

  if (isAuthenticated && !liveLocationId) {
    return (
      <NoLocationSelectedCard
        description="Create or select a verified storage hub from Storage Locations before editing its profile."
        querySuffix={querySuffix}
      />
    );
  }

  if (!isAuthenticated && !demoLoc) {
    return (
      <NoLocationSelectedCard
        description="Create or select a verified storage hub from Storage Locations before editing its profile."
        querySuffix={querySuffix}
      />
    );
  }

  if (isAuthenticated && detailQuery.isLoading) {
    return (
      <Card className="p-6 space-y-4">
        <LoadingSkeleton variant="text" className="w-56 h-7" />
        <LoadingSkeleton className="h-32 w-full" />
        <LoadingSkeleton className="h-32 w-full" />
      </Card>
    );
  }

  if (isAuthenticated && detailQuery.isError) {
    return (
      <HostQueryErrorAlert
        message={
          detailQuery.error instanceof Error
            ? detailQuery.error.message
            : "Failed to load location details."
        }
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const toggleAmenity = (amenity: string) => {
    setHasUnsavedChanges(true);
    setAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((item) => item !== amenity) : [...prev, amenity]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavedNotice(null);

    if (!isAuthenticated) {
      setHasUnsavedChanges(false);
      setSavedNotice(
        `Location profile updated successfully for ${name}. Changes saved to local session.`
      );
      return;
    }

    if (!liveLocationId) return;

    try {
      await updateLocationMutation.mutateAsync({
        locationId: liveLocationId,
        data: {
          name: name.trim(),
          description: description.trim() || null,
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || null,
          city: city.trim(),
          postalCode: postalCode.trim() || null,
          latitude: Number(latitude),
          longitude: Number(longitude),
          bookingMode,
          acceptsOversized,
          amenities
        }
      });
      setHasUnsavedChanges(false);
      setSavedNotice(`Location profile updated for ${name}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save location profile.");
    }
  };

  const handleUploadMedia = async () => {
    if (!liveLocationId || !photoFile) {
      setErrorMsg("Select an image file before uploading.");
      return;
    }

    setErrorMsg(null);
    setSavedNotice(null);
    setUploadingPhoto(true);
    try {
      validateFileForUpload(photoFile, "LOCATION_IMAGE");
      await uploadFileToR2({
        file: photoFile,
        purpose: "LOCATION_IMAGE",
        resourceId: liveLocationId,
        caption: photoCaption.trim() || undefined,
        isPrimary: photoIsPrimary
      });
      qc.invalidateQueries({ queryKey: hostQueryKeys.media(liveLocationId) });
      qc.invalidateQueries({ queryKey: hostQueryKeys.locationDetail(liveLocationId) });
      setPhotoFile(null);
      setPhotoCaption("");
      setPhotoIsPrimary(false);
      setSavedNotice("Location image uploaded to storage.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!liveLocationId) return;
    setErrorMsg(null);
    setSavedNotice(null);
    try {
      await submitReviewMutation.mutateAsync(liveLocationId);
      setSavedNotice("Location submitted to Superadmin moderation queue.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Moderation readiness check failed.");
    }
  };

  const mediaItems = mediaQuery.data ?? detail?.images ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                to={`/host/locations${querySuffix}`}
                className="text-xs font-bold text-terracotta-600 hover:underline"
              >
                ← Storage Locations
              </Link>
              <span className="text-xs text-navy-400">•</span>
              <span className="text-xs font-medium text-navy-600">
                {detail?.city ?? demoLoc?.city}
              </span>
              {detail && (
                <span className="px-2 py-0.5 rounded-full bg-sand-100 border border-sand-300 text-[10px] font-bold text-navy-900">
                  {detail.status}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Location Profile Editor
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Public display name, privacy-preserving address masking, and storage amenities.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isAuthenticated &&
              detail &&
              (detail.status === "DRAFT" || detail.status === "REJECTED") && (
                <button
                  type="button"
                  disabled={submitReviewMutation.isPending}
                  onClick={() => void handleSubmitForReview()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>
                    {submitReviewMutation.isPending ? "Submitting..." : "Submit for Moderation"}
                  </span>
                </button>
              )}
            <button
              type="submit"
              form="location-profile-form"
              disabled={updateLocationMutation.isPending}
              className="px-5 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              {updateLocationMutation.isPending ? "Saving..." : "Save Location Profile"}
            </button>
          </div>
        </div>
      </div>

      <HostLocationSetupTabs locationId={targetLocationId} querySuffix={querySuffix} />

      {errorMsg && (
        <Alert variant="danger" title="Save Failed">
          {errorMsg}
        </Alert>
      )}

      {savedNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Editor Form */}
      <form
        id="location-profile-form"
        onChange={() => setHasUnsavedChanges(true)}
        onSubmit={handleSave}
        className="space-y-6"
      >
        <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-navy-950">Public Profile Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">
                Venue Display Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-sand-300 px-3.5 py-2 text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
              />
            </div>

            {isAuthenticated ? (
              <div>
                <label className="block text-xs font-bold text-navy-900 mb-1">City</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3.5 py-2 text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-navy-900 mb-1">
                  Transit Landmark
                </label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3.5 py-2 text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-navy-900 mb-1">Public Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-sand-300 px-3.5 py-2 text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
            />
          </div>
        </div>

        {/* Section 2: Address Privacy & Masking */}
        <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-navy-950">Address Privacy &amp; Masked Coordinates</h2>
            <p className="text-xs text-navy-600">
              To prevent crowding and ensure verified bookings, exact street numbers are hidden until a traveller confirms their reservation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!isAuthenticated ? (
              <div>
                <label className="block text-xs font-bold text-navy-900 mb-1">
                  Masked Address (Shown to Public Pre-Booking)
                </label>
                <input
                  type="text"
                  value={addressMasked}
                  onChange={(e) => setAddressMasked(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3.5 py-2 text-xs text-navy-900 font-medium"
                />
                <p className="text-[10px] text-navy-500 mt-1">
                  General area and nearest intersection only.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-navy-900 mb-1">
                  Address Line 2 (Suite / Floor)
                </label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3.5 py-2 text-xs text-navy-900 font-medium"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">
                Exact Street Address (Revealed Only Post-Booking)
              </label>
              <input
                type="text"
                required
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="w-full rounded-xl border border-sand-300 px-3.5 py-2 text-xs text-navy-900 font-medium"
              />
              <p className="text-[10px] text-navy-500 mt-1">
                Includes building number, entrance floor, and counter suite.
              </p>
            </div>

            {isAuthenticated && (
              <>
                <div>
                  <label className="block text-xs font-bold text-navy-900 mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full rounded-xl border border-sand-300 px-3.5 py-2 text-xs font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-navy-900 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={latitude}
                      onChange={(e) => setLatitude(Number(e.target.value))}
                      className="w-full rounded-xl border border-sand-300 px-3.5 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-navy-900 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={longitude}
                      onChange={(e) => setLongitude(Number(e.target.value))}
                      className="w-full rounded-xl border border-sand-300 px-3.5 py-2 text-xs font-mono"
                    />
                  </div>
                </div>

                {Number.isFinite(latitude) && Number.isFinite(longitude) && (
                  <div className="pt-2">
                    <span className="block text-xs font-bold text-navy-900 mb-1.5">
                      Facility Location Pin Preview
                    </span>
                    <LocationDiscoveryMap
                      locations={[
                        {
                          id: "host-facility-preview",
                          name: name.trim() || "My Facility",
                          city: city.trim() || "Sri Lanka",
                          approximateArea: addressLine1.trim() || "Transit Area",
                          approximateLatitude: latitude,
                          approximateLongitude: longitude,
                          priceLabel: "Host Facility",
                          href: "#"
                        }
                      ]}
                      selectedLocationId="host-facility-preview"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Section 3: Amenities & Security */}
        <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-navy-950">Security &amp; Operational Policies</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {!isAuthenticated ? (
              <div>
                <label className="block font-bold text-navy-900 mb-1">
                  Check-in Photo Evidence Requirement
                </label>
                <select
                  aria-label="Check-in Photo Evidence Requirement"
                  value={photoPolicy}
                  onChange={(e) => setPhotoPolicy(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-medium text-navy-900"
                >
                  <option value="CONFIGURED_MANDATORY">
                    Mandatory Bag Photos (Recommended for High-Traffic Hubs)
                  </option>
                  <option value="OPTIONAL_BY_DEFAULT">
                    Optional Bag Photos (Speed-First Counter Protocol)
                  </option>
                </select>
                <p className="text-[10px] text-navy-500 mt-1">
                  Mandatory photo capture attaches intake photos to the custody audit log. (Prototype Option: DEC-001 Pending PO Sign-Off)
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-navy-900 mb-1">Booking Confirmation Mode</label>
                  <select
                    aria-label="Booking Confirmation Mode"
                    value={bookingMode}
                    onChange={(e) => setBookingMode(e.target.value as BookingMode)}
                    className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-medium text-navy-900"
                  >
                    <option value="INSTANT">Instant Confirmation</option>
                    <option value="HOST_APPROVAL">Host Approval Required</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 font-bold text-navy-900">
                  <input
                    type="checkbox"
                    checked={acceptsOversized}
                    onChange={(e) => setAcceptsOversized(e.target.checked)}
                    className="rounded text-terracotta-500"
                  />
                  <span>Accepts Oversized Surfboards / Equipment</span>
                </label>
              </div>
            )}

            <div className="space-y-2">
              <label className="block font-bold text-navy-900">Active Venue Amenities</label>
              {isAuthenticated ? (
                <div className="grid grid-cols-1 gap-1.5 text-xs text-navy-800">
                  {LOCATION_AMENITIES.map((amenity) => (
                    <label key={amenity} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={amenities.includes(amenity)}
                        onChange={() => toggleAmenity(amenity)}
                        className="rounded text-terracotta-500"
                      />
                      <span>{AMENITY_LABELS[amenity]}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5 text-xs text-navy-800">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded text-terracotta-500" />
                    <span>24/7 Monitored CCTV Recording</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded text-terracotta-500" />
                    <span>Climate-Controlled &amp; Dehumidified Air</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded text-terracotta-500" />
                    <span>Tamper-Evident Security Seals Supplied</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded text-terracotta-500" />
                    <span>Ground Floor Easy Luggage Access</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Sticky Bottom Save Bar */}
        <div className="sticky bottom-4 z-10 rounded-2xl bg-white/95 backdrop-blur-sm border border-sand-200 px-5 py-3.5 shadow-lg flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold">
            {hasUnsavedChanges ? (
              <span className="text-amber-800">Unsaved profile changes</span>
            ) : (
              <span className="text-navy-600">Profile settings synchronized</span>
            )}
          </div>
          <button
            type="submit"
            disabled={updateLocationMutation.isPending}
            className="px-5 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
          >
            {updateLocationMutation.isPending ? "Saving..." : "Save Location Profile"}
          </button>
        </div>
      </form>

      {/* Section 4: Live Location Media Gallery & R2 Upload */}
      {isAuthenticated && liveLocationId && (
        <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm text-xs">
          <div>
            <h2 className="text-sm font-bold text-navy-950">Storage Hub Photos &amp; Cover Image</h2>
            <p className="text-navy-600 mt-0.5">
              Upload photos of your luggage desk, locked storage racks, or entrance signage (JPG, PNG, WebP up to 10 MB).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block font-bold text-navy-900 mb-1">Photo File</label>
              <input
                type="file"
                aria-label="Location Photo File"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-sand-300 px-3 py-1.5 bg-sand-50"
              />
            </div>
            <div>
              <label className="block font-bold text-navy-900 mb-1">Caption (Optional)</label>
              <input
                type="text"
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                placeholder="e.g. Steel luggage lockers inside ground floor counter"
                className="w-full rounded-xl border border-sand-300 px-3 py-2"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-1.5 font-bold text-navy-800">
                <input
                  type="checkbox"
                  checked={photoIsPrimary}
                  onChange={(e) => setPhotoIsPrimary(e.target.checked)}
                  className="rounded text-terracotta-500"
                />
                <span>Primary Cover</span>
              </label>
              <button
                type="button"
                disabled={!photoFile || uploadingPhoto}
                onClick={() => void handleUploadMedia()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-bold transition disabled:opacity-50"
              >
                <ImagePlus className="h-4 w-4" />
                <span>{uploadingPhoto ? "Uploading..." : "Upload Photo"}</span>
              </button>
            </div>
          </div>

          {mediaItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-sand-300 bg-sand-50/70 p-6 flex flex-col items-center text-center space-y-2">
              <MascotIllustration mascot="selfie" size="md" variant="empty" decorative />
              <p className="font-bold text-navy-900">No location photos uploaded yet.</p>
              <p className="text-[11px] text-navy-600 max-w-md">
                Show travellers your secure luggage lockers, reception desk, and storefront signage to build confidence before booking.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {mediaItems.map((media) => (
                <div
                  key={media.id}
                  className="rounded-xl border border-sand-200 overflow-hidden bg-sand-50 flex flex-col justify-between"
                >
                  <img
                    src={media.url}
                    alt={media.caption || name}
                    className="h-36 w-full object-cover bg-sand-200"
                  />
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-navy-950 truncate">
                        {media.caption || "Storage Hub Photo"}
                      </span>
                      {media.isPrimary && (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {!media.isPrimary && (
                        <button
                          type="button"
                          disabled={updateMediaMutation.isPending}
                          onClick={() =>
                            void updateMediaMutation.mutate({
                              locationId: liveLocationId,
                              mediaId: media.id,
                              data: { isPrimary: true }
                            })
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-navy-800 hover:text-terracotta-600"
                        >
                          <Star className="h-3.5 w-3.5" />
                          <span>Set Primary</span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={deleteMediaMutation.isPending}
                        onClick={() =>
                          void deleteMediaMutation.mutate({
                            locationId: liveLocationId,
                            mediaId: media.id
                          })
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 hover:underline ml-auto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
