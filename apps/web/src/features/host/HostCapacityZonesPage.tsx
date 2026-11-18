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
import { Plus, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, LoadingSkeleton, Modal } from "@/components/ui";
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
import {
  HostLocationSetupTabs,
  HostQueryErrorAlert,
  isUuid,
  NoLocationSelectedCard
} from "./host-helpers";
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
  const [confirmDeleteZone, setConfirmDeleteZone] = useState<StorageZone | null>(null);
  const [confirmDeletePool, setConfirmDeletePool] = useState<StorageCapacityPool | null>(null);
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
      <Card className="p-6 space-y-4">
        <LoadingSkeleton variant="text" className="w-60 h-7" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <LoadingSkeleton className="h-32 w-full" />
          <LoadingSkeleton className="h-32 w-full" />
          <LoadingSkeleton className="h-32 w-full" />
        </div>
      </Card>
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

  const handleDeleteZone = async () => {
    if (!liveLocationId || !confirmDeleteZone) return;
    const zone = confirmDeleteZone;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await deleteZoneMutation.mutateAsync({
        locationId: liveLocationId,
        zoneId: zone.id
      });
      setConfirmDeleteZone(null);
      setSuccessMsg(`Deleted storage zone "${zone.name}".`);
    } catch (err) {
      setConfirmDeleteZone(null);
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

  const handleDeletePool = async () => {
    if (!liveLocationId || !confirmDeletePool) return;
    const poolId = confirmDeletePool.id;
    setErrorMsg(null);
    try {
      await deletePoolMutation.mutateAsync({ locationId: liveLocationId, poolId });
      setConfirmDeletePool(null);
      setSuccessMsg("Capacity pool deleted.");
    } catch (err) {
      setConfirmDeletePool(null);
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete capacity pool.");
    }
  };

  const locationTitle = detailQuery.data?.name ?? demoLoc?.name ?? "Storage Hub";

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-5 sm:p-6">
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
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowAddPool(true)}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Add Capacity Pool
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => setShowAddZone(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add Storage Zone
            </Button>
          </div>
        </div>
      </Card>

      <HostLocationSetupTabs locationId={targetLocationId} querySuffix={querySuffix} />

      <Alert variant="info" title="How Physical Zones &amp; Bookable Pools Work">
        <strong>Physical Zones</strong> represent the locked rooms, steel racks, or cages where staff place bags at the counter.{" "}
        <strong>Bookable Capacity Pools</strong> set the total unit inventory available to travellers during online checkout.
      </Alert>

      {errorMsg && (
        <Alert variant="danger" title="Capacity Action Blocked">
          {errorMsg}
        </Alert>
      )}

      {successMsg && (
        <Alert variant="success" onDismiss={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}

      {/* Aggregate Capacity Overview */}
      <Card className="p-6 space-y-4">
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
      </Card>

      {isAuthenticated ? (
        <>
          {/* Live Storage Zones Grid */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-navy-950">Physical Storage Zones</h2>
            {zones.length === 0 ? (
              <EmptyState
                mascot="suitcase-peek"
                title="No physical storage zones created yet"
                description="Add at least one locked room, steel rack, or compartment zone so counter staff can assign bags."
                action={
                  <Button type="button" size="sm" onClick={() => setShowAddZone(true)}>
                    Add Storage Zone
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {zones.map((zone) => (
                  <Card key={zone.id} className="p-5 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <Badge variant="navy" size="sm" className="font-mono">
                        {zone.zoneType}
                      </Badge>
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
                        onClick={() => setConfirmDeleteZone(zone)}
                        aria-label={`Delete zone ${zone.name}`}
                        className="p-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Live Capacity Pools Grid */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-navy-950">Booking Capacity Pools</h2>
            {pools.length === 0 ? (
              <EmptyState
                mascot="suitcase-peek"
                title="No capacity pools configured yet"
                description="Add a Shared or Dedicated capacity pool before submitting this location for moderation."
                action={
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAddPool(true)}
                  >
                    Add Capacity Pool
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {pools.map((pool) => {
                  const linkedZone = zones.find((z) => z.id === pool.zoneId);
                  return (
                    <Card key={pool.id} className="p-5 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <Badge variant="neutral" size="sm" className="font-mono">
                          {pool.poolType}
                          {pool.dedicatedBagCategory ? ` (${pool.dedicatedBagCategory})` : ""}
                        </Badge>
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
                          onClick={() => setConfirmDeletePool(pool)}
                          aria-label={`Delete pool ${pool.id}`}
                          className="p-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </Card>
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
              <Card key={zone.id} className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="navy" size="sm" className="font-mono">
                    {zone.code}
                  </Badge>
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
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Storage Zone Modal */}
      <Modal
        open={showAddZone}
        onClose={() => setShowAddZone(false)}
        closeLabel="Close add storage zone modal"
        size="sm"
        title="Add Physical Storage Zone"
      >
        <form
          onSubmit={(e) => {
            if (!isAuthenticated) {
              e.preventDefault();
              setShowAddZone(false);
              return;
            }
            void handleCreateZone(e);
          }}
          className="space-y-4 text-xs"
        >
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
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAddZone(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={createZoneMutation.isPending}>
              {createZoneMutation.isPending ? "Adding..." : "Add Zone"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Capacity Pool Modal */}
      <Modal
        open={Boolean(showAddPool && isAuthenticated)}
        onClose={() => setShowAddPool(false)}
        closeLabel="Close add capacity pool modal"
        size="sm"
        title="Add Capacity Pool"
      >
        <form onSubmit={(e) => void handleCreatePool(e)} className="space-y-4 text-xs">
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
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAddPool(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              isLoading={createPoolMutation.isPending}
            >
              {createPoolMutation.isPending ? "Saving..." : "Save Pool"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Capacity Pool Modal */}
      <Modal
        open={Boolean(editingPool)}
        onClose={() => setEditingPool(null)}
        closeLabel="Close edit capacity pool modal"
        size="sm"
        title="Update Capacity Pool Units"
      >
        <form onSubmit={(e) => void handleSavePoolEdit(e)} className="space-y-4 text-xs">
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingPool(null)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={updatePoolMutation.isPending}>
              {updatePoolMutation.isPending ? "Updating..." : "Update Pool"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Zone Modal */}
      <Modal
        open={Boolean(confirmDeleteZone)}
        onClose={() => setConfirmDeleteZone(null)}
        closeLabel="Close delete zone modal"
        size="sm"
        title="Delete Storage Zone?"
        subtitle={confirmDeleteZone?.name}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmDeleteZone(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={deleteZoneMutation.isPending}
              onClick={() => void handleDeleteZone()}
            >
              Delete Zone
            </Button>
          </>
        }
      >
        <p className="text-xs text-navy-700 leading-relaxed">
          Remove physical zone <strong>{confirmDeleteZone?.name}</strong>? Zones linked to active
          bookings or capacity pools may need to be unlinked first.
        </p>
      </Modal>

      {/* Confirm Delete Pool Modal */}
      <Modal
        open={Boolean(confirmDeletePool)}
        onClose={() => setConfirmDeletePool(null)}
        closeLabel="Close delete pool modal"
        size="sm"
        title="Delete Capacity Pool?"
        subtitle={
          confirmDeletePool
            ? `${confirmDeletePool.poolType} (${confirmDeletePool.totalUnits} units)`
            : undefined
        }
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmDeletePool(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={deletePoolMutation.isPending}
              onClick={() => void handleDeletePool()}
            >
              Delete Pool
            </Button>
          </>
        }
      >
        <p className="text-xs text-navy-700 leading-relaxed">
          Deleting this capacity pool removes its {confirmDeletePool?.totalUnits} bookable units
          from future traveller availability calculations.
        </p>
      </Modal>
    </div>
  );
}
