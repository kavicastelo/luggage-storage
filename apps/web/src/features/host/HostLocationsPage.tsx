import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { StorageLocation } from "@luggage-storage/contracts";
import { MapPin, Plus, Search, Send, Slash, X } from "lucide-react";
import { DEMO_LOCATIONS, type StorageLocationItem } from "@/data/mock-marketplace";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { useAuthStore } from "@/store/useAuthStore";
import { useHostContextStore } from "@/store/useHostContextStore";
import {
  useCreateLocationMutation,
  useDisableLocationMutation,
  useHostLocationsQuery,
  useOwnedBusinessesQuery,
  useSubmitLocationForReviewMutation
} from "@/hooks/queries/use-host-portal";
import { HostQueryErrorAlert } from "./host-helpers";
import { useHostVenue } from "./HostDashboardLayout";

export function HostLocationManagementPage() {
  const { effectiveHostRole, isDemoActive, querySuffix, reloadLocations } = useHostVenue();
  const { isAuthenticated } = useAuthStore();
  const showDemoLocations =
    !isAuthenticated &&
    (isDemoActive ||
      isDemoPreviewActive({
        allowDemoPreview: true,
        search: typeof window !== "undefined" ? window.location.search : "",
        isAuthenticated
      }));

  const storedBusinessId = useHostContextStore((state) => state.selectedBusinessId);
  const setStoredBusinessId = useHostContextStore((state) => state.setSelectedBusinessId);
  const setStoredLocationId = useHostContextStore((state) => state.setSelectedLocationId);

  const businessesQuery = useOwnedBusinessesQuery({ enabled: isAuthenticated });
  const locationsQuery = useHostLocationsQuery({ enabled: isAuthenticated });
  const createLocationMutation = useCreateLocationMutation();
  const submitReviewMutation = useSubmitLocationForReviewMutation();
  const disableMutation = useDisableLocationMutation();

  const businesses = businessesQuery.data ?? [];
  const serverLocations = locationsQuery.data ?? [];

  const effectiveBusinessId = useMemo(() => {
    if (businesses.some((b) => b.id === storedBusinessId)) {
      return storedBusinessId;
    }
    return businesses[0]?.id ?? "";
  }, [businesses, storedBusinessId]);

  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New location modal fields
  const [hubName, setHubName] = useState("");
  const [description, setDescription] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("Colombo");
  const [postalCode, setPostalCode] = useState("");
  const [latitude, setLatitude] = useState(6.9344);
  const [longitude, setLongitude] = useState(79.8428);
  const [bookingMode, setBookingMode] = useState<"INSTANT" | "HOST_APPROVAL">("INSTANT");
  const [acceptsOversized, setAcceptsOversized] = useState(false);

  const handleRetry = () => {
    setErrorMsg(null);
    void reloadLocations();
    void locationsQuery.refetch();
    void businessesQuery.refetch();
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveBusinessId) {
      setErrorMsg("Please establish an active Host Business before registering storage locations.");
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const newLoc = await createLocationMutation.mutateAsync({
        businessId: effectiveBusinessId,
        name: hubName.trim(),
        description: description.trim() || undefined,
        addressLine1: addressLine1.trim(),
        city: city.trim(),
        postalCode: postalCode.trim() || undefined,
        countryCode: "LK",
        latitude: Number(latitude),
        longitude: Number(longitude),
        timezone: "Asia/Colombo",
        bookingMode,
        acceptsOversized,
        amenities: []
      });
      setStoredLocationId(newLoc.id);
      setSuccessMsg(
        `Draft location "${newLoc.name}" created. Configure opening hours, zones, and pricing rules before submitting for moderation.`
      );
      setShowAddModal(false);
      setHubName("");
      setDescription("");
      setAddressLine1("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to register storage location.");
    }
  };

  const handleSubmitForReview = async (locId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await submitReviewMutation.mutateAsync(locId);
      setSuccessMsg("Location submitted to Superadmin moderation queue.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to submit location for review.");
    }
  };

  const handleDisableLocation = async (locId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await disableMutation.mutateAsync(locId);
      setSuccessMsg("Location disabled from public discovery.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to disable location.");
    }
  };

  const filteredLiveLocations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return serverLocations.filter(
      (loc) =>
        !q ||
        loc.name.toLowerCase().includes(q) ||
        loc.city.toLowerCase().includes(q) ||
        loc.addressLine1.toLowerCase().includes(q)
    );
  }, [serverLocations, searchTerm]);

  const filteredDemoLocations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return DEMO_LOCATIONS.filter(
      (loc) =>
        !q ||
        loc.name.toLowerCase().includes(q) ||
        loc.city.toLowerCase().includes(q) ||
        loc.landmark.toLowerCase().includes(q)
    );
  }, [searchTerm]);

  const queryError =
    locationsQuery.error instanceof Error
      ? locationsQuery.error.message
      : businessesQuery.error instanceof Error
        ? businessesQuery.error.message
        : null;

  const activeError = errorMsg || (isAuthenticated && (locationsQuery.isError || businessesQuery.isError)
    ? queryError || "Unable to load storage locations."
    : null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Storage Locations
            </h1>
            <p className="text-xs text-navy-600 mt-1">
              Manage multi-hub capacity, operating schedules, and LKR rates across Sri Lankan transit hubs.
            </p>
          </div>
          {effectiveHostRole !== "HOST_STAFF" && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition"
            >
              <Plus className="h-4 w-4" />
              <span>Register New Storage Hub</span>
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="mt-5 relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-navy-400" />
          <input
            type="text"
            placeholder="Search by hub name, city (e.g. Colombo, Ella, Kandy), or landmark..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-sand-300 pl-10 pr-4 py-2.5 text-xs text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
          />
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
          {successMsg}
        </div>
      )}

      {activeError && <HostQueryErrorAlert message={activeError} onRetry={handleRetry} />}

      {/* Location Directory Cards */}
      <div className="space-y-4">
        {isAuthenticated ? (
          locationsQuery.isLoading ? (
            <div className="bg-white rounded-2xl border border-sand-200 p-8 text-center text-xs font-semibold text-navy-600">
              Loading storage locations...
            </div>
          ) : filteredLiveLocations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-sand-200 p-8 text-center space-y-3 text-xs text-navy-600">
              <p className="font-bold text-navy-950">No storage locations registered yet.</p>
              {businesses.length === 0 ? (
                <Link
                  to="/host/onboarding"
                  className="inline-flex items-center px-4 py-2 rounded-xl bg-terracotta-500 text-white font-bold hover:bg-terracotta-600 transition"
                >
                  Complete Business Onboarding First
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center px-4 py-2 rounded-xl bg-terracotta-500 text-white font-bold hover:bg-terracotta-600 transition"
                >
                  Create Your First Storage Hub
                </button>
              )}
            </div>
          ) : (
            filteredLiveLocations.map((loc: StorageLocation) => (
              <div
                key={loc.id}
                className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm hover:border-sand-300 transition space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                        {loc.status}
                      </span>
                      <span className="text-xs font-bold text-navy-600">{loc.city}</span>
                      <span className="text-[11px] font-semibold text-navy-500">
                        {loc.bookingMode === "INSTANT" ? "Instant Confirm" : "Host Approval"}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-navy-950">{loc.name}</h2>
                    <p className="text-xs text-navy-600 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-terracotta-600 flex-shrink-0" />
                      <span>{loc.addressLine1}</span>
                    </p>
                    <p className="text-[11px] text-navy-500">
                      <strong className="text-navy-700">Public Masked Address:</strong>{" "}
                      {loc.city} Area (exact street coordinates remain private until booking confirmation)
                    </p>
                    {loc.rejectionReason && (
                      <p className="text-[11px] text-red-700 font-semibold">
                        Moderation feedback: {loc.rejectionReason}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-t lg:border-t-0 pt-3 lg:pt-0 border-sand-100">
                    <div className="text-left sm:text-right text-xs">
                      <p className="font-bold text-navy-900">
                        {(loc.zones ?? []).length} Storage Zones • {(loc.images ?? []).length} Photos
                      </p>
                      <p className="text-[11px] text-navy-500">
                        Status: <span className="font-semibold text-navy-700">{loc.status}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Action Navigation & Moderation Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-sand-100">
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="px-2.5 py-1 rounded-lg bg-sand-100 text-navy-700 font-medium">
                      {loc.acceptsOversized ? "Oversized Accepted" : "Standard Bags"}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-sand-100 text-navy-700 font-medium">
                      {(loc.amenities ?? []).length} Amenities
                    </span>
                  </div>

                  {effectiveHostRole !== "HOST_STAFF" && (
                    <div className="flex flex-wrap gap-2">
                      {(loc.status === "DRAFT" || loc.status === "REJECTED") && (
                        <button
                          type="button"
                          disabled={submitReviewMutation.isPending}
                          onClick={() => void handleSubmitForReview(loc.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold transition disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Submit for Review</span>
                        </button>
                      )}
                      {loc.status === "ACTIVE" && (
                        <button
                          type="button"
                          disabled={disableMutation.isPending}
                          onClick={() => void handleDisableLocation(loc.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold transition disabled:opacity-50"
                        >
                          <Slash className="h-3.5 w-3.5" />
                          <span>Disable</span>
                        </button>
                      )}
                      <Link
                        to={`/host/locations/${loc.id}`}
                        className="px-3 py-1.5 rounded-lg border border-sand-300 text-xs font-bold text-navy-800 hover:bg-sand-50 transition"
                      >
                        Edit Profile
                      </Link>
                      <Link
                        to={`/host/locations/${loc.id}/schedule`}
                        className="px-3 py-1.5 rounded-lg border border-sand-300 text-xs font-bold text-navy-800 hover:bg-sand-50 transition"
                      >
                        Hours &amp; Calendar
                      </Link>
                      <Link
                        to={`/host/locations/${loc.id}/capacity`}
                        className="px-3 py-1.5 rounded-lg border border-sand-300 text-xs font-bold text-navy-800 hover:bg-sand-50 transition"
                      >
                        Capacity &amp; Zones
                      </Link>
                      <Link
                        to={`/host/locations/${loc.id}/pricing`}
                        className="px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition shadow-xs"
                      >
                        Pricing Rules
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))
          )
        ) : showDemoLocations ? (
          filteredDemoLocations.map((loc: StorageLocationItem) => (
            <div
              key={loc.id}
              className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm hover:border-sand-300 transition space-y-4"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                      Active Storage Venue
                    </span>
                    <span className="text-xs font-bold text-navy-600">{loc.city}</span>
                  </div>
                  <h2 className="text-lg font-bold text-navy-950">{loc.name}</h2>
                  <p className="text-xs text-navy-600 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-terracotta-600 flex-shrink-0" />
                    <span>{loc.landmark || loc.city}</span>
                  </p>
                  <p className="text-[11px] text-navy-500">
                    <strong className="text-navy-700">Public Masked Address:</strong>{" "}
                    {loc.addressMasked ||
                      "Exact coordinates & address private until booking confirmation."}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-t lg:border-t-0 pt-3 lg:pt-0 border-sand-100">
                  <div className="text-left sm:text-right">
                    <p className="text-xs font-bold text-navy-900">
                      {loc.availableCapacity
                        ? `${loc.availableCapacity} of ${loc.totalCapacity} Slots`
                        : "Standard Shared Pool"}
                    </p>
                    <p className="text-[11px] text-navy-500">
                      Status: <span className="font-semibold text-navy-700">Active</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-sand-100">
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="px-2.5 py-1 rounded-lg bg-sand-100 text-navy-700 font-medium">
                    {loc.is24Hours ? "24/7 Access" : "Standard Hours"}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-sand-100 text-navy-700 font-medium">
                    LKR Pricing Model
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-sand-100 text-navy-700 font-medium">
                    LKR 250k Protection
                  </span>
                </div>

                {effectiveHostRole !== "HOST_STAFF" && (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/host/locations/${loc.id}${querySuffix}`}
                      className="px-3 py-1.5 rounded-lg border border-sand-300 text-xs font-bold text-navy-800 hover:bg-sand-50 transition"
                    >
                      Edit Profile
                    </Link>
                    <Link
                      to={`/host/locations/${loc.id}/schedule${querySuffix}`}
                      className="px-3 py-1.5 rounded-lg border border-sand-300 text-xs font-bold text-navy-800 hover:bg-sand-50 transition"
                    >
                      Hours &amp; Calendar
                    </Link>
                    <Link
                      to={`/host/locations/${loc.id}/capacity${querySuffix}`}
                      className="px-3 py-1.5 rounded-lg border border-sand-300 text-xs font-bold text-navy-800 hover:bg-sand-50 transition"
                    >
                      Capacity &amp; Zones
                    </Link>
                    <Link
                      to={`/host/locations/${loc.id}/pricing${querySuffix}`}
                      className="px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition shadow-xs"
                    >
                      Pricing Rules
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-2xl border border-sand-200 p-8 text-center text-xs text-navy-600">
            No storage locations available in preview mode.
          </div>
        )}
      </div>

      {/* Add Location Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateLocation}
            className="bg-white rounded-2xl border border-sand-200 max-w-lg w-full p-6 space-y-4 shadow-xl text-xs max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <h3 className="text-base font-bold text-navy-950">Register New Storage Location</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-sand-100 text-navy-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-navy-600">
              Create a draft storage location, then configure hours, storage zones, and LKR pricing rules before submitting to Superadmin moderation.
            </p>

            {businesses.length > 0 && (
              <div>
                <label className="block font-bold text-navy-900 mb-1">Host Business Entity</label>
                <select
                  aria-label="Host Business Entity"
                  value={effectiveBusinessId}
                  onChange={(e) => setStoredBusinessId(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.legalBusinessName} ({b.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-navy-900 mb-1">Hub Display Name</label>
                <input
                  type="text"
                  required
                  value={hubName}
                  onChange={(e) => setHubName(e.target.value)}
                  placeholder="e.g. Pettah Bus Stand Secure Locker Desk"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Street Address Line 1</label>
                <input
                  type="text"
                  required
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="e.g. No 24 Olcott Mawatha, Colombo 11"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-navy-900 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-xl border border-sand-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-navy-900 mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="00100"
                    className="w-full rounded-xl border border-sand-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-navy-900 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={latitude}
                    onChange={(e) => setLatitude(Number(e.target.value))}
                    className="w-full rounded-xl border border-sand-300 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-navy-900 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={longitude}
                    onChange={(e) => setLongitude(Number(e.target.value))}
                    className="w-full rounded-xl border border-sand-300 px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block font-bold text-navy-900 mb-1">Booking Mode</label>
                  <select
                    aria-label="Booking Mode"
                    value={bookingMode}
                    onChange={(e) =>
                      setBookingMode(e.target.value as "INSTANT" | "HOST_APPROVAL")
                    }
                    className="w-full rounded-xl border border-sand-300 px-3 py-2"
                  >
                    <option value="INSTANT">Instant Confirmation</option>
                    <option value="HOST_APPROVAL">Host Approval</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 font-bold text-navy-900 pt-4">
                  <input
                    type="checkbox"
                    checked={acceptsOversized}
                    onChange={(e) => setAcceptsOversized(e.target.checked)}
                    className="rounded text-terracotta-500"
                  />
                  <span>Oversized Gear OK</span>
                </label>
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl border border-sand-300 text-xs font-bold text-navy-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createLocationMutation.isPending}
                className="px-4 py-2 rounded-xl bg-terracotta-500 text-white text-xs font-bold disabled:opacity-50"
              >
                {createLocationMutation.isPending ? "Saving Draft..." : "Create Draft Hub"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
