import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  BAG_CATEGORIES,
  DEFAULT_CATEGORY_MULTIPLIERS_BPS,
  PRICING_UNITS,
  type BagCategory,
  type PricingUnit
} from "@luggage-storage/contracts";
import { CheckCircle2, Info } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { DEMO_LOCATIONS } from "@/data/mock-marketplace";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { useAuthStore } from "@/store/useAuthStore";
import {
  useConfigurePricingPolicyMutation,
  useHostLocationDetailQuery,
  usePricingPolicyQuery
} from "@/hooks/queries/use-host-portal";
import { HostQueryErrorAlert, isUuid, NoLocationSelectedCard } from "./host-helpers";
import { useHostVenue } from "./HostDashboardLayout";

const CATEGORY_DISPLAY: Record<BagCategory, string> = {
  BAG_SMALL: "Small Bag (Backpack)",
  BAG_MEDIUM: "Medium Bag (Cabin Trolley)",
  BAG_LARGE: "Large Bag (Checked Suitcase)",
  BAG_OVERSIZED: "Oversized Bag (Surf / Gear)"
};

export function HostPricingRulesMultipliersPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { allLocations, selectedLocationId, isDemoActive, querySuffix } = useHostVenue();
  const { isAuthenticated } = useAuthStore();

  const targetLocationId = id || selectedLocationId || allLocations[0]?.id || "";
  const liveLocationId = isAuthenticated && isUuid(targetLocationId) ? targetLocationId : undefined;

  const detailQuery = useHostLocationDetailQuery(liveLocationId, { enabled: isAuthenticated });
  const pricingQuery = usePricingPolicyQuery(liveLocationId, { enabled: isAuthenticated });
  const savePricingMutation = useConfigurePricingPolicyMutation();

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

  // Live LKR pricing state (values stored in LKR rupees in UI, converted to minor cents on save)
  const [pricingUnit, setPricingUnit] = useState<PricingUnit>("CALENDAR_DAY");
  const [baseRateLkr, setBaseRateLkr] = useState<number>(1500);
  const [tierRatesLkr, setTierRatesLkr] = useState<Record<BagCategory, number>>({
    BAG_SMALL: 1200,
    BAG_MEDIUM: 1500,
    BAG_LARGE: 1800,
    BAG_OVERSIZED: 2250
  });
  const [tierMultipliers, setTierMultipliers] = useState<Record<BagCategory, number>>(
    DEFAULT_CATEGORY_MULTIPLIERS_BPS
  );

  // Demo prototype state (unused in live mode)
  const [gracePeriodMins, setGracePeriodMins] = useState<number>(demoLoc?.gracePeriodMinutes ?? 30);
  const [lateFeeRule, setLateFeeRule] = useState<string>("STANDARD_HOURLY_OR_DAILY_TIER");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !pricingQuery.data) return;
    const policy = pricingQuery.data;
    setPricingUnit(policy.pricingUnit);
    setBaseRateLkr(Math.round(policy.baseRateMinor / 100));

    if (policy.tierRates && policy.tierRates.length > 0) {
      const nextRates: Record<BagCategory, number> = {
        BAG_SMALL: Math.round(policy.baseRateMinor / 100),
        BAG_MEDIUM: Math.round(policy.baseRateMinor / 100),
        BAG_LARGE: Math.round(policy.baseRateMinor / 100),
        BAG_OVERSIZED: Math.round(policy.baseRateMinor / 100)
      };
      const nextMult = { ...DEFAULT_CATEGORY_MULTIPLIERS_BPS };
      for (const tier of policy.tierRates) {
        nextRates[tier.bagCategory] = Math.round(tier.rateMinor / 100);
        nextMult[tier.bagCategory] = tier.categoryMultiplierBps;
      }
      setTierRatesLkr(nextRates);
      setTierMultipliers(nextMult);
    }
  }, [isAuthenticated, pricingQuery.data]);

  if (isAuthenticated && !liveLocationId) {
    return (
      <NoLocationSelectedCard
        description="Create or select a verified storage hub from Storage Locations before configuring pricing rules."
        querySuffix={querySuffix}
      />
    );
  }

  if (!isAuthenticated && !demoLoc) {
    return (
      <NoLocationSelectedCard
        description="Create or select a verified storage hub from Storage Locations before configuring pricing rules."
        querySuffix={querySuffix}
      />
    );
  }

  if (isAuthenticated && pricingQuery.isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-sand-200 p-8 text-center text-xs font-semibold text-navy-600">
        Loading LKR pricing policy...
      </div>
    );
  }

  if (isAuthenticated && pricingQuery.isError) {
    return (
      <HostQueryErrorAlert
        message={
          pricingQuery.error instanceof Error
            ? pricingQuery.error.message
            : "Failed to load pricing policy."
        }
        onRetry={() => void pricingQuery.refetch()}
      />
    );
  }

  const handleSavePricing = async () => {
    setErrorMsg(null);
    setSavedNotice(null);

    if (!isAuthenticated) {
      setSavedNotice("Pricing rules updated successfully. Saved to local session.");
      return;
    }

    if (!liveLocationId) return;

    try {
      await savePricingMutation.mutateAsync({
        locationId: liveLocationId,
        data: {
          currency: "LKR",
          pricingUnit,
          baseRateMinor: Math.max(100, Math.round(Number(baseRateLkr) * 100)),
          tierRates: BAG_CATEGORIES.map((bagCategory) => ({
            bagCategory,
            rateMinor: Math.max(0, Math.round(Number(tierRatesLkr[bagCategory]) * 100)),
            categoryMultiplierBps: tierMultipliers[bagCategory]
          }))
        }
      });
      setSavedNotice("Active LKR pricing policy updated.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save pricing policy.");
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
              Pricing Rules &amp; Multipliers
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Configure authoritative LKR storage rates per bag size tier for checkout quotations.
            </p>
          </div>
          <button
            type="button"
            disabled={savePricingMutation.isPending}
            onClick={() => void handleSavePricing()}
            className="px-5 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
          >
            {savePricingMutation.isPending ? "Saving..." : "Save Pricing Rules"}
          </button>
        </div>
      </div>

      {errorMsg && (
        <Alert variant="danger" title="Pricing Save Failed">
          {errorMsg}
        </Alert>
      )}

      {savedNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {isAuthenticated ? (
        <>
          {pricingQuery.data === null && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-center gap-2">
              <Info className="h-4 w-4 text-amber-700 flex-shrink-0" />
              <span>
                No active pricing policy configured yet. Set LKR tier rates below and save before submitting this location for moderation.
              </span>
            </div>
          )}

          {/* Live Billing Unit & Baseline Rate */}
          <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm text-xs">
            <h2 className="text-sm font-bold text-navy-950">Base Tariff &amp; Billing Unit</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-navy-900 mb-1">Billing Unit</label>
                <select
                  aria-label="Billing Unit"
                  value={pricingUnit}
                  onChange={(e) => setPricingUnit(e.target.value as PricingUnit)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                >
                  {PRICING_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit === "CALENDAR_DAY" ? "Per Calendar Day" : "Per 24-Hour Block"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">
                  Baseline Medium Rate (LKR)
                </label>
                <input
                  type="number"
                  min={1}
                  step={50}
                  value={baseRateLkr}
                  onChange={(e) => setBaseRateLkr(Number(e.target.value))}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 font-mono font-bold"
                />
                <p className="text-[11px] text-navy-500 mt-1">
                  Stored as {Math.round(baseRateLkr * 100)} minor units (cents) in LKR.
                </p>
              </div>
            </div>
          </div>

          {/* Live 4-Tier LKR Rates */}
          <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-navy-950">Standard Tiered Storage Rates (LKR)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {BAG_CATEGORIES.map((category) => (
                <div
                  key={category}
                  className="p-4 rounded-xl bg-sand-50/70 border border-sand-200 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-navy-900">
                      {category.replace("BAG_", "")} BAG
                    </span>
                    <span className="text-[10px] font-mono text-navy-500">
                      {(tierMultipliers[category] / 10000).toFixed(2)}x
                    </span>
                  </div>
                  <p className="text-[11px] text-navy-600">{CATEGORY_DISPLAY[category]}</p>
                  <div className="space-y-1">
                    <label className="block text-[11px] text-navy-700 font-medium">
                      Unit Rate (LKR)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={tierRatesLkr[category]}
                      onChange={(e) =>
                        setTierRatesLkr((prev) => ({
                          ...prev,
                          [category]: Number(e.target.value)
                        }))
                      }
                      className="w-full rounded-lg border border-sand-300 px-2.5 py-1.5 font-mono font-bold"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Demo Mode Pricing + Prototype Policy */
        <>
          <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-navy-950">Standard Tiered Storage Rates (LKR)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(["SMALL", "MEDIUM", "LARGE", "OVERSIZED"] as const).map((tier) => (
                <div
                  key={tier}
                  className="p-4 rounded-xl bg-sand-50/70 border border-sand-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-navy-900">{tier} BAG</span>
                    <span className="text-[10px] text-navy-500">Tier Rates</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <label className="block text-[11px] text-navy-600 font-medium">
                      Hourly Rate (LKR)
                    </label>
                    <input
                      type="number"
                      defaultValue={demoLoc?.hourlyRateLkr[tier]}
                      className="w-full rounded-lg border border-sand-300 px-2.5 py-1.5 font-mono text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1 text-xs">
                    <label className="block text-[11px] text-navy-600 font-medium">
                      Daily Max Cap (LKR)
                    </label>
                    <input
                      type="number"
                      defaultValue={demoLoc?.dailyCapLkr[tier]}
                      className="w-full rounded-lg border border-sand-300 px-2.5 py-1.5 font-mono text-xs font-bold"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-navy-950">
                  Late Collection Grace Period &amp; Fee Policy
                </h2>
                <span className="px-2 py-0.5 rounded bg-sand-100 text-navy-700 text-[10px] font-bold border border-sand-300">
                  DEC-002 Pending PO Sign-Off
                </span>
              </div>
              <p className="text-xs text-navy-600">
                When a traveller arrives past their scheduled pick-up window, this policy defines the grace allowance and overdue fee display before checkout release.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-navy-900 mb-1">
                  Configurable Grace Period (Minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={gracePeriodMins}
                  onChange={(e) => setGracePeriodMins(Number(e.target.value))}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 font-mono font-bold text-navy-900"
                />
                <p className="text-[11px] text-navy-500 mt-1">
                  Grace window after scheduled pickup before late fee applies (0–120 mins).
                </p>
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">
                  Late Collection Surcharge Policy
                </label>
                <select
                  aria-label="Late Collection Surcharge Policy"
                  value={lateFeeRule}
                  onChange={(e) => setLateFeeRule(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-medium text-navy-900"
                >
                  <option value="STANDARD_HOURLY_OR_DAILY_TIER">
                    Standard Hourly Rate or Daily Maximum Cap (LKR)
                  </option>
                  <option value="NO_LATE_FEE">Waive Late Surcharges (Hospitality Waiver)</option>
                  <option value="FLAT_OVERNIGHT_FEE">Flat Overnight Carryover Fee (LKR 1,200)</option>
                </select>
                <p className="text-[11px] text-navy-500 mt-1">
                  Note: Per customer safety mandates, baggage release is never withheld for overdue fee collection.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">
                  Late Collection Surcharge Policy (Illustrative Prototype):
                </strong>{" "}
                Exact late collection overdue surcharge amounts are sample figures pending Product Owner pricing policy sign-off. All payments are settled safely online.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
