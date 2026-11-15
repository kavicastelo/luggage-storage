import React, { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  BAG_CATEGORIES,
  CAPACITY_POOL_TYPES,
  STANDARD_BAG_UNIT_CONSUMPTION,
  STORAGE_SECURITY_TIERS,
  STORAGE_ZONE_TYPES,
  type BagCategory,
  type CapacityPoolType,
  type StorageCapacityPool,
  type StorageSecurityTier,
  type StorageZone,
  type StorageZoneType
} from "@luggage-storage/contracts";
import { Plus, Trash2, X } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { DEMO_LOCATIONS } from "@/data/mock-marketplace";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { useAuthStore } from "@/store/useAuthStore";
import {
  useCapacityPoolsQuery,
  useCreateCapacityPoolMutation,
  useCreateStorageZoneMutation,
  useDeleteCapacityPoolMutation,
  useDeleteStorageZoneMutation,
  useHostLocationDetailQuery,
  useStorageZonesQuery,
  useUpdateCapacityPoolMutation,
  useUpdateStorageZoneMutation
} from "@/hooks/queries/use-host-portal";
import { HostQueryErrorAlert, isUuid, NoLocationSelectedCard } from "./host-helpers";
import { useHostVenue } from "./HostDashboardLayout";

export function HostCapacityPoolsZonesPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { allLocations, selectedLocationId, isDemoActive, querySuffix } = useHostVenue();
  const { isAuthenticated } = useAuthStore();

  const targetLocationId = id || selectedLocationId || allLocations[0]?.id || "";
  const liveLocationId = isAuthenticated && isUuid(targetLocationId) ? targetLocationId : undefined;

  const detailQuery = useHostLocationDetailQuery(liveLocationId, { enabled: isAuthenticated });
  const zonesQuery = useStorageZonesQuery(liveLocationId, { enabled: isAuthenticated });
  const poolsQuery = useCapacityPoolsQuery(liveLocationId, { enabled: isAuthenticated });

  const createZoneMutation = useCreateStorageZoneMutation();
  const updateZoneMutation = useUpdateStorageZoneMutation();
  const deleteZoneMutation = useDeleteStorageZoneMutation();
  const createPoolMutation = useCreateCapacityPoolMutation();
  const updatePoolMutation = useUpdateCapacityPoolMutation();
  const deletePoolMutation = useDeleteCapacityPoolMutation();

  const showDemoLoc =
    !isAuthenticated &&
    (isDemoActive ||
      isDemoPreviewActive({
        allowDemoPreview: true,
        search: location.search,
        isAuthenticated
      }));
  const demoLoc = showDemoLoc
    ? DEMO_LOCATIONS.find((l) => l.id === id) || DEMO_LOCATIONS[0]
    : null;

  const [showAddZone, setShowAddZone] = useState(false);
  const [showAddPool, setShowAddPool] = useState(false);
  const [editingPool, setEditingPool] = useState<StorageCapacityPool | null>(null);
  const [editPoolUnits, setEditPoolUnits] = useState(20);
  const [editPoolActive, setEditPoolActive] = useState(true);

  const [zoneName, setZoneName] = useState("");
  const [zoneType, setZoneType] = useState<StorageZoneType>("RACK");
  const [securityTier, setSecurityTier] = useState<StorageSecurityTier>("STANDARD");

  const [poolZoneId, setPoolZoneId] = useState("");
  const [poolType, setPoolType] = useState<CapacityPoolType>("SHARED");
  const [dedicatedCategory, setDedicatedCategory] = useState<BagCategory>("BAG_MEDIUM");
  const [poolUnits, setPoolUnits] = useState(25);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (isAuthenticated && !liveLocationId) {
    return (
      <NoLocationSelectedCard
        description="Create or select a verified storage hub from Storage Locations before managing capacity zones."
        querySuffix={querySuffix}
      />
    );
  }

  if (!isAuthenticated && !demoLoc) {
    return (
      <NoLocationSelectedCard
        description="Create or select a verified storage hub from Storage Locations before managing capacity zones."
        querySuffix={querySuffix}
      />
    );
  }

  if (isAuthenticated && (zonesQuery.isLoading || poolsQuery.isLoading)) {
    return (
      <div className="bg-white rounded-2xl border border-sand-200 p-8 text-center text-xs font-semibold text-navy-600">
        Loading storage zones and capacity pools...
      </div>
    );
  }

  if (isAuthenticated && (zonesQuery.isError || poolsQuery.isError)) {
    return (
      <HostQueryErrorAlert
        message={
          zonesQuery.error instanceof Error
            ? zonesQuery.error.message
            : poolsQuery.error instanceof Error
              ? poolsQuery.error.message
              : "Failed to load storage capacity data."
        }
        onRetry={() => {
          void zonesQuery.refetch();
          void poolsQuery.refetch();
        }}
      />
    );
  }

  const zones = zonesQuery.data ?? [];
  const pools = poolsQuery.data ?? [];
  const totalPoolUnits = pools
    .filter((p) => p.isActive)
    .reduce((sum, p) => sum + p.totalUnits, 0);

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveLocationId) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await createZoneMutation.mutateAsync({
        locationId: liveLocationId,
        data: {
          name: zoneName.trim(),
          zoneType,
          securityTier,
          isActive: true
        }
      });
      setZoneName("");
      setShowAddZone(false);
      setSuccessMsg("Physical storage zone added.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create storage zone.");
    }
  };

  const handleToggleZoneActive = async (zone: StorageZone) => {
    if (!liveLocationId) return;
    setErrorMsg(null);
    try {
      await updateZoneMutation.mutateAsync({
        locationId: liveLocationId,
        zoneId: zone.id,
        data: { isActive: !zone.isActive }
      });
      setSuccessMsg(`Zone "${zone.name}" ${zone.isActive ? "paused" : "activated"}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update storage zone.");
    }
  };

  const handleDeleteZone = async (zone: StorageZone) => {
    if (!liveLocationId) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await deleteZoneMutation.mutateAsync({
        locationId: liveLocationId,
        zoneId: zone.id
      });
      setSuccessMsg(`Deleted storage zone "${zone.name}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Cannot remove storage zone.");
    }
  };

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveLocationId) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await createPoolMutation.mutateAsync({
        locationId: liveLocationId,
        data: {
          zoneId: poolZoneId || null,
          poolType,
          dedicatedBagCategory: poolType === "DEDICATED" ? dedicatedCategory : null,
          totalUnits: Number(poolUnits),
          isActive: true
        }
      });
      setShowAddPool(false);
      setSuccessMsg("Capacity pool created.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create capacity pool.");
    }
  };

  const handleSavePoolEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveLocationId || !editingPool) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await updatePoolMutation.mutateAsync({
        locationId: liveLocationId,
        poolId: editingPool.id,
        data: {
          totalUnits: Number(editPoolUnits),
          isActive: editPoolActive
        }
      });
      setEditingPool(null);
      setSuccessMsg("Capacity pool updated.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update capacity pool.");
    }
  };

  const handleDeletePool = async (poolId: string) => {
    if (!liveLocationId) return;
    setErrorMsg(null);
    try {
      await deletePoolMutation.mutateAsync({ locationId: liveLocationId, poolId });
      setSuccessMsg("Capacity pool deleted.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete capacity pool.");
    }
  };

  const locationTitle = detailQuery.data?.name ?? demoLoc?.name ?? "Storage Hub";

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
              <span className="text-xs font-medium text-navy-600">{locationTitle}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Capacity Pools &amp; Storage Zones
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Manage physical storage compartments, rack limits, and bag size weight equivalents.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => setShowAddPool(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold shadow-sm transition"
              >
                <Plus className="h-4 w-4" />
                <span>Add Capacity Pool</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAddZone(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition"
            >
              <Plus className="h-4 w-4" />
              <span>Add Storage Zone</span>
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <Alert variant="danger" title="Capacity Action Blocked">
          {errorMsg}
        </Alert>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
          {successMsg}
        </div>
      )}

      {/* Aggregate Capacity Overview */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
        {isAuthenticated ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sand-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-navy-950">Aggregate Venue Capacity</h2>
              <p className="text-xs text-navy-600">
                {totalPoolUnits} Total Capacity Units across {pools.length} pools and {zones.length} storage zones
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-navy-500">Active Pools:</span>{" "}
                <strong className="text-emerald-700 font-bold">
                  {pools.filter((p) => p.isActive).length}
                </strong>
              </div>
              <div>
                <span className="text-navy-500">Active Zones:</span>{" "}
                <strong className="text-navy-950 font-bold">
                  {zones.filter((z) => z.isActive).length}
                </strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sand-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-navy-950">Aggregate Venue Capacity</h2>
              <p className="text-xs text-navy-600">
                80 Total Compartment Units across 3 active zones
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-navy-500">Occupied:</span>{" "}
                <strong className="text-navy-950 font-bold">28 slots (35%)</strong>
              </div>
              <div>
                <span className="text-navy-500">Available:</span>{" "}
                <strong className="text-emerald-700 font-bold">52 slots</strong>
              </div>
            </div>
          </div>
        )}

        {/* Slot Weight Multiplier Reference */}
        <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 text-xs space-y-2">
          <p className="font-bold text-navy-900">Bag Category Slot Weight Equivalents</p>
          {isAuthenticated ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-navy-700">
              <div>
                Small Bag: <strong className="font-semibold">{STANDARD_BAG_UNIT_CONSUMPTION.BAG_SMALL} unit</strong>
              </div>
              <div>
                Medium Cabin: <strong className="font-semibold">{STANDARD_BAG_UNIT_CONSUMPTION.BAG_MEDIUM} unit</strong>
              </div>
              <div>
                Large Checked: <strong className="font-semibold">{STANDARD_BAG_UNIT_CONSUMPTION.BAG_LARGE} units</strong>
              </div>
              <div>
                Oversized Gear: <strong className="font-semibold">{STANDARD_BAG_UNIT_CONSUMPTION.BAG_OVERSIZED} units</strong>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-navy-700">
              <div>
                Small Backpack: <strong className="font-semibold">0.5 slots</strong>
              </div>
              <div>
                Cabin Trolley: <strong className="font-semibold">1.0 slot</strong>
              </div>
              <div>
                Large Checked Bag: <strong className="font-semibold">1.5 slots</strong>
              </div>
              <div>
                Oversized Surf/Golf: <strong className="font-semibold">2.0 slots</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {isAuthenticated ? (
        <>
          {/* Live Storage Zones Grid */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-navy-950">Physical Storage Zones</h2>
            {zones.length === 0 ? (
              <div className="bg-white rounded-2xl border border-sand-200 p-6 text-xs text-navy-600">
                No physical storage zones created yet. Add at least one zone to organize compartments.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {zones.map((zone) => (
                  <div
                    key={zone.id}
                    className="bg-white rounded-2xl border border-sand-200 p-5 space-y-3 shadow-sm text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-navy-100 text-navy-900 border border-navy-200">
                        {zone.zoneType}
                      </span>
                      <span
                        className={`font-bold ${
                          zone.isActive ? "text-emerald-700" : "text-navy-500"
                        }`}
                      >
                        {zone.isActive ? "Active" : "Paused"}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-navy-950 text-sm">{zone.name}</h3>
                      <p className="text-navy-500 mt-0.5">
                        Security Tier: {zone.securityTier.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        disabled={updateZoneMutation.isPending}
                        onClick={() => void handleToggleZoneActive(zone)}
                        className="flex-1 py-1.5 rounded-lg border border-sand-300 font-bold text-navy-800 hover:bg-sand-50 transition"
                      >
                        {zone.isActive ? "Pause Zone" : "Activate Zone"}
                      </button>
                      <button
                        type="button"
                        disabled={deleteZoneMutation.isPending}
                        onClick={() => void handleDeleteZone(zone)}
                        aria-label={`Delete zone ${zone.name}`}
                        className="p-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Capacity Pools Grid */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-navy-950">Booking Capacity Pools</h2>
            {pools.length === 0 ? (
              <div className="bg-white rounded-2xl border border-sand-200 p-6 text-xs text-navy-600">
                No capacity pools configured yet. Add a Shared or Dedicated pool before submitting this location for moderation.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {pools.map((pool) => {
                  const linkedZone = zones.find((z) => z.id === pool.zoneId);
                  return (
                    <div
                      key={pool.id}
                      className="bg-white rounded-2xl border border-sand-200 p-5 space-y-3 shadow-sm text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold px-2 py-0.5 rounded bg-sand-100 text-navy-900 border border-sand-300">
                          {pool.poolType}
                          {pool.dedicatedBagCategory ? ` (${pool.dedicatedBagCategory})` : ""}
                        </span>
                        <span
                          className={`font-bold ${
                            pool.isActive ? "text-emerald-700" : "text-navy-500"
                          }`}
                        >
                          {pool.totalUnits} Units
                        </span>
                      </div>
                      <p className="text-navy-600">
                        Zone: <strong>{linkedZone?.name ?? "All Hub Compartments"}</strong>
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPool(pool);
                            setEditPoolUnits(pool.totalUnits);
                            setEditPoolActive(pool.isActive);
                          }}
                          className="flex-1 py-1.5 rounded-lg border border-sand-300 font-bold text-navy-800 hover:bg-sand-50 transition"
                        >
                          Edit Units
                        </button>
                        <button
                          type="button"
                          disabled={deletePoolMutation.isPending}
                          onClick={() => void handleDeletePool(pool.id)}
                          aria-label={`Delete pool ${pool.id}`}
                          className="p-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Demo Zone Cards */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {demoLoc?.zones.map((zone) => {
            const percent = Math.round((zone.occupied / zone.capacity) * 100);
            return (
              <div
                key={zone.id}
                className="bg-white rounded-2xl border border-sand-200 p-5 space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-navy-100 text-navy-900 border border-navy-200">
                    {zone.code}
                  </span>
                  <span className="text-xs font-bold text-emerald-700">
                    {zone.capacity - zone.occupied} Free
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-navy-950 text-sm">{zone.name}</h3>
                  <p className="text-xs text-navy-500 mt-0.5">
                    Occupied: {zone.occupied} of {zone.capacity} slots ({percent}%)
                  </p>
                </div>
                <div className="w-full bg-sand-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-terracotta-500 h-2 rounded-full transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <button
                  type="button"
                  className="w-full py-1.5 rounded-lg border border-sand-300 text-xs font-bold text-navy-800 hover:bg-sand-50 transition"
                >
                  Configure Zone Limits
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Storage Zone Modal */}
      {showAddZone && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              if (!isAuthenticated) {
                e.preventDefault();
                setShowAddZone(false);
                return;
              }
              void handleCreateZone(e);
            }}
            className="bg-white rounded-2xl border border-sand-200 max-w-md w-full p-6 space-y-4 shadow-xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <h3 className="text-base font-bold text-navy-950">Add Physical Storage Zone</h3>
              <button
                type="button"
                onClick={() => setShowAddZone(false)}
                className="p-1 rounded-lg hover:bg-sand-100 text-navy-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-navy-900 mb-1">Zone Display Name</label>
                <input
                  type="text"
                  required
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  placeholder="e.g. Main Locked Steel Rack A"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Zone Type</label>
                <select
                  aria-label="Zone Type"
                  value={zoneType}
                  onChange={(e) => setZoneType(e.target.value as StorageZoneType)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                >
                  {STORAGE_ZONE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Security Tier</label>
                <select
                  aria-label="Security Tier"
                  value={securityTier}
                  onChange={(e) => setSecurityTier(e.target.value as StorageSecurityTier)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                >
                  {STORAGE_SECURITY_TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddZone(false)}
                className="px-4 py-2 rounded-xl border border-sand-300 font-bold text-navy-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createZoneMutation.isPending}
                className="px-4 py-2 rounded-xl bg-terracotta-500 text-white font-bold disabled:opacity-50"
              >
                {createZoneMutation.isPending ? "Adding..." : "Add Zone"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Capacity Pool Modal */}
      {showAddPool && isAuthenticated && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={(e) => void handleCreatePool(e)}
            className="bg-white rounded-2xl border border-sand-200 max-w-md w-full p-6 space-y-4 shadow-xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <h3 className="text-base font-bold text-navy-950">Add Capacity Pool</h3>
              <button
                type="button"
                onClick={() => setShowAddPool(false)}
                className="p-1 rounded-lg hover:bg-sand-100 text-navy-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-navy-900 mb-1">Pool Type</label>
                <select
                  aria-label="Pool Type"
                  value={poolType}
                  onChange={(e) => setPoolType(e.target.value as CapacityPoolType)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                >
                  {CAPACITY_POOL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              {poolType === "DEDICATED" && (
                <div>
                  <label className="block font-bold text-navy-900 mb-1">
                    Dedicated Bag Category
                  </label>
                  <select
                    aria-label="Dedicated Bag Category"
                    value={dedicatedCategory}
                    onChange={(e) => setDedicatedCategory(e.target.value as BagCategory)}
                    className="w-full rounded-xl border border-sand-300 px-3 py-2"
                  >
                    {BAG_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block font-bold text-navy-900 mb-1">
                  Linked Zone (Optional)
                </label>
                <select
                  aria-label="Linked Zone"
                  value={poolZoneId}
                  onChange={(e) => setPoolZoneId(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                >
                  <option value="">All Location Compartments</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({z.zoneType})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Total Units</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={poolUnits}
                  onChange={(e) => setPoolUnits(Number(e.target.value))}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddPool(false)}
                className="px-4 py-2 rounded-xl border border-sand-300 font-bold text-navy-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createPoolMutation.isPending}
                className="px-4 py-2 rounded-xl bg-navy-900 text-white font-bold disabled:opacity-50"
              >
                {createPoolMutation.isPending ? "Saving..." : "Save Pool"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Capacity Pool Modal */}
      {editingPool && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={(e) => void handleSavePoolEdit(e)}
            className="bg-white rounded-2xl border border-sand-200 max-w-md w-full p-6 space-y-4 shadow-xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <h3 className="text-base font-bold text-navy-950">Update Capacity Pool Units</h3>
              <button
                type="button"
                onClick={() => setEditingPool(null)}
                className="p-1 rounded-lg hover:bg-sand-100 text-navy-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-navy-900 mb-1">Total Capacity Units</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={editPoolUnits}
                  onChange={(e) => setEditPoolUnits(Number(e.target.value))}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 font-mono"
                />
              </div>
              <label className="flex items-center gap-2 font-bold text-navy-900">
                <input
                  type="checkbox"
                  checked={editPoolActive}
                  onChange={(e) => setEditPoolActive(e.target.checked)}
                  className="rounded text-terracotta-500"
                />
                <span>Pool Active for Traveller Reservations</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingPool(null)}
                className="px-4 py-2 rounded-xl border border-sand-300 font-bold text-navy-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updatePoolMutation.isPending}
                className="px-4 py-2 rounded-xl bg-terracotta-500 text-white font-bold disabled:opacity-50"
              >
                {updatePoolMutation.isPending ? "Updating..." : "Update Pool"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
